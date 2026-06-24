const mongoose = require('mongoose');

const prescriptionItemSchema = new mongoose.Schema(
  {
    medicine: { type: String, default: '', trim: true },
    dosage: { type: String, default: '', trim: true },
    duration: { type: String, default: '', trim: true },
    instructions: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    patientName: { type: String, required: true, trim: true },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    doctorName: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    type: { type: String, default: 'Video Consultation', trim: true },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentIntentId: { type: String, default: '', trim: true },
    paymentId: { type: String, default: '', trim: true },
    paidAt: { type: Date },
    notes: { type: String, default: '', trim: true, maxlength: 5000 },
    prescription: { type: [prescriptionItemSchema], default: [] },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

appointmentSchema.index({ doctorId: 1, date: 1, time: 1 });
appointmentSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
