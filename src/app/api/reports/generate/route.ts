// ============================================================================
// src/app/api/reports/generate/route.ts
// NaijaMarket Intel - Report Generation Engine
// Version: 1.1.0 - Vercel-compatible (pdf-lib + exceljs, no filesystem fonts)
//
// DEPENDENCIES:
//   npm install pdf-lib exceljs
//   (remove pdfkit and @types/pdfkit if previously installed)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const prisma = new PrismaClient();

// ============================================================================
// TIER ACCESS
// ============================================================================

const TIER_HIERARCHY = [
  "FREE", "STARTER", "SILVER", "GOLD", "BUSINESS", "BUSINESS_PLUS",
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
    if (email) {
      const u = await prisma.consumers.findFirst({
        where: { email },
        select: { subscription_tier: true },
      });
      if (u?.subscription_tier) return u.subscription_tier.toUpperCase();
    }
    if (phone) {
      const u = await prisma.consumers.findFirst({
        where: { phone_number: phone },
        select: { subscription_tier: true },
      });
      if (u?.subscription_tier) return u.subscription_tier.toUpperCase();
    }
    if (name && name.startsWith("User ")) {
      const suffix = name.replace("User ", "");
      if (/^\d{4,}$/.test(suffix)) {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT TOP 1 subscription_tier FROM Consumers WHERE phone_number LIKE '%${suffix}' ORDER BY created_at DESC`
        );
        if (rows?.[0]?.subscription_tier) return rows[0].subscription_tier.toUpperCase();
      }
    }
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

function hasTierAccess(userTier: string, requiredTier: string): boolean {
  return TIER_HIERARCHY.indexOf(userTier) >= TIER_HIERARCHY.indexOf(requiredTier);
}

// ============================================================================
// DATA FETCHING
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
    // Try latest date first
    let prices: PriceRow[] = await prisma.$queryRawUnsafe(`
      SELECT TOP 500
        item_name, market_name, state, 
        COALESCE(category_id, 'Uncategorized') AS category_id,
        unit, price_naira, 
        COALESCE(previous_price, price_naira) AS previous_price,
        COALESCE(price_change_pct, 0) AS price_change_pct,
        COALESCE(trend, 'stable') AS trend,
        CAST(price_date AS VARCHAR) AS price_date,
        COALESCE(data_source, 'NaijaMarket') AS data_source
      FROM Daily_Prices
      WHERE price_date = (SELECT MAX(price_date) FROM Daily_Prices)
      ORDER BY item_name, market_name
    `);

    // Fallback: last 7 days
    if (prices.length === 0) {
      prices = await prisma.$queryRawUnsafe(`
        SELECT TOP 500
          item_name, market_name, state,
          COALESCE(category_id, 'Uncategorized') AS category_id,
          unit, price_naira,
          COALESCE(previous_price, price_naira) AS previous_price,
          COALESCE(price_change_pct, 0) AS price_change_pct,
          COALESCE(trend, 'stable') AS trend,
          CAST(price_date AS VARCHAR) AS price_date,
          COALESCE(data_source, 'NaijaMarket') AS data_source
        FROM Daily_Prices
        WHERE price_date >= DATEADD(day, -7, GETDATE())
        ORDER BY price_date DESC, item_name, market_name
      `);
    }

    // Fallback: Validated_Prices
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
      } catch { /* table may not exist */ }
    }

    if (prices.length === 0) {
      return { prices: [], summary: getEmptySummary(), isEmpty: true };
    }

    return {
      prices,
      summary: computeSummary(prices),
      topGainers: getTopMovers(prices, "up", 10),
      topLosers: getTopMovers(prices, "down", 10),
      categoryBreakdown: getCategoryBreakdown(prices),
      regionalData: getRegionalBreakdown(prices),
      marketComparison: getMarketComparison(prices),
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
  return { totalItems: 0, totalMarkets: 0, totalStates: 0, avgChange: 0, priceIncreases: 0, priceDecreases: 0, unchanged: 0 };
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
  return [...prices]
    .filter(p => {
      const c = Number(p.price_change_pct) || 0;
      return direction === "up" ? c > 0 : c < 0;
    })
    .sort((a, b) => Math.abs(Number(b.price_change_pct) || 0) - Math.abs(Number(a.price_change_pct) || 0))
    .slice(0, limit)
    .map((p, idx) => ({
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
  const cats: Record<string, { prices: number[]; changes: number[]; items: Set<string> }> = {};
  for (const p of prices) {
    const cat = p.category_id || "Uncategorized";
    if (!cats[cat]) cats[cat] = { prices: [], changes: [], items: new Set() };
    cats[cat].prices.push(Number(p.price_naira));
    cats[cat].changes.push(Number(p.price_change_pct) || 0);
    cats[cat].items.add(p.item_name);
  }
  return Object.entries(cats).map(([category, d]) => {
    const avg = d.changes.reduce((a, b) => a + b, 0) / d.changes.length;
    return {
      category,
      avgPrice: Math.round((d.prices.reduce((a, b) => a + b, 0) / d.prices.length) * 100) / 100,
      avgChange: Math.round(avg * 100) / 100,
      itemCount: d.items.size,
      trend: avg > 0.5 ? "up" as const : avg < -0.5 ? "down" as const : "stable" as const,
    };
  });
}

function getRegionalBreakdown(prices: PriceRow[]) {
  const stateToZone: Record<string, string> = {
    Lagos: "South-West", Ogun: "South-West", Oyo: "South-West", Osun: "South-West", Ondo: "South-West", Ekiti: "South-West",
    Anambra: "South-East", Enugu: "South-East", Imo: "South-East", Abia: "South-East", Ebonyi: "South-East",
    Rivers: "South-South", Delta: "South-South", Bayelsa: "South-South", "Akwa Ibom": "South-South", "Cross River": "South-South", Edo: "South-South",
    Kano: "North-West", Kaduna: "North-West", Sokoto: "North-West", Kebbi: "North-West", Zamfara: "North-West", Katsina: "North-West", Jigawa: "North-West",
    Borno: "North-East", Bauchi: "North-East", Adamawa: "North-East", Yobe: "North-East", Gombe: "North-East", Taraba: "North-East",
    Plateau: "North-Central", Niger: "North-Central", Benue: "North-Central", Kwara: "North-Central", Kogi: "North-Central", Nassarawa: "North-Central", FCT: "North-Central",
  };

  const regions: Record<string, { states: Set<string>; changes: number[]; markets: Set<string>; topItem: string; topPrice: number }> = {};
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

  return Object.entries(regions).map(([region, d]) => ({
    region,
    states: Array.from(d.states),
    avgInflation: Math.round((d.changes.reduce((a, b) => a + b, 0) / d.changes.length) * 100) / 100,
    marketCount: d.markets.size,
    topItem: d.topItem,
  }));
}

function getMarketComparison(prices: PriceRow[]) {
  const mktData: Record<string, { items: Record<string, number>; state: string }> = {};
  for (const p of prices) {
    if (!mktData[p.market_name]) mktData[p.market_name] = { items: {}, state: p.state };
    mktData[p.market_name].items[p.item_name] = Number(p.price_naira);
  }
  return Object.entries(mktData).map(([market, d]) => ({
    market,
    state: d.state,
    itemCount: Object.keys(d.items).length,
    avgPrice: Math.round((Object.values(d.items).reduce((a, b) => a + b, 0) / Object.values(d.items).length) * 100) / 100,
    items: d.items,
  }));
}

// ============================================================================
// PDF GENERATION using pdf-lib (Vercel-safe, zero filesystem deps)
// ============================================================================

function fmtN(n: number): string {
  return "NGN " + Number(n).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

async function generatePDF(reportType: string, reportName: string, data: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595.28; // A4 width
  const PAGE_H = 841.89; // A4 height
  const MARGIN = 50;

  const greenC = rgb(0.086, 0.639, 0.290);
  const redC = rgb(0.863, 0.149, 0.149);
  const grayC = rgb(0.42, 0.45, 0.49);
  const darkC = rgb(0.067, 0.094, 0.153);
  const whiteC = rgb(1, 1, 1);
  const bgC = rgb(0.039, 0.039, 0.039);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  }

  function drawText(text: string, x: number, yPos: number, opts: { font?: any; size?: number; color?: any; maxWidth?: number } = {}) {
    const font = opts.font || helvetica;
    const size = opts.size || 10;
    const color = opts.color || darkC;
    let t = String(text || "");
    const mw = opts.maxWidth || (PAGE_W - MARGIN - x);
    // Truncate if too wide
    while (t.length > 3 && font.widthOfTextAtSize(t, size) > mw) {
      t = t.slice(0, -4) + "...";
    }
    try {
      page.drawText(t, { x, y: yPos, size, font, color });
    } catch {
      // If any glyph encoding error, strip non-ASCII and retry
      const safe = t.replace(/[^\x20-\x7E]/g, "");
      page.drawText(safe, { x, y: yPos, size, font, color });
    }
  }

  // ---- HEADER BAR ----
  page.drawRectangle({ x: 0, y: PAGE_H - 90, width: PAGE_W, height: 90, color: bgC });
  drawText("NaijaMarket Intel", MARGIN, PAGE_H - 40, { font: helveticaBold, size: 24, color: whiteC });
  drawText(reportName, MARGIN, PAGE_H - 60, { font: helveticaBold, size: 13, color: greenC });
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  drawText("Generated: " + dateStr, MARGIN, PAGE_H - 78, { size: 9, color: grayC });

  y = PAGE_H - 115;

  // ---- SECTION HELPER ----
  function drawSectionTitle(title: string) {
    ensureSpace(35);
    drawText(title, MARGIN, y, { font: helveticaBold, size: 14, color: darkC });
    y -= 5;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + Math.min(title.length * 8, 280), y }, thickness: 1.5, color: greenC });
    y -= 18;
  }

  // ---- EXECUTIVE SUMMARY ----
  drawSectionTitle("Executive Summary");

  if (data.isEmpty) {
    drawText("No price data available for the selected period.", MARGIN, y, { color: redC });
    y -= 16;
    drawText("Please ensure the data pipeline is running and Daily_Prices table has data.", MARGIN, y, { color: grayC });
    return await pdfDoc.save();
  }

  const s = data.summary;
  const summaryLines = [
    "Total Commodities Tracked: " + s.totalItems,
    "Markets Covered: " + s.totalMarkets,
    "States Represented: " + s.totalStates,
    "Average Price Change: " + fmtPct(s.avgChange),
    "Price Increases: " + s.priceIncreases + "  |  Decreases: " + s.priceDecreases + "  |  Unchanged: " + s.unchanged,
    "Data Date: " + data.dataDate,
    "Total Records: " + data.recordCount,
  ];
  for (const line of summaryLines) {
    drawText(line, MARGIN, y, { size: 10, color: grayC });
    y -= 16;
  }
  y -= 12;

  // ---- TABLE HELPER ----
  function drawTable(
    title: string,
    headers: { label: string; width: number }[],
    rows: string[][],
    rowColors?: (string | null)[][],
  ) {
    drawSectionTitle(title);

    // Header row
    let xPos = MARGIN;
    for (const h of headers) {
      drawText(h.label, xPos, y, { font: helveticaBold, size: 8, color: grayC, maxWidth: h.width - 4 });
      xPos += h.width;
    }
    y -= 3;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rgb(0.83, 0.84, 0.85) });
    y -= 12;

    // Data rows
    for (let i = 0; i < rows.length; i++) {
      ensureSpace(14);
      xPos = MARGIN;
      for (let j = 0; j < headers.length; j++) {
        const colorStr = rowColors?.[i]?.[j];
        const color = colorStr === "green" ? greenC : colorStr === "red" ? redC : darkC;
        drawText(rows[i][j] || "", xPos, y, { size: 8, color, maxWidth: headers[j].width - 4 });
        xPos += headers[j].width;
      }
      y -= 13;
    }
    y -= 10;
  }

  // ---- TOP GAINERS ----
  if (data.topGainers.length > 0) {
    const hdrs = [
      { label: "#", width: 22 }, { label: "Item", width: 95 }, { label: "Market", width: 115 },
      { label: "Price", width: 75 }, { label: "Change", width: 75 }, { label: "% Change", width: 65 },
    ];
    const rows = data.topGainers.map((g: any) => [
      String(g.rank), g.item, g.market + " (" + g.state + ")",
      fmtN(g.price), "+" + fmtN(Math.abs(g.changeAmount)), fmtPct(g.changePercent),
    ]);
    const colors = data.topGainers.map(() => [null, null, null, null, "green", "green"]);
    drawTable("Top Gainers (Price Increases)", hdrs, rows, colors);
  }

  // ---- TOP LOSERS ----
  if (data.topLosers.length > 0) {
    const hdrs = [
      { label: "#", width: 22 }, { label: "Item", width: 95 }, { label: "Market", width: 115 },
      { label: "Price", width: 75 }, { label: "Change", width: 75 }, { label: "% Change", width: 65 },
    ];
    const rows = data.topLosers.map((l: any) => [
      String(l.rank), l.item, l.market + " (" + l.state + ")",
      fmtN(l.price), "-" + fmtN(Math.abs(l.changeAmount)), fmtPct(l.changePercent),
    ]);
    const colors = data.topLosers.map(() => [null, null, null, null, "red", "red"]);
    drawTable("Top Losers (Price Decreases)", hdrs, rows, colors);
  }

  // ---- CATEGORY BREAKDOWN ----
  if (data.categoryBreakdown.length > 0) {
    drawSectionTitle("Category Breakdown");
    for (const cat of data.categoryBreakdown) {
      ensureSpace(18);
      const trendColor = cat.trend === "up" ? greenC : cat.trend === "down" ? redC : grayC;
      drawText(cat.category, MARGIN, y, { font: helveticaBold, size: 10, color: darkC });
      drawText(
        cat.itemCount + " items | Avg " + fmtN(cat.avgPrice) + " | Change: " + fmtPct(cat.avgChange),
        MARGIN + 130, y, { size: 9, color: trendColor }
      );
      y -= 16;
    }
    y -= 10;
  }

  // ---- REGIONAL ANALYSIS ----
  if (data.regionalData.length > 0) {
    drawSectionTitle("Regional Analysis (Geopolitical Zones)");
    for (const region of data.regionalData) {
      ensureSpace(30);
      const trendColor = region.avgInflation > 0 ? redC : region.avgInflation < 0 ? greenC : grayC;
      drawText(region.region, MARGIN, y, { font: helveticaBold, size: 10, color: darkC });
      drawText(
        region.marketCount + " markets | " + region.states.length + " states | Avg inflation: " + fmtPct(region.avgInflation),
        MARGIN + 100, y, { size: 9, color: trendColor }
      );
      y -= 14;
      drawText(
        "States: " + region.states.join(", ") + " | Most expensive: " + region.topItem,
        MARGIN + 10, y, { size: 8, color: grayC }
      );
      y -= 18;
    }
    y -= 10;
  }

  // ---- MARKET COMPARISON (for market_comparison report) ----
  if (reportType === "market_comparison" && data.marketComparison?.length > 0) {
    const hdrs = [
      { label: "Market", width: 150 }, { label: "State", width: 80 },
      { label: "Items", width: 50 }, { label: "Avg Price", width: 100 },
    ];
    const rows = data.marketComparison.slice(0, 20).map((m: any) => [
      m.market, m.state, String(m.itemCount), fmtN(m.avgPrice),
    ]);
    drawTable("Market Price Comparison", hdrs, rows);
  }

  // ---- FULL PRICE TABLE (for daily_market_summary) ----
  if (reportType === "daily_market_summary" && data.prices.length > 0) {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;

    const hdrs = [
      { label: "Item", width: 80 }, { label: "Market", width: 90 }, { label: "State", width: 55 },
      { label: "Unit", width: 45 }, { label: "Price", width: 65 }, { label: "Prev", width: 65 },
      { label: "Change %", width: 55 },
    ];
    const rows = data.prices.slice(0, 100).map((p: any) => {
      const change = Number(p.price_change_pct) || 0;
      return [
        p.item_name, p.market_name, p.state, p.unit || "-",
        fmtN(Number(p.price_naira)), fmtN(Number(p.previous_price)), fmtPct(change),
      ];
    });
    const colors = data.prices.slice(0, 100).map((p: any) => {
      const c = Number(p.price_change_pct) || 0;
      const col = c > 0 ? "green" : c < 0 ? "red" : null;
      return [null, null, null, null, null, null, col];
    });
    drawTable("Complete Price Table (Top 100)", hdrs, rows, colors);
  }

  // ---- DISCLAIMER / FOOTER ----
  page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  y = PAGE_H - MARGIN;

  drawSectionTitle("Disclaimer");

  const disclaimerLines = [
    "This report is generated by NaijaMarket Intel based on crowdsourced and validated",
    "commodity price data from markets across Nigeria. While we strive for accuracy through",
    "GPS verification, community validation, and fraud detection, prices may vary.",
    "",
    "This report should not be used as the sole basis for financial decisions.",
    "NaijaMarket Intel is a product of Giggababytes Oy.",
  ];
  for (const line of disclaimerLines) {
    drawText(line, MARGIN, y, { size: 9, color: grayC });
    y -= 14;
  }

  y -= 20;
  drawText("www.naijamarket.com  |  support@naijamarket.ng", MARGIN, y, { font: helveticaBold, size: 10, color: greenC });
  y -= 18;
  drawText("Report ID: RPT-" + Date.now() + "  |  (c) " + new Date().getFullYear() + " NaijaMarket Intel", MARGIN, y, { size: 8, color: grayC });

  return await pdfDoc.save();
}

// ============================================================================
// EXCEL GENERATION (exceljs)
// ============================================================================

async function generateExcel(reportType: string, reportName: string, data: any): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NaijaMarket Intel";
  workbook.created = new Date();

  const headerFill: any = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A0A0A" } };
  const headerFont: any = { color: { argb: "FFFFFFFF" }, bold: true, size: 10 };
  const greenFont: any = { color: { argb: "FF16A34A" }, bold: true };
  const redFont: any = { color: { argb: "FFDC2626" }, bold: true };

  // Summary Sheet
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 30 },
    { header: "Value", key: "value", width: 25 },
  ];
  summarySheet.getRow(1).eachCell(cell => { cell.fill = headerFill; cell.font = headerFont; });

  const summ = data.summary;
  [
    { metric: "Report", value: reportName },
    { metric: "Generated", value: new Date().toLocaleString("en-GB") },
    { metric: "Data Date", value: data.dataDate || "N/A" },
    { metric: "Total Commodities", value: summ.totalItems },
    { metric: "Total Markets", value: summ.totalMarkets },
    { metric: "Total States", value: summ.totalStates },
    { metric: "Average Price Change (%)", value: summ.avgChange },
    { metric: "Price Increases", value: summ.priceIncreases },
    { metric: "Price Decreases", value: summ.priceDecreases },
    { metric: "Unchanged", value: summ.unchanged },
    { metric: "Total Records", value: data.recordCount },
  ].forEach(row => summarySheet.addRow(row));

  // All Prices Sheet
  if (data.prices.length > 0) {
    const sheet = workbook.addWorksheet("All Prices");
    sheet.columns = [
      { header: "Item", key: "item", width: 20 },
      { header: "Market", key: "market", width: 25 },
      { header: "State", key: "state", width: 15 },
      { header: "Category", key: "category", width: 15 },
      { header: "Unit", key: "unit", width: 12 },
      { header: "Price (NGN)", key: "price", width: 15 },
      { header: "Previous (NGN)", key: "previous", width: 15 },
      { header: "Change (%)", key: "change", width: 12 },
      { header: "Trend", key: "trend", width: 10 },
      { header: "Date", key: "date", width: 15 },
    ];
    sheet.getRow(1).eachCell(cell => { cell.fill = headerFill; cell.font = headerFont; });

    for (const p of data.prices) {
      const change = Number(p.price_change_pct) || 0;
      const row = sheet.addRow({
        item: p.item_name, market: p.market_name, state: p.state,
        category: p.category_id, unit: p.unit || "-",
        price: Number(p.price_naira), previous: Number(p.previous_price),
        change, trend: p.trend || "stable", date: p.price_date,
      });
      const cell = row.getCell("change");
      if (change > 0) cell.font = greenFont;
      else if (change < 0) cell.font = redFont;
    }

    sheet.getColumn("price").numFmt = "#,##0.00";
    sheet.getColumn("previous").numFmt = "#,##0.00";
    sheet.getColumn("change").numFmt = "0.0";
    sheet.autoFilter = { from: "A1", to: `J${data.prices.length + 1}` };
  }

  // Top Gainers Sheet
  if (data.topGainers.length > 0) {
    const sheet = workbook.addWorksheet("Top Gainers");
    sheet.columns = [
      { header: "Rank", key: "rank", width: 8 },
      { header: "Item", key: "item", width: 20 },
      { header: "Market", key: "market", width: 25 },
      { header: "State", key: "state", width: 15 },
      { header: "Price (NGN)", key: "price", width: 15 },
      { header: "Previous (NGN)", key: "previous", width: 15 },
      { header: "Change (NGN)", key: "changeAmt", width: 15 },
      { header: "Change (%)", key: "changePct", width: 12 },
    ];
    sheet.getRow(1).eachCell(cell => { cell.fill = headerFill; cell.font = headerFont; });
    data.topGainers.forEach((g: any) => {
      const row = sheet.addRow({
        rank: g.rank, item: g.item, market: g.market, state: g.state,
        price: g.price, previous: g.previousPrice, changeAmt: g.changeAmount, changePct: g.changePercent,
      });
      row.getCell("changePct").font = greenFont;
    });
  }

  // Top Losers Sheet
  if (data.topLosers.length > 0) {
    const sheet = workbook.addWorksheet("Top Losers");
    sheet.columns = [
      { header: "Rank", key: "rank", width: 8 },
      { header: "Item", key: "item", width: 20 },
      { header: "Market", key: "market", width: 25 },
      { header: "State", key: "state", width: 15 },
      { header: "Price (NGN)", key: "price", width: 15 },
      { header: "Previous (NGN)", key: "previous", width: 15 },
      { header: "Change (NGN)", key: "changeAmt", width: 15 },
      { header: "Change (%)", key: "changePct", width: 12 },
    ];
    sheet.getRow(1).eachCell(cell => { cell.fill = headerFill; cell.font = headerFont; });
    data.topLosers.forEach((l: any) => {
      const row = sheet.addRow({
        rank: l.rank, item: l.item, market: l.market, state: l.state,
        price: l.price, previous: l.previousPrice, changeAmt: l.changeAmount, changePct: l.changePercent,
      });
      row.getCell("changePct").font = redFont;
    });
  }

  // Categories Sheet
  if (data.categoryBreakdown.length > 0) {
    const sheet = workbook.addWorksheet("Categories");
    sheet.columns = [
      { header: "Category", key: "category", width: 20 },
      { header: "Items", key: "itemCount", width: 10 },
      { header: "Avg Price (NGN)", key: "avgPrice", width: 15 },
      { header: "Avg Change (%)", key: "avgChange", width: 15 },
      { header: "Trend", key: "trend", width: 10 },
    ];
    sheet.getRow(1).eachCell(cell => { cell.fill = headerFill; cell.font = headerFont; });
    data.categoryBreakdown.forEach((c: any) => sheet.addRow(c));
  }

  // Regional Sheet
  if (data.regionalData.length > 0) {
    const sheet = workbook.addWorksheet("Regional");
    sheet.columns = [
      { header: "Region", key: "region", width: 18 },
      { header: "Markets", key: "marketCount", width: 10 },
      { header: "States", key: "states", width: 40 },
      { header: "Avg Inflation (%)", key: "avgInflation", width: 18 },
      { header: "Top Item", key: "topItem", width: 20 },
    ];
    sheet.getRow(1).eachCell(cell => { cell.fill = headerFill; cell.font = headerFont; });
    data.regionalData.forEach((r: any) => sheet.addRow({ ...r, states: r.states.join(", ") }));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ============================================================================
// HTML DATA (returns JSON for preview modal)
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
// POST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userTier = await getUserTier(session);

    if (!hasTierAccess(userTier, "BUSINESS")) {
      return NextResponse.json(
        { success: false, error: "Reports require BUSINESS tier or higher", currentTier: userTier },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { reportType, outputFormat, parameters } = body;

    const requiredTier = REPORT_MIN_TIERS[reportType];
    if (!requiredTier) {
      return NextResponse.json({ success: false, error: "Invalid report type" }, { status: 400 });
    }

    if (!hasTierAccess(userTier, requiredTier)) {
      return NextResponse.json(
        { success: false, error: REPORT_NAMES[reportType] + " requires " + requiredTier + " tier", currentTier: userTier },
        { status: 403 }
      );
    }

    const reportName = REPORT_NAMES[reportType] || reportType;
    console.log("[Reports Generate] Type:", reportType, "Format:", outputFormat, "Tier:", userTier);

    const data = await fetchReportData(reportType, parameters);

    if (data.isEmpty) {
      console.log("[Reports Generate] No data found, generating report with empty notice");
    }

    const format = (outputFormat || "pdf").toLowerCase();

    if (format === "html") {
      return NextResponse.json(generateHTMLData(reportType, reportName, data));
    }

    if (format === "excel") {
      const excelBuffer = await generateExcel(reportType, reportName, data);
      const filename = "NaijaMarket_" + reportName.replace(/\s+/g, "_") + "_" + new Date().toISOString().split("T")[0] + ".xlsx";
      return new NextResponse(excelBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="' + filename + '"',
          "Content-Length": String(excelBuffer.length),
        },
      });
    }

    // Default: PDF
    const pdfBytes = await generatePDF(reportType, reportName, data);
    const filename = "NaijaMarket_" + reportName.replace(/\s+/g, "_") + "_" + new Date().toISOString().split("T")[0] + ".pdf";
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="' + filename + '"',
        "Content-Length": String(pdfBytes.length),
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
