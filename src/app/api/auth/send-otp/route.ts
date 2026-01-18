import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURATION
// ============================================================================

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const resendApiKey = process.env.RESEND_API_KEY;

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================================================
// SMS FUNCTIONS (Twilio via fetch - no package needed)
// ============================================================================

async function sendSMS(to: string, message: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to.startsWith("+") ? to : `+${to}`,
          From: process.env.TWILIO_PHONE_NUMBER || "+14155238886",
          Body: message,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SMS failed:", errorText);
      return false;
    }

    console.log(`SMS sent to ${to}`);
    return true;
  } catch (error) {
    console.error("SMS error:", error);
    return false;
  }
}

async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  try {
    const formattedTo = to.startsWith("+") ? to : `+${to}`;
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: `whatsapp:${formattedTo}`,
          From: "whatsapp:+14155238886",
          Body: message,
        }),
      }
    );

    if (!response.ok) {
      console.error("WhatsApp failed:", await response.text());
      return false;
    }

    console.log(`WhatsApp sent to ${to}`);
    return true;
  } catch (error) {
    console.error("WhatsApp error:", error);
    return false;
  }
}

// ============================================================================
// EMAIL FUNCTION (Resend via fetch - no package needed)
// ============================================================================

async function sendEmailWithResend(to: string, otp: string): Promise<boolean> {
  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured - logging OTP for dev");
    console.log(`[DEV] Email OTP for ${to}: ${otp}`);
    return true;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "NaijaMarket Intel <otp@foodprice-compare.com>",
        to: [to],
        subject: "Your Verification Code - NaijaMarket Intel",
        html: `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #1a1a1a; border-radius: 16px; padding: 40px; border: 1px solid #2a2a2a;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #ffffff; margin: 15px 0 0 0; font-size: 24px;">
          NaijaMarket<span style="color: #10b981;">Intel</span>
        </h1>
      </div>
      <h2 style="color: #ffffff; text-align: center; margin: 0 0 10px 0; font-size: 20px;">Verify your email</h2>
      <p style="color: #9ca3af; text-align: center; margin: 0 0 30px 0; font-size: 14px;">Use the code below to complete your registration</p>
      <div style="background-color: #0a0a0a; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 30px; border: 1px solid #2a2a2a;">
        <span style="font-size: 36px; font-weight: bold; color: #10b981; letter-spacing: 10px; font-family: monospace;">${otp}</span>
      </div>
      <p style="color: #6b7280; text-align: center; font-size: 14px; margin: 0 0 20px 0;">This code expires in <strong style="color: #ffffff;">10 minutes</strong></p>
    </div>
  </div>
</body>
</html>
        `,
        text: `Your NaijaMarket Intel verification code is: ${otp}. This code expires in 10 minutes.`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Resend email failed:", errorData);
      return false;
    }

    console.log(`Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error("Email error:", error);
    return false;
  }
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

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

    if (type === "phone" && !phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    if (type === "email" && !email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Format phone number (Nigerian format)
    let formattedPhone = phone || "";
    if (phone) {
      formattedPhone = phone.replace(/[\s\-\(\)]/g, "");
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "234" + formattedPhone.substring(1);
      }
      if (!formattedPhone.startsWith("234") && !formattedPhone.startsWith("+234")) {
        formattedPhone = "234" + formattedPhone;
      }
      formattedPhone = formattedPhone.replace("+", "");
    }

    // Check if user already exists by phone_number
    if (formattedPhone) {
      const existingByPhone = await prisma.consumers.findFirst({
        where: { phone_number: formattedPhone },
      });
      if (existingByPhone) {
        return NextResponse.json(
          { error: "An account with this phone number already exists" },
          { status: 400 }
        );
      }
    }

    // Check if user already exists by email
    if (email) {
      const existingByEmail = await prisma.consumers.findFirst({
        where: { email: email },
      });
      if (existingByEmail) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 400 }
        );
      }
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const identifier = type === "phone" ? formattedPhone : email;

    // Delete any existing OTP for this identifier
    await prisma.oTP_Codes.deleteMany({
      where: { identifier, type },
    });

    // Create new OTP record
    await prisma.oTP_Codes.create({
      data: {
        identifier,
        type,
        code: otp,
        expires_at: expiresAt,
        attempts: 0,
        verified: false,
      },
    });

    // Send OTP
    let sent = false;

    if (type === "phone") {
      const message = `Your NaijaMarket Intel code is: ${otp}. Valid for 10 minutes. Do not share.`;
      sent = await sendSMS(formattedPhone, message);
      if (!sent) {
        console.log("SMS failed, trying WhatsApp...");
        sent = await sendWhatsApp(formattedPhone, message);
      }
      if (!sent) {
        return NextResponse.json(
          { error: "Failed to send SMS. Please check your phone number." },
          { status: 500 }
        );
      }
    } else {
      sent = await sendEmailWithResend(email, otp);
      if (!sent) {
        return NextResponse.json(
          { error: "Failed to send email. Please try again." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Verification code sent to your ${type}`,
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
