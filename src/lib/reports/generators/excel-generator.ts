// src/lib/reports/generators/excel-generator.ts
// NaijaMarket Intel - Server-side Excel Generator
// Uses ExcelJS for professional spreadsheet creation
// Updated: 2026-02-08

import ExcelJS from "exceljs";

// ============================================================================
// BRAND COLORS
// ============================================================================

const COLORS = {
  primary: "10B981",      // Emerald Green
  secondary: "F59E0B",    // Gold/Yellow
  dark: "1F2937",         // Dark Gray
  light: "F3F4F6",        // Light Gray
  white: "FFFFFF",
  success: "22C55E",
  danger: "EF4444",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// ============================================================================
// WORKSHEET STYLING
// ============================================================================

function styleHeader(worksheet: ExcelJS.Worksheet, title: string, subtitle?: string) {
  // Merge cells for header
  worksheet.mergeCells("A1:G1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `NaijaMarket Intel - ${title}`;
  titleCell.font = { size: 18, bold: true, color: { argb: COLORS.white } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.primary },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 35;

  if (subtitle) {
    worksheet.mergeCells("A2:G2");
    const subtitleCell = worksheet.getCell("A2");
    subtitleCell.value = subtitle;
    subtitleCell.font = { size: 11, italic: true, color: { argb: COLORS.dark } };
    subtitleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.light },
    };
    subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(2).height = 25;
  }

  // Add generation timestamp
  const timestampRow = subtitle ? 3 : 2;
  worksheet.mergeCells(`A${timestampRow}:G${timestampRow}`);
  const timestampCell = worksheet.getCell(`A${timestampRow}`);
  timestampCell.value = `Generated: ${new Date().toLocaleString("en-NG")}`;
  timestampCell.font = { size: 9, color: { argb: "6B7280" } };
  timestampCell.alignment = { horizontal: "right" };
}

function styleTableHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLORS.white } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.primary },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: COLORS.dark } },
      bottom: { style: "thin", color: { argb: COLORS.dark } },
      left: { style: "thin", color: { argb: COLORS.dark } },
      right: { style: "thin", color: { argb: COLORS.dark } },
    };
  });
  row.height = 25;
}

function styleDataRow(row: ExcelJS.Row, isAlternate: boolean) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isAlternate ? COLORS.light : COLORS.white },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "E5E7EB" } },
      bottom: { style: "thin", color: { argb: "E5E7EB" } },
      left: { style: "thin", color: { argb: "E5E7EB" } },
      right: { style: "thin", color: { argb: "E5E7EB" } },
    };
    cell.alignment = { vertical: "middle" };
  });
}

function autoFitColumns(worksheet: ExcelJS.Worksheet) {
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value?.toString() || "";
      maxLength = Math.max(maxLength, cellValue.length);
    });
    column.width = Math.min(Math.max(maxLength + 2, 10), 50);
  });
}

// ============================================================================
// EXCEL GENERATORS
// ============================================================================

export async function generateDailyMarketSummaryExcel(data: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NaijaMarket Intel";
  workbook.created = new Date();

  // Summary Sheet
  const summarySheet = workbook.addWorksheet("Summary");
  styleHeader(summarySheet, "Daily Market Summary", formatDate(data.date));
  
  summarySheet.addRow([]);
  summarySheet.addRow(["Metric", "Value"]);
  styleTableHeader(summarySheet.getRow(5));
  
  const summaryData = [
    ["Total Price Updates", data.totalPrices],
    ["Unique Commodities", data.uniqueItems],
    ["Markets Covered", data.uniqueMarkets],
  ];
  
  summaryData.forEach((row, index) => {
    const dataRow = summarySheet.addRow(row);
    styleDataRow(dataRow, index % 2 === 0);
  });

  // Top Gainers Sheet
  if (data.topGainers?.length > 0) {
    const gainersSheet = workbook.addWorksheet("Top Gainers");
    styleHeader(gainersSheet, "Top Price Increases");
    
    gainersSheet.addRow([]);
    const headerRow = gainersSheet.addRow(["Commodity", "Market", "Current Price", "Previous Price", "Change", "% Change"]);
    styleTableHeader(headerRow);
    
    data.topGainers.forEach((g: any, index: number) => {
      const row = gainersSheet.addRow([
        g.item_name,
        g.market_name,
        g.current_price,
        g.previous_price,
        g.change_amount,
        g.change_percent / 100,
      ]);
      styleDataRow(row, index % 2 === 0);
      
      // Format currency columns
      row.getCell(3).numFmt = '"₦"#,##0.00';
      row.getCell(4).numFmt = '"₦"#,##0.00';
      row.getCell(5).numFmt = '"₦"#,##0.00';
      row.getCell(6).numFmt = '0.00%';
    });
    
    autoFitColumns(gainersSheet);
  }

  // Top Losers Sheet
  if (data.topLosers?.length > 0) {
    const losersSheet = workbook.addWorksheet("Top Losers");
    styleHeader(losersSheet, "Top Price Decreases");
    
    losersSheet.addRow([]);
    const headerRow = losersSheet.addRow(["Commodity", "Market", "Current Price", "Previous Price", "Change", "% Change"]);
    styleTableHeader(headerRow);
    
    data.topLosers.forEach((l: any, index: number) => {
      const row = losersSheet.addRow([
        l.item_name,
        l.market_name,
        l.current_price,
        l.previous_price,
        l.change_amount,
        l.change_percent / 100,
      ]);
      styleDataRow(row, index % 2 === 0);
      
      row.getCell(3).numFmt = '"₦"#,##0.00';
      row.getCell(4).numFmt = '"₦"#,##0.00';
      row.getCell(5).numFmt = '"₦"#,##0.00';
      row.getCell(6).numFmt = '0.00%';
    });
    
    autoFitColumns(losersSheet);
  }

  // Market Summary Sheet
  if (data.marketSummary?.length > 0) {
    const marketSheet = workbook.addWorksheet("Market Summary");
    styleHeader(marketSheet, "Market Activity");
    
    marketSheet.addRow([]);
    const headerRow = marketSheet.addRow(["Market", "State", "Items", "Submissions", "Avg Price"]);
    styleTableHeader(headerRow);
    
    data.marketSummary.forEach((m: any, index: number) => {
      const row = marketSheet.addRow([
        m.market_name,
        m.state,
        m.items_count,
        m.submissions_count,
        Number(m.avg_price),
      ]);
      styleDataRow(row, index % 2 === 0);
      row.getCell(5).numFmt = '"₦"#,##0.00';
    });
    
    autoFitColumns(marketSheet);
  }

  autoFitColumns(summarySheet);
  
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function generateWeeklyTrendExcel(data: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NaijaMarket Intel";

  // Summary Sheet
  const summarySheet = workbook.addWorksheet("Summary");
  styleHeader(summarySheet, "Weekly Trend Analysis", `${formatDate(data.startDate)} - ${formatDate(data.endDate)}`);
  
  summarySheet.addRow([]);
  summarySheet.addRow(["Metric", "Value"]);
  styleTableHeader(summarySheet.getRow(5));
  
  const summaryData = [
    ["Total Items Tracked", data.summary.totalItems],
    ["Prices Increasing", data.summary.upTrend],
    ["Prices Decreasing", data.summary.downTrend],
    ["Stable Prices", data.summary.stable],
  ];
  
  summaryData.forEach((row, index) => {
    const dataRow = summarySheet.addRow(row);
    styleDataRow(dataRow, index % 2 === 0);
  });

  // Trends Sheet
  if (data.trends?.length > 0) {
    const trendsSheet = workbook.addWorksheet("Price Trends");
    styleHeader(trendsSheet, "Week-over-Week Trends");
    
    trendsSheet.addRow([]);
    const headerRow = trendsSheet.addRow(["Commodity", "This Week Avg", "Last Week Avg", "Change", "% Change", "Trend"]);
    styleTableHeader(headerRow);
    
    data.trends.forEach((t: any, index: number) => {
      const row = trendsSheet.addRow([
        t.item_name,
        t.this_week_avg,
        t.last_week_avg,
        t.change_amount,
        t.change_percent / 100,
        t.trend,
      ]);
      styleDataRow(row, index % 2 === 0);
      
      row.getCell(2).numFmt = '"₦"#,##0.00';
      row.getCell(3).numFmt = '"₦"#,##0.00';
      row.getCell(4).numFmt = '"₦"#,##0.00';
      row.getCell(5).numFmt = '0.00%';
    });
    
    autoFitColumns(trendsSheet);
  }

  // Volatility Sheet
  if (data.volatility?.length > 0) {
    const volSheet = workbook.addWorksheet("Volatility");
    styleHeader(volSheet, "Price Volatility");
    
    volSheet.addRow([]);
    const headerRow = volSheet.addRow(["Commodity", "Avg Price", "Std Deviation", "Volatility Index"]);
    styleTableHeader(headerRow);
    
    data.volatility.forEach((v: any, index: number) => {
      const row = volSheet.addRow([
        v.item_name,
        Number(v.avg_price),
        Number(v.price_std) || 0,
        (Number(v.volatility_index) || 0) / 100,
      ]);
      styleDataRow(row, index % 2 === 0);
      
      row.getCell(2).numFmt = '"₦"#,##0.00';
      row.getCell(3).numFmt = '"₦"#,##0.00';
      row.getCell(4).numFmt = '0.00%';
    });
    
    autoFitColumns(volSheet);
  }

  autoFitColumns(summarySheet);
  
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function generateMarketComparisonExcel(data: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NaijaMarket Intel";

  // Summary Sheet
  const summarySheet = workbook.addWorksheet("Summary");
  styleHeader(summarySheet, "Market Comparison Report");
  
  summarySheet.addRow([]);
  summarySheet.addRow(["Metric", "Value"]);
  styleTableHeader(summarySheet.getRow(5));
  
  const summaryData = [
    ["Commodities Compared", data.totalItems],
    ["Markets Analyzed", data.totalMarkets],
    ["Avg Price Spread", formatCurrency(data.summary.avgPriceSpread || 0)],
    ["Max Price Spread", formatCurrency(data.summary.maxPriceSpread || 0)],
  ];
  
  summaryData.forEach((row, index) => {
    const dataRow = summarySheet.addRow(row);
    styleDataRow(dataRow, index % 2 === 0);
  });

  // Comparison Sheet
  const compSheet = workbook.addWorksheet("Price Comparison");
  styleHeader(compSheet, "Price Comparison by Commodity");
  
  compSheet.addRow([]);
  const headerRow = compSheet.addRow(["Commodity", "Cheapest Market", "Cheapest Price", "Most Expensive Market", "Most Expensive Price", "Price Spread", "Spread %"]);
  styleTableHeader(headerRow);
  
  data.comparisons.forEach((c: any, index: number) => {
    const spreadPercent = c.cheapest.price > 0 ? (c.price_spread / c.cheapest.price) : 0;
    const row = compSheet.addRow([
      c.item_name,
      c.cheapest.market,
      c.cheapest.price,
      c.most_expensive.market,
      c.most_expensive.price,
      c.price_spread,
      spreadPercent,
    ]);
    styleDataRow(row, index % 2 === 0);
    
    row.getCell(3).numFmt = '"₦"#,##0.00';
    row.getCell(5).numFmt = '"₦"#,##0.00';
    row.getCell(6).numFmt = '"₦"#,##0.00';
    row.getCell(7).numFmt = '0.00%';
  });
  
  autoFitColumns(summarySheet);
  autoFitColumns(compSheet);
  
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function generateArbitrageExcel(data: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NaijaMarket Intel";

  const sheet = workbook.addWorksheet("Arbitrage Opportunities");
  styleHeader(sheet, "Arbitrage Opportunities");
  
  sheet.addRow([]);
  const headerRow = sheet.addRow(["Commodity", "Buy From", "Buy Price", "Sell To", "Sell Price", "Profit Margin", "Profit %"]);
  styleTableHeader(headerRow);
  
  data.opportunities.forEach((o: any, index: number) => {
    const row = sheet.addRow([
      o.item_name,
      o.buy_market,
      o.buy_price,
      o.sell_market,
      o.sell_price,
      o.profit_margin,
      o.profit_percent / 100,
    ]);
    styleDataRow(row, index % 2 === 0);
    
    row.getCell(3).numFmt = '"₦"#,##0.00';
    row.getCell(5).numFmt = '"₦"#,##0.00';
    row.getCell(6).numFmt = '"₦"#,##0.00';
    row.getCell(7).numFmt = '0.00%';
  });
  
  autoFitColumns(sheet);
  
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function generateInflationExcel(data: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NaijaMarket Intel";

  // Summary Sheet
  const summarySheet = workbook.addWorksheet("Summary");
  styleHeader(summarySheet, "Inflation Impact Report", `${formatDate(data.period.start)} - ${formatDate(data.period.end)}`);
  
  summarySheet.addRow([]);
  summarySheet.addRow(["Overall Inflation Rate"]);
  summarySheet.addRow([data.overallInflation / 100]);
  summarySheet.getCell("A8").numFmt = '0.00%';
  summarySheet.getCell("A8").font = { size: 24, bold: true, color: { argb: data.overallInflation > 0 ? COLORS.danger : COLORS.success } };

  // Category Inflation Sheet
  if (data.categoryRates?.length > 0) {
    const catSheet = workbook.addWorksheet("By Category");
    styleHeader(catSheet, "Inflation by Category");
    
    catSheet.addRow([]);
    const headerRow = catSheet.addRow(["Category", "Inflation Rate"]);
    styleTableHeader(headerRow);
    
    data.categoryRates.forEach((c: any, index: number) => {
      const row = catSheet.addRow([c.category, c.avg_inflation / 100]);
      styleDataRow(row, index % 2 === 0);
      row.getCell(2).numFmt = '0.00%';
    });
    
    autoFitColumns(catSheet);
  }

  // Item Inflation Sheet
  if (data.itemInflation?.length > 0) {
    const itemSheet = workbook.addWorksheet("By Item");
    styleHeader(itemSheet, "Inflation by Item");
    
    itemSheet.addRow([]);
    const headerRow = itemSheet.addRow(["Commodity", "Category", "Current Price", "Previous Price", "Inflation"]);
    styleTableHeader(headerRow);
    
    data.itemInflation.forEach((i: any, index: number) => {
      const row = itemSheet.addRow([
        i.item_name,
        i.category_name || "Other",
        i.current_price,
        i.previous_price,
        i.inflation_rate / 100,
      ]);
      styleDataRow(row, index % 2 === 0);
      
      row.getCell(3).numFmt = '"₦"#,##0.00';
      row.getCell(4).numFmt = '"₦"#,##0.00';
      row.getCell(5).numFmt = '0.00%';
    });
    
    autoFitColumns(itemSheet);
  }

  autoFitColumns(summarySheet);
  
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function generateSupplyChainExcel(data: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NaijaMarket Intel";

  // Summary Sheet
  const summarySheet = workbook.addWorksheet("Summary");
  styleHeader(summarySheet, "Supply Chain Intelligence");
  
  summarySheet.addRow([]);
  summarySheet.addRow(["Metric", "Value"]);
  styleTableHeader(summarySheet.getRow(5));
  
  const summaryData = [
    ["Total Items Tracked", data.summary.totalItems],
    ["Stable Supply", data.summary.stableSupply],
    ["Increasing Supply", data.summary.increasingSupply],
    ["Declining Supply", data.summary.decliningSupply],
    ["Shortage Risk", data.summary.shortageRisk],
  ];
  
  summaryData.forEach((row, index) => {
    const dataRow = summarySheet.addRow(row);
    styleDataRow(dataRow, index % 2 === 0);
  });

  // Shortage Warnings Sheet
  if (data.shortageWarnings?.length > 0) {
    const warnSheet = workbook.addWorksheet("Shortage Warnings");
    styleHeader(warnSheet, "Shortage Warnings");
    
    warnSheet.addRow([]);
    const headerRow = warnSheet.addRow(["Commodity", "This Week", "Last Week", "Change", "Status"]);
    styleTableHeader(headerRow);
    
    data.shortageWarnings.forEach((w: any, index: number) => {
      const row = warnSheet.addRow([
        w.item_name,
        w.this_week,
        w.last_week,
        w.change_percent / 100,
        w.status,
      ]);
      styleDataRow(row, index % 2 === 0);
      row.getCell(4).numFmt = '0.00%';
    });
    
    autoFitColumns(warnSheet);
  }

  // All Trends Sheet
  if (data.supplyTrends?.length > 0) {
    const trendsSheet = workbook.addWorksheet("All Trends");
    styleHeader(trendsSheet, "Supply Trends");
    
    trendsSheet.addRow([]);
    const headerRow = trendsSheet.addRow(["Commodity", "This Week", "Last Week", "Change", "Status"]);
    styleTableHeader(headerRow);
    
    data.supplyTrends.forEach((t: any, index: number) => {
      const row = trendsSheet.addRow([
        t.item_name,
        t.this_week,
        t.last_week,
        t.change_percent / 100,
        t.status,
      ]);
      styleDataRow(row, index % 2 === 0);
      row.getCell(4).numFmt = '0.00%';
    });
    
    autoFitColumns(trendsSheet);
  }

  autoFitColumns(summarySheet);
  
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function generateCustomAnalyticsExcel(data: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NaijaMarket Intel";

  // Raw Data Sheet
  const rawSheet = workbook.addWorksheet("Raw Data");
  styleHeader(rawSheet, "Custom Analytics - Raw Data");
  
  rawSheet.addRow([]);
  const headerRow = rawSheet.addRow(["Item", "Brand", "Market", "State", "Category", "Price", "Unit", "Date"]);
  styleTableHeader(headerRow);
  
  data.rawData.forEach((r: any, index: number) => {
    const row = rawSheet.addRow([
      r.item_name,
      r.brand_name || "-",
      r.market_name,
      r.state,
      r.category_name,
      Number(r.price),
      r.unit,
      new Date(r.validated_at),
    ]);
    styleDataRow(row, index % 2 === 0);
    row.getCell(6).numFmt = '"₦"#,##0.00';
    row.getCell(8).numFmt = 'yyyy-mm-dd';
  });

  // Item Analysis Sheet
  if (data.itemAnalysis?.length > 0) {
    const itemSheet = workbook.addWorksheet("By Item");
    styleHeader(itemSheet, "Analysis by Item");
    
    itemSheet.addRow([]);
    const hRow = itemSheet.addRow(["Item", "Count", "Min", "Avg", "Max", "Median"]);
    styleTableHeader(hRow);
    
    data.itemAnalysis.forEach((i: any, index: number) => {
      const row = itemSheet.addRow([i.item, i.count, i.min, i.avg, i.max, i.median]);
      styleDataRow(row, index % 2 === 0);
      row.getCell(3).numFmt = '"₦"#,##0.00';
      row.getCell(4).numFmt = '"₦"#,##0.00';
      row.getCell(5).numFmt = '"₦"#,##0.00';
      row.getCell(6).numFmt = '"₦"#,##0.00';
    });
    
    autoFitColumns(itemSheet);
  }

  // Market Analysis Sheet
  if (data.marketAnalysis?.length > 0) {
    const mktSheet = workbook.addWorksheet("By Market");
    styleHeader(mktSheet, "Analysis by Market");
    
    mktSheet.addRow([]);
    const hRow = mktSheet.addRow(["Market", "Count", "Min", "Avg", "Max", "Median"]);
    styleTableHeader(hRow);
    
    data.marketAnalysis.forEach((m: any, index: number) => {
      const row = mktSheet.addRow([m.market, m.count, m.min, m.avg, m.max, m.median]);
      styleDataRow(row, index % 2 === 0);
      row.getCell(3).numFmt = '"₦"#,##0.00';
      row.getCell(4).numFmt = '"₦"#,##0.00';
      row.getCell(5).numFmt = '"₦"#,##0.00';
      row.getCell(6).numFmt = '"₦"#,##0.00';
    });
    
    autoFitColumns(mktSheet);
  }

  autoFitColumns(rawSheet);
  
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
