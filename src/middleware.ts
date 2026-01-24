// ============================================================================
// middleware.ts (ROOT OF PROJECT - same level as src/)
// NaijaMarket Intel - Route Protection Middleware
// Version: 1.0.0 - Comprehensive Auth Protection
// Date: 2026-01-24
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
  "/api/subscribe", // Protect subscription API
  "/api/watchlist",
  "/api/alerts",
  "/api/user",
];

// Routes that should redirect to dashboard if already authenticated
const AUTH_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
];

// Public routes (no protection needed)
const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/contact",
  "/pricing",
  "/api/auth", // NextAuth routes must be public
  "/api/markets", // Public market data
  "/api/prices", // Public price data
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") // Files with extensions (images, etc.)
  ) {
    return NextResponse.next();
  }

  // Get the session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = !!token;

  // Check if current path is protected
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname.startsWith(route)
  );

  // Check if current path is an auth route (login, register, etc.)
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname.startsWith(route)
  );

  // CASE 1: User is NOT authenticated and trying to access protected route
  if (!isAuthenticated && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    
    const response = NextResponse.redirect(loginUrl);
    
    // Add cache-control headers to prevent back-button issues
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    
    return response;
  }

  // CASE 2: User IS authenticated and trying to access auth routes (login, register)
  if (isAuthenticated && isAuthRoute) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // CASE 3: Protected route with valid authentication
  if (isProtectedRoute && isAuthenticated) {
    const response = NextResponse.next();
    
    // CRITICAL: Add cache-control headers to prevent back-button access after logout
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    
    // Prevent the page from being stored in browser history cache
    response.headers.set("Surrogate-Control", "no-store");
    
    return response;
  }

  // CASE 4: Public routes - allow access
  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
