// src/types/next-auth.d.ts
// NextAuth TypeScript Type Definitions

import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      phone: string;
      tier: string;
      status: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    phone: string;
    tier: string;
    status: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    phone: string;
    tier: string;
    status: string;
  }
}
