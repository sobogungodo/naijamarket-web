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
  ChevronDown,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type RegistrationStep = "details" | "verify-phone" | "verify-email" | "complete";

interface FormData {
  email: string;
  phone: string;
  countryCode: string;
  password: string;
  confirmPassword: string;
}

// ============================================================================
// COUNTRY CODES
// ============================================================================

const countryCodes = [
  // West Africa
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+233", country: "Ghana", flag: "🇬🇭" },
  { code: "+225", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "+221", country: "Senegal", flag: "🇸🇳" },
  { code: "+229", country: "Benin", flag: "🇧🇯" },
  { code: "+228", country: "Togo", flag: "🇹🇬" },
  { code: "+227", country: "Niger", flag: "🇳🇪" },
  { code: "+226", country: "Burkina Faso", flag: "🇧🇫" },
  { code: "+220", country: "Gambia", flag: "🇬🇲" },
  { code: "+231", country: "Liberia", flag: "🇱🇷" },
  { code: "+232", country: "Sierra Leone", flag: "🇸🇱" },
  { code: "+223", country: "Mali", flag: "🇲🇱" },
  { code: "+224", country: "Guinea", flag: "🇬🇳" },
  { code: "+245", country: "Guinea-Bissau", flag: "🇬🇼" },
  { code: "+238", country: "Cape Verde", flag: "🇨🇻" },
  // Other Africa
  { code: "+254", country: "Kenya", flag: "🇰🇪" },
  { code: "+27", country: "South Africa", flag: "🇿🇦" },
  { code: "+20", country: "Egypt", flag: "🇪🇬" },
  // Europe
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+31", country: "Netherlands", flag: "🇳🇱" },
  { code: "+32", country: "Belgium", flag: "🇧🇪" },
  { code: "+39", country: "Italy", flag: "🇮🇹" },
  { code: "+34", country: "Spain", flag: "🇪🇸" },
  { code: "+351", country: "Portugal", flag: "🇵🇹" },
  { code: "+353", country: "Ireland", flag: "🇮🇪" },
  { code: "+358", country: "Finland", flag: "🇫🇮" },
  { code: "+46", country: "Sweden", flag: "🇸🇪" },
  { code: "+47", country: "Norway", flag: "🇳🇴" },
  { code: "+45", country: "Denmark", flag: "🇩🇰" },
  { code: "+43", country: "Austria", flag: "🇦🇹" },
  { code: "+41", country: "Switzerland", flag: "🇨🇭" },
  { code: "+48", country: "Poland", flag: "🇵🇱" },
  // North America
  { code: "+1", country: "USA/Canada", flag: "🇺🇸" },
  // Middle East
  { code: "+971", country: "UAE", flag: "🇦🇪" },
  { code: "+966", country: "Saudi Arabia", flag: "🇸🇦" },
];

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
    countryCode: "+234", // Default to Nigeria
    password: "",
    confirmPassword: "",
  });
  
  // OTP state - separate for phone and email
  const [phoneOtp, setPhoneOtp] = useState(["", "", "", "", "", ""]);
  const [emailOtp, setEmailOtp] = useState(["", "", "", "", "", ""]);
  
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const validatePhone = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");
    return /^\d{6,15}$/.test(cleaned);
  };

  const formatPhoneDisplay = (): string => {
    const cleaned = formData.phone.replace(/[\s\-\(\)]/g, "");
    const phoneWithoutLeadingZero = cleaned.startsWith("0") ? cleaned.substring(1) : cleaned;
    return `${formData.countryCode}${phoneWithoutLeadingZero}`;
  };

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

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

  // Generic OTP handler for both phone and email
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

  const selectedCountry = countryCodes.find(c => c.code === formData.countryCode);

  // ============================================================================
  // API CALLS
  // ============================================================================

  // Step 1: Submit details → Send Phone OTP
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
      setError("Please enter a valid phone number");
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
          phone: formData.phone,
          countryCode: formData.countryCode,
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

  // Step 2: Verify Phone OTP → Send Email OTP
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
      // Verify phone OTP
      const verifyResponse = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "phone",
          phone: formData.phone,
          countryCode: formData.countryCode,
          otp,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || "Invalid OTP");
      }

      // Phone verified! Now send Email OTP
      const emailResponse = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "email",
          email: formData.email,
        }),
      });

      const emailData = await emailResponse.json();

      if (!emailResponse.ok) {
        throw new Error(emailData.error || "Failed to send email OTP");
      }

      setStep("verify-email");
      setResendTimer(0); // Reset timer for email
      startResendTimer();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify Email OTP → Create Account
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
      // Verify email OTP
      const verifyResponse = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "email",
          email: formData.email,
          otp,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || "Invalid email OTP");
      }

      // Both verified! Create account
      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          phone: formData.phone,
          countryCode: formData.countryCode,
          password: formData.password,
        }),
      });

      const registerData = await registerResponse.json();

      if (!registerResponse.ok) {
        throw new Error(registerData.error || "Registration failed");
      }

      // Success!
      setStep("complete");
      setTimeout(() => {
        router.push("/login?registered=true");
      }, 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP (works for both phone and email)
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
          phone: type === "phone" ? formData.phone : undefined,
          countryCode: type === "phone" ? formData.countryCode : undefined,
          email: type === "email" ? formData.email : undefined,
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
          <h1 className="text-4xl font-bold text-white mb-2">Join Nigeria&apos;s Premier</h1>
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
            <p className="text-gray-400 italic">&quot;NaijaMarket Intel has transformed how we source commodities. We&apos;ve reduced procurement costs by 15% in just 3 months.&quot;</p>
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

          {/* Progress Indicator - 3 segments for 4 steps */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className={`h-1 w-16 rounded-full transition-colors ${["details", "verify-phone", "verify-email", "complete"].includes(step) ? "bg-emerald-500" : "bg-gray-700"}`} />
            <div className={`h-1 w-16 rounded-full transition-colors ${["verify-phone", "verify-email", "complete"].includes(step) ? "bg-emerald-500" : "bg-gray-700"}`} />
            <div className={`h-1 w-16 rounded-full transition-colors ${["verify-email", "complete"].includes(step) ? "bg-emerald-500" : "bg-gray-700"}`} />
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
                    <input 
                      type="email" 
                      value={formData.email} 
                      onChange={(e) => handleInputChange("email", e.target.value)} 
                      placeholder="you@company.com" 
                      className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Phone Number (WhatsApp) <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    {/* Country Code Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                        className="flex items-center gap-1 px-3 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white min-w-[100px]"
                      >
                        <span>{selectedCountry?.flag}</span>
                        <span className="text-sm">{formData.countryCode}</span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </button>
                      
                      {showCountryDropdown && (
                        <div className="absolute z-50 top-full left-0 mt-1 w-64 max-h-60 overflow-y-auto bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl">
                          {countryCodes.map((country) => (
                            <button
                              key={country.code}
                              type="button"
                              onClick={() => {
                                handleInputChange("countryCode", country.code);
                                setShowCountryDropdown(false);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-left text-white hover:bg-[#2a2a2a] text-sm"
                            >
                              <span>{country.flag}</span>
                              <span>{country.country}</span>
                              <span className="text-gray-500 ml-auto">{country.code}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Phone Input */}
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input 
                        type="tel" 
                        value={formData.phone} 
                        onChange={(e) => handleInputChange("phone", e.target.value)} 
                        placeholder="8012345678" 
                        className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" 
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">We&apos;ll send a verification code via WhatsApp</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={formData.password} 
                      onChange={(e) => handleInputChange("password", e.target.value)} 
                      placeholder="••••••••" 
                      className="w-full pl-10 pr-12 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">8+ chars, uppercase, lowercase, number</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Confirm Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      value={formData.confirmPassword} 
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)} 
                      placeholder="••••••••" 
                      className="w-full pl-10 pr-12 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" 
                    />
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

                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-5 h-5" /></>}
                </button>
              </form>

              <p className="text-center text-gray-500 mt-6">
                Already have an account? <Link href="/login" className="text-emerald-400 hover:underline">Sign in</Link>
              </p>
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

              <h2 className="text-2xl font-bold text-white text-center mb-2">Verify your WhatsApp</h2>
              <p className="text-gray-500 text-center mb-8">
                Enter the 6-digit code sent to <span className="text-white">{formatPhoneDisplay()}</span>
              </p>

              <form onSubmit={handleVerifyPhone} className="space-y-6">
                <div className="flex justify-center gap-2">
                  {phoneOtp.map((digit, index) => (
                    <input 
                      key={index} 
                      id={`phone-otp-${index}`} 
                      type="text" 
                      inputMode="numeric" 
                      maxLength={1} 
                      value={digit} 
                      onChange={(e) => handleOtpChange("phone", index, e.target.value)} 
                      onKeyDown={(e) => handleOtpKeyDown("phone", index, e)} 
                      onPaste={(e) => handleOtpPaste("phone", e)} 
                      className="w-12 h-14 text-center text-xl font-bold bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white focus:outline-none focus:border-emerald-500" 
                    />
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
                    <button type="button" onClick={() => handleResendOtp("phone")} disabled={loading} className="text-emerald-400 hover:underline text-sm">
                      Resend code
                    </button>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={loading || phoneOtp.join("").length !== 6} 
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verify Phone <ArrowRight className="w-5 h-5" /></>}
                </button>

                <button type="button" onClick={() => setStep("details")} className="w-full text-gray-500 hover:text-white text-sm">
                  ← Back to details
                </button>
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
              <p className="text-gray-500 text-center mb-8">
                Enter the 6-digit code sent to <span className="text-white">{formData.email}</span>
              </p>

              <form onSubmit={handleVerifyEmail} className="space-y-6">
                <div className="flex justify-center gap-2">
                  {emailOtp.map((digit, index) => (
                    <input 
                      key={index} 
                      id={`email-otp-${index}`} 
                      type="text" 
                      inputMode="numeric" 
                      maxLength={1} 
                      value={digit} 
                      onChange={(e) => handleOtpChange("email", index, e.target.value)} 
                      onKeyDown={(e) => handleOtpKeyDown("email", index, e)} 
                      onPaste={(e) => handleOtpPaste("email", e)} 
                      className="w-12 h-14 text-center text-xl font-bold bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white focus:outline-none focus:border-emerald-500" 
                    />
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
                    <button type="button" onClick={() => handleResendOtp("email")} disabled={loading} className="text-emerald-400 hover:underline text-sm">
                      Resend code
                    </button>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={loading || emailOtp.join("").length !== 6} 
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Create Account <ArrowRight className="w-5 h-5" /></>}
                </button>

                <button type="button" onClick={() => setStep("verify-phone")} className="w-full text-gray-500 hover:text-white text-sm">
                  ← Back to phone verification
                </button>
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
