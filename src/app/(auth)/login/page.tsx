"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Phone, MessageSquare, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input, FormField } from "@/components/ui/input";

// ============================================================================
// COUNTRY CODES - EU, West Africa, US, Canada
// ============================================================================

interface CountryCode {
  code: string;
  country: string;
  flag: string;
  maxLength: number;
}

const COUNTRY_CODES: CountryCode[] = [
  // West Africa
  { code: "+234", country: "Nigeria", flag: "🇳🇬", maxLength: 10 },
  { code: "+233", country: "Ghana", flag: "🇬🇭", maxLength: 9 },
  { code: "+225", country: "Ivory Coast", flag: "🇨🇮", maxLength: 10 },
  { code: "+221", country: "Senegal", flag: "🇸🇳", maxLength: 9 },
  { code: "+228", country: "Togo", flag: "🇹🇬", maxLength: 8 },
  { code: "+229", country: "Benin", flag: "🇧🇯", maxLength: 8 },
  { code: "+226", country: "Burkina Faso", flag: "🇧🇫", maxLength: 8 },
  { code: "+227", country: "Niger", flag: "🇳🇪", maxLength: 8 },
  { code: "+223", country: "Mali", flag: "🇲🇱", maxLength: 8 },
  { code: "+220", country: "Gambia", flag: "🇬🇲", maxLength: 7 },
  { code: "+232", country: "Sierra Leone", flag: "🇸🇱", maxLength: 8 },
  { code: "+231", country: "Liberia", flag: "🇱🇷", maxLength: 9 },
  { code: "+224", country: "Guinea", flag: "🇬🇳", maxLength: 9 },
  
  // North America
  { code: "+1", country: "USA", flag: "🇺🇸", maxLength: 10 },
  { code: "+1", country: "Canada", flag: "🇨🇦", maxLength: 10 },
  
  // Europe
  { code: "+44", country: "United Kingdom", flag: "🇬🇧", maxLength: 10 },
  { code: "+49", country: "Germany", flag: "🇩🇪", maxLength: 11 },
  { code: "+33", country: "France", flag: "🇫🇷", maxLength: 9 },
  { code: "+39", country: "Italy", flag: "🇮🇹", maxLength: 10 },
  { code: "+34", country: "Spain", flag: "🇪🇸", maxLength: 9 },
  { code: "+31", country: "Netherlands", flag: "🇳🇱", maxLength: 9 },
  { code: "+32", country: "Belgium", flag: "🇧🇪", maxLength: 9 },
  { code: "+41", country: "Switzerland", flag: "🇨🇭", maxLength: 9 },
  { code: "+43", country: "Austria", flag: "🇦🇹", maxLength: 10 },
  { code: "+46", country: "Sweden", flag: "🇸🇪", maxLength: 9 },
  { code: "+47", country: "Norway", flag: "🇳🇴", maxLength: 8 },
  { code: "+45", country: "Denmark", flag: "🇩🇰", maxLength: 8 },
  { code: "+358", country: "Finland", flag: "🇫🇮", maxLength: 10 },
  { code: "+353", country: "Ireland", flag: "🇮🇪", maxLength: 9 },
  { code: "+351", country: "Portugal", flag: "🇵🇹", maxLength: 9 },
  { code: "+48", country: "Poland", flag: "🇵🇱", maxLength: 9 },
  { code: "+420", country: "Czech Republic", flag: "🇨🇿", maxLength: 9 },
  { code: "+36", country: "Hungary", flag: "🇭🇺", maxLength: 9 },
  { code: "+30", country: "Greece", flag: "🇬🇷", maxLength: 10 },
  
  // Other Africa
  { code: "+27", country: "South Africa", flag: "🇿🇦", maxLength: 9 },
  { code: "+254", country: "Kenya", flag: "🇰🇪", maxLength: 9 },
  { code: "+256", country: "Uganda", flag: "🇺🇬", maxLength: 9 },
  { code: "+255", country: "Tanzania", flag: "🇹🇿", maxLength: 9 },
  { code: "+20", country: "Egypt", flag: "🇪🇬", maxLength: 10 },
];

// Default country
const DEFAULT_COUNTRY: CountryCode = { code: "+234", country: "Nigeria", flag: "🇳🇬", maxLength: 10 };

// ============================================================================
// LOGIN PAGE - WITH EMAIL/PASSWORD AND PHONE OTP OPTIONS
// ============================================================================

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Toggle between email and phone login
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  
  // Email form data
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    remember: false,
  });
  
  // Phone OTP form data
  const [phoneData, setPhoneData] = useState({
    phone: "",
    otp: "",
  });
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [otpStep, setOtpStep] = useState<"phone" | "otp">("phone");
  const [maskedPhone, setMaskedPhone] = useState("");
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ============================================================================
  // EMAIL/PASSWORD HANDLERS
  // ============================================================================

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // TODO: Implement actual email authentication
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success("Welcome back!", {
        description: "Redirecting to dashboard...",
      });

      router.push("/dashboard");
    } catch (error) {
      toast.error("Login failed", {
        description: "Invalid email or password. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // PHONE OTP HANDLERS
  // ============================================================================

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Only allow numbers
    const numericValue = value.replace(/\D/g, "");
    setPhoneData((prev) => ({
      ...prev,
      [name]: numericValue,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const getFullPhoneNumber = (): string => {
    // Remove leading 0 if present (common in many countries)
    let phone = phoneData.phone;
    if (phone.startsWith("0")) {
      phone = phone.substring(1);
    }
    // Combine country code (without +) and phone number
    const countryCode = selectedCountry.code.replace("+", "");
    return countryCode + phone;
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneData.phone || phoneData.phone.length < 7) {
      setErrors({ phone: "Please enter a valid phone number" });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const fullPhone = getFullPhoneNumber();
      
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setMaskedPhone(data.phone);
      setOtpStep("otp");
      toast.success("OTP Sent!", {
        description: "Check your WhatsApp for the verification code",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Please try again";
      toast.error("Failed to send OTP", {
        description: errorMessage,
      });
      setErrors({ phone: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneData.otp || phoneData.otp.length !== 6) {
      setErrors({ otp: "Please enter the 6-digit code" });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const fullPhone = getFullPhoneNumber();
      
      const result = await signIn("phone-otp", {
        phone: fullPhone,
        otp: phoneData.otp,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      toast.success("Welcome!", {
        description: "Redirecting to dashboard...",
      });

      router.push("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Invalid OTP. Please try again.";
      toast.error("Verification failed", {
        description: errorMessage,
      });
      setErrors({ otp: "Invalid or expired code" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    setPhoneData((prev) => ({ ...prev, otp: "" }));
    setErrors({});

    try {
      const fullPhone = getFullPhoneNumber();
      
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to resend OTP");
      }

      toast.success("OTP Resent!", {
        description: "Check your WhatsApp for the new code",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to resend";
      toast.error("Failed to resend", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectCountry = (country: CountryCode) => {
    setSelectedCountry(country);
    setShowCountryDropdown(false);
    setPhoneData((prev) => ({ ...prev, phone: "" }));
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-terminal-bg flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="text-center">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-naija-green to-naija-gold rounded-lg flex items-center justify-center">
                <span className="text-terminal-bg font-bold text-lg">NM</span>
              </div>
              <span className="font-display font-bold text-xl text-white">
                NaijaMarket<span className="text-naija-green">Intel</span>
              </span>
            </Link>
          </div>

          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-display font-bold text-white">
              Welcome back
            </h1>
            <p className="text-gray-400 mt-2">
              Sign in to access your market intelligence dashboard
            </p>
          </div>

          {/* Login Method Toggle */}
          <div className="flex bg-terminal-surface rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setLoginMethod("email");
                setErrors({});
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                loginMethod === "email"
                  ? "bg-naija-green text-terminal-bg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod("phone");
                setOtpStep("phone");
                setErrors({});
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                loginMethod === "phone"
                  ? "bg-naija-green text-terminal-bg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Phone className="w-4 h-4" />
              Phone
            </button>
          </div>

          {/* Email/Password Form */}
          {loginMethod === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <FormField label="Email Address" error={errors.email} required>
                <Input
                  type="email"
                  name="email"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={handleChange}
                  error={errors.email}
                  leftIcon={<Mail className="w-4 h-4" />}
                  autoComplete="email"
                  disabled={isLoading}
                />
              </FormField>

              <FormField label="Password" error={errors.password} required>
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  error={errors.password}
                  leftIcon={<Lock className="w-4 h-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="hover:text-white transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  }
                  autoComplete="current-password"
                  disabled={isLoading}
                />
              </FormField>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="remember"
                    checked={formData.remember}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-terminal-border bg-terminal-surface text-naija-green focus:ring-naija-green focus:ring-offset-terminal-bg"
                    disabled={isLoading}
                  />
                  <span className="text-sm text-gray-400">Remember me</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-naija-green hover:text-naija-green-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={isLoading}
                loadingText="Signing in..."
              >
                Sign In
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          )}

          {/* Phone OTP Form */}
          {loginMethod === "phone" && (
            <>
              {otpStep === "phone" ? (
                <form onSubmit={handleSendOTP} className="space-y-5">
                  <FormField label="Phone Number" error={errors.phone} required>
                    <div className="flex gap-2">
                      {/* Country Selector */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                          className="flex items-center gap-2 px-3 py-3 bg-terminal-surface border border-terminal-border rounded-lg text-white hover:border-gray-500 transition-colors min-w-[100px]"
                        >
                          <span className="text-lg">{selectedCountry.flag}</span>
                          <span className="text-sm">{selectedCountry.code}</span>
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>
                        
                        {/* Dropdown */}
                        {showCountryDropdown && (
                          <div className="absolute top-full left-0 mt-1 w-64 max-h-60 overflow-y-auto bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50">
                            {COUNTRY_CODES.map((country, idx) => (
                              <button
                                key={`${country.code}-${country.country}-${idx}`}
                                type="button"
                                onClick={() => selectCountry(country)}
                                className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-terminal-border transition-colors text-left ${
                                  selectedCountry.code === country.code && selectedCountry.country === country.country
                                    ? "bg-naija-green/20 text-naija-green"
                                    : "text-white"
                                }`}
                              >
                                <span className="text-lg">{country.flag}</span>
                                <span className="flex-1 text-sm">{country.country}</span>
                                <span className="text-xs text-gray-400">{country.code}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Phone Input */}
                      <input
                        type="tel"
                        name="phone"
                        placeholder="8012345678"
                        value={phoneData.phone}
                        onChange={handlePhoneChange}
                        maxLength={selectedCountry.maxLength}
                        className={`flex-1 px-4 py-3 bg-terminal-surface border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-naija-green focus:border-transparent transition-all ${
                          errors.phone ? "border-price-down" : "border-terminal-border"
                        }`}
                        disabled={isLoading}
                      />
                    </div>
                  </FormField>
                  
                  <p className="text-xs text-gray-500 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-naija-green" />
                    We&apos;ll send a verification code to your WhatsApp
                  </p>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    isLoading={isLoading}
                    loadingText="Sending OTP..."
                    disabled={phoneData.phone.length < 7}
                  >
                    Send OTP
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-5">
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-naija-green/20 rounded-full mb-3">
                      <MessageSquare className="w-6 h-6 text-naija-green" />
                    </div>
                    <p className="text-gray-400 text-sm">
                      Enter the 6-digit code sent to WhatsApp
                    </p>
                    <p className="text-white text-sm mt-1">
                      {selectedCountry.flag} {selectedCountry.code} {maskedPhone}
                    </p>
                  </div>

                  <FormField label="Verification Code" error={errors.otp} required>
                    <input
                      type="text"
                      name="otp"
                      placeholder="000000"
                      value={phoneData.otp}
                      onChange={handlePhoneChange}
                      maxLength={6}
                      className={`w-full px-4 py-4 bg-terminal-surface border rounded-lg text-white text-center text-2xl tracking-[0.5em] placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-naija-green focus:border-transparent transition-all ${
                        errors.otp ? "border-price-down" : "border-terminal-border"
                      }`}
                      disabled={isLoading}
                      autoFocus
                    />
                  </FormField>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    isLoading={isLoading}
                    loadingText="Verifying..."
                    disabled={phoneData.otp.length !== 6}
                  >
                    Verify & Sign In
                    <ArrowRight className="w-4 h-4" />
                  </Button>

                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep("phone");
                        setPhoneData((prev) => ({ ...prev, otp: "" }));
                        setErrors({});
                      }}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      ← Change number
                    </button>
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={isLoading}
                      className="text-naija-green hover:text-naija-green-300 transition-colors disabled:text-gray-500"
                    >
                      Resend code
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-terminal-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-terminal-bg text-gray-500">
                Or continue with
              </span>
            </div>
          </div>

          {/* Social Login */}
          <div className="grid grid-cols-2 gap-4">
            <Button variant="secondary" disabled={isLoading}>
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </Button>
            <Button variant="secondary" disabled={isLoading}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </Button>
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-sm text-gray-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-naija-green hover:text-naija-green-300 font-medium transition-colors"
            >
              Sign up for free
            </Link>
          </p>
        </div>
      </div>

      {/* Right Panel - Decorative */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-naija-green/20 via-terminal-surface to-naija-gold/10 items-center justify-center p-12 border-l border-terminal-border">
        <div className="max-w-lg text-center">
          {/* Terminal Preview */}
          <div className="bg-terminal-bg border border-terminal-border rounded-xl overflow-hidden shadow-terminal mb-8">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-terminal-border">
              <div className="w-3 h-3 rounded-full bg-price-down" />
              <div className="w-3 h-3 rounded-full bg-naija-gold" />
              <div className="w-3 h-3 rounded-full bg-price-up" />
            </div>
            <div className="p-4 font-mono text-sm">
              <div className="text-naija-gold mb-2">NM&gt; SNAPSHOT LAGOS</div>
              <div className="text-gray-400 text-xs">
                Loading market data...
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-terminal-surface p-2 rounded">
                  <div className="text-gray-500">RICE 50KG</div>
                  <div className="text-white">₦78,500</div>
                  <div className="text-price-up">+2.3%</div>
                </div>
                <div className="bg-terminal-surface p-2 rounded">
                  <div className="text-gray-500">BEANS BAG</div>
                  <div className="text-white">₦62,000</div>
                  <div className="text-price-down">-1.2%</div>
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-display font-bold text-white mb-4">
            Real-Time Market Intelligence
          </h2>
          <p className="text-gray-400">
            Access GPS-verified commodity prices from 226+ markets across Nigeria.
            Make data-driven procurement decisions with confidence.
          </p>
        </div>
      </div>
      
      {/* Click outside to close dropdown */}
      {showCountryDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowCountryDropdown(false)}
        />
      )}
    </div>
  );
}
