// src/components/SessionExpiredModal.tsx
// NaijaMarket Intel - Session Expired Modal
// Version: 1.0.0
// Date: 2026-01-31
//
// PURPOSE: Shows a notification when user is logged out from another device
// Uses terminal/dark theme to match existing design

"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// ============================================================================
// TRY TO IMPORT useSingleSession (may not be available on login page)
// ============================================================================

let useSingleSession: (() => { sessionState: { isValid: boolean; errorCode: string | null } }) | null = null;
try {
  useSingleSession = require("./SingleSessionProvider").useSingleSession;
} catch {
  // SingleSessionProvider not available
}

// ============================================================================
// ICONS (inline SVG - no external dependencies)
// ============================================================================

const SmartphoneIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="40"
    height="40"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-orange-400"
  >
    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
    <path d="M12 18h.01" />
  </svg>
);

const ClockIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="40"
    height="40"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-yellow-400"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const LogInIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <polyline points="10 17 15 12 10 7" />
    <line x1="15" x2="3" y1="12" y2="12" />
  </svg>
);

const ShieldIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="40"
    height="40"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-red-400"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// ============================================================================
// ERROR MESSAGES
// ============================================================================

interface ErrorContent {
  title: string;
  message: string;
  icon: React.ReactNode;
  explanation?: string;
}

const ERROR_MESSAGES: Record<string, ErrorContent> = {
  SESSION_INVALID: {
    title: "Session Terminated",
    message:
      "Your session was ended because you logged in from another device.",
    icon: <SmartphoneIcon />,
    explanation:
      "For security and subscription protection, NaijaMarket Intel only allows one active session at a time.",
  },
  SESSION_EXPIRED: {
    title: "Session Expired",
    message:
      "Your session has timed out. Please log in again to continue.",
    icon: <ClockIcon />,
  },
  ACCOUNT_BLOCKED: {
    title: "Account Suspended",
    message:
      "Your account has been suspended. Please contact support for assistance.",
    icon: <ShieldIcon />,
  },
};

// ============================================================================
// MODAL COMPONENT
// ============================================================================

export default function SessionExpiredModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Try to use the single session context (may not be available on login page)
  let sessionState: { isValid: boolean; errorCode: string | null } | null = null;
  try {
    if (useSingleSession) {
      const context = useSingleSession();
      sessionState = context.sessionState;
    }
  } catch {
    // Context not available (e.g., on login page outside provider)
  }

  // ============================================================================
  // DETECT ERROR FROM URL OR CONTEXT
  // ============================================================================

  useEffect(() => {
    // Check URL params (from middleware redirect)
    const urlError = searchParams.get("error");
    if (urlError && ERROR_MESSAGES[urlError]) {
      setErrorType(urlError);
      setIsOpen(true);
      setCountdown(5);
      return;
    }

    // Check context state (from provider detection)
    if (sessionState && !sessionState.isValid && sessionState.errorCode) {
      setErrorType(sessionState.errorCode);
      setIsOpen(true);
      setCountdown(5);
    }
  }, [searchParams, sessionState]);

  // ============================================================================
  // COUNTDOWN TIMER
  // ============================================================================

  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleLogin();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleLogin = () => {
    setIsOpen(false);
    setErrorType(null);
    
    // Clear error from URL
    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    window.history.replaceState({}, "", url.toString());
    
    // Navigate to login (if not already there)
    if (!window.location.pathname.includes("/login")) {
      router.push("/login");
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isOpen || !errorType) return null;

  const errorContent = ERROR_MESSAGES[errorType] || ERROR_MESSAGES.SESSION_EXPIRED;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-terminal-surface border border-terminal-border rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header - Terminal style */}
        <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border-b border-terminal-border p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-terminal-bg/50 rounded-lg border border-terminal-border">
              {errorContent.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-red-400 font-mono text-xs">ERROR</span>
                <span className="text-terminal-muted font-mono text-xs">|</span>
                <span className="text-terminal-muted font-mono text-xs">{errorType}</span>
              </div>
              <h2 className="text-xl font-semibold text-white">
                {errorContent.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-gray-300 leading-relaxed">
            {errorContent.message}
          </p>

          {errorContent.explanation && (
            <div className="bg-terminal-bg border border-naija-blue/30 rounded-lg p-4">
              <p className="text-sm text-gray-400">
                <span className="text-naija-blue font-semibold">Why?</span>{" "}
                {errorContent.explanation}
              </p>
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full bg-naija-green hover:bg-naija-green/90 text-black font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-naija-green/20"
          >
            <LogInIcon />
            Log In Again
          </button>

          {/* Countdown */}
          <div className="text-center">
            <p className="text-xs text-terminal-muted font-mono">
              Auto-redirect in{" "}
              <span className="text-naija-gold">{countdown}</span>s
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-terminal-bg/50 border-t border-terminal-border px-6 py-3">
          <p className="text-xs text-terminal-muted text-center font-mono">
            NaijaMarket Intel • Session Security
          </p>
        </div>
      </div>
    </div>
  );
}
