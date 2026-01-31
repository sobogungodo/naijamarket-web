// src/components/SingleSessionProvider.tsx
// NaijaMarket Intel - Single Session Provider
// Version: 1.0.0
// Date: 2026-01-31
//
// PURPOSE: Client-side component that monitors session validity
// Shows modal when user is logged out from another device

"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";

// ============================================================================
// TYPES
// ============================================================================

interface SessionState {
  isValid: boolean;
  isChecking: boolean;
  error: string | null;
  errorCode: string | null;
}

interface SingleSessionContextType {
  sessionState: SessionState;
  checkSession: () => Promise<boolean>;
  clearError: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const SingleSessionContext = createContext<SingleSessionContextType | undefined>(undefined);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function SingleSessionProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [sessionState, setSessionState] = useState<SessionState>({
    isValid: true,
    isChecking: false,
    error: null,
    errorCode: null,
  });

  // ============================================================================
  // CHECK SESSION VALIDITY
  // ============================================================================

  const checkSession = useCallback(async (): Promise<boolean> => {
    // Skip if not authenticated
    if (status !== "authenticated" || !session) {
      return true;
    }

    // Skip if on public pages
    const publicPaths = ["/login", "/", "/register", "/api"];
    if (publicPaths.some(path => pathname?.startsWith(path))) {
      return true;
    }

    // Skip if no session token (old sessions before this feature)
    const sessionToken = (session.user as any)?.sessionToken;
    if (!sessionToken) {
      console.log("[SingleSession] No session token in JWT, skipping validation");
      return true;
    }

    setSessionState((prev) => ({ ...prev, isChecking: true }));

    try {
      const response = await fetch("/api/auth/validate-session", {
        method: "GET",
        credentials: "include",
      });

      const result = await response.json();

      if (!result.valid) {
        console.log("[SingleSession] ❌ Session invalid:", result.error_code);

        setSessionState({
          isValid: false,
          isChecking: false,
          error: result.message,
          errorCode: result.error_code,
        });

        // Sign out from NextAuth (client-side)
        await signOut({ redirect: false });

        return false;
      }

      setSessionState({
        isValid: true,
        isChecking: false,
        error: null,
        errorCode: null,
      });

      return true;

    } catch (error) {
      console.error("[SingleSession] Check error:", error);
      
      // On network error, assume valid to prevent false logouts
      setSessionState((prev) => ({ ...prev, isChecking: false }));
      return true;
    }
  }, [session, status, pathname]);

  // ============================================================================
  // CLEAR ERROR
  // ============================================================================

  const clearError = useCallback(() => {
    setSessionState({
      isValid: true,
      isChecking: false,
      error: null,
      errorCode: null,
    });
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Check session on route change
  useEffect(() => {
    if (status === "authenticated") {
      checkSession();
    }
  }, [pathname, status, checkSession]);

  // Periodic session check (every 5 minutes)
  useEffect(() => {
    if (status !== "authenticated") return;

    const interval = setInterval(() => {
      checkSession();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [status, checkSession]);

  // Check on visibility change (when user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && status === "authenticated") {
        checkSession();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [status, checkSession]);

  // Handle session invalid - redirect to login
  useEffect(() => {
    if (!sessionState.isValid && sessionState.errorCode) {
      // Small delay to show modal before redirect
      const timeout = setTimeout(() => {
        router.push(`/login?error=${sessionState.errorCode}`);
      }, 3000); // 3 second delay to show the modal

      return () => clearTimeout(timeout);
    }
  }, [sessionState.isValid, sessionState.errorCode, router]);

  return (
    <SingleSessionContext.Provider value={{ sessionState, checkSession, clearError }}>
      {children}
    </SingleSessionContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useSingleSession() {
  const context = useContext(SingleSessionContext);
  if (context === undefined) {
    throw new Error("useSingleSession must be used within a SingleSessionProvider");
  }
  return context;
}

// ============================================================================
// EXPORT
// ============================================================================

export default SingleSessionProvider;
