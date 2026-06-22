import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // API routes: return JSON 401 (not an HTML redirect) when unauthenticated.
    // /api/auth/* is excluded by the matcher so NextAuth keeps working.
    if (pathname.startsWith('/api')) {
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.next();
    }

    // Allow access to login page
    if (pathname === '/login') {
      if (token) {
        // Already logged in, redirect to dashboard
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
      return NextResponse.next();
    }

    // Check role-based access for specific routes
    if (pathname.startsWith('/dashboard/users') && token?.role === 'viewer') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    if (pathname.startsWith('/dashboard/financial') && 
        !['super_admin', 'admin', 'supervisor', 'analyst'].includes(token?.role as string)) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    if (pathname.startsWith('/dashboard/fraud') && token?.role === 'viewer') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        
        // Allow login page without auth
        if (pathname === '/login') {
          return true;
        }

        // API routes always enter the middleware body so we can return a
        // JSON 401 there instead of withAuth's default HTML redirect.
        if (pathname.startsWith('/api')) {
          return true;
        }

        // Require auth for all other routes
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/((?!auth).*)',
    '/login',
  ],
};
