import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  UserCircle,
  Stethoscope,
  Mail,
  Lock,
  BadgeCheck,
  Eye,
  EyeOff,
  KeyRound,
  CalendarCheck,
  UsersRound,
  CheckCircle2,
} from "lucide-react";
import API from "../../api/axios";
import { MEDIMEET_LOGO_SRC } from "../constants/assets";

export function LoginPage() {
  const navigate = useNavigate();

  // Doctor States
  const [doctorEmail, setDoctorEmail] = useState("");
  const [doctorPassword, setDoctorPassword] = useState("");
  const [doctorOtp, setDoctorOtp] = useState("");
  const [doctorStep, setDoctorStep] = useState<1 | 2>(1);
  const [doctorAuthMode, setDoctorAuthMode] = useState<"login" | "forgot">("login");
  const [doctorResetStep, setDoctorResetStep] = useState<1 | 2 | 3 | 4>(1);
  const [doctorResetOtp, setDoctorResetOtp] = useState("");
  const [doctorNewPassword, setDoctorNewPassword] = useState("");
  const [doctorConfirmPassword, setDoctorConfirmPassword] = useState("");
  const [showDoctorPassword, setShowDoctorPassword] = useState(false);
  const [showDoctorNewPassword, setShowDoctorNewPassword] = useState(false);
  const [showDoctorConfirmPassword, setShowDoctorConfirmPassword] = useState(false);

  // Patient States
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPassword, setPatientPassword] = useState("");
  const [patientOtp, setPatientOtp] = useState("");
  const [patientStep, setPatientStep] = useState<1 | 2>(1);
  const [showPatientPassword, setShowPatientPassword] = useState(false);

  // Remember Me & Global States
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setPatientEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Doctor Login Step 1: Credentials
  const handleDoctorLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);
      const normalizedEmail = doctorEmail.trim().toLowerCase();
      const normalizedPassword = doctorPassword;

      await API.post("/auth/doctor/login", {
        email: normalizedEmail,
        password: normalizedPassword,
      });

      setDoctorStep(2);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message || "Invalid Email or password.");
    } finally {
      setLoading(false);
    }
  };

  // Doctor Login Step 2: Verify OTP
  const handleVerifyDoctorOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);
      const normalizedEmail = doctorEmail.trim().toLowerCase();
      const normalizedOtp = doctorOtp.trim();

      const { data } = await API.post("/auth/doctor/verify-otp", {
        email: normalizedEmail,
        otp: normalizedOtp,
      });

      sessionStorage.setItem("userInfo", JSON.stringify(data));
      sessionStorage.setItem("userType", "doctor");
      navigate("/doctor-dashboard");
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  const startDoctorForgotPassword = () => {
    setError("");
    setSuccess("");
    setDoctorAuthMode("forgot");
    setDoctorResetStep(1);
    setDoctorResetOtp("");
    setDoctorNewPassword("");
    setDoctorConfirmPassword("");
  };

  const backToDoctorLogin = () => {
    setError("");
    setSuccess("");
    setDoctorAuthMode("login");
    setDoctorStep(1);
    setDoctorResetStep(1);
    setDoctorResetOtp("");
    setDoctorNewPassword("");
    setDoctorConfirmPassword("");
  };

  const handleDoctorForgotPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      setLoading(true);
      const normalizedEmail = doctorEmail.trim().toLowerCase();
      const { data } = await API.post("/auth/doctor/forgot-password", {
        email: normalizedEmail,
      });

      setSuccess(data.message || "Password reset OTP sent to your registered email.");
      setDoctorResetStep(2);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message || "Could not send reset OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDoctorResetOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      setLoading(true);
      const normalizedEmail = doctorEmail.trim().toLowerCase();
      const normalizedOtp = doctorResetOtp.trim();

      const { data } = await API.post("/auth/doctor/verify-reset-otp", {
        email: normalizedEmail,
        otp: normalizedOtp,
      });

      setSuccess(data.message || "OTP verified. Set a new password.");
      setDoctorResetStep(3);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetDoctorPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (doctorNewPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    if (doctorNewPassword !== doctorConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const normalizedEmail = doctorEmail.trim().toLowerCase();
      const normalizedOtp = doctorResetOtp.trim();

      const { data } = await API.post("/auth/doctor/reset-password", {
        email: normalizedEmail,
        otp: normalizedOtp,
        newPassword: doctorNewPassword,
      });

      setDoctorPassword("");
      setDoctorOtp("");
      setDoctorResetStep(4);
      setSuccess(data.message || "Password updated successfully. Please sign in with your new password.");
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message || "Could not update password.");
    } finally {
      setLoading(false);
    }
  };

  // Patient/Admin Login: Credentials only. Patient OTP removed.
  const handlePatientLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!patientEmail || !patientPassword) return;

    try {
      setLoading(true);
      const normalizedEmail = patientEmail.trim().toLowerCase();
      const normalizedPassword = patientPassword;

      const { data } = await API.post("/auth/login", {
        email: normalizedEmail,
        password: normalizedPassword,
      });

      if (data.mfaRequired) {
        setPatientStep(2);
        return;
      }

      sessionStorage.setItem("userInfo", JSON.stringify(data));
      sessionStorage.setItem("userType", data.type || data.userType || "patient");

      if (rememberMe) {
        localStorage.setItem("rememberedEmail", patientEmail);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      if (data.isAdmin || data.type === "admin" || data.userType === "admin") {
        navigate("/admin/dashboard");
      } else if (data.type === "doctor" || data.userType === "doctor") {
        navigate("/doctor-dashboard");
      } else {
        navigate("/patient-dashboard");
      }
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPatientOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);
      const normalizedEmail = patientEmail.trim().toLowerCase();
      const normalizedOtp = patientOtp.trim();

      const { data } = await API.post("/auth/login/verify-otp", {
        email: normalizedEmail,
        otp: normalizedOtp,
      });

      sessionStorage.setItem("userInfo", JSON.stringify(data));
      sessionStorage.setItem("userType", data.type || data.userType || "patient");

      if (rememberMe) {
        localStorage.setItem("rememberedEmail", patientEmail);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      if (data.isAdmin || data.type === "admin" || data.userType === "admin") {
        navigate("/admin/dashboard");
      } else if (data.type === "doctor" || data.userType === "doctor") {
        navigate("/doctor-dashboard");
      } else {
        navigate("/patient-dashboard");
      }
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-stretch justify-center p-4">
      <div className="w-full max-w-6xl min-h-[calc(100vh-2rem)] grid md:grid-cols-2 grid-cols-1 gap-8 items-stretch">
        {/* Left side - Branding */}
        <div className="hidden md:block space-y-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-1">
              <img
                src={MEDIMEET_LOGO_SRC}
                alt="MediMeet Logo"
                className="w-32 h-32 object-contain drop-shadow-md"
              />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">MediMeet</h1>
              <p className="text-gray-600">Your Trusted Medical Partner</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">
              Welcome to Online Doctor Consultation
            </h2>
            <p className="text-gray-600 text-lg">
              Connect with healthcare professionals from the comfort of your home.
            </p>
          </div>

          <div className="relative rounded-2xl overflow-hidden shadow-2xl">
            <img
              src="/images/login/login page photo.jpeg"
              alt="Healthcare"
              className="w-full h-80 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/50 to-transparent" />
          </div>

          <div className="grid grid-cols-3 gap-6 pt-6">
            <div className="flex items-start justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <CalendarCheck className="w-5 h-5 text-blue-600" />
              </div>

              <div className="leading-tight">
                <div className="font-bold text-blue-600">Easy</div>
                <div className="text-sm text-gray-600">Appointment</div>
              </div>
            </div>

            <div className="flex items-start justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <BadgeCheck className="w-5 h-5 text-blue-600" />
              </div>

              <div className="leading-tight">
                <div className="font-bold text-blue-600">Verified</div>
                <div className="text-sm text-gray-600">Doctors</div>
              </div>
            </div>

            <div className="flex items-start justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <UsersRound className="w-5 h-5 text-blue-600" />
              </div>

              <div className="leading-tight">
                <div className="font-bold text-blue-600">10K+</div>
                <div className="text-sm text-gray-600">Patients</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Login Forms */}
        <div className="w-full max-w-md mx-auto h-full min-h-full flex flex-col justify-between md:pt-[88px]">
          <Card className="border-0 shadow-2xl">
            <CardHeader className="space-y-1 pb-4 text-center">
              <CardTitle className="text-2xl">Sign In</CardTitle>
              <CardDescription>Choose your account type to continue</CardDescription>
            </CardHeader>

            <CardContent>
              {error && (
                <div className="mb-4 p-3 rounded bg-red-100 border border-red-400 text-red-700 text-sm text-center">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 p-3 rounded bg-green-100 border border-green-400 text-green-700 text-sm text-center">
                  {success}
                </div>
              )}

              <Tabs defaultValue="patient" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="patient" className="flex items-center gap-2">
                    <UserCircle className="w-4 h-4" />
                    Patient
                  </TabsTrigger>
                  <TabsTrigger value="doctor" className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4" />
                    Doctor
                  </TabsTrigger>
                </TabsList>

                {/* Patient Login */}
                <TabsContent value="patient">
                  {patientStep === 1 ? (
                    <form onSubmit={handlePatientLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="patient-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id="patient-email"
                            type="email"
                            placeholder="patient@gmail.com"
                            className="pl-10"
                            value={patientEmail}
                            onChange={(e) => setPatientEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="patient-password">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id="patient-password"
                            type={showPatientPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="pl-10 pr-10"
                            value={patientPassword}
                            onChange={(e) => setPatientPassword(e.target.value)}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPatientPassword(!showPatientPassword)}
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                            aria-label={showPatientPassword ? "Hide patient password" : "Show patient password"}
                          >
                            {showPatientPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                          />
                          Remember me
                        </label>
                        <Link
                          to="/forgot-password"
                          title="reset password"
                          className="text-blue-600 hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </div>

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {loading ? "Signing in..." : "Sign In as Patient"}
                      </Button>

                      <p className="text-center text-sm text-gray-600">
                        Don&apos;t have an account?{" "}
                        <Link to="/register" className="text-blue-600 hover:underline font-medium">
                          Sign up
                        </Link>
                      </p>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyPatientOtp} className="space-y-4">
                      <div className="space-y-2 text-center">
                        <KeyRound className="w-10 h-10 text-blue-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          Enter the 6-digit code sent to your email.
                        </p>
                      </div>

                      <Input
                        type="text"
                        maxLength={6}
                        placeholder="123456"
                        className="text-center tracking-widest text-lg"
                        value={patientOtp}
                        onChange={(e) => setPatientOtp(e.target.value)}
                        required
                      />

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {loading ? "Logging in..." : "Verify & Access Dashboard"}
                      </Button>

                      <button
                        type="button"
                        onClick={() => setPatientStep(1)}
                        className="w-full text-xs text-gray-500 hover:underline"
                      >
                        Back to credentials
                      </button>
                    </form>
                  )}
                </TabsContent>

                {/* Doctor Login */}
                <TabsContent value="doctor">
                  {doctorStep === 1 ? (
                    <form onSubmit={handleDoctorLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="doctor-id">Doctor Email</Label>
                        <div className="relative">
                          <BadgeCheck className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id="doctor-id"
                            type="email"
                            placeholder="doctor@gmail.com"
                            className="pl-10"
                            value={doctorEmail}
                            onChange={(e) => setDoctorEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="doctor-password">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id="doctor-password"
                            type={showDoctorPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="pl-10 pr-10"
                            value={doctorPassword}
                            onChange={(e) => setDoctorPassword(e.target.value)}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowDoctorPassword(!showDoctorPassword)}
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                            aria-label={showDoctorPassword ? "Hide doctor password" : "Show doctor password"}
                          >
                            {showDoctorPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        {loading ? "Verifying..." : "Sign In & Send OTP"}
                      </Button>

                      <button
                        type="button"
                        onClick={startDoctorForgotPassword}
                        className="w-full text-sm text-green-700 hover:underline"
                      >
                        Forgot password?
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyDoctorOtp} className="space-y-4">
                      <div className="space-y-2 text-center">
                        <KeyRound className="w-10 h-10 text-green-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          Enter the 6-digit code sent to your email.
                        </p>
                      </div>

                      <Input
                        type="text"
                        maxLength={6}
                        placeholder="123456"
                        className="text-center tracking-widest text-lg"
                        value={doctorOtp}
                        onChange={(e) => setDoctorOtp(e.target.value)}
                        required
                      />

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        {loading ? "Logging in..." : "Verify & Access Dashboard"}
                      </Button>

                      <button
                        type="button"
                        onClick={() => setDoctorStep(1)}
                        className="w-full text-xs text-gray-500 hover:underline"
                      >
                        Back to credentials
                      </button>
                    </form>
                  )}

                  <p className="text-center text-sm text-gray-600 mt-4">
                    Want to join?{" "}
                    <Link to="/apply-doctor" className="text-blue-600 hover:underline font-medium">
                      Apply as Doctor
                    </Link>
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {doctorAuthMode === "forgot" && (
            <div
              className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4"
              role="dialog"
              aria-modal="true"
            >
              <Card className="w-full max-w-md border-0 shadow-2xl">
                <CardHeader className="space-y-1 pb-4 text-center">
                  <img
                    src="/favicon.png"
                    alt="MediMeet"
                    className="mx-auto mb-3 h-30 w-30 object-contain"
                  />
                  <CardTitle className="text-2xl">
                    {doctorResetStep === 1 && "Doctor password reset"}
                    {doctorResetStep === 2 && "Verify reset OTP"}
                    {doctorResetStep === 3 && "Update password"}
                    {doctorResetStep === 4 && "Password updated"}
                  </CardTitle>
                  <CardDescription>
                    {doctorResetStep === 1 && "Enter your registered doctor email to receive an OTP."}
                    {doctorResetStep === 2 && `We sent a 6-digit OTP to ${doctorEmail.trim().toLowerCase()}.`}
                    {doctorResetStep === 3 && "Set a new password for your doctor account."}
                    {doctorResetStep === 4 && "You can now sign in with your new password."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {error && (
                    <div className="mb-4 rounded bg-red-100 border border-red-400 p-3 text-center text-sm text-red-700">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="mb-4 rounded bg-green-100 border border-green-400 p-3 text-center text-sm text-green-700">
                      {success}
                    </div>
                  )}

                  {doctorResetStep === 1 && (
                    <form onSubmit={handleDoctorForgotPassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="doctor-reset-email">Doctor Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id="doctor-reset-email"
                            type="email"
                            placeholder="doctor@gmail.com"
                            className="pl-10"
                            value={doctorEmail}
                            onChange={(e) => setDoctorEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <Button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
                        {loading ? "Sending OTP..." : "Send Reset OTP"}
                      </Button>
                    </form>
                  )}

                  {doctorResetStep === 2 && (
                    <form onSubmit={handleVerifyDoctorResetOtp} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="doctor-reset-otp">6-Digit OTP</Label>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id="doctor-reset-otp"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="123456"
                            className="pl-10 text-center tracking-widest text-lg"
                            value={doctorResetOtp}
                            onChange={(e) => setDoctorResetOtp(e.target.value.replace(/\D/g, ""))}
                            required
                          />
                        </div>
                      </div>
                      <Button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
                        {loading ? "Verifying..." : "Verify OTP"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setSuccess("");
                          setDoctorResetStep(1);
                        }}
                        className="w-full text-xs text-gray-500 hover:underline"
                      >
                        Change email
                      </button>
                    </form>
                  )}

                  {doctorResetStep === 3 && (
                    <form onSubmit={handleResetDoctorPassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="doctor-new-password">New Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id="doctor-new-password"
                            type={showDoctorNewPassword ? "text" : "password"}
                            placeholder="New password"
                            className="pl-10 pr-10"
                            value={doctorNewPassword}
                            onChange={(e) => setDoctorNewPassword(e.target.value)}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowDoctorNewPassword(!showDoctorNewPassword)}
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                            aria-label={showDoctorNewPassword ? "Hide new password" : "Show new password"}
                          >
                            {showDoctorNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="doctor-confirm-password">Confirm Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id="doctor-confirm-password"
                            type={showDoctorConfirmPassword ? "text" : "password"}
                            placeholder="Confirm password"
                            className="pl-10 pr-10"
                            value={doctorConfirmPassword}
                            onChange={(e) => setDoctorConfirmPassword(e.target.value)}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowDoctorConfirmPassword(!showDoctorConfirmPassword)}
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                            aria-label={showDoctorConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                          >
                            {showDoctorConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <Button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
                        {loading ? "Updating..." : "Update Password"}
                      </Button>
                    </form>
                  )}

                  {doctorResetStep === 4 && (
                    <div className="space-y-4 text-center">
                      <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
                      <Button type="button" onClick={backToDoctorLogin} className="w-full bg-green-600 hover:bg-green-700">
                        Back to Doctor Login
                      </Button>
                    </div>
                  )}

                  {doctorResetStep !== 4 && (
                    <button
                      type="button"
                      onClick={backToDoctorLogin}
                      className="mt-4 w-full text-xs text-gray-500 hover:underline"
                    >
                      Back to doctor login
                    </button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <footer className="pt-8 pb-1 text-center text-slate-600 text-xs mt-auto">
            <div className="flex justify-center gap-4 mb-2">
              <a href="/privacy" className="hover:text-cyan-400 transition-colors">
                Privacy Policy
              </a>
              <a href="/terms" className="hover:text-cyan-400 transition-colors">
                Terms of Service
              </a>
            </div>
            <p>&copy; {new Date().getFullYear()} Medi Meet. All rights reserved.</p>
            <p className="text-xs text-gray-500 mt-1">
              Designed and developed by Team Medi Meet with ˗ˏˋ❤️ˎˊ˗
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
