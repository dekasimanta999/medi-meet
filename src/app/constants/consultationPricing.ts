export const DEFAULT_CONSULTATION_FEE = 500;

const SPECIALTY_FEES: Record<string, number> = {
  "general physician": 500,
  diabetologist: 500,
  pediatrician: 500,
  psychiatrist: 500,
  dietitian: 500,
  gynecologist: 750,
  ophthalmologist: 750,
  dermatologist: 750,
};

const normalizeSpecialty = (value?: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export const getConsultationFeeBySpecialization = (specialization?: string) =>
  SPECIALTY_FEES[normalizeSpecialty(specialization)] || DEFAULT_CONSULTATION_FEE;

export const formatConsultationFee = (specialization?: string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(getConsultationFeeBySpecialization(specialization));
