// src/app/api/export/route.ts
// NaijaMarket Intel - Export API for CSV/XLSX/JSON Downloads

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================================
// TIER ACCESS CONTROL
// ============================================================================

const TIER_HIERARCHY = ["FREE", "SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"];

const EXPORT_ACCESS: Record<string, string[]> = {
  markets: ["SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"],
  items: ["SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"],
  prices: ["GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"],
  trends: ["BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"],
  regional: ["BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"],
};

function hasTierAccess(userTier: string, exportType: string): boolean {
  const requiredTiers = EXPORT_ACCESS[exportType] || [];
  const userTierIndex = TIER_HIERARCHY.indexOf(userTier.toUpperCase());
  return requiredTiers.some(tier => {
    const requiredIndex = TIER_HIERARCHY.indexOf(tier);
    return userTierIndex >= requiredIndex;
  });
}

// ============================================================================
// CSV GENERATION HELPERS
// ============================================================================

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function arrayToCSV(data: any[], columns: { key: string; header: string }[]): string {
  const headers = columns.map(c => escapeCSV(c.header)).join(",");
  const rows = data.map(row => 
    columns.map(c => escapeCSV(row[c.key])).join(",")
  );
  return [headers, ...rows].join("\n");
}

function arrayToJSON(data: any[]): string {
  return JSON.stringify(data, null, 2);
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

async function fetchMarkets() {
  const markets = await prisma.$queryRaw`
    SELECT 
      market_id,
      market_name,
      market_type,
      address,
      city,
      state,
      region,
      latitude,
      longitude,
      operating_days,
      opening_time,
      closing_time,
      created_at
    FROM Markets
    ORDER BY state, market_name
  ` as any[];

  return {
    data: markets,
    columns: [
      { key: "market_id", header: "Market ID" },
      { key: "market_name", header: "Market Name" },
      { key: "market_type", header: "Type" },
      { key: "address", header: "Address" },
      { key: "city", header: "City" },
      { key: "state", header: "State" },
      { key: "region", header: "Region" },
      { key: "latitude", header: "Latitude" },
      { key: "longitude", header: "Longitude" },
      { key: "operating_days", header: "Operating Days" },
      { key: "opening_time", header: "Opening Time" },
      { key: "closing_time", header: "Closing Time" },
      { key: "created_at", header: "Created At" },
    ],
    filename: "naijamarket_markets",
  };
}

async function fetchItems() {
  const items = await prisma.$queryRaw`
    SELECT 
      i.item_id,
      i.item_name,
      c.category_name,
      i.unit,
      i.description,
      i.baseline_price,
      i.created_at
    FROM Items_Catalog i
    LEFT JOIN Categories c ON i.category_id = c.category_id
    ORDER BY c.category_name, i.item_name
  ` as any[];

  return {
    data: items,
    columns: [
      { key: "item_id", header: "Item ID" },
      { key: "item_name", header: "Item Name" },
      { key: "category_name", header: "Category" },
      { key: "unit", header: "Unit" },
      { key: "description", header: "Description" },
      { key: "baseline_price", header: "Baseline Price (₦)" },
      { key: "created_at", header: "Created At" },
    ],
    filename: "naijamarket_items",
  };
}

async function fetchPrices(dateRange: string) {
  const now = new Date();
  const daysBack = dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : dateRange === "1y" ? 365 : 30;
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const prices = await prisma.$queryRaw`
    SELECT 
      price_id,
      item_name,
      market_name,
      price,
      unit,
      price_trend,
      price_change_percent,
      validation_status,
      validated_at,
      created_at
    FROM Approved_Prices
    WHERE created_at >= ${startDate}
    ORDER BY created_at DESC
  ` as any[];

  return {
    data: prices.map((p: any) => ({
      ...p,
      price: parseFloat(p.price) || 0,
      price_change_percent: parseFloat(p.price_change_percent) || 0,
      validated_at: p.validated_at ? new Date(p.validated_at).toISOString() : "",
      created_at: p.created_at ? new Date(p.created_at).toISOString() : "",
    })),
    columns: [
      { key: "price_id", header: "Price ID" },
      { key: "item_name", header: "Item" },
      { key: "market_name", header: "Market" },
      { key: "price", header: "Price (₦)" },
      { key: "unit", header: "Unit" },
      { key: "price_trend", header: "Trend" },
      { key: "price_change_percent", header: "Change %" },
      { key: "validation_status", header: "Status" },
      { key: "validated_at", header: "Validated At" },
      { key: "created_at", header: "Created At" },
    ],
    filename: `naijamarket_prices_${dateRange}`,
  };
}

async function fetchTrends(dateRange: string) {
  const now = new Date();
  const daysBack = dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : dateRange === "1y" ? 365 : 30;
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const trends = await prisma.$queryRaw`
    SELECT 
      item_name,
      market_name,
      CAST(created_at AS DATE) as price_date,
      AVG(CAST(price AS FLOAT)) as avg_price,
      MIN(CAST(price AS FLOAT)) as min_price,
      MAX(CAST(price AS FLOAT)) as max_price,
      COUNT(*) as sample_count
    FROM Approved_Prices
    WHERE created_at >= ${startDate}
    GROUP BY item_name, market_name, CAST(created_at AS DATE)
    ORDER BY item_name, market_name, price_date
  ` as any[];

  return {
    data: trends.map((t: any) => ({
      item_name: t.item_name,
      market_name: t.market_name,
      price_date: new Date(t.price_date).toISOString().slice(0, 10),
      avg_price: parseFloat(t.avg_price).toFixed(2),
      min_price: parseFloat(t.min_price).toFixed(2),
      max_price: parseFloat(t.max_price).toFixed(2),
      sample_count: parseInt(t.sample_count),
    })),
    columns: [
      { key: "item_name", header: "Item" },
      { key: "market_name", header: "Market" },
      { key: "price_date", header: "Date" },
      { key: "avg_price", header: "Avg Price (₦)" },
      { key: "min_price", header: "Min Price (₦)" },
      { key: "max_price", header: "Max Price (₦)" },
      { key: "sample_count", header: "Samples" },
    ],
    filename: `naijamarket_trends_${dateRange}`,
  };
}

async function fetchRegional(dateRange: string) {
  const now = new Date();
  const daysBack = dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : dateRange === "1y" ? 365 : 30;
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const regional = await prisma.$queryRaw`
    SELECT 
      m.state,
      m.region,
      c.category_name,
      COUNT(DISTINCT m.market_id) as market_count,
      COUNT(p.price_id) as price_count,
      AVG(CAST(p.price AS FLOAT)) as avg_price,
      MIN(CAST(p.price AS FLOAT)) as min_price,
      MAX(CAST(p.price AS FLOAT)) as max_price
    FROM Markets m
    LEFT JOIN Approved_Prices p ON m.market_name = p.market_name
    LEFT JOIN Items_Catalog i ON p.item_name = i.item_name
    LEFT JOIN Categories c ON i.category_id = c.category_id
    WHERE p.created_at >= ${startDate} OR p.created_at IS NULL
    GROUP BY m.state, m.region, c.category_name
    ORDER BY m.state, c.category_name
  ` as any[];

  return {
    data: regional.map((r: any) => ({
      state: r.state || "Unknown",
      region: r.region || "Unknown",
      category: r.category_name || "All",
      market_count: parseInt(r.market_count) || 0,
      price_count: parseInt(r.price_count) || 0,
      avg_price: r.avg_price ? parseFloat(r.avg_price).toFixed(2) : "N/A",
      min_price: r.min_price ? parseFloat(r.min_price).toFixed(2) : "N/A",
      max_price: r.max_price ? parseFloat(r.max_price).toFixed(2) : "N/A",
    })),
    columns: [
      { key: "state", header: "State" },
      { key: "region", header: "Region" },
      { key: "category", header: "Category" },
      { key: "market_count", header: "Markets" },
      { key: "price_count", header: "Price Count" },
      { key: "avg_price", header: "Avg Price (₦)" },
      { key: "min_price", header: "Min Price (₦)" },
      { key: "max_price", header: "Max Price (₦)" },
    ],
    filename: `naijamarket_regional_${dateRange}`,
  };
}

// ============================================================================
// MAIN EXPORT HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get("type") || "markets";
    const format = (searchParams.get("format") || "CSV").toUpperCase();
    const dateRange = searchParams.get("range") || "30d";
    const tier = (searchParams.get("tier") || "FREE").toUpperCase();

    // Check access
    if (!hasTierAccess(tier, exportType)) {
      return NextResponse.json(
        { success: false, error: "Insufficient subscription tier for this export" },
        { status: 403 }
      );
    }

    // Validate format
    if (!["CSV", "JSON", "XLSX"].includes(format)) {
      return NextResponse.json(
        { success: false, error: "Invalid format. Use CSV, JSON, or XLSX" },
        { status: 400 }
      );
    }

    // Fetch data based on type
    let result;
    switch (exportType) {
      case "markets":
        result = await fetchMarkets();
        break;
      case "items":
        result = await fetchItems();
        break;
      case "prices":
        result = await fetchPrices(dateRange);
        break;
      case "trends":
        result = await fetchTrends(dateRange);
        break;
      case "regional":
        result = await fetchRegional(dateRange);
        break;
      default:
        return NextResponse.json(
          { success: false, error: "Invalid export type" },
          { status: 400 }
        );
    }

    // Generate file content
    let content: string;
    let contentType: string;
    let fileExtension: string;

    if (format === "JSON") {
      content = arrayToJSON(result.data);
      contentType = "application/json";
      fileExtension = "json";
    } else if (format === "CSV") {
      content = arrayToCSV(result.data, result.columns);
      contentType = "text/csv";
      fileExtension = "csv";
    } else {
      // XLSX - return CSV for now (XLSX requires external library)
      // In production, use 'xlsx' or 'exceljs' library
      content = arrayToCSV(result.data, result.columns);
      contentType = "text/csv";
      fileExtension = "csv";
    }

    const filename = `${result.filename}_${new Date().toISOString().slice(0, 10)}.${fileExtension}`;

    // Return file download
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Rows-Exported": String(result.data.length),
      },
    });

  } catch (error) {
    console.error("Export API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate export" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Get export preview (returns JSON with row count)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, range, tier } = body;

    if (!hasTierAccess(tier || "FREE", type || "markets")) {
      return NextResponse.json(
        { success: false, error: "Insufficient tier", canExport: false },
        { status: 403 }
      );
    }

    // Get row count preview
    let rowCount = 0;
    let estimatedSize = "0 KB";

    switch (type) {
      case "markets":
        const markets = await prisma.$queryRaw`SELECT COUNT(*) as count FROM Markets` as any[];
        rowCount = parseInt(markets[0]?.count || "0");
        break;
      case "items":
        const items = await prisma.$queryRaw`SELECT COUNT(*) as count FROM Items_Catalog` as any[];
        rowCount = parseInt(items[0]?.count || "0");
        break;
      case "prices":
        const prices = await prisma.$queryRaw`SELECT COUNT(*) as count FROM Approved_Prices` as any[];
        rowCount = parseInt(prices[0]?.count || "0");
        break;
      default:
        rowCount = 0;
    }

    // Estimate file size (rough estimate: ~100 bytes per row for CSV)
    const sizeBytes = rowCount * 100;
    if (sizeBytes >= 1024 * 1024) {
      estimatedSize = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      estimatedSize = `${(sizeBytes / 1024).toFixed(0)} KB`;
    }

    return NextResponse.json({
      success: true,
      preview: {
        type,
        rowCount,
        estimatedSize,
        canExport: true,
      },
    });

  } catch (error) {
    console.error("Export Preview Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get preview" },
      { status: 500 }
    );
  }
}
