const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { analyzeSymptoms } = require('../controllers/AiController');

// This creates the /analyze part of the URL
router.post('/analyze', protect, analyzeSymptoms);

module.exports = router;