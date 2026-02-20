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
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ============================================================================
// PRISMA
// ============================================================================

import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ============================================================================
// HELPERS
// ============================================================================

function genId(): string {
  return `MB_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// ============================================================================
// GET - Fetch user's Morning Brief subscription
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const phone = user.phone || user.phone_number || "";

    if (!phone) {
      return NextResponse.json({ success: true, subscription: null });
    }

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

    // Also fetch available markets and items for the picker
    const markets = await prisma.$queryRaw`
      SELECT DISTINCT market_id, market_name, state
      FROM Markets
      WHERE status = 'ACTIVE'
      ORDER BY state, market_name
    ` as any[];

    const items = await prisma.$queryRaw`
      SELECT DISTINCT item_id, item_name, category, unit
      FROM Items_Catalog
      WHERE status = 'ACTIVE'
      ORDER BY category, item_name
    ` as any[];

    return NextResponse.json({
      success: true,
      subscription: results[0] || null,
      markets,
      items,
    });
  } catch (error: any) {
    console.error("[MorningBrief] GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ============================================================================
// POST - Subscribe or update Morning Brief
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const phone = user.phone || user.phone_number || "";
    const email = user.email || "";

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
    const consumerId = user.consumer_id || user.id || "";

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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ============================================================================
// DELETE - Cancel Morning Brief
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const phone = user.phone || user.phone_number || "";

    await prisma.$executeRaw`
      UPDATE Morning_Brief_Subscriptions
      SET status = 'CANCELLED', updated_at = GETDATE()
      WHERE phone_number = ${phone}
        AND status IN ('ACTIVE', 'PAUSED')
    `;

    return NextResponse.json({ success: true, action: "cancelled" });
  } catch (error: any) {
    console.error("[MorningBrief] DELETE error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
