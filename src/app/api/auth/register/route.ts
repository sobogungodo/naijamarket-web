import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, password, emailOtp } = body;

    // Validate required fields
    if (!email || !phone || !password || !emailOtp) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Format phone number
    let formattedPhone = phone.replace(/[\s\-\(\)]/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "234" + formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith("234") && !formattedPhone.startsWith("+234")) {
      formattedPhone = "234" + formattedPhone;
    }
    formattedPhone = formattedPhone.replace("+", "");

    // Validate password
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Check if user exists by phone
    const existingByPhone = await prisma.consumers.findFirst({
      where: { phone_number: formattedPhone },
    });
    if (existingByPhone) {
      return NextResponse.json(
        { error: "An account with this phone number already exists" },
        { status: 400 }
      );
    }

    // Check if user exists by email
    const existingByEmail = await prisma.consumers.findFirst({
      where: { email: email },
    });
    if (existingByEmail) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Verify email OTP
    const emailOtpRecord = await prisma.oTP_Codes.findFirst({
      where: { identifier: email, type: "email", code: emailOtp, verified: false },
      orderBy: { created_at: "desc" },
    });

    if (!emailOtpRecord) {
      return NextResponse.json({ error: "Invalid email verification code" }, { status: 400 });
    }

    if (new Date() > emailOtpRecord.expires_at) {
      return NextResponse.json({ error: "Email verification code has expired" }, { status: 400 });
    }

    // Verify phone was already verified
    const phoneOtpRecord = await prisma.oTP_Codes.findFirst({
      where: { identifier: formattedPhone, type: "phone", verified: true },
      orderBy: { created_at: "desc" },
    });

    if (!phoneOtpRecord) {
      return NextResponse.json({ error: "Phone number not verified" }, { status: 400 });
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
      const numMatch = lastConsumer.consumer_id.match(/\d+/);
      if (numMatch) {
        const lastNum = parseInt(numMatch[0]);
        newConsumerId = `CON${String(lastNum + 1).padStart(5, "0")}`;
      }
    }

    // Create consumer account
    const consumer = await prisma.consumers.create({
      data: {
        consumer_id: newConsumerId,
        phone_number: formattedPhone,
        email: email,
        password_hash: hashedPassword,
        email_verified: true,
        phone_verified: true,
        subscription_tier: "FREE",
        account_status: "ACTIVE",
        registration_source: "WEB",
        daily_query_limit: 3,
        max_markets: 3,
        queries_remaining: 3,
      },
    });

    // Clean up OTP records
    await prisma.oTP_Codes.deleteMany({
      where: {
        OR: [
          { identifier: email },
          { identifier: formattedPhone },
        ],
      },
    });

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

  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
