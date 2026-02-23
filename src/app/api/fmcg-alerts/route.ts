// ============================================================================
// src/app/api/fmcg-alerts/route.ts
// NaijaMarket Intel - FMCG Alert Subscription Management
// Version: 1.0.0 | Date: 2026-02-23
//
// GET  /api/fmcg-alerts              — List all FMCG subscriptions (admin)
// GET  /api/fmcg-alerts?email=xxx    — Get specific company subscription
// POST /api/fmcg-alerts              — Create new FMCG subscription
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  try {
    if (email) {
      const sub = await prisma.$queryRaw<any[]>`
        SELECT * FROM FMCG_Alert_Subscriptions WHERE contact_email = ${email} AND status = 'ACTIVE'
      `;
      return NextResponse.json({ success: true, subscription: sub[0] || null });
    }

    const subs = await prisma.$queryRaw<any[]>`
      SELECT fmcg_id, company_name, contact_name, contact_email, alert_type, plan, 
             delivery_method, total_alerts_sent, last_alert_at, status, created_at
      FROM FMCG_Alert_Subscriptions
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ success: true, total: subs.length, subscriptions: subs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_name, contact_name, contact_email, contact_phone, tracked_items, tracked_markets, alert_type, delivery_method, whatsapp_number, plan, price_change_threshold } = body;

    if (!company_name || !contact_name || !contact_email || !tracked_items) {
      return NextResponse.json({ error: "company_name, contact_name, contact_email, tracked_items required" }, { status: 400 });
    }

    // Check duplicate
    const existing = await prisma.$queryRaw<any[]>`
      SELECT fmcg_id FROM FMCG_Alert_Subscriptions WHERE contact_email = ${contact_email} AND status = 'ACTIVE'
    `;
    if (existing.length > 0) {
      return NextResponse.json({ error: "Active subscription already exists for this email" }, { status: 409 });
    }

    const itemsJSON = typeof tracked_items === "string" ? tracked_items : JSON.stringify(tracked_items);
    const marketsJSON = tracked_markets ? (typeof tracked_markets === "string" ? tracked_markets : JSON.stringify(tracked_markets)) : null;
    const feeMap: Record<string, number> = { BASIC: 100000, PRO: 250000, ENTERPRISE: 500000, TRIAL: 0 };
    const selectedPlan = plan || "TRIAL";
    const fee = feeMap[selectedPlan] || 0;

    await prisma.$executeRaw`
      INSERT INTO FMCG_Alert_Subscriptions 
        (company_name, contact_name, contact_email, contact_phone, tracked_items, tracked_markets,
         alert_type, delivery_method, whatsapp_number, plan, monthly_fee, price_change_threshold)
      VALUES 
        (${company_name}, ${contact_name}, ${contact_email}, ${contact_phone || null}, ${itemsJSON}, ${marketsJSON},
         ${alert_type || "DAILY"}, ${delivery_method || "EMAIL"}, ${whatsapp_number || null}, ${selectedPlan}, ${fee}, ${price_change_threshold || 5.0})
    `;

    return NextResponse.json({
      success: true,
      message: `FMCG subscription created for ${company_name}`,
      plan: selectedPlan,
      monthlyFee: fee,
      alertType: alert_type || "DAILY",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
