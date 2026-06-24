import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import API, { getBackendOrigin } from "../../../api/axios";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { IncomingCallModal } from "../../../components/ui/IncomingCallModal";
import { VideoRoom } from "../../../components/ui/VideoRoom";
import { useIsMobile } from "../../components/ui/use-mobile";
import { ProfessionalDropdown } from "../../components/ui/ProfessionalDropdown";
import { ProfessionalDatePicker } from "../../components/ui/ProfessionalDatePicker";
import { MEDIMEET_LOGO_SRC } from "../../constants/assets";
import { DEFAULT_CONSULTATION_FEE } from "../../constants/consultationPricing";

// ─── CSS Variables for Theme Support & Animations ─────────────────────────────
const themeCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,300&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

  :root, .patient-dashboard:not(.dark-theme):not(.glass-theme) {
    --bg-app: #F3F0EB;
    --bg-panel: #FFFFFF;
    --bg-input: #F5F2EE;
    --text-main: #0E1C2E;
    --text-sub: #6B7C93;
    --border: #E6E0D8;
    --overlay: rgba(14,28,46,0.4);
    --accent: #0B6E7D;
    --accent-hover: #095E6C;
    --accent-soft: rgba(11,110,125,0.09);
    --success: #0C7A3E;
    --danger: #C03026;
    --warning: #9E620C;
    --gold: #C4922A;
  }
  .dark-theme {
    --bg-app: #080C12;
    --bg-panel: #0D1320;
    --bg-input: #080C12;
    --text-main: #E8EEF6;
    --text-sub: #5A718A;
    --border: #182336;
    --overlay: rgba(0,0,0,0.75);
    --accent: #14C8D8;
    --accent-hover: #0EB5C4;
    --accent-soft: rgba(20,200,216,0.10);
    --success: #10B981;
    --danger: #F87171;
    --warning: #FBBF24;
    --gold: #E8B84B;
  }
  .glass-theme {
    --bg-app: linear-gradient(140deg, #dce8f0 0%, #ccdde8 100%);
    --bg-panel: rgba(255,255,255,0.72);
    --bg-input: rgba(255,255,255,0.88);
    --text-main: #0E1C2E;
    --text-sub: #4A6A88;
    --border: rgba(255,255,255,0.52);
    --overlay: rgba(0,0,0,0.4);
    --accent: #0B6E7D;
    --accent-hover: #095E6C;
    --accent-soft: rgba(11,110,125,0.09);
    --success: #0C7A3E;
    --danger: #C03026;
    --warning: #9E620C;
    --gold: #C4922A;
  }

  .glass-theme > div {
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }

  .patient-dashboard:not(.dark-theme):not(.glass-theme) .dashboard-sidebar {
    background: #0E1724;
  }

  @keyframes slideUpFade {
    from { opacity: 0; transform: translateY(18px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes float {
    0%   { transform: translateY(0px); }
    50%  { transform: translateY(-5px); }
    100% { transform: translateY(0px); }
  }
  @keyframes dropFade {
    from { opacity: 0; transform: translateY(-8px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }

  .settings-spin-btn svg {
    transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
    transform-origin: center;
  }
  .settings-spin-btn:active svg {
    transform: rotate(60deg);
  }

  .date-scroll::-webkit-scrollbar { height: 5px; }
  .date-scroll::-webkit-scrollbar-track { background: transparent; }
  .date-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }

  .modal-scroll::-webkit-scrollbar { width: 5px; }
  .modal-scroll::-webkit-scrollbar-track { background: transparent; margin: 16px 0; }
  .modal-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }

  .dash-content-scroll::-webkit-scrollbar { width: 6px; }
  .dash-content-scroll::-webkit-scrollbar-track { background: transparent; }
  .dash-content-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }

  .patient-dashboard,
  .patient-dashboard * {
    box-sizing: border-box;
  }
  .patient-dashboard { min-height: 100vh; }
  .patient-dashboard .dashboard-sidebar { transition: none; }
  .patient-dashboard .sidebar-label,
  .patient-dashboard .sidebar-action-label {
    display: none;
  }
  .patient-dashboard .dashboard-header { flex-wrap: wrap; gap: 14px; }
  .patient-dashboard .dashboard-search-bar { width: 100%; max-width: 500px; min-width: 0; }
  .patient-dashboard .dashboard-header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .patient-dashboard .dashboard-content { padding: 36px 40px; }

  .patient-dashboard .grid-responsive-2,
  .patient-dashboard .modal-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .patient-dashboard .grid-responsive-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .patient-dashboard .grid-responsive-5 {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 14px;
  }
  .patient-dashboard .stackable-row {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  /* Nav button hover glow */
  .nav-btn-item:hover {
    background: rgba(255,255,255,0.07) !important;
    color: rgba(255,255,255,0.75) !important;
  }

  /* Card hover lift */
  .lift-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important;
  }

  /* Primary button hover */
  .primary-btn-hover:hover {
    background: var(--accent-hover) !important;
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(11,110,125,0.28) !important;
  }
  .primary-btn-hover:active { transform: translateY(0); }

  @media (max-width: 767px) {
    .patient-dashboard {
      width: 100vw !important;
      height: 100dvh !important;
      min-height: 100dvh !important;
      overflow: hidden !important;
    }
    .patient-dashboard .dashboard-sidebar {
      position: fixed; top: 0; left: 0; height: 100dvh !important;
      width: min(82vw, 288px) !important;
      padding: 16px 0 !important;
      z-index: 1100;
      box-shadow: 4px 0 24px rgba(0,0,0,0.18);
      transform: translateX(-102%);
      transition: transform 0.28s ease;
      pointer-events: none;
    }
    .patient-dashboard .dashboard-sidebar.open {
      transform: translateX(0);
      pointer-events: auto;
    }
    .patient-dashboard .dashboard-sidebar.open .sidebar-button-row,
    .patient-dashboard .dashboard-sidebar.open .sidebar-actions {
      width: 100% !important;
      align-items: stretch !important;
      padding: 0 14px !important;
    }
    .patient-dashboard .dashboard-sidebar.open .sidebar-button-row {
      gap: 8px !important;
    }
    .patient-dashboard .dashboard-sidebar.open .sidebar-actions {
      gap: 8px !important;
    }
    .patient-dashboard .dashboard-sidebar.open .sidebar-logo {
      align-self: flex-start !important;
      margin-left: 2px;
    }
    .patient-dashboard .dashboard-sidebar.open .nav-btn-item,
    .patient-dashboard .dashboard-sidebar.open .sidebar-action-btn {
      width: 100% !important;
      height: 46px !important;
      justify-content: flex-start !important;
      gap: 12px !important;
      padding: 0 14px !important;
      border-radius: 12px !important;
    }
    .patient-dashboard .dashboard-sidebar.open .nav-btn-item {
      color: rgba(255,255,255,0.78) !important;
    }
    .patient-dashboard .dashboard-sidebar.open .nav-btn-item.active {
      background: rgba(196,146,42,0.14) !important;
      color: #C4922A !important;
    }
    .patient-dashboard .dashboard-sidebar.open .sidebar-action-btn {
      color: rgba(255,255,255,0.72) !important;
    }
    .patient-dashboard .dashboard-sidebar.open .sidebar-label,
    .patient-dashboard .dashboard-sidebar.open .sidebar-action-label {
      display: inline;
      font-size: 14px;
      font-weight: 600;
      color: inherit;
      letter-spacing: 0;
    }
    .patient-dashboard .dashboard-main {
      width: 100% !important;
      min-width: 0 !important;
    }
    .patient-dashboard .dashboard-header {
      padding: 12px 14px !important;
      gap: 10px !important;
      align-items: center !important;
    }
    .patient-dashboard .dashboard-header > div:first-child {
      min-width: 0 !important;
      flex: 1 1 auto;
      max-width: calc(100% - 104px);
    }
    .patient-dashboard .dashboard-header > div:first-child > div:last-child {
      min-width: 0;
    }
    .patient-dashboard .dashboard-header > div:first-child > div:last-child > div:last-child {
      max-width: calc(100vw - 164px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .patient-dashboard .dashboard-search-bar {
      order: 3;
      max-width: none !important;
      width: 100% !important;
      flex: 1 0 100%;
      padding: 9px 12px !important;
    }
    .patient-dashboard .dashboard-header-right {
      margin-left: auto;
      flex-wrap: nowrap !important;
      gap: 10px !important;
    }
    .patient-dashboard .dashboard-content {
      padding: 20px 14px 28px !important;
    }
    .patient-dashboard .grid-responsive-2,
    .patient-dashboard .grid-responsive-3,
    .patient-dashboard .grid-responsive-5,
    .patient-dashboard .modal-grid-2 {
      grid-template-columns: minmax(0, 1fr) !important;
    }
    .patient-dashboard .grid-empty {
      grid-column: 1 / -1 !important;
    }
    .patient-dashboard .modal-scroll {
      width: calc(100vw - 24px) !important;
      max-width: calc(100vw - 24px) !important;
      max-height: calc(100dvh - 24px) !important;
      padding: 22px 16px !important;
      border-radius: 16px !important;
    }
    .patient-dashboard .stackable-row {
      align-items: stretch !important;
    }
    .patient-dashboard .stackable-row > div {
      min-width: 0;
      width: 100%;
    }
    .patient-dashboard .stackable-row > div:last-child {
      flex-wrap: wrap !important;
      width: 100%;
    }
    .patient-dashboard .stackable-row > div:last-child > button,
    .patient-dashboard .stackable-row > div:last-child > div {
      flex: 1 1 calc(50% - 5px);
      justify-content: center;
      min-width: 0;
    }
    .patient-dashboard .stackable-row > div:last-child > button:last-child {
      flex-basis: 100%;
    }
    .patient-dashboard .appointment-card {
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 14px !important;
      padding: 16px !important;
    }
    .patient-dashboard .appointment-card-main {
      min-width: 0 !important;
      align-items: flex-start !important;
    }
    .patient-dashboard .appointment-card-main > div:last-child {
      min-width: 0 !important;
    }
    .patient-dashboard .appointment-card-actions {
      width: 100%;
      justify-content: space-between !important;
      align-items: center !important;
      gap: 10px !important;
      flex-wrap: wrap !important;
    }
    .patient-dashboard .appointment-card-actions > div {
      text-align: left !important;
    }
    .patient-dashboard .appointment-card-actions > button {
      min-height: 38px;
      justify-content: center;
    }
    .patient-dashboard .settings-inline-row {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 10px !important;
    }
    .patient-dashboard .settings-inline-row > div:first-child {
      min-width: 0;
      width: 100%;
    }
  }
`;

// ─── Types ───────────────────────────────────────────────────────────────────
interface Profile {
  name: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  blood: string;
  allergies: string;
  emergency: string;
  image?: string;
  isTwoFactorEnabled?: boolean;
}

interface RecordItem {
  id: number;
  name: string;
  doctor: string;
  date: string;
  type: "lab" | "diagnostic" | "prescription";
  icon: React.ReactNode;
  iconBg: string;
}

interface IconProps {
  d?: string | string[];
  size?: number;
  stroke?: string;
  sw?: number;
}

// ─── Core UI Icons ───────────────────────────────────────────────────────────
const Icon: React.FC<IconProps> = ({ d, size = 20, stroke = "currentColor", sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : d && <path d={d} />}
  </svg>
);

const MenuIcon = () => <Icon d={["M3 12h18", "M3 6h18", "M3 18h18"]} size={19} />;
const GridIcon = () => (
  <Icon
    sw={1.8}
    size={19}
    d={["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z", "M14 14h7v7h-7z"]}
  />
);
const CalIcon = () => <Icon d={["M3 4h18v18H3z", "M16 2v4", "M8 2v4", "M3 10h18"]} size={19} />;
const FileIcon = () => <Icon d={["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"]} size={19} />;
const GearIcon = () => <Icon d={["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"]} size={22} sw={2.2} />;
const LogoutIcon = () => <Icon d={["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"]} size={19} />;
const MoonIcon = () => <Icon d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" size={19} />;
const SunIcon = () => <Icon d={["M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", "M12 1v2", "M12 21v2", "M4.22 4.22l1.42 1.42", "M18.36 18.36l1.42 1.42", "M1 12h2", "M21 12h2", "M4.22 19.78l1.42-1.42", "M18.36 5.64l1.42-1.42"]} size={19} />;
const SearchIcon = () => <Icon stroke="var(--text-sub, #aab8b5)" sw={2} size={15} d={["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.35-4.35"]} />;
const MicIcon = ({ color = "var(--text-sub, #aab8b5)" }) => <Icon stroke={color} sw={2} size={15} d={["M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z", "M19 10v2a7 7 0 0 1-14 0v-2", "M12 19v4", "M8 23h8"]} />;
const BellIcon = () => <Icon d={["M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9", "M13.73 21a2 2 0 0 1-3.46 0"]} size={19} />;
const VideoIcon = ({ color = "currentColor" }) => <Icon stroke={color} sw={2} size={13} d={["M23 7l-7 5 7 5V7z", "M1 5h15v14H1z"]} />;
const CheckCircleIcon = () => <Icon sw={2} size={13} d={["M22 11.08V12a10 10 0 1 1-5.93-9.14", "M22 4L12 14.01l-3-3"]} />;
const EyeIcon = () => <Icon sw={2} size={15} d={["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"]} />;
const DownloadIcon = () => <Icon sw={2} size={15} d={["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"]} />;
const PlusIcon = () => <Icon sw={2.2} size={14} d={["M12 5v14", "M5 12h14"]} />;
const FolderIcon = () => <Icon stroke="var(--text-sub, #4a6560)" sw={2} size={14} d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />;
const CalendarCheckIcon = () => <Icon d={["M21 10H3", "M21 6V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2", "M3 10v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10", "M16 2v4", "M8 2v4", "M9 16l2 2 4-4"]} size={18} />;

// ─── New Medical Vectors ──────────────────────────────────
const SparklesIcon = () => <Icon sw={2} size={16} d={["m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z", "M5 3v4", "M19 17v4", "M3 5h4", "M17 19h4"]} />;
const StethoscopeIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" /><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" /><circle cx="20" cy="10" r="2" /></svg>
);
const LabVialIcon = () => <Icon size={20} d={["M10 2v7.31", "M14 9.3V1.99", "M8.5 2h7", "M14 9.3a6.5 6.5 0 1 1-4 0", "M5.52 16h12.96"]} />;
const ActivityIcon = () => <Icon size={20} d="M22 12h-4l-3 9L9 3l-3 9H2" />;
const PillIcon = () => <Icon size={20} d={["m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z", "m8.5 8.5 7 7"]} />;
const DropIcon = () => <Icon size={20} d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />;
const MonitorIcon = () => <Icon size={19} d={["M2 3h20v14H2z", "M8 21h8", "M12 17v4"]} />;

const getImageUrl = (path?: string) => {
  if (!path || path.trim() === '' || path.includes('default-avatar')) {
    return 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
  }
  if (path.startsWith('http')) return path;
  const cleanPath = path.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${getBackendOrigin()}/${cleanPath.startsWith("uploads/") ? cleanPath : `uploads/${cleanPath}`}`;
};

const getDoctorImageUrl = (path?: string) => {
  if (!path || path.trim() === '' || path.includes('default-doc')) return '';
  return getImageUrl(path);
};

const doctorDisplayName = (name?: string) => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'Doctor';
  return /^(Dr\.?\s+)/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
};

const formatNotificationDate = (date?: string, time?: string) => {
  const rawDate = String(date || '').trim();
  const rawTime = String(time || '').trim();
  if (!rawDate) return rawTime || 'the scheduled time';

  const parsed = new Date(rawTime ? `${rawDate} ${rawTime}` : rawDate);
  const displayDate = Number.isNaN(parsed.getTime())
    ? rawDate
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return rawTime ? `${displayDate} at ${rawTime}` : displayDate;
};

// ─── Razorpay Script Loader ──────────────────────────────────────────────────
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

// ─── Data Definitions ────────────────────────────────────────────────────────
const SPECIALTIES = [
  { name: "General Physician", color: "#3B82F6", bg: "rgba(59, 130, 246, 0.1)", icon: <><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" /><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" /><circle cx="20" cy="10" r="2" /></> },
  { name: "Pediatrician", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.1)", icon: <><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></> },
  { name: "Dermatologist", color: "#EC4899", bg: "rgba(236, 72, 153, 0.1)", icon: <><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" /><path d="M14 4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" /><path d="M10 4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" /><path d="M6 6v7" /><path d="M18 11c0 3.3-2.7 6-6 6H9c-2.8 0-5-2.2-5-5V9.5a1.5 1.5 0 0 1 3 0V12" /></> },
  { name: "Psychiatrist", color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.1)", icon: <><path d="M12 4c-2.8 0-5 2.2-5 5 0 1.1.4 2.1 1 2.9-.6.8-1 1.8-1 2.9 0 2.2 1.8 4 4 4h4c2.2 0 4-1.8 4-4 0-1.1-.4-2.1-1-2.9.6-.8 1-1.8 1-2.9 0-2.8-2.2-5-5-5 0-1.1-.9-2-2-2s-2 .9-2 2z" /><path d="M12 4v16" /><path d="M8 12h8" /></> },
  { name: "Ophthalmologist", color: "#14B8A6", bg: "rgba(20, 184, 166, 0.1)", icon: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></> },
  { name: "Diabetologist", color: "#EF4444", bg: "rgba(239, 68, 68, 0.1)", icon: <><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="10" y1="14" x2="14" y2="14" /></> },
  { name: "Dietitian", color: "#22C55E", bg: "rgba(34, 197, 94, 0.1)", icon: <><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" /><path d="M10 2c1 .5 2 2 2 5" /></> },
  { name: "Gynecologist", color: "#D946EF", bg: "rgba(217, 70, 239, 0.1)", icon: <><circle cx="12" cy="10" r="6" /><path d="M12 16v6" /><path d="M9 19h6" /></> },
];

const SPECIALIST_IMAGES: Record<string, string> = {
  "General Physician": "/images/general-physician.png",
  "Pediatrician": "/images/pediatrician.png",
  "Dermatologist": "/images/dermatologist.png",
  "Psychiatrist": "/images/psychiatrist.png",
  "Ophthalmologist": "/images/ophthalmologist.png",
  "Diabetologist": "/images/diabetologist.png",
  "Dietitian": "/images/dietitian.png",
  "Gynecologist": "/images/gynecologist.png",
};

const TYPE_META: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode; iconBg: string }> = {
  lab: { label: "LAB", bg: "#FEF3C7", color: "#D97706", icon: <LabVialIcon />, iconBg: "#FFFBEB" },
  diagnostic: { label: "DIAGNOSTIC", bg: "#E0E7FF", color: "#4F46E5", icon: <ActivityIcon />, iconBg: "#EEF2FF" },
  prescription: { label: "PRESCRIPTION", bg: "#DCFCE7", color: "#16A34A", icon: <PillIcon />, iconBg: "#F0FDF4" },
};

// ─── Styles ───────────────────────────────────────
const S: { [key: string]: React.CSSProperties | any } = {
  app: {
    display: "flex", height: "100vh", minHeight: 600,
    background: "var(--bg-app)",
    fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
    position: "relative", overflow: "hidden"
  },
  sidebar: {
    width: 72, background: "#0E1724",
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "20px 0", flexShrink: 0, justifyContent: "space-between", zIndex: 10
  },
  sideTop: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  sideBot: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10 },
  logoBt: {
    width: 46, height: 46, borderRadius: 14, background: "transparent",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", border: "none", marginBottom: 14, boxShadow: "none"
  },
  navBt: (active: boolean): React.CSSProperties => ({
    width: 44, height: 44, borderRadius: 12,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", border: "none",
    background: active ? "rgba(196,146,42,0.14)" : "transparent",
    color: active ? "#C4922A" : "rgba(255,255,255,0.35)",
    position: "relative", transition: "all 0.2s ease",
    boxShadow: active ? "inset 3px 0 0 #C4922A" : "none"
  }),
  logoutBt: {
    width: 40, height: 40, borderRadius: 10,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", border: "none", background: "transparent",
    color: "rgba(255,255,255,0.28)", transition: "color 0.2s ease"
  },
  header: {
    background: "var(--bg-panel)", padding: "13px 32px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    borderBottom: "1px solid var(--border)", flexShrink: 0, zIndex: 999,
    position: "relative"
  },
  searchBar: {
    display: "flex", alignItems: "center", gap: 10,
    background: "var(--bg-input)", border: "1px solid var(--border)",
    borderRadius: 100, padding: "9px 20px",
    width: "100%", maxWidth: 480, minWidth: 0,
    transition: "border 0.2s ease, box-shadow 0.2s ease"
  },
  searchInput: {
    border: "none", background: "transparent", outline: "none",
    fontSize: 14, color: "var(--text-main)", width: "100%",
    fontFamily: "inherit"
  },
  headerRight: { display: "flex", alignItems: "center", gap: 14, position: "relative" },
  notifBt: {
    width: 40, height: 40, borderRadius: 10,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", border: "1px solid var(--border)",
    background: "var(--bg-input)", color: "var(--text-sub)",
    position: "relative", transition: "all 0.2s ease"
  },
  notifDot: {
    width: 14, height: 14, background: "var(--danger)", borderRadius: "50%",
    position: "absolute", top: -4, right: -4, border: "2px solid var(--bg-panel)"
  },
  avatar: (size = 40): React.CSSProperties => ({
    width: size, height: size, borderRadius: 10,
    background: "linear-gradient(135deg, var(--accent) 0%, #14C8D4 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontWeight: 700, fontSize: size * 0.38,
    cursor: "pointer", flexShrink: 0, overflow: "hidden",
    boxShadow: "0 2px 8px rgba(11,110,125,0.22)", transition: "transform 0.2s ease"
  }),
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  content: {
    flex: 1, overflowY: "auto", padding: "36px 40px",
    position: "relative", background: "var(--bg-app)",
    display: "flex", flexDirection: "column"
  },
  pageTitle: {
    fontSize: 28, fontWeight: 700, color: "var(--text-main)", marginBottom: 6,
    letterSpacing: "-0.03em",
    fontFamily: "'Fraunces', Georgia, 'Times New Roman', serif"
  },
  pageSub: { fontSize: 14, color: "var(--text-sub)", marginBottom: 32 },
  sectionTitle: {
    fontSize: 11, fontWeight: 600, color: "var(--text-sub)",
    letterSpacing: "0.12em", textTransform: "uppercase",
    display: "flex", alignItems: "center", gap: 8, marginBottom: 16
  },
  card: {
    background: "var(--bg-panel)", borderRadius: 16,
    border: "1px solid var(--border)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    transition: "box-shadow 0.2s ease, transform 0.2s ease"
  },
  primaryBtn: {
    padding: "10px 22px", borderRadius: 10,
    background: "var(--accent)", color: "#FFFFFF",
    border: "none", fontSize: 13, fontWeight: 600,
    cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
    transition: "background 0.18s ease, box-shadow 0.18s ease, transform 0.1s ease",
    boxShadow: "0 2px 8px rgba(11,110,125,0.22)", letterSpacing: "0.01em"
  },
  outlineBtn: {
    padding: "10px 22px", borderRadius: 10,
    background: "var(--bg-panel)", border: "1px solid var(--border)",
    color: "var(--text-main)", fontSize: 13, fontWeight: 600,
    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
    transition: "all 0.18s ease"
  },
  iconBtn: {
    color: "var(--text-sub)", background: "none", border: "none",
    cursor: "pointer", padding: 8, transition: "color 0.2s ease", borderRadius: 8
  },
};

// ─── Components ───────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      style={{ position: "relative", width: 44, height: 24, flexShrink: 0 }}
      onClick={() => onChange(!checked)}
    >
      <div style={{
        position: "absolute", inset: 0,
        background: checked ? "var(--accent)" : "var(--border)",
        borderRadius: 24, cursor: "pointer", transition: "background 0.2s"
      }} />
      <div style={{
        position: "absolute", width: 18, height: 18, borderRadius: "50%",
        background: "#fff", top: 3, left: checked ? 23 : 3,
        transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.18)"
      }} />
    </div>
  );
}

function Modal({ open, onClose, title, subtitle, children }: { open: boolean; onClose: () => void; title: string; subtitle: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0,
        background: "var(--overlay, rgba(14,28,46,0.4))",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
      }}
    >
      <div className="modal-scroll" style={{
        background: "var(--bg-panel)", borderRadius: 20, width: 520, maxWidth: "95%",
        padding: "32px", border: "1px solid var(--border)", maxHeight: "90vh",
        overflowY: "auto", boxShadow: "0 24px 64px -8px rgba(14,28,46,0.22), 0 0 0 1px var(--border)"
      }}>
        <div style={{
          fontSize: 20, fontWeight: 700, color: "var(--text-main)", marginBottom: 4,
          letterSpacing: "-0.025em",
          fontFamily: "'Fraunces', Georgia, serif"
        }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--text-sub)", marginBottom: 24 }}>{subtitle}</div>
        {children}
      </div>
    </div>
  );
}

function FormGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        fontSize: 11, fontWeight: 600, color: "var(--text-sub)",
        marginBottom: 6, display: "block",
        textTransform: "uppercase", letterSpacing: "0.09em"
      }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px",
  border: "1px solid var(--border)", borderRadius: 10,
  fontSize: 14, color: "var(--text-main)", background: "var(--bg-input)",
  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease"
};

function Toast({ msg, show }: { msg: string; show: boolean }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24,
      background: "var(--success)", color: "#fff",
      padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600,
      display: "flex", alignItems: "center", gap: 8,
      zIndex: 600, opacity: show ? 1 : 0, transition: "opacity 0.3s",
      pointerEvents: "none", boxShadow: "0 4px 16px rgba(12,122,62,0.28)"
    }}>
      <CheckCircleIcon /> {msg}
    </div>
  );
}

// ✅ 100% REAL AI INTEGRATION
function AISymptomChecker({ profile }: { profile: Profile }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [symptoms, setSymptoms] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scrollContainer = document.getElementById("dashboard-scroll-area");
    if (!scrollContainer) return;
    const handleScroll = () => {
      if (scrollContainer.scrollTop > 40) setIsScrolled(true);
      else setIsScrolled(false);
    };
    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => { setSymptoms(""); setResult(null); setError(null); }, 300);
  };

  const handleAnalyze = async () => {
    if (!symptoms.trim()) return;
    setIsAnalyzing(true);
    setResult(null);
    setError(null);

    try {
      const userInfoRaw = sessionStorage.getItem("userInfo") || localStorage.getItem("userInfo");
      const token = userInfoRaw ? JSON.parse(userInfoRaw).token : null;
      const { data } = await API.post('/ai/analyze', {
        symptoms: symptoms,
        patientData: {
          gender: profile.gender,
          blood: profile.blood,
          allergies: profile.allergies,
          dob: profile.dob
        }
      }, { headers: { Authorization: `Bearer ${token}` } });

      setResult(data.recommendation);
    } catch (err: any) {
      console.error("AI Error:", err.response || err);
      if (err.response?.status === 404) setError("Connection issue. Please ensure your backend routes are configured.");
      else if (err.response?.status === 401) setError("Your secure session has expired. Please log in again.");
      else setError("Our medical assistant is currently busy. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 90, display: isOpen ? "none" : "block" }}>
        <button
          onClick={() => setIsOpen(true)}
          style={{
            background: "var(--accent)",
            color: "#fff", height: 52, width: isScrolled ? 52 : 200, borderRadius: isScrolled ? "50%" : 26,
            padding: isScrolled ? "0" : "0 22px", border: "none",
            boxShadow: "0 8px 28px rgba(11,110,125,0.35)",
            fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center",
            gap: 9, cursor: "pointer", transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
            overflow: "hidden", whiteSpace: "nowrap", letterSpacing: "0.01em"
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          <div style={{ flexShrink: 0, display: "flex" }}><SparklesIcon /></div>
          <span style={{
            opacity: isScrolled ? 0 : 1,
            transform: isScrolled ? "translateX(10px)" : "translateX(0)",
            transition: "all 0.3s ease", display: isScrolled ? "none" : "block"
          }}>
            AI Symptom Checker
          </span>
        </button>
      </div>

      {isOpen && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, width: 390,
          maxWidth: "calc(100vw - 56px)",
          background: "var(--bg-panel)",
          borderRadius: 20, boxShadow: "0 20px 48px rgba(0,0,0,0.14), 0 0 0 1px var(--border)",
          zIndex: 100, display: "flex", flexDirection: "column",
          overflow: "hidden", animation: "slideUpFade 0.35s cubic-bezier(0.16, 1, 0.3, 1)"
        }}>
          {/* Header */}
          <div style={{
            padding: "18px 22px",
            background: "var(--accent)",
            color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: "rgba(255,255,255,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}><SparklesIcon /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>Medical Assistant</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>Powered by Gemini AI</div>
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: "rgba(255,255,255,0.18)", border: "none", color: "#fff",
                width: 28, height: 28, borderRadius: 8, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, transition: "background 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.28)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.18)"}
            >✕</button>
          </div>

          {/* Body */}
          <div style={{ padding: 22 }}>
            <div style={{ fontSize: 13, color: "var(--text-sub)", marginBottom: 14, lineHeight: 1.5 }}>
              Describe your symptoms. I'll analyze your health profile and recommend the right specialist.
            </div>
            <textarea
              rows={3}
              style={{
                ...inputStyle, resize: "none", marginBottom: 16,
                background: "var(--bg-input)", border: "1px solid var(--border)",
                padding: "12px 14px", fontSize: 14, lineHeight: 1.5
              }}
              placeholder="e.g. I've had a severe headache and mild fever for two days…"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
            />

            {isAnalyzing && (
              <div style={{
                padding: "14px", borderRadius: 12, marginBottom: 14,
                background: "var(--bg-input)", border: "1px solid var(--border)"
              }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    background: "linear-gradient(90deg, var(--border) 25%, var(--bg-input) 50%, var(--border) 75%)",
                    backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite"
                  }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
                    <div style={{ height: 9, width: "80%", borderRadius: 4, background: "linear-gradient(90deg, var(--border) 25%, var(--bg-input) 50%, var(--border) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
                    <div style={{ height: 9, width: "60%", borderRadius: 4, background: "linear-gradient(90deg, var(--border) 25%, var(--bg-input) 50%, var(--border) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
                  </div>
                </div>
              </div>
            )}

            {error && !isAnalyzing && (
              <div style={{
                background: "rgba(192,48,38,0.06)", border: "1px solid rgba(192,48,38,0.18)",
                padding: "12px 14px", borderRadius: 10, marginBottom: 14,
                display: "flex", gap: 10, alignItems: "flex-start",
                animation: "slideUpFade 0.3s ease"
              }}>
                <div style={{ color: "var(--danger)", marginTop: 1 }}>⚠</div>
                <div style={{ fontSize: 13, color: "var(--danger)", fontWeight: 500 }}>{error}</div>
              </div>
            )}

            {result && !isAnalyzing && (
              <div style={{
                background: "var(--bg-input)", border: "1px solid var(--border)",
                padding: "16px", borderRadius: 12, marginBottom: 14,
                animation: "slideUpFade 0.4s ease"
              }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 8,
                    background: "var(--accent)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                  }}><SparklesIcon /></div>
                  <div style={{ fontSize: 13.5, color: "var(--text-main)", fontWeight: 400, lineHeight: 1.6 }}>{result}</div>
                </div>
              </div>
            )}

            <button
              style={{
                ...S.primaryBtn, width: "100%", justifyContent: "center",
                padding: "12px", opacity: isAnalyzing ? 0.5 : 1,
                pointerEvents: isAnalyzing ? "none" : "auto"
              }}
              className="primary-btn-hover"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !symptoms.trim()}
            >
              Analyze Symptoms
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── NEW: The Date & Time Booking Modal with Razorpay Integrated ─────────────
const isSameCalendarDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const getSlotDateTime = (date: Date, time: string) => {
  const [timePart, period] = time.split(" ");
  const [hourValue, minuteValue] = timePart.split(":").map(Number);
  const hours = (hourValue % 12) + (period === "PM" ? 12 : 0);
  const slotDateTime = new Date(date);
  slotDateTime.setHours(hours, minuteValue, 0, 0);
  return slotDateTime;
};

const isPastTimeSlot = (date: Date, time: string) => {
  const now = new Date();
  return isSameCalendarDay(date, now) && getSlotDateTime(date, time) < now;
};

const normalizeDoctorFee = (value?: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : DEFAULT_CONSULTATION_FEE;
};

const formatDoctorFee = (value?: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(normalizeDoctorFee(value));

const doctorStatusDotStyle = (isOnline: boolean, size = 10): React.CSSProperties => ({
  position: "absolute",
  right: -3,
  bottom: -3,
  width: size,
  height: size,
  borderRadius: "50%",
  background: isOnline ? "#20C76A" : "#8A8F98",
  border: "3px solid var(--bg-panel)",
  boxShadow: "0 2px 6px rgba(0,0,0,0.16)",
});

type UnavailablePeriod = {
  _id?: string;
  start: string;
  end: string;
  reason?: string;
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

const formatUnavailableDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

const formatUnavailablePeriod = (period: UnavailablePeriod) =>
  `${formatUnavailableDateTime(period.start)} to ${formatUnavailableDateTime(period.end)}`;

const getUnavailablePeriodForSlot = (date: Date, time: string, periods: UnavailablePeriod[]) => {
  const slotStart = getSlotDateTime(date, time);
  const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
  return periods.find((period) => {
    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) return false;
    return slotStart < periodEnd && slotEnd > periodStart;
  }) || null;
};

const getUnavailablePeriodsForDate = (date: Date, periods: UnavailablePeriod[]) => {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return periods.filter((period) => {
    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) return false;
    return periodStart < dayEnd && periodEnd > dayStart;
  });
};

function BookingModal({
  doctor,
  onClose,
  onSuccess
}: {
  doctor: { id: string, name: string, specialization?: string, fee?: number, unavailablePeriods?: UnavailablePeriod[] },
  onClose: () => void,
  onSuccess: () => void
}) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bookingInFlightRef = useRef(false);
  const pendingAppointmentIdRef = useRef<string | null>(null);
  const paymentCompletedRef = useRef(false);

  const todayKey = new Date().toDateString();
  const consultationFee = normalizeDoctorFee(doctor.fee);
  const unavailablePeriods = doctor.unavailablePeriods || [];
  const dates = useMemo(() => {
    const arr: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [todayKey]);

  const timeSlots = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM"];
  const availableTimeSlots = timeSlots;

  useEffect(() => {
    if (dates.length > 0 && !selectedDate) setSelectedDate(dates[0]);
  }, [dates]);

  const handleDateClick = (newDate: Date) => {
    setSelectedDate(newDate);
    setSelectedTime(null);
  };

  const handleTimeSlotClick = (time: string) => {
    if (selectedDate && isPastTimeSlot(selectedDate, time)) {
      alert("This time slot has passed. Please try another time slot.");
      return;
    }
    const unavailablePeriod = selectedDate ? getUnavailablePeriodForSlot(selectedDate, time, unavailablePeriods) : null;
    if (unavailablePeriod) {
      setSelectedTime(null);
      return;
    }
    setError(null);
    setSelectedTime(time);
  };

  const resetPaymentFlow = () => {
    bookingInFlightRef.current = false;
    setIsProcessing(false);
  };

  const cancelPendingAppointment = async (appointmentId: string | null) => {
    if (!appointmentId) {
      resetPaymentFlow();
      return;
    }
    try {
      await API.post('/payments/cancel', { appointmentId });
    } catch (cancelErr) {
      console.error('Failed to cancel pending appointment:', cancelErr);
    } finally {
      if (pendingAppointmentIdRef.current === appointmentId) {
        pendingAppointmentIdRef.current = null;
      }
      resetPaymentFlow();
    }
  };

  const handleBookAndPay = async () => {
    if (!selectedDate || !selectedTime) return;
    if (bookingInFlightRef.current) return;

    bookingInFlightRef.current = true;
    setIsProcessing(true);
    setError(null);

    let appointmentId: string | null = null;

    try {
      const formattedDate = [
        selectedDate.getFullYear(),
        String(selectedDate.getMonth() + 1).padStart(2, "0"),
        String(selectedDate.getDate()).padStart(2, "0")
      ].join("-");

      const bookRes = await API.post('/appointments/book', {
        doctorId: doctor.id,
        date: formattedDate,
        time: selectedTime
      });
      appointmentId = bookRes.data._id;
      pendingAppointmentIdRef.current = appointmentId;
      paymentCompletedRef.current = false;

      const isSdkLoaded = await loadRazorpayScript();
      if (!isSdkLoaded) {
        setError("Failed to load secure payment gateway. Please check your internet connection.");
        await cancelPendingAppointment(appointmentId);
        return;
      }

      const orderRes = await API.post('/payments/create-order', { appointmentId });
      const { orderId, amount, currency, keyId } = orderRes.data;

      const options = {
        key: keyId,
        amount: amount,
        currency: currency,
        name: "Online Doctor Consultation",
        description: `Consultation with ${doctorDisplayName(doctor.name)} on ${selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at ${selectedTime}`,
        order_id: orderId,
        handler: async function (response: any) {
          try {
            paymentCompletedRef.current = true;
            await API.post('/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              appointmentId: appointmentId
            });
            pendingAppointmentIdRef.current = null;
            resetPaymentFlow();
            alert("Payment successful! Your appointment is confirmed.");
            onSuccess();
          } catch (verifyErr) {
            console.error('Payment verification failed:', verifyErr);
            paymentCompletedRef.current = false;
            await cancelPendingAppointment(appointmentId);
            setError("Payment verification failed. If money was deducted, it will be refunded.");
          }
        },
        prefill: { name: "Patient", email: "patient@example.com", contact: "9999999999" },
        theme: { color: "#0B6E7D" },
        modal: {
          ondismiss: function () {
            if (appointmentId && !paymentCompletedRef.current) {
              void cancelPendingAppointment(appointmentId);
            } else {
              resetPaymentFlow();
            }
          }
        }
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.on("payment.failed", async function (response: any) {
        setError(`Payment failed: ${response.error.description}`);
        if (appointmentId && !paymentCompletedRef.current) {
          await cancelPendingAppointment(appointmentId);
        } else {
          resetPaymentFlow();
        }
      });
      paymentObject.open();

    } catch (err: any) {
      console.error("Appointment payment flow failed:", err.response?.data || err);
      if (appointmentId && !paymentCompletedRef.current) {
        await cancelPendingAppointment(appointmentId);
      }
      if (err.response && err.response.status === 400) {
        setError(err.response.data?.message || "This time slot is already booked by another patient. Please select a different time.");
      } else {
        setError(err.response?.data?.error || err.response?.data?.message || "Something went wrong while booking the appointment.");
      }
      resetPaymentFlow();
    }
  };

  const handleModalClose = () => {
    if (bookingInFlightRef.current) return;
    onClose();
  };

  const selectedDateUnavailablePeriods = selectedDate
    ? getUnavailablePeriodsForDate(selectedDate, unavailablePeriods)
    : [];

  return (
    <Modal open={true} onClose={handleModalClose} title="Book Appointment" subtitle={`Consultation with ${doctorDisplayName(doctor.name)}`}>

      {/* Scrollable Date Selector */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-sub)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.09em" }}>Select Date — Next 14 Days</div>
        <div className="date-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10 }}>
          {dates.map((d, i) => {
            const isSelected = selectedDate && selectedDate.toDateString() === d.toDateString();
            const dateUnavailablePeriods = getUnavailablePeriodsForDate(d, unavailablePeriods);
            const hasUnavailableTime = dateUnavailablePeriods.length > 0;
            return (
              <div
                key={i}
                onClick={() => handleDateClick(d)}
                style={{
                  flexShrink: 0, padding: "10px 14px", borderRadius: 12, cursor: "pointer",
                  textAlign: "center", minWidth: 56,
                  background: isSelected ? "var(--accent)" : "var(--bg-input)",
                  color: isSelected ? "#fff" : "var(--text-main)",
                  border: isSelected ? "1px solid var(--accent)" : hasUnavailableTime ? "1.5px solid var(--danger)" : "1px solid var(--border)",
                  transition: "all 0.18s ease"
                }}
                title={hasUnavailableTime ? `Unavailable: ${dateUnavailablePeriods.map(formatUnavailablePeriod).join(", ")}` : undefined}
              >
                <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 3 }}>
                  {d.getDate()}
                </div>
                {hasUnavailableTime && <div style={{ width: 6, height: 6, borderRadius: "50%", background: isSelected ? "#fff" : "var(--danger)", margin: "6px auto 0" }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Time Slot Selector */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-sub)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.09em" }}>Select Time</div>
        {selectedDateUnavailablePeriods.length > 0 && (
          <div style={{
            background: "rgba(192,48,38,0.06)",
            border: "1px solid rgba(192,48,38,0.18)",
            color: "var(--danger)",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 12,
            lineHeight: 1.5,
          }}>
            {doctorDisplayName(doctor.name)} is unavailable from {selectedDateUnavailablePeriods.map(formatUnavailablePeriod).join("; ")}.
          </div>
        )}
        <div className="grid-responsive-3" style={{ gap: 8 }}>
          {availableTimeSlots.map(time => {
            const isSelected = selectedTime === time;
            const unavailablePeriod = selectedDate ? getUnavailablePeriodForSlot(selectedDate, time, unavailablePeriods) : null;
            const isUnavailable = Boolean(unavailablePeriod);
            const isPast = selectedDate ? isPastTimeSlot(selectedDate, time) : false;
            const disabled = isUnavailable || isPast;
            return (
              <div
                key={time}
                onClick={() => handleTimeSlotClick(time)}
                style={{
                  padding: "9px 8px", borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer", textAlign: "center",
                  fontSize: 13, fontWeight: 500,
                  background: isUnavailable ? "rgba(192,48,38,0.08)" : isSelected ? "var(--accent-soft)" : "var(--bg-panel)",
                  color: isUnavailable ? "var(--danger)" : isSelected ? "var(--accent)" : "var(--text-sub)",
                  border: isUnavailable ? "1.5px solid var(--danger)" : isSelected ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                  transition: "all 0.1s ease",
                  opacity: isPast && !isUnavailable ? 0.45 : 1,
                }}
                title={unavailablePeriod ? `Unavailable from ${formatUnavailablePeriod(unavailablePeriod)}` : undefined}
              >
                {time}
                {isUnavailable && <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3 }}>Unavailable</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          background: "rgba(192,48,38,0.06)", border: "1px solid rgba(192,48,38,0.2)",
          padding: "11px 14px", borderRadius: 10, marginBottom: 16,
          display: "flex", gap: 8, alignItems: "flex-start"
        }}>
          <div style={{ color: "var(--danger)" }}>⚠</div>
          <div style={{ fontSize: 12.5, color: "var(--danger)", fontWeight: 500 }}>{error}</div>
        </div>
      )}

      {/* Action Button */}
      <button
        style={{
          ...S.primaryBtn, width: "100%", justifyContent: "center",
          padding: "13px", fontSize: 14,
          opacity: (!selectedDate || !selectedTime || isProcessing) ? 0.6 : 1
        }}
        className="primary-btn-hover"
        onClick={handleBookAndPay}
        disabled={!selectedDate || !selectedTime || isProcessing}
      >
        {isProcessing ? "Initializing Secure Gateway..." : `Proceed to Pay ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(consultationFee)}`}
      </button>
    </Modal>
  );
}

// ─── Pages ────────────────────────────────────────────────────────────────────

function VideoCallRoom({ appointment, socket, userName, onEndCall }: { appointment: any, socket: Socket, userName: string, onEndCall: () => void }) {
  return (
    <VideoRoom
      appointmentId={String(appointment.id || "")}
      socket={socket}
      localUserName={userName || "Patient"}
      remoteUserName={appointment.name || "Doctor"}
      isCaller={false}
      onClose={onEndCall}
    />
  );
}
// ─── Health Vitals Component (kept, not rendered per request) ─────────────────
function HealthVitals() {
  const vitals = [
    { label: "Heart Rate", value: "72 bpm", color: "#EF4444", bg: "#FEE2E2", icon: <ActivityIcon /> },
    { label: "Blood Pressure", value: "120/80", color: "#3B82F6", bg: "#DBEAFE", icon: <DropIcon /> },
    { label: "Weight", value: "70 kg", color: "#10B981", bg: "#D1FAE5", icon: <ActivityIcon /> },
    { label: "Temperature", value: "98.6 °F", color: "#F59E0B", bg: "#FEF3C7", icon: <SparklesIcon /> },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '28px' }}>
      {vitals.map((v, i) => (
        <div key={i} style={{ ...S.card, padding: "16px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: 46, height: 46, borderRadius: "12px", background: v.bg, color: v.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {v.icon}
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-sub)", fontWeight: 600 }}>{v.label}</div>
            <div style={{ fontSize: "17px", color: "var(--text-main)", fontWeight: 700, marginTop: "3px" }}>{v.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardPage({ onStartBooking, searchQuery }: { onStartBooking: (doctorId: string, doctorName: string, specialization?: string, fee?: number, unavailablePeriods?: UnavailablePeriod[]) => void, searchQuery: string }) {
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDoctors = (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    API.get('/doctors')
      .then(response => {
        const formattedData = response.data
          .filter((doc: any) => doc.status === 'approved')
          .map((doc: any) => {
            let cleanSpec = doc.specialization ? doc.specialization.trim() : "General Physician";
            cleanSpec = cleanSpec.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');

            return {
              id: doc._id,
              name: doc.name,
              displayName: doctorDisplayName(doc.name),
              spec: cleanSpec,
              fee: normalizeDoctorFee(doc.fee ?? doc.consultationFee),
              unavailablePeriods: normaliseUnavailablePeriods(doc.unavailablePeriods),
              rating: doc.averageRating || 0,
              reviews: doc.ratings?.length || 0,
              avail: doc.isAvailable ? "Available" : "Unavailable",
              image: doc.image,
              icon: <StethoscopeIcon size={24} color="#0B6E7D" />
            };
          });

        setDoctorsList(formattedData);
        if (showSpinner) setIsLoading(false);
      })
      .catch(error => {
        console.error("Error fetching doctors:", error);
        if (showSpinner) setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  useEffect(() => {
    const socket = io(getBackendOrigin());
    const refreshDoctors = () => fetchDoctors(false);
    socket.on("doctors:updated", refreshDoctors);
    return () => { socket.disconnect(); };
  }, []);

  const filteredDoctors = useMemo(() => {
    if (!searchQuery) {
      return doctorsList.filter(d => d.rating > 4);
    }
    const q = searchQuery.toLowerCase();
    return doctorsList.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.spec.toLowerCase().includes(q)
    );
  }, [doctorsList, searchQuery]);

  return (
    <div>
      {!searchQuery && (
        <>
          <div style={S.pageTitle}>Find a Specialist</div>
          <div style={S.pageSub}>Connect with top-rated healthcare professionals</div>

          {/* Specialty Grid */}
          <div style={{ ...S.sectionTitle, marginBottom: 16 }}>
            <ActivityIcon /> Browse by Specialty
          </div>

          {/* Specialty Grid with Backdrop Overlay */}
          <div
            onClick={(e) => {
              // Close panel if clicking on the grid background, not on specialist boxes
              if (e.target === e.currentTarget && selectedSpecialty) {
                setSelectedSpecialty(null);
              }
            }}
            style={{
              position: "relative",
              marginBottom: 36
            }}
          >
            {/* Invisible Backdrop - Full Screen Overlay */}
            {selectedSpecialty && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSpecialty(null);
                }}
                style={{
                  position: "fixed", inset: 0,
                  zIndex: 50,
                  backgroundColor: "transparent",
                  pointerEvents: "auto"
                }}
              />
            )}

            <div className="grid-responsive-5" style={{ position: "relative", zIndex: 51 }}>
              {SPECIALTIES.map((s) => (
                <div key={s.name} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {/* Specialist Box with Image */}
                  <div
                    onClick={() => setSelectedSpecialty(selectedSpecialty === s.name ? null : s.name)}
                    style={{
                      ...S.card, padding: 0, cursor: "pointer", textAlign: "center",
                      border: selectedSpecialty === s.name ? `2px solid ${s.color}` : "1px solid var(--border)",
                      width: "100%", height: "180px", boxSizing: "border-box",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
                      overflow: "hidden", position: "relative"
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = "translateY(-8px) scale(1.02)";
                      e.currentTarget.style.boxShadow = `0 20px 40px -10px ${s.color}`;
                      e.currentTarget.style.borderColor = s.color;
                      e.currentTarget.style.borderWidth = "2px";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = "translateY(0) scale(1)";
                      e.currentTarget.style.boxShadow = selectedSpecialty === s.name ? `0 10px 28px -6px ${s.bg}` : "0 1px 3px rgba(0,0,0,0.04)";
                      e.currentTarget.style.borderColor = selectedSpecialty === s.name ? s.color : "var(--border)";
                      e.currentTarget.style.borderWidth = selectedSpecialty === s.name ? "2px" : "1px";
                    }}
                  >
                    {/* Image Container - Full Width and Height */}
                    <div style={{
                      width: "100%", height: "100%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      overflow: "hidden", position: "relative"
                    }}>
                      <img
                        src={SPECIALIST_IMAGES[s.name]}
                        alt={s.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          objectPosition: "center"
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  </div>

                  {/* Text Below the Box */}
                  <div style={{ width: "100%", textAlign: "center", marginTop: 10, paddingLeft: "4px", paddingRight: "4px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main)", lineHeight: 1.3, marginBottom: 4 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-sub)" }}>
                      {isLoading ? "—" : doctorsList.filter(d => d.spec === s.name).length} Doctors
                    </div>
                  </div>

                  {selectedSpecialty === s.name && (
                    <div
                      style={{
                        position: "absolute", top: "calc(100% + 10px)", left: "50%",
                        transform: "translateX(-50%)", width: "max-content", minWidth: 0, maxWidth: "100%",
                        background: "var(--bg-panel)", borderRadius: 14,
                        boxShadow: "0 10px 36px rgba(0,0,0,0.11)", border: "1px solid var(--border)",
                        zIndex: 100, padding: "14px", display: "flex", flexDirection: "column", gap: 8,
                        cursor: "default", animation: "slideUpFade 0.2s ease"
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isLoading ? (
                        <div style={{ fontSize: 13, color: "var(--text-sub)", textAlign: "center", padding: "10px 0" }}>Loading…</div>
                      ) : doctorsList.filter(d => d.spec === s.name).length > 0 ? (
                        doctorsList.filter(d => d.spec === s.name).map(doc => (
                          <div key={doc.id} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "10px 12px", borderRadius: 10,
                            background: "var(--bg-input)", border: "1px solid var(--border)",
                            transition: "all 0.2s ease", gap: 14
                          }}
                            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-panel)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-input)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                              <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible", position: "relative" }}>
                                {doc.image && getDoctorImageUrl(doc.image) ? (
                                  <img src={getDoctorImageUrl(doc.image)} alt={doc.displayName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                                ) : (
                                  <StethoscopeIcon size={14} color="var(--accent)" />
                                )}
                                <span style={doctorStatusDotStyle(doc.avail === "Available", 10)} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.displayName}</div>
                                <div style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 1 }}>
                                  {doc.rating > 0 ? `★ ${doc.rating} · ${doc.reviews} reviews` : "★ New Provider"}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-main)", fontWeight: 700, marginTop: 2 }}>
                                  {formatDoctorFee(doc.fee)}
                                </div>
                              </div>
                            </div>
                            <button
                              disabled={doc.avail !== "Available"}
                              onClick={() => doc.avail === "Available" && onStartBooking(doc.id, doc.displayName, doc.spec, doc.fee, doc.unavailablePeriods)}
                              style={{
                                flexShrink: 0, whiteSpace: "nowrap", padding: "6px 14px", borderRadius: 8,
                                background: doc.avail === "Available" ? "var(--accent-soft)" : "var(--bg-input)",
                                color: doc.avail === "Available" ? "var(--accent)" : "var(--text-sub)",
                                border: "none", fontSize: 12, fontWeight: 600,
                                cursor: doc.avail === "Available" ? "pointer" : "not-allowed",
                                transition: "all 0.2s ease", opacity: doc.avail === "Available" ? 1 : 0.55
                              }}
                            >
                              {doc.avail === "Available" ? "Book" : "Unavailable"}
                            </button>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 13, color: "var(--text-sub)", textAlign: "center", padding: "10px 0" }}>
                          No doctors available for {s.name}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Top Rated / Search Results */}
      <div style={{ ...S.sectionTitle, marginBottom: 16 }}>
        <StethoscopeIcon size={14} color="var(--text-sub)" />
        {searchQuery ? `Results for "${searchQuery}"` : "Top Rated Doctors"}
      </div>

      <div className="grid-responsive-2">
        {isLoading ? (
          <div className="grid-empty" style={{ gridColumn: "span 2", padding: "32px", textAlign: "center", color: "var(--text-sub)", fontSize: 14 }}>
            Loading doctors…
          </div>
        ) : filteredDoctors.length > 0 ? (
          filteredDoctors.map((d) => (
            <div
              key={d.id}
              className="lift-card"
              style={{ ...S.card, padding: "18px", display: "flex", gap: 14, cursor: "pointer" }}
            >
              {/* Doctor Avatar */}
              <div style={{
                width: 60, height: 60, borderRadius: "50%", background: "var(--accent-soft)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, overflow: "visible", position: "relative"
              }}>
                {d.image && getDoctorImageUrl(d.image) ? (
                  <img src={getDoctorImageUrl(d.image)} alt={d.displayName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                ) : (
                  d.icon
                )}
                <span style={doctorStatusDotStyle(d.avail === "Available", 16)} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)", marginBottom: 2, letterSpacing: "-0.01em" }}>{d.displayName}</div>
                <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 500, marginBottom: 8 }}>{d.spec}</div>
                <div style={{ fontSize: 12, color: "var(--text-main)", fontWeight: 700, marginBottom: 8 }}>{formatDoctorFee(d.fee)}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "var(--gold, #C4922A)", fontWeight: 600 }}>
                    {d.rating > 0 ? `★ ${d.rating}` : "★ New"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-sub)" }}>
                    ({d.reviews === 0 ? "No reviews" : `${d.reviews} reviews`})
                  </span>
                  <span style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                    background: d.avail === "Available" ? "rgba(12,122,62,0.10)" : "rgba(158,98,12,0.10)",
                    color: d.avail === "Available" ? "var(--success)" : "var(--warning)"
                  }}>{d.avail}</span>
                </div>
                <button
                  disabled={d.avail !== "Available"}
                  onClick={() => d.avail === "Available" && onStartBooking(d.id, d.displayName, d.spec, d.fee, d.unavailablePeriods)}
                  style={{
                    marginTop: 10, padding: "6px 16px", borderRadius: 20,
                    background: d.avail === "Available" ? "var(--accent)" : "var(--bg-input)",
                    color: d.avail === "Available" ? "#fff" : "var(--text-sub)",
                    border: "none", fontSize: 12, fontWeight: 600,
                    cursor: d.avail === "Available" ? "pointer" : "not-allowed",
                    opacity: d.avail === "Available" ? 1 : 0.6, transition: "opacity 0.2s"
                  }}
                >
                  {d.avail === "Available" ? "Book Appointment" : "Unavailable"}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="grid-empty" style={{ gridColumn: "span 2", padding: "32px", textAlign: "center", color: "var(--text-sub)", fontSize: 14 }}>
            No doctors match your search.
          </div>
        )}
      </div>
    </div>
  );
}

function AppointmentsPage({ onJoinCall, searchQuery }: { onJoinCall: (appointment: any) => void, searchQuery: string }) {
  const [appointments, setAppointments] = useState<any[]>([]);

  const [ratingModal, setRatingModal] = useState<{ open: boolean; appointmentId: string | null; doctorName: string }>({ open: false, appointmentId: null, doctorName: "" });
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const parseAppointmentStart = (date: string, time: string) => new Date(`${date} ${time}`);

  const renderDoctorAvatar = (appointment: any) => {
    const doctorImageUrl = getDoctorImageUrl(appointment.doctorImage);
    return (
      <div style={{
        width: 46, height: 46, borderRadius: "50%", background: "var(--accent-soft)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "visible", flexShrink: 0, position: "relative"
      }}>
        {doctorImageUrl ? (
          <img src={doctorImageUrl} alt={appointment.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
        ) : (
          appointment.icon
        )}
        <span style={doctorStatusDotStyle(Boolean(appointment.doctorAvailable), 13)} />
      </div>
    );
  };

  const fetchAppointments = () => {
    API.get('/appointments/patient')
      .then(res => {
        const paidAppointments = res.data.filter((a: any) => a.paymentStatus === 'paid');
        const formatted = paidAppointments.map((a: any) => {
          const startsAt = parseAppointmentStart(a.date, a.time);
          return {
            id: a._id,
            name: doctorDisplayName(a.doctorName),
            spec: a.specialization || a.type || "Video Consultation",
            date: a.date,
            time: a.time,
            status: a.status || a.paymentStatus || 'confirmed',
            rating: a.rating,
            review: a.review || "",
            notes: a.notes || "",
            prescription: a.prescription || [],
            paymentStatus: a.paymentStatus,
            doctorImage: a.doctorImage,
            doctorPhone: a.doctorPhone,
            doctorEmail: a.doctorEmail,
            doctorAvailable: Boolean(a.doctorAvailable),
            startsAt,
            icon: <StethoscopeIcon size={22} color="var(--accent)" />
          };
        });
        setAppointments(formatted);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  useEffect(() => {
    const userInfoRaw = sessionStorage.getItem("userInfo") || localStorage.getItem("userInfo");
    const userInfo = userInfoRaw ? JSON.parse(userInfoRaw) : null;
    const userId = userInfo?._id || userInfo?.id || null;
    if (!userId) return;

    const socket = io(getBackendOrigin(), { auth: { userId } });
    socket.on("appointments:updated", () => { fetchAppointments(); });
    socket.on("doctors:updated", () => { fetchAppointments(); });
    return () => { socket.disconnect(); };
  }, []);

  const submitRatingHandler = async () => {
    if (!ratingModal.appointmentId) return;
    setIsSubmittingRating(true);

    try {
      await API.post(`/appointments/${ratingModal.appointmentId}/rating`, {
        rating: ratingValue,
        review: reviewText
      });

      alert("Thank you! Your rating has been saved and added to the doctor's profile.");
      setRatingModal({ open: false, appointmentId: null, doctorName: "" });
      fetchAppointments();
    } catch (err: any) {
      console.error("Failed to submit rating", err);
      alert("Failed to submit rating. Please try again.");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const filteredAppointments = useMemo(() => {
    const now = Date.now();
    const upcoming = appointments.filter((a) => a.status !== "completed" && (!a.startsAt || a.startsAt.getTime() >= now));
    if (!searchQuery) return upcoming;
    const q = searchQuery.toLowerCase();
    return upcoming.filter(a => a.name.toLowerCase().includes(q) || a.spec.toLowerCase().includes(q));
  }, [appointments, searchQuery]);

  const filteredPast = useMemo(() => {
    const now = Date.now();
    const past = appointments.filter((a) => a.status === "completed" || (a.startsAt && a.startsAt.getTime() < now));
    const shapedPast = past.map((a) => ({
      id: a.id, name: a.name, spec: a.spec, date: a.date, time: a.time,
      rating: a.rating, doctorImage: a.doctorImage, icon: a.icon
    }));
    if (!searchQuery) return shapedPast;
    const q = searchQuery.toLowerCase();
    return shapedPast.filter(a => a.name.toLowerCase().includes(q) || a.spec.toLowerCase().includes(q));
  }, [appointments, searchQuery]);

  return (
    <div>
      <div style={S.pageTitle}>My Appointments</div>
      <div style={S.pageSub}>Manage your upcoming and past consultations</div>

      {/* Upcoming */}
      <div style={{ ...S.sectionTitle, marginBottom: 14 }}>
        <CalIcon /> Upcoming
      </div>

      {filteredAppointments.length === 0 && (
        <div style={{
          padding: "28px", textAlign: "center", color: "var(--text-sub)",
          background: "var(--bg-panel)", borderRadius: 14, border: "1px solid var(--border)",
          fontSize: 14, marginBottom: 32
        }}>
          {searchQuery ? "No matching upcoming appointments." : "No appointments yet. Head to the Dashboard to find a doctor."}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        {filteredAppointments.map((a) => (
          <div key={a.id} className="appointment-card" style={{
            ...S.card, padding: "16px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between"
          }}>
            <div className="appointment-card-main" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {renderDoctorAvatar(a)}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.01em" }}>{a.name}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3 }}>
                  <span style={{ fontSize: 12, color: "var(--text-sub)" }}>{a.spec}</span>
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(12,122,62,0.1)", color: "var(--success)", fontWeight: 700, letterSpacing: "0.04em" }}>CONFIRMED</span>
                </div>
              </div>
            </div>

            <div className="appointment-card-actions" style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)" }}>{a.date}</div>
                <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginTop: 2 }}>{a.time}</div>
              </div>
              {(() => {
                const now = Date.now();
                const cannotJoin = a.startsAt ? a.startsAt.getTime() > now : false;
                const buttonLabel = cannotJoin ? `At ${a.time}` : 'Join';
                return (
                  <button
                    style={{
                      ...S.primaryBtn, padding: "7px 16px",
                      opacity: cannotJoin ? 0.45 : 1,
                      cursor: cannotJoin ? 'not-allowed' : 'pointer'
                    }}
                    onClick={() => { if (!cannotJoin) onJoinCall(a); }}
                    disabled={cannotJoin}
                  >
                    <VideoIcon color="#fff" /> {buttonLabel}
                  </button>
                );
              })()}
            </div>
          </div>
        ))}
      </div>

      {/* Past */}
      <div style={{ ...S.sectionTitle, marginBottom: 14 }}>
        <CheckCircleIcon /> Past Consultations
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filteredPast.length === 0 && (
          <div style={{ padding: "28px", textAlign: "center", color: "var(--text-sub)", background: "var(--bg-panel)", borderRadius: 14, border: "1px solid var(--border)", fontSize: 14 }}>
            No past consultations found.
          </div>
        )}
        {filteredPast.map((a) => (
          <div key={a.id} className="appointment-card" style={{
            ...S.card, padding: "16px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between"
          }}>
            <div className="appointment-card-main" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {renderDoctorAvatar(a)}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.01em" }}>{a.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 3 }}>{a.spec}</div>
              </div>
            </div>

            <div className="appointment-card-actions" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)" }}>{a.date}</div>
                <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 2 }}>{a.time}</div>
              </div>

              {a.rating ? (
                <div style={{ fontSize: 13, color: "var(--gold, #C4922A)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, padding: "7px 12px" }}>
                  ★ {a.rating}/5
                </div>
              ) : (
                <button
                  onClick={() => {
                    setRatingModal({ open: true, appointmentId: a.id, doctorName: a.name });
                    setRatingValue(5);
                    setReviewText("");
                  }}
                  style={{
                    padding: "6px 14px", borderRadius: 9, background: "transparent",
                    color: "var(--gold, #C4922A)", border: "1px solid var(--gold, #C4922A)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5, transition: "all 0.2s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(196,146,42,0.09)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  ★ Rate
                </button>
              )}

              <button style={{
                padding: "6px 14px", borderRadius: 9, background: "var(--bg-input)",
                color: "var(--success)", border: "1px solid var(--border)",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5
              }}>
                <CheckCircleIcon /> Done
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Rating Modal */}
      <Modal open={ratingModal.open} onClose={() => setRatingModal({ open: false, appointmentId: null, doctorName: "" })} title="Rate Consultation" subtitle={`Share your experience with ${ratingModal.doctorName}`}>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '24px', marginTop: '10px' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              onClick={() => setRatingValue(star)}
              style={{ cursor: 'pointer', fontSize: '34px', color: star <= ratingValue ? 'var(--gold, #C4922A)' : 'var(--border)', transition: "color 0.15s" }}
            >★</span>
          ))}
        </div>

        <FormGroup label="Write a Review (Optional)">
          <textarea
            style={{ ...inputStyle, resize: "vertical" }}
            rows={3}
            placeholder="How was your experience?"
            value={reviewText}
            onChange={e => setReviewText(e.target.value)}
          />
        </FormGroup>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 22 }}>
          <button
            style={{ padding: "9px 20px", borderRadius: 10, background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            onClick={() => setRatingModal({ open: false, appointmentId: null, doctorName: "" })}
          >Cancel</button>
          <button
            style={{ ...S.primaryBtn, padding: "9px 22px", opacity: isSubmittingRating ? 0.6 : 1 }}
            className="primary-btn-hover"
            onClick={submitRatingHandler}
            disabled={isSubmittingRating}
          >
            {isSubmittingRating ? "Submitting…" : "Submit Rating"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function RecordsPage({ searchQuery }: { searchQuery: string }) {
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: "", isError: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", doctor: "", date: "", type: "lab" as RecordItem["type"], notes: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const showToast = (msg: string, isError = false) => {
    setToast({ show: true, msg, isError });
    setTimeout(() => setToast({ show: false, msg: "", isError: false }), 3000);
  };

  const fetchRecords = async () => {
    try {
      const { data } = await API.get('/records');

      console.log('Fetched records from API:', data);

      const formattedRecords = data.map((r: any) => {
        const meta = TYPE_META[r.type] || TYPE_META["lab"];
        return {
          id: r._id, prescriptionId: r.prescriptionId, name: r.name, doctor: r.doctor, specialization: r.specialization || "", date: r.date, generatedAt: r.createdAt, type: r.type,
          notes: r.notes, fileUrl: r.fileUrl, icon: meta.icon, iconBg: meta.iconBg
        };
      });

      console.log('Formatted records:', formattedRecords);
      console.log('Prescription records found:', formattedRecords.filter((r: any) => r.type === 'prescription'));

      setRecords(formattedRecords);
    } catch (err) {
      console.error("Failed to fetch records", err);
      showToast("Could not load medical records.", true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();

    const prefetchCriticalData = async () => {
      try {
        await API.get('/auth/user/profile');
        await API.get('/doctors');
        console.log('Critical data prefetched');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Backend prefetch skipped';
        console.info('Background data prefetch skipped:', message);
      }
    };

    setTimeout(prefetchCriticalData, 2000);
  }, []);

  useEffect(() => {
    const userInfoRaw = sessionStorage.getItem("userInfo") || localStorage.getItem("userInfo");
    const userInfo = userInfoRaw ? JSON.parse(userInfoRaw) : null;
    const userId = userInfo?._id || userInfo?.id || null;
    if (!userId) return;

    const socket = io(getBackendOrigin(), { auth: { userId } });
    socket.on("records:updated", fetchRecords);
    return () => { socket.disconnect(); };
  }, []);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.doctor.trim()) {
      return showToast("Name and Doctor are required.", true);
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('doctor', form.doctor);
      formData.append('type', form.type);
      formData.append('notes', form.notes);

      const dateStr = form.date
        ? new Date(form.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      formData.append('date', dateStr);

      if (selectedFile) {
        formData.append('document', selectedFile);
      }

      const { data } = await API.post('/records', formData);

      const meta = TYPE_META[data.type] || TYPE_META["lab"];
      const newRecord = {
        id: data._id, name: data.name, doctor: data.doctor, date: data.date, type: data.type,
        notes: data.notes, fileUrl: data.fileUrl, icon: meta.icon, iconBg: meta.iconBg
      };

      setRecords(prev => [newRecord, ...prev]);
      setModalOpen(false);
      setForm({ name: "", doctor: "", date: "", type: "lab", notes: "" });
      setSelectedFile(null);
      showToast("Record securely added!");

    } catch (err: any) {
      console.error("Upload error", err);
      const msg = err?.response?.data?.message || "Failed to upload record.";
      showToast(typeof msg === "string" ? msg : "Failed to upload record.", true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleView = async (fileUrl?: string) => {
    if (!fileUrl) return showToast("No document attached to this record.", true);
    try {
      console.log('Attempting to view file:', fileUrl);
      const res = await API.get(fileUrl, { responseType: 'blob' });
      console.log('File response received:', res.status);
      const blobUrl = URL.createObjectURL(res.data);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
    } catch (error: any) {
      console.error("View file error:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Could not open document.";
      showToast(errorMessage, true);
    }
  };

  const handleDownload = async (fileUrl?: string, fileName?: string) => {
    if (!fileUrl) return showToast("No document available to download.", true);

    try {
      console.log('Attempting to download file:', fileUrl);
      const res = await API.get(`${fileUrl}?download=1`, { responseType: 'blob' });
      console.log('Download response received:', res.status);
      const blob = res.data;
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const displayName = fileName ? `${fileName.replace(/\s+/g, '_')}_Document` : "Medical_Record";
      link.download = displayName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      showToast("Download started!");
    } catch (error: any) {
      console.error("Download failed", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to download file.";
      showToast(errorMessage, true);
    }
  };

  const filteredRecords = useMemo(() => {
    if (!searchQuery) return records;
    const q = searchQuery.toLowerCase();
    return records.filter((r: any) =>
      r.name.toLowerCase().includes(q) ||
      r.doctor.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  return (
    <div style={{ position: "relative" }}>

      {/* Header Row */}
      <div className="stackable-row" style={{ marginBottom: 28 }}>
        <div>
          <div style={S.pageTitle}>Medical Records</div>
          <div style={{ ...S.pageSub, marginBottom: 0 }}>Your health history and documents</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--bg-input)", border: "1px solid var(--border)",
            borderRadius: 9, padding: "7px 14px", fontSize: 13,
            color: "var(--text-sub)", fontWeight: 500
          }}>
            <FolderIcon /> {isLoading ? "—" : filteredRecords.length} Records
          </div>
          <button
            style={{ ...S.outlineBtn, padding: "9px 16px" }}
            onClick={() => fetchRecords()}
            disabled={isLoading}
            title="Refresh"
          >↻ Refresh</button>
          <button style={S.primaryBtn} className="primary-btn-hover" onClick={() => setModalOpen(true)}>
            <PlusIcon /> Add Record
          </button>
        </div>
      </div>

      {/* Records Grid */}
      <div className="grid-responsive-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} style={{ ...S.card, padding: 18, display: "flex", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--bg-input)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: '65%', height: 14, background: 'var(--bg-input)', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ width: '45%', height: 11, background: 'var(--bg-input)', borderRadius: 4, marginBottom: 6 }} />
                <div style={{ width: '35%', height: 11, background: 'var(--bg-input)', borderRadius: 4 }} />
              </div>
            </div>
          ))
        ) : filteredRecords.length === 0 ? (
          <div className="grid-empty" style={{
            gridColumn: "span 2", padding: "32px", textAlign: "center",
            color: "var(--text-sub)", fontSize: 14, lineHeight: 1.6
          }}>
            {searchQuery ? "No records match your search." : (
              <div>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>No medical records yet.</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Prescriptions from your doctor will appear here automatically.<br />
                  You can also upload your own documents using "Add Record".
                </div>
              </div>
            )}
          </div>
        ) : (
          filteredRecords.map((r) => {
            const meta = TYPE_META[r.type] || TYPE_META["lab"];
            const isPrescription = r.type === 'prescription';

            return (
              <div key={r.id} className="lift-card" style={{
                ...S.card, padding: 18, display: "flex", gap: 12,
                border: isPrescription ? "1.5px solid #16A34A" : "1px solid var(--border)",
                backgroundColor: isPrescription ? "rgba(220, 252, 231, 0.06)" : "var(--bg-panel)"
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: r.iconBg, color: meta.color,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  border: isPrescription ? "1.5px solid #16A34A" : "none"
                }}>{r.icon}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: "var(--text-main)", marginBottom: 2,
                    display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap"
                  }}>
                    {r.name}
                    {isPrescription && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#16A34A", color: "#fff", letterSpacing: "0.05em" }}>
                        PRESCRIPTION
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-sub)" }}>
                    {r.doctor}{r.specialization ? ` · ${r.specialization}` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 2, opacity: 0.7 }}>
                    Consultation: {r.date}
                    {isPrescription && r.generatedAt ? ` · Generated: ${formatNotificationDate(r.generatedAt)}` : ""}
                  </div>
                  <span style={{
                    display: "inline-block", marginTop: 7, fontSize: 10, fontWeight: 700,
                    padding: "2px 8px", borderRadius: 5, letterSpacing: "0.05em",
                    background: meta.bg, color: meta.color
                  }}>{meta.label}</span>
                  {r.notes && (
                    <div style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 5, fontStyle: "italic", opacity: 0.75, lineHeight: 1.4 }}>
                      {r.notes.length > 100 ? `${r.notes.substring(0, 100)}…` : r.notes}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flexShrink: 0 }}>
                  <button
                    style={{
                      ...S.iconBtn, opacity: r.fileUrl ? 1 : 0.28,
                      cursor: r.fileUrl ? "pointer" : "not-allowed",
                      background: isPrescription && r.fileUrl ? "#16A34A" : "transparent",
                      color: isPrescription && r.fileUrl ? "#fff" : "var(--text-sub)"
                    }}
                    onClick={() => void handleView(r.fileUrl)}
                    title={r.fileUrl ? "View Document" : "No document attached"}
                  >
                    <EyeIcon />
                  </button>
                  <button
                    style={{
                      ...S.iconBtn, opacity: r.fileUrl ? 1 : 0.28,
                      cursor: r.fileUrl ? "pointer" : "not-allowed",
                      background: isPrescription && r.fileUrl ? "#16A34A" : "transparent",
                      color: isPrescription && r.fileUrl ? "#fff" : "var(--text-sub)"
                    }}
                    onClick={() => void handleDownload(r.fileUrl, r.name)}
                    title={r.fileUrl ? "Download" : "No document attached"}
                  >
                    <DownloadIcon />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Record Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Medical Record" subtitle="Upload or log a new health document">
        <FormGroup label="Record Name">
          <input style={inputStyle} placeholder="e.g. Blood Sugar Report" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </FormGroup>

        <FormGroup label="Upload Document (optional)">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              style={{ ...inputStyle, padding: "7px", cursor: "pointer" }}
              onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)}
            />
            <span style={{ fontSize: 11, color: "var(--text-sub)" }}>PDF, JPEG, PNG, or WebP — max 10 MB. Stored privately.</span>
          </div>
        </FormGroup>

        <div className="modal-grid-2">
          <FormGroup label="Doctor / Lab Name">
            <input style={inputStyle} placeholder="e.g. Dr. Sharma" value={form.doctor} onChange={e => setForm(p => ({ ...p, doctor: e.target.value }))} />
          </FormGroup>
          <FormGroup label="Date">
            <ProfessionalDatePicker
              variant="patient"
              value={form.date}
              onChange={value => setForm(p => ({ ...p, date: value }))}
              placeholder="Select record date"
            />
          </FormGroup>
        </div>

        <FormGroup label="Record Type">
          <ProfessionalDropdown
            variant="patient"
            value={form.type}
            onChange={value => setForm(p => ({ ...p, type: value as RecordItem["type"] }))}
            options={[
              { value: "lab", label: "LAB" },
              { value: "diagnostic", label: "DIAGNOSTIC" },
              { value: "prescription", label: "PRESCRIPTION" },
            ]}
          />
        </FormGroup>

        <FormGroup label="Notes (optional)">
          <textarea style={{ ...inputStyle, resize: "vertical" }} rows={2} placeholder="Any additional notes…" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
        </FormGroup>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 22 }}>
          <button style={{ padding: "9px 20px", borderRadius: 10, background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border)", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={() => setModalOpen(false)}>Cancel</button>
          <button
            style={{ ...S.primaryBtn, padding: "9px 22px", opacity: isSubmitting ? 0.6 : 1 }}
            className="primary-btn-hover"
            onClick={handleAdd}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Uploading…" : "Add Record"}
          </button>
        </div>
      </Modal>

      {/* Toast */}
      <div style={{
        position: "fixed", bottom: 24, right: 24,
        background: toast.isError ? "var(--danger)" : "var(--success)",
        color: "#fff", padding: "11px 18px", borderRadius: 11, fontSize: 13,
        fontWeight: 600, display: "flex", alignItems: "center", gap: 8, zIndex: 600,
        opacity: toast.show ? 1 : 0, transition: "opacity 0.3s", pointerEvents: "none"
      }}>
        {toast.isError ? <span style={{ fontSize: 15 }}>⚠</span> : <CheckCircleIcon />}
        {toast.msg}
      </div>
    </div>
  );
}

function SettingsPage({ profile, setProfile, onProfileSave, isMobile }: { profile: Profile; setProfile: (p: Profile) => void; onProfileSave: (p: Profile) => void; isMobile: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Profile>({ ...profile });
  const [notifs, setNotifs] = useState({ reminders: true, tips: true, lab: false });
  const [toast, setToast] = useState({ show: false, msg: "" });
  const [privacy, setPrivacy] = useState({ twofa: profile.isTwoFactorEnabled || false, sharing: true });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: "" }), 2500);
  };

  const openEdit = () => { setForm({ ...profile }); setEditOpen(true); };

  const saveProfile = async () => {
    try {
      await API.put('/auth/user/profile', form);
      setProfile({ ...form });
      onProfileSave({ ...form });
      setEditOpen(false);
      showToast("Profile updated successfully!");
    } catch (error) {
      console.error("Failed to save to database:", error);
      showToast("Failed to save. Check your connection.");
    }
  };

  const handleToggle2FA = async (checked: boolean) => {
    setPrivacy(p => ({ ...p, twofa: checked }));

    try {
      const userInfo = JSON.parse(sessionStorage.getItem("userInfo") || "{}");
      await API.put('/auth/user/profile', { isTwoFactorEnabled: checked }, { headers: { Authorization: `Bearer ${userInfo.token}` } });

      const updatedUserInfo = { ...userInfo, isTwoFactorEnabled: checked };
      sessionStorage.setItem("userInfo", JSON.stringify(updatedUserInfo));

      const updatedProfile = { ...profile, isTwoFactorEnabled: checked };
      setProfile(updatedProfile);
      onProfileSave(updatedProfile);
      showToast(checked ? "2FA Security Enabled" : "2FA Security Disabled");
    } catch (error) {
      console.error("Failed to update 2FA settings", error);
      setPrivacy(p => ({ ...p, twofa: !checked }));
      showToast("Failed to update settings.");
    }
  };

  const handleUploadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (fileInputRef.current) { fileInputRef.current.click(); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('photo', file);

      try {
        setIsUploading(true);
        const { data } = await API.put('/auth/user/update-photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

        setForm(prev => ({ ...prev, image: data.image }));
        const updatedProfile = { ...profile, image: data.image };
        setProfile(updatedProfile);
        onProfileSave(updatedProfile);
        showToast("Profile photo updated!");
      } catch (err: any) {
        showToast(err.response?.data?.message || "Upload failed. Image must be under 2MB.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <div style={{
      fontSize: 11, fontWeight: 600, color: "var(--text-sub)", letterSpacing: "0.1em",
      textTransform: "uppercase", marginBottom: 12
    }}>{label}</div>
  );

  const SettingsRow = ({ label, sub, right }: { label: string; sub?: string; right: React.ReactNode }) => (
    <div style={{
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "flex-start" : "center",
      justifyContent: "space-between",
      gap: isMobile ? 10 : 0,
      padding: "14px 20px",
      borderBottom: "1px solid var(--border)"
    }}>
      <div style={{ minWidth: 0, width: isMobile ? "100%" : "auto" }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-main)" }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ alignSelf: isMobile ? "stretch" : "center", marginLeft: isMobile ? 0 : 12, display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end" }}>
        {right}
      </div>
    </div>
  );

  return (
    <div style={{ position: "relative", maxWidth: 720 }}>
      <div style={S.pageTitle}>Settings</div>
      <div style={S.pageSub}>Manage your account and preferences</div>

      {/* Profile Card */}
      <div style={{ ...S.card, padding: "18px 20px", display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", gap: 16, marginBottom: 28 }}>
        <div style={{
          width: 54, height: 54, borderRadius: 14, background: "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 20, fontWeight: 700, flexShrink: 0, overflow: "hidden"
        }}>
          {profile.image && profile.image !== '/images/default-avatar.png' ? (
            <img src={getImageUrl(profile.image)} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            profile.name.charAt(0).toUpperCase()
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.01em" }}>{profile.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 2 }}>{profile.email}</div>
          <span style={{
            display: "inline-block", marginTop: 6, padding: "2px 10px", borderRadius: 20,
            fontSize: 11, fontWeight: 600, background: "var(--accent-soft)", color: "var(--accent)"
          }}>Patient</span>
        </div>
        <button style={{ ...S.outlineBtn, padding: "8px 18px", width: isMobile ? "100%" : "auto", justifyContent: "center", alignSelf: isMobile ? "stretch" : "center" }} onClick={openEdit}>Edit Profile</button>
      </div>

      {/* Notifications */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel label="Notifications" />
        <div style={{ ...S.card, overflow: "hidden" }}>
          <SettingsRow label="Appointment Reminders" sub="Get notified before appointments" right={<Toggle checked={notifs.reminders} onChange={v => setNotifs(p => ({ ...p, reminders: v }))} />} />
          <SettingsRow label="Health Tips" sub="Weekly wellness tips & insights" right={<Toggle checked={notifs.tips} onChange={v => setNotifs(p => ({ ...p, tips: v }))} />} />
          <div className="settings-inline-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-main)" }}>Lab Results</div>
              <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 2 }}>Alert when results are ready</div>
            </div>
            <Toggle checked={notifs.lab} onChange={v => setNotifs(p => ({ ...p, lab: v }))} />
          </div>
        </div>
      </div>

      {/* Privacy */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel label="Privacy & Security" />
        <div style={{ ...S.card, overflow: "hidden" }}>
          <SettingsRow label="Two-Factor Authentication" sub="Add extra security to your account" right={<Toggle checked={privacy.twofa} onChange={handleToggle2FA} />} />
          <div className="settings-inline-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-main)" }}>Data Sharing</div>
              <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 2 }}>Share anonymized data for research</div>
            </div>
            <Toggle checked={privacy.sharing} onChange={v => setPrivacy(p => ({ ...p, sharing: v }))} />
          </div>
        </div>
      </div>

      {/* Health Profile */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel label="Health Profile" />
        <div style={{ ...S.card, overflow: "hidden" }}>
          <SettingsRow label="Blood Group" sub={profile.blood} right={<button onClick={openEdit} style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Edit</button>} />
          <SettingsRow label="Allergies" sub={profile.allergies} right={<button onClick={openEdit} style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Edit</button>} />
          <div className="settings-inline-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-main)" }}>Emergency Contact</div>
              <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 2 }}>{profile.emergency}</div>
            </div>
            <button onClick={openEdit} style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Edit</button>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile" subtitle="Update your personal and health information">
        <div>
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/jpeg, image/png" onChange={handleFileChange} />
          <button
            onClick={handleUploadClick}
            disabled={isUploading}
            style={{ padding: "7px 16px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-sub)", fontSize: 12, fontWeight: 600, cursor: isUploading ? "wait" : "pointer" }}
          >
            {isUploading ? 'Uploading…' : 'Change Photo'}
          </button>
          <div style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 4 }}>JPG or PNG, max 2MB</div>
        </div>

        <div className="modal-grid-2">
          <FormGroup label="Name">
            <input style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </FormGroup>
          <FormGroup label="Email">
            <input style={inputStyle} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </FormGroup>
        </div>
        <div className="modal-grid-2">
          <FormGroup label="Phone">
            <input style={inputStyle} placeholder="+91 00000 00000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </FormGroup>
          <FormGroup label="Date of Birth">
            <ProfessionalDatePicker
              variant="patient"
              value={form.dob}
              onChange={value => setForm(p => ({ ...p, dob: value }))}
              placeholder="Select date of birth"
            />
          </FormGroup>
        </div>
        <div className="modal-grid-2">
          <FormGroup label="Gender">
            <ProfessionalDropdown
              variant="patient"
              value={form.gender}
              onChange={value => setForm(p => ({ ...p, gender: value }))}
              options={["Male", "Female", "Other", "Prefer not to say"].map(g => ({ value: g, label: g }))}
            />
          </FormGroup>
          <FormGroup label="Blood Group">
            <ProfessionalDropdown
              variant="patient"
              value={form.blood}
              onChange={value => setForm(p => ({ ...p, blood: value }))}
              options={["None", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(b => ({ value: b, label: b }))}
            />
          </FormGroup>
        </div>
        <FormGroup label="Allergies (comma separated)">
          <input style={inputStyle} value={form.allergies} onChange={e => setForm(p => ({ ...p, allergies: e.target.value }))} />
        </FormGroup>
        <FormGroup label="Emergency Contact">
          <input style={inputStyle} value={form.emergency} onChange={e => setForm(p => ({ ...p, emergency: e.target.value }))} />
        </FormGroup>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 22 }}>
          <button style={{ padding: "9px 20px", borderRadius: 10, background: "var(--bg-input)", color: "var(--text-sub)", border: "1px solid var(--border)", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={() => setEditOpen(false)}>Cancel</button>
          <button style={{ ...S.primaryBtn, padding: "9px 22px" }} className="primary-btn-hover" onClick={saveProfile}>Save Changes</button>
        </div>
      </Modal>

      <Toast msg={toast.msg} show={toast.show} />
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export function PatientDashboard() {
  const [page, setPage] = useState("dashboard");
  const [activeCall, setActiveCall] = useState<any>(null);
  const [patientSocket, setPatientSocket] = useState<Socket | null>(null);
  const [patientUserId, setPatientUserId] = useState("");
  const [bookingDoctor, setBookingDoctor] = useState<{ id: string, name: string, specialization?: string, fee?: number, unavailablePeriods?: UnavailablePeriod[] } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | "glass">("light");
  const [searchQuery, setSearchQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
const recognitionRef = useRef<any>(null);

const handleMicClick = () => {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Voice search is not supported in your browser. Please use Chrome.");
    return;
  }

  if (isListening) {
    recognitionRef.current?.stop();
    setIsListening(false);
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    setSearchQuery(transcript);
  };

  recognition.onend = () => setIsListening(false);
  recognition.onerror = () => setIsListening(false);

  recognitionRef.current = recognition;
  recognition.start();
  setIsListening(true);
};

  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const [profile, setProfile] = useState<Profile>({
    name: "Loading...", email: "", phone: "", dob: "", gender: "Male",
    blood: "None", allergies: "None", emergency: "",
    image: "/images/default-avatar.png", isTwoFactorEnabled: false
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "glass";
    if (savedTheme) setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data } = await API.get('/auth/user/profile');
        setProfile({
          name: data.name || "Patient", email: data.email || "", phone: data.phone || "",
          dob: data.dob || "", gender: data.gender || "Male", blood: data.blood || "None",
          allergies: data.allergies || "None", emergency: data.emergency || "",
          image: data.image || "", isTwoFactorEnabled: data.isTwoFactorEnabled || false
        });
      } catch (error) {
        console.error("Fetch failed", error);
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    const userInfoRaw = sessionStorage.getItem("userInfo") || localStorage.getItem("userInfo");
    const userInfo = userInfoRaw ? JSON.parse(userInfoRaw) : null;
    const userId = userInfo?._id || userInfo?.id || null;
    if (!userId) return;

    const socket = io(getBackendOrigin(), { auth: { userId } });
    setPatientUserId(String(userId));
    setPatientSocket(socket);

    socket.on("appointments:updated", (payload: any = {}) => {
      const isConfirmed =
        payload?.status === "confirmed" ||
        payload?.reason === "payment-verified";

      if (!isConfirmed) return;

      const doctorName = doctorDisplayName(payload?.doctorName);
      const specialist = payload?.specialization || "Specialist";
      const scheduledFor = formatNotificationDate(payload?.date, payload?.time);
      const notificationId = `appointment-${payload?.appointmentId || Date.now()}`;

      setNotifications(prev => [{
        id: notificationId,
        title: "Appointment Confirmed",
        desc: `Confirmed for ${scheduledFor} with ${doctorName}, ${specialist}.`,
        time: "Just now",
        read: false,
        type: "appointment"
      }, ...prev.filter(n => n.id !== notificationId)]);
    });

    socket.on("records:updated", (payload: any = {}) => {
      const isPrescription =
        payload?.type === "prescription" ||
        payload?.reason === "prescription-file-uploaded" ||
        payload?.reason === "consultation-record-created";

      if (!isPrescription || payload?.reason === "record-deleted") return;

      const doctorName = doctorDisplayName(payload?.doctor);
      const dateText = formatNotificationDate(payload?.date);
      const canDownload = Boolean(payload?.fileUrl);
      const notificationId = `record-${payload?.recordId || Date.now()}`;

      setNotifications(prev => [{
        id: notificationId,
        title: "Prescription Available",
        desc: canDownload
          ? `Your prescription from ${doctorName} for ${dateText} is available. You can download it now.`
          : `Your prescription from ${doctorName} for ${dateText} has been added to your records.`,
        time: "Just now",
        read: false,
        type: "record",
        fileUrl: payload?.fileUrl,
        fileName: payload?.title || "Prescription",
        actionLabel: canDownload ? "Download now" : "Open records"
      }, ...prev.filter(n => n.id !== notificationId)]);
    });

    return () => { socket.disconnect(); };
  }, []);

  const navItems = [
    { id: "dashboard", Icon: GridIcon, tooltip: "Dashboard" },
    { id: "appointments", Icon: CalIcon, tooltip: "Appointments" },
    { id: "records", Icon: FileIcon, tooltip: "Records" },
    { id: "settings", Icon: GearIcon, tooltip: "Settings" },
  ];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  })();

  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = '/';
  };

  const toggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : prev === "dark" ? "glass" : "light");
  };

  const handleBellClick = () => {
    setIsNotifOpen(!isNotifOpen);
    if (!isNotifOpen) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleNotificationAction = async (notification: any) => {
    if (!notification?.fileUrl) {
      setPage("records");
      setIsNotifOpen(false);
      return;
    }

    try {
      const res = await API.get(`${notification.fileUrl}?download=1`, { responseType: "blob" });
      const downloadUrl = window.URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${String(notification.fileName || "Prescription").replace(/\s+/g, "_")}_Document`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Notification download failed", error);
      setPage("records");
      setIsNotifOpen(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const notificationDropdownStyle: React.CSSProperties = {
    position: isMobile ? "fixed" : "absolute",
    top: isMobile ? 74 : 50,
    right: isMobile ? 12 : 16,
    left: isMobile ? 12 : "auto",
    width: isMobile ? "auto" : "min(340px, calc(100vw - 24px))",
    maxWidth: isMobile ? "calc(100vw - 24px)" : 340,
    maxHeight: isMobile ? "calc(100vh - 96px)" : undefined,
    background:
      theme === "dark"
        ? "rgba(13,19,32,0.92)"
        : theme === "glass"
          ? "rgba(255,255,255,0.28)"
          : "rgba(255,255,255,0.92)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    borderRadius: "16px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.13)",
    border: "1px solid var(--border)",
    zIndex: 1201,
    overflow: "hidden",
    animation: "dropFade 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
  };

  const sidebarStyle: React.CSSProperties = isMobile
    ? {
      ...S.sidebar,
      position: "fixed",
      top: 0,
      left: 0,
      height: "100dvh",
      width: "min(78vw, 260px)",
      padding: "16px 0",
      background: "#0E1724",
      zIndex: 1300,
      boxShadow: "4px 0 24px rgba(0,0,0,0.18)",
      transform: sidebarOpen ? "translateX(0)" : "translateX(-105%)",
      transition: "transform 0.24s ease",
      pointerEvents: sidebarOpen ? "auto" : "none",
    }
    : S.sidebar;

  return (
    <>
      <style>{themeCSS}</style>

      <div
        style={S.app}
        className={`patient-dashboard ${theme === "dark" ? "dark-theme" : theme === "glass" ? "glass-theme" : ""}`}
      >
        {activeCall && patientSocket && (
          <VideoCallRoom
            appointment={activeCall}
            socket={patientSocket}
            userName={profile.name}
            onEndCall={() => setActiveCall(null)}
          />
        )}

        {!activeCall && patientSocket && patientUserId && (
          <IncomingCallModal
            socket={patientSocket}
            localUserId={patientUserId}
            localUserName={profile.name || "Patient"}
          />
        )}

        {bookingDoctor && (
          <BookingModal
            doctor={bookingDoctor}
            onClose={() => setBookingDoctor(null)}
            onSuccess={() => { setBookingDoctor(null); setPage("appointments"); }}
          />
        )}

        {/* Mobile Overlay */}
        {(!isMobile || true) && (
          <>
            {isMobile && sidebarOpen && (
              <div
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.28)', zIndex: 1200 }}
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* ─── Sidebar ─────────────────────────────────────────────── */}
            <div style={sidebarStyle} className={`dashboard-sidebar ${isMobile && sidebarOpen ? 'open' : ''}`}>
              <div style={S.sideTop} className="sidebar-button-row">
                {/* Logo */}
                <button className="sidebar-logo" style={{
                  ...S.logoBt,
                  background: 'transparent', boxShadow: 'none', width: 48, height: 48
                }}>
                  <img
                    src={MEDIMEET_LOGO_SRC}
                    alt="MediMeet Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.35)' }}
                  />
                </button>

                {/* Nav Items */}
                {navItems.map(({ id, Icon: Ic, tooltip }) => (
                  <button
                    key={id}
                    style={S.navBt(page === id)}
                    onClick={() => { setPage(id); if (isMobile) setSidebarOpen(false); }}
                    title={tooltip}
                    data-id={id}
                    className={`nav-btn-item${page === id ? " active" : ""}${id === "settings" ? " settings-spin-btn" : ""}`}
                  >
                    <Ic />
                    <span className="sidebar-label">{tooltip}</span>
                  </button>
                ))}
              </div>

              <div style={S.sideBot} className="sidebar-actions">
                {/* Theme Toggle */}
                <button
                  className="sidebar-action-btn"
                  style={S.logoutBt}
                  title={`Current Theme: ${theme}. Click to switch.`}
                  onClick={toggleTheme}
                >
                  {theme === "light" ? <MoonIcon /> : theme === "dark" ? <SunIcon /> : <MonitorIcon />}
                  <span className="sidebar-action-label">Theme</span>
                </button>
                {/* Logout */}
                <button className="sidebar-action-btn" style={S.logoutBt} title="Logout" onClick={handleLogout}>
                  <LogoutIcon />
                  <span className="sidebar-action-label">Logout</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ─── Main ────────────────────────────────────────────────────── */}
        <div style={S.main} className="dashboard-main">

          {/* Header */}
          <div style={S.header} className="dashboard-header">
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(v => !v)}
                  style={{ ...S.iconBtn, flexShrink: 0, padding: 8, borderRadius: 9, background: "var(--bg-input)", border: "1px solid var(--border)", position: "relative", zIndex: 1200 }}
                  title="Menu"
                  aria-label="Open navigation menu"
                  aria-expanded={sidebarOpen}
                >
                  <MenuIcon />
                </button>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "var(--text-sub)", letterSpacing: "0.04em" }}>Welcome back</div>
                <div style={{
                  fontSize: 17, fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.02em",
                  fontFamily: "'Fraunces', Georgia, serif"
                }}>
                  {greeting}, {profile.name.split(' ')[0]}
                </div>
              </div>
            </div>

            {/* Search */}
            <div style={S.searchBar} className="dashboard-search-bar">
              <SearchIcon />
              <input
                style={S.searchInput}
                placeholder={
                  page === "appointments" ? "Search appointments…" :
                    page === "records" ? "Search medical records…" :
                      "Search doctors, specialties…"
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
  onClick={handleMicClick}
  title={isListening ? "Stop listening" : "Voice search"}
  style={{
    background: "none", border: "none", cursor: "pointer",
    padding: 0, display: "flex", alignItems: "center",
    animation: isListening ? "pulse 1s infinite" : "none"
  }}
>
  <MicIcon color={isListening ? "var(--accent)" : "var(--text-sub, #aab8b5)"} />
</button>           </div>

            {/* Right Actions */}
            <div style={S.headerRight} className="dashboard-header-right" ref={notifRef}>
              {/* Bell */}
              <button style={S.notifBt} onClick={handleBellClick}>
                <BellIcon />
                {unreadCount > 0 && (
                  <div style={{
                    ...S.notifDot, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "8px", color: "white", width: "14px", height: "14px", top: "-4px", right: "-4px"
                  }}>
                    {unreadCount}
                  </div>
                )}
              </button>

              {/* Notification Dropdown */}
              {isNotifOpen && (
                <div style={notificationDropdownStyle}>
                  <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>Notifications</div>
                    <button onClick={() => setNotifications([])} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Clear all</button>
                  </div>
                  <div style={{ maxHeight: "340px", overflowY: "auto" }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: "28px", textAlign: "center", color: "var(--text-sub)", fontSize: 13 }}>
                        No new notifications
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} style={{
                          padding: "13px 18px", borderBottom: "1px solid var(--border)",
                          display: "flex", gap: "11px",
                          background: n.read ? "transparent" : "var(--bg-input)", transition: "background 0.2s"
                        }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                            background: n.type === "appointment" ? "#EEF2FF" : n.type === "record" ? "#F0FDF4" : "#FEF3C7",
                            color: n.type === "appointment" ? "#6366F1" : n.type === "record" ? "#16A34A" : "#D97706",
                            display: "flex", alignItems: "center", justifyContent: "center"
                          }}>
                            {n.type === "appointment" ? <CalIcon /> : n.type === "record" ? <FolderIcon /> : <BellIcon />}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)", marginBottom: 2 }}>{n.title}</div>
                            <div style={{ fontSize: 12, color: "var(--text-sub)", lineHeight: 1.4 }}>{n.desc}</div>
                            <div style={{ fontSize: 10, color: "var(--text-sub)", marginTop: 5, fontWeight: 600 }}>{n.time}</div>
                            {n.actionLabel && (
                              <button
                                type="button"
                                onClick={() => void handleNotificationAction(n)}
                                style={{
                                  marginTop: 8,
                                  padding: "5px 8px",
                                  borderRadius: 7,
                                  border: "1px solid var(--border)",
                                  background: "var(--accent)",
                                  color: "#fff",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer"
                                }}
                              >
                                {n.actionLabel}
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ padding: "11px", textAlign: "center", borderTop: "1px solid var(--border)" }}>
                    <button style={{ fontSize: 12, color: "var(--text-sub)", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
                      Notification Settings
                    </button>
                  </div>
                </div>
              )}

              {/* Avatar */}
              <div style={S.avatar(36)} onClick={() => setPage("settings")} title="Settings">
                {profile.image && profile.image !== '/images/default-avatar.png' ? (
                  <img src={getImageUrl(profile.image)} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  profile.name.charAt(0).toUpperCase()
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div id="dashboard-scroll-area" style={S.content} className="dashboard-content dash-content-scroll">
            {page === "dashboard" && <DashboardPage searchQuery={searchQuery} onStartBooking={(id: string, name: string, specialization?: string, fee?: number, unavailablePeriods?: UnavailablePeriod[]) => setBookingDoctor({ id, name, specialization, fee, unavailablePeriods })} />}
            {page === "appointments" && <AppointmentsPage searchQuery={searchQuery} onJoinCall={(appointment) => setActiveCall(appointment)} />}
            {page === "records" && <RecordsPage searchQuery={searchQuery} />}
            {page === "settings" && <SettingsPage profile={profile} setProfile={setProfile} onProfileSave={(p) => setProfile(p)} isMobile={isMobile} />}

            {page === "dashboard" && <AISymptomChecker profile={profile} />}

            <footer className="py-6 text-center text-slate-600 text-xs mt-auto">
  <div className="flex justify-center gap-4 mb-2">
    <a href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy Policy</a>
    <a href="/terms" className="hover:text-cyan-400 transition-colors">Terms of Service</a>
  </div>
  <p>&copy; {new Date().getFullYear()} Medi Meet. All rights reserved.</p>
  <p className="text-xs text-gray-500 mt-1">Designed and developed by Team Medi Meet with ˗ˏˋ❤️ˎˊ˗</p>
</footer>
          </div>
        </div>
      </div>
    </>
  );
}
