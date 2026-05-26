// src/app/api/auth/send-otp/route.ts
// NaijaMarket Intel - Send OTP API
// WhatsApp: Meta Cloud API (replaced Twilio May 2026)
// Email: Gmail SMTP

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();

// Meta Cloud API (WhatsApp)
const metaAccessToken = process.env.META_ACCESS_TOKEN;
const metaPhoneNumberId = process.env.META_PHONE_NUMBER_ID;

// Gmail SMTP
const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatPhoneNumber(phone: string, countryCode?: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("+")) return cleaned.substring(1);
  if (countryCode) {
    const cleanCountryCode = countryCode.replace("+", "");
    if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
    if (cleaned.startsWith(cleanCountryCode)) return cleaned;
    return cleanCountryCode + cleaned;
  }
  if (cleaned.startsWith("0")) return "234" + cleaned.substring(1);
  return cleaned;
}

async function sendWhatsAppOTP(phone: string, otp: string): Promise<boolean> {
  if (!metaAccessToken || !metaPhoneNumberId) {
    console.log("⚠️ Meta not configured. OTP for testing:", otp);
    return true;
  }
  try {
    const message =
      `🔐 *NaijaMarket Intel*\n\n` +
      `Your verification code is:\n\n` +
      `*${otp}*\n\n` +
      `This code expires in 10 minutes.\n\n` +
      `⚠️ Never share this code with anyone.`;

    console.log(`📱 Sending WhatsApp OTP via Meta to: ${phone}`);

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${metaPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${metaAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: { preview_url: false, body: message },
        }),
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Meta WhatsApp OTP sent. ID:", result?.messages?.[0]?.id);
      return true;
    }
    const error = await response.json();
    console.error("❌ Meta send failed:", JSON.stringify(error));
    return false;
  } catch (error) {
    console.error("❌ Meta send exception:", error);
    return false;
  }
}

async function sendEmailOTP(email: string, otp: string): Promise<boolean> {
  if (!gmailUser || !gmailAppPassword) {
    console.log("⚠️ Gmail not configured. Email OTP for testing:", otp);
    return true;
  }
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailAppPassword },
    });
    const htmlContent = `<!DOCTYPE html><html><body style="background:#0a0a0a;font-family:sans-serif;padding:40px 20px;">
      <div style="max-width:500px;margin:0 auto;text-align:center;">
        <h1 style="color:#fff;">NaijaMarket<span style="color:#10b981;">Intel</span></h1>
        <p style="color:#888;">The Bloomberg of Nigerian Commodities</p>
        <div style="background:#1a1a1a;border-radius:16px;padding:30px;border:1px solid #2a2a2a;margin-top:20px;">
          <h2 style="color:#fff;">Your Verification Code</h2>
          <div style="background:#0a0a0a;border-radius:12px;padding:25px;border:2px solid #10b981;margin:20px 0;">
            <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#10b981;">${otp}</span>
          </div>
          <p style="color:#10b981;">⏱️ Expires in <strong>10 minutes</strong></p>
          <p style="color:#ef4444;font-size:12px;">⚠️ Never share this code with anyone.</p>
        </div>
        <p style="color:#666;font-size:11px;margin-top:20px;">© 2026 NaijaMarket Intel. All rights reserved.</p>
      </div></body></html>`;

    await transporter.sendMail({
      from: `"NaijaMarket Intel" <${gmailUser}>`,
      to: email,
      subject: "🔐 Your NaijaMarket Intel Verification Code",
      text: `NaijaMarket Intel\n\nYour code: ${otp}\n\nExpires in 10 minutes.`,
      html: htmlContent,
    });
    console.log("✅ Email OTP sent to:", email);
    return true;
  } catch (error) {
    console.error("❌ Email send error:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { type, phone, email, countryCode } = body;

    if (!type) {
      if (phone) type = "phone";
      else if (email) type = "email";
    }

    if (!type || !["phone", "email"].includes(type)) {
      return NextResponse.json({ error: "Invalid OTP type" }, { status: 400 });
    }

    let identifier: string;
    if (type === "phone") {
      if (!phone) return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
      identifier = formatPhoneNumber(phone, countryCode);
      console.log("📱 Formatted phone:", identifier);
    } else {
      if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
      identifier = email.toLowerCase().trim();
    }

    // Rate limiting — 60 second cooldown
    const existingOTP = await prisma.oTP_Codes.findFirst({
      where: { identifier, type, verified: false, expires_at: { gt: new Date() } },
      orderBy: { created_at: "desc" },
    });

    if (existingOTP?.created_at) {
      const seconds = (Date.now() - new Date(existingOTP.created_at).getTime()) / 1000;
      if (seconds < 60) {
        return NextResponse.json(
          { error: `Please wait ${Math.ceil(60 - seconds)} seconds before requesting another code` },
          { status: 429 }
        );
      }
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.oTP_Codes.deleteMany({ where: { identifier, type, verified: false } });
    await prisma.oTP_Codes.create({
      data: { identifier, type, code: otp, attempts: 0, verified: false, expires_at: expiresAt },
    });

    const sent = type === "phone"
      ? await sendWhatsAppOTP(identifier, otp)
      : await sendEmailOTP(identifier, otp);

    if (!sent) {
      return NextResponse.json(
        { error: `Failed to send verification code via ${type === "phone" ? "WhatsApp" : "email"}. Please try again.` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: type === "phone" ? "Verification code sent to your WhatsApp" : "Verification code sent to your email",
      expiresIn: 600,
      ...(process.env.NODE_ENV === "development" && { otp }),
    });

  } catch (error) {
    console.error("❌ Send OTP error:", error);
    return NextResponse.json({ error: "Failed to send verification code" }, { status: 500 });
  }
}
