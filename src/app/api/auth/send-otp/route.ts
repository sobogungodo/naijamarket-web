import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import twilio from "twilio";
import nodemailer from "nodemailer";

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Initialize Nodemailer (for email)
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/send-otp
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, phone, email } = body;

    if (!type || !["phone", "email"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid OTP type. Must be 'phone' or 'email'" },
        { status: 400 }
      );
    }

    // Validate required fields based on type
    if (type === "phone" && !phone) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    if (type === "email" && !email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user already exists (for registration)
    const existingUser = await prisma.consumers.findFirst({
      where: {
        OR: [
          { email: email || undefined },
          { phone: phone || undefined },
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
      if (existingUser.phone === phone) {
        return NextResponse.json(
          { error: "An account with this phone number already exists" },
          { status: 400 }
        );
      }
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    const identifier = type === "phone" ? phone : email;

    // Delete any existing OTP for this identifier
    await prisma.otp_Codes.deleteMany({
      where: {
        identifier,
        type,
      },
    });

    // Create new OTP record
    await prisma.otp_Codes.create({
      data: {
        identifier,
        type,
        code: otp,
        expires_at: expiresAt,
        attempts: 0,
        verified: false,
      },
    });

    // Send OTP based on type
    if (type === "phone") {
      // Send SMS via Twilio
      try {
        await twilioClient.messages.create({
          body: `Your NaijaMarket Intel verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
          from: process.env.TWILIO_PHONE_NUMBER || "whatsapp:+14155238886",
          to: phone.startsWith("+") ? phone : `+${phone}`,
        });

        console.log(`SMS OTP sent to ${phone}`);
      } catch (smsError) {
        console.error("SMS sending failed:", smsError);
        
        // Fallback: Try WhatsApp if SMS fails
        try {
          await twilioClient.messages.create({
            body: `Your NaijaMarket Intel verification code is: ${otp}. Valid for 10 minutes.`,
            from: "whatsapp:+14155238886",
            to: `whatsapp:${phone.startsWith("+") ? phone : `+${phone}`}`,
          });
          console.log(`WhatsApp OTP sent to ${phone}`);
        } catch (whatsappError) {
          console.error("WhatsApp sending also failed:", whatsappError);
          return NextResponse.json(
            { error: "Failed to send SMS. Please check your phone number." },
            { status: 500 }
          );
        }
      }
    } else {
      // Send Email via Nodemailer
      try {
        await emailTransporter.sendMail({
          from: `"NaijaMarket Intel" <${process.env.SMTP_USER || "noreply@naijamarketintel.com"}>`,
          to: email,
          subject: "Verify your email - NaijaMarket Intel",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; background-color: #0a0a0a; margin: 0; padding: 20px;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; padding: 40px; border: 1px solid #2a2a2a;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #10b981; margin: 0;">NaijaMarket<span style="color: white;">Intel</span></h1>
                </div>
                
                <h2 style="color: white; text-align: center; margin-bottom: 20px;">Verify your email</h2>
                
                <p style="color: #9ca3af; text-align: center; margin-bottom: 30px;">
                  Use the code below to complete your registration
                </p>
                
                <div style="background-color: #0a0a0a; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 30px;">
                  <span style="font-size: 32px; font-weight: bold; color: #10b981; letter-spacing: 8px;">${otp}</span>
                </div>
                
                <p style="color: #6b7280; text-align: center; font-size: 14px;">
                  This code expires in <strong style="color: white;">10 minutes</strong>.
                </p>
                
                <p style="color: #6b7280; text-align: center; font-size: 14px; margin-top: 30px;">
                  If you didn't request this code, please ignore this email.
                </p>
                
                <hr style="border: none; border-top: 1px solid #2a2a2a; margin: 30px 0;">
                
                <p style="color: #4b5563; text-align: center; font-size: 12px;">
                  © 2025 NaijaMarket Intel. Nigeria's Premier Market Intelligence Platform.
                </p>
              </div>
            </body>
            </html>
          `,
          text: `Your NaijaMarket Intel verification code is: ${otp}. Valid for 10 minutes.`,
        });

        console.log(`Email OTP sent to ${email}`);
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        return NextResponse.json(
          { error: "Failed to send email. Please try again." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Verification code sent to your ${type}`,
      // Don't expose OTP in production! Only for testing:
      ...(process.env.NODE_ENV === "development" && { otp }),
    });

  } catch (error) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
