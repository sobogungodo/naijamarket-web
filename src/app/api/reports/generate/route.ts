// ============================================================================
// src/app/api/reports/generate/route.ts
// NaijaMarket Intel - Report Generation Engine
// Version: 1.0.0 - Generates actual PDF, Excel, and HTML reports
// 
// DEPENDENCIES (install first):
//   npm install pdfkit exceljs @types/pdfkit --save
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// TIER ACCESS
// ============================================================================

const TIER_HIERARCHY = [
  "FREE", "SILVER", "GOLD", "BUSINESS", "BUSINESS_PLUS",
  "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT",
];

const REPORT_MIN_TIERS: Record<string, string> = {
  daily_market_summary: "BUSINESS",
  weekly_trend_analysis: "BUSINESS",
  market_comparison: "BUSINESS",
  arbitrage_opportunities: "CORPORATE",
  inflation_impact: "CORPORATE",
  supply_chain_intelligence: "ENTERPRISE",
  custom_analytics: "ENTERPRISE",
};

// ============================================================================
// USER TIER LOOKUP (same strategy as reports/route.ts)
// ============================================================================

async function getUserTier(session: any): Promise<string> {
  if (!session?.user) return "FREE";
  const { email, name, phone } = session.user as any;

  try {
    // Strategy 1: email
    if (email) {
      const u = await prisma.consumers.findFirst({
        where: { email },
        select: { subscription_tier: true },
      });
      if (u?.subscription_tier) return u.subscription_tier.toUpperCase();
    }
    // Strategy 2: phone
    if (phone) {
      const u = await prisma.consumers.findFirst({
        where: { phone_number: phone },
        select: { subscription_tier: true },
      });
      if (u?.subscription_tier) return u.subscription_tier.toUpperCase();
    }
    // Strategy 3: phone suffix from name "User 5952"
    if (name && name.startsWith("User ")) {
      const suffix = name.replace("User ", "");
      if (/^\d{4,}$/.test(suffix)) {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT TOP 1 subscription_tier FROM Consumers WHERE phone_number LIKE '%${suffix}' ORDER BY created_at DESC`
        );
        if (rows?.[0]?.subscription_tier) return rows[0].subscription_tier.toUpperCase();
      }
    }
    // Strategy 4: full_name
    if (name && !name.startsWith("User ")) {
      const u = await prisma.consumers.findFirst({
        where: { full_name: name },
        select: { subscription_tier: true },
      });
      if (u?.subscription_tier) return u.subscription_tier.toUpperCase();
    }
    return "FREE";
  } catch {
    return "FREE";
  }
}

function hasAccess(userTier: string, requiredTier: string): boolean {
  return TIER_HIERARCHY.indexOf(userTier) >= TIER_HIERARCHY.indexOf(requiredTier);
}

// ============================================================================
// DATA FETCHING - Query Daily_Prices from Azure SQL
// ============================================================================

interface PriceRow {
  item_name: string;
  market_name: string;
  state: string;
  category_id: string;
  unit: string;
  price_naira: number;
  previous_price: number;
  price_change_pct: number;
  trend: string;
  price_date: string;
  data_source: string;
}

async function fetchReportData(reportType: string, params?: any): Promise<any> {
  try {
    // Fetch latest prices (most recent date with data)
    const latestPrices: PriceRow[] = await prisma.$queryRawUnsafe(`
      SELECT TOP 500
        item_name, market_name, state, 
        COALESCE(category_id, 'Uncategorized') AS category_id,
        unit, price_naira, previous_price, 
        COALESCE(price_change_pct, 0) AS price_change_pct,
        COALESCE(trend, 'stable') AS trend,
        CAST(price_date AS VARCHAR) AS price_date,
        COALESCE(data_source, 'NaijaMarket') AS data_source
      FROM Daily_Prices
      WHERE price_date = (SELECT MAX(price_date) FROM Daily_Prices)
      ORDER BY item_name, market_name
    `);

    // If no data for today, try last 7 days
    let prices = latestPrices;
    if (prices.length === 0) {
      prices = await prisma.$queryRawUnsafe(`
        SELECT TOP 500
          item_name, market_name, state,
          COALESCE(category_id, 'Uncategorized') AS category_id,
          unit, price_naira, previous_price,
          COALESCE(price_change_pct, 0) AS price_change_pct,
          COALESCE(trend, 'stable') AS trend,
          CAST(price_date AS VARCHAR) AS price_date,
          COALESCE(data_source, 'NaijaMarket') AS data_source
        FROM Daily_Prices
        WHERE price_date >= DATEADD(day, -7, GETDATE())
        ORDER BY price_date DESC, item_name, market_name
      `);
    }

    // If still no data, try Validated_Prices as fallback
    if (prices.length === 0) {
      try {
        prices = await prisma.$queryRawUnsafe(`
          SELECT TOP 500
            item_name, market_name, state,
            'Food' AS category_id,
            unit, price_naira, 
            COALESCE(previous_price, price_naira) AS previous_price,
            COALESCE(price_change_pct, 0) AS price_change_pct,
            COALESCE(trend, 'stable') AS trend,
            CAST(COALESCE(validated_at, GETDATE()) AS VARCHAR) AS price_date,
            'Validated' AS data_source
          FROM Validated_Prices
          ORDER BY validated_at DESC
        `);
      } catch {
        // Validated_Prices table may not exist
      }
    }

    if (prices.length === 0) {
      return { prices: [], summary: getEmptySummary(), isEmpty: true };
    }

    // Compute summary metrics
    const summary = computeSummary(prices);
    const topGainers = getTopMovers(prices, "up", 10);
    const topLosers = getTopMovers(prices, "down", 10);
    const categoryBreakdown = getCategoryBreakdown(prices);
    const regionalData = getRegionalBreakdown(prices);
    const marketComparison = getMarketComparison(prices);

    return {
      prices,
      summary,
      topGainers,
      topLosers,
      categoryBreakdown,
      regionalData,
      marketComparison,
      dataDate: prices[0]?.price_date || new Date().toISOString().split("T")[0],
      recordCount: prices.length,
      isEmpty: false,
    };
  } catch (error: any) {
    console.error("[Reports Generate] DB error:", error.message);
    return { prices: [], summary: getEmptySummary(), isEmpty: true, error: error.message };
  }
}

// ============================================================================
// DATA PROCESSING HELPERS
// ============================================================================

function getEmptySummary() {
  return {
    totalItems: 0,
    totalMarkets: 0,
    totalStates: 0,
    avgChange: 0,
    priceIncreases: 0,
    priceDecreases: 0,
    unchanged: 0,
  };
}

function computeSummary(prices: PriceRow[]) {
  const items = new Set(prices.map(p => p.item_name));
  const markets = new Set(prices.map(p => p.market_name));
  const states = new Set(prices.map(p => p.state));

  const changes = prices.map(p => Number(p.price_change_pct) || 0);
  const avgChange = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;

  return {
    totalItems: items.size,
    totalMarkets: markets.size,
    totalStates: states.size,
    avgChange: Math.round(avgChange * 100) / 100,
    priceIncreases: prices.filter(p => (Number(p.price_change_pct) || 0) > 0).length,
    priceDecreases: prices.filter(p => (Number(p.price_change_pct) || 0) < 0).length,
    unchanged: prices.filter(p => (Number(p.price_change_pct) || 0) === 0).length,
  };
}

function getTopMovers(prices: PriceRow[], direction: "up" | "down", limit: number) {
  const sorted = [...prices]
    .filter(p => {
      const change = Number(p.price_change_pct) || 0;
      return direction === "up" ? change > 0 : change < 0;
    })
    .sort((a, b) => {
      const aChange = Math.abs(Number(a.price_change_pct) || 0);
      const bChange = Math.abs(Number(b.price_change_pct) || 0);
      return bChange - aChange;
    })
    .slice(0, limit);

  return sorted.map((p, idx) => ({
    rank: idx + 1,
    item: p.item_name,
    market: p.market_name,
    state: p.state,
    price: Number(p.price_naira),
    previousPrice: Number(p.previous_price),
    changePercent: Number(p.price_change_pct),
    changeAmount: Number(p.price_naira) - Number(p.previous_price),
    unit: p.unit,
  }));
}

function getCategoryBreakdown(prices: PriceRow[]) {
  const categories: Record<string, { prices: number[]; changes: number[]; items: Set<string> }> = {};
  for (const p of prices) {
    const cat = p.category_id || "Uncategorized";
    if (!categories[cat]) categories[cat] = { prices: [], changes: [], items: new Set() };
    categories[cat].prices.push(Number(p.price_naira));
    categories[cat].changes.push(Number(p.price_change_pct) || 0);
    categories[cat].items.add(p.item_name);
  }

  return Object.entries(categories).map(([category, data]) => ({
    category,
    avgPrice: Math.round((data.prices.reduce((a, b) => a + b, 0) / data.prices.length) * 100) / 100,
    avgChange: Math.round((data.changes.reduce((a, b) => a + b, 0) / data.changes.length) * 100) / 100,
    itemCount: data.items.size,
    trend: (data.changes.reduce((a, b) => a + b, 0) / data.changes.length) > 0.5
      ? "up" as const
      : (data.changes.reduce((a, b) => a + b, 0) / data.changes.length) < -0.5
        ? "down" as const
        : "stable" as const,
  }));
}

function getRegionalBreakdown(prices: PriceRow[]) {
  const regions: Record<string, { states: Set<string>; changes: number[]; markets: Set<string>; topItem: string; topPrice: number }> = {};

  // Map Nigerian states to geopolitical zones
  const stateToZone: Record<string, string> = {
    Lagos: "South-West", Ogun: "South-West", Oyo: "South-West", Osun: "South-West", Ondo: "South-West", Ekiti: "South-West",
    Anambra: "South-East", Enugu: "South-East", Imo: "South-East", Abia: "South-East", Ebonyi: "South-East",
    Rivers: "South-South", Delta: "South-South", Bayelsa: "South-South", "Akwa Ibom": "South-South", "Cross River": "South-South", Edo: "South-South",
    Kano: "North-West", Kaduna: "North-West", Sokoto: "North-West", Kebbi: "North-West", Zamfara: "North-West", Katsina: "North-West", Jigawa: "North-West",
    Borno: "North-East", Bauchi: "North-East", Adamawa: "North-East", Yobe: "North-East", Gombe: "North-East", Taraba: "North-East",
    Plateau: "North-Central", Niger: "North-Central", Benue: "North-Central", Kwara: "North-Central", Kogi: "North-Central", Nassarawa: "North-Central", FCT: "North-Central",
  };

  for (const p of prices) {
    const zone = stateToZone[p.state] || "Other";
    if (!regions[zone]) regions[zone] = { states: new Set(), changes: [], markets: new Set(), topItem: "", topPrice: 0 };
    regions[zone].states.add(p.state);
    regions[zone].changes.push(Number(p.price_change_pct) || 0);
    regions[zone].markets.add(p.market_name);
    if (Number(p.price_naira) > regions[zone].topPrice) {
      regions[zone].topPrice = Number(p.price_naira);
      regions[zone].topItem = p.item_name;
    }
  }

  return Object.entries(regions).map(([region, data]) => ({
    region,
    states: Array.from(data.states),
    avgInflation: Math.round((data.changes.reduce((a, b) => a + b, 0) / data.changes.length) * 100) / 100,
    marketCount: data.markets.size,
    topItem: data.topItem,
  }));
}

function getMarketComparison(prices: PriceRow[]) {
  const marketData: Record<string, { items: Record<string, number>; state: string }> = {};
  for (const p of prices) {
    if (!marketData[p.market_name]) marketData[p.market_name] = { items: {}, state: p.state };
    marketData[p.market_name].items[p.item_name] = Number(p.price_naira);
  }

  return Object.entries(marketData).map(([market, data]) => ({
    market,
    state: data.state,
    itemCount: Object.keys(data.items).length,
    avgPrice: Math.round(
      (Object.values(data.items).reduce((a, b) => a + b, 0) / Object.values(data.items).length) * 100
    ) / 100,
    items: data.items,
  }));
}

// ============================================================================
// PDF GENERATION (using pdfkit)
// ============================================================================

async function generatePDF(reportType: string, reportName: string, data: any): Promise<Buffer> {
  // Dynamic import to avoid build issues if not installed
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: reportName,
        Author: "NaijaMarket Intel",
        Subject: "Market Intelligence Report",
        Creator: "NaijaMarket Intel Platform",
      },
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const green = "#16a34a";
    const red = "#dc2626";
    const gray = "#6b7280";
    const dark = "#111827";

    // ---- COVER / HEADER ----
    doc.rect(0, 0, doc.page.width, 120).fill("#0a0a0a");
    doc.fontSize(28).fillColor("#ffffff").text("NaijaMarket Intel", 50, 35, { align: "left" });
    doc.fontSize(14).fillColor(green).text(reportName, 50, 70, { align: "left" });
    doc.fontSize(10).fillColor("#9ca3af").text(
      `Generated: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
      50, 92, { align: "left" }
    );

    doc.moveDown(4);

    // ---- EXECUTIVE SUMMARY ----
    const summary = data.summary;
    doc.fontSize(16).fillColor(dark).text("Executive Summary", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(gray);

    if (data.isEmpty) {
      doc.text("No price data available for the selected period. Please ensure the data pipeline is running.");
      doc.end();
      return;
    }

    doc.text(`Total Commodities Tracked: ${summary.totalItems}`);
    doc.text(`Markets Covered: ${summary.totalMarkets}`);
    doc.text(`States Represented: ${summary.totalStates}`);
    doc.text(`Average Price Change: ${summary.avgChange >= 0 ? "+" : ""}${summary.avgChange}%`);
    doc.text(`Price Increases: ${summary.priceIncreases} | Decreases: ${summary.priceDecreases} | Unchanged: ${summary.unchanged}`);
    doc.text(`Data Date: ${data.dataDate}`);
    doc.text(`Total Records: ${data.recordCount}`);

    doc.moveDown(1.5);

    // ---- TOP GAINERS ----
    if (data.topGainers && data.topGainers.length > 0) {
      doc.fontSize(14).fillColor(dark).text("Top Gainers (Price Increases)", { underline: true });
      doc.moveDown(0.5);

      // Table header
      const tableTop = doc.y;
      doc.fontSize(8).fillColor(gray);
      doc.text("#", 50, tableTop, { width: 20 });
      doc.text("Item", 70, tableTop, { width: 100 });
      doc.text("Market", 170, tableTop, { width: 120 });
      doc.text("Price (₦)", 290, tableTop, { width: 80, align: "right" });
      doc.text("Change", 370, tableTop, { width: 70, align: "right" });
      doc.text("% Change", 440, tableTop, { width: 70, align: "right" });

      doc.moveTo(50, tableTop + 12).lineTo(510, tableTop + 12).strokeColor("#d1d5db").stroke();

      let y = tableTop + 18;
      for (const item of data.topGainers.slice(0, 10)) {
        if (y > 720) { doc.addPage(); y = 50; }
        doc.fontSize(8).fillColor(dark);
        doc.text(String(item.rank), 50, y, { width: 20 });
        doc.text(item.item, 70, y, { width: 100 });
        doc.text(`${item.market} (${item.state})`, 170, y, { width: 120 });
        doc.text(`₦${Number(item.price).toLocaleString()}`, 290, y, { width: 80, align: "right" });
        doc.fillColor(green).text(`+₦${Math.abs(item.changeAmount).toLocaleString()}`, 370, y, { width: 70, align: "right" });
        doc.text(`+${item.changePercent.toFixed(1)}%`, 440, y, { width: 70, align: "right" });
        doc.fillColor(dark);
        y += 14;
      }
      doc.y = y + 10;
      doc.moveDown(1);
    }

    // ---- TOP LOSERS ----
    if (data.topLosers && data.topLosers.length > 0) {
      if (doc.y > 600) doc.addPage();
      doc.fontSize(14).fillColor(dark).text("Top Losers (Price Decreases)", { underline: true });
      doc.moveDown(0.5);

      const tableTop2 = doc.y;
      doc.fontSize(8).fillColor(gray);
      doc.text("#", 50, tableTop2, { width: 20 });
      doc.text("Item", 70, tableTop2, { width: 100 });
      doc.text("Market", 170, tableTop2, { width: 120 });
      doc.text("Price (₦)", 290, tableTop2, { width: 80, align: "right" });
      doc.text("Change", 370, tableTop2, { width: 70, align: "right" });
      doc.text("% Change", 440, tableTop2, { width: 70, align: "right" });

      doc.moveTo(50, tableTop2 + 12).lineTo(510, tableTop2 + 12).strokeColor("#d1d5db").stroke();

      let y2 = tableTop2 + 18;
      for (const item of data.topLosers.slice(0, 10)) {
        if (y2 > 720) { doc.addPage(); y2 = 50; }
        doc.fontSize(8).fillColor(dark);
        doc.text(String(item.rank), 50, y2, { width: 20 });
        doc.text(item.item, 70, y2, { width: 100 });
        doc.text(`${item.market} (${item.state})`, 170, y2, { width: 120 });
        doc.text(`₦${Number(item.price).toLocaleString()}`, 290, y2, { width: 80, align: "right" });
        doc.fillColor(red).text(`-₦${Math.abs(item.changeAmount).toLocaleString()}`, 370, y2, { width: 70, align: "right" });
        doc.text(`${item.changePercent.toFixed(1)}%`, 440, y2, { width: 70, align: "right" });
        doc.fillColor(dark);
        y2 += 14;
      }
      doc.y = y2 + 10;
      doc.moveDown(1);
    }

    // ---- CATEGORY BREAKDOWN ----
    if (data.categoryBreakdown && data.categoryBreakdown.length > 0) {
      if (doc.y > 600) doc.addPage();
      doc.fontSize(14).fillColor(dark).text("Category Breakdown", { underline: true });
      doc.moveDown(0.5);

      for (const cat of data.categoryBreakdown) {
        const trendColor = cat.trend === "up" ? green : cat.trend === "down" ? red : gray;
        doc.fontSize(10).fillColor(dark).text(`${cat.category}`, { continued: true });
        doc.fillColor(gray).text(` — ${cat.itemCount} items, Avg ₦${cat.avgPrice.toLocaleString()}, `, { continued: true });
        doc.fillColor(trendColor).text(`${cat.avgChange >= 0 ? "+" : ""}${cat.avgChange}%`);
        doc.moveDown(0.3);
      }
      doc.moveDown(1);
    }

    // ---- REGIONAL BREAKDOWN ----
    if (data.regionalData && data.regionalData.length > 0) {
      if (doc.y > 600) doc.addPage();
      doc.fontSize(14).fillColor(dark).text("Regional Analysis (Geopolitical Zones)", { underline: true });
      doc.moveDown(0.5);

      for (const region of data.regionalData) {
        const trendColor = region.avgInflation > 0 ? red : region.avgInflation < 0 ? green : gray;
        doc.fontSize(10).fillColor(dark).text(`${region.region}`, { continued: true });
        doc.fillColor(gray).text(` — ${region.marketCount} markets, ${region.states.length} states, `, { continued: true });
        doc.fillColor(trendColor).text(`Avg inflation: ${region.avgInflation >= 0 ? "+" : ""}${region.avgInflation}%`);
        doc.fontSize(8).fillColor(gray).text(`  States: ${region.states.join(", ")} | Most expensive: ${region.topItem}`);
        doc.moveDown(0.4);
      }
      doc.moveDown(1);
    }

    // ---- MARKET COMPARISON (for market_comparison report) ----
    if (reportType === "market_comparison" && data.marketComparison && data.marketComparison.length > 0) {
      if (doc.y > 500) doc.addPage();
      doc.fontSize(14).fillColor(dark).text("Market Price Comparison", { underline: true });
      doc.moveDown(0.5);

      for (const market of data.marketComparison.slice(0, 15)) {
        doc.fontSize(10).fillColor(dark).text(`${market.market} (${market.state})`, { continued: true });
        doc.fillColor(gray).text(` — ${market.itemCount} items tracked, Avg price: ₦${market.avgPrice.toLocaleString()}`);
        doc.moveDown(0.2);
      }
      doc.moveDown(1);
    }

    // ---- FULL PRICE TABLE (for daily_market_summary) ----
    if (reportType === "daily_market_summary" && data.prices.length > 0) {
      doc.addPage();
      doc.fontSize(14).fillColor(dark).text("Complete Price Table", { underline: true });
      doc.moveDown(0.5);

      let yTable = doc.y;
      // Header
      doc.fontSize(7).fillColor(gray);
      doc.text("Item", 50, yTable, { width: 80 });
      doc.text("Market", 130, yTable, { width: 90 });
      doc.text("State", 220, yTable, { width: 60 });
      doc.text("Unit", 280, yTable, { width: 50 });
      doc.text("Price (₦)", 330, yTable, { width: 60, align: "right" });
      doc.text("Prev (₦)", 390, yTable, { width: 60, align: "right" });
      doc.text("Change %", 450, yTable, { width: 60, align: "right" });
      doc.moveTo(50, yTable + 10).lineTo(510, yTable + 10).strokeColor("#d1d5db").stroke();

      yTable += 14;
      for (const p of data.prices.slice(0, 100)) {
        if (yTable > 750) { doc.addPage(); yTable = 50; }
        const change = Number(p.price_change_pct) || 0;
        const changeColor = change > 0 ? green : change < 0 ? red : gray;

        doc.fontSize(7).fillColor(dark);
        doc.text(p.item_name, 50, yTable, { width: 80 });
        doc.text(p.market_name, 130, yTable, { width: 90 });
        doc.text(p.state, 220, yTable, { width: 60 });
        doc.text(p.unit || "-", 280, yTable, { width: 50 });
        doc.text(`₦${Number(p.price_naira).toLocaleString()}`, 330, yTable, { width: 60, align: "right" });
        doc.text(`₦${Number(p.previous_price).toLocaleString()}`, 390, yTable, { width: 60, align: "right" });
        doc.fillColor(changeColor).text(`${change >= 0 ? "+" : ""}${change.toFixed(1)}%`, 450, yTable, { width: 60, align: "right" });
        yTable += 12;
      }
    }

    // ---- FOOTER ----
    doc.addPage();
    doc.fontSize(12).fillColor(dark).text("Disclaimer", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor(gray).text(
      "This report is generated by NaijaMarket Intel based on crowdsourced and validated commodity price data " +
      "from markets across Nigeria. While we strive for accuracy through GPS verification, community validation, " +
      "and fraud detection, prices may vary. This report should not be used as the sole basis for financial decisions. " +
      "NaijaMarket Intel is a product of Giggababytes Oy."
    );
    doc.moveDown(1);
    doc.fontSize(10).fillColor(green).text("www.naijamarket.com | support@naijamarket.ng");
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor(gray).text(`Report ID: RPT-${Date.now()} | © ${new Date().getFullYear()} NaijaMarket Intel`);

    doc.end();
  });
}

// ============================================================================
// EXCEL GENERATION (using exceljs)
// ============================================================================

async function generateExcel(reportType: string, reportName: string, data: any): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NaijaMarket Intel";
  workbook.created = new Date();

  const green6 = "FF16A34A";
  const red6 = "FFDC2626";
  const headerFill: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A0A0A" } };
  const headerFont: any = { color: { argb: "FFFFFFFF" }, bold: true, size: 10 };
  const greenFont: any = { color: { argb: green6 }, bold: true };
  const redFont: any = { color: { argb: red6 }, bold: true };

  // ---- Summary Sheet ----
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 30 },
    { header: "Value", key: "value", width: 25 },
  ];
  summarySheet.getRow(1).eachCell(cell => { cell.fill = headerFill; cell.font = headerFont; });

  const s = data.summary;
  const summaryRows = [
    { metric: "Report", value: reportName },
    { metric: "Generated", value: new Date().toLocaleString("en-GB") },
    { metric: "Data Date", value: data.dataDate || "N/A" },
    { metric: "Total Commodities", value: s.totalItems },
    { metric: "Total Markets", value: s.totalMarkets },
    { metric: "Total States", value: s.totalStates },
    { metric: "Average Price Change (%)", value: s.avgChange },
    { metric: "Price Increases", value: s.priceIncreases },
    { metric: "Price Decreases", value: s.priceDecreases },
    { metric: "Unchanged", value: s.unchanged },
    { metric: "Total Records", value: data.recordCount },
  ];
  summaryRows.forEach(row => summarySheet.addRow(row));

  // ---- Prices Sheet ----
  if (data.prices.length > 0) {
    const pricesSheet = workbook.addWorksheet("All Prices");
    pricesSheet.columns = [
      { header: "Item", key: "item", width: 20 },
      { header: "Market", key: "market", width: 25 },
      { header: "State", key: "state", width: 15 },
      { header: "Category", key: "category", width: 15 },
      { header: "Unit", key: "unit", width: 12 },
      { header: "Price (₦)", key: "price", width: 15 },
      { header: "Previous (₦)", key: "previous", width: 15 },
      { header: "Change (%)", key: "change", width: 12 },
      { header: "Trend", key: "trend", width: 10 },
      { header: "Date", key: "date", width: 15 },
    ];
    pricesSheet.getRow(1).eachCell(cell => { cell.fill = headerFill; cell.font = headerFont; });

    for (const p of data.prices) {
      const change = Number(p.price_change_pct) || 0;
      const row = pricesSheet.addRow({
        item: p.item_name,
        market: p.market_name,
        state: p.state,
        category: p.category_id,
        unit: p.unit || "-",
        price: Number(p.price_naira),
        previous: Number(p.previous_price),
        change: change,
        trend: p.trend || "stable",
        date: p.price_date,
      });

      // Color the change column
      const changeCell = row.getCell("change");
      if (change > 0) changeCell.font = greenFont;
      else if (change < 0) changeCell.font = redFont;
    }

    // Number format for price columns
    pricesSheet.getColumn("price").numFmt = "#,##0.00";
    pricesSheet.getColumn("previous").numFmt = "#,##0.00";
    pricesSheet.getColumn("change").numFmt = "+0.0%;-0.0%;0.0%";

    // AutoFilter
    pricesSheet.autoFilter = { from: "A1", to: `J${data.prices.length + 1}` };
  }

  // ---- Top Gainers Sheet ----
  if (data.topGainers.length > 0) {
    const gainersSheet = workbook.addWorksheet("Top Gainers");
    gainersSheet.columns = [
      { header: "Rank", key: "rank", width: 8 },
      { header: "Item", key: "item", width: 20 },
      { header: "Market", key: "market", width: 25 },
      { header: "State", key: "state", width: 15 },
      { header: "Price (₦)", key: "price", width: 15 },
      { header: "Previous (₦)", key: "previous", width: 15 },
      { header: "Change (₦)", key: "changeAmt", width: 15 },
      { header: "Change (%)", key: "changePct", width: 12 },
    ];
    gainersSheet.getRow(1).eachCell(cell => { cell.fill = headerFill; cell.font = headerFont; });
    data.topGainers.forEach((g: any) => {
      const row = gainersSheet.addRow({
        rank: g.rank, item: g.item, market: g.market, state: g.state,
        price: g.price, previous: g.previousPrice,
        changeAmt: g.changeAmount, changePct: g.changePercent,
      });
      row.getCell("changePct").font = greenFont;
    });
  }

  // ---- Top Losers Sheet ----
  if (data.topLosers.length > 0) {
    const losersSheet = workbook.addWorksheet("Top Losers");
    losersSheet.columns = [
      { header: "Rank", key: "rank", width: 8 },
      { header: "Item", key: "item", width: 20 },
      { header: "Market", key: "market", width: 25 },
      { header: "State", key: "state", width: 15 },
      { header: "Price (₦)", key: "price", width: 15 },
      { header: "Previous (₦)", key: "previous", width: 15 },
      { header: "Change (₦)", key: "changeAmt", width: 15 },
      { header: "Change (%)", key: "changePct", width: 12 },
    ];
    losersSheet.getRow(1).eachCell(cell => { cell.fill = headerFill; cell.font = headerFont; });
    data.topLosers.forEach((l: any) => {
      const row = losersSheet.addRow({
        rank: l.rank, item: l.item, market: l.market, state: l.state,
        price: l.price, previous: l.previousPrice,
        changeAmt: l.changeAmount, changePct: l.changePercent,
      });
      row.getCell("changePct").font = redFont;
    });
  }

  // ---- Category Sheet ----
  if (data.categoryBreakdown.length > 0) {
    const catSheet = workbook.addWorksheet("Categories");
    catSheet.columns = [
      { header: "Category", key: "category", width: 20 },
      { header: "Items", key: "items", width: 10 },
      { header: "Avg Price (₦)", key: "avgPrice", width: 15 },
      { header: "Avg Change (%)", key: "avgChange", width: 15 },
      { header: "Trend", key: "trend", width: 10 },
    ];
    catSheet.getRow(1).eachCell(cell => { cell.fill = headerFill; cell.font = headerFont; });
    data.categoryBreakdown.forEach((c: any) => catSheet.addRow(c));
  }

  // ---- Regional Sheet ----
  if (data.regionalData.length > 0) {
    const regSheet = workbook.addWorksheet("Regional");
    regSheet.columns = [
      { header: "Region", key: "region", width: 18 },
      { header: "Markets", key: "marketCount", width: 10 },
      { header: "States", key: "states", width: 40 },
      { header: "Avg Inflation (%)", key: "avgInflation", width: 18 },
      { header: "Top Item", key: "topItem", width: 20 },
    ];
    regSheet.getRow(1).eachCell(cell => { cell.fill = headerFill; cell.font = headerFont; });
    data.regionalData.forEach((r: any) =>
      regSheet.addRow({ ...r, states: r.states.join(", ") })
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ============================================================================
// HTML REPORT GENERATION (returns JSON for preview)
// ============================================================================

function generateHTMLData(reportType: string, reportName: string, data: any) {
  return {
    success: true,
    reportName,
    reportType,
    generatedAt: new Date().toISOString(),
    data: {
      summary: data.summary,
      dataDate: data.dataDate,
      recordCount: data.recordCount,
      topGainers: data.topGainers,
      topLosers: data.topLosers,
      categoryBreakdown: data.categoryBreakdown,
      regionalData: data.regionalData,
      marketComparison: data.marketComparison?.slice(0, 20),
    },
  };
}

// ============================================================================
// REPORT NAME MAPPING
// ============================================================================

const REPORT_NAMES: Record<string, string> = {
  daily_market_summary: "Daily Market Summary",
  weekly_trend_analysis: "Weekly Trend Analysis",
  market_comparison: "Market Comparison Report",
  arbitrage_opportunities: "Arbitrage Opportunities",
  inflation_impact: "Inflation Impact Report",
  supply_chain_intelligence: "Supply Chain Intelligence",
  custom_analytics: "Custom Analytics Report",
};

// ============================================================================
// POST HANDLER - Generate report in requested format
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession();
    const userTier = await getUserTier(session);

    // Minimum BUSINESS tier
    if (!hasAccess(userTier, "BUSINESS")) {
      return NextResponse.json(
        { success: false, error: "Reports require BUSINESS tier or higher", currentTier: userTier },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { reportType, outputFormat, parameters } = body;

    // Validate report type
    const requiredTier = REPORT_MIN_TIERS[reportType];
    if (!requiredTier) {
      return NextResponse.json({ success: false, error: "Invalid report type" }, { status: 400 });
    }

    // Check tier access for this specific report
    if (!hasAccess(userTier, requiredTier)) {
      return NextResponse.json(
        { success: false, error: `${REPORT_NAMES[reportType]} requires ${requiredTier} tier`, currentTier: userTier },
        { status: 403 }
      );
    }

    const reportName = REPORT_NAMES[reportType] || reportType;
    console.log(`[Reports Generate] Type: ${reportType}, Format: ${outputFormat}, Tier: ${userTier}`);

    // Fetch data from database
    const data = await fetchReportData(reportType, parameters);

    if (data.isEmpty) {
      // Still generate report, but with empty data notice
      console.log("[Reports Generate] No data found, generating empty report");
    }

    // Generate based on format
    const format = (outputFormat || "pdf").toLowerCase();

    if (format === "html") {
      // Return JSON for HTML preview
      const htmlData = generateHTMLData(reportType, reportName, data);
      return NextResponse.json(htmlData);
    }

    if (format === "excel") {
      const excelBuffer = await generateExcel(reportType, reportName, data);
      const filename = `NaijaMarket_${reportName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`;

      return new NextResponse(excelBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(excelBuffer.length),
        },
      });
    }

    // Default: PDF
    const pdfBuffer = await generatePDF(reportType, reportName, data);
    const filename = `NaijaMarket_${reportName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error: any) {
    console.error("[Reports Generate] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Report generation failed" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
