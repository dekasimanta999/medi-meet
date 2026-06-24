const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { doctorOnly } = require('../middleware/doctorOnly');
const { patientOnly } = require('../middleware/patientOnly');
const {
  createPrescription,
  getPatientPrescriptions,
  getDoctorPrescriptions,
  getPrescriptionById,
  downloadPrescription,
} = require('../controllers/prescriptionController');

router.use(protect);

router.post('/', doctorOnly, createPrescription);
router.get('/patient', patientOnly, getPatientPrescriptions);
router.get('/doctor', doctorOnly, getDoctorPrescriptions);
router.get('/:id', getPrescriptionById);
router.get('/:id/download', downloadPrescription);

module.exports = router;
