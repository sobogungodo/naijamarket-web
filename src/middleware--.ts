// ============================================================================
// middleware.ts 
// NaijaMarket Intel - Route Protection Middleware + Single Session Validation
// Version: 2.1.0 - Added trader portal exclusion
// Date: 2026-02-04
// 
// CHANGES FROM PREVIOUS VERSION:
// - v2.1.0: Added /trader/* exclusion (trader portal uses separate JWT auth)
// - v2.0.0: Added session token validation against database
// - Redirects to login if user logged in from another device
// - Caches validation for 5 minutes to reduce database calls
// 
// LOCATION: Can be in project root OR src/ folder
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ============================================================================
  // TRADER PORTAL - Uses separate JWT auth via localStorage
  // Skip ALL middleware checks for trader routes
  // ============================================================================
  if (pathname.startsWith("/trader") || pathname.startsWith("/api/trader")) {
    return NextResponse.next();
  }

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/public") ||
    pathname.includes(".") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons")
  ) {
    return NextResponse.next();
  }

  // Get the session token from NextAuth
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = !!token;
  const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isProtectedApiRoute = PROTECTED_API_ROUTES.some((route) => pathname.startsWith(route));

  // ============================================================================
  // CASE 1: User NOT authenticated trying to access protected route
  // ============================================================================
  if (!isAuthenticated && (isProtectedRoute || isProtectedApiRoute)) {
    // API routes return JSON error
    if (isProtectedApiRoute) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          message: "Please log in to continue",
        },
        { status: 401 }
      );
    }

    // Page routes redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    response.headers.set("Pragma", "no-cache");
    
    return response;
  }

  // ============================================================================
  // CASE 2: User IS authenticated trying to access login/register
  // ============================================================================
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ============================================================================
  // CASE 3: Protected route with valid auth - Validate session token
  // ============================================================================
  if ((isProtectedRoute || isProtectedApiRoute) && isAuthenticated && token.sessionToken) {
    // Check if we've validated recently (within 5 minutes)
    const lastValidated = request.cookies.get("session_validated")?.value;
    const now = Date.now();
    
    if (lastValidated) {
      const lastValidatedTime = parseInt(lastValidated, 10);
      const timeSinceValidation = now - lastValidatedTime;
      
      // If validated within last 5 minutes, skip database check
      if (timeSinceValidation < 5 * 60 * 1000) {
        const response = NextResponse.next();
        response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
        response.headers.set("Pragma", "no-cache");
        response.headers.set("Expires", "0");
        return response;
      }
    }

    // Validate session against database
    try {
      const validationUrl = new URL("/api/auth/validate-session", request.url);
      
      const validationResponse = await fetch(validationUrl.toString(), {
        method: "GET",
        headers: {
          Cookie: request.headers.get("cookie") || "",
        },
      });

      if (validationResponse.ok) {
        const validationResult = await validationResponse.json();

        if (!validationResult.valid) {
          console.log("[MIDDLEWARE] ❌ Session invalid:", validationResult.error_code);

          // API routes return JSON error
          if (isProtectedApiRoute) {
            return NextResponse.json(
              {
                success: false,
                error: validationResult.error_code,
                message: validationResult.message,
              },
              { status: 401 }
            );
          }

          // Page routes redirect to login with error
          const loginUrl = new URL("/login", request.url);
          loginUrl.searchParams.set("error", validationResult.error_code);
          loginUrl.searchParams.set("callbackUrl", pathname);
          
          const response = NextResponse.redirect(loginUrl);
          response.cookies.delete("session_validated");
          response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
          
          return response;
        }

        // Session valid - update validation timestamp
        const response = NextResponse.next();
        response.cookies.set("session_validated", now.toString(), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 5 * 60, // 5 minutes
          path: "/",
        });
        response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
        response.headers.set("Pragma", "no-cache");
        response.headers.set("Expires", "0");
        
        return response;
      }
    } catch (error) {
      console.error("[MIDDLEWARE] Session validation error:", error);
      // On validation error, allow request but don't update cookie
      // This prevents blocking users due to temporary issues
    }
  }

  // ============================================================================
  // CASE 4: Protected route without session token (old sessions)
  // ============================================================================
  if (isProtectedRoute && isAuthenticated) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
