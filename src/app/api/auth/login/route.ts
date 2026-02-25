// src/app/api/auth/login/route.ts
// NaijaMarket Intel - Unified Login API
// Handles: Phone+OTP login AND Email+OTP login
// Version: 1.0 — 2026-02-25
// Author: NaijaMarket Intel / Giggababytes Oy
//
// PHONE LOGIN FLOW:
//   1. User enters phone → send-otp sends WhatsApp OTP
//   2. User enters OTP → POST /api/auth/login { type:"phone", phone, otp }
//   3. Returns: consumer data + session_token
//   4. Frontend calls signIn("phone-otp", { session_token }) for NextAuth
//
// EMAIL LOGIN FLOW:
//   1. User enters email → send-email-otp sends Email OTP
//   2. User enters OTP → POST /api/auth/login { type:"email", email, otp }
//   3. Returns: consumer data + session_token
//   4. Frontend calls signIn("credentials", { session_token }) for NextAuth

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "sess_";
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// ============================================================================
// POST - Login Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, phone, email, otp, countryCode } = body;

    const ipAddress = request.headers.get("x-forwarded-for") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    console.log("[LOGIN] ═══════════════════════════════════════════════════════");
    console.log("[LOGIN] Type:", type, "| Phone:", phone, "| Email:", email);

    // ── VALIDATION ────────────────────────────────────────────────────────────
    if (!type || !["phone", "email"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid login type. Use 'phone' or 'email'." },
        { status: 400 }
      );
    }

    if (!otp || otp.length !== 6) {
      return NextResponse.json(
        { error: "Invalid OTP. Must be 6 digits." },
        { status: 400 }
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHONE + OTP LOGIN
    // ═══════════════════════════════════════════════════════════════════════════
    if (type === "phone") {
      if (!phone) {
        return NextResponse.json(
          { error: "Phone number is required." },
          { status: 400 }
        );
      }

      const formattedPhone = formatPhoneNumber(phone, countryCode);
      console.log("[LOGIN:PHONE] Formatted phone:", formattedPhone);

      // ── Verify OTP ──────────────────────────────────────────────────────────
      const otpRecords = await prisma.$queryRaw`
        SELECT id, code, expires_at, attempts, verified
        FROM dbo.OTP_Codes
        WHERE identifier = ${formattedPhone}
          AND type = 'phone'
          AND verified = 0
          AND expires_at > GETDATE()
        ORDER BY created_at DESC
      ` as any[];

      if (!otpRecords || otpRecords.length === 0) {
        console.log("[LOGIN:PHONE] ❌ No valid OTP found for:", formattedPhone);
        return NextResponse.json(
          { error: "No verification code found. Please request a new one." },
          { status: 400 }
        );
      }

      const otpRecord = otpRecords[0];
      const attempts = otpRecord.attempts ?? 0;

      // Too many attempts
      if (attempts >= 5) {
        await prisma.$executeRaw`
          DELETE FROM dbo.OTP_Codes WHERE id = ${otpRecord.id}
        `;
        return NextResponse.json(
          { error: "Too many failed attempts. Please request a new code." },
          { status: 400 }
        );
      }

      // Wrong code
      if (otpRecord.code !== otp) {
        await prisma.$executeRaw`
          UPDATE dbo.OTP_Codes 
          SET attempts = ${attempts + 1} 
          WHERE id = ${otpRecord.id}
        `;
        const remaining = 5 - (attempts + 1);
        return NextResponse.json(
          { error: `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.` },
          { status: 400 }
        );
      }

      // ✅ OTP Correct — Mark as verified
      await prisma.$executeRaw`
        UPDATE dbo.OTP_Codes 
        SET verified = 1, verified_at = GETDATE() 
        WHERE id = ${otpRecord.id}
      `;

      // ── Find Consumer ───────────────────────────────────────────────────────
      const consumers = await prisma.$queryRaw`
        SELECT 
          consumer_id, phone_number, email, first_name, last_name,
          subscription_tier, account_status, failed_login_attempts,
          locked_until, preferred_language, email_verified, phone_verified,
          subscription_start_date, subscription_end_date
        FROM dbo.Consumers
        WHERE phone_number = ${formattedPhone}
          AND account_status != 'DELETED'
      ` as any[];

      if (!consumers || consumers.length === 0) {
        console.log("[LOGIN:PHONE] ❌ No account for phone:", formattedPhone);
        return NextResponse.json(
          { error: "No account found with this phone number. Please register first." },
          { status: 404 }
        );
      }

      const consumer = consumers[0];

      // ── Account Checks ──────────────────────────────────────────────────────
      if (consumer.locked_until && new Date(consumer.locked_until) > new Date()) {
        const unlockTime = new Date(consumer.locked_until).toLocaleTimeString();
        return NextResponse.json(
          { error: `Account locked until ${unlockTime}. Please try again later.` },
          { status: 403 }
        );
      }

      if (consumer.account_status === "SUSPENDED") {
        return NextResponse.json(
          { error: "Account suspended. Please contact support at support@naijamarketintel.ng" },
          { status: 403 }
        );
      }

      // ── Create Session ──────────────────────────────────────────────────────
      const sessionToken = generateSessionToken();

      await prisma.$executeRaw`
        UPDATE dbo.Consumers
        SET
          session_token        = ${sessionToken},
          session_created_at   = GETDATE(),
          session_ip_address   = ${ipAddress},
          session_user_agent   = ${userAgent},
          last_activity_at     = GETDATE(),
          last_active_at       = GETDATE(),
          phone_verified       = 1,
          failed_login_attempts = 0,
          locked_until         = NULL,
          updated_at           = GETDATE()
        WHERE consumer_id = ${consumer.consumer_id}
      `;

      console.log("[LOGIN:PHONE] ✅ Login success:", consumer.consumer_id);

      return NextResponse.json({
        success: true,
        message: "Login successful",
        consumer: {
          id:            consumer.consumer_id,
          phone:         consumer.phone_number,
          email:         consumer.email,
          first_name:    consumer.first_name,
          last_name:     consumer.last_name,
          tier:          consumer.subscription_tier,
          language:      consumer.preferred_language || "en",
          subscription_end: consumer.subscription_end_date,
        },
        session_token: sessionToken,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EMAIL + OTP LOGIN
    // ═══════════════════════════════════════════════════════════════════════════
    if (type === "email") {
      if (!email) {
        return NextResponse.json(
          { error: "Email address is required." },
          { status: 400 }
        );
      }

      const normalizedEmail = email.toLowerCase().trim();
      console.log("[LOGIN:EMAIL] Email:", normalizedEmail);

      // ── Verify OTP from Email_Verification_Codes ────────────────────────────
      const otpRecords = await prisma.$queryRaw`
        SELECT id, code, expires_at, attempts, purpose
        FROM dbo.Email_Verification_Codes
        WHERE email    = ${normalizedEmail}
          AND code     = ${otp}
          AND verified = 0
          AND expires_at > GETDATE()
        ORDER BY created_at DESC
      ` as any[];

      if (!otpRecords || otpRecords.length === 0) {
        // Wrong code — increment attempts
        const existing = await prisma.$queryRaw`
          SELECT id, attempts 
          FROM dbo.Email_Verification_Codes
          WHERE email = ${normalizedEmail}
            AND verified = 0
            AND expires_at > GETDATE()
          ORDER BY created_at DESC
        ` as any[];

        if (existing && existing.length > 0) {
          const rec = existing[0];
          const newAttempts = (rec.attempts || 0) + 1;

          await prisma.$executeRaw`
            UPDATE dbo.Email_Verification_Codes
            SET attempts = ${newAttempts}
            WHERE id = ${rec.id}
          `;

          if (newAttempts >= 5) {
            await prisma.$executeRaw`
              UPDATE dbo.Email_Verification_Codes
              SET expires_at = GETDATE() 
              WHERE id = ${rec.id}
            `;
            return NextResponse.json(
              { error: "Too many failed attempts. Please request a new code." },
              { status: 400 }
            );
          }

          return NextResponse.json(
            { error: `Invalid code. ${5 - newAttempts} attempt${5 - newAttempts !== 1 ? "s" : ""} remaining.` },
            { status: 400 }
          );
        }

        return NextResponse.json(
          { error: "No verification code found. Please request a new one." },
          { status: 400 }
        );
      }

      const otpRecord = otpRecords[0];

      // ✅ OTP Correct — Mark as verified
      await prisma.$executeRaw`
        UPDATE dbo.Email_Verification_Codes
        SET verified = 1, verified_at = GETDATE()
        WHERE id = ${otpRecord.id}
      `;

      // ── Find Consumer by Email ──────────────────────────────────────────────
      const consumers = await prisma.$queryRaw`
        SELECT 
          consumer_id, phone_number, email, first_name, last_name,
          subscription_tier, account_status, locked_until,
          preferred_language, email_verified, phone_verified,
          subscription_start_date, subscription_end_date
        FROM dbo.Consumers
        WHERE email = ${normalizedEmail}
          AND account_status != 'DELETED'
      ` as any[];

      if (!consumers || consumers.length === 0) {
        console.log("[LOGIN:EMAIL] ❌ No account for email:", normalizedEmail);
        return NextResponse.json(
          { error: "No account found with this email. Please register first." },
          { status: 404 }
        );
      }

      const consumer = consumers[0];

      // ── Account Checks ──────────────────────────────────────────────────────
      if (consumer.locked_until && new Date(consumer.locked_until) > new Date()) {
        const unlockTime = new Date(consumer.locked_until).toLocaleTimeString();
        return NextResponse.json(
          { error: `Account locked until ${unlockTime}. Please try again later.` },
          { status: 403 }
        );
      }

      if (consumer.account_status === "SUSPENDED") {
        return NextResponse.json(
          { error: "Account suspended. Please contact support at support@naijamarketintel.ng" },
          { status: 403 }
        );
      }

      // ── Create Session ──────────────────────────────────────────────────────
      const sessionToken = generateSessionToken();

      await prisma.$executeRaw`
        UPDATE dbo.Consumers
        SET
          session_token      = ${sessionToken},
          session_created_at = GETDATE(),
          session_ip_address = ${ipAddress},
          session_user_agent = ${userAgent},
          last_activity_at   = GETDATE(),
          last_active_at     = GETDATE(),
          email_verified     = 1,
          email_verified_at  = CASE WHEN email_verified = 0 THEN GETDATE() ELSE email_verified_at END,
          failed_login_attempts = 0,
          locked_until       = NULL,
          updated_at         = GETDATE()
        WHERE consumer_id = ${consumer.consumer_id}
      `;

      console.log("[LOGIN:EMAIL] ✅ Login success:", consumer.consumer_id);

      return NextResponse.json({
        success: true,
        message: "Login successful",
        consumer: {
          id:            consumer.consumer_id,
          phone:         consumer.phone_number,
          email:         consumer.email,
          first_name:    consumer.first_name,
          last_name:     consumer.last_name,
          tier:          consumer.subscription_tier,
          language:      consumer.preferred_language || "en",
          subscription_end: consumer.subscription_end_date,
        },
        session_token: sessionToken,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

  } catch (error: any) {
    console.error("[LOGIN] ❌ Unhandled error:", error);
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
