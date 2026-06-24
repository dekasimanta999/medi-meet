import { useState } from "react";
import { Link } from "react-router"; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Mail, ArrowLeft, KeyRound, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { PasswordStrengthIndicator } from "../components/ui/PasswordStrengthIndicator";
import API, { getBackendOrigin } from "../../api/axios";
import { MEDIMEET_LOGO_SRC } from "../constants/assets";

export function ForgotPassword() {
  // Step Management: 1 = Send OTP, 2 = Verify OTP & Reset Password, 3 = Success
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form States
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Step 1: Request OTP from Backend
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email) return setError("Please enter your email address.");

    try {
      setLoading(true);
      const { data } = await API.post('/auth/forgotpassword', { email });
      
      setMessage(data.message || "An OTP has been sent to your email.");
      setStep(2); 
      
    } catch (err: any) {
      setError(err.response?.data?.message || "Could not find an account with that email.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Step 2: Verify OTP and Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      return setError("Passwords do not match.");
    }

    try {
      setLoading(true);
      const { data } = await API.post('/auth/resetpassword', { 
        email, 
        otp, 
        newPassword 
      });

      setMessage(data.message || "Password reset successful!");
      setStep(3); 
      
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid or expired OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-8 font-sans">
      
      {/* Brand Header */}
      <Link to="/" className="mb-8 flex flex-col items-center group transition-transform hover:scale-105">
        <img 
          src={MEDIMEET_LOGO_SRC} 
          alt="MediMeet Logo" 
          className="w-30 h-30 object-contain drop-shadow-sm mb-3" 
        />
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">MediMeet</h1>
      </Link>

      <div className="w-full max-w-md">
        <Card className="border border-slate-200 shadow-xl shadow-slate-200/40 rounded-2xl bg-white overflow-hidden">
          <CardHeader className="space-y-2 pb-6 pt-8 px-8">
            <CardTitle className="text-2xl font-bold text-slate-900 text-center tracking-tight">
              {step === 1 && "Reset your password"}
              {step === 2 && "Create new password"}
              {step === 3 && "All done!"}
            </CardTitle>
            <CardDescription className="text-center text-slate-500 text-base">
              {step === 1 && "Enter your email and we'll send you a 6-digit reset code."}
              {step === 2 && (
                <>
                  We sent a code to <span className="font-medium text-slate-900">{email}</span>
                </>
              )}
              {step === 3 && "Your password has been successfully updated."}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-8 pb-8">
            
            {/* Status Messages */}
            {message && step !== 3 && (
              <div className="mb-6 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm text-center font-medium">
                {message}
              </div>
            )}
            {error && (
              <div className="mb-6 p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-sm text-center font-medium">
                {error}
              </div>
            )}

            {/* STEP 1 FORM: Ask for Email */}
            {step === 1 && (
              <form onSubmit={handleRequestOTP} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      className="pl-10 h-11 border-slate-200 focus-visible:ring-blue-600 rounded-lg text-base"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm shadow-blue-600/20 transition-all"
                >
                  {loading ? "Sending code..." : "Send reset code"}
                </Button>
              </form>
            )}

            {/* STEP 2 FORM: Enter OTP and New Password */}
            {step === 2 && (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-slate-700 font-medium">6-Digit Code</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <Input
                      id="otp"
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      className="pl-10 h-11 tracking-[0.2em] font-mono text-center border-slate-200 focus-visible:ring-blue-600 rounded-lg text-lg"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-slate-700 font-medium">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 h-11 border-slate-200 focus-visible:ring-blue-600 rounded-lg text-base"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <div className="pt-1">
                    <PasswordStrengthIndicator password={newPassword} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-slate-700 font-medium">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 h-11 border-slate-200 focus-visible:ring-blue-600 rounded-lg text-base"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm shadow-blue-600/20 transition-all mt-2"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            )}

            {/* STEP 3: Success Screen */}
            {step === 3 && (
              <div className="text-center space-y-6 py-4">
                <div className="flex justify-center">
                  <div className="bg-emerald-100 p-4 rounded-full">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                  </div>
                </div>
                <Button className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-all asChild">
                  <Link to="/">Return to login</Link>
                </Button>
              </div>
            )}

            {/* Back to Login Link (Hidden on success step) */}
            {step !== 3 && (
              <div className="mt-8 text-center">
                <Link 
                  to="/" 
                  className="inline-flex items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to log in
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
