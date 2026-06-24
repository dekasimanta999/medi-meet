const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminOnly');
const asyncHandler = require('express-async-handler');

// Models & Utilities needed for Admin operations
const PendingDoctor = require('../models/PendingDoctors');
const Doctor = require('../models/Doctor');
const sendEmail = require('../utils/sendEmail');
const { DEFAULT_CONSULTATION_FEE, normalizeConsultationFee } = require('../utils/consultationPricing');

// Import your existing controller functions
const {
    getDoctors,
    getDoctorById,
    applyDoctor,
    updateAvailability,
    addUnavailablePeriod,
    removeUnavailablePeriod,
    getDoctorPatients
} = require('../controllers/doctorController');

const adminDoctorFields = '_id name email phone specialization licenseNumber experience qualifications fee image isAvailable averageRating status createdAt updatedAt';

const shapeDoctorForAdmin = (doctor) => {
    const shaped = typeof doctor.toObject === 'function' ? doctor.toObject() : { ...doctor };
    shaped.fee = normalizeConsultationFee(shaped.fee, DEFAULT_CONSULTATION_FEE);
    shaped.consultationFee = shaped.fee;
    return shaped;
};


// =========================================================================
// --- NEW ADMIN ROUTES (Must go ABOVE the /:id route) ---
// =========================================================================

// @route   GET /api/doctors/admin/pending
// @access  Private/Admin
router.get('/admin/pending', protect, adminOnly, asyncHandler(async (req, res) => {
    const pendingDocs = await PendingDoctor.find({}).sort({ createdAt: -1 });
    res.status(200).json(pendingDocs);
}));

// @route   GET /api/doctors/admin/approved
// @access  Private/Admin
router.get('/admin/approved', protect, adminOnly, asyncHandler(async (req, res) => {
    const doctors = await Doctor.find({ status: 'approved' })
        .select(adminDoctorFields)
        .sort({ name: 1 })
        .lean();

    res.status(200).json(doctors.map(shapeDoctorForAdmin));
}));

// @route   POST /api/doctors/admin/approve/:id
// @access  Private/Admin
router.post('/admin/approve/:id', protect, adminOnly, asyncHandler(async (req, res) => {
    const pendingDocId = req.params.id;
    const pendingDoc = await PendingDoctor.findById(pendingDocId);
    
    if (!pendingDoc) {
        res.status(404);
        throw new Error('Pending application not found');
    }

    // Move data to the official Doctor collection
  // Move data to the official Doctor collection
    const doctorData = pendingDoc.toObject();
    delete doctorData._id; 
    delete doctorData.status; 
    delete doctorData.__v;
    doctorData.fee = normalizeConsultationFee(req.body.fee, normalizeConsultationFee(doctorData.fee, DEFAULT_CONSULTATION_FEE));

    // FIX: Use updateOne to safely transfer the doctor WITHOUT double-hashing the password
    await Doctor.updateOne(
        { email: doctorData.email }, 
        { $set: { ...doctorData, status: 'approved' } }, 
        { upsert: true }
    );

    const newOfficialDoctor = await Doctor.findOne({ email: doctorData.email });
    await PendingDoctor.findByIdAndDelete(pendingDocId);

    const io = req.app.get('io');
    if (io && newOfficialDoctor) {
        io.emit('doctors:updated', {
            reason: 'doctor-approved',
            doctorId: String(newOfficialDoctor._id),
            fee: normalizeConsultationFee(newOfficialDoctor.fee, DEFAULT_CONSULTATION_FEE)
        });
        io.emit('admin:doctor-applications-updated', {
            reason: 'doctor-approved',
            pendingDoctorId: String(pendingDocId),
            doctorId: String(newOfficialDoctor._id)
        });
        io.emit('admin:approved-doctors-updated', {
            reason: 'doctor-approved',
            doctorId: String(newOfficialDoctor._id)
        });
    }

    // Send Welcome Email natively from the route
    const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><title>Welcome to MediMeet</title></head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; max-width: 600px; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
                        <tr>
                            <td style="background: linear-gradient(135deg, #1e293b 0%, #0aa87e 100%); padding: 30px 40px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to MediMeet!</h1>
                                <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Account Verified</p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 40px;">
                                <h2 style="color: #1a2e2b; margin: 0 0 20px 0; font-size: 22px;">Congratulations! 🎉</h2>
                                <p style="color: #4a6560; font-size: 16px; line-height: 1.6;">
                                    Hello Dr. <strong style="color: #1a2e2b;">${newOfficialDoctor.name}</strong>,<br><br>
                                    Our administration team has successfully verified your credentials. We are thrilled to inform you that your profile is now <strong>fully approved and live</strong> on the MediMeet platform.
                                </p>
                                <div style="text-align: center; margin: 35px 0;">
                                    <a href="http://localhost:5173/" style="background-color: #0aa87e; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 16px; display: inline-block;">
                                        Access Your Dashboard
                                    </a>
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    try {
        await sendEmail({
            email: newOfficialDoctor.email,
            subject: 'Welcome to MediMeet! Your Doctor Account is Approved 🎉',
            message: `Hello Dr. ${newOfficialDoctor.name}, your account has been approved. You can now log in.`,
            html: emailHtml
        });
    } catch (error) {
        console.error("Welcome email failed to send:", error);
    }

    res.status(200).json({ message: "Doctor successfully verified and activated." });
}));

// @route   PATCH /api/doctors/admin/approved/:id/fee
// @access  Private/Admin
router.patch('/admin/approved/:id/fee', protect, adminOnly, asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        throw new Error('Invalid doctor id');
    }

    const fee = normalizeConsultationFee(req.body.fee, 0);
    if (!fee) {
        res.status(400);
        throw new Error('Please provide a valid consultation fee.');
    }

    const doctor = await Doctor.findOneAndUpdate(
        { _id: req.params.id, status: 'approved' },
        { $set: { fee } },
        { new: true, runValidators: true }
    ).select(adminDoctorFields);

    if (!doctor) {
        res.status(404);
        throw new Error('Approved doctor not found');
    }

    const io = req.app.get('io');
    if (io) {
        io.emit('doctors:updated', {
            reason: 'fee-updated',
            doctorId: String(doctor._id),
            fee
        });
        io.emit('admin:approved-doctors-updated', {
            reason: 'fee-updated',
            doctorId: String(doctor._id),
            fee
        });
    }

    res.status(200).json(shapeDoctorForAdmin(doctor));
}));

// @route   DELETE /api/doctors/admin/reject/:id
// @access  Private/Admin
router.delete('/admin/reject/:id', protect, adminOnly, asyncHandler(async (req, res) => {
    const deletedDoc = await PendingDoctor.findByIdAndDelete(req.params.id);
    if (!deletedDoc) {
        res.status(404);
        throw new Error('Pending application not found');
    }
    const io = req.app.get('io');
    if (io) {
        io.emit('admin:doctor-applications-updated', {
            reason: 'application-rejected',
            pendingDoctorId: String(req.params.id)
        });
    }
    res.status(200).json({ message: "Application rejected and securely removed." });
}));


// =========================================================================
// --- PUBLIC & DOCTOR ROUTES ---
// =========================================================================

// @route   GET /api/doctors
router.get('/', getDoctors);

// @route   POST /api/doctors/apply
router.post('/apply', applyDoctor);

// @route   PATCH /api/doctors/availability
router.patch('/availability', protect, updateAvailability);

// @route   POST /api/doctors/unavailable-periods
router.post('/unavailable-periods', protect, addUnavailablePeriod);

// @route   DELETE /api/doctors/unavailable-periods/:periodId
router.delete('/unavailable-periods/:periodId', protect, removeUnavailablePeriod);

// @route   GET /api/doctors/patients
router.get('/patients', protect, getDoctorPatients);


// =========================================================================
// --- ID ROUTE (MUST be placed absolutely last!) ---
// =========================================================================

// @route   GET /api/doctors/:id
router.get('/:id', getDoctorById);

module.exports = router;
