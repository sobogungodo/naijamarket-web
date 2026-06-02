// src/app/api/auth/[...nextauth]/route.ts
// NaijaMarket Intel - NextAuth Configuration
// NO DIRECT DB CALLS — all DB access via func-naijamarket-api
// Updated: June 2026

import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const FUNC_BASE = process.env.FUNC_API_BASE_URL || "https://func-naijamarket-api.azurewebsites.net/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function validateSession(consumer_id: string, session_token: string) {
  try {
    const resp = await fetch(`${FUNC_BASE}/validate_session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consumer_id, session_token }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.valid ? data.consumer : null;
  } catch {
    return null;
  }
}

// ── NextAuth Options ──────────────────────────────────────────────────────────

const authOptions: NextAuthOptions = {
  providers: [

    // ── Phone + OTP ───────────────────────────────────────────────────────────
    // Flow: send-otp → user gets OTP → verify-otp → login API returns session_token
    // Frontend calls signIn("phone-otp", { session_token, consumer_id })
    CredentialsProvider({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        session_token: { label: "Session Token", type: "text" },
        consumer_id:   { label: "Consumer ID",   type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.session_token || !credentials?.consumer_id) {
          throw new Error("Session token and consumer ID are required");
        }
        const consumer = await validateSession(
          credentials.consumer_id,
          credentials.session_token
        );
        if (!consumer) {
          throw new Error("Invalid or expired login session. Please try again.");
        }
        if (consumer.status === "BLOCKED" || consumer.status === "BANNED" || consumer.status === "SUSPENDED") {
          throw new Error("Your account has been suspended. Please contact support.");
        }
        return {
          id:           consumer.id,
          phone:        consumer.phone,
          email:        consumer.email,
          name:         consumer.name,
          tier:         consumer.tier,
          status:       consumer.status,
          sessionToken: credentials.session_token,
          authMethod:   "phone",
        };
      },
    }),

    // ── Email + OTP ───────────────────────────────────────────────────────────
    CredentialsProvider({
      id: "email-otp",
      name: "Email OTP",
      credentials: {
        session_token: { label: "Session Token", type: "text" },
        consumer_id:   { label: "Consumer ID",   type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.session_token || !credentials?.consumer_id) {
          throw new Error("Session token and consumer ID are required");
        }
        const consumer = await validateSession(
          credentials.consumer_id,
          credentials.session_token
        );
        if (!consumer) {
          throw new Error("Invalid or expired login session. Please try again.");
        }
        if (consumer.status === "BLOCKED" || consumer.status === "BANNED" || consumer.status === "SUSPENDED") {
          throw new Error("Your account has been suspended. Please contact support.");
        }
        return {
          id:           consumer.id,
          phone:        consumer.phone,
          email:        consumer.email,
          name:         consumer.name,
          tier:         consumer.tier,
          status:       consumer.status,
          sessionToken: credentials.session_token,
          authMethod:   "email-otp",
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },

  callbacks: {
    async jwt({ token, user }) {
      // On first sign-in attach user fields
      if (user) {
        token.id           = user.id;
        token.phone        = (user as any).phone;
        token.email        = (user as any).email;
        token.tier         = (user as any).tier;
        token.status       = (user as any).status;
        token.name         = user.name;
        token.sessionToken = (user as any).sessionToken;
        token.authMethod   = (user as any).authMethod;
      }

      // Refresh tier/status via Azure Function (no direct DB)
      if (token.id && token.sessionToken) {
        try {
          const consumer = await validateSession(
            token.id as string,
            token.sessionToken as string
          );
          if (consumer) {
            token.tier   = consumer.tier;
            token.status = consumer.status;
            token.name   = consumer.name || token.name;
            token.email  = consumer.email || token.email;
          }
        } catch {
          // Non-fatal — keep existing token values
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id           = token.id;
        (session.user as any).phone        = token.phone;
        (session.user as any).email        = token.email;
        (session.user as any).tier         = token.tier;
        (session.user as any).status       = token.status;
        (session.user as any).sessionToken = token.sessionToken;
        (session.user as any).authMethod   = token.authMethod;
        session.user.name                  = token.name as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error:  "/login",
  },

  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
