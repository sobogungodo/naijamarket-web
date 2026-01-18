"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Check,
  Phone,
  Shield,
  Loader2,
  AlertCircle,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type RegistrationStep = "details" | "verify-phone" | "verify-email" | "complete";

interface FormData {
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

// ============================================================================
// REGISTRATION PAGE
// ============================================================================

export default function RegisterPage() {
  const router = useRouter();
  
  // Form state
  const [step, setStep] = useState<RegistrationStep>("details");
  const [formData, setFormData] = useState<FormData>({
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  
  // OTP state
  const [phoneOtp, setPhoneOtp] = useState(["", "", "", "", "", ""]);
  const [emailOtp, setEmailOtp] = useState(["", "", "", "", "", ""]);
  
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // ============================================================================
  // VALIDATION
  // ============================================================================

  // Validate Nigerian phone number
  const validatePhone = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-]/g, "");
    const nigerianRegex = /^(\+234|234|0)[789][01]\d{8}$/;
    return nigerianRegex.test(cleaned);
  };

  // Format phone for display
  const formatPhoneDisplay = (phone: string): string => {
    const cleaned = phone.replace(/[\s\-]/g, "");
    if (cleaned.startsWith("+234")) return cleaned;
    if (cleaned.startsWith("234")) return `+${cleaned}`;
    if (cleaned.startsWith("0")) return `+234${cleaned.substring(1)}`;
    return phone;
  };

  // Validate email
  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Validate password
  const validatePassword = (password: string): { valid: boolean; message: string } => {
    if (password.length < 8) {
      return { valid: false, message: "Password must be at least 8 characters" };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: "Password must contain an uppercase letter" };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: "Password must contain a lowercase letter" };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: "Password must contain a number" };
    }
    return { valid: true, message: "" };
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleOtpChange = (type: "phone" | "email", index: number, value: string) => {
    if (value.length > 1) return;
    if (value && !/^\d$/.test(value)) return;

    const setter = type === "phone" ? setPhoneOtp : setEmailOtp;
    const current = type === "phone" ? phoneOtp : emailOtp;
    
    const newOtp = [...current];
    newOtp[index] = value;
    setter(newOtp);

    if (value && index < 5) {
      const nextInput = document.getElementById(`${type}-otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpPaste = (type: "phone" | "email", e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const setter = type === "phone" ? setPhoneOtp : setEmailOtp;
    const newOtp = pasted.split("").concat(Array(6).fill("")).slice(0, 6);
    setter(newOtp);
  };

  const handleOtpKeyDown = (type: "phone" | "email", index: number, e: React.KeyboardEvent) => {
    const current = type === "phone" ? phoneOtp : emailOtp;
    if (e.key === "Backspace" && !current[index] && index > 0) {
      const prevInput = document.getElementById(`${type}-otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const startResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ============================================================================
  // API CALLS
  // ============================================================================

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.email || !formData.phone || !formData.password || !formData.confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (!validatePhone(formData.phone)) {
      setError("Please enter a valid Nigerian phone number (e.g., 08012345678)");
      return;
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "phone",
          phone: formatPhoneDisplay(formData.phone),
          email: formData.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setStep("verify-phone");
      startResendTimer();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const otp = phoneOtp.join("");
    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    setLoading(true);

    try {
      const verifyResponse = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "phone",
          phone: formatPhoneDisplay(formData.phone),
          otp,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || "Invalid OTP");
      }

      // Send email OTP
      const emailResponse = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "email",
          email: formData.email,
          phone: formatPhoneDisplay(formData.phone),
        }),
      });

      const emailData = await emailResponse.json();

      if (!emailResponse.ok) {
        throw new Error(emailData.error || "Failed to send email OTP");
      }

      setStep("verify-email");
      startResendTimer();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const otp = emailOtp.join("");
    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          phone: formatPhoneDisplay(formData.phone),
          password: formData.password,
          emailOtp: otp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      setStep("complete");
      setTimeout(() => {
        router.push("/login?registered=true");
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async (type: "phone" | "email") => {
    if (resendTimer > 0) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          phone: formatPhoneDisplay(formData.phone),
          email: formData.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to resend OTP");
      }

      startResendTimer();
      if (type === "phone") {
        setPhoneOtp(["", "", "", "", "", ""]);
      } else {
        setEmailOtp(["", "", "", "", "", ""]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Left Side - Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] p-12 flex-col justify-center">
        <div className="max-w-md">
          <h1 className="text-4xl font-bold text-white mb-2">Join Nigeria's Premier</h1>
          <h2 className="text-3xl font-bold text-emerald-400 mb-8">Market Intelligence Platform</h2>

          <div className="space-y-4">
            {[
              "Access 226+ markets across all 37 states",
              "GPS-verified prices from 10,000+ traders",
              "Real-time price alerts and notifications",
              "Advanced analytics and trend analysis",
              "API access for enterprise integration",
            ].map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-gray-300">{feature}</span>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-semibold">CK</div>
              <div>
                <div className="text-white font-medium">Chidi Kalu</div>
                <div className="text-gray-500 text-sm">Procurement Manager, Nestle Nigeria</div>
              </div>
            </div>
            <p className="text-gray-400 italic">"NaijaMarket Intel has transformed how we source commodities. We've reduced procurement costs by 15% in just 3 months."</p>
          </div>
        </div>
      </div>

      {/* Right Side - Registration Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-amber-500 rounded-lg flex items-center justify-center">
              <span className="text-black font-bold">NM</span>
            </div>
            <span className="text-xl font-bold text-white">NaijaMarket<span className="text-emerald-400">Intel</span></span>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className={`h-1 w-16 rounded-full transition-colors ${step === "details" ? "bg-emerald-500" : "bg-emerald-500"}`} />
            <div className={`h-1 w-16 rounded-full transition-colors ${step === "verify-phone" || step === "verify-email" || step === "complete" ? "bg-emerald-500" : "bg-gray-700"}`} />
            <div className={`h-1 w-16 rounded-full transition-colors ${step === "verify-email" || step === "complete" ? "bg-emerald-500" : "bg-gray-700"}`} />
          </div>

          {/* Step 1: Registration Details */}
          {step === "details" && (
            <div>
              <h2 className="text-2xl font-bold text-white text-center mb-2">Create your account</h2>
              <p className="text-gray-500 text-center mb-8">Start with your details</p>

              <form onSubmit={handleSubmitDetails} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Email Address <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input type="email" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} placeholder="you@company.com" className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Phone Number <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input type="tel" value={formData.phone} onChange={(e) => handleInputChange("phone", e.target.value)} placeholder="08012345678" className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Nigerian number (e.g., 08012345678 or +2348012345678)</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => handleInputChange("password", e.target.value)} placeholder="••••••••" className="w-full pl-10 pr-12 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Confirm Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input type={showConfirmPassword ? "text" : "password"} value={formData.confirmPassword} onChange={(e) => handleInputChange("confirmPassword", e.target.value)} placeholder="••••••••" className="w-full pl-10 pr-12 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-5 h-5" /></>}
                </button>
              </form>

              <p className="text-center text-gray-500 mt-6">Already have an account? <Link href="/login" className="text-emerald-400 hover:underline">Sign in</Link></p>
            </div>
          )}

          {/* Step 2: Verify Phone */}
          {step === "verify-phone" && (
            <div>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <Phone className="w-8 h-8 text-emerald-400" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white text-center mb-2">Verify your phone</h2>
              <p className="text-gray-500 text-center mb-8">Enter the 6-digit code sent to <span className="text-white">{formatPhoneDisplay(formData.phone)}</span></p>

              <form onSubmit={handleVerifyPhone} className="space-y-6">
                <div className="flex justify-center gap-2">
                  {phoneOtp.map((digit, index) => (
                    <input key={index} id={`phone-otp-${index}`} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handleOtpChange("phone", index, e.target.value)} onKeyDown={(e) => handleOtpKeyDown("phone", index, e)} onPaste={(e) => handleOtpPaste("phone", e)} className="w-12 h-14 text-center text-xl font-bold bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white focus:outline-none focus:border-emerald-500" />
                  ))}
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <div className="text-center">
                  {resendTimer > 0 ? (
                    <p className="text-gray-500 text-sm">Resend code in {resendTimer}s</p>
                  ) : (
                    <button type="button" onClick={() => handleResendOtp("phone")} disabled={loading} className="text-emerald-400 hover:underline text-sm">Resend code</button>
                  )}
                </div>

                <button type="submit" disabled={loading || phoneOtp.join("").length !== 6} className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verify Phone <ArrowRight className="w-5 h-5" /></>}
                </button>

                <button type="button" onClick={() => setStep("details")} className="w-full text-gray-500 hover:text-white text-sm">← Back to details</button>
              </form>
            </div>
          )}

          {/* Step 3: Verify Email */}
          {step === "verify-email" && (
            <div>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <Mail className="w-8 h-8 text-emerald-400" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white text-center mb-2">Verify your email</h2>
              <p className="text-gray-500 text-center mb-8">Enter the 6-digit code sent to <span className="text-white">{formData.email}</span></p>

              <form onSubmit={handleVerifyEmail} className="space-y-6">
                <div className="flex justify-center gap-2">
                  {emailOtp.map((digit, index) => (
                    <input key={index} id={`email-otp-${index}`} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handleOtpChange("email", index, e.target.value)} onKeyDown={(e) => handleOtpKeyDown("email", index, e)} onPaste={(e) => handleOtpPaste("email", e)} className="w-12 h-14 text-center text-xl font-bold bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white focus:outline-none focus:border-emerald-500" />
                  ))}
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <div className="text-center">
                  {resendTimer > 0 ? (
                    <p className="text-gray-500 text-sm">Resend code in {resendTimer}s</p>
                  ) : (
                    <button type="button" onClick={() => handleResendOtp("email")} disabled={loading} className="text-emerald-400 hover:underline text-sm">Resend code</button>
                  )}
                </div>

                <button type="submit" disabled={loading || emailOtp.join("").length !== 6} className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Complete Registration <ArrowRight className="w-5 h-5" /></>}
                </button>

                <button type="button" onClick={() => setStep("verify-phone")} className="w-full text-gray-500 hover:text-white text-sm">← Back to phone verification</button>
              </form>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === "complete" && (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <Shield className="w-10 h-10 text-emerald-400" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">Account Created!</h2>
              <p className="text-gray-500 mb-8">Your account has been successfully verified. Redirecting to login...</p>

              <div className="flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
