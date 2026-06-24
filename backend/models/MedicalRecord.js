const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    doctor: { type: String, required: true, trim: true, maxlength: 200 },
    specialization: { type: String, default: '', trim: true, maxlength: 200 },
    date: { type: String, required: true, trim: true, maxlength: 64 },
    type: {
      type: String,
      required: true,
      enum: ['lab', 'diagnostic', 'prescription'],
    },
    notes: { type: String, default: '', trim: true, maxlength: 5000 },
    /** Stored filename only (under uploads/medical_records/), never exposed for direct static access */
    storedFileName: { type: String, default: null },
    originalFileName: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
  },
  { timestamps: true }
);

medicalRecordSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
