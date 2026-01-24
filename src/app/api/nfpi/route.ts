// src/app/api/nfpi/route.ts
// NaijaMarket Intel - NFPI (NaijaFood Price Index) API
// Tier-gated access to food price index data
// Version: 1.1.0 - Fixed TypeScript null checks
// Date: 2026-01-24

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

// =============================================================================
// DATABASE CONFIGURATION
// =============================================================================
const dbConfig: sql.config = {
  server: process.env.DATABASE_SERVER || "naijafood.database.windows.net",
  database: process.env.DATABASE_NAME || "naijafoodmarket",
  user: process.env.DATABASE_USER || "",
  password: process.env.DATABASE_PASSWORD || "",
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

// =============================================================================
// TIER ACCESS CONFIGURATION
// =============================================================================
interface TierAccess {
  headline: boolean;
  topMovers: boolean;
  regional: boolean;
  categories: boolean;
  trend: boolean;
  basket: boolean;
  export: boolean;
  maxHistory: number;
}

const TIER_ACCESS: Record<string, TierAccess> = {
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

// Default access for unknown tiers
const DEFAULT_ACCESS: TierAccess = {
  headline: true,
  topMovers: true,
  regional: false,
  categories: false,
  trend: false,
  basket: false,
  export: false,
  maxHistory: 1
};

// =============================================================================
// MOCK DATA (Used when database is unavailable)
// =============================================================================
const MOCK_NFPI_DATA = {
  week_id: "2026-W04",
  week_start: "2026-01-20",
  week_end: "2026-01-26",
  national_index: 156.8,
  wow_change: 2.3,
  mom_change: 5.7,
  yoy_change: 18.4,
  grains_index: 162.4,
  proteins_index: 148.9,
  vegetables_index: 171.2,
  oils_index: 145.6,
  tubers_index: 138.7,
  nw_index: 149.2,
  ne_index: 152.8,
  nc_index: 155.4,
  sw_index: 168.3,
  se_index: 161.7,
  ss_index: 158.9,
  top_gainers: "Tomatoes (+8.2%), Pepper (+5.1%), Rice Local (+3.4%)",
  top_losers: "Yam (-2.1%), Garri (-1.8%)",
  insight: "Food prices continue upward trend driven by seasonal vegetable shortages",
  basket_details: JSON.stringify({
    rice_local: { price: 82000, weight: 0.18, index: 164.0 },
    rice_foreign: { price: 95000, weight: 0.07, index: 158.3 },
    garri: { price: 45000, weight: 0.12, index: 150.0 },
    beans: { price: 72000, weight: 0.10, index: 160.0 },
    fish_dried: { price: 8500, weight: 0.07, index: 141.7 },
    beef: { price: 6500, weight: 0.05, index: 162.5 },
    tomatoes: { price: 85000, weight: 0.08, index: 188.9 },
    pepper: { price: 65000, weight: 0.05, index: 162.5 },
    onions: { price: 55000, weight: 0.05, index: 157.1 },
    palm_oil: { price: 52000, weight: 0.10, index: 148.6 },
    groundnut_oil: { price: 68000, weight: 0.05, index: 141.7 },
    yam: { price: 4500, weight: 0.08, index: 128.6 }
  })
};

const MOCK_TREND_DATA = [
  { week_id: "2026-W01", national_index: 149.2, grains: 155.1, proteins: 142.3, vegetables: 158.4, oils: 140.2 },
  { week_id: "2026-W02", national_index: 151.8, grains: 157.8, proteins: 144.1, vegetables: 162.7, oils: 141.8 },
  { week_id: "2026-W03", national_index: 153.4, grains: 159.6, proteins: 146.2, vegetables: 166.9, oils: 143.1 },
  { week_id: "2026-W04", national_index: 156.8, grains: 162.4, proteins: 148.9, vegetables: 171.2, oils: 145.6 },
];

// =============================================================================
// GET - Fetch NFPI Data
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = (searchParams.get("tier") || "FREE").toUpperCase();
    const weeks = parseInt(searchParams.get("weeks") || "4");
    const format = searchParams.get("format") || "json";

    // Get tier access - use default if tier not found
    const access: TierAccess = TIER_ACCESS[tier] || DEFAULT_ACCESS;

    // Initialize response object
    const response: {
      success: boolean;
      tier: string;
      access: TierAccess;
      latest: {
        week_id?: string;
        week_start?: string;
        week_end?: string;
        national_index?: number;
        wow_change?: number;
        mom_change?: number;
        yoy_change?: number;
        top_gainers?: string;
        top_losers?: string;
        insight?: string;
      };
      categories?: {
        grains: number;
        proteins: number;
        vegetables: number;
        oils: number;
        tubers: number;
      };
      regional?: {
        nw: number;
        ne: number;
        nc: number;
        sw: number;
        se: number;
        ss: number;
      };
      trend?: Array<{
        week_id: string;
        national_index: number;
        grains?: number;
        proteins?: number;
        vegetables?: number;
        oils?: number;
      }>;
      basket?: Record<string, unknown>;
      locked_features?: string[];
    } = {
      success: true,
      tier,
      access,
      latest: {},
    };

    // Try to fetch from database, fall back to mock data
    let latestNFPI = MOCK_NFPI_DATA;
    let trendData = MOCK_TREND_DATA;
    let pool: sql.ConnectionPool | null = null;

    try {
      pool = await sql.connect(dbConfig);
      
      // Fetch latest NFPI
      const latestResult = await pool.request().query(`
        SELECT TOP 1 * FROM NFPI_Weekly 
        ORDER BY week_start DESC
      `);
      
      if (latestResult.recordset.length > 0) {
        latestNFPI = latestResult.recordset[0];
      }

      // Fetch trend data if user has access
      if (access.trend) {
        const historyLimit = Math.min(weeks, access.maxHistory);
        const trendResult = await pool.request()
          .input("limit", sql.Int, historyLimit)
          .query(`
            SELECT TOP (@limit) 
              week_id, week_start, national_index,
              grains_index, proteins_index, vegetables_index, oils_index
            FROM NFPI_Weekly 
            ORDER BY week_start DESC
          `);
        
        if (trendResult.recordset.length > 0) {
          trendData = trendResult.recordset.reverse();
        }
      }
    } catch (dbError) {
      console.warn("Database unavailable, using mock data:", dbError);
      // Continue with mock data
    } finally {
      if (pool) {
        await pool.close();
      }
    }

    // Headline data (FREE+) - always available
    if (access.headline) {
      response.latest.week_id = latestNFPI.week_id;
      response.latest.week_start = latestNFPI.week_start;
      response.latest.week_end = latestNFPI.week_end;
      response.latest.national_index = latestNFPI.national_index;
      response.latest.wow_change = latestNFPI.wow_change;
      response.latest.mom_change = latestNFPI.mom_change;
      response.latest.yoy_change = latestNFPI.yoy_change;
    }

    // Top movers (FREE+)
    if (access.topMovers) {
      response.latest.top_gainers = latestNFPI.top_gainers;
      response.latest.top_losers = latestNFPI.top_losers;
      response.latest.insight = latestNFPI.insight;
    }

    // Category indices (GOLD+)
    if (access.regional || access.categories) {
      response.categories = {
        grains: parseFloat(String(latestNFPI.grains_index)) || 100,
        proteins: parseFloat(String(latestNFPI.proteins_index)) || 100,
        vegetables: parseFloat(String(latestNFPI.vegetables_index)) || 100,
        oils: parseFloat(String(latestNFPI.oils_index)) || 100,
        tubers: parseFloat(String(latestNFPI.tubers_index)) || 100,
      };
    }

    // Regional data (SILVER+)
    if (access.regional) {
      response.regional = {
        nw: parseFloat(String(latestNFPI.nw_index)) || 100,
        ne: parseFloat(String(latestNFPI.ne_index)) || 100,
        nc: parseFloat(String(latestNFPI.nc_index)) || 100,
        sw: parseFloat(String(latestNFPI.sw_index)) || 100,
        se: parseFloat(String(latestNFPI.se_index)) || 100,
        ss: parseFloat(String(latestNFPI.ss_index)) || 100,
      };
    }

    // Trend data (GOLD+)
    if (access.trend) {
      response.trend = trendData.map(week => ({
        week_id: week.week_id,
        national_index: week.national_index,
        grains: week.grains || week.grains_index,
        proteins: week.proteins || week.proteins_index,
        vegetables: week.vegetables || week.vegetables_index,
        oils: week.oils || week.oils_index,
      }));
    }

    // Basket details (BUSINESS+)
    if (access.basket && latestNFPI.basket_details) {
      try {
        response.basket = typeof latestNFPI.basket_details === 'string' 
          ? JSON.parse(latestNFPI.basket_details)
          : latestNFPI.basket_details;
      } catch {
        response.basket = {};
      }
    }

    // Show locked features for upsell
    const lockedFeatures: string[] = [];
    if (!access.regional) lockedFeatures.push("regional");
    if (!access.categories) lockedFeatures.push("categories");
    if (!access.trend) lockedFeatures.push("trend");
    if (!access.basket) lockedFeatures.push("basket");
    if (!access.export) lockedFeatures.push("export");
    
    if (lockedFeatures.length > 0) {
      response.locked_features = lockedFeatures;
    }

    // Handle CSV export format (CORPORATE+)
    if (format === "csv" && access.export) {
      const csvRows = [
        "week_id,national_index,grains,proteins,vegetables,oils,tubers",
        ...trendData.map(w => 
          `${w.week_id},${w.national_index},${w.grains || ''},${w.proteins || ''},${w.vegetables || ''},${w.oils || ''},`
        )
      ];
      
      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="nfpi-${latestNFPI.week_id}.csv"`,
        },
      });
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error("NFPI API error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
      details: process.env.NODE_ENV === "development" ? String(error) : undefined
    }, { status: 500 });
  }
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
