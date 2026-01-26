// ============================================================================
// src/app/api/auth/2fa/debug/route.ts
// NaijaMarket Intel - 2FA Debug Endpoint
// TEMPORARY - Remove after fixing
// ============================================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    
    // Get session info
    const sessionInfo = {
      hasSession: !!session,
      hasUser: !!session?.user,
      userName: session?.user?.name || null,
      userEmail: session?.user?.email || null,
      userImage: session?.user?.image || null,
      fullUser: session?.user || null,
    };

    // Extract phone suffix from name
    let phoneSuffix = null;
    const name = session?.user?.name;
    if (name && name.startsWith("User ")) {
      phoneSuffix = name.replace("User ", "");
    }

    // Try to find users with matching phone suffix
    let matchingUsers: any[] = [];
    if (phoneSuffix) {
      try {
        matchingUsers = await prisma.$queryRawUnsafe(`
          SELECT TOP 5 
            consumer_id, 
            phone_number, 
            email, 
            full_name,
            two_factor_enabled,
            two_factor_method
          FROM Consumers 
          WHERE phone_number LIKE '%${phoneSuffix}'
          ORDER BY created_at DESC
        `);
      } catch (queryError: any) {
        matchingUsers = [{ error: queryError.message }];
      }
    }

    // Get all users (just first 5 for debug)
    let allUsers: any[] = [];
    try {
      allUsers = await prisma.$queryRawUnsafe(`
        SELECT TOP 5 
          consumer_id, 
          phone_number, 
          email,
          RIGHT(phone_number, 4) as last4
        FROM Consumers 
        ORDER BY created_at DESC
      `);
    } catch (queryError: any) {
      allUsers = [{ error: queryError.message }];
    }

    return NextResponse.json({
      success: true,
      debug: {
        session: sessionInfo,
        phoneSuffix,
        matchingUsers,
        recentUsers: allUsers,
      },
      message: "Check 'matchingUsers' to see if your user was found",
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
