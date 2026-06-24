const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const MedicalRecord = require('../models/MedicalRecord');
const Prescription = require('../models/Prescription');
const User = require('../models/User');
const { generatePrescriptionPDF } = require('../utils/generatePrescriptionPDF');
const sendEmail = require('../utils/sendEmail');
const {
  buildPrescriptionEmailHtml,
  buildPrescriptionEmailSubject,
} = require('../utils/prescriptionEmailTemplate');

const MEDICAL_RECORD_DIR = path.resolve(__dirname, '../private/medical_records');

const sanitizeText = (value, max = 5000) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\0/g, '').trim().slice(0, max);
};

const sanitizeVitals = (value = {}) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    bloodPressure: sanitizeText(source.bloodPressure, 80),
    pulse: sanitizeText(source.pulse, 80),
    temperature: sanitizeText(source.temperature, 80),
    spo2: sanitizeText(source.spo2, 80),
    weight: sanitizeText(source.weight, 80),
    height: sanitizeText(source.height, 80),
  };
};

const sanitizeMedicines = (items = []) => {
  if (!Array.isArray(items)) return [];

  return items
    .slice(0, 50)
    .map((item) => ({
      medicineName: sanitizeText(item.medicineName || item.medicine || item.name, 200),
      dosage: sanitizeText(item.dosage, 120),
      frequency: sanitizeText(item.frequency, 120),
      duration: sanitizeText(item.duration, 120),
      timing: sanitizeText(item.timing, 120),
      instructions: sanitizeText(item.instructions, 500),
    }))
    .filter((item) => item.medicineName);
};

const isDoctorAccount = (user) => user && user.licenseNumber !== undefined;
const isAdminAccount = (user) => Boolean(user?.isAdmin || user?.email === 'admin@medimeet.com');

const canAccessPrescription = (req, prescription) => {
  if (!req.user || !prescription) return false;
  if (isAdminAccount(req.user)) return true;
  if (isDoctorAccount(req.user)) return String(prescription.doctor) === String(req.user._id);
  return String(prescription.patient) === String(req.user._id);
};

const getAge = (dob) => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 0 ? String(age) : '';
};

const makePrescriptionNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MM-RX-${datePart}-${randomPart}`;
};

const shapePrescription = (prescription) => ({
  _id: prescription._id,
  prescriptionNumber: prescription.prescriptionNumber,
  appointmentId: prescription.appointment,
  patientId: prescription.patient,
  doctorId: prescription.doctor,
  doctorName: prescription.doctorNameSnapshot,
  patientName: prescription.patientNameSnapshot,
  specialization: prescription.specializationSnapshot,
  pdfUrl: `prescriptions/${prescription._id}/download`,
  emailStatus: prescription.emailStatus,
  createdAt: prescription.createdAt,
  finalizedAt: prescription.finalizedAt,
});

const findPrescriptionForAccess = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Prescription.findById(id);
};

const createPrescription = asyncHandler(async (req, res) => {
  if (!isDoctorAccount(req.user)) {
    return res.status(403).json({ success: false, message: 'Only doctors can create prescriptions.' });
  }

  const appointmentId = sanitizeText(req.body.appointmentId, 64);
  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    return res.status(400).json({ success: false, message: 'Valid appointmentId is required.' });
  }

  const diagnosis = sanitizeText(req.body.diagnosis, 3000);
  if (!diagnosis) {
    return res.status(400).json({ success: false, message: 'Diagnosis is required before generating a prescription.' });
  }

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    return res.status(404).json({ success: false, message: 'Appointment not found.' });
  }

  if (String(appointment.doctorId) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'You can create prescriptions only for your own appointments.' });
  }

  if (appointment.paymentStatus !== 'paid' && !['confirmed', 'completed'].includes(appointment.status)) {
    return res.status(400).json({ success: false, message: 'Prescription can be generated only for a confirmed consultation.' });
  }

  const existing = await Prescription.findOne({ appointment: appointment._id }).lean();
  if (existing) {
    return res.status(409).json({ success: false, message: 'A finalized prescription already exists for this appointment.' });
  }

  const [patient, doctor] = await Promise.all([
    User.findById(appointment.patientId).select('name email phone gender dob allergies emergency').lean(),
    Doctor.findById(appointment.doctorId).select('name email phone specialization licenseNumber experience qualifications').lean(),
  ]);

  if (!patient) {
    return res.status(404).json({ success: false, message: 'Patient not found.' });
  }
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor profile not found.' });
  }

  const medicines = sanitizeMedicines(req.body.medicines);
  const clinicalData = {
    chiefComplaints: sanitizeText(req.body.chiefComplaints, 3000),
    duration: sanitizeText(req.body.duration, 500),
    historyOfPresentIllness: sanitizeText(req.body.historyOfPresentIllness, 5000),
    vitals: sanitizeVitals(req.body.vitals),
    diagnosis,
    pastMedicalHistory: sanitizeText(req.body.pastMedicalHistory, 3000),
    familyHistory: sanitizeText(req.body.familyHistory, 3000),
    socialHistory: sanitizeText(req.body.socialHistory, 3000),
    allergies: sanitizeText(req.body.allergies || patient.allergies, 3000),
    investigationOrders: sanitizeText(req.body.investigationOrders, 3000),
    procedureHistory: sanitizeText(req.body.procedureHistory, 3000),
    advice: sanitizeText(req.body.advice, 5000),
    followUpDate: sanitizeText(req.body.followUpDate, 64),
    emergencyInstructions: sanitizeText(req.body.emergencyInstructions, 3000),
    notes: sanitizeText(req.body.notes, 5000),
  };

  const prescriptionNumber = makePrescriptionNumber();
  const visitType = sanitizeText(req.body.visitType || req.body.consultationVisitType || 'New visit', 80);
  const consultationDate = new Date();

  const pdfData = {
    prescriptionNumber,
    generatedAt: consultationDate,
    patient: {
      patientId: String(patient._id),
      patientName: patient.name,
      patientEmail: patient.email,
      phone: patient.phone,
      gender: patient.gender,
      age: getAge(patient.dob),
      dateOfBirth: patient.dob,
      address: sanitizeText(req.body.address, 500),
    },
    doctor: {
      doctorId: String(doctor._id),
      doctorName: doctor.name,
      specialization: doctor.specialization,
      qualification: sanitizeText(
        req.body.qualification || (Array.isArray(doctor.qualifications) ? doctor.qualifications.join(', ') : ''),
        200
      ),
      registrationNumber: doctor.licenseNumber,
      doctorEmail: doctor.email,
    },
    appointment: {
      appointmentId: String(appointment._id),
      appointmentDate: appointment.date,
      consultationDate,
      consultationTime: appointment.time,
      consultationType: appointment.type || 'Online Doctor Consultation',
      visitType,
      status: appointment.status,
    },
    clinicalData,
    medicines,
  };

  let pdf;
  try {
    pdf = await generatePrescriptionPDF({
      data: pdfData,
      appointmentId: appointment._id,
      patientId: patient._id,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'PDF generation failed. Please try again.' });
  }

  const prescription = await Prescription.create({
    prescriptionNumber,
    appointment: appointment._id,
    patient: patient._id,
    doctor: doctor._id,
    patientEmail: patient.email,
    patientNameSnapshot: patient.name,
    doctorNameSnapshot: doctor.name,
    specializationSnapshot: doctor.specialization,
    doctorEmailSnapshot: doctor.email,
    consultationType: appointment.type || 'Online Doctor Consultation',
    visitType,
    status: 'finalized',
    clinicalData,
    medicines,
    pdfFileName: pdf.fileName,
    pdfPath: pdf.relativePath,
    pdfMimeType: pdf.mimeType,
    pdfSize: pdf.size,
    createdBy: doctor._id,
    finalizedAt: consultationDate,
  });

  const record = await MedicalRecord.create({
    patientId: patient._id,
    prescriptionId: prescription._id,
    name: `Prescription - ${appointment.date}`,
    doctor: doctor.name,
    specialization: doctor.specialization,
    date: appointment.date,
    type: 'prescription',
    notes: [clinicalData.diagnosis, clinicalData.advice].filter(Boolean).join('\n\n').slice(0, 5000),
    storedFileName: pdf.relativePath,
    originalFileName: `${prescriptionNumber}.pdf`,
    mimeType: pdf.mimeType,
    fileSize: pdf.size,
  });

  prescription.medicalRecord = record._id;
  await prescription.save();

  appointment.notes = clinicalData.notes || appointment.notes;
  appointment.prescription = medicines.map((medicine) => ({
    medicine: medicine.medicineName,
    dosage: medicine.dosage,
    duration: medicine.duration,
    instructions: [medicine.frequency, medicine.timing, medicine.instructions].filter(Boolean).join(' | '),
  }));
  appointment.status = 'completed';
  await appointment.save();

  try {
    await sendEmail({
      email: patient.email,
      subject: buildPrescriptionEmailSubject({
        doctorName: doctor.name,
        prescriptionNumber,
      }),
      html: buildPrescriptionEmailHtml({
        patientName: patient.name,
        doctorName: doctor.name,
        specialization: doctor.specialization,
        appointmentDate: appointment.date,
        prescriptionNumber,
        supportEmail: process.env.EMAIL_USER || 'medimeet.support@gmail.com',
        messageType: 'generated',
      }),
      attachments: [
        {
          filename: `${prescriptionNumber}.pdf`,
          path: pdf.absolutePath,
          contentType: pdf.mimeType,
        },
      ],
    });
    prescription.emailStatus = 'sent';
    prescription.emailSentAt = new Date();
    prescription.emailError = '';
  } catch (error) {
    prescription.emailStatus = 'failed';
    prescription.emailError = error.message || 'Email could not be sent';
  }
  await prescription.save();

  const io = req.app.get('io');
  if (io) {
    io.to(`user:${patient._id}`).emit('records:updated', {
      reason: 'prescription-generated',
      recordId: String(record._id),
      prescriptionId: String(prescription._id),
      title: 'Prescription Available',
      doctor: doctor.name,
      specialization: doctor.specialization,
      date: appointment.date,
      type: 'prescription',
      fileUrl: `records/${record._id}/file`,
    });
    io.to(`user:${doctor._id}`).emit('appointments:updated', {
      reason: 'prescription-generated',
      appointmentId: String(appointment._id),
      status: appointment.status,
      patientName: patient.name,
      date: appointment.date,
      time: appointment.time,
    });
  }

  res.status(201).json({
    success: true,
    message: prescription.emailStatus === 'sent'
      ? 'Prescription generated and sent to patient successfully'
      : 'Prescription generated successfully. Email delivery failed and was recorded.',
    prescription: shapePrescription(prescription),
  });
});

const getPatientPrescriptions = asyncHandler(async (req, res) => {
  const prescriptions = await Prescription.find({ patient: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, prescriptions: prescriptions.map(shapePrescription) });
});

const getDoctorPrescriptions = asyncHandler(async (req, res) => {
  if (!isDoctorAccount(req.user)) {
    return res.status(403).json({ success: false, message: 'Only doctors can view this list.' });
  }
  const prescriptions = await Prescription.find({ doctor: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, prescriptions: prescriptions.map(shapePrescription) });
});

const getPrescriptionById = asyncHandler(async (req, res) => {
  const prescription = await findPrescriptionForAccess(req.params.id);
  if (!prescription) {
    return res.status(404).json({ success: false, message: 'Prescription not found.' });
  }
  if (!canAccessPrescription(req, prescription)) {
    return res.status(403).json({ success: false, message: 'Not authorized to access this prescription.' });
  }
  res.json({ success: true, prescription: shapePrescription(prescription) });
});

const downloadPrescription = asyncHandler(async (req, res) => {
  const prescription = await findPrescriptionForAccess(req.params.id);
  if (!prescription) {
    return res.status(404).json({ success: false, message: 'Prescription not found.' });
  }
  if (!canAccessPrescription(req, prescription)) {
    return res.status(403).json({ success: false, message: 'Not authorized to download this prescription.' });
  }

  const resolvedPath = path.resolve(MEDICAL_RECORD_DIR, prescription.pdfPath);
  if (!resolvedPath.startsWith(MEDICAL_RECORD_DIR + path.sep) || !fs.existsSync(resolvedPath)) {
    return res.status(404).json({ success: false, message: 'Prescription PDF not found.' });
  }

  const safeName = `${prescription.prescriptionNumber}.pdf`.replace(/[^\w.\-]+/g, '_');
  res.setHeader('Content-Type', prescription.pdfMimeType || 'application/pdf');
  res.setHeader('Cache-Control', 'private, no-store');
  return res.download(resolvedPath, safeName);
});

module.exports = {
  createPrescription,
  getPatientPrescriptions,
  getDoctorPrescriptions,
  getPrescriptionById,
  downloadPrescription,
};
