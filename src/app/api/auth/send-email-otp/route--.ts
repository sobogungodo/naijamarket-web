// src/app/api/auth/send-email-otp/route.ts
// NaijaMarket Intel - Send Email Verification Code
// Sends 6-digit OTP to email for verification

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

// ============================================================================
// EMAIL CONFIGURATION
// ============================================================================

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ============================================================================
// HELPERS
// ============================================================================

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// ============================================================================
// EMAIL TEMPLATE
// ============================================================================

function getEmailTemplate(code: string, purpose: string): string {
  const purposeText = purpose === "registration" 
    ? "complete your registration"
    : purpose === "password_reset"
    ? "reset your password"
    : "verify your email";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NaijaMarket Intel - Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="text-align: center; padding-bottom: 30px;">
        <h1 style="margin: 0; font-size: 28px;">
          <span style="color: #ffffff;">Naija</span><span style="color: #00A36C;">Market</span><span style="color: #FFD700;"> Intel</span>
        </h1>
        <p style="color: #666; font-size: 12px; margin-top: 8px; font-family: monospace;">
          The Bloomberg of African Commodities
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #141414; border: 1px solid #2a2a2a; border-radius: 12px; padding: 40px;">
        <h2 style="color: #ffffff; margin: 0 0 20px 0; font-size: 20px;">
          Verification Code
        </h2>
        <p style="color: #999; margin: 0 0 30px 0; line-height: 1.6;">
          Use this code to ${purposeText}:
        </p>
        <div style="background-color: #0a0a0a; border: 2px solid #00A36C; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 30px;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #00A36C; font-family: monospace;">
            ${code}
          </span>
        </div>
        <p style="color: #666; font-size: 14px; margin: 0;">
          This code expires in <strong style="color: #FFD700;">10 minutes</strong>.
        </p>
        <p style="color: #666; font-size: 14px; margin: 20px 0 0 0;">
          If you didn't request this code, please ignore this email.
        </p>
      </td>
    </tr>
    <tr>
      <td style="text-align: center; padding-top: 30px;">
        <p style="color: #444; font-size: 12px; margin: 0;">
          © 2026 NaijaMarket Intel • Giggababytes Oy
        </p>
        <p style="color: #333; font-size: 11px; margin-top: 8px;">
          Real-time commodity price intelligence for Nigerian markets
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// ============================================================================
// POST - Send Email OTP
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, purpose = "registration" } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    console.log("[SEND-EMAIL-OTP] ═══════════════════════════════════════════════");
    console.log("[SEND-EMAIL-OTP] Email:", normalizedEmail, "| Purpose:", purpose);

    // Rate limiting - check recent codes
    const recentCodes = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM Email_Verification_Codes
      WHERE email = ${normalizedEmail}
      AND created_at > DATEADD(MINUTE, -5, GETDATE())
    ` as any[];

    if (recentCodes && recentCodes[0]?.count > 3) {
      return NextResponse.json(
        { error: "Too many requests. Please wait 5 minutes before trying again." },
        { status: 429 }
      );
    }

    // Generate OTP
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Get IP and user agent
    const ipAddress = request.headers.get("x-forwarded-for") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Store OTP in database
    await prisma.$executeRaw`
      INSERT INTO Email_Verification_Codes 
        (email, code, purpose, expires_at, ip_address, user_agent)
      VALUES 
        (${normalizedEmail}, ${code}, ${purpose}, ${expiresAt}, ${ipAddress}, ${userAgent})
    `;

    // Send email
    try {
      await transporter.sendMail({
        from: `"NaijaMarket Intel" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: normalizedEmail,
        subject: `Your NaijaMarket Intel Verification Code: ${code}`,
        html: getEmailTemplate(code, purpose),
      });
      
      console.log("[SEND-EMAIL-OTP] ✅ Email sent successfully");
    } catch (emailError: any) {
      console.error("[SEND-EMAIL-OTP] ❌ Email send failed:", emailError.message);
      
      // In development, return the code for testing
      if (process.env.NODE_ENV === "development") {
        return NextResponse.json({
          success: true,
          message: "Verification code generated (email delivery failed in dev)",
          dev_code: code, // Only in development!
        });
      }
      
      return NextResponse.json(
        { error: "Failed to send verification email. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email",
    });

  } catch (error: any) {
    console.error("[SEND-EMAIL-OTP] ❌ Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send verification code" },
      { status: 500 }
    );
  }
}
