// ============================================================================
// src/app/api/auth/2fa/status/route.ts
// NaijaMarket Intel - Two-Factor Authentication Status
// Version: 1.1.0 - Fixed user lookup
// ============================================================================

import { NextResponse } from "next/server";
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
    const user = await findUserFromSession(session);

    if (!user) {
      console.log("[2FA Status] User not found. Session:", JSON.stringify(session.user));
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
