// src/app/api/auth/[...nextauth]/route.ts
// NaijaMarket Intel - NextAuth Configuration
// UPDATED: 2026-02-25 - Replaced email+password with email+OTP via session_token
//
// LOGIN METHODS:
// 1. phone-otp    → Phone + WhatsApp OTP (All tiers)
// 2. email-otp    → Email + OTP via session_token (Business+ tiers) ← NEW
// 3. email-password → DEPRECATED — kept for backwards compat, remove later

import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ============================================================================
// CONSTANTS
// ============================================================================

const EMAIL_LOGIN_TIERS = ["BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"];

// ============================================================================
// HELPERS
// ============================================================================

function formatPhoneNumber(phone: string, countryCode?: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("+")) return cleaned.substring(1);
  if (countryCode) {
    const cleanCC = countryCode.replace("+", "");
    if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
    if (cleaned.startsWith(cleanCC)) return cleaned;
    return cleanCC + cleaned;
  }
  if (cleaned.startsWith("0")) return "234" + cleaned.substring(1);
  return cleaned;
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ============================================================================
// NEXTAUTH OPTIONS
// ============================================================================

const authOptions: NextAuthOptions = {
  providers: [

    // =========================================================================
    // PROVIDER 1: Phone + OTP (All Tiers) — UNCHANGED
    // =========================================================================
    CredentialsProvider({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        phone:       { label: "Phone Number", type: "text" },
        countryCode: { label: "Country Code", type: "text" },
        otp:         { label: "OTP Code",     type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.otp) {
          throw new Error("Phone number and OTP are required");
        }

        const phone = formatPhoneNumber(credentials.phone, credentials.countryCode);
        const otp   = credentials.otp;

        console.log("[AUTH:PHONE] ══════════════════════════════════════════════");
        console.log("[AUTH:PHONE] Login attempt for:", phone);

        try {
          // Check verified OTP
          let otpRecord = await prisma.oTP_Codes.findFirst({
            where: {
              identifier: phone,
              code:       otp,
              type:       "phone",
              verified:   true,
              expires_at: { gt: new Date() },
            },
            orderBy: { created_at: "desc" },
          });

          // Also accept unverified (just-entered) OTP and mark it
          if (!otpRecord) {
            const unverified = await prisma.oTP_Codes.findFirst({
              where: {
                identifier: phone,
                code:       otp,
                type:       "phone",
                verified:   false,
                expires_at: { gt: new Date() },
              },
            });
            if (unverified) {
              await prisma.oTP_Codes.update({
                where: { id: unverified.id },
                data:  { verified: true },
              });
            } else {
              throw new Error("Invalid or expired OTP");
            }
          }

          console.log("[AUTH:PHONE] ✅ OTP verified");

          // Find consumer — exact match first, then suffix fallback
          let consumer = await prisma.consumers.findFirst({
            where: { phone_number: phone },
          });
          if (!consumer) {
            const last9 = phone.slice(-9);
            consumer = await prisma.consumers.findFirst({
              where: { phone_number: { endsWith: last9 } },
            });
          }
          if (!consumer) {
            throw new Error("No account found with this phone number. Please register first.");
          }

          if (consumer.account_status === "BLOCKED" || consumer.account_status === "BANNED") {
            throw new Error("Your account has been suspended. Please contact support.");
          }

          await prisma.consumers.update({
            where: { consumer_id: consumer.consumer_id },
            data:  { updated_at: new Date() },
          });

          const displayName =
            consumer.full_name ||
            `${consumer.first_name || ""} ${consumer.last_name || ""}`.trim() ||
            `User ${phone.slice(-4)}`;

          console.log("[AUTH:PHONE] ✅ SUCCESS —", displayName, "| Tier:", consumer.subscription_tier);

          return {
            id:           consumer.consumer_id,
            phone:        consumer.phone_number,
            email:        consumer.email || null,
            name:         displayName,
            tier:         consumer.subscription_tier || "FREE",
            status:       consumer.account_status   || "ACTIVE",
            sessionToken: generateSessionToken(),
            authMethod:   "phone",
          };
        } catch (error: any) {
          console.error("[AUTH:PHONE] ❌", error.message);
          throw new Error(error.message || "Authentication failed");
        }
      },
    }),

    // =========================================================================
    // PROVIDER 2: Email + OTP via session_token (Business+ Tiers) — NEW
    // =========================================================================
    // Flow:
    //   1. User clicks Email tab → enters email
    //   2. /api/auth/send-email-otp sends 6-digit code
    //   3. User enters code → /api/auth/login validates it,
    //      creates session_token in Consumers table, returns it
    //   4. Frontend calls signIn("email-otp", { session_token, consumer_id })
    //   5. THIS provider validates the token against the DB
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

        const { session_token, consumer_id } = credentials;

        console.log("[AUTH:EMAIL-OTP] ══════════════════════════════════════════");
        console.log("[AUTH:EMAIL-OTP] Validating session token for:", consumer_id);

        try {
          // Validate session_token against DB
          // /api/auth/login stored it in Consumers.session_token
          const consumer = await prisma.consumers.findFirst({
            where: {
              consumer_id:   consumer_id,
              session_token: session_token,
            },
          });

          if (!consumer) {
            console.log("[AUTH:EMAIL-OTP] ❌ Invalid session token");
            throw new Error("Invalid or expired login session. Please try again.");
          }

          // Tier check — email login is Business+ only
          const tier = (consumer.subscription_tier || "FREE").toUpperCase();
          if (!EMAIL_LOGIN_TIERS.includes(tier)) {
            console.log("[AUTH:EMAIL-OTP] ❌ Tier not allowed:", tier);
            throw new Error(
              `Email login is available for Business, Corporate, and Enterprise tiers only. ` +
              `Your tier: ${consumer.subscription_tier}. Please use phone login.`
            );
          }

          // Account status check
          if (consumer.account_status === "BLOCKED" || consumer.account_status === "BANNED") {
            throw new Error("Your account has been suspended. Please contact support.");
          }

          // Update last activity
          await prisma.consumers.update({
            where: { consumer_id: consumer.consumer_id },
            data:  { updated_at: new Date(), last_activity_at: new Date() },
          });

          const displayName =
            consumer.full_name ||
            `${consumer.first_name || ""} ${consumer.last_name || ""}`.trim() ||
            (consumer.email ? consumer.email.split("@")[0] : "User");

          console.log("[AUTH:EMAIL-OTP] ✅ SUCCESS —", displayName, "| Tier:", consumer.subscription_tier);

          return {
            id:           consumer.consumer_id,
            phone:        consumer.phone_number || null,
            email:        consumer.email,
            name:         displayName,
            tier:         consumer.subscription_tier || "FREE",
            status:       consumer.account_status   || "ACTIVE",
            sessionToken: session_token,   // reuse the same token
            authMethod:   "email-otp",
          };
        } catch (error: any) {
          console.error("[AUTH:EMAIL-OTP] ❌", error.message);
          throw new Error(error.message || "Authentication failed");
        }
      },
    }),

    // =========================================================================
    // PROVIDER 3: Email + Password — DEPRECATED
    // Kept for backwards compat. Remove after all users migrate to email-otp.
    // =========================================================================
    CredentialsProvider({
      id: "email-password",
      name: "Email and Password",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const email    = credentials.email.toLowerCase().trim();
        const password = credentials.password;

        console.log("[AUTH:EMAIL-PWD] ══════════════════════════════════════════");
        console.log("[AUTH:EMAIL-PWD] Login attempt for:", email);

        try {
          const consumer = await prisma.consumers.findFirst({
            where: { email },
          });

          if (!consumer) {
            throw new Error("No account found with this email. Please use phone login or register first.");
          }

          const tier = (consumer.subscription_tier || "FREE").toUpperCase();
          if (!EMAIL_LOGIN_TIERS.includes(tier)) {
            throw new Error(
              `Email login requires Business tier or above. ` +
              `Your tier: ${consumer.subscription_tier}. Please use phone login.`
            );
          }

          if (!consumer.email_verified) {
            throw new Error("Please verify your email before logging in.");
          }

          if (consumer.account_status === "BLOCKED" || consumer.account_status === "BANNED") {
            throw new Error("Your account has been suspended. Please contact support.");
          }

          if (!consumer.password_hash) {
            // No password — redirect them to email OTP
            throw new Error("This account uses email OTP login. Please use the Email Login tab and click 'Send Verification Code'.");
          }

          const passwordValid = await bcrypt.compare(password, consumer.password_hash);
          if (!passwordValid) {
            throw new Error("Invalid password. Please try again.");
          }

          await prisma.consumers.update({
            where: { consumer_id: consumer.consumer_id },
            data:  { updated_at: new Date() },
          });

          const displayName =
            consumer.full_name ||
            `${consumer.first_name || ""} ${consumer.last_name || ""}`.trim() ||
            email.split("@")[0];

          console.log("[AUTH:EMAIL-PWD] ✅ SUCCESS —", displayName);

          return {
            id:           consumer.consumer_id,
            phone:        consumer.phone_number || null,
            email:        consumer.email,
            name:         displayName,
            tier:         consumer.subscription_tier || "FREE",
            status:       consumer.account_status   || "ACTIVE",
            sessionToken: generateSessionToken(),
            authMethod:   "email-password",
          };
        } catch (error: any) {
          console.error("[AUTH:EMAIL-PWD] ❌", error.message);
          throw new Error(error.message || "Authentication failed");
        }
      },
    }),
  ],

  // ============================================================================
  // SESSION
  // ============================================================================
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },

  // ============================================================================
  // CALLBACKS
  // ============================================================================
  callbacks: {
    async jwt({ token, user }) {
      // On first sign-in, attach user fields to JWT
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

      // Refresh live data from DB on every JWT refresh
      if (token.id) {
        try {
          const consumer = await prisma.consumers.findFirst({
            where: { consumer_id: token.id as string },
            select: {
              subscription_tier: true,
              account_status:    true,
              email:             true,
              full_name:         true,
              first_name:        true,
              last_name:         true,
            },
          });

          if (consumer) {
            token.tier   = consumer.subscription_tier || "FREE";
            token.status = consumer.account_status    || "ACTIVE";
            token.email  = consumer.email             || token.email;

            const refreshedName =
              consumer.full_name ||
              `${consumer.first_name || ""} ${consumer.last_name || ""}`.trim();
            if (refreshedName) token.name = refreshedName;
          }
        } catch (error) {
          console.error("[JWT] Error refreshing user data:", error);
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
