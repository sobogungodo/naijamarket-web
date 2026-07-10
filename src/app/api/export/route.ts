// src/app/api/export/route.ts
// NaijaMarket Intel - Export API with Robust Error Handling

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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
  if (data.length === 0) {
    return columns.map(c => escapeCSV(c.header)).join(",") + "\nNo data available";
  }
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
// SAFE DATA FETCHING FUNCTIONS
// ============================================================================

async function fetchMarkets() {
  try {
    // Try to get markets - adjust column names as needed
    const markets = await prisma.$queryRaw`
      SELECT * FROM Markets
      ORDER BY market_name
    ` as any[];

    if (markets.length === 0) {
      return {
        data: [],
        columns: [{ key: "message", header: "Message" }],
        filename: "naijamarket_markets",
      };
    }

    // Dynamically get columns from first row
    const firstRow = markets[0];
    const columns = Object.keys(firstRow).map(key => ({
      key,
      header: key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
    }));

    return { data: markets, columns, filename: "naijamarket_markets" };
  } catch (error) {
    console.error("fetchMarkets error:", error);
    throw new Error("Markets table not found or query failed");
  }
}

async function fetchItems() {
  try {
    // Try simple query first
    const items = await prisma.$queryRaw`
      SELECT * FROM Items_Catalog
      ORDER BY item_name
    ` as any[];

    if (items.length === 0) {
      return {
        data: [],
        columns: [{ key: "message", header: "Message" }],
        filename: "naijamarket_items",
      };
    }

    const firstRow = items[0];
    const columns = Object.keys(firstRow).map(key => ({
      key,
      header: key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
    }));

    return { data: items, columns, filename: "naijamarket_items" };
  } catch (error) {
    console.error("fetchItems error:", error);
    throw new Error("Items_Catalog table not found or query failed");
  }
}

async function fetchPrices(dateRange: string) {
  try {
    const now = new Date();
    const daysBack = dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : dateRange === "1y" ? 365 : 30;
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    const prices = await prisma.$queryRaw`
      SELECT * FROM Approved_Prices
      WHERE created_at >= ${startDate}
      ORDER BY created_at DESC
    ` as any[];

    if (prices.length === 0) {
      // Try without date filter
      const allPrices = await prisma.$queryRaw`
        SELECT TOP 1000 * FROM Approved_Prices
        ORDER BY created_at DESC
      ` as any[];
      
      if (allPrices.length === 0) {
        return {
          data: [],
          columns: [{ key: "message", header: "Message" }],
          filename: `naijamarket_prices_${dateRange}`,
        };
      }

      const firstRow = allPrices[0];
      const columns = Object.keys(firstRow).map(key => ({
        key,
        header: key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
      }));

      return { data: allPrices, columns, filename: `naijamarket_prices_${dateRange}` };
    }

    const firstRow = prices[0];
    const columns = Object.keys(firstRow).map(key => ({
      key,
      header: key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
    }));

    return { data: prices, columns, filename: `naijamarket_prices_${dateRange}` };
  } catch (error) {
    console.error("fetchPrices error:", error);
    throw new Error("Approved_Prices table not found or query failed");
  }
}

async function fetchCategories() {
  try {
    const categories = await prisma.$queryRaw`
      SELECT * FROM Categories
      ORDER BY category_name
    ` as any[];

    if (categories.length === 0) {
      return {
        data: [],
        columns: [{ key: "message", header: "Message" }],
        filename: "naijamarket_categories",
      };
    }

    const firstRow = categories[0];
    const columns = Object.keys(firstRow).map(key => ({
      key,
      header: key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
    }));

    return { data: categories, columns, filename: "naijamarket_categories" };
  } catch (error) {
    console.error("fetchCategories error:", error);
    throw new Error("Categories table not found or query failed");
  }
}

async function fetchConsumers() {
  try {
    const consumers = await prisma.$queryRaw`
      SELECT 
        consumer_id, phone_number, display_name, subscription_tier,
        query_count, created_at
      FROM Consumers
      ORDER BY created_at DESC
    ` as any[];

    if (consumers.length === 0) {
      return {
        data: [],
        columns: [{ key: "message", header: "Message" }],
        filename: "naijamarket_consumers",
      };
    }

    const firstRow = consumers[0];
    const columns = Object.keys(firstRow).map(key => ({
      key,
      header: key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
    }));

    return { data: consumers, columns, filename: "naijamarket_consumers" };
  } catch (error) {
    console.error("fetchConsumers error:", error);
    throw new Error("Consumers table not found or query failed");
  }
}

// ============================================================================
// LIST AVAILABLE TABLES (for debugging)
// ============================================================================

async function listTables() {
  try {
    const tables = await prisma.$queryRaw`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    ` as any[];

    return {
      data: tables,
      columns: [{ key: "TABLE_NAME", header: "Table Name" }],
      filename: "naijamarket_tables",
    };
  } catch (error) {
    console.error("listTables error:", error);
    throw new Error("Could not list tables");
  }
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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tier = ((session.user as any).tier || "FREE").toUpperCase();

    // Check access
    if (!hasTierAccess(tier, exportType)) {
      return NextResponse.json(
        { success: false, error: "Insufficient subscription tier for this export" },
        { status: 403 }
      );
    }

    // Validate format
    if (!["CSV", "JSON"].includes(format)) {
      return NextResponse.json(
        { success: false, error: "Invalid format. Use CSV or JSON" },
        { status: 400 }
      );
    }

    // Fetch data based on type
    let result;
    try {
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
        case "categories":
          result = await fetchCategories();
          break;
        case "consumers":
          result = await fetchConsumers();
          break;
        case "tables":
          result = await listTables();
          break;
        default:
          return NextResponse.json(
            { success: false, error: `Invalid export type: ${exportType}. Valid types: markets, items, prices, categories, consumers, tables` },
            { status: 400 }
          );
      }
    } catch (fetchError: any) {
      console.error("Fetch error:", fetchError);
      return NextResponse.json(
        { success: false, error: fetchError.message || "Database query failed" },
        { status: 500 }
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
    } else {
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

  } catch (error: any) {
    console.error("Export API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate export" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Get export preview
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { type } = body;
    const tier = ((session.user as any).tier || "FREE").toUpperCase();

    if (!hasTierAccess(tier || "FREE", type || "markets")) {
      return NextResponse.json(
        { success: false, error: "Insufficient tier", canExport: false },
        { status: 403 }
      );
    }

    // Get row count preview
    let rowCount = 0;
    let tableName = "";

    try {
      switch (type) {
        case "markets":
          tableName = "Markets";
          const markets = await prisma.$queryRaw`SELECT COUNT(*) as count FROM Markets` as any[];
          rowCount = parseInt(markets[0]?.count || "0");
          break;
        case "items":
          tableName = "Items_Catalog";
          const items = await prisma.$queryRaw`SELECT COUNT(*) as count FROM Items_Catalog` as any[];
          rowCount = parseInt(items[0]?.count || "0");
          break;
        case "prices":
          tableName = "Approved_Prices";
          const prices = await prisma.$queryRaw`SELECT COUNT(*) as count FROM Approved_Prices` as any[];
          rowCount = parseInt(prices[0]?.count || "0");
          break;
        case "categories":
          tableName = "Categories";
          const cats = await prisma.$queryRaw`SELECT COUNT(*) as count FROM Categories` as any[];
          rowCount = parseInt(cats[0]?.count || "0");
          break;
        case "consumers":
          tableName = "Consumers";
          const cons = await prisma.$queryRaw`SELECT COUNT(*) as count FROM Consumers` as any[];
          rowCount = parseInt(cons[0]?.count || "0");
          break;
        default:
          rowCount = 0;
      }
    } catch (countError: any) {
      console.error("Count error for", tableName, ":", countError.message);
      return NextResponse.json({
        success: false,
        error: `Table "${tableName}" not found. Run: /api/export?type=tables&format=JSON&tier=CORPORATE to see available tables.`,
        canExport: false,
      });
    }

    // Estimate file size
    const sizeBytes = rowCount * 100;
    const estimatedSize = sizeBytes >= 1024 * 1024 
      ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.floor(sizeBytes / 1024))} KB`;

    return NextResponse.json({
      success: true,
      preview: {
        type,
        tableName,
        rowCount,
        estimatedSize,
        canExport: true,
      },
    });

  } catch (error: any) {
    console.error("Export Preview Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to get preview" },
      { status: 500 }
    );
  }
}
