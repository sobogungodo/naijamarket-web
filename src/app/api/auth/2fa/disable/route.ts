// ============================================================================
// src/app/api/auth/2fa/disable/route.ts
// NaijaMarket Intel - Two-Factor Authentication Disable
// Version: 1.2.0 - Fixed user lookup with full_name strategy
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma as sharedPrisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = sharedPrisma;

// ============================================================================
// USER LOOKUP HELPER - HANDLES ALL SESSION SCENARIOS
// ============================================================================

async function findUserFromSession(session: any) {
  if (!session?.user) return null;

  const { email, name, phone } = session.user as any;
  console.log("[2FA Disable] Session data:", { email, name, phone });

  try {
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
        const users = await prisma.$queryRawUnsafe<any[]>(`
          SELECT * FROM Consumers 
          WHERE phone_number LIKE '%${phoneSuffix}'
          ORDER BY created_at DESC
        `);
        if (users && users.length > 0) return users[0];
      }
    }

    // Strategy 4: By full_name (when session has actual name, not "User XXXX")
    if (name && !name.startsWith("User ")) {
      // Try exact match first
      let user = await prisma.consumers.findFirst({
        where: { full_name: name },
      });
      if (user) return user;

      // Try case-insensitive search
      const users = await prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM Consumers 
        WHERE LOWER(full_name) = LOWER('${name.replace(/'/g, "''")}')
        ORDER BY created_at DESC
      `);
      if (users && users.length > 0) return users[0];
    }

    return null;
  } catch (error: any) {
    console.error("[2FA Disable] Database error:", error.message);
    return null;
  }
}

// ============================================================================
// POST - Disable 2FA
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: "Not authenticated",
      }, { status: 401 });
    }

    const user = await findUserFromSession(session);
    
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

    const body = await request.json();
    const { otp } = body;

    // If OTP provided, verify and disable 2FA
    if (otp) {
      // Verify OTP using existing endpoint
      const verifyResponse = await fetch(new URL("/api/auth/verify-otp", request.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: user.phone_number,
          email: user.email,
          otp: otp,
        }),
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResult.success) {
        return NextResponse.json({
          success: false,
          error: verifyResult.error || "Invalid verification code",
        }, { status: 400 });
      }

      // Disable 2FA
      await prisma.consumers.update({
        where: { consumer_id: user.consumer_id },
        data: {
          two_factor_enabled: false,
          two_factor_method: null,
          two_factor_enabled_at: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Two-factor authentication disabled successfully",
        data: {
          isEnabled: false,
        },
      });
    }

    // No OTP - send verification code to current 2FA method
    const method = user.two_factor_method || "whatsapp";

    const sendResponse = await fetch(new URL("/api/auth/send-otp", request.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: method === "whatsapp" ? user.phone_number : undefined,
        email: method === "email" ? user.email : undefined,
        type: "2fa_disable",
      }),
    });

    const sendResult = await sendResponse.json();

    if (!sendResult.success) {
      return NextResponse.json({
        success: false,
        error: sendResult.error || "Failed to send verification code",
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Verification code sent via ${method}`,
      data: {
        method,
        codeSent: true,
        expiresIn: 300, // 5 minutes
      },
    });
  } catch (error: any) {
    console.error("[2FA Disable] Error:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error",
    }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
