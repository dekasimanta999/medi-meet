/**
 * Medical records and similar PHI must only be reachable by patient (User) accounts,
 * not provider (Doctor) JWTs.
 */
const patientOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  if (req.user.licenseNumber !== undefined) {
    return res.status(403).json({
      message: 'Medical records are only available to patient accounts.',
    });
  }
  next();
};

module.exports = { patientOnly };
