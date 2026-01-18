import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Format Nigerian phone number
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, "");
  
  // Handle Nigerian numbers
  if (cleaned.startsWith("0")) {
    cleaned = "234" + cleaned.substring(1);
  } else if (!cleaned.startsWith("234")) {
    cleaned = "234" + cleaned;
  }
  
  return cleaned;
}

// Send OTP via WhatsApp using Twilio
async function sendWhatsAppOTP(phone: string, otp: string): Promise<boolean> {
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

  if (!twilioAccountSid || !twilioAuthToken) {
    console.log("Twilio credentials not configured. OTP:", otp);
    return true; // Return true for development
  }

  try {
    const formattedPhone = `whatsapp:+${phone}`;
    const message = `🔐 *NaijaMarket Intel*\n\nYour verification code is: *${otp}*\n\nThis code expires in 10 minutes.\n\n⚠️ Never share this code with anyone.`;

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
      console.error("WhatsApp send failed:", result);
      return false;
    }

    console.log("WhatsApp OTP sent successfully:", result.sid);
    return true;
  } catch (error) {
    console.error("WhatsApp send error:", error);
    return false;
  }
}

// Send OTP via Email using Resend
async function sendEmailOTP(email: string, otp: string): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.log("Resend API key not configured. OTP:", otp);
    return true; // Return true for development
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
        to: [email],
        subject: "Your NaijaMarket Intel Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #fff; border-radius: 10px;">
            <h1 style="color: #10b981; text-align: center;">NaijaMarket Intel</h1>
            <p style="text-align: center; font-size: 16px;">Your verification code is:</p>
            <div style="background: #16213e; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #10b981;">${otp}</span>
            </div>
            <p style="text-align: center; color: #888; font-size: 14px;">This code expires in 10 minutes.</p>
            <p style="text-align: center; color: #ef4444; font-size: 12px;">⚠️ Never share this code with anyone.</p>
          </div>
        `,
        text: `Your NaijaMarket Intel verification code is: ${otp}. This code expires in 10 minutes. Never share this code with anyone.`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Email send failed:", error);
      return false;
    }

    console.log("Email OTP sent successfully");
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { type, phone, email } = body;

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
      identifier = formatPhoneNumber(phone);
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
        { error: "Failed to send verification code. Please try again." },
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
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
