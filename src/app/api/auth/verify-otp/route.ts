import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, phone, email, otp } = body;

    if (!type || !["phone", "email"].includes(type)) {
      return NextResponse.json({ error: "Invalid OTP type" }, { status: 400 });
    }

    if (!otp || otp.length !== 6) {
      return NextResponse.json({ error: "Invalid OTP code" }, { status: 400 });
    }

    // Format phone number
    let identifier = type === "phone" ? phone : email;
    
    if (type === "phone" && phone) {
      identifier = phone.replace(/[\s\-\(\)]/g, "");
      if (identifier.startsWith("0")) {
        identifier = "234" + identifier.substring(1);
      }
      if (!identifier.startsWith("234") && !identifier.startsWith("+234")) {
        identifier = "234" + identifier;
      }
      identifier = identifier.replace("+", "");
    }

    if (!identifier) {
      return NextResponse.json(
        { error: `${type === "phone" ? "Phone" : "Email"} is required` },
        { status: 400 }
      );
    }

    // Find the OTP record
    const otpRecord = await prisma.oTP_Codes.findFirst({
      where: { identifier, type, verified: false },
      orderBy: { created_at: "desc" },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { error: "No verification code found. Please request a new one." },
        { status: 400 }
      );
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expires_at) {
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

    return NextResponse.json({
      success: true,
      message: `${type === "phone" ? "Phone" : "Email"} verified successfully`,
    });

  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
