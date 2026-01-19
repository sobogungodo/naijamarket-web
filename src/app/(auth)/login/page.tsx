"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Phone,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
  ChevronDown,
  Clock,
  CheckCircle,
} from "lucide-react";

// ============================================================================
// COUNTRY CODES
// ============================================================================

const countryCodes = [
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+233", country: "Ghana", flag: "🇬🇭" },
  { code: "+32", country: "Belgium", flag: "🇧🇪" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+1", country: "USA/Canada", flag: "🇺🇸" },
  { code: "+358", country: "Finland", flag: "🇫🇮" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+31", country: "Netherlands", flag: "🇳🇱" },
  { code: "+27", country: "South Africa", flag: "🇿🇦" },
  { code: "+254", country: "Kenya", flag: "🇰🇪" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
];

// ============================================================================
// LOADING FALLBACK COMPONENT
// ============================================================================

function LoginLoadingFallback() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-amber-500 rounded-lg flex items-center justify-center">
            <span className="text-black font-bold">NM</span>
          </div>
          <span className="text-xl font-bold text-white">
            NaijaMarket<span className="text-emerald-400">Intel</span>
          </span>
        </div>

        {/* Loading Card */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-4" />
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LOGIN CONTENT COMPONENT (Contains useSearchParams)
// ============================================================================

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Check for special query params
  const wasTimeout = searchParams.get("timeout") === "true";
  const wasRegistered = searchParams.get("registered") === "true";
  
  // Form state
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+234");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(wasTimeout);
  const [showRegisteredMessage, setShowRegisteredMessage] = useState(wasRegistered);

  // Auto-hide messages after 5 seconds
  useEffect(() => {
    if (showTimeoutMessage) {
      const timer = setTimeout(() => setShowTimeoutMessage(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showTimeoutMessage]);

  useEffect(() => {
    if (showRegisteredMessage) {
      const timer = setTimeout(() => setShowRegisteredMessage(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showRegisteredMessage]);

  const selectedCountry = countryCodes.find(c => c.code === countryCode);

  // Format phone for display
  const formatPhoneDisplay = (): string => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");
    const phoneWithoutLeadingZero = cleaned.startsWith("0") ? cleaned.substring(1) : cleaned;
    return `${countryCode}${phoneWithoutLeadingZero}`;
  };

  // Start resend timer
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

  // Handle OTP input
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = pasted.split("").concat(Array(6).fill("")).slice(0, 6);
    setOtp(newOtp);
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  // Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!phone || phone.length < 6) {
      setError("Please enter a valid phone number");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "phone",
          phone,
          countryCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setStep("otp");
      startResendTimer();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP and login
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    setLoading(true);

    try {
      const result = await signIn("credentials", {
        phone,
        countryCode,
        otp: otpCode,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      // Success - redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendTimer > 0) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "phone",
          phone,
          countryCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to resend OTP");
      }

      startResendTimer();
      setOtp(["", "", "", "", "", ""]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-amber-500 rounded-lg flex items-center justify-center">
            <span className="text-black font-bold">NM</span>
          </div>
          <span className="text-xl font-bold text-white">
            NaijaMarket<span className="text-emerald-400">Intel</span>
          </span>
        </div>

        {/* Session Timeout Message */}
        {showTimeoutMessage && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg animate-in fade-in slide-in-from-top duration-300">
            <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-amber-400 font-medium">Session Expired</p>
              <p className="text-amber-400/70 text-sm">You were logged out due to inactivity. Please log in again.</p>
            </div>
          </div>
        )}

        {/* Registration Success Message */}
        {showRegisteredMessage && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg animate-in fade-in slide-in-from-top duration-300">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-emerald-400 font-medium">Registration Successful!</p>
              <p className="text-emerald-400/70 text-sm">Your account has been created. Please log in to continue.</p>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8">
          {step === "phone" ? (
            <>
              <h1 className="text-2xl font-bold text-white text-center mb-2">Welcome back</h1>
              <p className="text-gray-500 text-center mb-8">Sign in to your account</p>

              <form onSubmit={handleSendOtp} className="space-y-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Phone Number</label>
                  <div className="flex gap-2">
                    {/* Country Code */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                        className="flex items-center gap-1 px-3 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white min-w-[100px]"
                      >
                        <span>{selectedCountry?.flag}</span>
                        <span className="text-sm">{countryCode}</span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </button>
                      
                      {showCountryDropdown && (
                        <div className="absolute z-50 top-full left-0 mt-1 w-48 max-h-60 overflow-y-auto bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl">
                          {countryCodes.map((country) => (
                            <button
                              key={country.code}
                              type="button"
                              onClick={() => {
                                setCountryCode(country.code);
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
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="8012345678"
                        className="w-full pl-10 pr-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
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
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Send OTP <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <Lock className="w-8 h-8 text-emerald-400" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-white text-center mb-2">Enter OTP</h1>
              <p className="text-gray-500 text-center mb-8">
                Code sent to <span className="text-white">{formatPhoneDisplay()}</span>
              </p>

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="flex justify-center gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={(e) => handleOtpPaste(e)}
                      className="w-12 h-14 text-center text-xl font-bold bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white focus:outline-none focus:border-emerald-500"
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
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={loading}
                      className="text-emerald-400 hover:underline text-sm"
                    >
                      Resend code
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.join("").length !== 6}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Sign In <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setOtp(["", "", "", "", "", ""]);
                    setError("");
                  }}
                  className="w-full text-gray-500 hover:text-white text-sm"
                >
                  ← Change phone number
                </button>
              </form>
            </>
          )}

          <p className="text-center text-gray-500 mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-emerald-400 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN EXPORT WITH SUSPENSE BOUNDARY
// ============================================================================

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingFallback />}>
      <LoginContent />
    </Suspense>
  );
}
