// ============================================================================
// src/app/api/morning-brief/route.ts
// NaijaMarket Intel - Morning Brief Subscription API
// Version: 1.0.0 | Date: 2026-02-20
//
// GET    → Get user's Morning Brief subscription
// POST   → Subscribe / update preferences
// DELETE → Cancel subscription
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma as sharedPrisma } from "@/lib/db";
import { getServerSession } from "next-auth";

// ============================================================================
// PRISMA
// ============================================================================

import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = sharedPrisma;
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ============================================================================
// FIND USER FROM SESSION (same pattern as settings route)
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

    // Strategy 4: By full_name
    if (name && !name.startsWith("User ")) {
      const user = await prisma.consumers.findFirst({
        where: { full_name: name },
      });
      if (user) return user;

      const users = await prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM Consumers 
        WHERE LOWER(full_name) = LOWER('${name.replace(/'/g, "''")}')
        ORDER BY created_at DESC
      `);
      if (users && users.length > 0) return users[0];
    }

    return null;
  } catch (error: any) {
    console.error("[MorningBrief] findUser error:", error.message);
    return null;
  }
}

function genId(): string {
  return `MB_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// ============================================================================
// GET - Fetch user's Morning Brief subscription
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserFromSession(session);
    const phone = (user as any)?.phone_number || "";

    if (!phone) {
      return NextResponse.json({ success: true, subscription: null, phone_missing: true });
    }

    // Fetch subscription (may fail if table not created yet)
    let subscription = null;
    try {
      const results = await prisma.$queryRaw`
        SELECT 
          brief_id, phone_number, plan_type, price_weekly,
          billing_status, billing_start, billing_end,
          selected_markets, selected_items, max_items,
          delivery_time, delivery_channel, status,
          last_sent_at, total_sent, created_at
        FROM Morning_Brief_Subscriptions
        WHERE phone_number = ${phone}
          AND status != 'CANCELLED'
        ORDER BY created_at DESC
      ` as any[];
      subscription = results[0] || null;
    } catch (e) {
      console.log("[MorningBrief] Subscription table may not exist yet:", (e as any).message);
    }

    // Also fetch available markets and items for the picker
    const markets = await prisma.$queryRaw`
      SELECT market_id, market_name, ISNULL(state, 'Other') as state
      FROM Markets
      WHERE status IS NULL OR status = 'ACTIVE' OR status = 'active'
      ORDER BY state, market_name
    ` as any[];

    const items = await prisma.$queryRaw`
      SELECT i.item_id, i.item_name, 
             ISNULL(c.category_name, 'Other') as category,
             ISNULL(i.Unit, '') as unit
      FROM Items_Catalog i
      LEFT JOIN Categories c ON i.category_id = c.category_id
      WHERE (i.status IS NULL OR i.status = 'ACTIVE' OR i.status = 'active')
        AND c.category_name IN (
          'Beans & Legumes', 'Bread & Bakery', 'Cereals & Grains',
          'Cooking Oil', 'Dairy & Eggs', 'Fish & Seafood', 'Flour',
          'Fruits', 'Garri & Cassava', 'Meat & Poultry', 'Nuts & Seeds',
          'Pasta & Noodles', 'Pepper & Spices', 'Plantain & Yam',
          'Rice', 'Roots & Tubers', 'Salt & Seasonings', 'Snacks',
          'Sugar & Sweeteners', 'Tomato & Sauce', 'Vegetables',
          'Beverages', 'Canned Foods', 'Food', 'Foodstuff',
          'Grains', 'Tubers', 'Provisions', 'Condiments'
        )
      ORDER BY c.category_name, i.item_name
    ` as any[];

    return NextResponse.json({
      success: true,
      subscription,
      markets,
      items,
    });
  } catch (error: any) {
    console.error("[MorningBrief] GET error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// ============================================================================
// POST - Subscribe or update Morning Brief
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserFromSession(session);
    const phone = (user as any)?.phone_number || "";
    const email = (user as any)?.email || session.user?.email || "";

    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    const body = await request.json();
    const {
      plan_type = "DEFAULT",        // DEFAULT | PERSONALIZED
      selected_markets = [],         // Array of market_ids
      selected_items = [],           // Array of item_ids
      delivery_time = "05:30",       // HH:MM WAT
      delivery_channel = "WHATSAPP", // WHATSAPP | PUSH | BOTH
      action = "subscribe",          // subscribe | update | pause | resume
    } = body;

    // Validate
    if (plan_type === "PERSONALIZED") {
      if (selected_markets.length === 0) {
        return NextResponse.json({ error: "Select at least 1 market" }, { status: 400 });
      }
      if (selected_markets.length > 8) {
        return NextResponse.json({ error: "Maximum 8 markets" }, { status: 400 });
      }
      if (selected_items.length > 15) {
        return NextResponse.json({ error: "Maximum 15 items" }, { status: 400 });
      }
    }

    const marketsJson = JSON.stringify(selected_markets);
    const itemsJson = JSON.stringify(selected_items.length > 0 ? selected_items : []);
    const priceWeekly = plan_type === "PERSONALIZED" ? 100 : 0;

    // Check existing
    const existing = await prisma.$queryRaw`
      SELECT brief_id, status
      FROM Morning_Brief_Subscriptions
      WHERE phone_number = ${phone}
        AND status != 'CANCELLED'
    ` as any[];

    if (action === "pause" && existing.length > 0) {
      await prisma.$executeRaw`
        UPDATE Morning_Brief_Subscriptions
        SET status = 'PAUSED', updated_at = GETDATE()
        WHERE phone_number = ${phone} AND status = 'ACTIVE'
      `;
      return NextResponse.json({ success: true, action: "paused" });
    }

    if (action === "resume" && existing.length > 0) {
      await prisma.$executeRaw`
        UPDATE Morning_Brief_Subscriptions
        SET status = 'ACTIVE', updated_at = GETDATE()
        WHERE phone_number = ${phone} AND status = 'PAUSED'
      `;
      return NextResponse.json({ success: true, action: "resumed" });
    }

    if (existing.length > 0) {
      // Update existing
      await prisma.$executeRaw`
        UPDATE Morning_Brief_Subscriptions
        SET plan_type = ${plan_type},
            price_weekly = ${priceWeekly},
            selected_markets = ${marketsJson},
            selected_items = ${itemsJson},
            delivery_time = ${delivery_time},
            delivery_channel = ${delivery_channel},
            status = 'ACTIVE',
            updated_at = GETDATE()
        WHERE phone_number = ${phone}
          AND status != 'CANCELLED'
      `;

      return NextResponse.json({ success: true, action: "updated" });
    }

    // New subscription
    const briefId = genId();
    const consumerId = (user as any)?.consumer_id || "";

    await prisma.$executeRaw`
      INSERT INTO Morning_Brief_Subscriptions (
        brief_id, consumer_id, phone_number, email,
        plan_type, price_weekly, billing_status,
        selected_markets, selected_items,
        delivery_time, delivery_channel,
        status, created_at, updated_at
      ) VALUES (
        ${briefId}, ${consumerId}, ${phone}, ${email},
        ${plan_type}, ${priceWeekly}, ${priceWeekly > 0 ? "PENDING" : "FREE"},
        ${marketsJson}, ${itemsJson},
        ${delivery_time}, ${delivery_channel},
        'ACTIVE', GETDATE(), GETDATE()
      )
    `;

    return NextResponse.json({
      success: true,
      action: "subscribed",
      brief_id: briefId,
      plan_type,
      price_weekly: priceWeekly,
    });
  } catch (error: any) {
    console.error("[MorningBrief] POST error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// ============================================================================
// DELETE - Cancel Morning Brief
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserFromSession(session);
    const phone = (user as any)?.phone_number || "";

    await prisma.$executeRaw`
      UPDATE Morning_Brief_Subscriptions
      SET status = 'CANCELLED', updated_at = GETDATE()
      WHERE phone_number = ${phone}
        AND status IN ('ACTIVE', 'PAUSED')
    `;

    return NextResponse.json({ success: true, action: "cancelled" });
  } catch (error: any) {
    console.error("[MorningBrief] DELETE error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
