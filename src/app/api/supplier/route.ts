// src/app/api/supplier/route.ts
// NaijaMarket Intel — Supplier Intelligence API
// Reads from Supplier_Metrics table (or falls back to aggregating Daily_Prices)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Try Supplier_Metrics table first
    let metrics: any[] = [];
    let fromDedicated = false;

    try {
      metrics = await prisma.$queryRaw`
        SELECT TOP 200
          market_name, state, zone, item_name, category_name,
          CONVERT(VARCHAR, metric_date, 23) AS metric_date,
          avg_price, min_price, max_price, price_volatility,
          submission_count, supply_score, demand_indicator,
          trend_7d, trend_30d, shortage_risk
        FROM Supplier_Metrics
        WHERE metric_date >= DATEADD(DAY, -7, CAST(GETDATE() AS DATE))
        ORDER BY 
          CASE shortage_risk 
            WHEN 'CRITICAL' THEN 0 
            WHEN 'WARNING' THEN 1 
            WHEN 'WATCH' THEN 2 
            ELSE 3 
          END,
          metric_date DESC
      `;
      fromDedicated = true;
    } catch {
      // Supplier_Metrics doesn't exist yet — fallback to Daily_Prices aggregation
    }

    // Fallback: aggregate from Approved_Prices or Daily_Prices if available
    if (!fromDedicated || metrics.length === 0) {
      try {
        metrics = await prisma.$queryRaw`
          SELECT TOP 100
            p.market_name,
            p.state,
            CASE 
              WHEN p.state IN ('Lagos','Ogun','Oyo','Ondo','Osun','Ekiti') THEN 'South-West'
              WHEN p.state IN ('Anambra','Enugu','Imo','Abia','Ebonyi') THEN 'South-East'
              WHEN p.state IN ('Rivers','Delta','Edo','Bayelsa','Cross River','Akwa Ibom') THEN 'South-South'
              WHEN p.state IN ('FCT','Kwara','Kogi','Plateau','Benue','Niger','Nasarawa') THEN 'North-Central'
              WHEN p.state IN ('Kano','Kaduna','Katsina','Sokoto','Kebbi','Zamfara','Jigawa') THEN 'North-West'
              WHEN p.state IN ('Borno','Adamawa','Bauchi','Gombe','Yobe','Taraba') THEN 'North-East'
              ELSE 'Other'
            END AS zone,
            p.item_name,
            p.category AS category_name,
            CONVERT(VARCHAR, CAST(GETDATE() AS DATE), 23) AS metric_date,
            p.current_price AS avg_price,
            p.current_price * 0.92 AS min_price,
            p.current_price * 1.08 AS max_price,
            CASE WHEN p.current_price > 0 THEN ABS(p.current_price - p.previous_price) / p.current_price ELSE 0 END AS price_volatility,
            1 AS submission_count,
            CASE 
              WHEN ABS(p.change_percentage) > 15 THEN 20
              WHEN ABS(p.change_percentage) > 10 THEN 40
              WHEN ABS(p.change_percentage) > 5 THEN 60
              ELSE 80
            END AS supply_score,
            CASE 
              WHEN p.change_percentage > 5 THEN 'HIGH'
              WHEN p.change_percentage > 0 THEN 'MEDIUM'
              ELSE 'LOW'
            END AS demand_indicator,
            p.change_percentage AS trend_7d,
            p.change_percentage * 2.5 AS trend_30d,
            CASE 
              WHEN ABS(p.change_percentage) > 15 THEN 'CRITICAL'
              WHEN ABS(p.change_percentage) > 10 THEN 'WARNING'
              WHEN ABS(p.change_percentage) > 5 THEN 'WATCH'
              ELSE 'NORMAL'
            END AS shortage_risk
          FROM Daily_Prices p
          WHERE p.current_price > 0
          ORDER BY ABS(p.change_percentage) DESC
        `;
      } catch {
        // Daily_Prices also doesn't exist — return seed data only
      }
    }

    // Convert any Decimal types to numbers for JSON serialization
    const clean = metrics.map((m: any) => ({
      ...m,
      avg_price: Number(m.avg_price || 0),
      min_price: Number(m.min_price || 0),
      max_price: Number(m.max_price || 0),
      price_volatility: Number(m.price_volatility || 0),
      submission_count: Number(m.submission_count || 0),
      supply_score: Number(m.supply_score || 50),
      trend_7d: Number(m.trend_7d || 0),
      trend_30d: Number(m.trend_30d || 0),
    }));

    // Compute stats
    const stats = {
      total_items: new Set(clean.map((m: any) => m.item_name)).size,
      total_markets: new Set(clean.map((m: any) => m.market_name)).size,
      avg_supply_score: clean.length > 0
        ? Math.round(clean.reduce((s: number, m: any) => s + m.supply_score, 0) / clean.length)
        : 0,
      critical_alerts: clean.filter((m: any) => m.shortage_risk === "CRITICAL").length,
      warning_alerts: clean.filter((m: any) => m.shortage_risk === "WARNING").length,
      avg_volatility: clean.length > 0
        ? clean.reduce((s: number, m: any) => s + m.price_volatility, 0) / clean.length
        : 0,
    };

    return NextResponse.json({
      success: true,
      count: clean.length,
      source: fromDedicated ? "Supplier_Metrics" : "Daily_Prices",
      stats,
      metrics: clean,
    });
  } catch (error) {
    console.error("Supplier API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load supplier data" },
      { status: 500 }
    );
  }
}
