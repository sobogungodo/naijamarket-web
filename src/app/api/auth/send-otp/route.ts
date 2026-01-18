// src/app/api/auth/send-otp/route.ts
// NaijaMarket Intel - Send OTP API
// Supports: WhatsApp (Twilio) + Email (Gmail SMTP)
// Updated: 2026-01-18

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURATION
// ============================================================================

// Twilio (WhatsApp)
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

// Gmail SMTP
const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

// ============================================================================
// HELPERS
// ============================================================================

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Format phone number for international use
function formatPhoneNumber(phone: string, countryCode?: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  
  if (cleaned.startsWith("+")) {
    return cleaned.substring(1);
  }
  
  if (countryCode) {
    const cleanCountryCode = countryCode.replace("+", "");
    
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    }
    
    if (cleaned.startsWith(cleanCountryCode)) {
      return cleaned;
    }
    
    return cleanCountryCode + cleaned;
  }
  
  if (cleaned.startsWith("0")) {
    return "234" + cleaned.substring(1);
  }
  
  return cleaned;
}

// ============================================================================
// WHATSAPP OTP (TWILIO)
// ============================================================================

async function sendWhatsAppOTP(phone: string, otp: string): Promise<boolean> {
  if (!twilioAccountSid || !twilioAuthToken) {
    console.log("⚠️ Twilio not configured. OTP for testing:", otp);
    return true;
  }

  try {
    const formattedPhone = `whatsapp:+${phone}`;
    const message = `🔐 *NaijaMarket Intel*\n\nYour verification code is: *${otp}*\n\nThis code expires in 10 minutes.\n\n⚠️ Never share this code with anyone.`;

    console.log(`📱 Sending WhatsApp OTP to: ${formattedPhone}`);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: formattedPhone,
          From: twilioWhatsAppNumber,
          Body: message,
        }),
      }
    );

    const result = await response.json();
    
    if (!response.ok) {
      console.error("❌ WhatsApp send failed:", JSON.stringify(result));
      return false;
    }

    console.log("✅ WhatsApp OTP sent successfully. SID:", result.sid);
    return true;
  } catch (error) {
    console.error("❌ WhatsApp send error:", error);
    return false;
  }
}

// ============================================================================
// EMAIL OTP (GMAIL SMTP)
// ============================================================================

async function sendEmailOTP(email: string, otp: string): Promise<boolean> {
  if (!gmailUser || !gmailAppPassword) {
    console.log("⚠️ Gmail SMTP not configured. Email OTP for testing:", otp);
    return true;
  }

  try {
    console.log(`📧 Sending Email OTP to: ${email}`);

    // Create Gmail transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    // Email HTML template - Beautiful dark theme
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
        <div style="max-width: 500px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background: linear-gradient(135deg, #10b981, #f59e0b); padding: 12px 16px; border-radius: 12px;">
              <span style="color: #000; font-weight: bold; font-size: 20px;">NM</span>
            </div>
            <h1 style="color: #ffffff; margin: 15px 0 5px 0; font-size: 24px;">
              NaijaMarket<span style="color: #10b981;">Intel</span>
            </h1>
            <p style="color: #888888; margin: 0; font-size: 14px;">The Bloomberg of Nigerian Commodities</p>
          </div>
          
          <!-- Main Content -->
          <div style="background-color: #1a1a1a; border-radius: 16px; padding: 30px; border: 1px solid #2a2a2a;">
            <h2 style="color: #ffffff; margin: 0 0 10px 0; font-size: 20px; text-align: center;">
              Verify Your Email
            </h2>
            <p style="color: #888888; margin: 0 0 25px 0; text-align: center; font-size: 14px;">
              Use the code below to complete your registration
            </p>
            
            <!-- OTP Code -->
            <div style="background-color: #0a0a0a; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 25px; border: 2px solid #10b981;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #10b981;">${otp}</span>
            </div>
            
            <!-- Expiry Notice -->
            <div style="background-color: rgba(16, 185, 129, 0.1); border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 20px;">
              <p style="color: #10b981; margin: 0; font-size: 13px;">
                ⏱️ This code expires in <strong>10 minutes</strong>
              </p>
            </div>
            
            <!-- Security Warning -->
            <div style="background-color: rgba(239, 68, 68, 0.1); border-radius: 8px; padding: 12px; text-align: center;">
              <p style="color: #ef4444; margin: 0; font-size: 12px;">
                ⚠️ Never share this code with anyone. NaijaMarket Intel staff will never ask for your code.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #666666; font-size: 12px; margin: 0;">
              If you didn't request this code, you can safely ignore this email.
            </p>
            <p style="color: #444444; font-size: 11px; margin: 15px 0 0 0;">
              © 2026 NaijaMarket Intel. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Plain text fallback
    const textContent = `
NaijaMarket Intel - Email Verification

Your verification code is: ${otp}

This code expires in 10 minutes.

⚠️ Never share this code with anyone.

If you didn't request this code, you can safely ignore this email.

© 2026 NaijaMarket Intel
    `;

    // Send email
    const info = await transporter.sendMail({
      from: `"NaijaMarket Intel" <${gmailUser}>`,
      to: email,
      subject: "🔐 Your NaijaMarket Intel Verification Code",
      text: textContent,
      html: htmlContent,
    });

    console.log("✅ Email OTP sent successfully. Message ID:", info.messageId);
    return true;
  } catch (error) {
    console.error("❌ Email send error:", error);
    return false;
  }
}

// ============================================================================
// API ROUTE
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { type, phone, email, countryCode } = body;

    console.log("📥 OTP Request:", { type, phone, email, countryCode });

    // Auto-detect type if not provided
    if (!type) {
      if (phone) {
        type = "phone";
      } else if (email) {
        type = "email";
      }
    }

    // Validate type
    if (!type || !["phone", "email"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid OTP type. Must be 'phone' or 'email'" },
        { status: 400 }
      );
    }

    let identifier: string;
    
    if (type === "phone") {
      if (!phone) {
        return NextResponse.json(
          { error: "Phone number is required" },
          { status: 400 }
        );
      }
      identifier = formatPhoneNumber(phone, countryCode);
      console.log("📱 Formatted phone:", identifier);
    } else {
      if (!email) {
        return NextResponse.json(
          { error: "Email is required" },
          { status: 400 }
        );
      }
      identifier = email.toLowerCase().trim();
    }

    // Check for existing unverified OTP (rate limiting)
    const existingOTP = await prisma.oTP_Codes.findFirst({
      where: {
        identifier,
        type,
        verified: false,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: "desc" },
    });

    // If OTP was sent less than 60 seconds ago, don't send another
    if (existingOTP && existingOTP.created_at) {
      const secondsSinceCreated = (Date.now() - new Date(existingOTP.created_at).getTime()) / 1000;
      if (secondsSinceCreated < 60) {
        const waitTime = Math.ceil(60 - secondsSinceCreated);
        return NextResponse.json(
          { error: `Please wait ${waitTime} seconds before requesting another code` },
          { status: 429 }
        );
      }
    }

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log("🔑 Generated OTP:", otp, "for", identifier);

    // Delete old unverified OTPs for this identifier
    await prisma.oTP_Codes.deleteMany({
      where: {
        identifier,
        type,
        verified: false,
      },
    });

    // Save new OTP to database
    await prisma.oTP_Codes.create({
      data: {
        identifier,
        type,
        code: otp,
        attempts: 0,
        verified: false,
        expires_at: expiresAt,
      },
    });

    // Send OTP
    let sent = false;
    if (type === "phone") {
      sent = await sendWhatsAppOTP(identifier, otp);
    } else {
      sent = await sendEmailOTP(identifier, otp);
    }

    if (!sent) {
      return NextResponse.json(
        { error: `Failed to send verification code via ${type === "phone" ? "WhatsApp" : "email"}. Please try again.` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: type === "phone" 
        ? "Verification code sent to your WhatsApp" 
        : "Verification code sent to your email",
      expiresIn: 600, // 10 minutes in seconds
    });

  } catch (error) {
    console.error("❌ Send OTP error:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
