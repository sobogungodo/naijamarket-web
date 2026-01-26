// ============================================================================
// src/components/settings/TwoFactorAuth.tsx
// NaijaMarket Intel - Two-Factor Authentication Settings Component
// Uses WhatsApp/Email OTP (not TOTP authenticator apps)
// Version: 1.0.0
// ============================================================================

"use client";

import { useState, useEffect, useRef } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Mail,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface TwoFactorStatus {
  enabled: boolean;
  method: "whatsapp" | "email" | null;
  methodLabel: string | null;
  enabledAt: string | null;
  destination: string | null;
}

interface AvailableMethod {
  id: "whatsapp" | "email";
  name: string;
  description: string;
  icon: string;
  available: boolean;
  destination: string | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TwoFactorAuth() {
  // Status state
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [availableMethods, setAvailableMethods] = useState<AvailableMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Setup flow state
  const [showSetup, setShowSetup] = useState(false);
  const [setupStep, setSetupStep] = useState<"select" | "verify" | "success">("select");
  const [selectedMethod, setSelectedMethod] = useState<"whatsapp" | "email" | null>(null);
  const [destination, setDestination] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Disable flow state
  const [showDisable, setShowDisable] = useState(false);
  const [disableStep, setDisableStep] = useState<"confirm" | "verify">("confirm");
  const [disableCode, setDisableCode] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disableDestination, setDisableDestination] = useState<string>("");

  // Refs for code input
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ============================================================================
  // FETCH STATUS
  // ============================================================================

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get setup options (includes available methods)
      const response = await fetch("/api/auth/2fa/setup");
      const data = await response.json();

      if (data.success) {
        setStatus({
          enabled: data.data.enabled,
          method: data.data.method,
          methodLabel: data.data.method === "whatsapp" ? "WhatsApp OTP" : 
                       data.data.method === "email" ? "Email OTP" : null,
          enabledAt: null,
          destination: null,
        });
        setAvailableMethods(data.data.availableMethods || []);
      } else {
        setError(data.error || "Failed to load 2FA status");
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // SETUP FLOW
  // ============================================================================

  const startSetup = () => {
    setShowSetup(true);
    setSetupStep("select");
    setSelectedMethod(null);
    setVerificationCode("");
    setSetupError(null);
  };

  const selectMethod = async (method: "whatsapp" | "email") => {
    setSelectedMethod(method);
    setSetupLoading(true);
    setSetupError(null);

    try {
      const response = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });

      const data = await response.json();

      if (data.success && data.step === "verify") {
        setDestination(data.destination);
        setSetupStep("verify");
      } else {
        setSetupError(data.error || "Failed to send verification code");
      }
    } catch {
      setSetupError("Failed to connect to server");
    } finally {
      setSetupLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (verificationCode.length !== 6) {
      setSetupError("Please enter a 6-digit code");
      return;
    }

    setSetupLoading(true);
    setSetupError(null);

    try {
      const response = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          method: selectedMethod,
          otp: verificationCode,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSetupStep("success");
        fetchStatus(); // Refresh status
      } else {
        setSetupError(data.error || "Verification failed");
      }
    } catch {
      setSetupError("Failed to verify code");
    } finally {
      setSetupLoading(false);
    }
  };

  const completeSetup = () => {
    setShowSetup(false);
    setSetupStep("select");
    setSelectedMethod(null);
    setVerificationCode("");
  };

  // ============================================================================
  // DISABLE FLOW
  // ============================================================================

  const startDisable = () => {
    setShowDisable(true);
    setDisableStep("confirm");
    setDisableCode("");
    setDisableError(null);
  };

  const confirmAndSendCode = async () => {
    setDisableLoading(true);
    setDisableError(null);

    try {
      const response = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // No OTP yet - will trigger send
      });

      const data = await response.json();

      if (data.success && data.step === "verify") {
        setDisableDestination(data.destination);
        setDisableStep("verify");
      } else {
        setDisableError(data.error || "Failed to send verification code");
      }
    } catch {
      setDisableError("Failed to connect to server");
    } finally {
      setDisableLoading(false);
    }
  };

  const verifyAndDisable = async () => {
    if (disableCode.length !== 6) {
      setDisableError("Please enter a 6-digit code");
      return;
    }

    setDisableLoading(true);
    setDisableError(null);

    try {
      const response = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: disableCode }),
      });

      const data = await response.json();

      if (data.success) {
        setShowDisable(false);
        fetchStatus(); // Refresh status
      } else {
        setDisableError(data.error || "Failed to disable 2FA");
      }
    } catch {
      setDisableError("Failed to connect to server");
    } finally {
      setDisableLoading(false);
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const handleCodeInput = (
    index: number, 
    value: string, 
    setter: React.Dispatch<React.SetStateAction<string>>,
    currentValue: string
  ) => {
    const newCode = currentValue.split("");
    newCode[index] = value;
    setter(newCode.join(""));

    // Auto-advance to next input
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent, currentValue: string) => {
    if (e.key === "Backspace" && !currentValue[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case "whatsapp":
        return <MessageCircle className="w-6 h-6" />;
      case "email":
        return <Mail className="w-6 h-6" />;
      default:
        return <Smartphone className="w-6 h-6" />;
    }
  };

  // ============================================================================
  // RENDER - LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-naija-green animate-spin" />
          <span className="text-gray-400">Loading 2FA status...</span>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER - ERROR STATE
  // ============================================================================

  if (error) {
    return (
      <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
        <div className="flex items-center gap-3 text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
          <button
            onClick={fetchStatus}
            className="ml-auto px-3 py-1 text-sm bg-terminal-elevated hover:bg-terminal-muted rounded transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER - MAIN
  // ============================================================================

  return (
    <>
      {/* Main Card */}
      <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${
              status?.enabled 
                ? "bg-naija-green/20 text-naija-green" 
                : "bg-gray-800 text-gray-400"
            }`}>
              {status?.enabled ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <Shield className="w-6 h-6" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Two-Factor Authentication
              </h3>
              <p className="text-sm text-gray-400">
                {status?.enabled
                  ? `Protected via ${status.methodLabel}`
                  : "Add an extra layer of security"}
              </p>
            </div>
          </div>

          {status?.enabled ? (
            <button
              onClick={startDisable}
              className="px-4 py-2 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-lg transition-colors flex items-center gap-2"
            >
              <ShieldOff className="w-4 h-4" />
              Disable
            </button>
          ) : (
            <button
              onClick={startSetup}
              className="px-4 py-2 bg-naija-green text-black font-medium hover:bg-naija-green/90 rounded-lg transition-colors flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Enable
            </button>
          )}
        </div>

        {/* Status Details */}
        {status?.enabled && (
          <div className="mt-6 pt-6 border-t border-terminal-border">
            <div className="flex items-center gap-3 p-4 bg-naija-green/10 border border-naija-green/30 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-naija-green" />
              <div>
                <p className="text-sm text-white font-medium">2FA is Active</p>
                <p className="text-xs text-gray-400">
                  You&apos;ll receive a verification code via {status.methodLabel} when signing in
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Setup Modal */}
      {showSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-terminal-surface border border-terminal-border rounded-2xl max-w-md w-full max-h-[90vh] overflow-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-terminal-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-naija-green/20 rounded-lg">
                  <Shield className="w-5 h-5 text-naija-green" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {setupStep === "select" && "Enable 2FA"}
                    {setupStep === "verify" && "Verify Code"}
                    {setupStep === "success" && "2FA Enabled!"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {setupStep === "select" && "Choose how you want to receive codes"}
                    {setupStep === "verify" && `Code sent to ${destination}`}
                    {setupStep === "success" && "Your account is now protected"}
                  </p>
                </div>
              </div>
              {setupStep !== "success" && (
                <button
                  onClick={() => setShowSetup(false)}
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-terminal-elevated transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-6">
              {setupStep === "select" ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400 mb-4">
                    Choose how you&apos;d like to receive verification codes when signing in:
                  </p>

                  {availableMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => method.available && selectMethod(method.id)}
                      disabled={!method.available || setupLoading}
                      className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        method.available
                          ? "border-terminal-border hover:border-naija-green/50 bg-terminal-elevated hover:bg-terminal-muted cursor-pointer"
                          : "border-terminal-border bg-terminal-surface opacity-50 cursor-not-allowed"
                      } ${selectedMethod === method.id && setupLoading ? "border-naija-green" : ""}`}
                    >
                      <div className={`p-3 rounded-lg ${
                        method.id === "whatsapp" 
                          ? "bg-green-900/30 text-green-400" 
                          : "bg-blue-900/30 text-blue-400"
                      }`}>
                        {getMethodIcon(method.id)}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-white">{method.name}</p>
                        <p className="text-sm text-gray-400">{method.description}</p>
                        {method.destination && (
                          <p className="text-xs text-gray-500 mt-1">{method.destination}</p>
                        )}
                        {!method.available && (
                          <p className="text-xs text-red-400 mt-1">Not available</p>
                        )}
                      </div>
                      {setupLoading && selectedMethod === method.id && (
                        <Loader2 className="w-5 h-5 text-naija-green animate-spin" />
                      )}
                    </button>
                  ))}

                  {setupError && (
                    <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-sm text-red-400">
                      {setupError}
                    </div>
                  )}
                </div>
              ) : setupStep === "verify" ? (
                <div className="space-y-6">
                  <p className="text-sm text-gray-400 text-center">
                    Enter the 6-digit code sent to <span className="text-white font-medium">{destination}</span>
                  </p>

                  {/* Code Input */}
                  <div className="flex justify-center gap-2">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <input
                        key={index}
                        ref={(el) => { codeInputRefs.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={verificationCode[index] || ""}
                        onChange={(e) => handleCodeInput(index, e.target.value.replace(/\D/g, ""), setVerificationCode, verificationCode)}
                        onKeyDown={(e) => handleCodeKeyDown(index, e, verificationCode)}
                        className="w-12 h-14 text-center text-xl font-mono font-bold bg-terminal-elevated border border-terminal-border rounded-lg text-white focus:border-naija-green focus:ring-1 focus:ring-naija-green outline-none transition-colors"
                      />
                    ))}
                  </div>

                  {setupError && (
                    <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-sm text-red-400 text-center">
                      {setupError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSetupStep("select");
                        setVerificationCode("");
                        setSetupError(null);
                      }}
                      className="flex-1 py-3 bg-terminal-elevated text-gray-300 font-medium rounded-lg hover:bg-terminal-muted transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={verifyAndEnable}
                      disabled={verificationCode.length !== 6 || setupLoading}
                      className="flex-1 py-3 bg-naija-green text-black font-medium rounded-lg hover:bg-naija-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {setupLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Enable 2FA"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 text-center">
                  <div className="inline-flex p-4 bg-naija-green/20 rounded-full">
                    <ShieldCheck className="w-12 h-12 text-naija-green" />
                  </div>
                  
                  <div>
                    <h4 className="text-xl font-semibold text-white mb-2">
                      2FA Enabled Successfully!
                    </h4>
                    <p className="text-sm text-gray-400">
                      Your account is now protected with two-factor authentication.
                      You&apos;ll receive a verification code via {selectedMethod === "whatsapp" ? "WhatsApp" : "email"} when signing in.
                    </p>
                  </div>

                  <button
                    onClick={completeSetup}
                    className="w-full py-3 bg-naija-green text-black font-medium rounded-lg hover:bg-naija-green/90 transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Disable Modal */}
      {showDisable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-terminal-surface border border-terminal-border rounded-2xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-terminal-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-900/30 rounded-lg">
                  <ShieldOff className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Disable 2FA
                </h3>
              </div>
              <button
                onClick={() => setShowDisable(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-terminal-elevated transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {disableStep === "confirm" ? (
                <>
                  <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-red-200 font-medium">
                          Warning: This will reduce your account security
                        </p>
                        <p className="text-xs text-red-300/70 mt-1">
                          Without 2FA, anyone with your password can access your account.
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-400 text-center">
                    To disable 2FA, we&apos;ll send a verification code to confirm it&apos;s you.
                  </p>

                  {disableError && (
                    <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-sm text-red-400 text-center">
                      {disableError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDisable(false)}
                      className="flex-1 py-3 bg-terminal-elevated text-gray-300 font-medium rounded-lg hover:bg-terminal-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmAndSendCode}
                      disabled={disableLoading}
                      className="flex-1 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {disableLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send Code"
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-400 text-center">
                    Enter the 6-digit code sent to <span className="text-white font-medium">{disableDestination}</span>
                  </p>

                  {/* Code Input */}
                  <div className="flex justify-center gap-2">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <input
                        key={index}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={disableCode[index] || ""}
                        onChange={(e) => {
                          const newCode = disableCode.split("");
                          newCode[index] = e.target.value.replace(/\D/g, "");
                          setDisableCode(newCode.join(""));
                          
                          // Auto-advance
                          if (e.target.value && index < 5) {
                            const nextInput = e.target.parentElement?.children[index + 1] as HTMLInputElement;
                            nextInput?.focus();
                          }
                        }}
                        className="w-12 h-14 text-center text-xl font-mono font-bold bg-terminal-elevated border border-terminal-border rounded-lg text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors"
                      />
                    ))}
                  </div>

                  {disableError && (
                    <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-sm text-red-400 text-center">
                      {disableError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setDisableStep("confirm");
                        setDisableCode("");
                        setDisableError(null);
                      }}
                      className="flex-1 py-3 bg-terminal-elevated text-gray-300 font-medium rounded-lg hover:bg-terminal-muted transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={verifyAndDisable}
                      disabled={disableCode.length !== 6 || disableLoading}
                      className="flex-1 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {disableLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Disabling...
                        </>
                      ) : (
                        "Disable 2FA"
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
