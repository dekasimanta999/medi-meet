/**
 * Medical records and related PHI must only be reachable by doctor accounts,
 * not patient (User) JWTs.
 */
const doctorOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  
  // Check if user has licenseNumber (doctor-specific field)
  if (req.user.licenseNumber === undefined) {
    return res.status(403).json({
      message: 'Medical records are only available to doctor accounts.',
      code: 'DOCTOR_ONLY'
    });
  }
  
  next();
};

module.exports = { doctorOnly };
