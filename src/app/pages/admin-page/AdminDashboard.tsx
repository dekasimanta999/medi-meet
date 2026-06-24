import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseMedical,
  CheckCircle,
  Clock,
  FileBadge,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Mail,
  Phone,
  RefreshCw,
  Save,
  ShieldAlert,
  Stethoscope,
  User,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router";
import { io } from "socket.io-client";
import API, { getBackendOrigin } from "../../../api/axios";

type AdminView = "approvals" | "fees";

interface PendingDoctor {
  _id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  licenseNumber: string;
  experience: number;
  qualifications?: string[];
  fee?: number;
  image?: string;
  createdAt: string;
}

interface ApprovedDoctor {
  _id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  licenseNumber: string;
  experience: number;
  qualifications?: string[];
  fee?: number;
  consultationFee?: number;
  image?: string;
  isAvailable?: boolean;
  averageRating?: number;
  updatedAt?: string;
}

const DEFAULT_CONSULTATION_FEE = 500;

const formatCurrency = (value?: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(normalizeFee(value));

const normalizeFee = (value?: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : DEFAULT_CONSULTATION_FEE;
};

const feeInputValue = (fee?: number, consultationFee?: number) =>
  String(normalizeFee(fee ?? consultationFee));

const doctorImageUrl = (image?: string) => {
  if (!image) return "/images/doctors/default-doc.jpg";
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith("/images/")) return image;
  return `${getBackendOrigin()}/${image.replace(/^\/+/, "")}`;
};

export function AdminDashboard() {
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState<AdminView>("approvals");
  const [pendingDoctors, setPendingDoctors] = useState<PendingDoctor[]>([]);
  const [approvedDoctors, setApprovedDoctors] = useState<ApprovedDoctor[]>([]);
  const [feeInputs, setFeeInputs] = useState<Record<string, string>>({});
  const [approvedFeeInputs, setApprovedFeeInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feeUpdateLoading, setFeeUpdateLoading] = useState<string | null>(null);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleLogout = () => {
    localStorage.removeItem("userInfo");
    localStorage.removeItem("token");
    sessionStorage.removeItem("userInfo");
    navigate("/");
  };

  const fetchPendingDoctors = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const { data } = await API.get("/doctors/admin/pending");
      const doctors = Array.isArray(data) ? data : [];
      setPendingDoctors(doctors);
      setFeeInputs(
        doctors.reduce((acc: Record<string, string>, doc: PendingDoctor) => {
          acc[doc._id] = feeInputValue(doc.fee);
          return acc;
        }, {})
      );
    } catch (error: any) {
      showMessage(error.response?.data?.message || "Failed to load pending applications.", "error");
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleLogout();
      }
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const fetchApprovedDoctors = async (showSpinner = true) => {
    try {
      if (showSpinner) setApprovedLoading(true);
      const { data } = await API.get("/doctors/admin/approved");
      const doctors = Array.isArray(data) ? data : [];
      setApprovedDoctors(doctors);
      setApprovedFeeInputs(
        doctors.reduce((acc: Record<string, string>, doc: ApprovedDoctor) => {
          acc[doc._id] = feeInputValue(doc.fee, doc.consultationFee);
          return acc;
        }, {})
      );
    } catch (error: any) {
      showMessage(error.response?.data?.message || "Failed to load approved doctors.", "error");
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleLogout();
      }
    } finally {
      if (showSpinner) setApprovedLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingDoctors();
  }, []);

  useEffect(() => {
    if (activeView === "fees") {
      fetchApprovedDoctors();
    }
  }, [activeView]);

  useEffect(() => {
    const socket = io(getBackendOrigin());

    const refreshPendingDoctors = () => {
      void fetchPendingDoctors(false);
    };
    const refreshApprovedDoctors = () => {
      void fetchApprovedDoctors(false);
    };
    const refreshAllDoctorAdminData = () => {
      void fetchPendingDoctors(false);
      void fetchApprovedDoctors(false);
    };

    socket.on("admin:doctor-applications-updated", refreshPendingDoctors);
    socket.on("admin:approved-doctors-updated", refreshApprovedDoctors);
    socket.on("doctors:updated", refreshAllDoctorAdminData);

    return () => {
      socket.off("admin:doctor-applications-updated", refreshPendingDoctors);
      socket.off("admin:approved-doctors-updated", refreshApprovedDoctors);
      socket.off("doctors:updated", refreshAllDoctorAdminData);
      socket.disconnect();
    };
  }, []);

  const filteredApprovedDoctors = useMemo(() => {
    const query = doctorSearch.trim().toLowerCase();
    if (!query) return approvedDoctors;

    return approvedDoctors.filter((doc) =>
      [doc.name, doc.email, doc.specialization, doc.licenseNumber]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [approvedDoctors, doctorSearch]);

  const handleApprove = async (id: string) => {
    const fee = Number(feeInputs[id]);
    if (!Number.isFinite(fee) || fee <= 0) {
      showMessage("Enter a valid consultation fee before approval.", "error");
      return;
    }

    try {
      setActionLoading(id);
      await API.post(`/doctors/admin/approve/${id}`, { fee: Math.round(fee) });
      showMessage("Doctor officially verified and activated!", "success");
      setPendingDoctors((prev) => prev.filter((doc) => doc._id !== id));
      setFeeInputs((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      void fetchApprovedDoctors(false);
    } catch (error: any) {
      showMessage(error.response?.data?.message || "Approval failed.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm("Are you sure you want to completely reject and delete this application?")) return;

    try {
      setActionLoading(id);
      await API.delete(`/doctors/admin/reject/${id}`);
      showMessage("Application securely rejected and removed.", "success");
      setPendingDoctors((prev) => prev.filter((doc) => doc._id !== id));
      setFeeInputs((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (error: any) {
      showMessage(error.response?.data?.message || "Rejection failed.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateFee = async (id: string) => {
    const fee = Number(approvedFeeInputs[id]);
    if (!Number.isFinite(fee) || fee <= 0) {
      showMessage("Enter a valid consultation fee.", "error");
      return;
    }

    try {
      setFeeUpdateLoading(id);
      const { data } = await API.patch(`/doctors/admin/approved/${id}/fee`, { fee: Math.round(fee) });
      setApprovedDoctors((prev) => prev.map((doc) => (doc._id === id ? data : doc)));
      setApprovedFeeInputs((prev) => ({
        ...prev,
        [id]: feeInputValue(data.fee, data.consultationFee),
      }));
      showMessage("Consultation fee updated everywhere.", "success");
    } catch (error: any) {
      showMessage(error.response?.data?.message || "Failed to update consultation fee.", "error");
    } finally {
      setFeeUpdateLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="fixed z-10 flex h-full w-64 flex-col bg-slate-900 text-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-800 p-6">
          <ShieldAlert className="h-8 w-8 text-indigo-400" />
          <h2 className="text-xl font-bold tracking-wider">
            MediMeet<span className="text-indigo-400">Admin</span>
          </h2>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          <button
            onClick={() => setActiveView("approvals")}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-medium transition-colors ${
              activeView === "approvals" ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            Provider Approvals
          </button>
          <button
            onClick={() => setActiveView("fees")}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-medium transition-colors ${
              activeView === "fees" ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <IndianRupee className="h-5 w-5" />
            Consultation Fees
          </button>
        </nav>

        <div className="border-t border-slate-800 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            Secure Sign Out
          </button>
        </div>
      </aside>

      <main className="ml-64 flex-1 overflow-y-auto p-8 md:p-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {activeView === "approvals" ? "Provider Approvals" : "Doctor Consultation Fees"}
              </h1>
              <p className="mt-2 text-lg text-slate-500">
                {activeView === "approvals"
                  ? "Review and verify new medical provider applications."
                  : "Manage the consultation fee for every approved doctor."}
              </p>
            </div>

            {activeView === "fees" && (
              <button
                onClick={fetchApprovedDoctors}
                disabled={approvedLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${approvedLoading ? "animate-spin" : ""}`} />
                Refresh List
              </button>
            )}
          </div>

          {message && (
            <div
              className={`mb-6 flex items-center gap-3 rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-4 ${
                message.type === "success"
                  ? "border border-green-200 bg-green-50 text-green-800"
                  : "border border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {message.type === "success" ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              <span className="font-bold">{message.text}</span>
            </div>
          )}

          {activeView === "approvals" ? (
            loading ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-32">
                <div className="h-12 w-12 animate-spin rounded-full border-b-4 border-indigo-600" />
                <p className="font-medium text-slate-500">Securely fetching applications...</p>
              </div>
            ) : pendingDoctors.length === 0 ? (
              <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-sm">
                <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-50">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">All Caught Up!</h3>
                <p className="mt-2 text-lg text-slate-500">
                  There are no pending doctor applications in the database at the moment.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {pendingDoctors.map((doc) => (
                  <div
                    key={doc._id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-lg"
                  >
                    <div className="p-6">
                      <div className="mb-6 flex items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-4">
                          <img
                            src={doctorImageUrl(doc.image)}
                            alt={doc.name}
                            className="h-16 w-16 flex-shrink-0 rounded-full border-2 border-indigo-100 bg-slate-50 object-cover shadow-sm"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/images/doctors/default-doc.jpg";
                            }}
                          />

                          <div className="min-w-0">
                            <h2 className="truncate text-xl font-bold text-slate-900">{doc.name}</h2>
                            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                              <BriefcaseMedical className="h-3.5 w-3.5" /> {doc.specialization}
                            </span>
                          </div>
                        </div>

                        <span className="flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-400">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="mb-8 grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail className="h-4 w-4 text-slate-400" />
                            <span className="truncate" title={doc.email}>
                              {doc.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="h-4 w-4 text-slate-400" /> {doc.phone}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <FileBadge className="h-4 w-4 text-slate-400" />
                            <span className="font-mono text-slate-900">{doc.licenseNumber}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <User className="h-4 w-4 text-slate-400" />
                            <span className="font-medium text-slate-900">{doc.experience} Yrs Exp</span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-8 rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                          <GraduationCap className="h-4 w-4 text-indigo-500" /> Qualifications
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(doc.qualifications || []).length > 0 ? (
                            doc.qualifications!.map((qualification) => (
                              <span
                                key={qualification}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                              >
                                {qualification}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-500">No qualifications provided.</span>
                          )}
                        </div>
                      </div>

                      <div className="mb-8 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                        <label
                          htmlFor={`fee-${doc._id}`}
                          className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900"
                        >
                          <IndianRupee className="h-4 w-4 text-emerald-600" /> Consultation Fee
                        </label>
                        <input
                          id={`fee-${doc._id}`}
                          type="number"
                          min="1"
                          step="1"
                          value={feeInputs[doc._id] ?? String(DEFAULT_CONSULTATION_FEE)}
                          onChange={(e) => setFeeInputs((prev) => ({ ...prev, [doc._id]: e.target.value }))}
                          className="w-full rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                        />
                      </div>

                      <div className="flex gap-3 border-t border-slate-100 pt-4">
                        <button
                          onClick={() => handleReject(doc._id)}
                          disabled={actionLoading === doc._id}
                          className="flex-1 rounded-xl border-2 border-red-100 px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
                        >
                          {actionLoading === doc._id ? "Processing..." : "Reject"}
                        </button>
                        <button
                          onClick={() => handleApprove(doc._id)}
                          disabled={actionLoading === doc._id}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
                        >
                          {actionLoading === doc._id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            "Verify & Activate"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wide text-slate-400">Approved doctors</p>
                    <h2 className="mt-1 text-2xl font-bold text-slate-900">{approvedDoctors.length} active profiles</h2>
                  </div>
                  <input
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    placeholder="Search by name, email, specialization, or license"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 lg:max-w-md"
                  />
                </div>
              </div>

              {approvedLoading ? (
                <div className="flex flex-col items-center justify-center space-y-4 py-24">
                  <div className="h-12 w-12 animate-spin rounded-full border-b-4 border-indigo-600" />
                  <p className="font-medium text-slate-500">Loading approved doctors...</p>
                </div>
              ) : filteredApprovedDoctors.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-sm">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50">
                    <Stethoscope className="h-10 w-10 text-slate-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">No Approved Doctors Found</h3>
                  <p className="mt-2 text-lg text-slate-500">
                    {doctorSearch ? "Try a different search term." : "Approved doctors will appear here after activation."}
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="divide-y divide-slate-100">
                    {filteredApprovedDoctors.map((doc) => {
                      const currentFee = normalizeFee(doc.fee ?? doc.consultationFee);
                      const inputValue = approvedFeeInputs[doc._id] ?? String(currentFee);
                      const hasChanged = Number(inputValue) !== currentFee;

                      return (
                        <div
                          key={doc._id}
                          className="grid grid-cols-1 gap-5 p-5 transition-colors hover:bg-slate-50 lg:grid-cols-[minmax(0,1fr)_220px_132px] lg:items-center"
                        >
                          <div className="flex min-w-0 gap-4">
                            <img
                              src={doctorImageUrl(doc.image)}
                              alt={doc.name}
                              className="h-14 w-14 flex-shrink-0 rounded-full border border-slate-200 bg-slate-50 object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/images/doctors/default-doc.jpg";
                              }}
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-lg font-bold text-slate-900">{doc.name}</h3>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                    doc.isAvailable ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                                  }`}
                                >
                                  {doc.isAvailable ? "Available" : "Unavailable"}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                                <span>{doc.specialization}</span>
                                <span>{doc.email}</span>
                                <span>Lic: {doc.licenseNumber}</span>
                              </div>
                              <div className="mt-2 text-sm font-bold text-slate-900">
                                Current fee: {formatCurrency(currentFee)}
                              </div>
                            </div>
                          </div>

                          <label className="block">
                            <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                              <IndianRupee className="h-3.5 w-3.5" /> Consultation Fee
                            </span>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={inputValue}
                              onChange={(e) =>
                                setApprovedFeeInputs((prev) => ({ ...prev, [doc._id]: e.target.value }))
                              }
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                            />
                          </label>

                          <button
                            onClick={() => handleUpdateFee(doc._id)}
                            disabled={feeUpdateLoading === doc._id || !hasChanged}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-100 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                          >
                            {feeUpdateLoading === doc._id ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            Save
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
