// src/app/register/page.tsx
// NaijaMarket Intel - Registration Page
// UPDATED: 2026-01-31 - Tiered email requirements
//
// Registration Flow:
// 1. Enter phone number
// 2. Verify via WhatsApp OTP
// 3. Enter name
// 4. Select subscription tier
// 5. If BUSINESS: Optional email
// 6. If CORPORATE/ENTERPRISE: Required email + password
// 7. Verify email (if provided)
// 8. Complete registration

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ============================================================================
// CONSTANTS
// ============================================================================

const COUNTRY_CODES = [
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+233", country: "Ghana", flag: "🇬🇭" },
  { code: "+254", country: "Kenya", flag: "🇰🇪" },
  { code: "+27", country: "South Africa", flag: "🇿🇦" },
  { code: "+1", country: "USA/Canada", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+32", country: "Belgium", flag: "🇧🇪" },
  { code: "+358", country: "Finland", flag: "🇫🇮" },
];

const SUBSCRIPTION_TIERS = [
  { 
    id: "FREE", 
    name: "Free", 
    price: "₦0", 
    period: "forever",
    emailRequired: false,
    emailAllowed: false,
    features: ["5 queries/week", "Basic prices", "3 markets"]
  },
  { 
    id: "SILVER", 
    name: "Silver", 
    price: "₦500", 
    period: "/week",
    emailRequired: false,
    emailAllowed: false,
    features: ["10 queries/day", "Price trends", "3 markets"]
  },
  { 
    id: "GOLD", 
    name: "Gold", 
    price: "₦2,000", 
    period: "/month",
    emailRequired: false,
    emailAllowed: false,
    features: ["25 queries/day", "Multi-market", "Alerts"]
  },
  { 
    id: "BUSINESS", 
    name: "Business", 
    price: "₦15,000", 
    period: "/month",
    emailRequired: false,
    emailAllowed: true,
    highlight: true,
    features: ["100 queries/day", "Email login", "PDF reports", "Excel export"]
  },
  { 
    id: "CORPORATE", 
    name: "Corporate", 
    price: "₦50,000", 
    period: "/month",
    emailRequired: true,
    emailAllowed: true,
    features: ["Unlimited queries", "Account manager", "Team access (5)"]
  },
  { 
    id: "ENTERPRISE", 
    name: "Enterprise", 
    price: "₦150,000", 
    period: "/month",
    emailRequired: true,
    emailAllowed: true,
    features: ["Full API access", "Custom reports", "Unlimited team"]
  },
];

// ============================================================================
// TYPES
// ============================================================================

type Step = "phone" | "otp" | "profile" | "tier" | "email" | "email-verify" | "password" | "complete";

// ============================================================================
// ICONS
// ============================================================================

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

export default function RegisterPage() {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<Step>("phone");

  // Form data
  const [countryCode, setCountryCode] = useState("+234");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedTier, setSelectedTier] = useState("FREE");
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, countryCode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");

      setStep("otp");
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
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, countryCode, otp }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid OTP");

      setStep("profile");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Please enter your name");
      return;
    }
    setStep("tier");
  };

  const handleTierSelect = (tierId: string) => {
    setSelectedTier(tierId);
    const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierId);
    
    if (tier?.emailRequired) {
      // CORPORATE/ENTERPRISE - email required
      setStep("email");
    } else if (tier?.emailAllowed) {
      // BUSINESS - email optional
      setStep("email");
    } else {
      // FREE/SILVER/GOLD - complete registration
      handleCompleteRegistration(tierId);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tier = SUBSCRIPTION_TIERS.find(t => t.id === selectedTier);
    
    if (!email && tier?.emailRequired) {
      setError("Email is required for this tier");
      return;
    }

    if (!email) {
      // Skip email, complete registration
      handleCompleteRegistration(selectedTier);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Send email verification code
      const res = await fetch("/api/auth/send-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "registration" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send verification code");

      setStep("email-verify");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: emailOtp }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid verification code");

      setStep("password");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password strength
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

    handleCompleteRegistration(selectedTier, email, password);
  };

  const handleCompleteRegistration = async (tier: string, userEmail?: string, userPassword?: string) => {
    setLoading(true);
    setError("");

    try {
      // Create account
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          countryCode,
          fullName,
          tier,
          email: userEmail || null,
          password: userPassword || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");

      // Mint a session token via the login API (mirrors the login page flow).
      // The phone-otp provider requires { session_token, consumer_id }; the
      // OTP verified earlier is still valid here because /api/auth/register no
      // longer deletes it (upstream /login consumes it).
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "phone", phone, countryCode, otp }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.error || "Sign-in failed");

      // Auto sign in
      const result = await signIn("phone-otp", {
        session_token: loginData.session_token,
        consumer_id: loginData.consumer.id,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      setStep("complete");

      // Redirect after showing the welcome message (longer copy → give time to read)
      setTimeout(() => {
        router.push("/dashboard");
      }, 7000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const skipEmail = () => {
    handleCompleteRegistration(selectedTier);
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderStepIndicator = () => {
    const steps = [
      { key: "phone", label: "Phone" },
      { key: "otp", label: "Verify" },
      { key: "profile", label: "Profile" },
      { key: "tier", label: "Plan" },
    ];
    
    const currentIndex = steps.findIndex(s => s.key === step) || 0;

    return (
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              i <= currentIndex 
                ? "bg-naija-green text-black" 
                : "bg-terminal-border text-gray-500"
            }`}>
              {i < currentIndex ? <CheckIcon /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 ${
                i < currentIndex ? "bg-naija-green" : "bg-terminal-border"
              }`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-terminal-bg flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold">
              <span className="text-white">Naija</span>
              <span className="text-naija-green">Market</span>
              <span className="text-naija-gold"> Intel</span>
            </h1>
          </Link>
        </div>

        {/* Step Indicator */}
        {!["email", "email-verify", "password", "complete"].includes(step) && renderStepIndicator()}

        {/* Main Card */}
        <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Step: Phone */}
          {step === "phone" && (
            <form onSubmit={handleSendPhoneOtp} className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">Create Account</h2>
              <p className="text-gray-400 text-sm mb-6">
                Enter your phone number to get started
              </p>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Phone Number</label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="bg-terminal-bg border border-terminal-border rounded-lg px-3 py-3 text-white"
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
                className="w-full bg-naija-green hover:bg-naija-green/90 disabled:bg-gray-600 text-black font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
              >
                {loading ? <LoadingSpinner /> : "Send OTP via WhatsApp"}
              </button>

              <p className="text-center text-gray-400 text-sm">
                Already have an account?{" "}
                <Link href="/login" className="text-naija-green hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}

          {/* Step: OTP */}
          {step === "otp" && (
            <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">Verify Phone</h2>
              <p className="text-gray-400 text-sm mb-6">
                Enter the 6-digit code sent to your WhatsApp
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
                {loading ? <LoadingSpinner /> : "Verify"}
              </button>

              <button
                type="button"
                onClick={() => { setStep("phone"); setOtp(""); }}
                className="w-full text-gray-400 hover:text-white text-sm py-2"
              >
                ← Change phone number
              </button>
            </form>
          )}

          {/* Step: Profile */}
          {step === "profile" && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">Your Profile</h2>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-naija-green"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={!fullName.trim()}
                className="w-full bg-naija-green hover:bg-naija-green/90 disabled:bg-gray-600 text-black font-semibold py-3 rounded-lg"
              >
                Continue
              </button>
            </form>
          )}

          {/* Step: Tier Selection */}
          {step === "tier" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">Choose Your Plan</h2>
              <p className="text-gray-400 text-sm mb-6">
                Select a subscription tier to continue
              </p>

              <div className="grid gap-3">
                {SUBSCRIPTION_TIERS.map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => handleTierSelect(tier.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      tier.highlight
                        ? "border-naija-green bg-naija-green/10 hover:bg-naija-green/20"
                        : "border-terminal-border hover:border-gray-600"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-semibold text-white">{tier.name}</span>
                        {tier.highlight && (
                          <span className="ml-2 text-xs bg-naija-green text-black px-2 py-0.5 rounded-full">
                            Popular
                          </span>
                        )}
                        {tier.emailAllowed && (
                          <span className="ml-2 text-xs bg-naija-blue/20 text-naija-blue px-2 py-0.5 rounded-full">
                            📧 Email Login
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-naija-green font-bold">{tier.price}</span>
                        <span className="text-gray-500 text-sm">{tier.period}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tier.features.map((f, i) => (
                        <span key={i} className="text-xs text-gray-400 bg-terminal-bg px-2 py-1 rounded">
                          {f}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Email */}
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">
                {SUBSCRIPTION_TIERS.find(t => t.id === selectedTier)?.emailRequired
                  ? "Email Required"
                  : "Add Email (Optional)"}
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                {SUBSCRIPTION_TIERS.find(t => t.id === selectedTier)?.emailRequired
                  ? "Your tier requires an email for account security and professional communications."
                  : "Add email to unlock email login and receive detailed reports."}
              </p>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-naija-green"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-naija-green hover:bg-naija-green/90 disabled:bg-gray-600 text-black font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
              >
                {loading ? <LoadingSpinner /> : email ? "Verify Email" : "Continue Without Email"}
              </button>

              {!SUBSCRIPTION_TIERS.find(t => t.id === selectedTier)?.emailRequired && (
                <button
                  type="button"
                  onClick={skipEmail}
                  className="w-full text-gray-400 hover:text-white text-sm py-2"
                >
                  Skip for now
                </button>
              )}
            </form>
          )}

          {/* Step: Email Verify */}
          {step === "email-verify" && (
            <form onSubmit={handleEmailVerify} className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">Verify Email</h2>
              <p className="text-gray-400 text-sm mb-6">
                Enter the 6-digit code sent to <span className="text-naija-green">{email}</span>
              </p>

              <input
                type="text"
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest font-mono focus:outline-none focus:border-naija-green"
                required
                autoFocus
              />

              <button
                type="submit"
                disabled={loading || emailOtp.length !== 6}
                className="w-full bg-naija-green hover:bg-naija-green/90 disabled:bg-gray-600 text-black font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
              >
                {loading ? <LoadingSpinner /> : "Verify Email"}
              </button>

              <button
                type="button"
                onClick={() => { setStep("email"); setEmailOtp(""); }}
                className="w-full text-gray-400 hover:text-white text-sm py-2"
              >
                ← Change email
              </button>
            </form>
          )}

          {/* Step: Password */}
          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">Create Password</h2>
              <p className="text-gray-400 text-sm mb-6">
                Set a secure password for email login
              </p>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-naija-green"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Min 8 characters, 1 number, 1 special character
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-naija-green"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className="w-full bg-naija-green hover:bg-naija-green/90 disabled:bg-gray-600 text-black font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
              >
                {loading ? <LoadingSpinner /> : "Complete Registration"}
              </button>
            </form>
          )}

          {/* Step: Complete */}
          {step === "complete" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-naija-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckIcon />
              </div>
              <h2 className="text-xl font-semibold text-white mb-4">Welcome to NaijaMarket Intel!</h2>
              <div className="text-left max-w-md mx-auto bg-terminal-bg border border-terminal-border rounded-lg p-4 mb-5 space-y-3">
                <p className="text-sm text-gray-300">
                  <span className="text-naija-green font-semibold">✅ You now have access to live Nigerian commodity prices.</span>
                  <br />
                  Before you go to the market, check prices here first so you don&apos;t get surprised when you arrive
                </p>
                <p className="text-sm text-gray-300">
                  📊 Compare prices across markets<br />
                  📍 Find the cheapest market near you<br />
                  🔔 Set alerts when prices drop
                </p>
                <p className="text-sm text-gray-400">
                  These prices are reported by real people inside real markets — updated 3 times daily.
                </p>
              </div>
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full bg-naija-green hover:bg-naija-green/90 text-black font-semibold py-3 rounded-lg"
              >
                Go to Dashboard →
              </button>
              <p className="text-xs text-gray-500 mt-3">Redirecting automatically…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
