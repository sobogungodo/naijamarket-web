// ============================================================================
// middleware.ts 
// NaijaMarket Intel - Route Protection Middleware + Single Session Validation
// Version: 2.1.0 - Added public content routes to skip list
// Date: 2026-02-23
// 
// CHANGES FROM v2.0.0:
// - Added /about, /privacy, /ndpr, /blog, /terms, /contact to skip list
// - Fixes 404 → back button → forced login redirect bug
// ============================================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

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
  "/food-news",
  "/terms",
  "/contact",
];

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
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/api/inflation") ||
    pathname.startsWith("/api/subscribe-email") ||
    pathname.startsWith("/api/unsubscribe") ||
    pathname.includes(".") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons") ||
    PUBLIC_CONTENT_ROUTES.some((route) => pathname.startsWith(route))
  ) {
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
    loginUrl.searchParams.set("callbackUrl", pathname);
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
    const lastValidated = request.cookies.get("session_validated")?.value;
    const now = Date.now();

    if (lastValidated) {
      const lastValidatedTime = parseInt(lastValidated, 10);
      const timeSinceValidation = now - lastValidatedTime;
      if (timeSinceValidation < 5 * 60 * 1000) {
        const response = NextResponse.next();
        response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
        response.headers.set("Pragma", "no-cache");
        response.headers.set("Expires", "0");
        return response;
      }
    }

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
          const loginUrl = new URL("/login", request.url);
          loginUrl.searchParams.set("error", validationResult.error_code);
          loginUrl.searchParams.set("callbackUrl", pathname);
          const response = NextResponse.redirect(loginUrl);
          response.cookies.delete("session_validated");
          return response;
        }

        const response = NextResponse.next();
        response.cookies.set("session_validated", now.toString(), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 5 * 60,
          path: "/",
        });
        response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
        response.headers.set("Pragma", "no-cache");
        response.headers.set("Expires", "0");
        return response;
      }
    } catch (error) {
      console.error("[MIDDLEWARE] Validation error:", error);
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
    "/((?!_next/static|_next/image|favicon.ico|public|images|icons).*)",
  ],
};


