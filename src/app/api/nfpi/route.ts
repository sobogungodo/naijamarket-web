// src/app/api/nfpi/route.ts
// NaijaMarket Intel - NFPI (NaijaFood Price Index) API
// Tier-gated access to food price index data
// Created: 2026-01-18

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Tier access configuration
const TIER_ACCESS: Record<string, {
  headline: boolean;
  topMovers: boolean;
  regional: boolean;
  categories: boolean;
  trend: boolean;
  basket: boolean;
  export: boolean;
  maxHistory: number;
}> = {
  FREE: {
    headline: true,
    topMovers: true,
    regional: false,
    categories: false,
    trend: false,
    basket: false,
    export: false,
    maxHistory: 1
  },
  SILVER: {
    headline: true,
    topMovers: true,
    regional: true,
    categories: false,
    trend: false,
    basket: false,
    export: false,
    maxHistory: 2
  },
  GOLD: {
    headline: true,
    topMovers: true,
    regional: true,
    categories: true,
    trend: true,
    basket: false,
    export: false,
    maxHistory: 4
  },
  BUSINESS: {
    headline: true,
    topMovers: true,
    regional: true,
    categories: true,
    trend: true,
    basket: true,
    export: false,
    maxHistory: 12
  },
  CORPORATE: {
    headline: true,
    topMovers: true,
    regional: true,
    categories: true,
    trend: true,
    basket: true,
    export: true,
    maxHistory: 24
  },
  ENTERPRISE: {
    headline: true,
    topMovers: true,
    regional: true,
    categories: true,
    trend: true,
    basket: true,
    export: true,
    maxHistory: 48
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = (searchParams.get("tier") || "FREE").toUpperCase();
    const format = searchParams.get("format") || "json";
    
    const access = TIER_ACCESS[tier] || TIER_ACCESS.FREE;

    // Get latest NFPI using raw SQL for SQL Server compatibility
    const latest = await prisma.$queryRaw`
      SELECT TOP 1 
        FORMAT(week_id, 'yyyy-MM') as period,
        week_id,
        week_start,
        week_end,
        is_baseline,
        national_index,
        national_change_pct,
        national_change_direction,
        grains_index,
        proteins_index,
        vegetables_index,
        oils_index,
        basket_value_naira,
        baseline_value,
        data_quality_score,
        items_with_data,
        total_submissions,
        top_gainers,
        top_losers,
        insight
      FROM NFPI_Weekly
      ORDER BY week_id DESC
    ` as any[];

    if (!latest || latest.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No NFPI data available"
      }, { status: 404 });
    }

    const latestNFPI = latest[0];

    // Build response based on tier access
    const response: any = {
      success: true,
      tier,
      access_level: access,
      generated_at: new Date().toISOString(),
      latest: {
        period: latestNFPI.period,
        week_id: latestNFPI.week_id,
        national_index: parseFloat(latestNFPI.national_index),
        change_pct: parseFloat(latestNFPI.national_change_pct || 0),
        direction: latestNFPI.national_change_direction,
        is_baseline: latestNFPI.is_baseline,
        items_with_data: latestNFPI.items_with_data
      }
    };

    // Top movers (FREE+)
    if (access.topMovers) {
      response.latest.top_gainers = latestNFPI.top_gainers;
      response.latest.top_losers = latestNFPI.top_losers;
      response.latest.insight = latestNFPI.insight;
    }

    // Category indices (SILVER+)
    if (access.regional || access.categories) {
      response.categories = {
        grains: parseFloat(latestNFPI.grains_index || 100),
        proteins: parseFloat(latestNFPI.proteins_index || 100),
        vegetables: parseFloat(latestNFPI.vegetables_index || 100),
        oils: parseFloat(latestNFPI.oils_index || 100)
      };
    }

    // Trend data (GOLD+)
    if (access.trend) {
      const trend = await prisma.$queryRaw`
        SELECT TOP ${access.maxHistory}
          FORMAT(week_id, 'yyyy-MM') as period,
          week_id,
          national_index,
          national_change_pct,
          national_change_direction,
          grains_index,
          proteins_index,
          vegetables_index,
          oils_index
        FROM NFPI_Weekly
        ORDER BY week_id DESC
      ` as any[];
      
      response.trend = trend.reverse().map((t: any) => ({
        period: t.period,
        national_index: parseFloat(t.national_index),
        change_pct: parseFloat(t.national_change_pct || 0),
        direction: t.national_change_direction,
        grains: parseFloat(t.grains_index || 100),
        proteins: parseFloat(t.proteins_index || 100),
        vegetables: parseFloat(t.vegetables_index || 100),
        oils: parseFloat(t.oils_index || 100)
      }));
    }

    // Basket details (BUSINESS+)
    if (access.basket) {
      const basket = await prisma.$queryRaw`
        SELECT * FROM NFPI_Basket ORDER BY category, item_name
      ` as any[];
      
      const basketPrices = await prisma.$queryRaw`
        SELECT * FROM NFPI_Item_Prices
        WHERE week_id = (SELECT MAX(week_id) FROM NFPI_Weekly)
        ORDER BY category, item_name
      ` as any[];
      
      response.basket = basket.map((b: any) => ({
        item_id: b.item_id,
        item_name: b.item_name,
        category: b.category,
        weight_pct: parseFloat(b.weight_pct),
        baseline_price: parseFloat(b.baseline_price),
        unit: b.unit
      }));
      
      response.basket_prices = basketPrices.map((p: any) => ({
        item_id: p.item_id,
        item_name: p.item_name,
        avg_price: parseFloat(p.avg_price),
        change_pct: parseFloat(p.price_change_pct || 0)
      }));
      
      response.basket_value = parseFloat(latestNFPI.basket_value_naira || 0);
      response.baseline_value = parseFloat(latestNFPI.baseline_value || 0);
    }

    response.can_export = access.export;

    // Handle CSV export (CORPORATE+)
    if (format === "csv" && access.export) {
      const csvRows = ["Period,National_Index,Change_Pct,Direction,Grains,Proteins,Vegetables,Oils"];
      
      if (response.trend) {
        response.trend.forEach((t: any) => {
          csvRows.push(`${t.period},${t.national_index},${t.change_pct},${t.direction},${t.grains},${t.proteins},${t.vegetables},${t.oils}`);
        });
      }
      
      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="NFPI_Report_${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error("NFPI API Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    }, { status: 500 });
  }
}
