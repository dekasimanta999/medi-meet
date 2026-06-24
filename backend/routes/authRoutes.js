const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware'); 
const { 
  registerUser, 
  loginUser, 
  verifyPatientOtp, // <-- ADDED THIS IMPORT
  forgotPassword, 
  resetPassword, 
  applyDoctor, 
  loginDoctor, 
  verifyDoctorOtp,
  requestDoctorPasswordResetOtp,
  verifyDoctorPasswordResetOtp,
  resetDoctorPassword,
  getDoctorProfile, 
  updateDoctorPhoto, 
  removeDoctorPhoto,
  getUserProfile, 
  updateUserPhoto, 
  removeUserPhoto,
  updateProfile,
  toggleTwoFactor,
  changePassword
} = require('../controllers/authController');

// --- Patient & General Auth ---
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/login/verify-otp', verifyPatientOtp); // <-- ADDED THIS ROUTE
router.post('/forgotpassword', forgotPassword);
router.post('/resetpassword', resetPassword);

// --- Secure Patient Profile ---
router.get('/me', protect, getUserProfile);
router.get('/user/profile', protect, getUserProfile); 
router.put('/user/profile', protect, updateProfile); 
router.patch('/user/profile', protect, updateProfile);
router.put('/user/update-photo', protect, updateUserPhoto); 
router.delete('/user/remove-photo', protect, removeUserPhoto); 
router.post('/2fa/toggle', protect, toggleTwoFactor);

// --- Doctor Auth ---
router.post('/doctor/apply', applyDoctor);
router.post('/doctor/login', loginDoctor);
router.post('/doctor/verify-otp', verifyDoctorOtp);
router.post('/doctor/forgot-password', requestDoctorPasswordResetOtp);
router.post('/doctor/verify-reset-otp', verifyDoctorPasswordResetOtp);
router.post('/doctor/reset-password', resetDoctorPassword);

// --- Secure Doctor Profile ---
router.get('/doctor/profile', protect, getDoctorProfile); 
router.put('/doctor/profile', protect, updateProfile);
router.patch('/doctor/profile', protect, updateProfile);
router.post('/doctor/changepassword', protect, changePassword);
router.put('/doctor/update-photo', protect, updateDoctorPhoto); 
router.delete('/doctor/remove-photo', protect, removeDoctorPhoto); 

module.exports = router;
