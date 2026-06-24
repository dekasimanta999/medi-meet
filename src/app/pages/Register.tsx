import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { UserCircle, Stethoscope, Mail, Lock, User, ShieldCheck, Eye, EyeOff, Camera, Calendar, Users } from "lucide-react";
import { PasswordStrengthIndicator } from "../components/ui/PasswordStrengthIndicator";
import { ProfessionalDropdown } from "../components/ui/ProfessionalDropdown";
import API, { getBackendOrigin } from "../../api/axios";
import { MEDIMEET_LOGO_SRC } from "../constants/assets";

export function RegisterPage() {
  const navigate = useNavigate();

  // Patient Registration States
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientPassword, setPatientPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // ✅ NEW: State for Profile Picture
  const [photo, setPhoto] = useState<File | null>(null);

  // States for Password Visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Backend Integration States
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePatientRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (patientPassword !== confirmPassword) {
      return setError("Passwords do not match. Please try again.");
    }

    try {
      setLoading(true);
      
      const normalizedEmail = patientEmail.trim().toLowerCase();
      
      // ✅ NEW: Use FormData to send the image and text data together
      const submitData = new FormData();
      submitData.append("name", patientName);
      submitData.append("email", normalizedEmail);
      submitData.append("gender", patientGender);
      submitData.append("age", patientAge);
      submitData.append("password", patientPassword);
      
      if (photo) {
        submitData.append("photo", photo);
      }

      const { data } = await API.post("/auth/register", submitData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      localStorage.setItem("userInfo", JSON.stringify(data));
      localStorage.setItem("userType", "patient");

      navigate("/");
      
    } catch (err: any) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        
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
              Join our Healthcare Network
            </h2>
            <p className="text-gray-600 text-lg">
              Create an account today to easily book appointments, track your medical history, and connect with top doctors.
            </p>
          </div>

          <div className="relative rounded-2xl overflow-hidden shadow-2xl mt-8">
            <img
              src="/images/signup/signup photo.jpeg"
              alt="Medical Team"
              className="w-full h-80 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/60 to-transparent flex items-end p-6">
              <div className="text-white">
                <p className="font-semibold text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-400" />
                  100% Secure & Private
                </p>
                <p className="text-sm opacity-80">Your health data is strictly confidential.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Registration Forms */}
        <div className="w-full max-w-md mx-auto">
          <Card className="border-0 shadow-2xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl text-center">Create an Account</CardTitle>
              <CardDescription className="text-center">
                Sign up to get started with MediMeet
              </CardDescription>
            </CardHeader>
            <CardContent>
              
              {error && (
                <div className="mb-4 p-3 rounded bg-red-100 border border-red-400 text-red-700 text-sm text-center">
                  {error}
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

                <TabsContent value="patient">
                  <form onSubmit={handlePatientRegister} className="space-y-4">
                    
                    {/* ✅ NEW: Profile Picture Upload */}
                    <div className="space-y-2 pb-2 border-b border-gray-100">
                      <Label htmlFor="photo" className="text-gray-600">Profile Picture (Optional)</Label>
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                          {photo ? (
                            <img src={URL.createObjectURL(photo)} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <Camera className="w-5 h-5 text-blue-400" />
                          )}
                        </div>
                        <Input 
                          id="photo" 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => setPhoto(e.target.files?.[0] || null)} 
                          className="flex-1 cursor-pointer bg-white text-sm" 
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <Label htmlFor="patient-name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="patient-name"
                          type="text"
                          placeholder="Xyz"
                          className="pl-10"
                          value={patientName}
                          onChange={(e) => setPatientName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="patient-gender">Gender</Label>
                        <div className="relative">
                          <ProfessionalDropdown
                            id="patient-gender"
                            value={patientGender}
                            onChange={setPatientGender}
                            placeholder="Select gender"
                            leftIcon={<Users className="h-4 w-4" />}
                            options={[
                              { value: "Male", label: "Male" },
                              { value: "Female", label: "Female" },
                              { value: "Other", label: "Other" },
                            ]}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="patient-age">Age</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id="patient-age"
                            type="number"
                            min="0"
                            max="120"
                            placeholder="Age"
                            className="pl-10"
                            value={patientAge}
                            onChange={(e) => setPatientAge(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="patient-email">Email Address</Label>
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
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-10 pr-10"
                          value={patientPassword}
                          onChange={(e) => setPatientPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <PasswordStrengthIndicator password={patientPassword} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-10 pr-10"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                          {showConfirmPassword ? (
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
                      className="w-full bg-blue-600 hover:bg-blue-700 mt-4 transition-all active:scale-[0.98]"
                    >
                      {loading ? "Creating Account..." : "Sign Up as Patient"}
                    </Button>
                    
                    <p className="text-center text-sm text-gray-600 pt-2">
                      Already have an account?{" "}
                      <Link to="/" className="text-blue-600 hover:underline font-medium">
                        Sign in
                      </Link>
                    </p>
                  </form>
                </TabsContent>

                <TabsContent value="doctor">
                  <div className="text-center space-y-4 py-6">
                    <div className="bg-green-50 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                      <Stethoscope className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="font-semibold text-lg">Join as a Medical Professional</h3>
                    <p className="text-sm text-gray-600">
                      To maintain the highest quality of care, all doctor profiles are verified by our administration team before joining the platform.
                    </p>
                    <Button 
                      type="button" 
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => navigate("/apply-doctor")}
                    >    
                      Apply as a Doctor
                    </Button>
                    <p className="text-center text-sm text-gray-600 pt-2">
                      Already verified?{" "}
                      <Link to="/" className="text-blue-600 hover:underline font-medium">
                        Sign in
                      </Link>
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
