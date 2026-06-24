const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { doctorOnly } = require('../middleware/doctorOnly');
const {
  getAllMedicalRecords,
  getMedicalRecordById,
  getMedicalRecordFile,
  getMedicalRecordsStats
} = require('../controllers/doctorRecordsController');

// Apply authentication and doctor-only middleware
router.use(protect);
router.use(doctorOnly);

// @route   GET /api/doctor-records - Get all medical records with filtering
router.get('/', getAllMedicalRecords);

// @route   GET /api/doctor-records/stats - Get medical records statistics
router.get('/stats', getMedicalRecordsStats);

// @route   GET /api/doctor-records/:id - Get specific medical record
router.get('/:id', getMedicalRecordById);

// @route   GET /api/doctor-records/:id/file - Download medical record file
router.get('/:id/file', getMedicalRecordFile);

module.exports = router;
