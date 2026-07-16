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

    // SECURITY: rate-limit OTP guessing. Fetch the LATEST active (unverified,
    // unexpired) session for this phone regardless of the submitted code, then
    // compare + count attempts — so an attacker can't brute-force a short numeric
    // OTP (previously there was no attempt cap). Uses the existing
    // OTP_Sessions.attempt_count / locked_until columns. All params are bound.
    const MAX_ATTEMPTS = 5;

    const rows = (await prisma.$queryRaw`
      SELECT TOP 1 otp_session_id, otp_code, attempt_count, locked_until
      FROM dbo.OTP_Sessions
      WHERE phone_number IN (${phonePlus}, ${phoneNaked}, ${phone_raw})
        AND verified = 0
        AND expires_at > SYSUTCDATETIME()
      ORDER BY created_at DESC
    `) as Array<{
      otp_session_id: number;
      otp_code: string | null;
      attempt_count: number | null;
      locked_until: Date | null;
    }>;

    const record = rows[0];
    if (!record) {
      return NextResponse.json(
        { error: "Invalid or expired OTP. Please request a new code." },
        { status: 400 }
      );
    }

    // Locked out from earlier wrong guesses?
    if (record.locked_until && new Date(record.locked_until) > new Date()) {
      return NextResponse.json(
        { error: "Too many attempts. Please request a new code." },
        { status: 429 }
      );
    }

    const attempts = record.attempt_count ?? 0;
    if (attempts >= MAX_ATTEMPTS) {
      // EXPIRE (do NOT verify) the session so it can't be probed further AND can't
      // be treated as a verified phone by /register. Setting verified=1 here would
      // let a locked-out session (5 wrong guesses on a phone the caller doesn't own)
      // pass the register "phone_verified" check — an account-takeover hole.
      await prisma.$executeRaw`
        UPDATE dbo.OTP_Sessions SET expires_at = DATEADD(MINUTE, -1, SYSUTCDATETIME()) WHERE otp_session_id = ${record.otp_session_id}`;
      return NextResponse.json(
        { error: "Too many attempts. Please request a new code." },
        { status: 429 }
      );
    }

    // Wrong code — count the failed attempt; lock for 15 min on hitting the cap.
    if (record.otp_code !== otp) {
      if (attempts + 1 >= MAX_ATTEMPTS) {
        await prisma.$executeRaw`
          UPDATE dbo.OTP_Sessions
          SET attempt_count = ISNULL(attempt_count, 0) + 1,
              locked_until  = DATEADD(minute, 15, SYSUTCDATETIME())
          WHERE otp_session_id = ${record.otp_session_id}`;
      } else {
        await prisma.$executeRaw`
          UPDATE dbo.OTP_Sessions
          SET attempt_count = ISNULL(attempt_count, 0) + 1
          WHERE otp_session_id = ${record.otp_session_id}`;
      }
      return NextResponse.json(
        { error: "Invalid or expired OTP. Please request a new code." },
        { status: 400 }
      );
    }

    // Correct code — mark verified.
    await prisma.$executeRaw`
      UPDATE dbo.OTP_Sessions
      SET verified = 1, verified_at = SYSUTCDATETIME()
      WHERE otp_session_id = ${record.otp_session_id}`;

    console.log(`[verify-otp] Verified session ${record.otp_session_id}`);
    return NextResponse.json({ valid: true });

  } catch (error: any) {
    console.error("[verify-otp] error:", error?.message || error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
