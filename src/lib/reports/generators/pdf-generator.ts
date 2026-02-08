// src/lib/reports/generators/pdf-generator.ts
// NaijaMarket Intel - Server-side PDF Generator
// Uses PDFKit for professional PDF creation
// Updated: 2026-02-08

import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

// ============================================================================
// BRAND COLORS
// ============================================================================

const COLORS = {
  primary: "#10B981",      // Emerald Green
  secondary: "#F59E0B",    // Gold/Yellow
  dark: "#1F2937",         // Dark Gray (text)
  light: "#F9FAFB",        // Light Gray (backgrounds)
  white: "#FFFFFF",
  black: "#000000",
  success: "#22C55E",
  danger: "#EF4444",
  warning: "#F59E0B",
  muted: "#6B7280",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// ============================================================================
// PDF DOCUMENT SETUP
// ============================================================================

function createDocument(): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: "NaijaMarket Intel Report",
      Author: "NaijaMarket Intel",
      Creator: "NaijaMarket Intel Platform",
    },
  });
  return doc;
}

function addHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  
  // Green header bar
  doc.rect(0, 0, doc.page.width, 80).fill(COLORS.primary);
  
  // Logo text (since we can't embed image easily)
  doc.fontSize(24)
     .fillColor(COLORS.white)
     .font("Helvetica-Bold")
     .text("NaijaMarket", 50, 25, { continued: true })
     .fillColor(COLORS.secondary)
     .text(" Intel", { continued: false });
  
  // Tagline
  doc.fontSize(8)
     .fillColor(COLORS.white)
     .font("Helvetica")
     .text("The Bloomberg of African Commodities", 50, 52);
  
  // Report generation date (right side)
  doc.fontSize(8)
     .fillColor(COLORS.white)
     .text(`Generated: ${formatDateTime(new Date())}`, doc.page.width - 200, 30, { width: 150, align: "right" });
  
  // Reset position
  doc.y = 100;
  
  // Report title
  doc.fontSize(22)
     .fillColor(COLORS.dark)
     .font("Helvetica-Bold")
     .text(title, 50, doc.y, { align: "center", width: pageWidth });
  
  if (subtitle) {
    doc.moveDown(0.3);
    doc.fontSize(12)
       .fillColor(COLORS.muted)
       .font("Helvetica")
       .text(subtitle, 50, doc.y, { align: "center", width: pageWidth });
  }
  
  doc.moveDown(1.5);
  
  // Divider line
  doc.moveTo(50, doc.y)
     .lineTo(doc.page.width - 50, doc.y)
     .strokeColor(COLORS.primary)
     .lineWidth(2)
     .stroke();
  
  doc.moveDown(1);
}

function addFooter(doc: PDFKit.PDFDocument, pageNum: number, totalPages?: number) {
  const pageHeight = doc.page.height;
  const pageWidth = doc.page.width;
  
  // Footer line
  doc.moveTo(50, pageHeight - 50)
     .lineTo(pageWidth - 50, pageHeight - 50)
     .strokeColor(COLORS.muted)
     .lineWidth(0.5)
     .stroke();
  
  // Footer text
  doc.fontSize(8)
     .fillColor(COLORS.muted)
     .font("Helvetica")
     .text(
       "© 2026 NaijaMarket Intel | Confidential Business Report | www.naijamarket.intel",
       50,
       pageHeight - 40,
       { align: "center", width: pageWidth - 100 }
     );
  
  // Page number
  doc.text(
    totalPages ? `Page ${pageNum} of ${totalPages}` : `Page ${pageNum}`,
    50,
    pageHeight - 30,
    { align: "center", width: pageWidth - 100 }
  );
}

function addSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.5);
  
  // Section background
  const startY = doc.y;
  doc.rect(50, startY, doc.page.width - 100, 25)
     .fill(COLORS.light);
  
  // Section title
  doc.fontSize(14)
     .fillColor(COLORS.primary)
     .font("Helvetica-Bold")
     .text(title, 60, startY + 6);
  
  doc.y = startY + 35;
}

function addTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: (string | number)[][],
  options?: { columnWidths?: number[]; highlightRow?: number }
) {
  const tableWidth = doc.page.width - 100;
  const columnCount = headers.length;
  const defaultColWidth = tableWidth / columnCount;
  const columnWidths = options?.columnWidths || headers.map(() => defaultColWidth);
  
  let startX = 50;
  let startY = doc.y;
  const rowHeight = 22;
  
  // Check if we need a new page
  if (startY + (rows.length + 1) * rowHeight > doc.page.height - 80) {
    doc.addPage();
    startY = 50;
  }
  
  // Header row
  doc.rect(startX, startY, tableWidth, rowHeight).fill(COLORS.primary);
  
  let x = startX;
  headers.forEach((header, i) => {
    doc.fontSize(9)
       .fillColor(COLORS.white)
       .font("Helvetica-Bold")
       .text(header, x + 5, startY + 6, { width: columnWidths[i] - 10, align: "left" });
    x += columnWidths[i];
  });
  
  startY += rowHeight;
  
  // Data rows
  rows.forEach((row, rowIndex) => {
    // Check for page break
    if (startY + rowHeight > doc.page.height - 80) {
      doc.addPage();
      startY = 50;
    }
    
    // Alternating row colors
    const bgColor = rowIndex % 2 === 0 ? COLORS.white : COLORS.light;
    doc.rect(startX, startY, tableWidth, rowHeight).fill(bgColor);
    
    // Row border
    doc.rect(startX, startY, tableWidth, rowHeight)
       .strokeColor(COLORS.light)
       .lineWidth(0.5)
       .stroke();
    
    x = startX;
    row.forEach((cell, i) => {
      const cellText = typeof cell === "number" 
        ? (cell > 1000 ? formatCurrency(cell) : cell.toString())
        : cell.toString();
      
      // Color for percentage values
      let textColor = COLORS.dark;
      if (typeof cell === "number" && cellText.includes("%")) {
        textColor = cell >= 0 ? COLORS.success : COLORS.danger;
      }
      
      doc.fontSize(8)
         .fillColor(textColor)
         .font("Helvetica")
         .text(cellText, x + 5, startY + 6, { width: columnWidths[i] - 10, align: "left" });
      x += columnWidths[i];
    });
    
    startY += rowHeight;
  });
  
  doc.y = startY + 10;
}

function addKeyValuePairs(doc: PDFKit.PDFDocument, pairs: { label: string; value: string | number }[]) {
  pairs.forEach(({ label, value }) => {
    doc.fontSize(10)
       .fillColor(COLORS.muted)
       .font("Helvetica")
       .text(label + ": ", 50, doc.y, { continued: true })
       .fillColor(COLORS.dark)
       .font("Helvetica-Bold")
       .text(typeof value === "number" ? formatCurrency(value) : value.toString());
  });
  doc.moveDown(0.5);
}

function addSummaryBox(doc: PDFKit.PDFDocument, title: string, items: { label: string; value: string; color?: string }[]) {
  const boxWidth = (doc.page.width - 120) / 2;
  const boxHeight = 20 + items.length * 18;
  const startY = doc.y;
  
  // Box background
  doc.roundedRect(50, startY, boxWidth, boxHeight, 5)
     .fill(COLORS.light);
  
  // Box border
  doc.roundedRect(50, startY, boxWidth, boxHeight, 5)
     .strokeColor(COLORS.primary)
     .lineWidth(1)
     .stroke();
  
  // Title
  doc.fontSize(11)
     .fillColor(COLORS.primary)
     .font("Helvetica-Bold")
     .text(title, 60, startY + 8);
  
  // Items
  let itemY = startY + 28;
  items.forEach(({ label, value, color }) => {
    doc.fontSize(9)
       .fillColor(COLORS.muted)
       .font("Helvetica")
       .text(label + ": ", 60, itemY, { continued: true })
       .fillColor(color || COLORS.dark)
       .font("Helvetica-Bold")
       .text(value);
    itemY += 18;
  });
  
  doc.y = startY + boxHeight + 15;
}

// ============================================================================
// REPORT GENERATORS
// ============================================================================

export async function generateDailyMarketSummaryPDF(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = createDocument();
    const chunks: Buffer[] = [];
    
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    
    // Header
    addHeader(doc, "Daily Market Summary", formatDate(data.date));
    
    // Executive Summary
    addSectionTitle(doc, "📊 Executive Summary");
    addKeyValuePairs(doc, [
      { label: "Total Price Updates", value: data.totalPrices.toString() },
      { label: "Unique Commodities", value: data.uniqueItems.toString() },
      { label: "Markets Covered", value: data.uniqueMarkets.toString() },
    ]);
    
    // Top Gainers
    if (data.topGainers?.length > 0) {
      addSectionTitle(doc, "📈 Top Price Increases");
      addTable(
        doc,
        ["Commodity", "Market", "Current Price", "Change", "% Change"],
        data.topGainers.slice(0, 10).map((g: any) => [
          g.item_name,
          g.market_name,
          formatCurrency(g.current_price),
          formatCurrency(g.change_amount),
          formatPercent(g.change_percent)
        ])
      );
    }
    
    // Top Losers
    if (data.topLosers?.length > 0) {
      addSectionTitle(doc, "📉 Top Price Decreases");
      addTable(
        doc,
        ["Commodity", "Market", "Current Price", "Change", "% Change"],
        data.topLosers.slice(0, 10).map((l: any) => [
          l.item_name,
          l.market_name,
          formatCurrency(l.current_price),
          formatCurrency(l.change_amount),
          formatPercent(l.change_percent)
        ])
      );
    }
    
    // Market Summary
    if (data.marketSummary?.length > 0) {
      doc.addPage();
      addHeader(doc, "Daily Market Summary", "Market Activity");
      addSectionTitle(doc, "🏪 Market Activity");
      addTable(
        doc,
        ["Market", "State", "Items", "Submissions", "Avg Price"],
        data.marketSummary.slice(0, 15).map((m: any) => [
          m.market_name,
          m.state,
          m.items_count.toString(),
          m.submissions_count.toString(),
          formatCurrency(Number(m.avg_price))
        ])
      );
    }
    
    // Category Breakdown
    if (data.categoryBreakdown?.length > 0) {
      addSectionTitle(doc, "📦 Category Breakdown");
      addTable(
        doc,
        ["Category", "Items", "Min Price", "Avg Price", "Max Price"],
        data.categoryBreakdown.map((c: any) => [
          c.category_name || "Other",
          c.items_count.toString(),
          formatCurrency(Number(c.min_price)),
          formatCurrency(Number(c.avg_price)),
          formatCurrency(Number(c.max_price))
        ])
      );
    }
    
    addFooter(doc, 1);
    doc.end();
  });
}

export async function generateWeeklyTrendPDF(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = createDocument();
    const chunks: Buffer[] = [];
    
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    
    // Header
    addHeader(doc, "Weekly Trend Analysis", `${formatDate(data.startDate)} - ${formatDate(data.endDate)}`);
    
    // Summary
    addSectionTitle(doc, "📊 Weekly Summary");
    addKeyValuePairs(doc, [
      { label: "Total Commodities Tracked", value: data.summary.totalItems.toString() },
      { label: "Prices Increasing", value: `${data.summary.upTrend} items` },
      { label: "Prices Decreasing", value: `${data.summary.downTrend} items` },
      { label: "Stable Prices", value: `${data.summary.stable} items` },
    ]);
    
    // Trends
    if (data.trends?.length > 0) {
      addSectionTitle(doc, "📈 Price Trends (Week-over-Week)");
      addTable(
        doc,
        ["Commodity", "This Week Avg", "Last Week Avg", "Change", "Trend"],
        data.trends.slice(0, 20).map((t: any) => [
          t.item_name,
          formatCurrency(t.this_week_avg),
          formatCurrency(t.last_week_avg),
          formatPercent(t.change_percent),
          t.trend
        ])
      );
    }
    
    // Volatility
    if (data.volatility?.length > 0) {
      doc.addPage();
      addHeader(doc, "Weekly Trend Analysis", "Price Volatility");
      addSectionTitle(doc, "⚡ Most Volatile Items");
      addTable(
        doc,
        ["Commodity", "Avg Price", "Std Deviation", "Volatility Index"],
        data.volatility.slice(0, 15).map((v: any) => [
          v.item_name,
          formatCurrency(Number(v.avg_price)),
          formatCurrency(Number(v.price_std) || 0),
          `${(Number(v.volatility_index) || 0).toFixed(2)}%`
        ])
      );
    }
    
    addFooter(doc, 1);
    doc.end();
  });
}

export async function generateMarketComparisonPDF(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = createDocument();
    const chunks: Buffer[] = [];
    
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    
    // Header
    addHeader(doc, "Market Comparison Report", `Generated: ${formatDateTime(data.generatedAt)}`);
    
    // Summary
    addSectionTitle(doc, "📊 Comparison Summary");
    addKeyValuePairs(doc, [
      { label: "Commodities Compared", value: data.totalItems.toString() },
      { label: "Markets Analyzed", value: data.totalMarkets.toString() },
      { label: "Average Price Spread", value: formatCurrency(data.summary.avgPriceSpread || 0) },
      { label: "Maximum Price Spread", value: formatCurrency(data.summary.maxPriceSpread || 0) },
    ]);
    
    // Comparison Table
    addSectionTitle(doc, "💰 Price Comparison by Commodity");
    
    data.comparisons.slice(0, 25).forEach((comp: any, index: number) => {
      if (doc.y > doc.page.height - 150) {
        doc.addPage();
        addHeader(doc, "Market Comparison Report", "Continued");
      }
      
      doc.fontSize(11)
         .fillColor(COLORS.primary)
         .font("Helvetica-Bold")
         .text(`${index + 1}. ${comp.item_name}`, 50, doc.y);
      
      doc.moveDown(0.3);
      
      doc.fontSize(9)
         .fillColor(COLORS.success)
         .font("Helvetica")
         .text(`✓ Cheapest: ${comp.cheapest.market} - ${formatCurrency(comp.cheapest.price)}`, 60, doc.y);
      
      doc.fontSize(9)
         .fillColor(COLORS.danger)
         .text(`✗ Most Expensive: ${comp.most_expensive.market} - ${formatCurrency(comp.most_expensive.price)}`, 60, doc.y);
      
      doc.fontSize(9)
         .fillColor(COLORS.muted)
         .text(`Price Spread: ${formatCurrency(comp.price_spread)} (${((comp.price_spread / comp.cheapest.price) * 100).toFixed(1)}%)`, 60, doc.y);
      
      doc.moveDown(0.8);
    });
    
    addFooter(doc, 1);
    doc.end();
  });
}

export async function generateArbitragePDF(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = createDocument();
    const chunks: Buffer[] = [];
    
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    
    // Header
    addHeader(doc, "Arbitrage Opportunities", `Generated: ${formatDateTime(data.generatedAt)}`);
    
    // Summary
    addSectionTitle(doc, "💰 Opportunity Summary");
    addKeyValuePairs(doc, [
      { label: "Total Opportunities Found", value: data.totalOpportunities.toString() },
      { label: "Average Profit Potential", value: formatPercent(data.summary.avgProfitPercent || 0) },
      { label: "Maximum Profit Potential", value: formatPercent(data.summary.maxProfitPercent || 0) },
    ]);
    
    // Disclaimer
    doc.fontSize(8)
       .fillColor(COLORS.warning)
       .font("Helvetica-Oblique")
       .text("⚠️ Note: Profit calculations do not include transportation costs, taxes, or market fees. Actual profits may vary.", 50, doc.y, { width: doc.page.width - 100 });
    doc.moveDown(1);
    
    // Opportunities Table
    addSectionTitle(doc, "📈 Top Arbitrage Opportunities");
    addTable(
      doc,
      ["Commodity", "Buy From", "Buy Price", "Sell To", "Sell Price", "Profit %"],
      data.opportunities.slice(0, 30).map((o: any) => [
        o.item_name,
        o.buy_market,
        formatCurrency(o.buy_price),
        o.sell_market,
        formatCurrency(o.sell_price),
        formatPercent(o.profit_percent)
      ])
    );
    
    addFooter(doc, 1);
    doc.end();
  });
}

export async function generateInflationPDF(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = createDocument();
    const chunks: Buffer[] = [];
    
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    
    // Header
    addHeader(doc, "Inflation Impact Report", `Period: ${formatDate(data.period.start)} - ${formatDate(data.period.end)}`);
    
    // Overall Inflation
    addSectionTitle(doc, "📊 Overall Inflation");
    
    const inflationColor = data.overallInflation > 0 ? COLORS.danger : COLORS.success;
    doc.fontSize(36)
       .fillColor(inflationColor)
       .font("Helvetica-Bold")
       .text(formatPercent(data.overallInflation || 0), 50, doc.y, { align: "center", width: doc.page.width - 100 });
    
    doc.fontSize(12)
       .fillColor(COLORS.muted)
       .font("Helvetica")
       .text("Month-over-Month Commodity Inflation", 50, doc.y, { align: "center", width: doc.page.width - 100 });
    
    doc.moveDown(1.5);
    
    // Category Inflation
    if (data.categoryRates?.length > 0) {
      addSectionTitle(doc, "📦 Inflation by Category");
      addTable(
        doc,
        ["Category", "Inflation Rate"],
        data.categoryRates.map((c: any) => [
          c.category,
          formatPercent(c.avg_inflation)
        ])
      );
    }
    
    // Item Inflation
    if (data.itemInflation?.length > 0) {
      doc.addPage();
      addHeader(doc, "Inflation Impact Report", "Item-Level Analysis");
      addSectionTitle(doc, "📈 Highest Price Increases");
      addTable(
        doc,
        ["Commodity", "Category", "Current Price", "Previous Price", "Inflation"],
        data.itemInflation.slice(0, 20).map((i: any) => [
          i.item_name,
          i.category_name || "Other",
          formatCurrency(i.current_price),
          formatCurrency(i.previous_price),
          formatPercent(i.inflation_rate)
        ])
      );
    }
    
    addFooter(doc, 1);
    doc.end();
  });
}

export async function generateSupplyChainPDF(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = createDocument();
    const chunks: Buffer[] = [];
    
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    
    // Header
    addHeader(doc, "Supply Chain Intelligence", `Period: ${formatDate(data.period.start)} - ${formatDate(data.period.end)}`);
    
    // Summary
    addSectionTitle(doc, "📊 Supply Overview");
    addKeyValuePairs(doc, [
      { label: "Total Items Tracked", value: data.summary.totalItems.toString() },
      { label: "Stable Supply", value: `${data.summary.stableSupply} items` },
      { label: "Increasing Supply", value: `${data.summary.increasingSupply} items` },
      { label: "Declining Supply", value: `${data.summary.decliningSupply} items` },
      { label: "Shortage Risk", value: `${data.summary.shortageRisk} items` },
    ]);
    
    // Shortage Warnings
    if (data.shortageWarnings?.length > 0) {
      addSectionTitle(doc, "⚠️ Shortage Warnings");
      
      doc.fontSize(9)
         .fillColor(COLORS.danger)
         .font("Helvetica-Oblique")
         .text("The following items show declining supply patterns and may face shortages:", 50, doc.y);
      doc.moveDown(0.5);
      
      addTable(
        doc,
        ["Commodity", "This Week", "Last Week", "Change", "Status"],
        data.shortageWarnings.slice(0, 20).map((w: any) => [
          w.item_name,
          w.this_week.toString(),
          w.last_week.toString(),
          formatPercent(w.change_percent),
          w.status
        ])
      );
    }
    
    // Supply Trends
    if (data.supplyTrends?.length > 0) {
      doc.addPage();
      addHeader(doc, "Supply Chain Intelligence", "Supply Trends");
      addSectionTitle(doc, "📈 All Supply Trends");
      addTable(
        doc,
        ["Commodity", "This Week", "Last Week", "Change", "Status"],
        data.supplyTrends.slice(0, 30).map((t: any) => [
          t.item_name,
          t.this_week.toString(),
          t.last_week.toString(),
          formatPercent(t.change_percent),
          t.status
        ])
      );
    }
    
    addFooter(doc, 1);
    doc.end();
  });
}

export async function generateCustomAnalyticsPDF(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = createDocument();
    const chunks: Buffer[] = [];
    
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    
    // Header
    addHeader(doc, "Custom Analytics Report", `Generated: ${formatDateTime(data.generatedAt)}`);
    
    // Parameters
    addSectionTitle(doc, "📋 Report Parameters");
    addKeyValuePairs(doc, [
      { label: "Date Range", value: `${formatDate(data.parameters.startDate)} - ${formatDate(data.parameters.endDate)}` },
      { label: "Items Filter", value: data.parameters.items?.join(", ") || "All Items" },
      { label: "Markets Filter", value: data.parameters.markets?.join(", ") || "All Markets" },
      { label: "Total Records", value: data.totalRecords.toString() },
    ]);
    
    // Item Analysis
    if (data.itemAnalysis?.length > 0) {
      addSectionTitle(doc, "📦 Analysis by Item");
      addTable(
        doc,
        ["Item", "Count", "Min", "Avg", "Max"],
        data.itemAnalysis.slice(0, 25).map((i: any) => [
          i.item,
          i.count.toString(),
          formatCurrency(i.min),
          formatCurrency(i.avg),
          formatCurrency(i.max)
        ])
      );
    }
    
    // Market Analysis
    if (data.marketAnalysis?.length > 0) {
      doc.addPage();
      addHeader(doc, "Custom Analytics Report", "Market Analysis");
      addSectionTitle(doc, "🏪 Analysis by Market");
      addTable(
        doc,
        ["Market", "Count", "Min", "Avg", "Max"],
        data.marketAnalysis.slice(0, 20).map((m: any) => [
          m.market,
          m.count.toString(),
          formatCurrency(m.min),
          formatCurrency(m.avg),
          formatCurrency(m.max)
        ])
      );
    }
    
    // Category Analysis
    if (data.categoryAnalysis?.length > 0) {
      addSectionTitle(doc, "📊 Analysis by Category");
      addTable(
        doc,
        ["Category", "Count", "Min", "Avg", "Max"],
        data.categoryAnalysis.map((c: any) => [
          c.category,
          c.count.toString(),
          formatCurrency(c.min),
          formatCurrency(c.avg),
          formatCurrency(c.max)
        ])
      );
    }
    
    addFooter(doc, 1);
    doc.end();
  });
}
