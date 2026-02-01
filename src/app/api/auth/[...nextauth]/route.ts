// src/app/api/auth/[...nextauth]/route.ts
// NaijaMarket Intel - NextAuth Configuration
// UPDATED: 2026-01-31 - Added Email+Password LOGIN for Business+ tiers
// 
// LOGIN METHODS:
// 1. Phone + WhatsApp OTP (All tiers) - EXISTING
// 2. Email + Password (BUSINESS, CORPORATE, ENTERPRISE only) - NEW
//
// Both methods share the same session_token for single-session enforcement

import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ============================================================================
// CONSTANTS
// ============================================================================

// Tiers that can use email login
const EMAIL_LOGIN_TIERS = ["BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"];

// Rate limiting
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatPhoneNumber(phone: string, countryCode?: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  
  if (cleaned.startsWith("+")) {
    return cleaned.substring(1);
  }
  
  if (countryCode) {
    const cleanCountryCode = countryCode.replace("+", "");
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.startsWith(cleanCountryCode)) {
      return cleaned;
    }
    return cleanCountryCode + cleaned;
  }
  
  if (cleaned.startsWith("0")) {
    return "234" + cleaned.substring(1);
  }
  
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
    // ========================================================================
    // PROVIDER 1: Phone + OTP (All Tiers) - EXISTING
    // ========================================================================
    CredentialsProvider({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone Number", type: "text" },
        countryCode: { label: "Country Code", type: "text" },
        otp: { label: "OTP Code", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.phone || !credentials?.otp) {
          throw new Error("Phone number and OTP are required");
        }

        const phone = formatPhoneNumber(credentials.phone, credentials.countryCode);
        const otp = credentials.otp;

        console.log("[AUTH:PHONE] ═══════════════════════════════════════════════");
        console.log("[AUTH:PHONE] Login attempt for:", phone);

        try {
          // Check OTP in OTP_Codes table
          const otpRecord = await prisma.oTP_Codes.findFirst({
            where: {
              identifier: phone,
              code: otp,
              type: "phone",
              verified: true,
              expires_at: { gt: new Date() }
            },
            orderBy: { created_at: "desc" }
          });

          if (!otpRecord) {
            // Try to verify unverified OTP
            const unverifiedOtp = await prisma.oTP_Codes.findFirst({
              where: {
                identifier: phone,
                code: otp,
                type: "phone",
                verified: false,
                expires_at: { gt: new Date() }
              }
            });
            
            if (unverifiedOtp) {
              await prisma.oTP_Codes.update({
                where: { id: unverifiedOtp.id },
                data: { verified: true }
              });
            } else {
              throw new Error("Invalid or expired OTP");
            }
          }

          console.log("[AUTH:PHONE] ✅ OTP verified");

          // Find consumer by phone
          let consumer = await prisma.consumers.findFirst({
            where: { phone_number: phone }
          });

          if (!consumer) {
            // Try partial match
            const phoneLastDigits = phone.slice(-9);
            consumer = await prisma.consumers.findFirst({
              where: { phone_number: { endsWith: phoneLastDigits } }
            });
          }

          if (!consumer) {
            throw new Error("No account found with this phone number. Please register first.");
          }

          // Check account status
          if (consumer.account_status === "BLOCKED" || consumer.account_status === "BANNED") {
            throw new Error("Your account has been suspended. Please contact support.");
          }

          // Log old session to history if exists
          if (consumer.session_token) {
            try {
              await prisma.$executeRaw`
                INSERT INTO Consumer_Session_History 
                  (consumer_id, phone_number, session_token, login_at, logout_at, logout_reason)
                VALUES (${consumer.consumer_id}, ${consumer.phone_number}, ${consumer.session_token}, 
                        ${consumer.session_created_at}, GETDATE(), 'NEW_LOGIN')
              `;
            } catch (e) { /* History table may not exist */ }
          }

          // Generate new session token
          const newSessionToken = generateSessionToken();
          const ipAddress = String(req?.headers?.["x-forwarded-for"] || "unknown").substring(0, 45);
          const userAgent = String(req?.headers?.["user-agent"] || "unknown").substring(0, 500);

          await prisma.consumers.update({
            where: { id: consumer.id },
            data: {
              session_token: newSessionToken,
              session_created_at: new Date(),
              session_ip_address: ipAddress,
              session_user_agent: userAgent,
              last_active_at: new Date(),
              updated_at: new Date(),
              failed_login_attempts: 0,
              locked_until: null
            }
          });

          const displayName = consumer.full_name 
            || `${consumer.first_name || ''} ${consumer.last_name || ''}`.trim() 
            || consumer.consumer_name
            || `User ${phone.slice(-4)}`;

          console.log("[AUTH:PHONE] ✅ SUCCESS -", displayName, "| Tier:", consumer.subscription_tier);

          return {
            id: consumer.consumer_id,
            phone: consumer.phone_number,
            email: consumer.email || null,
            name: displayName,
            tier: consumer.subscription_tier || "FREE",
            status: consumer.account_status || "ACTIVE",
            sessionToken: newSessionToken,
            authMethod: "phone",
          };
        } catch (error: any) {
          console.error("[AUTH:PHONE] ❌ Error:", error.message);
          throw new Error(error.message || "Authentication failed");
        }
      },
    }),

    // ========================================================================
    // PROVIDER 2: Email + Password (Business+ Tiers Only) - NEW
    // ========================================================================
    CredentialsProvider({
      id: "email-password",
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const email = credentials.email.toLowerCase().trim();
        const password = credentials.password;

        console.log("[AUTH:EMAIL] ═══════════════════════════════════════════════");
        console.log("[AUTH:EMAIL] Login attempt for:", email);

        try {
          // Find consumer by email
          const consumer = await prisma.consumers.findFirst({
            where: { email: email }
          });

          if (!consumer) {
            console.log("[AUTH:EMAIL] ❌ No account found for email");
            throw new Error("No account found with this email. Please use phone login or register first.");
          }

          // Check if email login is allowed for this tier
          const tier = (consumer.subscription_tier || "FREE").toUpperCase();
          if (!EMAIL_LOGIN_TIERS.includes(tier)) {
            console.log("[AUTH:EMAIL] ❌ Email login not allowed for tier:", tier);
            throw new Error(`Email login is available for Business, Corporate, and Enterprise tiers only. Your tier: ${consumer.subscription_tier}. Please use phone login.`);
          }

          // Check if email is verified
          if (!consumer.email_verified) {
            console.log("[AUTH:EMAIL] ❌ Email not verified");
            throw new Error("Please verify your email before using email login.");
          }

          // Check account status
          if (consumer.account_status === "BLOCKED" || consumer.account_status === "BANNED") {
            throw new Error("Your account has been suspended. Please contact support.");
          }

          // Check account lockout
          if (consumer.locked_until) {
            const lockUntil = new Date(consumer.locked_until);
            if (lockUntil > new Date()) {
              const minutesLeft = Math.ceil((lockUntil.getTime() - Date.now()) / 60000);
              console.log("[AUTH:EMAIL] ❌ Account locked for", minutesLeft, "more minutes");
              throw new Error(`Account temporarily locked. Please try again in ${minutesLeft} minutes.`);
            }
          }

          // Verify password
          if (!consumer.password_hash) {
            console.log("[AUTH:EMAIL] ❌ No password set");
            throw new Error("No password set for this account. Please use 'Forgot Password' to set one, or use phone login.");
          }

          const passwordValid = await bcrypt.compare(password, consumer.password_hash);

          if (!passwordValid) {
            // Increment failed attempts
            const newAttempts = (consumer.failed_login_attempts || 0) + 1;
            
            if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
              // Lock account
              const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
              await prisma.consumers.update({
                where: { id: consumer.id },
                data: { 
                  failed_login_attempts: newAttempts,
                  locked_until: lockUntil
                }
              });
              console.log("[AUTH:EMAIL] ❌ Account locked after", newAttempts, "attempts");
              throw new Error(`Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`);
            } else {
              await prisma.consumers.update({
                where: { id: consumer.id },
                data: { failed_login_attempts: newAttempts }
              });
              const remaining = MAX_LOGIN_ATTEMPTS - newAttempts;
              console.log("[AUTH:EMAIL] ❌ Invalid password. Attempts remaining:", remaining);
              throw new Error(`Invalid password. ${remaining} attempts remaining.`);
            }
          }

          console.log("[AUTH:EMAIL] ✅ Password verified");

          // Log old session to history if exists
          if (consumer.session_token) {
            try {
              await prisma.$executeRaw`
                INSERT INTO Consumer_Session_History 
                  (consumer_id, phone_number, session_token, login_at, logout_at, logout_reason)
                VALUES (${consumer.consumer_id}, ${consumer.phone_number}, ${consumer.session_token}, 
                        ${consumer.session_created_at}, GETDATE(), 'NEW_LOGIN')
              `;
            } catch (e) { /* History table may not exist */ }
          }

          // Generate new session token
          const newSessionToken = generateSessionToken();
          const ipAddress = String(req?.headers?.["x-forwarded-for"] || "unknown").substring(0, 45);
          const userAgent = String(req?.headers?.["user-agent"] || "unknown").substring(0, 500);

          await prisma.consumers.update({
            where: { id: consumer.id },
            data: {
              session_token: newSessionToken,
              session_created_at: new Date(),
              session_ip_address: ipAddress,
              session_user_agent: userAgent,
              last_active_at: new Date(),
              updated_at: new Date(),
              failed_login_attempts: 0,
              locked_until: null
            }
          });

          const displayName = consumer.full_name 
            || `${consumer.first_name || ''} ${consumer.last_name || ''}`.trim() 
            || consumer.consumer_name
            || email.split('@')[0];

          console.log("[AUTH:EMAIL] ✅ SUCCESS -", displayName, "| Tier:", consumer.subscription_tier);

          return {
            id: consumer.consumer_id,
            phone: consumer.phone_number || null,
            email: consumer.email,
            name: displayName,
            tier: consumer.subscription_tier || "FREE",
            status: consumer.account_status || "ACTIVE",
            sessionToken: newSessionToken,
            authMethod: "email",
          };
        } catch (error: any) {
          console.error("[AUTH:EMAIL] ❌ Error:", error.message);
          throw new Error(error.message || "Authentication failed");
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.phone = (user as any).phone;
        token.email = (user as any).email;
        token.tier = (user as any).tier;
        token.status = (user as any).status;
        token.name = user.name;
        token.sessionToken = (user as any).sessionToken;
        token.authMethod = (user as any).authMethod;
      }

      // Refresh tier from database periodically
      if (token.id) {
        try {
          const consumer = await prisma.consumers.findFirst({
            where: { consumer_id: token.id as string }
          });

          if (consumer) {
            token.tier = consumer.subscription_tier || "FREE";
            token.status = consumer.account_status || "ACTIVE";
            token.email = consumer.email || token.email;
            
            const newName = consumer.full_name 
              || `${consumer.first_name || ''} ${consumer.last_name || ''}`.trim()
              || consumer.consumer_name;
            if (newName) token.name = newName;
          }
        } catch (error) {
          console.error("[JWT] Error refreshing user data:", error);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).phone = token.phone;
        (session.user as any).email = token.email;
        (session.user as any).tier = token.tier;
        (session.user as any).status = token.status;
        (session.user as any).sessionToken = token.sessionToken;
        (session.user as any).authMethod = token.authMethod;
        session.user.name = token.name as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
