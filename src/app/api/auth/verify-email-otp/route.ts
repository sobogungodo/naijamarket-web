// src/app/api/auth/verify-email-otp/route.ts
// NaijaMarket Intel - Verify Email OTP
// v2.0 - Now creates consumer record after successful verification

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function generateConsumerId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'CON_';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and verification code are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);

    console.log("[VERIFY-EMAIL-OTP] ══════════════════════════════════════════");
    console.log("[VERIFY-EMAIL-OTP] Email:", normalizedEmail, "| Code:", code);

    // ── STEP 1: Find valid OTP ────────────────────────────────────────────────
    const otpRecords = await prisma.$queryRaw`
      SELECT id, attempts, purpose
      FROM Email_Verification_Codes
      WHERE email = ${normalizedEmail}
      AND code = ${code}
      AND verified = 0
      AND expires_at > GETDATE()
      ORDER BY created_at DESC
    ` as any[];

    if (!otpRecords || otpRecords.length === 0) {
      // Wrong code - increment attempts
      const existingRecords = await prisma.$queryRaw`
        SELECT id, attempts
        FROM Email_Verification_Codes
        WHERE email = ${normalizedEmail}
        AND verified = 0
        AND expires_at > GETDATE()
        ORDER BY created_at DESC
      ` as any[];

      if (existingRecords && existingRecords.length > 0) {
        const record = existingRecords[0];
        const newAttempts = (record.attempts || 0) + 1;

        await prisma.$executeRaw`
          UPDATE Email_Verification_Codes
          SET attempts = ${newAttempts}
          WHERE id = ${record.id}
        `;

        if (newAttempts >= 5) {
          await prisma.$executeRaw`
            UPDATE Email_Verification_Codes
            SET expires_at = GETDATE()
            WHERE id = ${record.id}
          `;
          return NextResponse.json(
            { error: "Too many failed attempts. Please request a new code." },
            { status: 400 }
          );
        }

        return NextResponse.json(
          { error: `Invalid code. ${5 - newAttempts} attempts remaining.` },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Invalid or expired verification code" },
        { status: 400 }
      );
    }

    const otpRecord = otpRecords[0];

    // ── STEP 2: Mark OTP as verified ─────────────────────────────────────────
    await prisma.$executeRaw`
      UPDATE Email_Verification_Codes
      SET verified = 1, verified_at = GETDATE()
      WHERE id = ${otpRecord.id}
    `;

    console.log("[VERIFY-EMAIL-OTP] ✅ OTP verified | Purpose:", otpRecord.purpose);

    // ── STEP 3: Handle based on purpose ──────────────────────────────────────
    if (otpRecord.purpose === "registration") {
      
      // Check if consumer already exists
      const existingConsumer = await prisma.$queryRaw`
        SELECT consumer_id, account_status 
        FROM dbo.Consumers 
        WHERE email = ${normalizedEmail}
      ` as any[];

      if (existingConsumer && existingConsumer.length > 0) {
        // Account already exists - just return success for login
        console.log("[VERIFY-EMAIL-OTP] Consumer already exists:", existingConsumer[0].consumer_id);
        
        return NextResponse.json({
          success: true,
          message: "Email verified successfully",
          purpose: otpRecord.purpose,
          consumer_id: existingConsumer[0].consumer_id,
          is_new_account: false,
        });
      }

      // ── STEP 4: Create new consumer record ───────────────────────────────
      const consumerId = generateConsumerId();
      
      await prisma.$executeRaw`
        INSERT INTO dbo.Consumers (
          consumer_id,
          email,
          email_verified,
          email_verified_at,
          phone_verified,
          account_status,
          subscription_tier,
          registration_source,
          registration_date,
          created_at,
          updated_at,
          preferred_language,
          daily_query_limit,
          daily_queries_used,
          queries_today,
          total_queries,
          preferred_auth_method
        ) VALUES (
          ${consumerId},
          ${normalizedEmail},
          1,
          GETDATE(),
          0,
          'ACTIVE',
          'FREE',
          'EMAIL_REGISTRATION',
          CAST(GETDATE() AS DATE),
          GETDATE(),
          GETDATE(),
          'en',
          3,
          0,
          0,
          0,
          'email'
        )
      `;

      console.log("[VERIFY-EMAIL-OTP] ✅ Consumer created:", consumerId);

      return NextResponse.json({
        success: true,
        message: "Email verified and account created successfully",
        purpose: otpRecord.purpose,
        consumer_id: consumerId,
        is_new_account: true,
      });
    }

    // For password_reset or other purposes - just return success
    return NextResponse.json({
      success: true,
      message: "Email verified successfully",
      purpose: otpRecord.purpose,
    });

  } catch (error: any) {
    console.error("[VERIFY-EMAIL-OTP] ❌ Error:", error);
    return NextResponse.json(
      { error: error.message || "Verification failed" },
      { status: 500 }
    );
  }
}