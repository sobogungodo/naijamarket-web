// ============================================================================
// src/app/api/reports/debug/route.ts
// NaijaMarket Intel - Reports Debug Endpoint
// Version: 1.2.0 - Added full_name lookup strategy
// TEMPORARY - Remove after testing complete
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession();

    // Capture session info
    const sessionInfo = {
      hasSession: !!session,
      hasUser: !!session?.user,
      userName: session?.user?.name || null,
      userEmail: session?.user?.email || null,
      fullUser: session?.user || null,
    };

    const name = session?.user?.name;
    const email = (session?.user as any)?.email;
    const phone = (session?.user as any)?.phone;

    // Extract phone suffix if name matches "User XXXX" pattern
    let phoneSuffix = null;
    if (name && name.startsWith("User ")) {
      phoneSuffix = name.replace("User ", "");
      if (!/^\d{4,}$/.test(phoneSuffix)) {
        phoneSuffix = null;
      }
    }

    // Try all lookup strategies
    let dbResult: any = { strategies: [] };
    let userTier = "UNKNOWN";
    let foundUser: any = null;

    // Strategy 1: By email
    if (email) {
      const strategy1: any = { name: "email", value: email, attempted: true };
      try {
        const user = await prisma.consumers.findFirst({
          where: { email: email },
          select: { consumer_id: true, phone_number: true, email: true, subscription_tier: true, full_name: true },
        });
        strategy1.success = true;
        strategy1.found = !!user;
        strategy1.data = user;
        if (user?.subscription_tier) {
          userTier = user.subscription_tier.toUpperCase();
          foundUser = user;
        }
      } catch (err: any) {
        strategy1.success = false;
        strategy1.error = err.message;
      }
      dbResult.strategies.push(strategy1);
    }

    // Strategy 2: By phone (if in session)
    if (phone && !foundUser) {
      const strategy2: any = { name: "phone", value: phone, attempted: true };
      try {
        const user = await prisma.consumers.findFirst({
          where: { phone_number: phone },
          select: { consumer_id: true, phone_number: true, email: true, subscription_tier: true, full_name: true },
        });
        strategy2.success = true;
        strategy2.found = !!user;
        strategy2.data = user;
        if (user?.subscription_tier) {
          userTier = user.subscription_tier.toUpperCase();
          foundUser = user;
        }
      } catch (err: any) {
        strategy2.success = false;
        strategy2.error = err.message;
      }
      dbResult.strategies.push(strategy2);
    }

    // Strategy 3: By phone suffix from "User XXXX"
    if (phoneSuffix && !foundUser) {
      const strategy3: any = { name: "phoneSuffix", value: phoneSuffix, attempted: true };
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
        strategy3.success = true;
        strategy3.found = users && users.length > 0;
        strategy3.rowCount = users?.length || 0;
        strategy3.data = users;
        if (users && users.length > 0 && users[0].subscription_tier) {
          userTier = users[0].subscription_tier.toUpperCase();
          foundUser = users[0];
        }
      } catch (err: any) {
        strategy3.success = false;
        strategy3.error = err.message;
      }
      dbResult.strategies.push(strategy3);
    }

    // Strategy 4: By full_name (when name is actual name, not "User XXXX")
    if (name && !name.startsWith("User ") && !foundUser) {
      const strategy4: any = { name: "fullName", value: name, attempted: true };
      try {
        // Try exact match first
        let user = await prisma.consumers.findFirst({
          where: { full_name: name },
          select: { consumer_id: true, phone_number: true, email: true, subscription_tier: true, full_name: true },
        });

        if (!user) {
          // Try case-insensitive search
          const users = await prisma.$queryRawUnsafe<any[]>(`
            SELECT TOP 1 
              consumer_id,
              phone_number,
              email,
              subscription_tier,
              full_name
            FROM Consumers 
            WHERE LOWER(full_name) = LOWER('${name.replace(/'/g, "''")}')
            ORDER BY created_at DESC
          `);
          if (users && users.length > 0) {
            user = users[0];
          }
        }

        strategy4.success = true;
        strategy4.found = !!user;
        strategy4.data = user;
        if (user?.subscription_tier) {
          userTier = user.subscription_tier.toUpperCase();
          foundUser = user;
        }
      } catch (err: any) {
        strategy4.success = false;
        strategy4.error = err.message;
      }
      dbResult.strategies.push(strategy4);
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
        extractedValues: {
          email,
          phone,
          name,
          phoneSuffix,
          isUserPattern: name?.startsWith("User ") || false,
        },
        dbResult,
        foundUser,
        tierDetection: {
          detectedTier: userTier,
          tierLevel,
          hasAccess,
          requiredLevel: "> 0",
        },
      },
      message: hasAccess
        ? "User SHOULD have access to reports"
        : "User should NOT have access (tier too low or user not found)",
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
