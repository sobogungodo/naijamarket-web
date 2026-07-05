// src/app/api/mobile/consumer/alerts/route.ts
// NaijaMarket Intel — Consumer mobile price alerts (Bearer JWT auth)
// Additive route. Does NOT touch the PWA's /api/alerts.
// consumer_id is ALWAYS taken from the verified JWT, never from the request body.

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";

async function verifyConsumer(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  // Fail-closed: no hardcoded fallback secret — unset env means 401,
  // matching the subscribe/tiers mobile-lane routes.
  const secret = process.env.CONSUMER_JWT_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(auth.slice(7), new TextEncoder().encode(secret));
    return payload as { consumer_id?: string; phone_number?: string; subscription_tier?: string };
  } catch {
    return null;
  }
}

function genAlertId() {
  return `ALT${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

export async function GET(request: NextRequest) {
  const c = await verifyConsumer(request);
  if (!c?.consumer_id)
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT alert_id, item_id, item_name, market_id, market_name,
             target_price, alert_type, status, created_at
      FROM Price_Alerts
      WHERE consumer_id = ${c.consumer_id} AND status <> 'DELETED'
      ORDER BY created_at DESC`;
    const data = rows.map((a) => ({
      alert_id: a.alert_id,
      item_id: a.item_id,
      item_name: a.item_name,
      market_id: a.market_id,
      market_name: a.market_name,
      threshold: Number(a.target_price) || 0,
      direction: String(a.alert_type || "").toUpperCase() === "ABOVE" ? "above" : "below",
      active: a.status === "ACTIVE",
      created_at: a.created_at,
    }));
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error("[mobile/consumer/alerts GET]", e);
    return NextResponse.json({ success: false, error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const c = await verifyConsumer(request);
  if (!c?.consumer_id)
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const { item_id, item_name, market_id, market_name, threshold, direction } =
      await request.json();
    if (!item_id || !market_id || threshold == null || !direction)
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    const price = parseFloat(String(threshold));
    if (!price || price <= 0)
      return NextResponse.json({ success: false, error: "Invalid threshold" }, { status: 400 });
    const alertType = String(direction).toUpperCase() === "ABOVE" ? "ABOVE" : "BELOW";
    const alertId = genAlertId();
    const now = new Date();
    await prisma.$executeRaw`
      INSERT INTO Price_Alerts
        (alert_id, consumer_id, phone_number, item_id, item_name,
         market_id, market_name, target_price, alert_type, status, created_at, updated_at)
      VALUES
        (${alertId}, ${c.consumer_id}, ${c.phone_number || ""}, ${item_id}, ${item_name || null},
         ${market_id}, ${market_name || null}, ${price}, ${alertType}, 'ACTIVE', ${now}, ${now})`;
    return NextResponse.json({ success: true, alert_id: alertId });
  } catch (e: any) {
    console.error("[mobile/consumer/alerts POST]", e);
    return NextResponse.json({ success: false, error: "Failed to create alert" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const c = await verifyConsumer(request);
  if (!c?.consumer_id)
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const { alert_id, active } = await request.json();
    if (!alert_id)
      return NextResponse.json({ success: false, error: "alert_id required" }, { status: 400 });
    const status = active ? "ACTIVE" : "PAUSED";
    const now = new Date();
    await prisma.$executeRaw`
      UPDATE Price_Alerts SET status = ${status}, updated_at = ${now}
      WHERE alert_id = ${alert_id} AND consumer_id = ${c.consumer_id}`;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[mobile/consumer/alerts PATCH]", e);
    return NextResponse.json({ success: false, error: "Failed to update alert" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const c = await verifyConsumer(request);
  if (!c?.consumer_id)
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const alertId = request.nextUrl.searchParams.get("alert_id");
    if (!alertId)
      return NextResponse.json({ success: false, error: "alert_id required" }, { status: 400 });
    await prisma.$executeRaw`
      DELETE FROM Price_Alerts
      WHERE alert_id = ${alertId} AND consumer_id = ${c.consumer_id}`;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[mobile/consumer/alerts DELETE]", e);
    return NextResponse.json({ success: false, error: "Failed to delete alert" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
