const asyncHandler = require('express-async-handler');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const MedicalRecord = require('../models/MedicalRecord');
const { DEFAULT_CONSULTATION_FEE, normalizeConsultationFee } = require('../utils/consultationPricing');
const sendEmail = require('../utils/sendEmail');
const {
  buildPrescriptionEmailHtml,
  buildPrescriptionEmailSubject,
} = require('../utils/prescriptionEmailTemplate');

const UPLOAD_DIR = path.join(__dirname, '../private/medical_records');

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '';
    cb(null, `${req.user._id}-${Date.now()}${safeExt || '.bin'}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.originalname) {
      return cb(new Error('Invalid file'));
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_MIMES.has(mime)) {
      return cb(new Error('Only PDF, JPEG, PNG, and WebP files are allowed.'));
    }
    cb(null, true);
  },
}).single('document');

// Utility to create prescription file
const createPrescriptionFile = (appointmentId, prescription, notes) => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const fileName = `${appointmentId}-${Date.now()}.txt`;
  const filePath = path.join(UPLOAD_DIR, fileName);
  
  let content = '';
  if (notes) content += `Notes:\n${notes}\n\n`;
  
  if (prescription && prescription.length > 0) {
    content += `Prescription:\n`;
    prescription.forEach((item, idx) => {
      content += `\n${idx + 1}. ${item.medicine || 'N/A'}\n`;
      if (item.dosage) content += `   Dosage: ${item.dosage}\n`;
      if (item.duration) content += `   Duration: ${item.duration}\n`;
      if (item.instructions) content += `   Instructions: ${item.instructions}\n`;
    });
  }

  try {
    fs.writeFileSync(filePath, content);
    return fileName;
  } catch (err) {
    console.error('Failed to create prescription file:', err);
    return null;
  }
};

const emitAppointmentUpdate = async (req, appointment, reason, extra = {}) => {
  const io = req.app.get('io');
  if (!io || !appointment) return;

  let specialization = extra.specialization || '';
  if (!specialization && appointment.doctorId) {
    try {
      const doctor = await Doctor.findById(appointment.doctorId).select('specialization').lean();
      specialization = doctor?.specialization || '';
    } catch (err) {
      console.warn('Unable to load doctor specialization for appointment notification:', err.message);
    }
  }

  const payload = {
    reason,
    appointmentId: String(appointment._id),
    status: appointment.status,
    date: appointment.date,
    time: appointment.time,
    doctorName: appointment.doctorName,
    specialization,
    ...extra,
  };

  io.to(`user:${appointment.patientId}`).emit('appointments:updated', payload);
  io.to(`user:${appointment.doctorId}`).emit('appointments:updated', payload);
};

const toArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return String(value).trim();
};

const parseSlotDateTime = (date, time) => {
  const rawDate = normalizeDate(date);
  const rawTime = String(time || '').trim();
  const match = rawTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!rawDate || !match) return null;

  const [, hourText, minuteText, periodText] = match;
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  const hours24 = (hour % 12) + (periodText.toUpperCase() === 'PM' ? 12 : 0);
  const slot = new Date(`${rawDate}T00:00:00`);
  slot.setHours(hours24, minute, 0, 0);
  return slot;
};

const findUnavailableOverlap = (doctor, date, time) => {
  const slotStart = parseSlotDateTime(date, time);
  if (!slotStart) return null;

  const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
  return (doctor.unavailablePeriods || []).find((period) => {
    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) return false;
    return slotStart < periodEnd && slotEnd > periodStart;
  }) || null;
};

const formatUnavailablePeriod = (period) => {
  const format = (value) => new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return `${format(period.start)} to ${format(period.end)}`;
};

const PENDING_APPOINTMENT_HOLD_MS = 15 * 60 * 1000;

const isStalePendingAppointment = (appointment) => {
  if (appointment.paymentStatus !== 'pending' || !appointment.createdAt) return false;
  return Date.now() - new Date(appointment.createdAt).getTime() > PENDING_APPOINTMENT_HOLD_MS;
};

const enrichAppointments = async (appointments) => {
  const rows = appointments.map((appointment) =>
    typeof appointment.toObject === 'function' ? appointment.toObject() : appointment
  );

  const patientIds = [...new Set(rows.map((a) => String(a.patientId)).filter(Boolean))];
  const doctorIds = [...new Set(rows.map((a) => String(a.doctorId)).filter(Boolean))];

  const [patients, doctors] = await Promise.all([
    User.find({ _id: { $in: patientIds } }).select('name email phone gender blood dob allergies emergency image').lean(),
    Doctor.find({ _id: { $in: doctorIds } }).select('name email phone specialization fee image averageRating ratings isAvailable').lean(),
  ]);

  const patientsById = new Map(patients.map((patient) => [String(patient._id), patient]));
  const doctorsById = new Map(doctors.map((doctor) => [String(doctor._id), doctor]));

  return rows.map((appointment) => {
    const patient = patientsById.get(String(appointment.patientId));
    const doctor = doctorsById.get(String(appointment.doctorId));

    return {
      ...appointment,
      date: normalizeDate(appointment.date),
      patientName: patient?.name || appointment.patientName || 'Unknown Patient',
      patientEmail: patient?.email || '',
      patientPhone: patient?.phone || '',
      gender: patient?.gender || 'Unknown',
      bloodGroup: patient?.blood || 'N/A',
      dob: patient?.dob || '',
      allergies: toArray(patient?.allergies),
      emergencyContact: patient?.emergency || 'N/A',
      patientImage: patient?.image || '',
      doctorName: doctor?.name || appointment.doctorName || 'Unknown Doctor',
      doctorEmail: doctor?.email || '',
      doctorPhone: doctor?.phone || '',
      specialization: doctor?.specialization || '',
      consultationFee: normalizeConsultationFee(doctor?.fee, DEFAULT_CONSULTATION_FEE),
      doctorImage: doctor?.image || '',
      doctorRating: doctor?.averageRating || 0,
      doctorReviews: Array.isArray(doctor?.ratings) ? doctor.ratings.length : 0,
      doctorAvailable: Boolean(doctor?.isAvailable),
    };
  });
};

// @desc    Book a new appointment
// @route   POST /api/appointments/book
// @access  Private
const bookAppointment = asyncHandler(async (req, res) => {
  const { doctorId, date, time } = req.body;
  const normalizedDate = normalizeDate(date);

  // 1. THE ANTI-DOUBLE-BOOKING GUARDRAIL
  const existingSlots = await Appointment.find({
    doctorId: doctorId,
    date: normalizedDate,
    time: time,
    status: { $ne: 'cancelled' },
    paymentStatus: { $in: ['pending', 'paid'] }
  }).sort({ createdAt: -1 });

  if (existingSlots.length) {
    const paidSlot = existingSlots.find((slot) => slot.paymentStatus === 'paid');
    if (paidSlot) {
      res.status(400);
      throw new Error("This time slot is already booked by another patient.");
    }

    const activeOtherPendingSlot = existingSlots.find((slot) =>
      slot.paymentStatus === 'pending' &&
      String(slot.patientId) !== String(req.user._id) &&
      !isStalePendingAppointment(slot)
    );

    if (activeOtherPendingSlot) {
      res.status(400);
      throw new Error("This time slot is already booked by another patient.");
    }

    const ownPendingSlot = existingSlots.find((slot) =>
      slot.paymentStatus === 'pending' &&
      String(slot.patientId) === String(req.user._id)
    );

    if (ownPendingSlot) {
      const [enrichedAppointment] = await enrichAppointments([ownPendingSlot]);
      return res.status(200).json(enrichedAppointment);
    }

    const stalePendingIds = existingSlots
      .filter(isStalePendingAppointment)
      .map((slot) => slot._id);

    if (stalePendingIds.length) {
      await Appointment.deleteMany({ _id: { $in: stalePendingIds }, paymentStatus: 'pending' });
    }
  }

  // 2. FETCH THE DOCTOR DETAILS
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
      res.status(404);
      throw new Error("Doctor not found.");
  }

  const unavailablePeriod = findUnavailableOverlap(doctor, normalizedDate, time);
  if (unavailablePeriod) {
    const doctorLabel = /^Dr\.?\s+/i.test(doctor.name) ? doctor.name : `Dr. ${doctor.name}`;
    res.status(400);
    throw new Error(`${doctorLabel} is unavailable from ${formatUnavailablePeriod(unavailablePeriod)}. Please choose another date or time.`);
  }

  // 3. CREATE THE APPOINTMENT
  const appointment = await Appointment.create({
    patientId: req.user._id,
    patientName: req.user.name, 
    doctorId: doctorId,
    doctorName: doctor.name, 
    date: normalizedDate,
    time: time,
    status: 'scheduled',
    type: 'Video Consultation',
    paymentStatus: 'pending' 
  });

  await emitAppointmentUpdate(req, appointment, 'payment-pending');

  const [enrichedAppointment] = await enrichAppointments([appointment]);
  res.status(201).json(enrichedAppointment);
});

// @desc    Get logged-in patient's appointments
// @route   GET /api/appointments/patient
// @access  Private
const getPatientAppointments = asyncHandler(async (req, res) => {
    const appointments = await Appointment.find({ patientId: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json(await enrichAppointments(appointments));
});

// @desc    Get logged-in doctor's appointments
// @route   GET /api/appointments/doctor
// @access  Private
const getDoctorAppointments = asyncHandler(async (req, res) => {
    const appointments = await Appointment.find({ doctorId: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json(await enrichAppointments(appointments));
});

// @desc    Submit a rating for a consultation
// @route   POST /api/appointments/:id/rating
// @access  Private
const submitRating = asyncHandler(async (req, res) => {
  const { rating, review } = req.body;
  const appointmentId = req.params.id;

  // Validate rating
  if (!rating || rating < 1 || rating > 5) {
    res.status(400);
    throw new Error("Rating must be between 1 and 5.");
  }

  // Find appointment
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    res.status(404);
    throw new Error("Appointment not found.");
  }

  // Verify appointment belongs to logged-in patient
  if (appointment.patientId.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to rate this appointment.");
  }

  // Update appointment with rating
  appointment.rating = rating;
  appointment.review = review || '';
  await appointment.save();

  // Add rating to doctor's ratings array
  const doctor = await Doctor.findById(appointment.doctorId);
  if (doctor) {
    doctor.ratings.push({
      patientId: req.user._id,
      rating: rating,
      review: review || '',
      appointmentId: appointmentId
    });

    // Calculate new average rating
    const totalRating = doctor.ratings.reduce((sum, r) => sum + r.rating, 0);
    doctor.averageRating = (totalRating / doctor.ratings.length).toFixed(1);
    await doctor.save();
  }

  const io = req.app.get('io');
  if (io) {
    io.emit('doctors:updated', {
      reason: 'rating-updated',
      doctorId: String(appointment.doctorId)
    });
    io.to(`user:${appointment.patientId}`).emit('appointments:updated', {
      reason: 'rating-updated',
      appointmentId: String(appointment._id)
    });
    io.to(`user:${appointment.doctorId}`).emit('appointments:updated', {
      reason: 'rating-updated',
      appointmentId: String(appointment._id)
    });
  }

  res.json({ message: "Rating submitted successfully", appointment });
});

// @desc    Upload prescription file for a patient
// @route   POST /api/appointments/:id/upload-prescription
// @access  Private (doctor owning appointment)
const uploadPrescriptionFile = (req, res, next) => {
  upload(req, res, async (err) => {
    try {
      if (err) {
        return res.status(400).json({ message: err.message || 'Upload failed' });
      }

      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        if (req.file?.path) {
          try { fs.unlinkSync(req.file.path); } catch (_) {}
        }
        return res.status(400).json({ message: 'Invalid appointment id' });
      }

      const appointment = await Appointment.findById(id);
      if (!appointment) {
        if (req.file?.path) {
          try { fs.unlinkSync(req.file.path); } catch (_) {}
        }
        return res.status(404).json({ message: 'Appointment not found' });
      }

      if (String(appointment.doctorId) !== String(req.user._id)) {
        if (req.file?.path) {
          try { fs.unlinkSync(req.file.path); } catch (_) {}
        }
        return res.status(403).json({ message: 'Not authorized to update this appointment' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No file provided' });
      }

      const storedFileName = req.file.filename;
      const originalFileName = path.basename(req.file.originalname || '').slice(0, 255);
      const mimeType = req.file.mimetype || '';
      const fileSize = req.file.size || 0;

      const record = await MedicalRecord.create({
        patientId: appointment.patientId,
        name: `Prescription - ${appointment.date}`,
        doctor: appointment.doctorName,
        date: appointment.date,
        type: 'prescription',
        notes: `Prescription file uploaded during consultation`,
        storedFileName,
        originalFileName,
        mimeType,
        fileSize,
      });

      const [patient, doctor] = await Promise.all([
        User.findById(appointment.patientId).select('name email').lean(),
        Doctor.findById(appointment.doctorId).select('name specialization').lean(),
      ]);

      let emailStatus = 'not_sent';
      let emailError = '';

      if (patient?.email) {
        try {
          await sendEmail({
            email: patient.email,
            subject: buildPrescriptionEmailSubject({
              doctorName: doctor?.name || appointment.doctorName,
            }),
            html: buildPrescriptionEmailHtml({
              patientName: patient.name,
              doctorName: doctor?.name || appointment.doctorName,
              specialization: doctor?.specialization,
              appointmentDate: appointment.date,
              supportEmail: process.env.EMAIL_USER || 'medimeet.support@gmail.com',
              messageType: 'uploaded',
            }),
            attachments: [
              {
                filename: originalFileName || `prescription-${appointment.date || Date.now()}`,
                path: req.file.path,
                contentType: mimeType || 'application/octet-stream',
              },
            ],
          });
          emailStatus = 'sent';
        } catch (emailErr) {
          emailStatus = 'failed';
          emailError = emailErr.message || 'Email could not be sent';
          console.error('Prescription upload email failed:', emailErr);
        }
      } else {
        emailError = 'Patient registered email not found';
      }

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${record.patientId}`).emit('records:updated', {
          reason: 'prescription-file-uploaded',
          recordId: String(record._id),
          title: 'Prescription Available',
          doctor: record.doctor,
          date: record.date,
          type: record.type,
          fileUrl: `records/${record._id}/file`
        });
      }

      res.status(201).json({
        _id: record._id,
        name: record.name,
        doctor: record.doctor,
        date: record.date,
        type: record.type,
        fileUrl: `records/${record._id}/file`,
        emailStatus,
        emailMessage: emailStatus === 'sent'
          ? 'Prescription uploaded and emailed to patient.'
          : emailError,
      });
    } catch (e) {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
      }
      next(e);
    }
  });
};

// @desc    Save doctor's consultation notes and prescription
// @route   POST /api/appointments/:id/notes
// @access  Private (doctor owning appointment)
const saveAppointmentNotes = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) {
    res.status(404);
    throw new Error('Appointment not found');
  }

  if (String(appointment.doctorId) !== String(req.user._id)) {
    res.status(403);
    throw new Error('Not authorized to update this appointment');
  }

  const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';
  const prescription = Array.isArray(req.body.prescription)
    ? req.body.prescription.map((item) => ({
        medicine: String(item.medicine || '').trim(),
        dosage: String(item.dosage || '').trim(),
        duration: String(item.duration || '').trim(),
        instructions: String(item.instructions || '').trim()
      })).filter((item) => item.medicine || item.dosage || item.duration || item.instructions)
    : [];

  appointment.notes = notes.slice(0, 5000);
  appointment.prescription = prescription;
  await appointment.save();

  if (notes || prescription.length) {
    const prescriptionText = prescription.map((item) => {
      const details = [item.dosage, item.duration, item.instructions].filter(Boolean).join(' | ');
      return details ? `${item.medicine}: ${details}` : item.medicine;
    }).filter(Boolean).join('\n');

    // Create prescription file
    const storedFileName = createPrescriptionFile(appointment._id, prescription, notes);

    const record = await MedicalRecord.create({
      patientId: appointment.patientId,
      name: `Consultation notes - ${appointment.date}`,
      doctor: appointment.doctorName,
      date: appointment.date,
      type: 'prescription',
      notes: [notes, prescriptionText].filter(Boolean).join('\n\n').slice(0, 5000),
      storedFileName: storedFileName,
      originalFileName: `prescription-${appointment.date}.txt`,
      mimeType: 'text/plain',
      fileSize: storedFileName ? 1024 : 0
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${record.patientId}`).emit('records:updated', {
        reason: 'consultation-record-created',
        recordId: String(record._id),
        title: 'Prescription Available',
        doctor: record.doctor,
        date: record.date,
        type: record.type,
        fileUrl: storedFileName ? `records/${record._id}/file` : null
      });
    }
  }

  await emitAppointmentUpdate(req, appointment, 'notes-updated');
  const [enrichedAppointment] = await enrichAppointments([appointment]);
  res.json(enrichedAppointment);
});

// @desc    Update appointment status
// @route   PATCH /api/appointments/:id/status
// @access  Private (doctor owning appointment)
const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) {
    res.status(404);
    throw new Error('Appointment not found');
  }

  if (String(appointment.doctorId) !== String(req.user._id)) {
    res.status(403);
    throw new Error('Not authorized to update this appointment');
  }

  const allowed = new Set(['scheduled', 'confirmed', 'completed', 'cancelled']);
  const nextStatus = String(req.body.status || '').trim().toLowerCase();
  if (!allowed.has(nextStatus)) {
    res.status(400);
    throw new Error('Invalid appointment status');
  }

  appointment.status = nextStatus;
  await appointment.save();

  await emitAppointmentUpdate(req, appointment, 'status-updated');
  const [enrichedAppointment] = await enrichAppointments([appointment]);
  res.json(enrichedAppointment);
});

module.exports = {
  bookAppointment,
  getPatientAppointments,
  getDoctorAppointments,
  saveAppointmentNotes,
  updateAppointmentStatus,
  submitRating,
  uploadPrescriptionFile
};
