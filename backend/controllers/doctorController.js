const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { DEFAULT_CONSULTATION_FEE, normalizeConsultationFee } = require('../utils/consultationPricing');
const { normaliseQualifications } = require('../utils/doctorQualifications');

const applyStoredFee = (doctor) => {
  const shaped = typeof doctor.toObject === 'function' ? doctor.toObject() : { ...doctor };
  shaped.fee = normalizeConsultationFee(shaped.fee, DEFAULT_CONSULTATION_FEE);
  shaped.consultationFee = shaped.fee;
  return shaped;
};

const getDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({ status: 'approved' }).select('-password -loginOtp -loginOtpExpire -resetPasswordOtp -resetPasswordOtpExpire').lean();
    res.json(doctors.map(applyStoredFee));
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const getDoctorById = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (doctor) {
      const safeDoctor = doctor.toObject();
      delete safeDoctor.password;
      delete safeDoctor.loginOtp;
      delete safeDoctor.loginOtpExpire;
      safeDoctor.fee = normalizeConsultationFee(safeDoctor.fee, DEFAULT_CONSULTATION_FEE);
      safeDoctor.consultationFee = safeDoctor.fee;
      res.json(safeDoctor);
    } else {
      res.status(404).json({ message: 'Doctor not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const applyDoctor = async (req, res) => {
    try {
        const qualifications = normaliseQualifications(req.body.qualifications);
        if (qualifications.length === 0) {
            return res.status(400).json({ success: false, message: "At least one qualification is required." });
        }

        const newApplication = new Doctor({
            ...req.body,
            qualifications,
            fee: normalizeConsultationFee(req.body.fee, DEFAULT_CONSULTATION_FEE),
            status: 'pending'
        });
        
        await newApplication.save();
        
        res.status(201).json({ 
            success: true, 
            message: "Application submitted successfully and is pending approval." 
        });
    } catch (error) {
        console.error("Error submitting doctor application:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

const updateAvailability = async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.user._id);
        if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

        doctor.isAvailable = Boolean(req.body.isAvailable);
        await doctor.save();

        const io = req.app.get('io');
        if (io) {
            io.emit('doctors:updated', { reason: 'availability-updated', doctorId: String(doctor._id) });
        }
        res.json({ _id: doctor._id, isAvailable: doctor.isAvailable });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

const addUnavailablePeriod = async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.user._id);
        if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

        const start = new Date(req.body.start);
        const end = new Date(req.body.end);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            return res.status(400).json({ message: 'Please provide a valid unavailable start and end time.' });
        }

        doctor.unavailablePeriods = (doctor.unavailablePeriods || []).filter((period) => {
            const periodEnd = new Date(period.end);
            return !Number.isNaN(periodEnd.getTime()) && periodEnd > new Date();
        });
        doctor.unavailablePeriods.push({
            start,
            end,
            reason: String(req.body.reason || '').trim().slice(0, 200)
        });
        await doctor.save();

        const io = req.app.get('io');
        if (io) {
            io.emit('doctors:updated', { reason: 'unavailable-period-added', doctorId: String(doctor._id) });
        }

        res.status(201).json({ unavailablePeriods: doctor.unavailablePeriods });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

const removeUnavailablePeriod = async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.user._id);
        if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

        doctor.unavailablePeriods = (doctor.unavailablePeriods || []).filter(
            (period) => String(period._id) !== String(req.params.periodId)
        );
        await doctor.save();

        const io = req.app.get('io');
        if (io) {
            io.emit('doctors:updated', { reason: 'unavailable-period-removed', doctorId: String(doctor._id) });
        }

        res.json({ unavailablePeriods: doctor.unavailablePeriods });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

const getDoctorPatients = async (req, res) => {
    try {
        const appointments = await Appointment.find({
            doctorId: req.user._id,
            $or: [{ paymentStatus: 'paid' }, { status: { $in: ['confirmed', 'completed'] } }]
        }).lean();

        const patientIds = [...new Set(appointments.map((a) => String(a.patientId)))];
        const users = await User.find({ _id: { $in: patientIds } }).select('name gender blood dob allergies emergency image').lean();

        const byId = new Map(users.map((u) => [String(u._id), u]));
        const toArray = (value) => {
            if (Array.isArray(value)) return value.filter(Boolean);
            if (typeof value === 'string') {
                return value.split(',').map((item) => item.trim()).filter(Boolean);
            }
            return [];
        };

        const patients = patientIds.map((id) => {
            const patient = byId.get(id);
            const fallbackAppointment = appointments.find((a) => String(a.patientId) === id);
            return {
                id,
                name: patient?.name || fallbackAppointment?.patientName || 'Unknown Patient',
                gender: patient?.gender || 'Unknown',
                bloodGroup: patient?.blood || 'N/A',
                dob: patient?.dob || 'Unknown',
                allergies: toArray(patient?.allergies),
                emergencyContact: patient?.emergency || 'N/A',
                image: patient?.image || ''
            };
        });

        res.json(patients);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// ALL 5 perfectly exported so your routes can read them!
module.exports = { 
    getDoctors, 
    getDoctorById, 
    applyDoctor,
    updateAvailability,
    addUnavailablePeriod,
    removeUnavailablePeriod,
    getDoctorPatients
};
