// src/app/login/page.tsx
// NaijaMarket Intel - Login Page
// UPDATED: 2026-02-25 - Replaced Email+Password with Email+OTP flow
//                       Email login now mirrors Phone+OTP pattern
//
// Two login methods:
// 1. Phone + WhatsApp OTP (All tiers)
// 2. Email + Email OTP (BUSINESS, CORPORATE, ENTERPRISE)

"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// ============================================================================
// COUNTRY CODES
// ============================================================================

const COUNTRY_CODES = [
  { code: "+234", country: "Nigeria", flag: "\uD83C\uDDF3\uD83C\uDDEC" },
  { code: "+233", country: "Ghana", flag: "\uD83C\uDDEC\uD83C\uDDED" },
  { code: "+254", country: "Kenya", flag: "\uD83C\uDDF0\uD83C\uDDEA" },
  { code: "+27", country: "South Africa", flag: "\uD83C\uDDFF\uD83C\uDDE6" },
  { code: "+1", country: "USA/Canada", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
  { code: "+44", country: "UK", flag: "\uD83C\uDDEC\uD83C\uDDE7" },
  { code: "+353", country: "Ireland", flag: "\uD83C\uDDEE\uD83C\uDDEA" },
  { code: "+49", country: "Germany", flag: "\uD83C\uDDE9\uD83C\uDDEA" },
  { code: "+33", country: "France", flag: "\uD83C\uDDEB\uD83C\uDDF7" },
  { code: "+31", country: "Netherlands", flag: "\uD83C\uDDF3\uD83C\uDDF1" },
  { code: "+32", country: "Belgium", flag: "\uD83C\uDDE7\uD83C\uDDEA" },
  { code: "+358", country: "Finland", flag: "\uD83C\uDDEB\uD83C\uDDEE" },
  { code: "+971", country: "UAE", flag: "\uD83C\uDDE6\uD83C\uDDEA" },
];

// ============================================================================
// TYPES
// ============================================================================

type AuthMethod = "phone" | "email";
type PhoneStep = "phone" | "otp";
type EmailStep = "email" | "otp"; // NEW: email flow now has two steps too

// ============================================================================
// ICONS (Inline SVG - no dependencies)
// ============================================================================

const PhoneIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const MailIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// ============================================================================
// LOGIN FORM COMPONENT (uses useSearchParams)
// ============================================================================

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const errorParam = searchParams.get("error");

  // Auth method state
  const [authMethod, setAuthMethod] = useState<AuthMethod>("phone");

  // Phone login state
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("phone");
  const [countryCode, setCountryCode] = useState("+234");
  const [phone, setPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");

  // Email login state ÔÇö NOW TWO STEP (email ÔåÆ OTP)
  const [emailStep, setEmailStep] = useState<EmailStep>("email");
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Common state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Handle URL error params
  useEffect(() => {
    if (errorParam === "SESSION_INVALID") {
      setError("You were logged out because you signed in from another device.");
    } else if (errorParam === "SESSION_EXPIRED") {
      setError("Your session has expired. Please log in again.");
    } else if (errorParam === "CredentialsSignin") {
      setError("Invalid credentials. Please try again.");
    } else if (errorParam) {
      setError("An error occurred. Please try again.");
    }
  }, [errorParam]);

  // ============================================================================
  // PHONE LOGIN HANDLERS
  // ============================================================================

  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, countryCode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");

      setSuccess("OTP sent to your WhatsApp! Check your messages.");
      setPhoneStep("otp");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Step 1: Verify OTP first
      const verifyRes = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: countryCode.replace("+","") + phone.replace(/\D/g,""), otp: phoneOtp }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.valid) throw new Error("Invalid or expired OTP code.");

      // Step 2: Call login API — creates session token
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "phone", phone, countryCode, otp: phoneOtp }),
      });

      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.error || "Login failed");

      // Clear stale session cookies
      document.cookie = "session_validated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";

      // Step 2: Sign in with NextAuth using session token
      const result = await signIn("phone-otp", {
        session_token: loginData.session_token,
        consumer_id: loginData.consumer.id,
        redirect: false,
      });

      if (result?.error) throw new Error(result.error);

      setSuccess("Login successful! Redirecting...");
      window.location.href = callbackUrl;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // EMAIL LOGIN HANDLERS (NEW: OTP-BASED)
  // ============================================================================

  const handleSendEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/auth/send-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "login" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");

      setSuccess(`Verification code sent to ${email}. Check your inbox.`);
      setEmailStep("otp");
      setResendCooldown(60); // 60s cooldown before resend allowed
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Step 1: Call our login API to verify OTP + get session token
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "email", email, otp: emailOtp }),
      });

      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.error || "Login failed");

      // Clear stale session cookies
      document.cookie = "session_validated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";

      // Step 2: Sign in with NextAuth using session token
      const result = await signIn("credentials", {
        session_token: loginData.session_token,
        consumer_id: loginData.consumer.id,
        redirect: false,
      });

      if (result?.error) throw new Error(result.error);

      setSuccess("Login successful! Redirecting...");
      window.location.href = callbackUrl;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmailOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/send-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "login" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend OTP");

      setSuccess("New verification code sent! Check your inbox.");
      setEmailOtp("");
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* Auth Method Tabs */}
      <div className="flex border-b border-terminal-border">
        <button
          onClick={() => {
            setAuthMethod("phone");
            setError("");
            setSuccess("");
          }}
          className={`flex-1 py-4 px-6 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
            authMethod === "phone"
              ? "bg-naija-green/10 text-naija-green border-b-2 border-naija-green"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <PhoneIcon />
          Phone + OTP
        </button>
        <button
          onClick={() => {
            setAuthMethod("email");
            setError("");
            setSuccess("");
          }}
          className={`flex-1 py-4 px-6 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
            authMethod === "email"
              ? "bg-naija-green/10 text-naija-green border-b-2 border-naija-green"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <MailIcon />
          Email Login
        </button>
      </div>

      <div className="p-6">
        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2">
            <WhatsAppIcon />
            {success}
          </div>
        )}

        {/* ==================================================================
            PHONE + OTP LOGIN
            ================================================================== */}
        {authMethod === "phone" && (
          <>
            {phoneStep === "phone" ? (
              <form onSubmit={handleSendPhoneOtp} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Phone Number
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="bg-terminal-bg border border-terminal-border rounded-lg px-3 py-3 text-white focus:outline-none focus:border-naija-green"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      placeholder="8012345678"
                      className="flex-1 bg-terminal-bg border border-terminal-border rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-naija-green"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !phone}
                  className="w-full bg-naija-green hover:bg-naija-green/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? <LoadingSpinner /> : (
                    <>
                      <WhatsAppIcon />
                      Send OTP via WhatsApp
                    </>
                  )}
                </button>

                <p className="text-center text-gray-500 text-xs mt-4">
                  We&apos;ll send a 6-digit code to your WhatsApp
                </p>
              </form>
            ) : (
              <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Enter OTP sent to WhatsApp
                  </label>
                  <input
                    type="text"
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest placeholder-gray-500 focus:outline-none focus:border-naija-green font-mono"
                    required
                    autoFocus
                  />
                  <p className="text-center text-gray-500 text-xs mt-2">
                    Check your WhatsApp for the 6-digit code
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || phoneOtp.length !== 6}
                  className="w-full bg-naija-green hover:bg-naija-green/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? <LoadingSpinner /> : "Verify & Login"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPhoneStep("phone");
                    setPhoneOtp("");
                    setError("");
                    setSuccess("");
                  }}
                  className="w-full text-gray-400 hover:text-white text-sm py-2"
                >
                  ÔåÉ Change phone number
                </button>
              </form>
            )}
          </>
        )}

        {/* ==================================================================
            EMAIL + OTP LOGIN (UPDATED: no more password)
            ================================================================== */}
        {authMethod === "email" && (
          <>
            {emailStep === "email" ? (
              <form onSubmit={handleSendEmailOtp} className="space-y-4">
                {/* Tier Notice */}
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
                  <p className="text-blue-400 font-medium flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Business+ Feature
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Email login is available for Business, Corporate, and Enterprise tiers.
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      <MailIcon />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full bg-terminal-bg border border-terminal-border rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-naija-green"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full bg-naija-green hover:bg-naija-green/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? <LoadingSpinner /> : (
                    <>
                      <MailIcon />
                      Send Verification Code
                    </>
                  )}
                </button>

                <p className="text-center text-gray-500 text-xs mt-4">
                  We&apos;ll send a 6-digit code to your email
                </p>
              </form>
            ) : (
              // EMAIL OTP VERIFICATION STEP
              <form onSubmit={handleVerifyEmailOtp} className="space-y-4">
                <div className="text-center mb-2">
                  <p className="text-gray-400 text-sm">
                    Code sent to{" "}
                    <span className="text-naija-green font-medium">{email}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Enter 6-digit code
                  </label>
                  <input
                    type="text"
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest placeholder-gray-500 focus:outline-none focus:border-naija-green font-mono"
                    required
                    autoFocus
                  />
                  <p className="text-center text-gray-500 text-xs mt-2">
                    Check your inbox (and spam folder) for the 6-digit code
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || emailOtp.length !== 6}
                  className="w-full bg-naija-green hover:bg-naija-green/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? <LoadingSpinner /> : "Verify & Login"}
                </button>

                {/* Resend Code */}
                <div className="text-center">
                  {resendCooldown > 0 ? (
                    <p className="text-gray-500 text-sm">
                      Resend code in{" "}
                      <span className="text-naija-gold font-mono">{resendCooldown}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendEmailOtp}
                      disabled={loading}
                      className="text-naija-green hover:underline text-sm disabled:text-gray-500"
                    >
                      Resend verification code
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEmailStep("email");
                    setEmailOtp("");
                    setError("");
                    setSuccess("");
                  }}
                  className="w-full text-gray-400 hover:text-white text-sm py-2"
                >
                  ÔåÉ Change email
                </button>
              </form>
            )}
          </>
        )}

        {/* Divider */}
        <div className="my-6 flex items-center gap-4">
          <div className="flex-1 h-px bg-terminal-border" />
          <span className="text-gray-500 text-xs">OR</span>
          <div className="flex-1 h-px bg-terminal-border" />
        </div>

        {/* Register Link */}
        <p className="text-center text-gray-400 text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-naija-green hover:underline font-medium">
            Register here
          </Link>
        </p>
      </div>
    </>
  );
}

// ============================================================================
// LOADING FALLBACK
// ============================================================================

function LoginLoading() {
  return (
    <div className="p-6 flex items-center justify-center">
      <LoadingSpinner />
      <span className="ml-2 text-gray-400">Loading...</span>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT (with Suspense boundary)
// ============================================================================

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-terminal-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold">
              <span className="text-white">Naija</span>
              <span className="text-naija-green">Market</span>
              <span className="text-naija-gold"> Intel</span>
            </h1>
          </Link>
          <p className="text-gray-400 mt-2 text-sm font-mono">
            The Bloomberg of African Commodities
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-terminal-surface border border-terminal-border rounded-xl overflow-hidden">
          {/* Suspense boundary for useSearchParams */}
          <Suspense fallback={<LoginLoading />}>
            <LoginForm />
          </Suspense>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-6 font-mono">
          ┬® 2026 NaijaMarket Intel ÔÇó Giggababytes Oy
        </p>
      </div>
    </div>
  );
}