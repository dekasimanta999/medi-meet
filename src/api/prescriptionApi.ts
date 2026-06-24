import API from "./axios";

export type PrescriptionMedicineInput = {
  medicineName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  timing?: string;
  instructions?: string;
};

export type PrescriptionPayload = {
  appointmentId: string;
  chiefComplaints?: string;
  duration?: string;
  historyOfPresentIllness?: string;
  vitals?: {
    bloodPressure?: string;
    pulse?: string;
    temperature?: string;
    spo2?: string;
    weight?: string;
    height?: string;
  };
  diagnosis: string;
  medicines?: PrescriptionMedicineInput[];
  allergies?: string;
  pastMedicalHistory?: string;
  familyHistory?: string;
  socialHistory?: string;
  investigationOrders?: string;
  procedureHistory?: string;
  advice?: string;
  followUpDate?: string;
  emergencyInstructions?: string;
  notes?: string;
  visitType?: string;
};

export const createPrescription = async (payload: PrescriptionPayload) => {
  const { data } = await API.post("/prescriptions", payload);
  return data;
};

export const getPatientPrescriptions = async () => {
  const { data } = await API.get("/prescriptions/patient");
  return data;
};

export const getDoctorPrescriptions = async () => {
  const { data } = await API.get("/prescriptions/doctor");
  return data;
};

export const getPrescriptionById = async (id: string) => {
  const { data } = await API.get(`/prescriptions/${id}`);
  return data;
};

export const downloadPrescription = async (id: string) => {
  const { data } = await API.get(`/prescriptions/${id}/download`, { responseType: "blob" });
  return data;
};
