// ============================================================================
// middleware.ts 
// NaijaMarket Intel - Route Protection Middleware + Single Session Validation
// Version: 2.2.0 - Merged PWA routes into the live (src/) middleware
// Date: 2026-06-23
//
// CHANGES FROM v2.1.0:
// - Added /offline, /pricing to PUBLIC_CONTENT_ROUTES
// - Added /api/mobile, /api/push to skip list (PWA push notifications)
// - Added /sw.js and /manifest.json to static file checks
// - Note: these were previously authored in a root middleware.ts that Next.js
//   never loaded (app lives in src/, so src/middleware.ts is the active file).
//   That dead root file has now been deleted.
//
// CHANGES FROM v2.0.0:
// - Added /about, /privacy, /ndpr, /blog, /terms, /contact to skip list
// - Fixes 404 → back button → forced login redirect bug
// ============================================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { jwtVerify } from "jose";

// Routes that require authentication
const PROTECTED_ROUTES = [
  "/dashboard",
  "/subscribe",
  "/settings",
  "/profile",
  "/watchlist",
  "/alerts",
  "/prices",
  "/analytics",
  "/compare",
  "/arbitrage",
  "/inflation",
];

// Routes that redirect to dashboard if already authenticated
const AUTH_ROUTES = ["/login", "/register"];

// API routes that need session validation
const PROTECTED_API_ROUTES = [
  "/api/prices",
  "/api/analytics",
  "/api/alerts",
  "/api/user",
  "/api/subscribe",
  "/api/settings",
];

// Public content routes — never require authentication
const PUBLIC_CONTENT_ROUTES = [
  "/about",
  "/privacy",
  "/ndpr",
  "/blog",
  "/food-news",
  "/terms",
  "/contact",
  "/offline",      // PWA offline page
  "/pricing",      // Pricing page
];

// Verify a mobile consumer Bearer JWT (jose is Edge-runtime safe). Returns true
// only for a valid, unexpired token signed with CONSUMER_JWT_SECRET. Used to let
// the consumer app reach /api/subscribe (it carries a Bearer, not a NextAuth cookie).
async function hasConsumerBearer(request: NextRequest): Promise<boolean> {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  // Same secret the mobile query-gate uses to verify these tokens.
  // (CONSUMER_JWT_SECRET is set in Vercel prod; verified 2026-07-03.)
  const secret = process.env.CONSUMER_JWT_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(auth.slice(7), new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ═══════════════════════════════════════════════════════════════════════════
  // SKIP: Static files, Next.js internals, auth APIs, and public content
  // ═══════════════════════════════════════════════════════════════════════════
  if (
    pathname === "/" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/auth/kicked") ||
    pathname.startsWith("/api/health") ||
    pathname === "/api/alerts/process" || // cron target — carries its own fail-closed CRON_SECRET auth

    pathname.startsWith("/api/public") ||
    pathname.startsWith("/api/inflation") ||
    pathname.startsWith("/api/subscribe-email") ||
    pathname.startsWith("/api/unsubscribe") ||
    pathname.startsWith("/api/waitlist") ||
    pathname.startsWith("/api/mobile") ||
    pathname.startsWith("/api/push") ||        // PWA push notification APIs
    pathname.startsWith("/subscribe/callback") || // post-payment landing: verifies ref + deep-links to app (no session; reached from Paystack redirect in a cookieless browser)
    pathname.startsWith("/api/subscribe/verify") || // payment verification called client-side from the callback page (cookieless); idempotent + Paystack-reference-keyed
    pathname === "/sw.js" ||                   // Service worker
    pathname === "/manifest.json" ||           // PWA manifest
    pathname.includes(".") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons") ||
    PUBLIC_CONTENT_ROUTES.some((route) => pathname.startsWith(route))
  ) {
    return NextResponse.next();
  }

  // Mobile app lane: the consumer app hits /api/subscribe (tiers + payment init)
  // with a CONSUMER_JWT_SECRET Bearer token — it has no NextAuth cookie, so it
  // would otherwise 401 here and the app's global 401 handler would log the user
  // out (login loop on the /plans screen). Let a VERIFIED consumer token through;
  // the public still can't reach the phone-status lookup.
  if (pathname.startsWith("/api/subscribe") && (await hasConsumerBearer(request))) {
    return NextResponse.next();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET JWT TOKEN
  // ═══════════════════════════════════════════════════════════════════════════

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = !!token;
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = AUTH_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isProtectedApiRoute = PROTECTED_API_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // CASE 1: Not authenticated → protected route → login
  if (!isAuthenticated && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    // Preserve the full destination (path + query) so flags like ?app=1 survive
    // the login round-trip — without the query, the mobile-app upgrade flow loses
    // its origin marker and the post-payment deep link never fires.
    loginUrl.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    response.headers.set("Pragma", "no-cache");
    return response;
  }

  // CASE 2: Not authenticated → protected API → 401
  if (!isAuthenticated && isProtectedApiRoute) {
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED", message: "Please log in to continue" },
      { status: 401 }
    );
  }

  // CASE 3: Authenticated → login/register → dashboard
  if (isAuthenticated && isAuthRoute) {
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.delete("session_validated");
    return response;
  }

  // CASE 4: Authenticated → protected route → validate session + no-cache
  if (isAuthenticated && (isProtectedRoute || isProtectedApiRoute)) {
    try {
      const validationUrl = new URL("/api/auth/validate-session", request.url);
      const validationResponse = await fetch(validationUrl.toString(), {
        method: "GET",
        headers: { Cookie: request.headers.get("cookie") || "" },
      });

      if (validationResponse.ok) {
        const validationResult = await validationResponse.json();

        if (!validationResult.valid) {
          console.log("[MIDDLEWARE] Session invalid:", validationResult.error_code);
          if (isProtectedApiRoute) {
            return NextResponse.json(
              { success: false, error: validationResult.error_code, message: validationResult.message },
              { status: 401 }
            );
          }
          const kickUrl = new URL("/auth/kicked", request.url);
          kickUrl.searchParams.set("reason", validationResult.error_code);
          const response1 = NextResponse.redirect(kickUrl);
          response1.cookies.delete("next-auth.session-token");
          response1.cookies.delete("__Secure-next-auth.session-token");
          return response1;
        }

        const response = NextResponse.next();
        response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
        response.headers.set("Pragma", "no-cache");
        response.headers.set("Expires", "0");
        return response;
      } else {
        // validate-session returned non-ok (401/500) — treat as invalid session
        console.log("[MIDDLEWARE] Validation returned non-ok status:", validationResponse.status);
        if (isProtectedApiRoute) {
          return NextResponse.json(
            { success: false, error: "SESSION_INVALID", message: "Session invalid" },
            { status: 401 }
          );
        }
        const kickUrl2 = new URL("/auth/kicked", request.url);
        kickUrl2.searchParams.set("reason", "SESSION_INVALID");
        const response2 = NextResponse.redirect(kickUrl2);
        response2.cookies.delete("next-auth.session-token");
        response2.cookies.delete("__Secure-next-auth.session-token");
        return response2;
      }
    } catch (error) {
      console.error("[MIDDLEWARE] Validation error:", error);
      // Fail-open only on network errors, not on auth failures
    }

    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  }

  // CASE 5: Everything else → pass through
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|images|icons).*)"]
,
};





