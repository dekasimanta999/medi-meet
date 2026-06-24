const SPECIALTY_FEES = Object.freeze({
  'general physician': 500,
  diabetologist: 500,
  pediatrician: 500,
  psychiatrist: 500,
  dietitian: 500,
  gynecologist: 750,
  ophthalmologist: 750,
  dermatologist: 750,
});

const DEFAULT_CONSULTATION_FEE = 500;

const normalizeSpecialty = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const getConsultationFeeBySpecialization = (specialization) =>
  SPECIALTY_FEES[normalizeSpecialty(specialization)] || DEFAULT_CONSULTATION_FEE;

const normalizeConsultationFee = (value, fallback = DEFAULT_CONSULTATION_FEE) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.round(numeric);
};

module.exports = {
  DEFAULT_CONSULTATION_FEE,
  SPECIALTY_FEES,
  getConsultationFeeBySpecialization,
  normalizeConsultationFee,
};
