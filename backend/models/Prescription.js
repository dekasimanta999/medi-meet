const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
  {
    medicineName: { type: String, required: true, trim: true, maxlength: 200 },
    dosage: { type: String, default: '', trim: true, maxlength: 120 },
    frequency: { type: String, default: '', trim: true, maxlength: 120 },
    duration: { type: String, default: '', trim: true, maxlength: 120 },
    timing: { type: String, default: '', trim: true, maxlength: 120 },
    instructions: { type: String, default: '', trim: true, maxlength: 500 },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    prescriptionNumber: { type: String, required: true, unique: true, index: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    medicalRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord' },

    patientEmail: { type: String, default: '', trim: true, lowercase: true },
    patientNameSnapshot: { type: String, required: true, trim: true },
    doctorNameSnapshot: { type: String, required: true, trim: true },
    specializationSnapshot: { type: String, default: '', trim: true },
    doctorEmailSnapshot: { type: String, default: '', trim: true, lowercase: true },

    consultationType: { type: String, default: 'Online Doctor Consultation', trim: true },
    visitType: { type: String, default: 'New visit', trim: true },
    status: { type: String, default: 'finalized', trim: true },

    clinicalData: {
      chiefComplaints: { type: String, default: '', trim: true, maxlength: 3000 },
      duration: { type: String, default: '', trim: true, maxlength: 500 },
      historyOfPresentIllness: { type: String, default: '', trim: true, maxlength: 5000 },
      vitals: { type: mongoose.Schema.Types.Mixed, default: {} },
      diagnosis: { type: String, required: true, trim: true, maxlength: 3000 },
      pastMedicalHistory: { type: String, default: '', trim: true, maxlength: 3000 },
      familyHistory: { type: String, default: '', trim: true, maxlength: 3000 },
      socialHistory: { type: String, default: '', trim: true, maxlength: 3000 },
      allergies: { type: String, default: '', trim: true, maxlength: 3000 },
      investigationOrders: { type: String, default: '', trim: true, maxlength: 3000 },
      procedureHistory: { type: String, default: '', trim: true, maxlength: 3000 },
      advice: { type: String, default: '', trim: true, maxlength: 5000 },
      followUpDate: { type: String, default: '', trim: true, maxlength: 64 },
      emergencyInstructions: { type: String, default: '', trim: true, maxlength: 3000 },
      notes: { type: String, default: '', trim: true, maxlength: 5000 },
    },
    medicines: { type: [medicineSchema], default: [] },

    pdfFileName: { type: String, required: true, trim: true },
    pdfPath: { type: String, required: true, trim: true },
    pdfMimeType: { type: String, default: 'application/pdf' },
    pdfSize: { type: Number, default: 0 },

    emailStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    emailSentAt: { type: Date },
    emailError: { type: String, default: '', trim: true, maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    finalizedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

prescriptionSchema.index({ patient: 1, createdAt: -1 });
prescriptionSchema.index({ doctor: 1, createdAt: -1 });

module.exports = mongoose.model('Prescription', prescriptionSchema);
