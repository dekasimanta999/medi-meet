const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Doctor = require('../models/Doctor'); // ✅ Added Doctor model

const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // ✅ 1. Check if it is a Patient
      req.user = await User.findById(decoded.id).select('-password');
      
      // ✅ 2. If not a Patient, check if it is a Doctor
      if (!req.user) {
        req.user = await Doctor.findById(decoded.id).select('-password');
      }

      // ✅ 3. If neither is found, reject the token
      if (!req.user) {
        res.status(401);
        throw new Error('Not authorized, user not found');
      }

      next();
    } catch (error) {
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  }
  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

module.exports = { protect };
