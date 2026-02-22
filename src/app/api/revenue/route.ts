// src/app/api/revenue/route.ts
// NaijaMarket Intel — Revenue Attribution API
// Reads from Revenue_Events table

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30d";

    // Calculate date range
    let daysBack = 30;
    if (period === "7d") daysBack = 7;
    else if (period === "90d") daysBack = 90;
    else if (period === "all") daysBack = 3650; // ~10 years

    // ---- Revenue by Type ----
    let byType: any[] = [];
    try {
      byType = await prisma.$queryRaw`
        SELECT event_type, 
               SUM(amount_ngn) AS total,
               COUNT(*) AS cnt,
               COUNT(DISTINCT phone_number) AS customers
        FROM Revenue_Events
        WHERE payment_status = 'COMPLETED'
          AND created_at >= DATEADD(DAY, ${-daysBack}, GETDATE())
          AND amount_ngn > 0
        GROUP BY event_type
        ORDER BY total DESC
      `;
    } catch { /* table may not exist */ }

    // ---- Revenue by Channel ----
    let byChannel: any[] = [];
    try {
      byChannel = await prisma.$queryRaw`
        SELECT channel,
               SUM(amount_ngn) AS total,
               COUNT(*) AS cnt
        FROM Revenue_Events
        WHERE payment_status = 'COMPLETED'
          AND created_at >= DATEADD(DAY, ${-daysBack}, GETDATE())
          AND amount_ngn > 0
        GROUP BY channel
        ORDER BY total DESC
      `;
    } catch { /* */ }

    // ---- Revenue by Tier ----
    let byTier: any[] = [];
    try {
      byTier = await prisma.$queryRaw`
        SELECT ISNULL(subscription_tier, 'N/A') AS tier,
               SUM(amount_ngn) AS total,
               COUNT(*) AS cnt
        FROM Revenue_Events
        WHERE payment_status = 'COMPLETED'
          AND created_at >= DATEADD(DAY, ${-daysBack}, GETDATE())
          AND amount_ngn > 0
        GROUP BY subscription_tier
        ORDER BY total DESC
      `;
    } catch { /* */ }

    // ---- Revenue by Attribution Source ----
    let bySource: any[] = [];
    try {
      bySource = await prisma.$queryRaw`
        SELECT ISNULL(attribution_source, 'UNKNOWN') AS source,
               SUM(amount_ngn) AS total,
               COUNT(*) AS cnt
        FROM Revenue_Events
        WHERE payment_status = 'COMPLETED'
          AND created_at >= DATEADD(DAY, ${-daysBack}, GETDATE())
          AND amount_ngn > 0
        GROUP BY attribution_source
        ORDER BY total DESC
      `;
    } catch { /* */ }

    // ---- Daily Trend ----
    let dailyTrend: any[] = [];
    try {
      dailyTrend = await prisma.$queryRaw`
        SELECT CONVERT(VARCHAR, CAST(created_at AS DATE), 23) AS [date],
               SUM(amount_ngn) AS total,
               SUM(CASE WHEN event_type = 'SUBSCRIPTION' THEN amount_ngn ELSE 0 END) AS subscriptions,
               SUM(CASE WHEN event_type = 'TOKEN_PURCHASE' THEN amount_ngn ELSE 0 END) AS tokens,
               SUM(CASE WHEN event_type = 'API_CALL' THEN amount_ngn ELSE 0 END) AS api
        FROM Revenue_Events
        WHERE payment_status = 'COMPLETED'
          AND created_at >= DATEADD(DAY, ${-daysBack}, GETDATE())
          AND amount_ngn > 0
        GROUP BY CAST(created_at AS DATE)
        ORDER BY CAST(created_at AS DATE)
      `;
    } catch { /* */ }

    // ---- Top Customers ----
    let topCustomers: any[] = [];
    try {
      topCustomers = await prisma.$queryRaw`
        SELECT TOP 10 phone_number AS phone,
               SUM(amount_ngn) AS total,
               COUNT(*) AS cnt
        FROM Revenue_Events
        WHERE payment_status = 'COMPLETED'
          AND created_at >= DATEADD(DAY, ${-daysBack}, GETDATE())
          AND amount_ngn > 0
          AND phone_number IS NOT NULL
        GROUP BY phone_number
        ORDER BY total DESC
      `;
    } catch { /* */ }

    // ---- Period comparison ----
    let currentTotal = 0;
    let previousTotal = 0;
    try {
      const totals: any[] = await prisma.$queryRaw`
        SELECT 
          SUM(CASE WHEN created_at >= DATEADD(DAY, ${-daysBack}, GETDATE()) THEN amount_ngn ELSE 0 END) AS current_total,
          SUM(CASE WHEN created_at >= DATEADD(DAY, ${-daysBack * 2}, GETDATE()) 
                    AND created_at < DATEADD(DAY, ${-daysBack}, GETDATE()) THEN amount_ngn ELSE 0 END) AS previous_total
        FROM Revenue_Events
        WHERE payment_status = 'COMPLETED' AND amount_ngn > 0
      `;
      if (totals.length > 0) {
        currentTotal = Number(totals[0].current_total || 0);
        previousTotal = Number(totals[0].previous_total || 0);
      }
    } catch { /* */ }

    // Helper: convert array to keyed object
    const toMap = (arr: any[], keyField: string, valField: string = "total") =>
      arr.reduce((acc: Record<string, number>, row: any) => {
        acc[String(row[keyField] || "UNKNOWN")] = Number(row[valField] || 0);
        return acc;
      }, {});

    const totalRevenue = byType.reduce((s, r) => s + Number(r.total || 0), 0);
    const totalTransactions = byType.reduce((s, r) => s + Number(r.cnt || 0), 0);
    const uniqueCustomers = new Set(
      [...byType.map((r: any) => r.customers)].filter(Boolean)
    ).size || byType.reduce((s, r) => s + Number(r.customers || 0), 0);

    const changePct = previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : currentTotal > 0 ? 100 : 0;

    const stats = {
      total_revenue: totalRevenue,
      total_transactions: totalTransactions,
      unique_customers: uniqueCustomers,
      avg_transaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
      revenue_by_type: toMap(byType, "event_type"),
      revenue_by_channel: toMap(byChannel, "channel"),
      revenue_by_tier: toMap(byTier, "tier"),
      revenue_by_source: toMap(bySource, "source"),
      daily_trend: dailyTrend.map((d: any) => ({
        date: d.date,
        total: Number(d.total || 0),
        subscriptions: Number(d.subscriptions || 0),
        tokens: Number(d.tokens || 0),
        api: Number(d.api || 0),
      })),
      top_customers: topCustomers.map((c: any) => ({
        phone: String(c.phone || ""),
        total: Number(c.total || 0),
        count: Number(c.cnt || 0),
      })),
      period_comparison: {
        current: currentTotal,
        previous: previousTotal,
        change_pct: changePct,
      },
    };

    return NextResponse.json({ success: true, period, stats });
  } catch (error) {
    console.error("Revenue API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load revenue data" },
      { status: 500 }
    );
  }
}
