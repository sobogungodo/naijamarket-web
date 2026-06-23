// src/app/api/auth/verify-otp/route.ts
// Verifies WhatsApp phone OTP directly against dbo.OTP_Sessions via Prisma — no Azure Function proxy.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const otp         = (body.otp || "").trim();
    const phone_raw   = (body.phone || body.phone_number || "").trim();
    const countryCode = (body.countryCode || "+234").trim();

    if (!phone_raw || !otp) {
      return NextResponse.json(
        { error: "Phone and OTP required" },
        { status: 400 }
      );
    }

    // Normalise phone — check all three formats that may be stored
    const phoneClean = phone_raw.replace(/^\+/, "").replace(/^0/, "");
    const phoneWithCountry = countryCode.replace(/^\+/, "") + phoneClean;
    const phonePlus  = "+" + phoneWithCountry;
    const phoneNaked = phoneWithCountry;

    // Find valid unverified OTP — check all phone formats
    const record = await prisma.oTP_Sessions.findFirst({
      where: {
        OR: [
          { phone_number: phonePlus },
          { phone_number: phoneNaked },
          { phone_number: phone_raw },
        ],
        otp_code:   otp,
        verified:   false,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: "desc" },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Invalid or expired OTP. Please request a new code." },
        { status: 400 }
      );
    }

    // Mark as verified
    await prisma.oTP_Sessions.update({
      where: { otp_session_id: record.otp_session_id },
      data:  { verified: true },
    });

    console.log(`[verify-otp] Verified phone ${record.phone_number}`);
    return NextResponse.json({ valid: true });

  } catch (error: any) {
    console.error("[verify-otp] error:", error?.message || error);
    return NextResponse.json(
      { error: "Verification failed", detail: error?.message },
      { status: 500 }
    );
  }
}
