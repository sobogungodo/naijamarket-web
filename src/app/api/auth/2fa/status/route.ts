// ============================================================================
// src/app/api/auth/2fa/status/route.ts
// NaijaMarket Intel - Two-Factor Authentication Status
// Version: 1.0.0
// ============================================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// GET - Get 2FA status for current user
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

    // Find user
    const user = await prisma.consumers.findFirst({
      where: { 
        OR: [
          { email: session.user.email || undefined },
          { phone_number: (session.user as any)?.phone || undefined },
        ]
      },
      select: {
        consumer_id: true,
        email: true,
        phone_number: true,
        two_factor_enabled: true,
        two_factor_method: true,
        two_factor_enabled_at: true,
      },
    });

    if (!user) {
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
        methodLabel: user.two_factor_method === "whatsapp" ? "WhatsApp OTP" : 
                     user.two_factor_method === "email" ? "Email OTP" : null,
        enabledAt: user.two_factor_enabled_at,
        destination: user.two_factor_method === "whatsapp" 
          ? (user.phone_number ? maskPhone(user.phone_number) : null)
          : (user.email ? maskEmail(user.email) : null),
      },
    });
  } catch (error) {
    console.error("2FA status error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to get 2FA status",
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
