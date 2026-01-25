// ============================================================================
// src/app/api/reports/[id]/route.ts
// NaijaMarket Intel - Report Download API
// Version: 1.0.0
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ReportMetrics {
  totalItems: number;
  totalMarkets: number;
  priceChanges: {
    increases: number;
    decreases: number;
    unchanged: number;
  };
  topGainers: PriceMovement[];
  topLosers: PriceMovement[];
  categoryBreakdown: CategoryMetric[];
  regionalData: RegionalMetric[];
  nfpiIndex: NFPIData;
  nbsComparison?: NBSComparison;
}

interface PriceMovement {
  item: string;
  market: string;
  state: string;
  currentPrice: number;
  previousPrice: number;
  changePercent: number;
  changeAmount: number;
}

interface CategoryMetric {
  category: string;
  avgPrice: number;
  avgChange: number;
  itemCount: number;
  trend: "up" | "down" | "stable";
}

interface RegionalMetric {
  region: string;
  states: string[];
  avgInflation: number;
  topItem: string;
  marketCount: number;
}

interface NFPIData {
  currentValue: number;
  previousValue: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  basketItems: Array<{
    item: string;
    weight: number;
    price: number;
    change: number;
  }>;
}

interface NBSComparison {
  naijaMarketInflation: number;
  nbsOfficialInflation: number;
  difference: number;
  insight: string;
}

interface GeneratedReport {
  id: string;
  type: string;
  title: string;
  generatedAt: string;
  expiresAt: string;
  format: string;
  sections: string[];
  metrics: ReportMetrics;
}

// ============================================================================
// TIER ACCESS
// ============================================================================

const TIER_ACCESS: Record<string, number> = {
  FREE: 0,
  SILVER: 0,
  GOLD: 0,
  BUSINESS: 10,
  CORPORATE: 999,
  ENTERPRISE: 999,
};

function canAccessReports(tier: string): boolean {
  return (TIER_ACCESS[tier.toUpperCase()] ?? 0) > 0;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

// ============================================================================
// HTML REPORT GENERATOR
// ============================================================================

function generateHTMLReport(report: GeneratedReport): string {
  const { title, generatedAt, metrics } = report;
  const generatedDate = new Date(generatedAt).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - NaijaMarket Intel</title>
  <style>
    :root {
      --bg-primary: #0a0a0a;
      --bg-secondary: #141414;
      --bg-tertiary: #1a1a1a;
      --border-color: #2a2a2a;
      --text-primary: #ffffff;
      --text-secondary: #a0a0a0;
      --text-muted: #666666;
      --naija-green: #00A36C;
      --naija-gold: #FFD700;
      --price-up: #EF4444;
      --price-down: #22C55E;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 40px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid var(--naija-green);
    }
    
    .logo {
      font-size: 28px;
      font-weight: 700;
      color: var(--naija-green);
      margin-bottom: 10px;
    }
    
    .logo span {
      color: var(--naija-gold);
    }
    
    h1 {
      font-size: 24px;
      margin-bottom: 10px;
    }
    
    .report-meta {
      color: var(--text-secondary);
      font-size: 14px;
    }
    
    .section {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--naija-green);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .metric-card {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    
    .metric-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--naija-gold);
    }
    
    .metric-label {
      font-size: 12px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }
    
    th {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    tr:hover {
      background: var(--bg-tertiary);
    }
    
    .price-up {
      color: var(--price-up);
    }
    
    .price-down {
      color: var(--price-down);
    }
    
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .badge-up {
      background: rgba(239, 68, 68, 0.2);
      color: var(--price-up);
    }
    
    .badge-down {
      background: rgba(34, 197, 94, 0.2);
      color: var(--price-down);
    }
    
    .nbs-comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 16px;
    }
    
    .nbs-card {
      background: var(--bg-tertiary);
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    
    .nbs-value {
      font-size: 36px;
      font-weight: 700;
    }
    
    .nbs-label {
      color: var(--text-secondary);
      font-size: 14px;
    }
    
    .insight-box {
      background: var(--bg-tertiary);
      border-left: 4px solid var(--naija-gold);
      padding: 16px;
      border-radius: 0 8px 8px 0;
    }
    
    .regional-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    
    .region-card {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
    }
    
    .region-name {
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .region-stat {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }
    
    footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--border-color);
      color: var(--text-muted);
      font-size: 12px;
    }
    
    @media print {
      body {
        background: white;
        color: black;
        padding: 20px;
      }
      
      .section {
        background: white;
        border: 1px solid #ddd;
        break-inside: avoid;
      }
      
      .metric-card, .nbs-card, .region-card {
        background: #f5f5f5;
      }
      
      th {
        background: #f0f0f0;
      }
      
      .metric-value, .nbs-value {
        color: #00A36C;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">Naija<span>Market</span> Intel</div>
      <h1>${title}</h1>
      <p class="report-meta">Generated on ${generatedDate} | The Bloomberg of Nigerian Commodities</p>
    </header>
    
    <!-- Executive Summary -->
    <div class="section">
      <h2 class="section-title">📊 Executive Summary</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value">${metrics.totalItems}</div>
          <div class="metric-label">Items Tracked</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${metrics.totalMarkets}</div>
          <div class="metric-label">Markets Covered</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${metrics.priceChanges.increases}</div>
          <div class="metric-label">Price Increases</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${metrics.priceChanges.decreases}</div>
          <div class="metric-label">Price Decreases</div>
        </div>
      </div>
    </div>
    
    <!-- NFPI Index -->
    <div class="section">
      <h2 class="section-title">📈 NFPI Index (NaijaFood Price Index)</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value">${metrics.nfpiIndex.currentValue.toFixed(1)}</div>
          <div class="metric-label">Current Value</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${metrics.nfpiIndex.previousValue}</div>
          <div class="metric-label">Base Value</div>
        </div>
        <div class="metric-card">
          <div class="metric-value ${metrics.nfpiIndex.changePercent >= 0 ? 'price-up' : 'price-down'}">${formatPercent(metrics.nfpiIndex.changePercent)}</div>
          <div class="metric-label">Change</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${metrics.nfpiIndex.basketItems.length}</div>
          <div class="metric-label">Basket Items</div>
        </div>
      </div>
    </div>
    
    ${metrics.nbsComparison ? `
    <!-- NBS Comparison -->
    <div class="section">
      <h2 class="section-title">📉 NBS Comparison</h2>
      <div class="nbs-comparison">
        <div class="nbs-card">
          <div class="nbs-value" style="color: #FF6B35">${metrics.nbsComparison.naijaMarketInflation.toFixed(1)}%</div>
          <div class="nbs-label">NaijaMarket Data</div>
        </div>
        <div class="nbs-card">
          <div class="nbs-value" style="color: #3B82F6">${metrics.nbsComparison.nbsOfficialInflation.toFixed(1)}%</div>
          <div class="nbs-label">NBS Official</div>
        </div>
      </div>
      <div class="insight-box">
        <strong>💡 Insight:</strong> ${metrics.nbsComparison.insight}
      </div>
    </div>
    ` : ""}
    
    <!-- Top Gainers -->
    <div class="section">
      <h2 class="section-title">🔥 Top 10 Price Increases</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>Market</th>
            <th>State</th>
            <th>Current Price</th>
            <th>Previous Price</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.topGainers.map((item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${item.item}</strong></td>
            <td>${item.market}</td>
            <td>${item.state}</td>
            <td>${formatCurrency(item.currentPrice)}</td>
            <td>${formatCurrency(item.previousPrice)}</td>
            <td><span class="badge badge-up">${formatPercent(item.changePercent)}</span></td>
          </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    
    <!-- Top Losers -->
    <div class="section">
      <h2 class="section-title">📉 Top 10 Price Decreases</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>Market</th>
            <th>State</th>
            <th>Current Price</th>
            <th>Previous Price</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.topLosers.map((item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${item.item}</strong></td>
            <td>${item.market}</td>
            <td>${item.state}</td>
            <td>${formatCurrency(item.currentPrice)}</td>
            <td>${formatCurrency(item.previousPrice)}</td>
            <td><span class="badge badge-down">${formatPercent(item.changePercent)}</span></td>
          </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    
    <!-- Category Breakdown -->
    <div class="section">
      <h2 class="section-title">📦 Category Breakdown</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Avg Price</th>
            <th>Avg Change</th>
            <th>Items</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.categoryBreakdown.map(cat => `
          <tr>
            <td><strong>${cat.category}</strong></td>
            <td>${formatCurrency(cat.avgPrice)}</td>
            <td class="${cat.avgChange >= 0 ? 'price-up' : 'price-down'}">${formatPercent(cat.avgChange)}</td>
            <td>${cat.itemCount}</td>
            <td>${cat.trend === "up" ? "📈" : cat.trend === "down" ? "📉" : "➡️"}</td>
          </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    
    <!-- Regional Data -->
    <div class="section">
      <h2 class="section-title">🗺️ Regional Breakdown</h2>
      <div class="regional-grid">
        ${metrics.regionalData.map(region => `
        <div class="region-card">
          <div class="region-name">${region.region}</div>
          <div class="region-stat">
            <span>Avg Inflation:</span>
            <span class="${region.avgInflation >= 0 ? 'price-up' : 'price-down'}">${formatPercent(region.avgInflation)}</span>
          </div>
          <div class="region-stat">
            <span>Markets:</span>
            <span>${region.marketCount}</span>
          </div>
          <div class="region-stat">
            <span>Top Item:</span>
            <span>${region.topItem}</span>
          </div>
        </div>
        `).join("")}
      </div>
    </div>
    
    <!-- Methodology -->
    <div class="section">
      <h2 class="section-title">📋 Methodology Notes</h2>
      <ul style="margin-left: 20px; color: var(--text-secondary);">
        <li>Data collected from ${metrics.totalMarkets} markets across all 36 states + FCT</li>
        <li>Prices validated through community consensus (3+ validators per submission)</li>
        <li>GPS verification ensures submissions are from actual market locations</li>
        <li>NFPI basket weighted based on Nigerian household consumption patterns</li>
        <li>NBS comparison uses official National Bureau of Statistics data</li>
      </ul>
    </div>
    
    <footer>
      <p>© ${new Date().getFullYear()} NaijaMarket Intel | The Bloomberg of Nigerian Commodities</p>
      <p>This report is confidential and intended for the recipient only.</p>
      <p>Visit: naijamarket-web.vercel.app</p>
    </footer>
  </div>
</body>
</html>`;
}

// ============================================================================
// EXCEL/CSV GENERATOR
// ============================================================================

function generateExcelCSV(report: GeneratedReport): string {
  const { metrics } = report;
  let csv = "";

  // Header
  csv += "NaijaMarket Intel - Market Intelligence Report\n";
  csv += `Report: ${report.title}\n`;
  csv += `Generated: ${new Date(report.generatedAt).toLocaleDateString("en-GB")}\n\n`;

  // Summary
  csv += "EXECUTIVE SUMMARY\n";
  csv += "Metric,Value\n";
  csv += `Total Items,${metrics.totalItems}\n`;
  csv += `Total Markets,${metrics.totalMarkets}\n`;
  csv += `Price Increases,${metrics.priceChanges.increases}\n`;
  csv += `Price Decreases,${metrics.priceChanges.decreases}\n`;
  csv += `Unchanged,${metrics.priceChanges.unchanged}\n\n`;

  // NFPI
  csv += "NFPI INDEX\n";
  csv += "Metric,Value\n";
  csv += `Current Value,${metrics.nfpiIndex.currentValue}\n`;
  csv += `Previous Value,${metrics.nfpiIndex.previousValue}\n`;
  csv += `Change %,${metrics.nfpiIndex.changePercent}\n\n`;

  // NBS Comparison
  if (metrics.nbsComparison) {
    csv += "NBS COMPARISON\n";
    csv += "Metric,Value\n";
    csv += `NaijaMarket Inflation,${metrics.nbsComparison.naijaMarketInflation}%\n`;
    csv += `NBS Official,${metrics.nbsComparison.nbsOfficialInflation}%\n`;
    csv += `Difference,${metrics.nbsComparison.difference}%\n\n`;
  }

  // Top Gainers
  csv += "TOP 10 PRICE INCREASES\n";
  csv += "Rank,Item,Market,State,Current Price (NGN),Previous Price (NGN),Change %,Change Amount (NGN)\n";
  metrics.topGainers.forEach((item, idx) => {
    csv += `${idx + 1},${item.item},${item.market},${item.state},${item.currentPrice},${item.previousPrice},${item.changePercent.toFixed(1)},${item.changeAmount}\n`;
  });
  csv += "\n";

  // Top Losers
  csv += "TOP 10 PRICE DECREASES\n";
  csv += "Rank,Item,Market,State,Current Price (NGN),Previous Price (NGN),Change %,Change Amount (NGN)\n";
  metrics.topLosers.forEach((item, idx) => {
    csv += `${idx + 1},${item.item},${item.market},${item.state},${item.currentPrice},${item.previousPrice},${item.changePercent.toFixed(1)},${item.changeAmount}\n`;
  });
  csv += "\n";

  // Category Breakdown
  csv += "CATEGORY BREAKDOWN\n";
  csv += "Category,Avg Price (NGN),Avg Change %,Item Count,Trend\n";
  metrics.categoryBreakdown.forEach(cat => {
    csv += `${cat.category},${cat.avgPrice},${cat.avgChange.toFixed(1)},${cat.itemCount},${cat.trend}\n`;
  });
  csv += "\n";

  // Regional Data
  csv += "REGIONAL BREAKDOWN\n";
  csv += "Region,Avg Inflation %,Market Count,Top Item,States\n";
  metrics.regionalData.forEach(region => {
    csv += `${region.region},${region.avgInflation.toFixed(1)},${region.marketCount},${region.topItem},"${region.states.join(", ")}"\n`;
  });
  csv += "\n";

  // NFPI Basket
  csv += "NFPI BASKET COMPOSITION\n";
  csv += "Item,Weight %,Price (NGN),Change %\n";
  metrics.nfpiIndex.basketItems.forEach(item => {
    csv += `${item.item},${item.weight},${item.price},${item.change.toFixed(1)}\n`;
  });

  return csv;
}

// ============================================================================
// PDF GENERATOR (Returns HTML for client-side PDF generation)
// ============================================================================

function generatePDFData(report: GeneratedReport): object {
  return {
    title: report.title,
    generatedAt: report.generatedAt,
    sections: report.sections,
    metrics: report.metrics,
    pdfInstructions: {
      message: "Use jsPDF + html2canvas on client-side to generate PDF",
      htmlContent: generateHTMLReport(report),
    },
  };
}

// ============================================================================
// GET - Download specific report
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession();
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format") || "html";

  // Get user tier
  const userTier = ((session?.user as { tier?: string })?.tier || "FREE").toUpperCase();

  // Check access
  if (!canAccessReports(userTier)) {
    return NextResponse.json({
      success: false,
      error: "Reports require BUSINESS tier or higher",
      currentTier: userTier,
      requiredTier: "BUSINESS",
      upgradeUrl: "/subscribe",
    }, { status: 403 });
  }

  // TODO: Fetch report from database using id
  // For now, generate demo report
  const demoReport: GeneratedReport = {
    id,
    type: "weekly",
    title: `Weekly Market Summary - ${new Date().toLocaleDateString("en-GB")}`,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    format,
    sections: [
      "Executive Summary",
      "Key Metrics Dashboard",
      "Top 10 Price Increases",
      "Top 10 Price Decreases",
      "Category Breakdown",
      "Regional Heatmap",
      "NBS Comparison",
      "NFPI Index Trend",
      "Methodology Notes",
    ],
    metrics: generateDemoMetrics(),
  };

  // Return based on format
  switch (format) {
    case "html": {
      const htmlContent = generateHTMLReport(demoReport);
      return new NextResponse(htmlContent, {
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": `inline; filename="NaijaMarket-Report-${id}.html"`,
        },
      });
    }

    case "excel":
    case "csv": {
      const csvContent = generateExcelCSV(demoReport);
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="NaijaMarket-Report-${id}.csv"`,
        },
      });
    }

    case "pdf": {
      // Return JSON with HTML for client-side PDF generation
      const pdfData = generatePDFData(demoReport);
      return NextResponse.json({
        success: true,
        report: demoReport,
        pdfData,
        message: "Use the htmlContent with jsPDF + html2canvas to generate PDF on client-side",
      });
    }

    default:
      return NextResponse.json({
        success: false,
        error: "Invalid format. Use: html, excel, csv, or pdf",
      }, { status: 400 });
  }
}

// ============================================================================
// DEMO DATA GENERATOR
// ============================================================================

function generateDemoMetrics(): ReportMetrics {
  return {
    totalItems: 50,
    totalMarkets: 226,
    priceChanges: {
      increases: 35,
      decreases: 12,
      unchanged: 3,
    },
    topGainers: [
      { item: "Tomatoes (basket)", market: "Mile 12", state: "Lagos", currentPrice: 85000, previousPrice: 65000, changePercent: 30.8, changeAmount: 20000 },
      { item: "Palm Oil (25L)", market: "Onitsha Main", state: "Anambra", currentPrice: 52000, previousPrice: 42000, changePercent: 23.8, changeAmount: 10000 },
      { item: "Onions (bag)", market: "Kano Main", state: "Kano", currentPrice: 48000, previousPrice: 40000, changePercent: 20.0, changeAmount: 8000 },
      { item: "Rice (50kg)", market: "Iddo", state: "Lagos", currentPrice: 78500, previousPrice: 68000, changePercent: 15.4, changeAmount: 10500 },
      { item: "Beans (50kg)", market: "Ariaria", state: "Abia", currentPrice: 95000, previousPrice: 85000, changePercent: 11.8, changeAmount: 10000 },
      { item: "Groundnut Oil (25L)", market: "Wuse", state: "Abuja", currentPrice: 45000, previousPrice: 41000, changePercent: 9.8, changeAmount: 4000 },
      { item: "Yam (tuber)", market: "Jos Main", state: "Plateau", currentPrice: 3500, previousPrice: 3200, changePercent: 9.4, changeAmount: 300 },
      { item: "Garri (50kg)", market: "Alaba", state: "Lagos", currentPrice: 42000, previousPrice: 39000, changePercent: 7.7, changeAmount: 3000 },
      { item: "Pepper (basket)", market: "Mile 12", state: "Lagos", currentPrice: 65000, previousPrice: 61000, changePercent: 6.6, changeAmount: 4000 },
      { item: "Chicken (kg)", market: "Onitsha Main", state: "Anambra", currentPrice: 5200, previousPrice: 4900, changePercent: 6.1, changeAmount: 300 },
    ],
    topLosers: [
      { item: "Maize (100kg)", market: "Kano Main", state: "Kano", currentPrice: 55000, previousPrice: 62000, changePercent: -11.3, changeAmount: -7000 },
      { item: "Millet (100kg)", market: "Jos Main", state: "Plateau", currentPrice: 48000, previousPrice: 52000, changePercent: -7.7, changeAmount: -4000 },
      { item: "Cassava (bag)", market: "Iddo", state: "Lagos", currentPrice: 25000, previousPrice: 27000, changePercent: -7.4, changeAmount: -2000 },
      { item: "Plantain (bunch)", market: "Mile 12", state: "Lagos", currentPrice: 4500, previousPrice: 4800, changePercent: -6.3, changeAmount: -300 },
      { item: "Sweet Potato (bag)", market: "Wuse", state: "Abuja", currentPrice: 32000, previousPrice: 34000, changePercent: -5.9, changeAmount: -2000 },
      { item: "Cocoyam (bag)", market: "Onitsha Main", state: "Anambra", currentPrice: 28000, previousPrice: 29500, changePercent: -5.1, changeAmount: -1500 },
      { item: "Sorghum (100kg)", market: "Kano Main", state: "Kano", currentPrice: 45000, previousPrice: 47000, changePercent: -4.3, changeAmount: -2000 },
      { item: "Soybeans (bag)", market: "Jos Main", state: "Plateau", currentPrice: 68000, previousPrice: 70000, changePercent: -2.9, changeAmount: -2000 },
      { item: "Wheat (bag)", market: "Ariaria", state: "Abia", currentPrice: 58000, previousPrice: 59500, changePercent: -2.5, changeAmount: -1500 },
      { item: "Cowpeas (bag)", market: "Alaba", state: "Lagos", currentPrice: 72000, previousPrice: 73500, changePercent: -2.0, changeAmount: -1500 },
    ],
    categoryBreakdown: [
      { category: "Vegetables & Produce", avgPrice: 65000, avgChange: 18.5, itemCount: 8, trend: "up" },
      { category: "Oils & Fats", avgPrice: 48000, avgChange: 15.2, itemCount: 4, trend: "up" },
      { category: "Staple Foods & Grains", avgPrice: 72000, avgChange: 12.8, itemCount: 12, trend: "up" },
      { category: "Proteins & Meat", avgPrice: 5500, avgChange: 8.5, itemCount: 6, trend: "up" },
      { category: "Roots & Tubers", avgPrice: 28000, avgChange: -3.2, itemCount: 5, trend: "down" },
      { category: "Legumes & Pulses", avgPrice: 85000, avgChange: 6.5, itemCount: 4, trend: "up" },
    ],
    regionalData: [
      { region: "South-West", states: ["Lagos", "Oyo", "Ogun", "Osun", "Ondo", "Ekiti"], avgInflation: 15.8, topItem: "Rice (50kg)", marketCount: 45 },
      { region: "South-East", states: ["Anambra", "Enugu", "Imo", "Abia", "Ebonyi"], avgInflation: 14.2, topItem: "Palm Oil (25L)", marketCount: 38 },
      { region: "North-Central", states: ["Abuja", "Kwara", "Kogi", "Niger", "Plateau", "Benue", "Nassarawa"], avgInflation: 12.5, topItem: "Yam (tuber)", marketCount: 42 },
      { region: "North-West", states: ["Kano", "Kaduna", "Katsina", "Sokoto", "Kebbi", "Zamfara", "Jigawa"], avgInflation: 11.8, topItem: "Tomatoes (basket)", marketCount: 48 },
      { region: "South-South", states: ["Rivers", "Delta", "Edo", "Bayelsa", "Cross River", "Akwa Ibom"], avgInflation: 13.5, topItem: "Fish (kg)", marketCount: 35 },
      { region: "North-East", states: ["Borno", "Adamawa", "Bauchi", "Gombe", "Yobe", "Taraba"], avgInflation: 10.2, topItem: "Beans (50kg)", marketCount: 28 },
    ],
    nfpiIndex: {
      currentValue: 1142.5,
      previousValue: 1000,
      changePercent: 14.25,
      trend: "up",
      basketItems: [
        { item: "Rice (50kg)", weight: 15.5, price: 78500, change: 15.4 },
        { item: "Beans (50kg)", weight: 8.2, price: 95000, change: 11.8 },
        { item: "Garri (50kg)", weight: 7.8, price: 42000, change: 7.7 },
        { item: "Palm Oil (25L)", weight: 9.5, price: 52000, change: 23.8 },
        { item: "Groundnut Oil (25L)", weight: 6.3, price: 45000, change: 9.8 },
        { item: "Tomatoes (basket)", weight: 8.0, price: 85000, change: 30.8 },
        { item: "Onions (bag)", weight: 5.5, price: 48000, change: 20.0 },
        { item: "Yam (tuber)", weight: 6.2, price: 3500, change: 9.4 },
        { item: "Beef (kg)", weight: 10.0, price: 5800, change: 8.2 },
        { item: "Chicken (kg)", weight: 7.5, price: 5200, change: 6.1 },
        { item: "Fish (kg)", weight: 8.0, price: 4500, change: 5.5 },
        { item: "Eggs (crate)", weight: 4.5, price: 3800, change: 4.2 },
        { item: "Bread (loaf)", weight: 3.0, price: 1200, change: 3.8 },
      ],
    },
    nbsComparison: {
      naijaMarketInflation: 42.5,
      nbsOfficialInflation: 40.5,
      difference: 2.0,
      insight: "Our real-time data shows food inflation 2.0% HIGHER than official NBS figures",
    },
  };
}

export const dynamic = "force-dynamic";
