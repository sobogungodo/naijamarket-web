// ============================================================================
// src/app/api/auth/2fa/setup/route.ts
// NaijaMarket Intel - Two-Factor Authentication Setup
// Uses existing WhatsApp/Email OTP infrastructure
// Version: 1.1.0 - Fixed user lookup
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// HELPER: Find user from session
// ============================================================================

async function findUserFromSession(session: any) {
  if (!session?.user) return null;

  const { email, name, phone } = session.user as any;

  // Strategy 1: By email
  if (email) {
    const user = await prisma.consumers.findFirst({
      where: { email: email },
    });
    if (user) return user;
  }

  // Strategy 2: By phone (if present in session)
  if (phone) {
    const user = await prisma.consumers.findFirst({
      where: { phone_number: phone },
    });
    if (user) return user;
  }

  // Strategy 3: Extract phone suffix from name like "User 5952"
  if (name && name.startsWith("User ")) {
    const phoneSuffix = name.replace("User ", "");
    if (phoneSuffix && /^\d{4,}$/.test(phoneSuffix)) {
      // Use raw query for SQL Server LIKE pattern
      const users = await prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM Consumers 
        WHERE phone_number LIKE '%${phoneSuffix}'
        ORDER BY created_at DESC
      `);
      if (users && users.length > 0) {
        return users[0];
      }
    }
  }

  return null;
}

// ============================================================================
// GET - Get 2FA setup options
// ============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: "Authentication required",
      }, { status: 401 });
    }

    // Find user using helper
    const user = await findUserFromSession(session);

    if (!user) {
      console.log("[2FA] User not found. Session:", JSON.stringify(session.user));
      return NextResponse.json({
        success: false,
        error: "User not found",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        enabled: user.two_factor_enabled || false,
        method: user.two_factor_method || null,
        availableMethods: [
          {
            id: "whatsapp",
            name: "WhatsApp OTP",
            description: "Receive verification code via WhatsApp",
            icon: "whatsapp",
            available: !!user.phone_number,
            destination: user.phone_number ? maskPhone(user.phone_number) : null,
          },
          {
            id: "email",
            name: "Email OTP",
            description: "Receive verification code via Email",
            icon: "email",
            available: !!user.email,
            destination: user.email ? maskEmail(user.email) : null,
          },
        ],
      },
    });
  } catch (error) {
    console.error("2FA setup GET error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to get 2FA setup options",
    }, { status: 500 });
  }
}

// ============================================================================
// POST - Enable 2FA (Step 1: Send OTP, Step 2: Verify & Enable)
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: "Authentication required",
      }, { status: 401 });
    }

    const body = await request.json();
    const { method, otp } = body;

    // Validate method
    if (!method || !["whatsapp", "email"].includes(method)) {
      return NextResponse.json({
        success: false,
        error: "Invalid 2FA method. Choose 'whatsapp' or 'email'",
      }, { status: 400 });
    }

    // Find user
    const user = await findUserFromSession(session);

    if (!user) {
      return NextResponse.json({
        success: false,
        error: "User not found",
      }, { status: 404 });
    }

    // Determine identifier based on method
    const identifier = method === "whatsapp" ? user.phone_number : user.email;
    
    if (!identifier) {
      return NextResponse.json({
        success: false,
        error: `No ${method === "whatsapp" ? "phone number" : "email"} associated with your account`,
      }, { status: 400 });
    }

    // ================================================================
    // Step 1: If no OTP provided, send one
    // ================================================================
    if (!otp) {
      const otpType = method === "whatsapp" ? "phone" : "email";
      
      // Use existing OTP infrastructure
      const baseUrl = process.env.NEXTAUTH_URL || 
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      
      const sendResponse = await fetch(`${baseUrl}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: otpType,
          phone: method === "whatsapp" ? user.phone_number : undefined,
          email: method === "email" ? user.email : undefined,
        }),
      });

      const sendResult = await sendResponse.json();

      if (!sendResponse.ok) {
        return NextResponse.json({
          success: false,
          error: sendResult.error || "Failed to send verification code",
        }, { status: sendResponse.status });
      }

      return NextResponse.json({
        success: true,
        step: "verify",
        message: `Verification code sent to your ${method === "whatsapp" ? "WhatsApp" : "email"}`,
        destination: method === "whatsapp" ? maskPhone(user.phone_number!) : maskEmail(user.email!),
      });
    }

    // ================================================================
    // Step 2: Verify OTP and enable 2FA
    // ================================================================
    if (otp.length !== 6) {
      return NextResponse.json({
        success: false,
        error: "Please enter a valid 6-digit code",
      }, { status: 400 });
    }

    // Verify OTP using existing infrastructure
    const otpType = method === "whatsapp" ? "phone" : "email";
    
    const baseUrl = process.env.NEXTAUTH_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    
    const verifyResponse = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: otpType,
        phone: method === "whatsapp" ? user.phone_number : undefined,
        email: method === "email" ? user.email : undefined,
        otp,
      }),
    });

    const verifyResult = await verifyResponse.json();

    if (!verifyResponse.ok) {
      return NextResponse.json({
        success: false,
        error: verifyResult.error || "Invalid verification code",
      }, { status: verifyResponse.status });
    }

    // Enable 2FA in database
    await prisma.consumers.update({
      where: { consumer_id: user.consumer_id },
      data: {
        two_factor_enabled: true,
        two_factor_method: method,
        two_factor_enabled_at: new Date(),
      },
    });

    console.log("✅ [2FA] Enabled for:", user.consumer_id, "Method:", method);

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication has been enabled successfully",
      data: {
        enabled: true,
        method,
      },
    });
  } catch (error) {
    console.error("❌ 2FA setup POST error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to enable 2FA",
    }, { status: 500 });
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function maskPhone(phone: string): string {
  if (phone.length < 6) return "***";
  return phone.slice(0, 4) + "****" + phone.slice(-3);
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "***@***";
  
  const maskedLocal = localPart.length > 2 
    ? localPart[0] + "***" + localPart.slice(-1)
    : "***";
  
  return `${maskedLocal}@${domain}`;
}

export const dynamic = "force-dynamic";
