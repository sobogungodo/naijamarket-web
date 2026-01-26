// ============================================================================
// src/app/api/reports/debug/route.ts
// NaijaMarket Intel - Reports Debug Endpoint (Using Prisma)
// TEMPORARY - Remove after fixing
// ============================================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    
    // Session info
    const sessionInfo = {
      hasSession: !!session,
      hasUser: !!session?.user,
      userName: session?.user?.name || null,
      userEmail: session?.user?.email || null,
      fullUser: session?.user || null,
    };

    // Extract phone suffix
    let phoneSuffix = null;
    const name = session?.user?.name;
    if (name && name.startsWith("User ")) {
      phoneSuffix = name.replace("User ", "");
    }

    // Try database lookup with Prisma
    let dbResult: any = { attempted: false };
    let userTier = "UNKNOWN";
    
    if (phoneSuffix && /^\d{4,}$/.test(phoneSuffix)) {
      dbResult.attempted = true;
      dbResult.phoneSuffix = phoneSuffix;
      
      try {
        const users = await prisma.$queryRawUnsafe<any[]>(`
          SELECT TOP 1 
            consumer_id,
            phone_number,
            email,
            subscription_tier,
            full_name
          FROM Consumers 
          WHERE phone_number LIKE '%${phoneSuffix}'
          ORDER BY created_at DESC
        `);
        
        dbResult.success = true;
        dbResult.rowCount = users?.length || 0;
        dbResult.data = users;
        
        if (users && users.length > 0 && users[0].subscription_tier) {
          userTier = users[0].subscription_tier.toUpperCase();
        }
      } catch (dbError: any) {
        dbResult.success = false;
        dbResult.error = dbError.message;
      }
    }

    // Check tier access
    const TIER_ACCESS: Record<string, number> = {
      FREE: 0,
      SILVER: 0,
      GOLD: 0,
      BUSINESS: 10,
      CORPORATE: 999,
      ENTERPRISE: 999,
    };
    
    const tierLevel = TIER_ACCESS[userTier] ?? 0;
    const hasAccess = tierLevel > 0;

    return NextResponse.json({
      success: true,
      debug: {
        session: sessionInfo,
        phoneSuffix,
        dbResult,
        tierDetection: {
          detectedTier: userTier,
          tierLevel,
          hasAccess,
          requiredLevel: "> 0",
        },
      },
      message: hasAccess 
        ? "User SHOULD have access to reports" 
        : "User should NOT have access (tier too low)",
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
