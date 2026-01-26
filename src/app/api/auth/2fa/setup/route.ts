// ============================================================================
// src/app/api/auth/2fa/setup/route.ts
// NaijaMarket Intel - Two-Factor Authentication Setup
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
  console.log("[2FA Setup] Session data:", { email, name, phone });

  try {
    // Strategy 1: By email
    if (email) {
      console.log("[2FA Setup] Trying lookup by email:", email);
      const user = await prisma.consumers.findFirst({
        where: { email: email },
      });
      if (user) {
        console.log("[2FA Setup] Found by email");
        return user;
      }
    }

    // Strategy 2: By phone (if present in session)
    if (phone) {
      console.log("[2FA Setup] Trying lookup by phone:", phone);
      const user = await prisma.consumers.findFirst({
        where: { phone_number: phone },
      });
      if (user) {
        console.log("[2FA Setup] Found by phone");
        return user;
      }
    }

    // Strategy 3: Extract phone suffix from name like "User 5952"
    if (name && name.startsWith("User ")) {
      const phoneSuffix = name.replace("User ", "");
      if (phoneSuffix && /^\d{4,}$/.test(phoneSuffix)) {
        console.log("[2FA Setup] Trying lookup by phone suffix:", phoneSuffix);
        const users = await prisma.$queryRawUnsafe<any[]>(`
          SELECT * FROM Consumers 
          WHERE phone_number LIKE '%${phoneSuffix}'
          ORDER BY created_at DESC
        `);
        if (users && users.length > 0) {
          console.log("[2FA Setup] Found by phone suffix");
          return users[0];
        }
      }
    }

    // Strategy 4: By full_name (when session has actual name, not "User XXXX")
    if (name && !name.startsWith("User ")) {
      console.log("[2FA Setup] Trying lookup by full_name:", name);
      
      // Try exact match first
      let user = await prisma.consumers.findFirst({
        where: { full_name: name },
      });
      
      if (user) {
        console.log("[2FA Setup] Found by full_name (exact)");
        return user;
      }

      // Try case-insensitive search
      console.log("[2FA Setup] Trying case-insensitive full_name search");
      const users = await prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM Consumers 
        WHERE LOWER(full_name) = LOWER('${name.replace(/'/g, "''")}')
        ORDER BY created_at DESC
      `);

      if (users && users.length > 0) {
        console.log("[2FA Setup] Found by full_name (case-insensitive)");
        return users[0];
      }
    }

    console.log("[2FA Setup] User not found with any strategy");
    return null;
  } catch (error: any) {
    console.error("[2FA Setup] Database error:", error.message);
    return null;
  }
}

// ============================================================================
// GET - Get available 2FA methods
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

    // Determine available methods based on user's contact info
    const availableMethods = [];
    
    if (user.phone_number) {
      availableMethods.push({
        id: "whatsapp",
        name: "WhatsApp",
        description: `Send code to ${user.phone_number.slice(0, 4)}****${user.phone_number.slice(-4)}`,
        icon: "📱",
      });
    }
    
    if (user.email) {
      availableMethods.push({
        id: "email",
        name: "Email",
        description: `Send code to ${user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3")}`,
        icon: "📧",
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        isEnabled: user.two_factor_enabled || false,
        currentMethod: user.two_factor_method || null,
        enabledAt: user.two_factor_enabled_at || null,
        availableMethods,
      },
    });
  } catch (error: any) {
    console.error("[2FA Setup] Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Internal server error",
    }, { status: 500 });
  }
}

// ============================================================================
// POST - Setup 2FA (send code or verify)
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

    const body = await request.json();
    const { method, otp } = body;

    // If OTP provided, verify and enable 2FA
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

      // Enable 2FA
      await prisma.consumers.update({
        where: { consumer_id: user.consumer_id },
        data: {
          two_factor_enabled: true,
          two_factor_method: method || user.two_factor_method || "whatsapp",
          two_factor_enabled_at: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Two-factor authentication enabled successfully",
        data: {
          isEnabled: true,
          method: method || user.two_factor_method || "whatsapp",
        },
      });
    }

    // No OTP - send verification code
    if (!method) {
      return NextResponse.json({
        success: false,
        error: "Method is required",
      }, { status: 400 });
    }

    // Send OTP using existing endpoint
    const sendResponse = await fetch(new URL("/api/auth/send-otp", request.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: method === "whatsapp" ? user.phone_number : undefined,
        email: method === "email" ? user.email : undefined,
        type: "2fa_setup",
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
    console.error("[2FA Setup] Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Internal server error",
    }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
