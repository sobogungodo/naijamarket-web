import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    console.error("RESEND_API_KEY not configured");
    // For development, just log the OTP
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
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #1a1a1a; border-radius: 16px; padding: 40px; border: 1px solid #2a2a2a;">
      
      <!-- Logo -->
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #10b981, #f59e0b); padding: 12px 16px; border-radius: 12px;">
          <span style="color: #000; font-weight: bold; font-size: 18px;">NM</span>
        </div>
        <h1 style="color: #ffffff; margin: 15px 0 0 0; font-size: 24px;">
          NaijaMarket<span style="color: #10b981;">Intel</span>
        </h1>
      </div>
      
      <!-- Title -->
      <h2 style="color: #ffffff; text-align: center; margin: 0 0 10px 0; font-size: 20px;">
        Verify your email
      </h2>
      <p style="color: #9ca3af; text-align: center; margin: 0 0 30px 0; font-size: 14px;">
        Use the code below to complete your registration
      </p>
      
      <!-- OTP Code -->
      <div style="background-color: #0a0a0a; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 30px; border: 1px solid #2a2a2a;">
        <span style="font-size: 36px; font-weight: bold; color: #10b981; letter-spacing: 10px; font-family: monospace;">
          ${otp}
        </span>
      </div>
      
      <!-- Expiry Note -->
      <p style="color: #6b7280; text-align: center; font-size: 14px; margin: 0 0 20px 0;">
        This code expires in <strong style="color: #ffffff;">10 minutes</strong>
      </p>
      
      <!-- Security Note -->
      <div style="background-color: #0a0a0a; border-radius: 8px; padding: 15px; border-left: 3px solid #f59e0b;">
        <p style="color: #9ca3af; margin: 0; font-size: 13px;">
          🔒 If you didn't request this code, please ignore this email. Never share this code with anyone.
        </p>
      </div>
      
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 30px;">
      <p style="color: #4b5563; font-size: 12px; margin: 0;">
        © 2025 NaijaMarket Intel. Nigeria's Premier Market Intelligence Platform.
      </p>
      <p style="color: #4b5563; font-size: 12px; margin: 10px 0 0 0;">
        <a href="https://foodprice-compare.com" style="color: #10b981; text-decoration: none;">foodprice-compare.com</a>
      </p>
    </div>
  </div>
</body>
</html>
        `,
        text: `Your NaijaMarket Intel verification code is: ${otp}. This code expires in 10 minutes. Do not share this code with anyone.`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Resend email failed:", errorData);
      return false;
    }

    const data = await response.json();
    console.log(`Email sent to ${to}, ID: ${data.id}`);
    return true;
  } catch (error) {
    console.error("Email error:", error);
    return false;
  }
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

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

    // Format phone number (Nigerian format)
    let formattedPhone = phone;
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

    // Check if user already exists
    const existingUser = await prisma.consumers.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(formattedPhone ? [{ phone_number: formattedPhone }] : []),
        ],
      },
    });

    if (existingUser) {
      if (email && existingUser.email === email) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 400 }
        );
      }
      if (formattedPhone && existingUser.phone_number === formattedPhone) {
        return NextResponse.json(
          { error: "An account with this phone number already exists" },
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
      where: {
        identifier,
        type,
      },
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
      // Try SMS first, then WhatsApp
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
      // Send email
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
      // Only in development for testing
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
