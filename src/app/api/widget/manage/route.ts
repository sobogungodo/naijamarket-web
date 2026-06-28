// ============================================================================
// src/app/api/widget/manage/route.ts
// NaijaMarket Intel - Widget Key Management
// Version: 1.0.0 | Date: 2026-02-23
//
// GET  /api/widget/manage              — List all widget keys
// POST /api/widget/manage              — Create new widget key
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function GET() {
  try {
    const keys = await prisma.$queryRaw<any[]>`
      SELECT widget_id, widget_key, organization, contact_email, allowed_domains, layout, theme,
             [plan], monthly_fee, total_loads, today_loads, last_loaded_at, status, created_at, expires_at
      FROM Widget_Keys
      ORDER BY created_at DESC
    `;
    return NextResponse.json({
      success: true,
      total: keys.length,
      widgets: keys.map(k => ({
        ...k,
        monthly_fee: Number(k.monthly_fee),
        widget_key_masked: k.widget_key.substring(0, 8) + "..." + k.widget_key.substring(k.widget_key.length - 4),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organization, contact_email, contact_phone, allowed_domains, layout, theme, plan, default_items, default_market } = body;

    if (!organization || !contact_email) {
      return NextResponse.json({ error: "organization and contact_email required" }, { status: 400 });
    }

    const widgetKey = "nmw_" + crypto.randomBytes(24).toString("hex");
    const feeMap: Record<string, number> = { BASIC: 200000, PRO: 500000, ENTERPRISE: 1000000, TRIAL: 0 };
    const selectedPlan = plan || "TRIAL";
    const fee = feeMap[selectedPlan] || 0;

    await prisma.$executeRaw`
      INSERT INTO Widget_Keys 
        (widget_key, organization, contact_email, contact_phone, allowed_domains, layout, theme, [plan], monthly_fee, default_items, default_market)
      VALUES 
        (${widgetKey}, ${organization}, ${contact_email}, ${contact_phone || null}, 
         ${allowed_domains || "*"}, ${layout || "table"}, ${theme || "dark"}, 
         ${selectedPlan}, ${fee}, ${default_items || null}, ${default_market || null})
    `;

    const embedCode = `<!-- NaijaMarket Intel Price Widget -->\n<div id="naijamarket-widget"></div>\n<script src="https://www.naijamarketintel.com/api/widget?key=${widgetKey}&layout=${layout || "table"}&theme=${theme || "dark"}"></script>`;

    return NextResponse.json({
      success: true,
      widget_key: widgetKey,
      embed_code: embedCode,
      plan: selectedPlan,
      monthlyFee: fee,
      message: `Widget key created for ${organization}. Add the embed code to your website.`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
