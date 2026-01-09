// src/app/api/auth/send-otp/route.ts
// NaijaMarket Intel - Send OTP via Twilio WhatsApp

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Twilio credentials from environment
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizePhone(phone);
    
    if (!normalizedPhone) {
      return NextResponse.json(
        { success: false, error: "Invalid phone number format" },
        { status: 400 }
      );
    }

    // Generate 6-digit OTP
    const otpCode = generateOTP();
    
    // Set expiry (10 minutes from now)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Delete any existing unused OTPs for this phone
    await prisma.$executeRaw`
      DELETE FROM Consumer_OTP 
      WHERE phone_number = ${normalizedPhone} AND verified = 0
    `;

    // Store new OTP
    await prisma.$executeRaw`
      INSERT INTO Consumer_OTP (phone_number, otp_code, expires_at, verified)
      VALUES (${normalizedPhone}, ${otpCode}, ${expiresAt}, 0)
    `;

    // Send OTP via WhatsApp
    const message = `🔐 *NaijaMarket Intel Login*\n\nYour verification code is:\n\n*${otpCode}*\n\n⏰ This code expires in 10 minutes.\n\n⚠️ Do not share this code with anyone.`;

    const sendResult = await sendWhatsAppMessage(normalizedPhone, message);

    if (!sendResult.success) {
      return NextResponse.json(
        { success: false, error: "Failed to send OTP. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully",
      phone: maskPhone(normalizedPhone),
      expires_in: "10 minutes",
    });
  } catch (error: any) {
    console.error("Send OTP Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send OTP" },
      { status: 500 }
    );
  }
}

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Normalize Nigerian phone numbers
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  
  // Convert 080... to 234...
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = "234" + cleaned.substring(1);
  }
  
  // Already has 234 prefix
  if (cleaned.startsWith("234") && cleaned.length === 13) {
    return cleaned;
  }
  
  // Handle Finnish numbers for testing
  if (cleaned.startsWith("358")) {
    return cleaned;
  }
  
  // If just 10 digits, assume Nigerian and add 234
  if (cleaned.length === 10) {
    return "234" + cleaned;
  }
  
  return cleaned;
}

// Mask phone for response (show last 4 digits)
function maskPhone(phone: string): string {
  if (phone.length < 4) return "****";
  return "****" + phone.slice(-4);
}

// Send WhatsApp message via Twilio
async function sendWhatsAppMessage(to: string, message: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error("Twilio credentials not configured");
    return { success: false, error: "Twilio not configured" };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append("From", TWILIO_WHATSAPP_NUMBER);
    formData.append("To", `whatsapp:+${to}`);
    formData.append("Body", message);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Twilio error:", data);
      return { success: false, error: data.message || "Failed to send message" };
    }

    return { success: true, sid: data.sid };
  } catch (error: any) {
    console.error("WhatsApp send error:", error);
    return { success: false, error: error.message };
  }
}
