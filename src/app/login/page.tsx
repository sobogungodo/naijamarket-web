// src/app/login/page.tsx
// NaijaMarket Intel - Phone OTP Login Page

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");

  // Handle phone submission - send OTP
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setMaskedPhone(data.phone);
      setStep("otp");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP verification
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("phone-otp", {
        phone,
        otp,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      // Success! Redirect to dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setError("");
    setLoading(true);
    setOtp("");

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to resend OTP");
      }

      setError(""); // Clear any previous error
      alert("OTP sent successfully! Check your WhatsApp.");
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl mb-4">
            <span className="text-3xl">📊</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">NaijaMarket Intel</h1>
          <p className="text-gray-400">The Bloomberg of Nigerian Commodities</p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
          {step === "phone" ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-2">Welcome back!</h2>
              <p className="text-gray-400 mb-6">Enter your phone number to continue</p>

              <form onSubmit={handleSendOTP}>
                {/* Phone Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      🇳🇬 +234
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      placeholder="8012345678"
                      className="w-full pl-20 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      maxLength={11}
                      required
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    We&apos;ll send a verification code to your WhatsApp
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || phone.length < 10}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-white mb-2">Enter verification code</h2>
              <p className="text-gray-400 mb-6">
                We sent a code to your WhatsApp ({maskedPhone})
              </p>

              <form onSubmit={handleVerifyOTP}>
                {/* OTP Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    6-Digit Code
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-center text-2xl tracking-widest placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    maxLength={6}
                    required
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Verifying...
                    </>
                  ) : (
                    <>
                      <span>🔓</span>
                      <span>Verify & Login</span>
                    </>
                  )}
                </button>

                {/* Resend & Back Links */}
                <div className="mt-4 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("phone");
                      setOtp("");
                      setError("");
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    ← Change number
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="text-emerald-400 hover:text-emerald-300 transition-colors disabled:text-gray-500"
                  >
                    Resend code
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          By continuing, you agree to our{" "}
          <a href="/terms" className="text-emerald-400 hover:underline">Terms</a>
          {" "}and{" "}
          <a href="/privacy" className="text-emerald-400 hover:underline">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
