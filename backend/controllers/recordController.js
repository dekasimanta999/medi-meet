const asyncHandler = require('express-async-handler');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const MedicalRecord = require('../models/MedicalRecord');
const sendEmail = require('../utils/sendEmail'); // Added email utility
const {
  buildPrescriptionEmailHtml,
  buildPrescriptionEmailSubject,
} = require('../utils/prescriptionEmailTemplate');

/** Not under /uploads static — PHI must only be served via authenticated GET /api/records/:id/file */
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

// @desc   List current patient's medical records
// @route  GET /api/records
// @access Private (patient)
const getRecords = asyncHandler(async (req, res) => {
  const list = await MedicalRecord.find({ patientId: req.user._id })
    .sort({ createdAt: -1 })
    .lean();

  const shaped = list.map((r) => ({
    _id: r._id,
    prescriptionId: r.prescriptionId || null,
    name: r.name,
    doctor: r.doctor,
    specialization: r.specialization || '',
    date: r.date,
    type: r.type,
    notes: r.notes,
    fileUrl: r.storedFileName ? `records/${r._id}/file` : null,
    originalFileName: r.originalFileName || '',
    createdAt: r.createdAt,
  }));
  res.json(shaped);
});

// @desc   Create medical record (optional document)
// @route  POST /api/records
// @access Private (patient)
const createRecord = (req, res, next) => {
  upload(req, res, async (err) => {
    try {
      if (err) {
        return res.status(400).json({ message: err.message || 'Upload failed' });
      }

      const name = (req.body.name || '').trim();
      const doctor = (req.body.doctor || '').trim();
      const date = (req.body.date || '').trim();
      const type = (req.body.type || '').trim();
      const notes = (req.body.notes || '').trim();

      const cleanupFile = () => {
        if (req.file?.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (_) {}
        }
      };

      if (!name || !doctor || !date) {
        cleanupFile();
        return res.status(400).json({ message: 'Name, doctor, and date are required.' });
      }
      if (!['lab', 'diagnostic', 'prescription'].includes(type)) {
        cleanupFile();
        return res.status(400).json({ message: 'Invalid record type.' });
      }

      let storedFileName = null;
      let originalFileName = '';
      let mimeType = '';
      let fileSize = 0;

      if (req.file) {
        storedFileName = req.file.filename;
        originalFileName = path.basename(req.file.originalname || '').slice(0, 255);
        mimeType = req.file.mimetype || '';
        fileSize = req.file.size || 0;
      }

      const record = await MedicalRecord.create({
        patientId: req.user._id,
        name: name.slice(0, 200),
        doctor: doctor.slice(0, 200),
        date: date.slice(0, 64),
        type,
        notes: notes.slice(0, 5000),
        storedFileName,
        originalFileName,
        mimeType,
        fileSize,
      });

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${record.patientId}`).emit('records:updated', {
          reason: 'record-created',
          recordId: String(record._id)
        });
      }

      res.status(201).json({
        _id: record._id,
        name: record.name,
        doctor: record.doctor,
        date: record.date,
        type: record.type,
        notes: record.notes,
        fileUrl: storedFileName ? `records/${record._id}/file` : null,
      });
    } catch (e) {
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {}
      }
      next(e);
    }
  });
};

// @desc   Upload prescription and email to patient
// @route  POST /api/records/send-prescription
// @access Private (Doctor)
const uploadAndEmailPrescription = (req, res, next) => {
  upload(req, res, async (err) => {
    try {
      if (err) {
        return res.status(400).json({ message: err.message || 'Upload failed' });
      }

      const patientEmail = req.body.patientEmail;
      const file = req.file;

      if (!file || !patientEmail) {
        // Cleanup file if validation fails
        if (req.file?.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (_) {}
        }
        return res.status(400).json({ message: 'Patient email and document are required.' });
      }

      // Read the newly saved file from the disk into a buffer for Resend
      const fileBuffer = fs.readFileSync(file.path);

      // Send the email with the file attachment
      await sendEmail({
        email: patientEmail,
        subject: buildPrescriptionEmailSubject({
          doctorName: req.user?.name,
        }),
        html: buildPrescriptionEmailHtml({
          patientName: req.body.patientName,
          doctorName: req.user?.name,
          specialization: req.user?.specialization,
          appointmentDate: req.body.appointmentDate || req.body.date,
          supportEmail: process.env.EMAIL_USER || 'medimeet.support@gmail.com',
          messageType: 'uploaded',
        }),
        attachments: [
          {
            filename: file.originalname || 'MediMeet_Prescription.pdf',
            content: fileBuffer, 
          },
        ],
      });

      return res.status(200).json({ 
        success: true, 
        message: 'Prescription successfully saved and emailed to patient!' 
      });

    } catch (error) {
      console.error('Prescription upload/email error:', error);
      // Clean up the file if the email fails to send
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {}
      }
      return res.status(500).json({ message: 'Failed to process and send prescription.' });
    }
  });
};

// @desc   Stream attached file (owner only)
// @route  GET /api/records/:id/file
// @access Private (patient)
const getRecordFile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid record id' });
  }

  const record = await MedicalRecord.findOne({
    _id: id,
    patientId: req.user._id,
  }).lean();

  if (!record || !record.storedFileName) {
    return res.status(404).json({ message: 'File not found' });
  }

  const absPath = path.resolve(UPLOAD_DIR, record.storedFileName);
  const uploadRoot = path.resolve(UPLOAD_DIR);
  if (!absPath.startsWith(uploadRoot + path.sep) || !fs.existsSync(absPath)) {
    return res.status(404).json({ message: 'File not found on server' });
  }

  const download = req.query.download === '1' || req.query.download === 'true';
  const safeName = (record.originalFileName || 'document').replace(/[^\w.\- ()]+/g, '_').slice(0, 120);
  res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename="${safeName}"`
  );
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(absPath);
});

// @desc   Delete record and optional file
// @route  DELETE /api/records/:id
// @access Private (patient)
const deleteRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid record id' });
  }

  const record = await MedicalRecord.findOne({
    _id: id,
    patientId: req.user._id,
  });

  if (!record) {
    return res.status(404).json({ message: 'Record not found' });
  }

  if (record.storedFileName) {
    const absPath = path.resolve(UPLOAD_DIR, record.storedFileName);
    const uploadRoot = path.resolve(UPLOAD_DIR);
    if (absPath.startsWith(uploadRoot + path.sep)) {
      try {
        fs.unlinkSync(absPath);
      } catch (_) {}
    }
  }

  await record.deleteOne();
  const io = req.app.get('io');
  if (io) {
    io.to(`user:${record.patientId}`).emit('records:updated', {
      reason: 'record-deleted',
      recordId: String(record._id)
    });
  }
  res.json({ message: 'Record removed' });
});

module.exports = {
  getRecords,
  createRecord,
  uploadAndEmailPrescription, // Exported new function
  getRecordFile,
  deleteRecord,
};
