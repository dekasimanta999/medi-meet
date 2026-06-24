const asyncHandler = require('express-async-handler');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const { DEFAULT_CONSULTATION_FEE, normalizeConsultationFee } = require('../utils/consultationPricing');

// Initialize Razorpay instance
let razorpayInstance = null;

const createRazorpayReceipt = (appointmentId) => {
  const shortId = String(appointmentId).slice(-12);
  const timestamp = Date.now().toString(36);
  return `rcpt_${shortId}_${timestamp}`;
};

const initializeRazorpay = () => {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error("❌ ERROR: Razorpay keys are missing from your .env file!");
    console.error("Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env");
    return null;
  }
  
  return new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
};

// @route   POST /api/payments/create-order
// @desc    Create a Razorpay payment order
// @access  Private
const createOrder = asyncHandler(async (req, res) => {
  try {
    console.log("📝 Creating payment order...");
    
    // Initialize Razorpay
    const razorpay = initializeRazorpay();
    if (!razorpay) {
      return res.status(500).json({ 
        message: "Payment gateway not configured. Please contact support.",
        error: "Razorpay keys missing"
      });
    }
    
    const { appointmentId } = req.body;

    // Validate input
    if (!appointmentId) {
      console.warn("⚠️ No appointmentId provided");
      return res.status(400).json({ 
        message: "Appointment ID is required",
        error: "Missing appointmentId"
      });
    }

    // 1. Find and validate Appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      console.warn(`⚠️ Appointment not found: ${appointmentId}`);
      return res.status(404).json({ 
        message: 'Appointment not found',
        error: "Appointment_not_found"
      });
    }

    // Check authorization
    if (String(appointment.patientId) !== String(req.user._id)) {
      console.warn(`⚠️ Unauthorized payment attempt for appointment: ${appointmentId}`);
      return res.status(403).json({ 
        message: 'Not authorized to pay for this appointment',
        error: "Unauthorized"
      });
    }

    // Check if already paid
    if (appointment.paymentStatus === 'paid') {
      console.warn(`⚠️ Appointment already paid: ${appointmentId}`);
      return res.status(400).json({ 
        message: 'This appointment has already been paid',
        error: "Already_paid"
      });
    }

    // 2. Use the admin-approved consultation fee saved on the doctor profile.
    let consultationFee = DEFAULT_CONSULTATION_FEE;
    try {
      const doctor = await Doctor.findById(appointment.doctorId).select('fee').lean();
      if (doctor) {
        consultationFee = normalizeConsultationFee(doctor.fee, DEFAULT_CONSULTATION_FEE);
      }
    } catch (err) {
      console.warn("Unable to load doctor consultation fee, using default:", err.message);
    }

    // 3. Create Razorpay Order
    const amountInPaise = Math.round(consultationFee * 100);
    if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
      return res.status(400).json({
        message: "Invalid consultation fee",
        error: "Invalid_amount"
      });
    }

    if (appointment.paymentStatus === 'pending' && appointment.paymentIntentId) {
      console.log(`Reusing existing Razorpay order: ${appointment.paymentIntentId}`);
      return res.status(200).json({
        success: true,
        orderId: appointment.paymentIntentId,
        amount: amountInPaise,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID,
        appointmentId: appointment._id
      });
    }

    const orderOptions = {
      amount: amountInPaise, // Convert to paise (₹1 = 100 paise)
      currency: "INR",
      receipt: createRazorpayReceipt(appointment._id),
      notes: {
        appointmentId: String(appointment._id),
        doctorId: String(appointment.doctorId),
        patientId: String(appointment.patientId)
      }
    };

    console.log("📤 Sending order request to Razorpay...");
    const order = await razorpay.orders.create(orderOptions);
    console.log(`✅ Razorpay order created: ${order.id}`);

    // 4. Save order ID to appointment
    appointment.paymentIntentId = order.id;
    appointment.paymentStatus = 'pending';
    await appointment.save();
    console.log(`✅ Appointment updated with order ID: ${order.id}`);

    // 5. Send response to frontend
    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      appointmentId: appointment._id
    });

  } catch (error) {
    const razorpayError = error.error || error.response?.data?.error || {};
    const errorMessage =
      razorpayError.description ||
      razorpayError.reason ||
      razorpayError.message ||
      error.message ||
      "Payment Gateway Error";
    const errorType = razorpayError.code || error.code || "RAZORPAY_ERROR";

    console.error("❌ RAZORPAY CREATE ORDER ERROR:", {
      message: error.message,
      details: razorpayError,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack
    });

    // Send detailed error response
    res.status(500).json({
      success: false,
      message: "Failed to create payment order",
      error: errorMessage,
      type: errorType
    });
  }
});

// @route   POST /api/payments/verify
// @desc    Verify Razorpay payment signature
// @access  Private
const verifyPayment = asyncHandler(async (req, res) => {
  try {
    console.log("🔐 Verifying payment...");
    
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      appointmentId 
    } = req.body;

    // Validate input
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.warn("⚠️ Missing payment verification details");
      return res.status(400).json({ 
        message: "Missing payment verification details",
        error: "Missing_fields"
      });
    }

    // 1. Create expected signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    console.log(`📝 Expected Signature: ${expectedSignature}`);
    console.log(`📝 Received Signature: ${razorpay_signature}`);

    // 2. Verify signature
    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      console.warn("❌ Payment signature verification failed");
      return res.status(400).json({ 
        message: 'Invalid payment signature. Transaction rejected.',
        error: "Invalid_signature",
        success: false
      });
    }

    console.log("✅ Signature verified successfully");

    // 3. Update appointment status
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      console.warn(`⚠️ Appointment not found: ${appointmentId}`);
      return res.status(404).json({ 
        message: 'Appointment not found',
        error: "Appointment_not_found"
      });
    }

    // Check authorization
    if (String(appointment.patientId) !== String(req.user._id)) {
      console.warn(`⚠️ Unauthorized payment verification for appointment: ${appointmentId}`);
      return res.status(403).json({ 
        message: 'Not authorized to verify payment for this appointment',
        error: "Unauthorized"
      });
    }

    if (appointment.paymentIntentId && appointment.paymentIntentId !== razorpay_order_id) {
      console.warn(`Razorpay order mismatch for appointment: ${appointmentId}`);
      return res.status(400).json({
        message: 'Payment order does not match this appointment.',
        error: "Order_mismatch",
        success: false
      });
    }

    if (appointment.paymentStatus === 'paid') {
      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        appointmentId: appointment._id,
        paymentId: appointment.paymentId || razorpay_payment_id
      });
    }

    // Update appointment with payment details
    appointment.paymentStatus = 'paid';
    appointment.status = 'confirmed';
    appointment.paymentId = razorpay_payment_id;
    appointment.paidAt = new Date();
    await appointment.save();
    console.log(`✅ Appointment marked as paid and confirmed: ${appointmentId}`);

    let doctorSpecialization = '';
    try {
      const doctor = await Doctor.findById(appointment.doctorId).select('specialization').lean();
      doctorSpecialization = doctor?.specialization || '';
    } catch (err) {
      console.warn('Unable to load doctor specialization for payment notification:', err.message);
    }

    // 4. Emit real-time update via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${appointment.patientId}`).emit('appointments:updated', {
        reason: 'payment-verified',
        appointmentId: String(appointment._id),
        status: 'confirmed',
        date: appointment.date,
        time: appointment.time,
        doctorName: appointment.doctorName,
        specialization: doctorSpecialization
      });
      io.to(`user:${appointment.doctorId}`).emit('appointments:updated', {
        reason: 'payment-verified',
        appointmentId: String(appointment._id),
        patientName: appointment.patientName,
        status: 'confirmed',
        date: appointment.date,
        time: appointment.time
      });
      console.log("📢 Socket.IO notification sent");
    }

    // 5. Send success response
    res.status(200).json({
      success: true,
      message: 'Payment successful, appointment confirmed',
      appointmentId: appointment._id,
      paymentId: razorpay_payment_id
    });

  } catch (error) {
    console.error("❌ PAYMENT VERIFICATION ERROR:", {
      message: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to verify payment",
      error: error.message,
      type: "VERIFICATION_ERROR"
    });
  }
});

// @route   POST /api/payments/cancel
// @desc    Cancel pending appointment payment
// @access  Private
const cancelPendingPayment = asyncHandler(async (req, res) => {
  try {
    console.log("🚫 Cancelling pending appointment...");
    
    const { appointmentId } = req.body;
    
    if (!appointmentId) {
      console.warn("⚠️ No appointmentId provided for cancellation");
      return res.status(400).json({ 
        message: 'Appointment ID is required',
        error: "Missing_appointmentId"
      });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      console.warn(`⚠️ Appointment not found: ${appointmentId}`);
      return res.status(404).json({ 
        message: 'Appointment not found',
        error: "Appointment_not_found"
      });
    }

    // Check authorization
    if (String(appointment.patientId) !== String(req.user._id)) {
      console.warn(`⚠️ Unauthorized cancellation attempt for appointment: ${appointmentId}`);
      return res.status(403).json({ 
        message: 'Not authorized to cancel this appointment',
        error: "Unauthorized"
      });
    }

    // Check if already paid
    if (appointment.paymentStatus === 'paid') {
      console.warn(`⚠️ Cannot cancel paid appointment: ${appointmentId}`);
      return res.status(400).json({ 
        message: 'Cannot cancel a paid appointment. Please contact support for refunds.',
        error: "Already_paid"
      });
    }

    // Delete appointment
    await Appointment.findByIdAndDelete(appointmentId);
    console.log(`✅ Pending appointment deleted: ${appointmentId}`);

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${appointment.patientId}`).emit('appointments:updated', {
        reason: 'payment-cancelled',
        appointmentId: String(appointmentId)
      });
      io.to(`user:${appointment.doctorId}`).emit('appointments:updated', {
        reason: 'payment-cancelled',
        appointmentId: String(appointmentId)
      });
      console.log("📢 Socket.IO cancellation notification sent");
    }

    res.status(200).json({
      success: true,
      message: 'Pending appointment cancelled successfully',
      appointmentId: appointmentId
    });

  } catch (error) {
    console.error("❌ CANCEL PAYMENT ERROR:", {
      message: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Failed to cancel appointment",
      error: error.message,
      type: "CANCEL_ERROR"
    });
  }
});

module.exports = { 
  createOrder, 
  verifyPayment, 
  cancelPendingPayment 
};
