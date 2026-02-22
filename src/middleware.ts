// ============================================================================
// middleware.ts 
// NaijaMarket Intel - Route Protection Middleware
// Version: 2.2.0 - Fixed session expiry on tab switch + added public pages
// Date: 2026-02-22
// 
// CHANGES FROM v2.1.0:
// - v2.2.0: Added /privacy, /terms, /docs, /contact to public routes
// - v2.2.0: Extended session validation cache from 5min to 30min
// - v2.2.0: Don't redirect to sessionExpired on validation errors (allow through)
// - v2.2.0: Skip session DB validation for non-API GET requests (page views)
// - v2.1.0: Added /trader/* exclusion
// - v2.0.0: Single session enforcement
// ============================================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// ============================================================================
// ROUTE CONFIGURATION
// ============================================================================

// Routes that DON'T require authentication (public pages)
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/privacy",
  "/terms",
  "/docs",
  "/contact",
  "/api/auth",
  "/api/public",
  "/api/health",
];

// Routes that require authentication
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/prices",
  "/analytics",
  "/alerts",
  "/settings",
  "/watchlist",
  "/compare",
  "/arbitrage",
  "/inflation",
  "/subscribe",
];

// Protected API routes (need session validation)
const PROTECTED_API_PREFIXES = [
  "/api/prices",
  "/api/analytics",
  "/api/alerts",
  "/api/user",
  "/api/subscribe",
  "/api/settings",
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isProtectedApiRoute(pathname: string): boolean {
  return PROTECTED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── SKIP: Trader portal (uses separate JWT auth) ──────────────────────
  if (pathname.startsWith("/trader") || pathname.startsWith("/api/trader")) {
    return NextResponse.next();
  }

  // ── SKIP: Static files, images, Next.js internals ─────────────────────
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/static/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // ── SKIP: Public routes (no auth needed) ──────────────────────────────
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // ── GET SESSION TOKEN ─────────────────────────────────────────────────
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const isAuthenticated = !!token;

  // ── CASE 1: Unauthenticated user on protected route → login ───────────
  if (!isAuthenticated && (isProtectedRoute(pathname) || isProtectedApiRoute(pathname))) {
    // API routes get 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Page routes redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── CASE 2: Authenticated user on login/register → dashboard ──────────
  if (isAuthenticated && (pathname === "/login" || pathname === "/register")) {
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    // Clear stale session validation cache on login redirect
    // This ensures a fresh validation cycle after re-authentication
    response.cookies.delete("session_validated");
    return response;
  }

  // ── CASE 3: Authenticated user on protected route ─────────────────────
  // v2.2.0: RELAXED session validation
  // Only validate session against DB for protected API calls (mutations)
  // For regular page views, trust the JWT token — don't hit DB
  if (isAuthenticated && isProtectedRoute(pathname)) {
    // v2.2.0: For page GET requests, just set no-cache headers
    // Do NOT validate session against DB — this prevents the "tab switch = logout" bug
    const response = NextResponse.next();
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0"
    );
    response.headers.set("Pragma", "no-cache");
    return response;
  }

  // ── CASE 4: Authenticated API calls — validate session if needed ──────
  if (isAuthenticated && isProtectedApiRoute(pathname)) {
    // Check session validation cache (30-minute window)
    const sessionValidated = request.cookies.get("session_validated")?.value;
    const now = Date.now();

    if (sessionValidated) {
      const lastValidated = parseInt(sessionValidated, 10);
      const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (was 5 min)
      if (now - lastValidated < CACHE_DURATION) {
        // Still within cache window — allow through
        return NextResponse.next();
      }
    }

    // Session needs revalidation against DB
    try {
      const sessionToken =
        request.cookies.get("next-auth.session-token")?.value ||
        request.cookies.get("__Secure-next-auth.session-token")?.value;

      if (sessionToken && token?.email) {
        const validateUrl = new URL("/api/auth/validate-session", request.url);
        const validateResponse = await fetch(validateUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionToken,
            email: token.email,
          }),
        });

        if (validateResponse.ok) {
          const data = await validateResponse.json();

          if (!data.valid) {
            // v2.2.0: Only redirect for actual invalid sessions (logged in elsewhere)
            // NOT for temporary errors or missing session records
            if (data.reason === "session_replaced") {
              const loginUrl = new URL("/login", request.url);
              loginUrl.searchParams.set("sessionExpired", "true");
              const response = NextResponse.redirect(loginUrl);
              response.cookies.delete("session_validated");
              return response;
            }
          }

          // Session valid — update cache timestamp
          const response = NextResponse.next();
          response.cookies.set("session_validated", now.toString(), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 30 * 60, // 30 minutes
            path: "/",
          });
          return response;
        }
      }
    } catch (error) {
      // v2.2.0: On ANY validation error, ALLOW the request through
      // Don't log out users due to temporary issues
      console.error("[MIDDLEWARE] Session validation error (allowing through):", error);
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
