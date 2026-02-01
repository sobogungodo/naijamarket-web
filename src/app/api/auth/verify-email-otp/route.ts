// src/app/api/auth/verify-email-otp/route.ts
// NaijaMarket Intel - Verify Email OTP
// Verifies the 6-digit code sent to email

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================================
// HELPERS
// ============================================================================

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// ============================================================================
// POST - Verify Email OTP
// ============================================================================

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
    
    console.log("[VERIFY-EMAIL-OTP] ═══════════════════════════════════════════════");
    console.log("[VERIFY-EMAIL-OTP] Email:", normalizedEmail, "| Code:", code);

    // Find valid OTP
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
      // Check if code exists but is wrong
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

        // Update attempts
        await prisma.$executeRaw`
          UPDATE Email_Verification_Codes
          SET attempts = ${newAttempts}
          WHERE id = ${record.id}
        `;

        if (newAttempts >= 5) {
          // Invalidate after 5 wrong attempts
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

    // Mark as verified
    await prisma.$executeRaw`
      UPDATE Email_Verification_Codes
      SET verified = 1, verified_at = GETDATE()
      WHERE id = ${otpRecord.id}
    `;

    console.log("[VERIFY-EMAIL-OTP] ✅ Code verified | Purpose:", otpRecord.purpose);

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
