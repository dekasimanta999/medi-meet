const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const pendingDoctorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    specialization: { type: String, required: true },
    experience: { type: Number, required: true },
    licenseNumber: { type: String, required: true },
    qualifications: [{ type: String, trim: true, maxlength: 120 }],
    
    // --- ADDED: Store the image path ---
    image: { type: String, required: true },
    
    fee: { type: Number, default: 500 },
    status: { type: String, default: 'pending' }
}, { 
    timestamps: true,
    collection: 'pendingDoctors' 
});

pendingDoctorSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('PendingDoctor', pendingDoctorSchema);
