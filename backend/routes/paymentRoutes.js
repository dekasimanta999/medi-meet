const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  createOrder, 
  verifyPayment, 
  cancelPendingPayment 
} = require('../controllers/paymentController');

/**
 * @route   POST /api/payments/create-order
 * @desc    Create a Razorpay payment order for appointment
 * @access  Private
 * @body    { appointmentId, doctorId?, amount? }
 * @returns { orderId, amount, currency, keyId, appointmentId }
 */
router.post('/create-order', protect, createOrder);

/**
 * @route   POST /api/payments/verify
 * @desc    Verify Razorpay payment and confirm appointment
 * @access  Private
 * @body    { razorpay_order_id, razorpay_payment_id, razorpay_signature, appointmentId }
 * @returns { message, appointmentId, paymentId }
 */
router.post('/verify', protect, verifyPayment);

/**
 * @route   POST /api/payments/cancel
 * @desc    Cancel pending appointment payment
 * @access  Private
 * @body    { appointmentId }
 * @returns { message, appointmentId }
 */
router.post('/cancel', protect, cancelPendingPayment);

module.exports = router;