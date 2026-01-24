// ============================================================================
// middleware.ts 
// NaijaMarket Intel - Route Protection Middleware
// Version: 1.0.1 - Clean (No Unused Variables)
// Date: 2026-01-24
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
];

// Routes that redirect to dashboard if already authenticated
const AUTH_ROUTES = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/api/auth") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Get the session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = !!token;
  const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // User NOT authenticated trying to access protected route → redirect to login
  if (!isAuthenticated && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    response.headers.set("Pragma", "no-cache");
    
    return response;
  }

  // User IS authenticated trying to access login/register → redirect to dashboard
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Protected route with valid auth → add no-cache headers (prevents back-button issue)
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
