// src/app/api/auth/reset-password/route.ts
// NaijaMarket Intel - Reset Password API
// Allows Business+ users to reset their password after email verification

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// ============================================================================
// HELPERS
// ============================================================================

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// ============================================================================
// POST - Reset Password
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, newPassword } = body;

    if (!email || !code || !newPassword) {
      return NextResponse.json(
        { error: "Email, verification code, and new password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);

    console.log("[RESET-PASSWORD] ═══════════════════════════════════════════════");
    console.log("[RESET-PASSWORD] Email:", normalizedEmail);

    // Validate password strength
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    if (!/\d/.test(newPassword)) {
      return NextResponse.json(
        { error: "Password must contain at least one number" },
        { status: 400 }
      );
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return NextResponse.json(
        { error: "Password must contain at least one special character" },
        { status: 400 }
      );
    }

    // Verify the email code was validated (within last 15 minutes)
    const verifiedCodes = await prisma.$queryRaw`
      SELECT id
      FROM Email_Verification_Codes
      WHERE email = ${normalizedEmail}
      AND code = ${code}
      AND purpose = 'password_reset'
      AND verified = 1
      AND verified_at > DATEADD(MINUTE, -15, GETDATE())
      ORDER BY verified_at DESC
    ` as any[];

    if (!verifiedCodes || verifiedCodes.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired verification. Please request a new code." },
        { status: 400 }
      );
    }

    // Find consumer by email
    const consumers = await prisma.$queryRaw`
      SELECT consumer_id, password_hash
      FROM Consumers
      WHERE email = ${normalizedEmail}
    ` as any[];

    if (!consumers || consumers.length === 0) {
      return NextResponse.json(
        { error: "No account found with this email" },
        { status: 404 }
      );
    }

    const consumer = consumers[0];

    // Check password history (prevent reuse of last 5 passwords)
    try {
      const passwordHistory = await prisma.$queryRaw`
        SELECT TOP 5 password_hash
        FROM Password_History
        WHERE consumer_id = ${consumer.consumer_id}
        ORDER BY created_at DESC
      ` as any[];

      for (const record of passwordHistory || []) {
        const isReused = await bcrypt.compare(newPassword, record.password_hash);
        if (isReused) {
          return NextResponse.json(
            { error: "Cannot reuse your last 5 passwords. Please choose a different password." },
            { status: 400 }
          );
        }
      }

      // Also check current password
      if (consumer.password_hash) {
        const isSameAsCurrent = await bcrypt.compare(newPassword, consumer.password_hash);
        if (isSameAsCurrent) {
          return NextResponse.json(
            { error: "New password cannot be the same as your current password." },
            { status: 400 }
          );
        }
      }
    } catch (e) {
      // Password_History table may not exist, skip check
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password in Consumers table
    await prisma.$executeRaw`
      UPDATE Consumers
      SET password_hash = ${newPasswordHash},
          password_changed_at = GETDATE(),
          failed_login_attempts = 0,
          locked_until = NULL,
          session_token = NULL,
          session_created_at = NULL,
          updated_at = GETDATE()
      WHERE consumer_id = ${consumer.consumer_id}
    `;

    // Add old password to history (if existed)
    if (consumer.password_hash) {
      try {
        await prisma.$executeRaw`
          INSERT INTO Password_History (consumer_id, password_hash)
          VALUES (${consumer.consumer_id}, ${consumer.password_hash})
        `;

        // Keep only last 5 passwords in history
        await prisma.$executeRaw`
          DELETE FROM Password_History
          WHERE consumer_id = ${consumer.consumer_id}
          AND id NOT IN (
            SELECT TOP 5 id FROM Password_History
            WHERE consumer_id = ${consumer.consumer_id}
            ORDER BY created_at DESC
          )
        `;
      } catch (e) {
        // Password_History table may not exist
      }
    }

    // Log session history (user will need to re-login)
    try {
      await prisma.$executeRaw`
        INSERT INTO Consumer_Session_History 
          (consumer_id, phone_number, session_token, login_at, logout_at, logout_reason)
        SELECT consumer_id, phone_number, session_token, session_created_at, GETDATE(), 'PASSWORD_RESET'
        FROM Consumers 
        WHERE consumer_id = ${consumer.consumer_id}
        AND session_token IS NOT NULL
      `;
    } catch (e) {
      // Session history table may not exist
    }

    // Invalidate the used verification code
    await prisma.$executeRaw`
      UPDATE Email_Verification_Codes
      SET expires_at = GETDATE()
      WHERE id = ${verifiedCodes[0].id}
    `;

    console.log("[RESET-PASSWORD] ✅ Password reset successful for:", consumer.consumer_id);

    return NextResponse.json({
      success: true,
      message: "Password reset successful. Please log in with your new password.",
    });

  } catch (error: any) {
    console.error("[RESET-PASSWORD] ❌ Error:", error);
    return NextResponse.json(
      { error: "Password reset failed" },
      { status: 500 }
    );
  }
}
