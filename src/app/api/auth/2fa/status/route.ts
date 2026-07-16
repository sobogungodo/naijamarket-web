// ============================================================================
// src/app/api/auth/2fa/status/route.ts
// NaijaMarket Intel - Two-Factor Authentication Status
// Version: 1.2.0 - Fixed user lookup with full_name strategy
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// USER LOOKUP HELPER - HANDLES ALL SESSION SCENARIOS
// ============================================================================

async function findUserFromSession(session: any) {
  if (!session?.user) return null;

  const { email, name, phone } = session.user as any;

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
    console.error("[2FA Status] Database error:", error.message);
    return null;
  }
}

// ============================================================================
// GET - Get current 2FA status
// ============================================================================

export async function GET(_request: NextRequest) {
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

    return NextResponse.json({
      success: true,
      data: {
        isEnabled: user.two_factor_enabled || false,
        method: user.two_factor_method || null,
        enabledAt: user.two_factor_enabled_at || null,
        phone: user.phone_number ? `${user.phone_number.slice(0, 4)}****${user.phone_number.slice(-4)}` : null,
        email: user.email ? user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3") : null,
      },
    });
  } catch (error: any) {
    console.error("[2FA Status] Error:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error",
    }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
