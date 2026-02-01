// src/app/forgot-password/page.tsx
// NaijaMarket Intel - Forgot Password Page
// Business+ users can reset their password via email OTP

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ============================================================================
// TYPES
// ============================================================================

type Step = "email" | "otp" | "password" | "success";

// ============================================================================
// ICONS
// ============================================================================

const MailIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-12 h-12 text-naija-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ForgotPasswordPage() {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<Step>("email");

  // Form data
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/send-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "password_reset" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");

      setStep("otp");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");

      setStep("password");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate password
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!/\d/.test(password)) {
      setError("Password must contain at least one number");
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      setError("Password must contain at least one special character");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp, newPassword: password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");

      setStep("success");
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
        </div>

        {/* Main Card */}
        <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Step: Email */}
          {step === "email" && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-2">Reset Password</h2>
              <p className="text-gray-400 text-sm mb-6">
                Enter your email to receive a verification code
              </p>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Email Address</label>
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
                className="w-full bg-naija-green hover:bg-naija-green/90 disabled:bg-gray-600 text-black font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
              >
                {loading ? <LoadingSpinner /> : "Send Verification Code"}
              </button>

              <p className="text-center text-gray-400 text-sm">
                <Link href="/login" className="text-naija-green hover:underline">
                  ← Back to login
                </Link>
              </p>
            </form>
          )}

          {/* Step: OTP */}
          {step === "otp" && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-2">Enter Code</h2>
              <p className="text-gray-400 text-sm mb-6">
                We sent a 6-digit code to <span className="text-naija-green">{email}</span>
              </p>

              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest font-mono focus:outline-none focus:border-naija-green"
                required
                autoFocus
              />

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-naija-green hover:bg-naija-green/90 disabled:bg-gray-600 text-black font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
              >
                {loading ? <LoadingSpinner /> : "Verify Code"}
              </button>

              <button
                type="button"
                onClick={() => { setStep("email"); setOtp(""); }}
                className="w-full text-gray-400 hover:text-white text-sm py-2"
              >
                ← Use different email
              </button>
            </form>
          )}

          {/* Step: Password */}
          {step === "password" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-2">New Password</h2>
              <p className="text-gray-400 text-sm mb-6">
                Create a strong password for your account
              </p>

              <div>
                <label className="block text-sm text-gray-400 mb-2">New Password</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <LockIcon />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-terminal-bg border border-terminal-border rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-naija-green"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Min 8 chars, 1 number, 1 special character
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Confirm Password</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <LockIcon />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-terminal-bg border border-terminal-border rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-naija-green"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="rounded bg-terminal-bg border-terminal-border"
                />
                Show passwords
              </label>

              <button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className="w-full bg-naija-green hover:bg-naija-green/90 disabled:bg-gray-600 text-black font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
              >
                {loading ? <LoadingSpinner /> : "Reset Password"}
              </button>
            </form>
          )}

          {/* Step: Success */}
          {step === "success" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-naija-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckIcon />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Password Reset!</h2>
              <p className="text-gray-400 mb-6">
                Your password has been changed successfully.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="w-full bg-naija-green hover:bg-naija-green/90 text-black font-semibold py-3 rounded-lg"
              >
                Sign In
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-6 font-mono">
          © 2026 NaijaMarket Intel • Giggababytes Oy
        </p>
      </div>
    </div>
  );
}
