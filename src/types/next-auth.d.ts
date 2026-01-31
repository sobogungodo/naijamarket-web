// src/types/next-auth.d.ts
// NextAuth TypeScript Type Definitions
// Version: 2.0.0 - Added sessionToken for single-session support
// Date: 2026-01-31

import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      phone: string;
      tier: string;
      status: string;
      sessionToken: string; // ✅ NEW: For single-session validation
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    phone: string;
    tier: string;
    status: string;
    sessionToken: string; // ✅ NEW: For single-session validation
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    phone: string;
    tier: string;
    status: string;
    sessionToken: string; // ✅ NEW: For single-session validation
  }
}
