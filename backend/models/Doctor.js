const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const doctorSchema = mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  specialization: { type: String, required: true }, 
  experience: { type: Number, required: true },
  licenseNumber: { type: String, required: true },
  qualifications: [{ type: String, trim: true, maxlength: 120 }],
  
  // --- Login OTP Fields ---
  loginOtp: { type: String },
  loginOtpExpire: { type: Date },

  // --- Password Reset OTP Fields ---
  resetPasswordOtp: { type: String },
  resetPasswordOtpExpire: { type: Date },
  
  // --- Admin Control ---
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },

  // --- Profile Display ---
  image: { type: String, default: '/images/doctors/default-doc.jpg' }, 
  fee: { type: Number, default: 500 }, 
  isAvailable: { type: Boolean, default: false }, 
  isTwoFactorEnabled: { type: Boolean, default: false },
  unavailablePeriods: [{
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    reason: { type: String, default: '', trim: true, maxlength: 200 },
    createdAt: { type: Date, default: Date.now }
  }],

  // --- Ratings System ---
  ratings: [{
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5, required: true },
    review: { type: String, default: '' },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    createdAt: { type: Date, default: Date.now }
  }],
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
}, { timestamps: true });

// Hash password before saving (Only triggers if password is changed/new)
// FIXED: Removed 'next' because this is an async function
doctorSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
doctorSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Doctor', doctorSchema);
