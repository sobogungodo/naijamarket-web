"use client";

// ============================================================================
// AuthShell — Conditionally activates session management
// Only wraps with SingleSessionProvider, SessionTimeoutProvider, etc.
// on PROTECTED routes. Public pages get no session checking at all.
// Deploy to: src/components/AuthShell.tsx
// Version: 1.0.0 | Date: 2026-02-23
// ============================================================================

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { SessionTimeoutProvider } from "@/components/SessionTimeoutProvider";
import { SingleSessionProvider } from "@/components/SingleSessionProvider";
import SessionExpiredModal from "@/components/SessionExpiredModal";
import ChatBot from "@/components/ChatBot";

// Routes that should NEVER trigger session checks
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/about",
  "/privacy",
  "/ndpr",
  "/blog",
  "/terms",
  "/contact",
  "/trader",      // Trader portal has its own auth
  "/api",         // API routes handle their own auth
];

function isPublicRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Public pages: render children directly — no session providers
  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  // Protected pages (dashboard, settings, etc.): full session stack
  return (
    <SingleSessionProvider>
      <SessionTimeoutProvider>
        {children}
      </SessionTimeoutProvider>

      <Suspense fallback={null}>
        <SessionExpiredModal />
      </Suspense>

      <ChatBot />
    </SingleSessionProvider>
  );
}
