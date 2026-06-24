const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { patientOnly } = require('../middleware/patientOnly');
const { doctorOnly } = require('../middleware/doctorOnly'); // Imported your doctor middleware

const {
  getRecords,
  createRecord,
  getRecordFile,
  deleteRecord,
  uploadAndEmailPrescription, // Imported the new controller function
} = require('../controllers/recordController');

// 1. Require authentication for ALL routes in this file
router.use(protect);

// ==========================================
// DOCTOR ROUTES
// ==========================================
// Only verified doctors can hit this route to upload/email prescriptions
router.post('/send-prescription', doctorOnly, uploadAndEmailPrescription);

// ==========================================
// PATIENT ROUTES
// ==========================================
// We apply patientOnly specifically to these routes so they don't block the doctor route above
router.get('/', patientOnly, getRecords);
router.post('/', patientOnly, createRecord);
router.get('/:id/file', patientOnly, getRecordFile);
router.delete('/:id', patientOnly, deleteRecord);

module.exports = router;