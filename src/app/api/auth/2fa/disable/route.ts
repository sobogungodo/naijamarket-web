// ============================================================================
// src/app/api/auth/2fa/disable/route.ts
// NaijaMarket Intel - Disable Two-Factor Authentication
// Uses existing WhatsApp/Email OTP infrastructure
// Version: 1.0.0
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// POST - Disable 2FA
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
    const { otp } = body;

    // Find user
    const user = await prisma.consumers.findFirst({
      where: { 
        OR: [
          { email: session.user.email || undefined },
          { phone_number: (session.user as any)?.phone || undefined },
        ]
      },
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        error: "User not found",
      }, { status: 404 });
    }

    // Check if 2FA is enabled
    if (!user.two_factor_enabled) {
      return NextResponse.json({
        success: false,
        error: "Two-factor authentication is not enabled",
      }, { status: 400 });
    }

    // Get the 2FA method to determine where to send OTP
    const method = user.two_factor_method || "email";

    // ================================================================
    // Step 1: If no OTP provided, send one
    // ================================================================
    if (!otp) {
      const otpType = method === "whatsapp" ? "phone" : "email";
      
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
        method,
      });
    }

    // ================================================================
    // Step 2: Verify OTP and disable 2FA
    // ================================================================
    if (otp.length !== 6) {
      return NextResponse.json({
        success: false,
        error: "Please enter a valid 6-digit code",
      }, { status: 400 });
    }

    // Verify OTP
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

    // Disable 2FA in database
    await prisma.consumers.update({
      where: { consumer_id: user.consumer_id },
      data: {
        two_factor_enabled: false,
        two_factor_method: null,
        two_factor_enabled_at: null,
      },
    });

    console.log("✅ [2FA] Disabled for:", user.consumer_id);

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication has been disabled",
    });
  } catch (error) {
    console.error("❌ 2FA disable error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to disable 2FA",
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
