import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// POST /api/auth/register
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, password, emailOtp } = body;

    // Validate required fields
    if (!email || !phone || !password || !emailOtp) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate phone format (Nigerian)
    const cleanedPhone = phone.replace(/[\s\-]/g, "");
    if (!/^(\+234|234)[789][01]\d{8}$/.test(cleanedPhone)) {
      return NextResponse.json(
        { error: "Invalid Nigerian phone number" },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.consumers.findFirst({
      where: {
        OR: [
          { email },
          { phone: cleanedPhone },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 400 }
        );
      }
      if (existingUser.phone === cleanedPhone) {
        return NextResponse.json(
          { error: "An account with this phone number already exists" },
          { status: 400 }
        );
      }
    }

    // Verify email OTP
    const emailOtpRecord = await prisma.otp_Codes.findFirst({
      where: {
        identifier: email,
        type: "email",
        code: emailOtp,
        verified: false,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    if (!emailOtpRecord) {
      return NextResponse.json(
        { error: "Invalid email verification code" },
        { status: 400 }
      );
    }

    // Check if email OTP has expired
    if (new Date() > emailOtpRecord.expires_at) {
      return NextResponse.json(
        { error: "Email verification code has expired" },
        { status: 400 }
      );
    }

    // Verify phone was already verified
    const phoneOtpRecord = await prisma.otp_Codes.findFirst({
      where: {
        identifier: cleanedPhone,
        type: "phone",
        verified: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    if (!phoneOtpRecord) {
      return NextResponse.json(
        { error: "Phone number not verified" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate consumer ID
    const lastConsumer = await prisma.consumers.findFirst({
      orderBy: { consumer_id: "desc" },
      select: { consumer_id: true },
    });

    let newConsumerId = "CON00001";
    if (lastConsumer?.consumer_id) {
      const lastNum = parseInt(lastConsumer.consumer_id.replace("CON", ""));
      newConsumerId = `CON${String(lastNum + 1).padStart(5, "0")}`;
    }

    // Create consumer account
    const consumer = await prisma.consumers.create({
      data: {
        consumer_id: newConsumerId,
        email,
        phone: cleanedPhone,
        password_hash: hashedPassword,
        email_verified: true,
        phone_verified: true,
        tier: "FREE",
        status: "ACTIVE",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Clean up OTP records
    await prisma.otp_Codes.deleteMany({
      where: {
        OR: [
          { identifier: email },
          { identifier: cleanedPhone },
        ],
      },
    });

    // Return success (don't expose password hash)
    return NextResponse.json({
      success: true,
      message: "Account created successfully",
      consumer: {
        id: consumer.consumer_id,
        email: consumer.email,
        phone: consumer.phone,
        tier: consumer.tier,
      },
    });

  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
