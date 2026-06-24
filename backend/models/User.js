const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  image: { type: String, default: '/images/default-avatar.png' },
  // Profile Fields
  phone: { type: String, default: '' },
  dob: { type: String, default: '' },
  gender: { type: String, default: 'Male' },
  age: { type: Number, min: 0, max: 120, default: null },
  blood: { type: String, default: 'B+' },
  allergies: { type: String, default: 'None' },
  emergency: { type: String, default: '' },
  
  // --- NEW 2FA OTP FIELDS ---
  isTwoFactorEnabled: { type: Boolean, default: false },
  loginOtp: { type: String },
  loginOtpExpire: { type: Date },
  
  // Password Reset OTP
  resetPasswordOtp: { type: String },
  resetPasswordOtpExpire: { type: Date },
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return; 
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
