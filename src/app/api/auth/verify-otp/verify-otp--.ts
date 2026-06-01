import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Format phone number - MUST match send-otp formatting exactly
function formatPhoneNumber(phone: string, countryCode?: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  
  // If phone already starts with +, just remove the + and return
  if (cleaned.startsWith("+")) {
    return cleaned.substring(1);
  }
  
  // If country code is provided separately (from UI dropdown)
  if (countryCode) {
    // Remove + from country code if present
    const cleanCountryCode = countryCode.replace("+", "");
    
    // If phone starts with 0, remove it (local format)
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    }
    
    // If phone already starts with country code, don't duplicate
    if (cleaned.startsWith(cleanCountryCode)) {
      return cleaned;
    }
    
    return cleanCountryCode + cleaned;
  }
  
  // If no country code and starts with 0, assume Nigerian
  if (cleaned.startsWith("0")) {
    return "234" + cleaned.substring(1);
  }
  
  // Return as-is (already has country code without +)
  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, phone, email, otp, countryCode } = body;

    console.log("📥 Verify OTP Request:", { type, phone, email, otp: otp ? "***" : undefined, countryCode });

    // Auto-detect type if not provided
    let otpType = type;
    if (!otpType) {
      if (phone) {
        otpType = "phone";
      } else if (email) {
        otpType = "email";
      }
    }

    if (!otpType || !["phone", "email"].includes(otpType)) {
      return NextResponse.json({ error: "Invalid OTP type" }, { status: 400 });
    }

    if (!otp || otp.length !== 6) {
      return NextResponse.json({ error: "Invalid OTP code" }, { status: 400 });
    }

    // Format identifier exactly like send-otp does
    let identifier: string;
    
    if (otpType === "phone") {
      if (!phone) {
        return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
      }
      identifier = formatPhoneNumber(phone, countryCode);
    } else {
      if (!email) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 });
      }
      identifier = email.toLowerCase().trim();
    }

    console.log("🔍 Looking for OTP with identifier:", identifier);

    // Find the OTP record
    const otpRecord = await prisma.oTP_Codes.findFirst({
      where: { identifier, type: otpType, verified: false },
      orderBy: { created_at: "desc" },
    });

    if (!otpRecord) {
      console.log("❌ No OTP record found for:", identifier);
      
      // Debug: Show what identifiers exist in DB
      const allRecords = await prisma.oTP_Codes.findMany({
        where: { type: otpType, verified: false },
        select: { identifier: true, code: true, expires_at: true },
        orderBy: { created_at: "desc" },
        take: 5,
      });
      console.log("📋 Recent OTP records in DB:", allRecords.map(r => ({ 
        identifier: r.identifier, 
        expired: r.expires_at < new Date() 
      })));
      
      return NextResponse.json(
        { error: "No verification code found. Please request a new one." },
        { status: 400 }
      );
    }

    console.log("✅ Found OTP record. Stored code:", otpRecord.code, "Entered code:", otp);

    // Check if OTP has expired
    if (new Date() > otpRecord.expires_at) {
      console.log("❌ OTP expired at:", otpRecord.expires_at);
      await prisma.oTP_Codes.delete({ where: { id: otpRecord.id } });
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Check attempt limit (max 5 attempts) - handle null with default 0
    const currentAttempts = otpRecord.attempts ?? 0;
    if (currentAttempts >= 5) {
      await prisma.oTP_Codes.delete({ where: { id: otpRecord.id } });
      return NextResponse.json(
        { error: "Too many failed attempts. Please request a new code." },
        { status: 400 }
      );
    }

    // Verify the OTP
    if (otpRecord.code !== otp) {
      console.log("❌ Code mismatch. Expected:", otpRecord.code, "Got:", otp);
      await prisma.oTP_Codes.update({
        where: { id: otpRecord.id },
        data: { attempts: currentAttempts + 1 },
      });
      const remainingAttempts = 5 - (currentAttempts + 1);
      return NextResponse.json(
        { error: `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining.` },
        { status: 400 }
      );
    }

    // Mark OTP as verified
    await prisma.oTP_Codes.update({
      where: { id: otpRecord.id },
      data: { verified: true, verified_at: new Date() },
    });

    console.log("✅ OTP verified successfully for:", identifier);

    return NextResponse.json({
      success: true,
      message: `${otpType === "phone" ? "Phone" : "Email"} verified successfully`,
    });

  } catch (error) {
    console.error("❌ Verify OTP error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
