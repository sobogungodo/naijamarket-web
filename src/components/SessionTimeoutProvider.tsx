"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, LogOut, RefreshCw } from "lucide-react";

// ============================================================================
// CONFIGURATION
// ============================================================================

const SESSION_TIMEOUT_MS = 5 * 60 * 1000;        // 5 minutes total
const WARNING_BEFORE_MS = 1 * 60 * 1000;         // Show warning 1 minute before timeout

// ============================================================================
// CONTEXT
// ============================================================================

interface SessionTimeoutContextType {
  resetTimer: () => void;
  timeRemaining: number;
  isWarningVisible: boolean;
}

const SessionTimeoutContext = createContext<SessionTimeoutContextType>({
  resetTimer: () => {},
  timeRemaining: SESSION_TIMEOUT_MS,
  isWarningVisible: false,
});

export const useSessionTimeout = () => useContext(SessionTimeoutContext);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface SessionTimeoutProviderProps {
  children: React.ReactNode;
}

export function SessionTimeoutProvider({ children }: SessionTimeoutProviderProps) {
  const { status } = useSession();
  const router = useRouter();
  const [timeRemaining, setTimeRemaining] = useState(SESSION_TIMEOUT_MS);
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // BACK-BUTTON PROTECTION (NEW)
  // ============================================================================
  useEffect(() => {
    // Check session when page becomes visible (user returns via back button or tab switch)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && status === "unauthenticated") {
        // Session expired while away, redirect to login
        router.replace("/login?sessionExpired=true");
      }
    };

    // Handle page restored from bfcache (back-forward cache)
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Page was restored from cache, verify session
        checkSession();
      }
    };

    // Verify session is still valid
    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        const data = await response.json();
        
        if (!data || !data.user) {
          // Session invalid, redirect to login
          window.location.href = "/login?sessionExpired=true";
        }
      } catch {
        // On error, redirect to be safe
        window.location.href = "/login?sessionExpired=true";
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [status, router]);

  // ============================================================================
  // EXISTING CODE BELOW (UNCHANGED)
  // ============================================================================

  // Reset timer on user activity
  const resetTimer = useCallback(() => {
    setLastActivity(Date.now());
    setTimeRemaining(SESSION_TIMEOUT_MS);
    setIsWarningVisible(false);
  }, []);

  // Handle user activity events
  const handleActivity = useCallback(() => {
    // Only reset if warning is not showing (to prevent accidental dismissal)
    if (!isWarningVisible) {
      resetTimer();
    }
  }, [isWarningVisible, resetTimer]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    // Clear timers
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Clear session storage
    sessionStorage.clear();
    
    // Sign out and redirect to login
    await signOut({ callbackUrl: "/login?timeout=true" });
  }, []);

  // Handle "Stay Logged In" click
  const handleStayLoggedIn = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Set up activity listeners
  useEffect(() => {
    if (status !== "authenticated") return;

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    
    // Throttle activity detection to avoid excessive updates
    let throttleTimer: NodeJS.Timeout | null = null;
    const throttledHandleActivity = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        handleActivity();
        throttleTimer = null;
      }, 1000); // Throttle to once per second
    };

    events.forEach((event) => {
      window.addEventListener(event, throttledHandleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, throttledHandleActivity);
      });
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [status, handleActivity]);

  // Main timer logic
  useEffect(() => {
    if (status !== "authenticated") return;

    // Update time remaining every second
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      const remaining = Math.max(0, SESSION_TIMEOUT_MS - elapsed);
      
      setTimeRemaining(remaining);

      // Show warning when time is running low
      if (remaining <= WARNING_BEFORE_MS && remaining > 0) {
        setIsWarningVisible(true);
      }

      // Auto logout when time is up
      if (remaining === 0) {
        handleLogout();
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, lastActivity, handleLogout]);

  // Don't render timeout UI for unauthenticated users
  if (status !== "authenticated") {
    return <>{children}</>;
  }

  return (
    <SessionTimeoutContext.Provider value={{ resetTimer, timeRemaining, isWarningVisible }}>
      {children}
      
      {/* Warning Modal */}
      {isWarningVisible && (
        <SessionTimeoutModal
          timeRemaining={timeRemaining}
          onStayLoggedIn={handleStayLoggedIn}
          onLogout={handleLogout}
        />
      )}
    </SessionTimeoutContext.Provider>
  );
}

// ============================================================================
// WARNING MODAL COMPONENT (UNCHANGED)
// ============================================================================

interface SessionTimeoutModalProps {
  timeRemaining: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

function SessionTimeoutModal({ timeRemaining, onStayLoggedIn, onLogout }: SessionTimeoutModalProps) {
  const seconds = Math.ceil(timeRemaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  // Format time display
  const timeDisplay = minutes > 0 
    ? `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
    : `${remainingSeconds}s`;

  // Calculate progress for the circular timer
  const progress = (timeRemaining / WARNING_BEFORE_MS) * 100;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      {/* Modal */}
      <div className="relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Warning Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            {/* Circular Progress Background */}
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="44"
                stroke="#2a2a2a"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="48"
                cy="48"
                r="44"
                stroke={seconds <= 30 ? "#ef4444" : "#f59e0b"}
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            {/* Center Icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                seconds <= 30 ? "bg-red-500/20" : "bg-amber-500/20"
              }`}>
                <AlertTriangle className={`w-8 h-8 ${
                  seconds <= 30 ? "text-red-400" : "text-amber-400"
                }`} />
              </div>
            </div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white text-center mb-2">
          Session Expiring
        </h2>

        {/* Description */}
        <p className="text-gray-400 text-center mb-6">
          Your session will expire due to inactivity. Do you want to stay logged in?
        </p>

        {/* Countdown Timer */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Clock className={`w-5 h-5 ${seconds <= 30 ? "text-red-400" : "text-amber-400"}`} />
          <span className={`text-3xl font-mono font-bold ${
            seconds <= 30 ? "text-red-400" : "text-amber-400"
          }`}>
            {timeDisplay}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onStayLoggedIn}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Stay Logged In
          </button>
          
          <button
            onClick={onLogout}
            className="w-full bg-transparent hover:bg-[#2a2a2a] text-gray-400 hover:text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 border border-[#2a2a2a]"
          >
            <LogOut className="w-5 h-5" />
            Logout Now
          </button>
        </div>

        {/* Footer Note */}
        <p className="text-xs text-gray-500 text-center mt-6">
          For your security, we automatically log you out after 5 minutes of inactivity.
        </p>
      </div>
    </div>
  );
}

export default SessionTimeoutProvider;
