const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  bookAppointment,
  getPatientAppointments,
  getDoctorAppointments,
  saveAppointmentNotes,
  updateAppointmentStatus,
  submitRating,
  uploadPrescriptionFile
} = require('../controllers/appointmentController');

router.post('/book', protect, bookAppointment);
router.get('/patient', protect, getPatientAppointments);
router.get('/doctor', protect, getDoctorAppointments);
router.post('/:id/notes', protect, saveAppointmentNotes);
router.post('/:id/upload-prescription', protect, uploadPrescriptionFile);
router.patch('/:id/status', protect, updateAppointmentStatus);
router.post('/:id/rating', protect, submitRating);

module.exports = router;
