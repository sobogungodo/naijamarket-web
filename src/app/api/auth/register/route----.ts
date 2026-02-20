// src/app/api/auth/register/route.ts
// NaijaMarket Intel - Registration API
// Requires BOTH Phone (WhatsApp) AND Email OTP verification
// Updated: 2026-01-18

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Format phone number - MUST match send-otp formatting exactly
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, password, countryCode } = body;

    console.log("📝 Registration request:", { email, phone, countryCode });

    // Validate required fields
    if (!email || !phone || !password) {
      return NextResponse.json({ error: "Email, phone, and password are required" }, { status: 400 });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone, countryCode);
    const formattedEmail = email.toLowerCase().trim();
    console.log("📱 Formatted phone:", formattedPhone);
    console.log("📧 Formatted email:", formattedEmail);

    // Validate password
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Check if user exists by phone
    const existingByPhone = await prisma.consumers.findFirst({
      where: { phone_number: formattedPhone },
    });
    if (existingByPhone) {
      console.log("❌ Phone already exists:", formattedPhone);
      return NextResponse.json(
        { error: "An account with this phone number already exists" },
        { status: 400 }
      );
    }

    // Check if user exists by email
    const existingByEmail = await prisma.consumers.findFirst({
      where: { email: formattedEmail },
    });
    if (existingByEmail) {
      console.log("❌ Email already exists:", formattedEmail);
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // ============================================================
    // VERIFY PHONE WAS VERIFIED
    // ============================================================
    const phoneOtpRecord = await prisma.oTP_Codes.findFirst({
      where: { 
        identifier: formattedPhone, 
        type: "phone", 
        verified: true 
      },
      orderBy: { created_at: "desc" },
    });

    if (!phoneOtpRecord) {
      console.log("❌ Phone not verified:", formattedPhone);
      return NextResponse.json({ error: "Phone number not verified. Please verify your phone first." }, { status: 400 });
    }

    console.log("✅ Phone verified");

    // ============================================================
    // VERIFY EMAIL WAS VERIFIED
    // ============================================================
    const emailOtpRecord = await prisma.oTP_Codes.findFirst({
      where: { 
        identifier: formattedEmail, 
        type: "email", 
        verified: true 
      },
      orderBy: { created_at: "desc" },
    });

    if (!emailOtpRecord) {
      console.log("❌ Email not verified:", formattedEmail);
      return NextResponse.json({ error: "Email not verified. Please verify your email first." }, { status: 400 });
    }

    console.log("✅ Email verified");

    // ============================================================
    // CREATE ACCOUNT
    // ============================================================
    console.log("🔐 Creating account...");

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate consumer ID
    const consumerId = `CON${Date.now()}`;

    // Create consumer account
    const consumer = await prisma.consumers.create({
      data: {
        consumer_id: consumerId,
        phone_number: formattedPhone,
        email: formattedEmail,
        password_hash: hashedPassword,
        phone_verified: true,    // Phone is verified ✅
        email_verified: true,    // Email is verified ✅
        subscription_tier: "FREE",
        account_status: "ACTIVE",
        registration_source: "WEB",
        daily_query_limit: 3,
        max_markets: 3,
        queries_remaining: 3,
      },
    });

    console.log("✅ Consumer created:", consumer.consumer_id);

    // Clean up OTP records
    await prisma.oTP_Codes.deleteMany({
      where: {
        OR: [
          { identifier: formattedPhone },
          { identifier: formattedEmail },
        ],
      },
    });

    console.log("✅ OTP records cleaned up");

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
      consumer: {
        id: consumer.consumer_id,
        email: consumer.email,
        phone: consumer.phone_number,
        tier: consumer.subscription_tier,
      },
    });

  } catch (error: any) {
    console.error("❌ Registration error:", error);
    
    // Handle unique constraint violations
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0];
      if (field === "phone_number") {
        return NextResponse.json(
          { error: "An account with this phone number already exists" },
          { status: 400 }
        );
      }
      if (field === "email") {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
