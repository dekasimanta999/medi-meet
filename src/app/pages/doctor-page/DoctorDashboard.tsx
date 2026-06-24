import { useState, useEffect, useCallback, useRef } from "react";
import type { ChangeEvent, CSSProperties, FC } from "react";
import {
  LayoutDashboard, Calendar, Users, BarChart2, Settings, Bell, Search,
  Mic, ChevronRight, Video, FileText, Plus, X, Check, AlertTriangle,
  Clock, TrendingUp, Star, IndianRupee, Moon, Sun, Layers, Menu, XCircle,
  Shield, Lock, Eye, EyeOff, Upload, Trash2, Save,
  RefreshCw, User, GraduationCap, Download
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { VideoRoom, type VideoRoomCloseDetails } from "../../../components/ui/VideoRoom";
import { ProfessionalDropdown } from "../../components/ui/ProfessionalDropdown";
import { ProfessionalDatePicker } from "../../components/ui/ProfessionalDatePicker";
import { MEDIMEET_LOGO_SRC } from "../../constants/assets";
import { createPrescription } from "../../../api/prescriptionApi";
import { DEFAULT_CONSULTATION_FEE } from "../../constants/consultationPricing";

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
type ThemeKey = "dark" | "light" | "glass";
type AppointmentStatus = "paid" | "confirmed" | "completed" | "scheduled" | "cancelled";
type AppointmentType = "General" | "Follow-up" | "Emergency";
type ToastType = "success" | "error" | "warn";
type PageKey = "dashboard" | "appointments" | "patients" | "analytics" | "settings";
type SettingsTab = "profile" | "availability" | "security";

interface Doctor {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  licenseNumber: string;
  experience: number;
  consultationFee: number;
  fee?: number; // backend field alias
  qualifications: string[];
  unavailablePeriods: UnavailablePeriod[];
  isAvailable: boolean;
  isTwoFactorEnabled: boolean;
  averageRating: number;
  image: string | null;
}

interface UnavailablePeriod {
  _id?: string;
  start: string;
  end: string;
  reason?: string;
}

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail?: string; // Added to handle universal emails
  type: AppointmentType;
  date: string;
  time: string;
  status: AppointmentStatus;
  startsAt: string;
  notes: string;
  gender: string;
  bloodGroup: string;
  dob: string;
  allergies: string[];
  emergencyContact: string;
  patientImage: string;
  prescription?: Array<{
    medicine: string;
    dosage: string;
    duration: string;
    instructions: string;
  }>;
}

interface Patient {
  id: string;
  name: string;
  gender: string;
  bloodGroup: string;
  dob: string;
  allergies: string[];
  emergencyContact: string;
  image: string;
}

type MedicalRecordType = "lab" | "diagnostic" | "prescription";

interface PatientMedicalRecord {
  id: string;
  name: string;
  doctor: string;
  specialization: string;
  date: string;
  type: MedicalRecordType;
  notes: string;
  hasFile: boolean;
  originalFileName: string;
  createdAt: string;
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface RxRow {
  id: number;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  timing: string;
  instructions: string;
}

interface ProfileState {
  experience: number;
  phone: string;
}

interface PwdState {
  current: string;
  new_: string;
  confirm: string;
}

interface NavItem {
  key: PageKey;
  label: string;
  icon: LucideIcon;
}

interface RevenuePoint {
  label: string;
  rev: number;
}

interface TypeDistributionItem {
  name: string;
  count: number;
  pct: number;
}

interface WeekdayPoint {
  day: string;
  count: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
}

/* ─────────────────────────────────────────────
   API — REAL BACKEND CALLS
   Reads JWT token from localStorage (key: "doctorToken" or "token")
   Matches routes defined in doctorRoutes.js & doctorController.js
───────────────────────────────────────────── */
const RAW_BASE_URL: string =
  (typeof (import.meta as unknown as Record<string, Record<string, string>>).env !== "undefined"
    ? (import.meta as unknown as Record<string, Record<string, string>>).env.VITE_API_URL
    : undefined) ??
  "http://localhost:5002";

const BASE_URL: string = RAW_BASE_URL.replace(/\/api\/?$/, "");

function getBackendOrigin(): string {
  const base = BASE_URL || "http://localhost:5002";
  return base.replace(/\/api\/?$/, "");
}

function apiUrl(path: string): string {
  return `${BASE_URL}/api${path.startsWith("/") ? path : `/${path}`}`;
}

function assetUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const cleanPath = path.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${getBackendOrigin()}/${cleanPath.startsWith("uploads/") ? cleanPath : `uploads/${cleanPath}`}`;
}

function isDefaultDoctorImage(path?: string | null): boolean {
  return !path || path.includes("default-doc") || path.includes("/images/doctors/default");
}

function isDefaultProfileImage(path?: string | null): boolean {
  return !path || path.includes("default-avatar") || path.includes("default-doc");
}

function getAuthToken(): string {
  try {
    const raw = sessionStorage.getItem("userInfo");
    if (raw) {
      const parsed = JSON.parse(raw) as { token?: string };
      if (parsed?.token) return parsed.token;
    }
  } catch { /* ignore malformed JSON */ }

  return (
    sessionStorage.getItem("doctorToken") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("doctorToken") ||
    localStorage.getItem("token") ||
    ""
  );
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

function sendAvailabilityKeepalive(isAvailable: boolean): void {
  try {
    void fetch(apiUrl("/doctors/availability"), {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ isAvailable }),
      keepalive: true,
    });
  } catch {
    // The browser may reject keepalive during shutdown; the next dashboard load will correct status.
  }
}

function normaliseDoctor(raw: Record<string, unknown>): Doctor {
  const specialization = String(raw.specialization ?? "");
  const rawFee = Number(raw.fee ?? raw.consultationFee ?? DEFAULT_CONSULTATION_FEE);
  const consultationFee = Number.isFinite(rawFee) && rawFee > 0 ? Math.round(rawFee) : DEFAULT_CONSULTATION_FEE;
  return {
    id: String(raw._id ?? raw.id ?? ""),
    name: String(raw.name ?? ""),
    email: String(raw.email ?? ""),
    phone: String(raw.phone ?? ""),
    specialization,
    licenseNumber: String(raw.licenseNumber ?? ""),
    experience: Number(raw.experience ?? 0),
    consultationFee,
    fee: consultationFee,
    qualifications: normaliseList(raw.qualifications ?? raw.qualification),
    unavailablePeriods: normaliseUnavailablePeriods(raw.unavailablePeriods),
    isAvailable: Boolean(raw.isAvailable ?? false),
    isTwoFactorEnabled: Boolean(raw.isTwoFactorEnabled ?? false),
    averageRating: Number(raw.averageRating ?? 0),
    image: String(raw.image ?? "") || null,
  };
}

const VALID_STATUSES = new Set<AppointmentStatus>(
  ["paid", "confirmed", "completed", "scheduled", "cancelled"]
);

function normaliseAppointment(raw: Record<string, unknown>): Appointment {
  const type = (raw.type as string) ?? "General";
  const date = normaliseDateValue(raw.date);
  const time = String(raw.time ?? "");
  const rawStatus = String(raw.status ?? "scheduled");
  const patientRaw = raw.patient as Record<string, unknown> | undefined;
  const status: AppointmentStatus = VALID_STATUSES.has(rawStatus as AppointmentStatus)
    ? (rawStatus as AppointmentStatus)
    : "scheduled"; 
  return {
    id: String(raw._id ?? raw.id ?? ""),
    patientId: String(raw.patientId ?? patientRaw?._id ?? patientRaw?.id ?? ""),
    patientName: String(raw.patientName ?? "Unknown"),
    patientEmail: String((raw as Record<string, unknown>).patientEmail ?? (raw as Record<string, unknown>).email ?? ""),
    type: (["General", "Follow-up", "Emergency"].includes(type) ? type : "General") as AppointmentType,
    date,
    time,
    status,
    startsAt: `${date}T${time}`,
    notes: String(raw.notes ?? ""),
    gender: String((raw as Record<string, unknown>).gender ?? "Unknown"),
    bloodGroup: String((raw as Record<string, unknown>).bloodGroup ?? "N/A"),
    dob: String((raw as Record<string, unknown>).dob ?? ""),
    allergies: normaliseList((raw as Record<string, unknown>).allergies),
    emergencyContact: String((raw as Record<string, unknown>).emergencyContact ?? "N/A"),
    patientImage: String((raw as Record<string, unknown>).patientImage ?? patientRaw?.image ?? ""),
  };
}

const api = {
  async getDoctor(): Promise<{ data: Doctor }> {
    const token = getAuthToken();
    let doctorId = "";
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        doctorId = payload.id ?? payload._id ?? payload.sub ?? "";
      } catch {
        // ignore
      }
    }

    const endpoints = [
      apiUrl("/auth/doctor/profile"),
      apiUrl("/auth/user/profile"),
      doctorId ? apiUrl(`/doctors/${doctorId}`) : null,
    ].filter(Boolean) as string[];

    let lastError: Error | null = null;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { headers: authHeaders() });
        if (res.ok) {
          const raw = await res.json();
          return { data: normaliseDoctor(raw as Record<string, unknown>) };
        }
      } catch (e) {
        lastError = e as Error;
      }
    }
    throw lastError ?? new Error("Could not load doctor profile");
  },

  async toggleAvailability(val: boolean): Promise<{ data: { isAvailable: boolean } }> {
    const res = await fetch(apiUrl("/doctors/availability"), {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ isAvailable: val }),
    });
    if (!res.ok) throw new Error("Failed to toggle availability");
    const data = await res.json();
    return { data };
  },

  async addUnavailablePeriod(payload: { start: string; end: string; reason?: string }): Promise<{ data: { unavailablePeriods: UnavailablePeriod[] } }> {
    const res = await fetch(apiUrl("/doctors/unavailable-periods"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message ?? "Failed to save unavailable period");
    }
    const raw = await res.json();
    return { data: { unavailablePeriods: normaliseUnavailablePeriods(raw.unavailablePeriods) } };
  },

  async removeUnavailablePeriod(periodId: string): Promise<{ data: { unavailablePeriods: UnavailablePeriod[] } }> {
    const res = await fetch(apiUrl(`/doctors/unavailable-periods/${periodId}`), {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to remove unavailable period");
    const raw = await res.json();
    return { data: { unavailablePeriods: normaliseUnavailablePeriods(raw.unavailablePeriods) } };
  },

  async getAppointments(): Promise<{ data: Appointment[] }> {
    const res = await fetch(apiUrl("/appointments/doctor"), {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load appointments");
    const raw = await res.json();
    const list = Array.isArray(raw) ? raw : raw.appointments ?? raw.data ?? [];
    return { data: list.map((a: Record<string, unknown>) => normaliseAppointment(a)) };
  },

  async getPatients(): Promise<{ data: Patient[] }> {
    const res = await fetch(apiUrl("/doctors/patients"), {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load patients");
    const raw = await res.json();
    const list: Patient[] = (Array.isArray(raw) ? raw : []).map((p: Record<string, unknown>) => ({
      id: String(p.id ?? p._id ?? ""),
      name: String(p.name ?? ""),
      gender: String(p.gender ?? "Unknown"),
      bloodGroup: String(p.bloodGroup ?? "N/A"),
      dob: String(p.dob ?? ""),
      allergies: normaliseList(p.allergies),
      emergencyContact: String(p.emergencyContact ?? "N/A"),
      image: String(p.image ?? p.patientImage ?? ""),
    }));
    return { data: list };
  },

  async getPatientMedicalRecords(patientId: string): Promise<{ data: PatientMedicalRecord[] }> {
    const params = new URLSearchParams({ patientId, limit: "100" });
    const res = await fetch(apiUrl(`/doctor-records?${params.toString()}`), {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load patient medical records");
    const raw = await res.json();
    const list = Array.isArray(raw?.records) ? raw.records : [];
    return {
      data: list.map((record: Record<string, unknown>) => {
        const type = String(record.type || "lab") as MedicalRecordType;
        return {
          id: String(record._id ?? record.id ?? ""),
          name: String(record.name ?? "Medical record"),
          doctor: String(record.doctor ?? ""),
          specialization: String(record.specialization ?? ""),
          date: String(record.date ?? ""),
          type: ["lab", "diagnostic", "prescription"].includes(type) ? type : "lab",
          notes: String(record.notes ?? ""),
          hasFile: Boolean(record.storedFileName),
          originalFileName: String(record.originalFileName ?? ""),
          createdAt: String(record.createdAt ?? ""),
        };
      }),
    };
  },

  async getPatientMedicalRecordFile(recordId: string, download = false): Promise<Blob> {
    const suffix = download ? "?download=1" : "";
    const res = await fetch(apiUrl(`/doctor-records/${recordId}/file${suffix}`), {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load medical record file");
    return res.blob();
  },

  async updateDoctor(data: Partial<Doctor> & { newQualifications?: string[] }): Promise<{ data: Doctor }> {
    const body: Record<string, unknown> = { ...data };
    if (body.consultationFee !== undefined) {
      body.fee = body.consultationFee;
    }
    const res = await fetch(apiUrl("/auth/doctor/profile"), {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed to update profile");
    const raw = await res.json();
    return { data: normaliseDoctor(raw as Record<string, unknown>) };
  },

  async changePassword(current: string, newPwd: string): Promise<{ data: { success: boolean } }> {
    const res = await fetch(apiUrl("/auth/doctor/changepassword"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ currentPassword: current, newPassword: newPwd }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message ?? "Failed to change password");
    }
    return { data: { success: true } };
  },

  async toggle2FA(val: boolean): Promise<{ data: { isTwoFactorEnabled: boolean } }> {
    const res = await fetch(apiUrl("/auth/2fa/toggle"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ enabled: val }),
    });
    if (!res.ok) throw new Error("Failed to toggle 2FA");
    return { data: { isTwoFactorEnabled: val } };
  },

  async updateAppointment(
    id: string,
    payload: Partial<Appointment>
  ): Promise<{ data: Partial<Appointment> & { id: string } }> {
    const notesRes = payload.notes !== undefined
      ? await fetch(apiUrl(`/appointments/${id}/notes`), {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ notes: payload.notes, prescription: payload.prescription ?? [] }),
        })
      : null;
    if (notesRes && !notesRes.ok) throw new Error("Failed to update appointment notes");

    const statusRes = payload.status !== undefined
      ? await fetch(apiUrl(`/appointments/${id}/status`), {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ status: payload.status }),
        })
      : null;
    if (statusRes && !statusRes.ok) throw new Error("Failed to update appointment status");

    const raw = statusRes
      ? await statusRes.json()
      : notesRes
        ? await notesRes.json()
        : {};
    return { data: { id, ...raw } };
  },

  async uploadPrescriptionFile(appointmentId: string, file: File): Promise<{ _id: string; fileUrl: string }> {
    const formData = new FormData();
    formData.append("document", file); // Must be 'document' for Multer config

    const token = getAuthToken();
    const res = await fetch(apiUrl(`/appointments/${appointmentId}/upload-prescription`), {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {}, // Do not set Content-Type, fetch handles multipart boundaries automatically
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to upload prescription file.");
    }
    return await res.json();
  }
};

/* ─────────────────────────────────────────────
   THEME DEFINITIONS
───────────────────────────────────────────── */
type ThemeVars = Record<string, string>;

const themes: Record<ThemeKey, ThemeVars> = {
  dark: {
    "--bg":       "#080E1C",
    "--surface":  "#0F1829",
    "--surface2": "#162035",
    "--border":   "#1E2D4A",
    "--text":     "#E8F0FE",
    "--text2":    "#7A91B8",
    "--text3":    "#3D5278",
    "--accent":   "#00D9B5",
    "--accent2":  "#0095FF",
    "--danger":   "#FF4D6D",
    "--warn":     "#FFB547",
    "--success":  "#2ECC71",
    "--card-bg":  "#0F1829",
    "--sidebar":  "#080E1C",
    "--glass":    "none",
    "--blur":     "0px",
    "--overlay":  "rgba(8,14,28,0.85)",
  },
  light: {
    "--bg":       "#F0F4FB",
    "--surface":  "#FFFFFF",
    "--surface2": "#F7F9FE",
    "--border":   "#DDE4F0",
    "--text":     "#0D1B35",
    "--text2":    "#4A6080",
    "--text3":    "#9EB2CC",
    "--accent":   "#00BDA0",
    "--accent2":  "#0070F3",
    "--danger":   "#E5183E",
    "--warn":     "#F59E0B",
    "--success":  "#16A34A",
    "--card-bg":  "#FFFFFF",
    "--sidebar":  "#0D1B35",
    "--glass":    "none",
    "--blur":     "0px",
    "--overlay":  "rgba(13,27,53,0.80)",
  },
  glass: {
    "--bg":       "linear-gradient(135deg,#07091A 0%,#0D1F3C 50%,#071A28 100%)",
    "--surface":  "rgba(255,255,255,0.06)",
    "--surface2": "rgba(255,255,255,0.03)",
    "--border":   "rgba(255,255,255,0.12)",
    "--text":     "#E8F4FF",
    "--text2":    "#80A8CC",
    "--text3":    "#3B607A",
    "--accent":   "#00FFD1",
    "--accent2":  "#3D9EFF",
    "--danger":   "#FF4D6D",
    "--warn":     "#FFB547",
    "--success":  "#2ECC71",
    "--card-bg":  "rgba(255,255,255,0.07)",
    "--sidebar":  "rgba(4,8,20,0.70)",
    "--glass":    "blur(16px) saturate(180%)",
    "--blur":     "16px",
    "--overlay":  "rgba(4,8,20,0.88)",
  },
};

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const initials = (name: string): string =>
  name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

const labeledDoctorName = (name: string): string => {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "";
  return /^(Dr\.?\s+)/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
};

const getToday = (): string => new Date().toISOString().slice(0, 10);

const getWeekEnd = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
};

const getMonthStart = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const getMonthEnd = (): string => {
  const d = new Date();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return end.toISOString().slice(0, 10);
};

const fmtDate = (d: string): string => {
  if (!d) return "N/A";
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtCurrency = (n: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const normaliseDateValue = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
};

const normaliseList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(v => v.trim()).filter(Boolean);
  return [];
};

const normaliseUnavailablePeriods = (value: unknown): UnavailablePeriod[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => item as Record<string, unknown>)
    .map((item) => ({
      _id: item._id ? String(item._id) : undefined,
      start: String(item.start ?? ""),
      end: String(item.end ?? ""),
      reason: String(item.reason ?? ""),
    }))
    .filter((item) => item.start && item.end);
};

const formatDateTimeForInput = (value: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
};

const formatUnavailableDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

const statusColor: Record<AppointmentStatus, string> = {
  paid:      "#FFB547",
  confirmed: "#3D9EFF",
  completed: "#2ECC71",
  scheduled: "#A855F7",
  cancelled: "#FF4D6D",
};

const statusLabel: Record<AppointmentStatus, string> = {
  paid:      "Paid",
  confirmed: "Confirmed",
  completed: "Completed",
  scheduled: "Scheduled",
  cancelled: "Cancelled",
};

const typeColor: Record<AppointmentType, string> = {
  General: "#00D9B5",
  "Follow-up": "#3D9EFF",
  Emergency: "#FF4D6D",
};

const avatarColors: string[] = [
  "#FF4D6D", "#FFB547", "#3D9EFF", "#00D9B5",
  "#A855F7", "#F97316", "#10B981", "#6366F1",
];

const avatarColor = (name: string): string =>
  avatarColors[name.charCodeAt(0) % avatarColors.length];

const statusDotStyle = (isOnline: boolean, size = 10): CSSProperties => ({
  position: "absolute",
  right: -3,
  bottom: -3,
  width: size,
  height: size,
  borderRadius: "50%",
  background: isOnline ? "#20C76A" : "#8A8F98",
  border: "3px solid var(--surface)",
  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
});

const getMonthRevenue = (appointments: Appointment[], fee: number): RevenuePoint[] => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const label = d.toLocaleString("default", { month: "short" });
    const rev = appointments
      .filter(a =>
        a.status === "completed" &&
        new Date(a.date).getMonth() === d.getMonth() &&
        new Date(a.date).getFullYear() === d.getFullYear()
      )
      .length * fee;
    return { label, rev };
  });
};

const getTypeDistribution = (appointments: Appointment[]): TypeDistributionItem[] => {
  const counts: Record<string, number> = {};
  appointments.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
  const total = appointments.length || 1;
  return Object.entries(counts).map(([name, count]) => ({
    name,
    count,
    pct: Math.round(count / total * 100),
  }));
};

/* ─────────────────────────────────────────────
   TOAST HOOK & COMPONENT
───────────────────────────────────────────── */
const useToast = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const add = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);
  const remove = useCallback((id: number) =>
    setToasts(p => p.filter(t => t.id !== id)), []);
  return { toasts, add, remove };
};

interface ToastProps {
  toasts: ToastItem[];
  remove: (id: number) => void;
}

const Toast: FC<ToastProps> = ({ toasts, remove }) => (
  <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        background: t.type === "error" ? "#FF4D6D" : t.type === "warn" ? "#FFB547" : "#2ECC71",
        color: "#fff", padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 500,
        display: "flex", alignItems: "center", gap: 12, minWidth: 260, maxWidth: 360,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        animation: "slideUp 0.3s ease",
      }}>
        {t.type === "error" ? <XCircle size={18} /> : t.type === "warn" ? <AlertTriangle size={18} /> : <Check size={18} />}
        <span style={{ flex: 1 }}>{t.message}</span>
        <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.8)", display: "flex" }}>
          <X size={16} />
        </button>
      </div>
    ))}
  </div>
);

/* ─────────────────────────────────────────────
   SKELETON LOADER
───────────────────────────────────────────── */
interface SkeletonProps {
  w?: string | number;
  h?: number;
  r?: number;
  style?: CSSProperties;
}

const Skeleton: FC<SkeletonProps> = ({ w = "100%", h = 20, r = 8, style = {} }) => (
  <div style={{
    width: w, height: h, borderRadius: r,
    background: "linear-gradient(90deg,var(--border) 25%,var(--surface2) 50%,var(--border) 75%)",
    backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", ...style,
  }} />
);

const KpiSkeleton: FC = () => (
  <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, backdropFilter: "var(--glass)" }}>
    <Skeleton h={12} w={90} style={{ marginBottom: 16 }} />
    <Skeleton h={32} w={120} style={{ marginBottom: 12 }} />
    <Skeleton h={10} w={60} />
  </div>
);

/* ─────────────────────────────────────────────
   KPI CARD
───────────────────────────────────────────── */
interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  trend?: number;
}

const KpiCard: FC<KpiCardProps> = ({ icon: Icon, label, value, sub, color, trend }) => (
  <div className="kpi-card" style={{
    background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 16,
    padding: "20px 24px", backdropFilter: "var(--glass)", cursor: "default",
    transition: "transform 0.2s,box-shadow 0.2s", position: "relative", overflow: "hidden",
  }}>
    <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: color, opacity: 0.12 }} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <p style={{ color: "var(--text2)", fontSize: 12, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{label}</p>
        <p style={{ color: "var(--text)", fontSize: 28, fontWeight: 700, lineHeight: 1, marginBottom: 6 }}>{value}</p>
        {sub && <p style={{ color: "var(--text3)", fontSize: 12 }}>{sub}</p>}
      </div>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={22} color={color} />
      </div>
    </div>
    {trend !== undefined && (
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 4 }}>
        <TrendingUp size={12} color={trend >= 0 ? "var(--success)" : "var(--danger)"} />
        <span style={{ fontSize: 11, color: trend >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
          {trend >= 0 ? "+" : ""}{trend}% vs last month
        </span>
      </div>
    )}
  </div>
);

/* ─────────────────────────────────────────────
   APPOINTMENT ROW
───────────────────────────────────────────── */
interface AppointmentRowProps {
  apt: Appointment;
  onJoin?: ((apt: Appointment) => void) | null;
  onNote?: ((apt: Appointment) => void) | null;
  compact?: boolean;
}

const AppointmentRow: FC<AppointmentRowProps> = ({ apt, onJoin, onNote, compact = false }) => (
  <div className="hover-row" style={{
    display: "flex", alignItems: "center", gap: 12,
    padding: compact ? "10px 14px" : "14px 18px",
    borderRadius: 12, border: "1px solid var(--border)", background: "var(--card-bg)",
    backdropFilter: "var(--glass)", transition: "border-color 0.2s", flexWrap: "wrap",
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: "50%", background: avatarColor(apt.patientName),
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: 13, color: "#fff", flexShrink: 0, overflow: "hidden",
    }}>
      {apt.patientImage && !isDefaultProfileImage(apt.patientImage)
        ? <img src={assetUrl(apt.patientImage)} alt={apt.patientName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : initials(apt.patientName)}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {apt.patientName}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--text2)" }}>{apt.time} · {apt.type}</span>
      </div>
    </div>
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
        background: statusColor[apt.status] + "22", color: statusColor[apt.status],
      }}>
        {statusLabel[apt.status]}
      </span>
      {onJoin && (
        <button onClick={() => onJoin(apt)} style={{
          background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8,
          padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 4, transition: "opacity 0.15s",
        }}>
          <Video size={12} /> Join
        </button>
      )}
      {onNote && (
        <button onClick={() => onNote(apt)} style={{
          background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <FileText size={12} /> {apt.status === "completed" ? "Prescription" : "Notes"}
        </button>
      )}
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   PATIENT CARD
───────────────────────────────────────────── */
interface PatientCardProps {
  patient: Patient;
  onViewRecords: (patient: Patient) => void;
}

const PatientCard: FC<PatientCardProps> = ({ patient, onViewRecords }) => (
  <div className="hover-card" style={{
    background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 16,
    padding: 20, backdropFilter: "var(--glass)", transition: "transform 0.2s,border-color 0.2s",
  }}>
    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%", background: avatarColor(patient.name),
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 15, color: "#fff", flexShrink: 0, overflow: "hidden",
      }}>
        {patient.image && !isDefaultProfileImage(patient.image)
          ? <img src={assetUrl(patient.image)} alt={patient.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : initials(patient.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{patient.name}</p>
        <p style={{ fontSize: 12, color: "var(--text2)" }}>{patient.gender} {patient.dob ? `· DOB ${fmtDate(patient.dob)}` : ""}</p>
      </div>
      <div style={{
        marginLeft: "auto", background: typeColor.General + "22", color: typeColor.General,
        fontWeight: 700, fontSize: 13, padding: "4px 10px", borderRadius: 8, flexShrink: 0,
      }}>
        {patient.bloodGroup || "N/A"}
      </div>
    </div>
    {patient.allergies.length > 0 && (
      <div style={{ background: "var(--danger)" + "15", border: "1px solid var(--danger)" + "44", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)", marginBottom: 4 }}>⚠ ALLERGIES</p>
        <p style={{ fontSize: 12, color: "var(--danger)" }}>{patient.allergies.join(", ")}</p>
      </div>
    )}
    <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
      <p style={{ fontSize: 11, color: "var(--text2)", marginBottom: 2 }}>Emergency Contact</p>
      <p style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>{patient.emergencyContact || "N/A"}</p>
    </div>
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={() => onViewRecords(patient)} style={{
        flex: 1, background: "var(--accent)" + "22", color: "var(--accent)",
        border: "1px solid var(--accent)" + "44", borderRadius: 8, padding: "8px", fontSize: 12, fontWeight: 600, cursor: "pointer",
      }}>View Records</button>
      <button style={{
        flex: 1, background: "var(--surface2)", color: "var(--text2)",
        border: "1px solid var(--border)", borderRadius: 8, padding: "8px", fontSize: 12, fontWeight: 600, cursor: "pointer",
      }}>Follow-up</button>
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   NOTES MODAL
───────────────────────────────────────────── */
const recordTypeMeta: Record<MedicalRecordType, { label: string; color: string; bg: string }> = {
  lab: { label: "Lab", color: "#3D9EFF", bg: "rgba(61,158,255,0.14)" },
  diagnostic: { label: "Diagnostic", color: "#A855F7", bg: "rgba(168,85,247,0.14)" },
  prescription: { label: "Prescription", color: "#2ECC71", bg: "rgba(46,204,113,0.14)" },
};

interface PatientRecordsModalProps {
  patient: Patient;
  onClose: () => void;
}

const PatientRecordsModal: FC<PatientRecordsModalProps> = ({ patient, onClose }) => {
  const [records, setRecords] = useState<PatientMedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.getPatientMedicalRecords(patient.id)
      .then(({ data }) => {
        if (active) setRecords(data);
      })
      .catch(() => {
        if (active) setError("Could not load medical records for this patient.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [patient.id]);

  const openRecord = async (record: PatientMedicalRecord) => {
    if (!record.hasFile) return;
    try {
      setError(null);
      const blob = await api.getPatientMedicalRecordFile(record.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch {
      setError("Could not open this medical record file.");
    }
  };

  const downloadRecord = async (record: PatientMedicalRecord) => {
    if (!record.hasFile) return;
    try {
      setError(null);
      const blob = await api.getPatientMedicalRecordFile(record.id, true);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fallbackName = `${record.name || "medical-record"}-record`;
      link.href = url;
      link.download = (record.originalFileName || fallbackName).replace(/[^\w.-]/g, "_");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not download this medical record file.");
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9998, background: "#020617",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(860px,100%)", maxHeight: "85vh", overflow: "hidden",
        background: "#111827", border: "1px solid rgba(148,163,184,0.22)", borderRadius: 16,
        boxShadow: "0 24px 90px rgba(0,0,0,0.65)", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "18px 22px", borderBottom: "1px solid rgba(148,163,184,0.22)",
          background: "#111827",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: "var(--text)", fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Medical Records</p>
            <p style={{ color: "var(--text2)", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {patient.name} - {patient.bloodGroup || "N/A"} - {patient.gender || "Unknown"}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close records" style={{
            width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(148,163,184,0.24)",
            background: "#172033", color: "var(--text2)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 22, overflowY: "auto", background: "#111827" }}>
          {error && (
            <div style={{
              marginBottom: 14, padding: "10px 12px", borderRadius: 10,
              background: "var(--danger)" + "15", border: "1px solid var(--danger)" + "44",
              color: "var(--danger)", fontSize: 13, fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Array(3).fill(0).map((_, i) => (
                <div key={i} style={{ border: "1px solid rgba(148,163,184,0.22)", borderRadius: 12, padding: 16, background: "#202938" }}>
                  <Skeleton h={18} w="45%" style={{ marginBottom: 12 }} />
                  <Skeleton h={12} w="75%" style={{ marginBottom: 8 }} />
                  <Skeleton h={12} w="55%" />
                </div>
              ))}
            </div>
          ) : records.length === 0 ? (
            <div style={{
              border: "1px dashed rgba(148,163,184,0.28)", borderRadius: 12, padding: 34,
              background: "#172033",
              textAlign: "center", color: "var(--text3)", fontSize: 14,
            }}>
              No medical records found for this patient.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {records.map((record) => {
                const meta = recordTypeMeta[record.type] || recordTypeMeta.lab;
                return (
                  <div key={record.id} style={{
                    border: "1px solid rgba(148,163,184,0.24)", borderRadius: 12, padding: 16,
                    background: "#202938", display: "flex", gap: 14, alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 12, background: meta.bg,
                      color: meta.color, display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <FileText size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                        <p style={{ color: "var(--text)", fontSize: 15, fontWeight: 800 }}>{record.name}</p>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bg,
                          padding: "3px 9px", borderRadius: 20,
                        }}>
                          {meta.label}
                        </span>
                      </div>
                      <p style={{ color: "var(--text2)", fontSize: 12, marginBottom: 6 }}>
                        {fmtDate(record.date || record.createdAt)}
                        {record.doctor ? ` - ${record.doctor}` : ""}
                        {record.specialization ? ` (${record.specialization})` : ""}
                      </p>
                      {record.notes && (
                        <p style={{ color: "var(--text2)", fontSize: 13, lineHeight: 1.5 }}>{record.notes}</p>
                      )}
                      {!record.hasFile && (
                        <p style={{ color: "var(--text3)", fontSize: 12, marginTop: 8 }}>No file attached.</p>
                      )}
                    </div>
                    {record.hasFile && (
                      <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                        <button onClick={() => void openRecord(record)} style={{
                          background: "var(--accent)" + "22", color: "var(--accent)",
                          border: "1px solid var(--accent)" + "44", borderRadius: 8, padding: "8px 11px",
                          fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                        }}>
                          <Eye size={14} /> View
                        </button>
                        <button onClick={() => void downloadRecord(record)} style={{
                          background: "#172033", color: "var(--text2)",
                          border: "1px solid rgba(148,163,184,0.24)", borderRadius: 8, padding: "8px 11px",
                          fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                        }}>
                          <Download size={14} /> Download
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const EMPTY_RX: RxRow = {
  id: Date.now(),
  medicineName: "",
  dosage: "",
  frequency: "",
  duration: "",
  timing: "",
  instructions: "",
};

interface NotesModalProps {
  apt: Appointment;
  onClose: () => void;
  onSave: (id: string, payload: Partial<Appointment>) => void;
  toast: (msg: string, type?: ToastType) => void;
}

const NotesModal: FC<NotesModalProps> = ({ apt, onClose, onSave, toast }) => {
  const [notes, setNotes] = useState<string>(apt.notes || "");
  const [chiefComplaints, setChiefComplaints] = useState("");
  const [duration, setDuration] = useState("");
  const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [allergies, setAllergies] = useState(Array.isArray(apt.allergies) ? apt.allergies.join(", ") : "");
  const [pastMedicalHistory, setPastMedicalHistory] = useState("");
  const [familyHistory, setFamilyHistory] = useState("");
  const [socialHistory, setSocialHistory] = useState("");
  const [investigationOrders, setInvestigationOrders] = useState("");
  const [procedureHistory, setProcedureHistory] = useState("");
  const [advice, setAdvice] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [emergencyInstructions, setEmergencyInstructions] = useState("");
  const [visitType, setVisitType] = useState("New visit");
  const [vitals, setVitals] = useState({
    bloodPressure: "",
    pulse: "",
    temperature: "",
    spo2: "",
    weight: "",
    height: "",
  });
  const [rx, setRx] = useState<RxRow[]>([{ ...EMPTY_RX, id: 1 }]);
  const [saving, setSaving] = useState<boolean>(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const addRow = () => setRx(p => [...p, { ...EMPTY_RX, id: Date.now() }]);
  const removeRow = (id: number) => setRx(p => p.filter(r => r.id !== id));
  const updateRow = (id: number, field: keyof RxRow, val: string) =>
    setRx(p => p.map(r => r.id === id ? { ...r, [field]: val } : r));
  const updateVital = (field: keyof typeof vitals, value: string) =>
    setVitals(p => ({ ...p, [field]: value }));

  const save = async () => {
    if (!diagnosis.trim()) {
      toast("Diagnosis is required before generating a prescription.", "warn");
      return;
    }

    setSaving(true);
    try {
      const prescription = rx
        .map(({ medicineName, dosage, frequency, duration, timing, instructions }) => ({
          medicineName,
          dosage,
          frequency,
          duration,
          timing,
          instructions,
        }))
        .filter(item => item.medicineName || item.dosage || item.frequency || item.duration || item.timing || item.instructions);

      const result = await createPrescription({
        appointmentId: apt.id,
        chiefComplaints,
        duration,
        historyOfPresentIllness,
        vitals,
        diagnosis,
        medicines: prescription,
        allergies,
        pastMedicalHistory,
        familyHistory,
        socialHistory,
        investigationOrders,
        procedureHistory,
        advice,
        followUpDate,
        emergencyInstructions,
        notes,
        visitType,
      });

      setGeneratedPdfUrl(result?.prescription?.pdfUrl || "");

      onSave(apt.id, {
        notes,
        prescription: prescription.map((item) => ({
          medicine: item.medicineName,
          dosage: item.dosage,
          duration: item.duration,
          instructions: [item.frequency, item.timing, item.instructions].filter(Boolean).join(" | "),
        })),
        status: "completed",
      });
      toast(result?.message || "Prescription generated and sent to patient.", "success");
    } catch (e) {
      const message = (e as any)?.response?.data?.message || (e instanceof Error ? e.message : "Failed to generate prescription.");
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const downloadGeneratedPdf = async () => {
    if (!generatedPdfUrl) return;
    const token = sessionStorage.getItem("userInfo");
    const parsed = token ? JSON.parse(token) : null;
    const res = await fetch(apiUrl(`/${generatedPdfUrl}`), {
      headers: parsed?.token ? { Authorization: `Bearer ${parsed.token}` } : {},
    });
    if (!res.ok) {
      toast("Unable to download generated prescription.", "error");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Prescription_${apt.patientName.replace(/\s+/g, "_")}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fieldStyle: CSSProperties = {
    width: "100%",
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "10px 12px",
    color: "var(--text)",
    fontSize: 13,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const labelStyle: CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text2)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: ".04em",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, width: "100%", maxWidth: 980, maxHeight: "90vh", overflowY: "auto", backdropFilter: "var(--glass)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontWeight: 800, fontSize: 17, color: "var(--text)" }}>Prescription / Consultation Summary</p>
            <p style={{ fontSize: 12, color: "var(--text2)" }}>{apt.patientName} · {apt.date} {apt.time}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text2)" }}><X size={20} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginBottom: 18 }}>
            <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 700, marginBottom: 4 }}>PATIENT</div>
              <div style={{ color: "var(--text)", fontWeight: 800 }}>{apt.patientName}</div>
              <div style={{ color: "var(--text2)", fontSize: 12 }}>{apt.gender} · Blood group {apt.bloodGroup}</div>
            </div>
            <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 700, marginBottom: 4 }}>APPOINTMENT</div>
              <div style={{ color: "var(--text)", fontWeight: 800 }}>{apt.date} at {apt.time}</div>
              <div style={{ color: "var(--text2)", fontSize: 12 }}>{apt.type} · {apt.status}</div>
            </div>
            <div>
              <div style={labelStyle}>Visit Type</div>
              <ProfessionalDropdown
                variant="doctor"
                value={visitType}
                onChange={setVisitType}
                options={[
                  { value: "New visit", label: "New visit" },
                  { value: "Follow-up", label: "Follow-up" },
                ]}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14, marginBottom: 18 }}>
            {[
              ["Chief Complaints", chiefComplaints, setChiefComplaints, "Fever, cough, headache"],
              ["Duration", duration, setDuration, "3 days"],
              ["Diagnosis *", diagnosis, setDiagnosis, "Clinical diagnosis"],
              ["Allergies", allergies, setAllergies, "Known allergies"],
            ].map(([label, value, setter, placeholder]) => (
              <div key={String(label)}>
                <div style={labelStyle}>{String(label)}</div>
                <input
                  value={String(value)}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => (setter as (next: string) => void)(e.target.value)}
                  placeholder={String(placeholder)}
                  style={fieldStyle}
                />
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={labelStyle}>Vitals</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
              {([
                ["bloodPressure", "BP"],
                ["pulse", "Pulse"],
                ["temperature", "Temp"],
                ["spo2", "SpO2"],
                ["weight", "Weight"],
                ["height", "Height"],
              ] as [keyof typeof vitals, string][]).map(([key, label]) => (
                <input
                  key={key}
                  value={vitals[key]}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateVital(key, e.target.value)}
                  placeholder={label}
                  style={fieldStyle}
                />
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginBottom: 18 }}>
            {[
              ["History of Present Illness", historyOfPresentIllness, setHistoryOfPresentIllness],
              ["Past Medical History", pastMedicalHistory, setPastMedicalHistory],
              ["Family History", familyHistory, setFamilyHistory],
              ["Social History", socialHistory, setSocialHistory],
              ["Investigation / Test Advice", investigationOrders, setInvestigationOrders],
              ["Procedure History", procedureHistory, setProcedureHistory],
            ].map(([label, value, setter]) => (
              <div key={String(label)}>
                <div style={labelStyle}>{String(label)}</div>
                <textarea
                  value={String(value)}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => (setter as (next: string) => void)(e.target.value)}
                  rows={3}
                  style={{ ...fieldStyle, resize: "vertical" }}
                />
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginBottom: 18 }}>
            <div>
              <div style={labelStyle}>Advice</div>
              <textarea value={advice} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setAdvice(e.target.value)} rows={3} style={{ ...fieldStyle, resize: "vertical" }} />
            </div>
            <div>
              <div style={labelStyle}>Emergency Instructions</div>
              <textarea value={emergencyInstructions} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setEmergencyInstructions(e.target.value)} rows={3} style={{ ...fieldStyle, resize: "vertical" }} />
            </div>
            <div>
              <div style={labelStyle}>Follow-up Date</div>
              <ProfessionalDatePicker
                variant="doctor"
                value={followUpDate}
                onChange={setFollowUpDate}
                placeholder="Select follow-up date"
              />
            </div>
          </div>

          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 8 }}>CONSULTATION NOTES</p>
          <textarea
            value={notes}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
            rows={4}
            placeholder="Enter consultation notes..."
            style={{
              width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 14,
              resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
          <p style={{ fontSize: 13, fontWeight: 800, color: "var(--text2)", margin: "20px 0 8px" }}>MEDICINES</p>
          {rx.map(r => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1.7fr auto", gap: 6, marginBottom: 6 }}>
              {(["medicineName", "dosage", "frequency", "duration", "timing", "instructions"] as (keyof RxRow)[]).map(f => (
                <input
                  key={f}
                  value={r[f] as string}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateRow(r.id, f, e.target.value)}
                  placeholder={f === "medicineName" ? "Medicine" : String(f).charAt(0).toUpperCase() + String(f).slice(1)}
                  style={{
                    background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8,
                    padding: "8px 9px", color: "var(--text)", fontSize: 12, fontFamily: "inherit",
                    minWidth: 0,
                  }}
                />
              ))}
              <button onClick={() => removeRow(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button onClick={addRow} style={{
            display: "flex", alignItems: "center", gap: 6, background: "none",
            border: "1px dashed var(--border)", borderRadius: 8, padding: "7px 14px",
            color: "var(--text2)", fontSize: 12, cursor: "pointer", marginTop: 4,
          }}>
            <Plus size={14} /> Add Medicine
          </button>
          <button type="button" onClick={() => setPreviewOpen(p => !p)} style={{
            marginTop: 18, background: "var(--surface2)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "9px 12px", color: "var(--text2)", fontWeight: 700,
            cursor: "pointer"
          }}>
            {previewOpen ? "Hide Preview" : "Preview Prescription Data"}
          </button>
          {previewOpen && (
            <div style={{ marginTop: 10, padding: 14, border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface2)", color: "var(--text2)", fontSize: 12, lineHeight: 1.6 }}>
              <strong style={{ color: "var(--text)" }}>Diagnosis:</strong> {diagnosis || "Not provided"}<br />
              <strong style={{ color: "var(--text)" }}>Medicines:</strong> {rx.filter(r => r.medicineName).length || 0}<br />
              <strong style={{ color: "var(--text)" }}>Advice:</strong> {advice || "Not provided"}
            </div>
          )}
          {generatedPdfUrl && (
            <div style={{ marginTop: 18, padding: 14, borderRadius: 12, border: "1px solid rgba(46,204,113,.35)", background: "rgba(46,204,113,.1)", color: "var(--text)" }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Prescription generated successfully.</div>
              <button type="button" onClick={() => void downloadGeneratedPdf()} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 700 }}>
                Download PDF
              </button>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button onClick={onClose} style={{
              flex: 1, background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "var(--text2)",
            }}>Close</button>
            <button onClick={save} disabled={saving || Boolean(generatedPdfUrl)} style={{
              flex: 2, background: "var(--accent)", border: "none", borderRadius: 10,
              padding: "12px", fontSize: 14, fontWeight: 700, cursor: saving || generatedPdfUrl ? "not-allowed" : "pointer", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: saving || generatedPdfUrl ? 0.7 : 1,
            }}>
              {saving ? <RefreshCw size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={16} />}
              {saving ? "Generating PDF..." : generatedPdfUrl ? "Generated" : "Generate & Send Prescription"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   DASHBOARD PAGE
───────────────────────────────────────────── */
interface DashboardPageProps {
  appointments: Appointment[];
  doctor: Doctor;
  loading: boolean;
  onJoin: (apt: Appointment) => void;
  onNote: (apt: Appointment) => void;
}

const DashboardPage: FC<DashboardPageProps> = ({ appointments, doctor, loading, onJoin, onNote }) => {
  if (loading) return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 16, marginBottom: 24 }}>
      {Array(5).fill(0).map((_, i) => <KpiSkeleton key={i} />)}
    </div>
  );

  const today = getToday();
  const weekEnd = getWeekEnd();
  const monthStart = getMonthStart();

  const todayApts = appointments.filter(a => a.date === today && ["confirmed", "paid", "scheduled"].includes(a.status));
  const upcoming  = appointments.filter(a => a.date > today && a.date <= weekEnd && ["confirmed", "paid", "scheduled"].includes(a.status));
  const uniquePts = new Set(appointments.map(a => a.patientId)).size;
  const revenue   = appointments.filter(a => a.status === "completed" && a.date >= monthStart).length * (doctor.consultationFee || doctor.fee || DEFAULT_CONSULTATION_FEE);
  const pending   = appointments.filter(a => !["completed", "cancelled"].includes(a.status)).length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))", gap: 12, marginBottom: 28 }}>
        <KpiCard icon={Calendar}   label="Today's Appointments" value={todayApts.length}            color="#3D9EFF" />
        <KpiCard icon={Users}      label="Patients"       value={uniquePts}                   color="#A855F7" />
        <KpiCard icon={IndianRupee} label="Revenue This Month"    value={fmtCurrency(revenue)}        color="#00D9B5" />
        <KpiCard icon={Star}       label="Avg Rating"            value={doctor.averageRating ? `${doctor.averageRating.toFixed(1)} ⭐` : "N/A"} color="#FFB547" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 14 }}>Today's Schedule</p>
          {todayApts.length === 0 && (
            <p style={{ color: "var(--text3)", fontSize: 13, padding: "20px 0" }}>No appointments scheduled for today.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {todayApts.map(a => <AppointmentRow key={a.id} apt={a} onJoin={onJoin} onNote={onNote} />)}
          </div>
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 14 }}>Upcoming 7 Days</p>
          {upcoming.length === 0 && (
            <p style={{ color: "var(--text3)", fontSize: 13, padding: "20px 0" }}>No upcoming appointments this week.</p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8 }}>
            {upcoming.map(a => (
              <div key={a.id} className="hover-card" style={{
                background: "var(--card-bg)", border: "1px solid var(--border)",
                borderRadius: 12, padding: 14, backdropFilter: "var(--glass)", transition: "transform 0.2s",
              }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", background: avatarColor(a.patientName),
                    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11, color: "#fff", flexShrink: 0,
                    overflow: "hidden",
                  }}>
                    {a.patientImage && !isDefaultProfileImage(a.patientImage)
                      ? <img src={assetUrl(a.patientImage)} alt={a.patientName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : initials(a.patientName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.patientName}</p>
                    <p style={{ fontSize: 11, color: "var(--text2)" }}>{a.type}</p>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: "var(--text3)" }}>{fmtDate(a.date)}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{a.time}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   APPOINTMENTS PAGE
───────────────────────────────────────────── */
interface AppointmentsPageProps {
  appointments: Appointment[];
  onJoin: (apt: Appointment) => void;
  onNote: (apt: Appointment) => void;
}

const AppointmentsPage: FC<AppointmentsPageProps> = ({ appointments, onJoin, onNote }) => {
  const [filter, setFilter] = useState<string>("all");
  const today     = getToday();
  const weekEnd   = getWeekEnd();
  const monthStart = getMonthStart();
  const monthEnd  = getMonthEnd();

  const filters: { key: string; label: string }[] = [
    { key: "all",   label: "All" },
    { key: "today", label: "Today" },
    { key: "week",  label: "This Week" },
    { key: "month", label: "This Month" },
  ];

  const filtered = appointments.filter(a => {
    if (filter === "today") return a.date === today;
    if (filter === "week")  return a.date >= today && a.date <= weekEnd;
    if (filter === "month") return a.date >= monthStart && a.date <= monthEnd;
    return true;
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: "8px 18px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
            background: filter === f.key ? "var(--accent)" : "var(--surface2)",
            color: filter === f.key ? "#fff" : "var(--text2)", transition: "all 0.15s",
          }}>{f.label}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text2)", alignSelf: "center" }}>{filtered.length} appointments</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(a => (
          <AppointmentRow
            key={a.id}
            apt={a}
            onJoin={["confirmed", "paid", "scheduled"].includes(a.status) ? onJoin : null}
            onNote={a.status === "completed" ? onNote : null}
          />
        ))}
        {filtered.length === 0 && (
          <p style={{ color: "var(--text3)", fontSize: 14, textAlign: "center", padding: 40 }}>No appointments found.</p>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   PATIENTS PAGE
───────────────────────────────────────────── */
interface PatientsPageProps {
  patients: Patient[];
  patientsLoading: boolean;
}

const PatientsPage: FC<PatientsPageProps> = ({ patients, patientsLoading }) => {
  const [recordsPatient, setRecordsPatient] = useState<Patient | null>(null);

  if (patientsLoading) return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
      {Array(6).fill(0).map((_, i) => (
        <div key={i} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
          <Skeleton h={48} w={48} r={24} style={{ marginBottom: 12 }} />
          <Skeleton h={16} style={{ marginBottom: 8 }} />
          <Skeleton h={12} w="60%" />
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>{patients.length} patients</p>
      {patients.length === 0 && (
        <p style={{ color: "var(--text3)", fontSize: 14, textAlign: "center", padding: 40 }}>No patients found. Patients appear after confirmed/paid appointments.</p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
        {patients.map(p => <PatientCard key={p.id} patient={p} onViewRecords={setRecordsPatient} />)}
      </div>
      {recordsPatient && (
        <PatientRecordsModal patient={recordsPatient} onClose={() => setRecordsPatient(null)} />
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   ANALYTICS PAGE
───────────────────────────────────────────── */
const DONUT_COLORS: string[] = ["#00D9B5", "#3D9EFF", "#FF4D6D", "#A855F7"];

const CustomTooltip: FC<CustomTooltipProps> = ({ active, payload, label }) =>
  active && payload?.length ? (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--text)" }}>
      <p style={{ fontWeight: 700, marginBottom: 4 }}>{label || payload[0].name}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || "var(--accent)" }}>
          {p.name}: {typeof p.value === "number" && p.name === "Revenue" ? fmtCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  ) : null;

interface AnalyticsPageProps {
  appointments: Appointment[];
  doctor: Doctor;
}

const AnalyticsPage: FC<AnalyticsPageProps> = ({ appointments, doctor }) => {
  const fee = doctor.consultationFee || doctor.fee || DEFAULT_CONSULTATION_FEE;
  const revenueData: RevenuePoint[] = getMonthRevenue(appointments, fee);
  const typeData: TypeDistributionItem[] = getTypeDistribution(appointments);
  const weekdayData: WeekdayPoint[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => ({
    day: d,
    count: appointments.filter(a => new Date(a.date).getDay() === (i + 1) % 7).length,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, backdropFilter: "var(--glass)" }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 20 }}>Revenue Trends (Last 6 Months)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueData} barSize={24}>
              <XAxis dataKey="label" tick={{ fill: "var(--text2)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text2)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number | string) => `₹${Number(v) / 1000}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="rev" name="Revenue" fill="var(--accent)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, backdropFilter: "var(--glass)" }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 20 }}>Consultation Types</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={typeData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="count" nameKey="name" paddingAngle={4}>
                {typeData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(v: string | number) => <span style={{ fontSize: 12, color: "var(--text2)" }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, backdropFilter: "var(--glass)" }}>
        <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 20 }}>Appointments by Day of Week</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={weekdayData}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fill: "var(--text2)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text2)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="count" name="Appointments" stroke="var(--accent)" strokeWidth={2} fill="url(#grad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   SETTINGS PAGE
───────────────────────────────────────────── */
interface SettingsPageProps {
  doctor: Doctor;
  onUpdate: (data: Partial<Doctor>) => void;
  toast: (msg: string, type?: ToastType) => void;
}

const SettingsPage: FC<SettingsPageProps> = ({ doctor, onUpdate, toast }) => {
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [profile, setProfile] = useState<ProfileState>({
    experience: doctor.experience,
    phone: doctor.phone,
  });
  const [newQualifications, setNewQualifications] = useState<string[]>([""]);
  const [unavailableStart, setUnavailableStart] = useState("");
  const [unavailableEnd, setUnavailableEnd] = useState("");
  const [unavailableReason, setUnavailableReason] = useState("");
  const [saving, setSaving] = useState<boolean>(false);
  const [pwd, setPwd] = useState<PwdState>({ current: "", new_: "", confirm: "" });
  const [showPwd, setShowPwd] = useState<boolean>(false);
  const [is2FA, setIs2FA] = useState<boolean>(doctor.isTwoFactorEnabled);
  const [imgSrc, setImgSrc] = useState<string | null>(
    doctor.image && !isDefaultDoctorImage(doctor.image)
      ? assetUrl(doctor.image)
      : null
  );

  useEffect(() => {
    setProfile({
      experience: doctor.experience,
      phone: doctor.phone,
    });
    setIs2FA(doctor.isTwoFactorEnabled);
  }, [doctor]);

  const updateNewQualification = (index: number, value: string) => {
    setNewQualifications((items) => items.map((item, itemIndex) => itemIndex === index ? value : item));
  };

  const addNewQualification = () => {
    setNewQualifications((items) => [...items, ""]);
  };

  const removeNewQualification = (index: number) => {
    setNewQualifications((items) => items.length === 1 ? items : items.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleImg = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => setImgSrc(ev.target?.result as string);
    r.readAsDataURL(f);
  };

  const saveUnavailablePeriod = async () => {
    if (!unavailableStart || !unavailableEnd) {
      toast("Select both unavailable start and end time.", "error");
      return;
    }

    const start = new Date(unavailableStart);
    const end = new Date(unavailableEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      toast("Unavailable end time must be after start time.", "error");
      return;
    }

    setSaving(true);
    try {
      const result = await api.addUnavailablePeriod({
        start: start.toISOString(),
        end: end.toISOString(),
        reason: unavailableReason,
      });
      onUpdate({ unavailablePeriods: result.data.unavailablePeriods });
      setUnavailableStart("");
      setUnavailableEnd("");
      setUnavailableReason("");
      toast("Unavailable time saved.", "success");
    } catch (e) {
      toast((e as Error).message || "Failed to save unavailable time.", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteUnavailablePeriod = async (periodId?: string) => {
    if (!periodId) return;
    setSaving(true);
    try {
      const result = await api.removeUnavailablePeriod(periodId);
      onUpdate({ unavailablePeriods: result.data.unavailablePeriods });
      toast("Unavailable time removed.", "success");
    } catch {
      toast("Failed to remove unavailable time.", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const additions = newQualifications.map((item) => item.trim()).filter(Boolean);
      const updated = await api.updateDoctor({
        phone: profile.phone,
        experience: profile.experience,
        newQualifications: additions,
      });
      onUpdate(updated.data);
      setNewQualifications([""]);
      toast("Profile updated successfully!", "success");
    } catch {
      toast("Failed to update profile. Please retry.", "error");
    } finally {
      setSaving(false);
    }
  };

  const savePwd = async () => {
    if (!pwd.current) { toast("Enter your current password.", "error"); return; }
    if (pwd.new_ !== pwd.confirm) { toast("Passwords do not match.", "error"); return; }
    if (pwd.new_.length < 6) { toast("New password must be at least 6 characters.", "error"); return; }
    setSaving(true);
    try {
      await api.changePassword(pwd.current, pwd.new_);
      toast("Password changed!", "success");
      setPwd({ current: "", new_: "", confirm: "" });
    } catch (e) {
      toast((e as Error).message || "Failed to change password.", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggle2FAHandler = async () => {
    const next = !is2FA;
    try {
      await api.toggle2FA(next);
      setIs2FA(next);
      toast(`Two-Factor Authentication ${next ? "enabled" : "disabled"}.`, "success");
    } catch {
      toast("Failed to toggle 2FA.", "error");
    }
  };

  const tabs: { key: SettingsTab; label: string; icon: LucideIcon }[] = [
    { key: "profile",      label: "Profile",      icon: User },
    { key: "availability", label: "Availability", icon: Calendar },
    { key: "security",     label: "Security",     icon: Shield },
  ];

  const profileFields: [string, keyof ProfileState, string][] = [
    ["Phone", "phone", "tel"],
    ["Experience (years)", "experience", "number"],
  ];

  const pwdFields: [string, keyof PwdState][] = [
    ["Current Password", "current"],
    ["New Password", "new_"],
    ["Confirm Password", "confirm"],
  ];

  return (
    <div
      className="doctor-settings-layout"
      style={{
        display: "grid",
        gridTemplateColumns: "220px minmax(0,1fr)",
        gap: 20,
        alignItems: "start",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div style={{
        background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 16,
        padding: 8, backdropFilter: "var(--glass)", height: "fit-content",
        maxWidth: 220,
        position: "sticky", top: 0,
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            width: "100%", display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderRadius: 10,
            background: tab === t.key ? "var(--accent)" + "22" : "none", border: "none", cursor: "pointer",
            color: tab === t.key ? "var(--accent)" : "var(--text2)", fontSize: 13, fontWeight: 600,
            marginBottom: 2, textAlign: "left",
          }}>
            <t.icon size={16} />{t.label}
          </button>
        ))}
      </div>

      <div
        className="doctor-settings-scroll-panel"
        style={{
          background: tab === "availability" ? "#111827" : "var(--card-bg)",
          border: tab === "availability" ? "1px solid rgba(148,163,184,0.22)" : "1px solid var(--border)",
          borderRadius: 16,
          padding: 24,
          backdropFilter: tab === "availability" ? "none" : "var(--glass)",
          minHeight: 0,
          maxHeight: "100%",
          overflowY: "auto",
        }}
      >
        {tab === "profile" && (
          <div>
            <p style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", marginBottom: 20 }}>Profile Settings</p>
            <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: imgSrc ? "transparent" : avatarColor(doctor.name),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 20, color: "#fff", overflow: "visible", flexShrink: 0,
                position: "relative",
              }}>
                {imgSrc
                  ? <img src={imgSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                  : initials(doctor.name)}
                <span style={statusDotStyle(doctor.isAvailable, 18)} />
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>{labeledDoctorName(doctor.name)}</p>
                <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 8 }}>{doctor.specialization} · Lic: {doctor.licenseNumber}</p>
                <label style={{
                  display: "inline-flex", gap: 8, alignItems: "center", background: "var(--surface2)",
                  border: "1px solid var(--border)", borderRadius: 10, padding: "8px 16px",
                  cursor: "pointer", fontSize: 13, color: "var(--text2)",
                }}>
                  <Upload size={14} /> Upload Photo
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImg} />
                </label>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
              <div>
                <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 6, fontWeight: 600 }}>Full Name</p>
                <input
                  readOnly
                  value={labeledDoctorName(doctor.name)}
                  style={{
                    width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
                    borderRadius: 10, padding: "10px 14px", color: "var(--text3)", fontSize: 13,
                    fontFamily: "inherit", boxSizing: "border-box", cursor: "not-allowed",
                  }}
                />
              </div>
              {profileFields.map(([lbl, key, type]) => (
                <div key={key}>
                  <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 6, fontWeight: 600 }}>{lbl}</p>
                  <input
                    type={type}
                    value={String(profile[key])}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const nextValue = type === "number" ? Number(e.target.value) : e.target.value;
                      setProfile(p => ({ ...p, [key]: nextValue } as ProfileState));
                    }}
                    style={{
                      width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
                      borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 13,
                      fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginTop: 14 }}>
              {[
                ["Email", doctor.email],
                ["Specialization", doctor.specialization],
                ["Consultation Fee", fmtCurrency(doctor.consultationFee || doctor.fee || DEFAULT_CONSULTATION_FEE)]
              ].map(([lbl, val]) => (
                <div key={lbl}>
                  <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 6, fontWeight: 600 }}>{lbl}</p>
                  <input
                    readOnly
                    value={val}
                    style={{
                      width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
                      borderRadius: 10, padding: "10px 14px", color: "var(--text3)", fontSize: 13,
                      fontFamily: "inherit", boxSizing: "border-box", cursor: "not-allowed",
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <p style={{ fontSize: 12, color: "var(--text2)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <GraduationCap size={15} /> Qualifications
                </p>
                <button type="button" onClick={addNewQualification} style={{
                  background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10,
                  padding: "8px 12px", color: "var(--text2)", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                }}>
                  <Plus size={14} /> Add More
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {doctor.qualifications.length > 0 ? (
                  doctor.qualifications.map((qualification) => (
                    <span key={qualification} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "var(--surface2)", border: "1px solid var(--border)",
                      borderRadius: 999, padding: "7px 11px", color: "var(--text)", fontSize: 12,
                      fontWeight: 700,
                    }}>
                      <GraduationCap size={13} /> {qualification}
                    </span>
                  ))
                ) : (
                  <span style={{ color: "var(--text3)", fontSize: 13 }}>No qualifications saved yet.</span>
                )}
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {newQualifications.map((qualification, index) => (
                  <div key={index} style={{ display: "flex", gap: 8 }}>
                    <input
                      value={qualification}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateNewQualification(index, e.target.value)}
                      placeholder="Add another qualification"
                      style={{
                        flex: 1, minWidth: 0, background: "var(--surface2)", border: "1px solid var(--border)",
                        borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 13,
                        fontFamily: "inherit", boxSizing: "border-box",
                      }}
                    />
                    {newQualifications.length > 1 && (
                      <button type="button" onClick={() => removeNewQualification(index)} aria-label="Remove new qualification" style={{
                        width: 42, borderRadius: 10, border: "1px solid var(--border)",
                        background: "var(--surface2)", color: "var(--text2)", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <button onClick={saveProfile} disabled={saving} style={{
              marginTop: 18, background: "var(--accent)", border: "none", borderRadius: 10,
              padding: "11px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#fff",
              display: "flex", alignItems: "center", gap: 8, opacity: saving ? 0.7 : 1,
            }}>
              {saving ? <RefreshCw size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={16} />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}

        {tab === "availability" && (
          <div>
            <p style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", marginBottom: 8 }}>Unavailable Times</p>
            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 18 }}>
              Add time ranges when patients should not be able to book you.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginBottom: 12 }}>
              <div>
                <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 6, fontWeight: 700 }}>From</p>
                <ProfessionalDatePicker
                  mode="datetime"
                  variant="doctor"
                  value={unavailableStart}
                  min={formatDateTimeForInput(new Date())}
                  onChange={setUnavailableStart}
                  placeholder="Select start date and time"
                />
              </div>
              <div>
                <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 6, fontWeight: 700 }}>To</p>
                <ProfessionalDatePicker
                  mode="datetime"
                  variant="doctor"
                  value={unavailableEnd}
                  min={unavailableStart || formatDateTimeForInput(new Date())}
                  onChange={setUnavailableEnd}
                  placeholder="Select end date and time"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 22, flexWrap: "wrap" }}>
              <input
                value={unavailableReason}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setUnavailableReason(e.target.value)}
                placeholder="Reason (optional)"
                style={{
                  flex: 1, minWidth: 220, background: "#172033", border: "1px solid rgba(148,163,184,0.24)",
                  borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 13,
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
              <button onClick={saveUnavailablePeriod} disabled={saving} style={{
                background: "var(--accent)", border: "none", borderRadius: 10,
                padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#fff",
                display: "flex", alignItems: "center", gap: 8, opacity: saving ? 0.7 : 1,
              }}>
                {saving ? <RefreshCw size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Plus size={14} />}
                Add Unavailable Time
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {doctor.unavailablePeriods.length === 0 && (
                <div style={{
                  background: "#172033", border: "1px solid rgba(148,163,184,0.24)", borderRadius: 12,
                  padding: 16, color: "var(--text2)", fontSize: 13,
                }}>
                  No unavailable times saved.
                </div>
              )}
              {doctor.unavailablePeriods.map((period) => (
                <div key={period._id || `${period.start}-${period.end}`} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                  background: "#172033", border: "1px solid rgba(148,163,184,0.24)", borderRadius: 12,
                  padding: "14px 16px", flexWrap: "wrap",
                }}>
                  <div>
                    <p style={{ color: "var(--text)", fontWeight: 700, fontSize: 13 }}>
                      {formatUnavailableDateTime(period.start)} to {formatUnavailableDateTime(period.end)}
                    </p>
                    {period.reason && <p style={{ color: "var(--text2)", fontSize: 12, marginTop: 4 }}>{period.reason}</p>}
                  </div>
                  <button onClick={() => deleteUnavailablePeriod(period._id)} disabled={saving || !period._id} style={{
                    background: "#111827", border: "1px solid rgba(148,163,184,0.24)", borderRadius: 10,
                    color: "var(--danger)", padding: "8px 10px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12,
                  }}>
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "security" && (
          <div>
            <p style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", marginBottom: 20 }}>Security Settings</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 12 }}>CHANGE PASSWORD</p>
            {pwdFields.map(([lbl, key]) => (
              <div key={key} style={{ marginBottom: 12, position: "relative" }}>
                <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 6 }}>{lbl}</p>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={pwd[key]}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPwd(p => ({ ...p, [key]: e.target.value }))}
                    style={{
                      width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
                      borderRadius: 10, padding: "10px 40px 10px 14px", color: "var(--text)",
                      fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                  <button onClick={() => setShowPwd(p => !p)} style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "var(--text3)",
                  }}>
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))}
            <button onClick={savePwd} disabled={saving} style={{
              background: "var(--accent2)", border: "none", borderRadius: 10, padding: "10px 22px",
              fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#fff",
              display: "flex", alignItems: "center", gap: 8, marginTop: 6, opacity: saving ? 0.7 : 1,
            }}>
              {saving ? <RefreshCw size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Lock size={14} />}
              Update Password
            </button>
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 12 }}>TWO-FACTOR AUTHENTICATION</p>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", gap: 12, flexWrap: "wrap",
              }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>Enable 2FA</p>
                  <p style={{ fontSize: 12, color: "var(--text2)" }}>Add an extra layer of security to your account</p>
                </div>
                <button onClick={toggle2FAHandler} style={{
                  width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
                  position: "relative", background: is2FA ? "var(--accent)" : "var(--border)",
                  transition: "background 0.2s",
                }}>
                  <span style={{
                    position: "absolute", top: 3, left: is2FA ? 26 : 3, width: 20, height: 20,
                    borderRadius: "50%", background: "#fff", transition: "left 0.2s",
                  }} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────────── */
const navItems: NavItem[] = [
  { key: "dashboard",    label: "Overview",      icon: LayoutDashboard },
  { key: "appointments", label: "Appointments",  icon: Calendar },
  { key: "patients",     label: "Patients",      icon: Users },
  { key: "analytics",   label: "Analytics",     icon: BarChart2 },
  { key: "settings",    label: "Settings",      icon: Settings },
];

interface SidebarProps {
  active: PageKey;
  setActive: (page: PageKey) => void;
  doctor: Doctor | null;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  theme: ThemeKey;
}

const Sidebar: FC<SidebarProps> = ({ active, setActive, doctor, sidebarOpen, setSidebarOpen, theme }) => (
  <>
    {sidebarOpen && (
      <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />
    )}
    <aside style={{
      width: 220, flexShrink: 0, background: "var(--sidebar)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0,
      backdropFilter: theme === "glass" ? "blur(20px)" : "none", zIndex: 41, transition: "transform 0.3s",
    }}>
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img
              src={MEDIMEET_LOGO_SRC}
              alt="MediMeet Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.4)' }}
            />
          </div>
          <div>
            <p style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", letterSpacing: "-0.3px" }}>MediMeet</p>
            <p style={{ fontSize: 10, color: "var(--text3)", letterSpacing: "0.1em" }}>DOCTOR PORTAL</p>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
        {navItems.map(n => (
          <button key={n.key} onClick={() => { setActive(n.key); setSidebarOpen(false); }} style={{
            width: "100%", display: "flex", gap: 12, alignItems: "center", padding: "10px 14px", borderRadius: 12,
            background: active === n.key ? "var(--accent)" + "22" : "transparent", border: "none", cursor: "pointer",
            color: active === n.key ? "var(--accent)" : "var(--text2)", fontSize: 13,
            fontWeight: active === n.key ? 700 : 500, marginBottom: 2, textAlign: "left", transition: "all 0.15s",
          }}>
            <n.icon size={18} />
            {n.label}
            {active === n.key && <ChevronRight size={14} style={{ marginLeft: "auto" }} />}
          </button>
        ))}
      </nav>
      <div style={{ padding: "16px 12px", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderRadius: 12, background: "var(--surface2)" }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: avatarColor(doctor?.name || "D"),
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11, color: "#fff", flexShrink: 0,
            overflow: "visible", position: "relative",
          }}>
            {doctor?.image && !isDefaultDoctorImage(doctor.image)
              ? <img src={assetUrl(doctor.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : doctor ? initials(doctor.name) : ".."}
            <span style={statusDotStyle(Boolean(doctor?.isAvailable), 10)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 600, fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {doctor ? labeledDoctorName(doctor.name) : "Loading..."}
            </p>
            <p style={{ fontSize: 10, color: "var(--text3)" }}>{doctor?.specialization || ""}</p>
          </div>
        </div>
      </div>
    </aside>
  </>
);

/* ─────────────────────────────────────────────
   HEADER
───────────────────────────────────────────── */
interface HeaderProps {
  doctor: Doctor | null;
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  notifications: number;
}

const Header: FC<HeaderProps> = ({ doctor, theme, setTheme, setSidebarOpen, notifications }) => {
  const greeting = (): string => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning ";
    if (h < 17) return "Good afternoon ";
    return "Good evening ";
  };

  const themeButtons: [ThemeKey, LucideIcon, number][] = [
    ["dark",  Moon,   16],
    ["light", Sun,    16],
    ["glass", Layers, 16],
  ];

  return (
    <header style={{
      background: "var(--surface)", borderBottom: "1px solid var(--border)",
      padding: "0 16px", height: 65, display: "flex", alignItems: "center", gap: 12,
      backdropFilter: "var(--glass)", position: "sticky", top: 0, zIndex: 30, flexShrink: 0,
    }}>
      <button
        onClick={() => setSidebarOpen(p => !p)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text2)", display: "none", padding: 4 }}
        className="hamburger"
      >
        <Menu size={22} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, color: "var(--text3)" }}>{greeting()} 👋</p>
        <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {doctor ? labeledDoctorName(doctor.name) : "Doctor"}
        </p>
      </div>
      <div className="header-search" style={{
        flex: 2, maxWidth: 320, display: "flex", alignItems: "center", gap: 10,
        background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 24, padding: "8px 14px",
      }}>
        <Search size={15} color="var(--text3)" />
        <input
          placeholder="Search patients, appointments…"
          style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--text)", fontFamily: "inherit", minWidth: 0 }}
        />
        <Mic size={15} color="var(--text3)" style={{ cursor: "pointer" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <Bell size={20} color="var(--text2)" style={{ cursor: "pointer" }} />
          {notifications > 0 && (
            <span style={{
              position: "absolute", top: -4, right: -4, width: 14, height: 14,
              background: "var(--danger)", borderRadius: "50%", fontSize: 8, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
            }}>
              {notifications}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 3, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 24, padding: 3 }} className="theme-switcher">
          {themeButtons.map(([t, Ic, sz]) => (
            <button key={t} onClick={() => setTheme(t)} title={t} style={{
              width: 28, height: 28, borderRadius: 20, border: "none", cursor: "pointer",
              background: theme === t ? "var(--accent)" : "none",
              color: theme === t ? "#fff" : "var(--text3)",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
            }}>
              <Ic size={sz} />
            </button>
          ))}
        </div>
        <div style={{
          width: 34, height: 34, borderRadius: "50%", background: avatarColor(doctor?.name || "D"),
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: "#fff",
          cursor: "pointer", flexShrink: 0, overflow: "visible", position: "relative",
        }}>
          {doctor?.image && !isDefaultDoctorImage(doctor.image)
            ? <img src={assetUrl(doctor.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
            : doctor ? initials(doctor.name) : ".."}
          <span style={statusDotStyle(Boolean(doctor?.isAvailable), 11)} />
        </div>
      </div>
    </header>
  );
};

/* ─────────────────────────────────────────────
   VIDEO CALL ROOM
───────────────────────────────────────────── */
interface VideoCallRoomProps {
  apt: Appointment;
  socket: Socket;
  doctorName: string;
  onClose: (details?: VideoRoomCloseDetails) => void;
}

const VideoCallRoom: FC<VideoCallRoomProps> = ({ apt, socket, doctorName, onClose }) => (
  <VideoRoom
    appointmentId={apt.id}
    socket={socket}
    localUserName={doctorName}
    remoteUserName={apt.patientName}
    isCaller={true}       
    onClose={onClose}
  />
);

/* ─────────────────────────────────────────────
   APP ROOT
───────────────────────────────────────────── */
export function DoctorDashboard() {
  const [theme, setTheme]               = useState<ThemeKey>("glass");
  const [page, setPage]                 = useState<PageKey>("dashboard");
  const [doctor, setDoctor]             = useState<Doctor | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients]         = useState<Patient[]>([]);
  const [loading, setLoading]           = useState<boolean>(true);
  const [patientsLoading, setPatientsLoading] = useState<boolean>(true);
  const [available, setAvailable]       = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen]   = useState<boolean>(false);
  const [callApt, setCallApt]           = useState<Appointment | null>(null);
  const [noteApt, setNoteApt]           = useState<Appointment | null>(null);
  const { toasts, add: toast, remove: removeToast } = useToast();

  useEffect(() => {
    const markOffline = () => sendAvailabilityKeepalive(false);
    window.addEventListener("beforeunload", markOffline);
    window.addEventListener("pagehide", markOffline);

    return () => {
      window.removeEventListener("beforeunload", markOffline);
      window.removeEventListener("pagehide", markOffline);
      markOffline();
    };
  }, []);

  const socketRef = useRef<Socket | null>(null);
  useEffect(() => {
    const userInfoRaw = sessionStorage.getItem("userInfo") || localStorage.getItem("userInfo");
    const userInfo = userInfoRaw ? JSON.parse(userInfoRaw) as { _id?: string; token?: string } : {};

    const socketOrigin = getBackendOrigin();
    const socket = io(socketOrigin, {
      auth: { userId: userInfo._id ?? "" },
      withCredentials: true,
    });
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const refreshAppointmentsAndPatients = useCallback(async () => {
    try {
      const aRes = await api.getAppointments();
      setAppointments(aRes.data);

      try {
        const pRes = await api.getPatients();
        setPatients(pRes.data);
      } catch {
        const derived = Object.values(
          aRes.data.reduce<Record<string, Patient>>((acc, a) => {
            if (!acc[a.patientId]) acc[a.patientId] = {
              id: a.patientId,
              name: a.patientName,
              gender: a.gender,
              bloodGroup: a.bloodGroup,
              dob: a.dob,
              allergies: a.allergies,
              emergencyContact: a.emergencyContact,
              image: a.patientImage,
            };
            return acc;
          }, {})
        );
        setPatients(derived);
      }
    } catch (error) {
      console.error("Could not refresh real-time appointment data.", error);
    } finally {
      setPatientsLoading(false);
    }
  }, []);

  const refreshDoctorProfile = useCallback(async () => {
    try {
      const dRes = await api.getDoctor();
      setDoctor(dRes.data);
      setAvailable(dRes.data.isAvailable);
    } catch (error) {
      console.error("Could not refresh real-time doctor profile.", error);
    }
  }, []);

  useEffect(() => {
    if (!doctor?.id || !socketRef.current) return;

    const socket = socketRef.current;
    socket.auth = {
      ...(socket.auth as object),
      userId: doctor.id,
    };
    socket.emit("join-room", { roomId: `user:${doctor.id}` });

    const handleAppointmentsUpdated = () => {
      void refreshAppointmentsAndPatients();
    };
    const handleDoctorsUpdated = (payload: { doctorId?: string } = {}) => {
      if (!payload.doctorId || String(payload.doctorId) === String(doctor.id)) {
        void refreshDoctorProfile();
      }
    };

    socket.on("appointments:updated", handleAppointmentsUpdated);
    socket.on("doctors:updated", handleDoctorsUpdated);

    return () => {
      socket.off("appointments:updated", handleAppointmentsUpdated);
      socket.off("doctors:updated", handleDoctorsUpdated);
    };
  }, [doctor?.id, refreshAppointmentsAndPatients, refreshDoctorProfile]);

  const startCall = useCallback((apt: Appointment) => {
    const socket = socketRef.current;
    if (!socket) {
      toast("Socket not connected. Please reload the page.", "error");
      return;
    }
    socket.emit("call-user", {
      targetUserId: apt.patientId,
      appointmentId: apt.id,
      callerName: doctor ? labeledDoctorName(doctor.name) : "Your Doctor",
    });
    setCallApt(apt);
  }, [doctor, toast]);

  useEffect(() => {
    const init = async () => {
      try {
        const [dRes, aRes] = await Promise.all([api.getDoctor(), api.getAppointments()]);
        let online = true;
        try {
          const availabilityRes = await api.toggleAvailability(true);
          online = availabilityRes.data.isAvailable;
        } catch {
          online = dRes.data.isAvailable;
        }
        setDoctor({ ...dRes.data, isAvailable: online });
        setAvailable(online);
        setAppointments(aRes.data);
        setLoading(false);

        setPatientsLoading(true);
        try {
          const pRes = await api.getPatients();
          setPatients(pRes.data);
        } catch {
          const derived = Object.values(
            aRes.data.reduce<Record<string, Patient>>((acc, a) => {
              if (!acc[a.patientId]) acc[a.patientId] = {
                id: a.patientId, name: a.patientName, gender: a.gender,
                bloodGroup: a.bloodGroup, dob: a.dob, allergies: a.allergies,
                emergencyContact: a.emergencyContact, image: a.patientImage,
              };
              return acc;
            }, {})
          );
          setPatients(derived);
        } finally {
          setPatientsLoading(false);
        }
      } catch {
        toast("Failed to load dashboard data. Please check your connection and log in again.", "error");
        setLoading(false);
        setPatientsLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (page === "appointments" && appointments.length === 0 && !loading) {
      api.getAppointments()
        .then(r => setAppointments(r.data))
        .catch(() => toast("Could not refresh appointments.", "warn"));
    }
  }, [page]);

  const handleSaveNote = (id: string, payload: Partial<Appointment>) => {
    setAppointments(p => p.map(a => a.id === id ? { ...a, ...payload } : a));
  };

  const handleVideoCallClose = useCallback((apt: Appointment, details?: VideoRoomCloseDetails) => {
    setCallApt(null);

    if (!details?.wasConnected || apt.status === "completed" || apt.status === "cancelled") {
      return;
    }

    setAppointments((items) =>
      items.map((item) => item.id === apt.id ? { ...item, status: "completed" } : item)
    );

    api.updateAppointment(apt.id, { status: "completed" })
      .then(() => {
        void refreshAppointmentsAndPatients();
        toast("Video session marked as completed.", "success");
      })
      .catch(() => {
        toast("Video call ended, but the session could not be marked completed.", "warn");
        void refreshAppointmentsAndPatients();
      });
  }, [refreshAppointmentsAndPatients, toast]);

  const t = themes[theme];
  const today = getToday();
  const rootStyle = {
    ...t,
    fontFamily: "'DM Sans','Segoe UI',sans-serif",
    height: "100vh",
    display: "flex",
    background: theme === "glass" ? "linear-gradient(135deg,#07091A 0%,#0D1F3C 50%,#071A28 100%)" : "var(--bg)",
    position: "relative",
    overflow: "hidden",
  } as CSSProperties;

  return (
    <div style={rootStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:var(--border);border-radius:10px}
        input,textarea{outline:none;transition:border-color 0.2s}
        input:focus,textarea:focus{border-color:var(--accent)!important}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(0,217,181,0.4)}50%{box-shadow:0 0 0 16px rgba(0,217,181,0)}}
        .kpi-card:hover{transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,0,0,0.3)}
        .hover-card:hover{transform:translateY(-2px);border-color:var(--accent)!important}
        .hover-row:hover{border-color:var(--accent)!important}
        @media(max-width:768px){
          .hamburger{display:flex!important}
          .main-sidebar{position:fixed!important;transform:translateX(-100%);z-index:41}
          .main-sidebar.open{transform:translateX(0)!important}
          .header-search{display:none!important}
          .theme-switcher{display:none!important}
          .doctor-settings-layout{grid-template-columns:1fr!important;overflow:auto!important}
          .doctor-settings-layout>div:first-child{position:relative!important;top:auto!important;max-width:none!important}
          .doctor-settings-scroll-panel{max-height:none!important;overflow:visible!important}
        }
        @media(max-width:480px){
          main{padding:16px!important}
        }
      `}</style>

      <div className={`main-sidebar${sidebarOpen ? " open" : ""}`} style={{ position: "sticky" }}>
        <Sidebar active={page} setActive={setPage} doctor={doctor}
          sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} theme={theme} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
        <Header
          doctor={doctor}
          theme={theme} setTheme={setTheme}
          setSidebarOpen={setSidebarOpen} notifications={0}
        />

        <main style={{ flex: 1, minHeight: 0, padding: "24px 28px", overflowY: page === "settings" ? "hidden" : "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ marginBottom: 20, flexShrink: 0 }}>
            <h1 style={{ fontWeight: 800, fontSize: 22, color: "var(--text)", letterSpacing: "-0.5px" }}>
              {navItems.find(n => n.key === page)?.label}
            </h1>
            <p style={{ color: "var(--text2)", fontSize: 13, marginTop: 2 }}>
              {page === "dashboard"    && `${fmtDate(today)} · ${available ? "Available" : "Offline"}`}
              {page === "appointments" && `${appointments.length} total records`}
              {page === "patients"     && `${patients.length} patients`}
              {page === "analytics"   && "Performance insights"}
              {page === "settings"    && "Manage your account"}
            </p>
          </div>

          {page === "dashboard"    && (
            <DashboardPage
              appointments={appointments}
              doctor={doctor || { id: "", name: "Doctor", email: "", phone: "", specialization: "", licenseNumber: "", experience: 0, consultationFee: 0, qualifications: [], unavailablePeriods: [], isAvailable: false, isTwoFactorEnabled: false, averageRating: 0, image: null }}
              loading={loading}
              onJoin={startCall}
              onNote={setNoteApt}
            />
          )}
          {page === "appointments" && <AppointmentsPage appointments={appointments} onJoin={startCall} onNote={setNoteApt} />}
          {page === "patients"     && <PatientsPage patients={patients} patientsLoading={patientsLoading} />}
          {page === "analytics"   && doctor && <AnalyticsPage appointments={appointments} doctor={doctor} />}
          {page === "settings"    && doctor && (
            <SettingsPage
              doctor={doctor}
              onUpdate={d => setDoctor(p => p ? { ...p, ...d } : p)}
              toast={toast}
            />
          )}
          {page === "analytics" && !doctor && loading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 16 }}>
              {Array(4).fill(0).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
          )}

          <footer
            className="py-6 text-center text-slate-600 text-xs"
            style={{ marginTop: "auto", flexShrink: 0 }}
          >
            <div className="flex justify-center gap-4 mb-2">
              <a href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy Policy</a>
              <a href="/terms" className="hover:text-cyan-400 transition-colors">Terms of Service</a>
            </div>
            <p>&copy; {new Date().getFullYear()} Medi Meet. All rights reserved.</p>
            <p className="text-xs text-gray-500 mt-1">Designed and developed by Team Medi Meet with ˗ˏˋ❤️ˎˊ˗</p>
          </footer>
        </main>
      </div>

      {callApt && socketRef.current && (
        <VideoCallRoom
          apt={callApt}
          socket={socketRef.current}
          doctorName={doctor ? labeledDoctorName(doctor.name) : "Doctor"}
          onClose={(details) => handleVideoCallClose(callApt, details)}
        />
      )}
      {noteApt && <NotesModal apt={noteApt} onClose={() => setNoteApt(null)} onSave={handleSaveNote} toast={toast} />}
      <Toast toasts={toasts} remove={removeToast} />
      
    </div>
  );
}
