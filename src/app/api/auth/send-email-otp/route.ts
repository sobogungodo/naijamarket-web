// src/app/api/auth/send-email-otp/route.ts
// Sends email OTP via Brevo API directly — no Azure Function proxy.
// Stores the OTP directly in dbo.OTP_Codes via Prisma (identifier=email, type="email"),
// which is the same table register/verify-email read from.

import { NextRequest, NextResponse } from "next/server";
import { prisma as sharedPrisma } from "@/lib/db";
import { PrismaClient } from "@prisma/client";

const prisma = sharedPrisma;

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const SENDER_EMAIL  = "noreply@naijamarketintel.ng";
const SENDER_NAME   = "NaijaMarket Intel";

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function storeEmailOTP(email: string, otp: string): Promise<void> {
  // Clear any prior unverified email codes for this address, then store the new one.
  await prisma.oTP_Codes.deleteMany({
    where: { identifier: email, type: "email", verified: false },
  });
  await prisma.oTP_Codes.create({
    data: {
      identifier: email,
      type: "email",
      code: otp,
      expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  });
}

async function sendBrevoEmail(email: string, otp: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY not configured");

  const resp = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email }],
      subject: `Your NaijaMarket Intel verification code`,
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;
                    padding:20px;background:#0a0a0a;color:#fff;border-radius:12px;">
          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="color:#fff;margin:0;">
              Naija<span style="color:#10b981;">Market</span>
              <span style="color:#f59e0b;">Intel</span>
            </h1>
          </div>
          <p style="text-align:center;color:#9ca3af;font-size:15px;">
            Your verification code is:
          </p>
          <div style="background:#1a1a1a;border-radius:10px;padding:24px;
                      text-align:center;margin:20px 0;border:1px solid #2a2a2a;">
            <span style="font-size:38px;font-weight:bold;letter-spacing:10px;
                         color:#10b981;font-family:monospace;">${otp}</span>
          </div>
          <p style="text-align:center;color:#6b7280;font-size:13px;">
            Expires in <strong style="color:#fff;">10 minutes</strong>.
            Never share this code with anyone.
          </p>
        </div>
      `,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Brevo error ${resp.status}: ${body}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Valid email required" },
        { status: 400 }
      );
    }

    const otp = generateOTP();

    // Store OTP first, then send email
    await storeEmailOTP(email, otp);
    await sendBrevoEmail(email, otp);

    console.log(`[send-email-otp] OTP sent to ${email}`);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("[send-email-otp] error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }
}
