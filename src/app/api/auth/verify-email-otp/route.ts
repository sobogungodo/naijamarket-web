// src/app/api/auth/verify-email-otp/route.ts
// Verifies email OTP directly against dbo.OTP_Codes via Prisma — no Azure Function proxy.
// Matches the send-email-otp storage pattern (identifier=email, type="email").

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();
    const otp   = (body.otp || "").trim();

    if (!email || !otp) {
      return NextResponse.json(
        { error: "Email and OTP required" },
        { status: 400 }
      );
    }

    // Find the most recent unverified OTP for this email
    const record = await prisma.oTP_Codes.findFirst({
      where: {
        identifier: email,
        type: "email",
        verified: false,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: "desc" },
    });

    if (!record) {
      return NextResponse.json(
        { error: "OTP expired or not found. Please request a new code." },
        { status: 400 }
      );
    }

    if (record.code !== otp) {
      return NextResponse.json(
        { error: "Incorrect verification code." },
        { status: 400 }
      );
    }

    // Mark as verified
    await prisma.oTP_Codes.update({
      where: { id: record.id },
      data: { verified: true },
    });

    console.log(`[verify-email-otp] Verified for ${email}`);
    return NextResponse.json({ valid: true });

  } catch (error: any) {
    console.error("[verify-email-otp] error:", error?.message || error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
