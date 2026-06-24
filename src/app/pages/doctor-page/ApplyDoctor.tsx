import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { User, Mail, Lock, ShieldCheck, FileBadge, Phone, BriefcaseMedical, EyeOff, Eye, Camera, CheckCircle2, GraduationCap, Plus, X } from "lucide-react";
import { PasswordStrengthIndicator } from "../../components/ui/PasswordStrengthIndicator";
import API from "../../../api/axios";
import { MEDIMEET_LOGO_SRC } from "../../constants/assets";

// Custom Animations
const customStyles = `
  @keyframes modalPop {
    0% { opacity: 0; transform: scale(0.9) translateY(10px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  .animate-modal-pop {
    animation: modalPop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes progressShrink {
    0% { width: 100%; }
    100% { width: 0%; }
  }
  .animate-progress {
    animation: progressShrink 5s linear forwards;
  }
`;

export function ApplyDoctor() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    specialization: "",
    licenseNumber: "",
    experience: "",
    password: "",
    confirmPassword: "",
  });

  const [photo, setPhoto] = useState<File | null>(null); // State for the passport photo
  const [qualifications, setQualifications] = useState<string[]>([""]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const updateQualification = (index: number, value: string) => {
    setQualifications((items) => items.map((item, itemIndex) => itemIndex === index ? value : item));
  };

  const addQualification = () => {
    setQualifications((items) => [...items, ""]);
  };

  const removeQualification = (index: number) => {
    setQualifications((items) => items.length === 1 ? items : items.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      return setError("Passwords do not match. Please try again.");
    }

    if (!photo) {
      return setError("Please upload a passport-sized photo for verification.");
    }

    const cleanedQualifications = qualifications.map((item) => item.trim()).filter(Boolean);
    if (cleanedQualifications.length === 0) {
      return setError("Please add at least one medical qualification.");
    }

    try {
      setLoading(true);
      
      // Use FormData since we are submitting a file
      const submitData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        submitData.append(key, value);
      });
      submitData.append("qualifications", JSON.stringify(cleanedQualifications));
      submitData.append("photo", photo);

      await API.post("/auth/doctor/apply", submitData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setShowSuccessModal(true);
      setTimeout(() => navigate("/"), 5000);
      
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to submit application. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <style>{customStyles}</style>
      
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-modal-pop">
            <div className="bg-green-600 p-6 flex flex-col items-center justify-center text-white">
              <div className="bg-white/20 p-3 rounded-full mb-4">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-center">Application Received!</h2>
            </div>
            
            <div className="p-6 text-center space-y-4">
              <p className="text-gray-600 text-lg">
                Thank you for applying to join <strong>MediMeet</strong>.
              </p>
              <div className="bg-green-50 text-green-800 p-4 rounded-xl border border-green-100 text-sm font-medium">
                Our medical review board is currently verifying your credentials. You will be notified once your profile is officially approved and activated.
              </div>
              <p className="text-sm text-gray-500 pt-2">
                Redirecting you to the login page...
              </p>
            </div>
            
            <div className="h-1.5 w-full bg-gray-100">
              <div className="h-full bg-green-500 animate-progress"></div>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-teal-50 flex justify-center p-4 py-10">
        <div className="w-full max-w-6xl min-h-[calc(100vh-5rem)] flex flex-col">
          <div className="grid lg:grid-cols-2 gap-8 items-center flex-1">
          
          <div className="hidden lg:block space-y-6 self-start sticky top-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-1">
                <img 
                  src={MEDIMEET_LOGO_SRC} 
                  alt="MediMeet Logo" 
                  className="w-32 h-32 object-contain drop-shadow-md" 
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">MediMeet for Doctors</h1>
                <p className="text-gray-600">Join our elite network of professionals</p>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-900">
                Grow Your Practice Digitally
              </h2>
              <ul className="space-y-3 text-gray-600 text-lg">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-600" /> Consult patients securely online.
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-600" /> Manage appointments seamlessly.
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-600" /> Expand your reach beyond your city.
                </li>
              </ul>
            </div>

            <div className="relative rounded-2xl overflow-hidden shadow-2xl mt-8">
              <img
                src="/images/apply doc/apply doctor image.avif"
                alt="Doctor smiling"
                className="w-full h-80 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-green-900/70 to-transparent flex items-end p-6">
                <div className="text-white">
                  <p className="font-semibold text-lg flex items-center gap-2">
                    <FileBadge className="w-5 h-5 text-yellow-400" />
                    Verified Professional Network
                  </p>
                  <p className="text-sm opacity-90">All applications are strictly vetted by our medical board.</p>
                </div>
              </div>
            </div>
          </div>

            <div className="w-full max-w-xl mx-auto">
              <Card className="border-0 shadow-2xl">
                <CardHeader className="space-y-1 pb-4 bg-gray-50/50 rounded-t-xl border-b">
                  <CardTitle className="text-2xl text-center text-green-800">Doctor Application Portal</CardTitle>
                  <CardDescription className="text-center">
                    Submit your credentials for verification to join MediMeet.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                
                  {error && (
                    <div className="mb-6 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm text-center">
                      {error}
                    </div>
                  )}

                <form onSubmit={handleApply} className="space-y-5">
                  
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider border-b pb-2">Personal Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name (with Title)</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input id="name" placeholder="Dr. Abc Xyz" className="pl-10" value={formData.name} onChange={handleChange} required />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="phone">Contact Number</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input id="phone" type="tel" placeholder="+91 9xxxx 4xxxx" className="pl-10" value={formData.phone} onChange={handleChange} required />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Professional Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input id="email" type="email" placeholder="example@gmail.com" className="pl-10" value={formData.email} onChange={handleChange} required />
                      </div>
                    </div>

                    {/* NEW: Photo Upload Field */}
                    <div className="space-y-2 pt-2">
                      <Label htmlFor="photo">Passport Photo for Verification</Label>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                          {photo ? (
                            <img src={URL.createObjectURL(photo)} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <Camera className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <Input 
                          id="photo" 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => setPhoto(e.target.files?.[0] || null)} 
                          className="flex-1 cursor-pointer bg-white" 
                          required 
                        />
                      </div>
                    </div>

                  </div>

                  <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider border-b pb-2">Professional Credentials</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="specialization">Specialization</Label>
                        <div className="relative">
                          <BriefcaseMedical className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input id="specialization" placeholder="e.g. Cardiologist" className="pl-10" value={formData.specialization} onChange={handleChange} required />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="experience">Years of Experience</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input id="experience" type="number" min="0" placeholder="e.g. 5" className="pl-10" value={formData.experience} onChange={handleChange} required />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="licenseNumber">Medical License Number</Label>
                      <div className="relative">
                        <FileBadge className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input id="licenseNumber" placeholder="Enter your state medical council ID" className="pl-10 uppercase" value={formData.licenseNumber} onChange={handleChange} required />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <Label>Qualifications</Label>
                        <Button type="button" variant="outline" size="sm" onClick={addQualification} className="h-8 gap-2">
                          <Plus className="h-4 w-4" /> Add
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {qualifications.map((qualification, index) => (
                          <div key={index} className="flex gap-2">
                            <div className="relative flex-1">
                              <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input
                                value={qualification}
                                onChange={(e) => updateQualification(index, e.target.value)}
                                placeholder="e.g. MBBS, MD"
                                className="pl-10"
                              />
                            </div>
                            {qualifications.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => removeQualification(index)}
                                aria-label="Remove qualification"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider border-b pb-2">Account Security</h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" className="pl-10 pr-10" value={formData.password} onChange={handleChange} required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <PasswordStrengthIndicator password={formData.password} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" className="pl-10 pr-10" value={formData.confirmPassword} onChange={handleChange} required />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none">
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={loading || showSuccessModal} className="w-full bg-green-600 hover:bg-green-700 mt-4 text-lg py-6 transition-all active:scale-[0.98]">
                    {loading ? "Submitting Application..." : "Submit Application"}
                  </Button>
                  
                  <p className="text-center text-sm text-gray-600 pt-2">
                    Already verified?{" "}
                    <Link to="/" className="text-green-600 hover:underline font-medium">
                      Sign in here
                    </Link>
                  </p>
                </form>
                </CardContent>
              </Card>
            </div>
          </div>

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
    </>
  );
}
