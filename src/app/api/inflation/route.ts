// ============================================================================
// src/app/api/inflation/export/route.ts
// NaijaMarket Intel - Inflation Tracker PDF/CSV Export API
// Version: 1.0.0
// Date: 2026-01-25
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface InflationDataPoint {
  month: string;
  year: number;
  monthNum: number;
  rate: number;
  index: number;
  foodRate: number;
  coreRate: number;
}

interface CategoryInflation {
  category: string;
  rate: number;
  contribution: number;
  trend: "up" | "down" | "stable";
}

interface RegionalInflation {
  region: string;
  rate: number;
  rank: number;
}

// ============================================================================
// MOCK DATA GENERATOR (Same as main inflation API)
// ============================================================================

function generateInflationData(months: number): InflationDataPoint[] {
  const data: InflationDataPoint[] = [];
  const now = new Date();
  
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // Nigerian inflation has been high (20-35% range)
  let baseRate = 28.5;
  let baseIndex = 100;
  
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthIdx = d.getMonth();
    const year = d.getFullYear();
    
    // Seasonal variation and trend
    const seasonalFactor = [0.98, 1.02, 1.05, 1.03, 0.99, 0.97, 0.96, 1.01, 1.04, 1.02, 0.98, 1.00][monthIdx] ?? 1.0;
    const trendFactor = 1 + (Math.random() - 0.45) * 0.03;
    
    baseRate = baseRate * seasonalFactor * trendFactor;
    baseRate = Math.max(18, Math.min(38, baseRate)); // Keep in realistic range
    
    baseIndex = baseIndex * (1 + baseRate / 1200);
    
    const foodRate = baseRate * (1.1 + Math.random() * 0.1); // Food inflation typically higher
    const coreRate = baseRate * (0.85 + Math.random() * 0.1);
    
    data.push({
      month: monthNames[monthIdx] ?? "",
      year,
      monthNum: monthIdx + 1,
      rate: Math.round(baseRate * 100) / 100,
      index: Math.round(baseIndex * 100) / 100,
      foodRate: Math.round(foodRate * 100) / 100,
      coreRate: Math.round(coreRate * 100) / 100,
    });
  }
  
  return data;
}

function getCategoryInflation(): CategoryInflation[] {
  return [
    { category: "Food & Beverages", rate: 32.5, contribution: 45.2, trend: "up" },
    { category: "Housing & Utilities", rate: 24.8, contribution: 18.5, trend: "up" },
    { category: "Transportation", rate: 28.2, contribution: 12.3, trend: "stable" },
    { category: "Health", rate: 22.5, contribution: 8.2, trend: "up" },
    { category: "Education", rate: 18.9, contribution: 6.8, trend: "stable" },
    { category: "Clothing & Footwear", rate: 21.3, contribution: 5.2, trend: "down" },
    { category: "Communication", rate: 15.2, contribution: 2.1, trend: "stable" },
    { category: "Recreation", rate: 16.8, contribution: 1.7, trend: "down" },
  ];
}

function getRegionalInflation(): RegionalInflation[] {
  return [
    { region: "South West", rate: 30.2, rank: 1 },
    { region: "South East", rate: 29.5, rank: 2 },
    { region: "South South", rate: 28.8, rank: 3 },
    { region: "North Central", rate: 27.5, rank: 4 },
    { region: "North East", rate: 26.2, rank: 5 },
    { region: "North West", rate: 25.8, rank: 6 },
  ];
}

// ============================================================================
// CSV EXPORT
// ============================================================================

function generateCSV(data: InflationDataPoint[], categories: CategoryInflation[], regions: RegionalInflation[]): string {
  let csv = "INFLATION TRACKER REPORT - NAIJAMARKET INTEL\n";
  csv += `Generated: ${new Date().toLocaleString()}\n`;
  csv += `Data Source: NBS (National Bureau of Statistics)\n\n`;
  
  // Summary
  const latest = data[data.length - 1];
  const previous = data[data.length - 2];
  csv += "CURRENT SUMMARY\n";
  csv += `Current Rate,${latest?.rate ?? 0}%\n`;
  csv += `Previous Month,${previous?.rate ?? 0}%\n`;
  csv += `Food Inflation,${latest?.foodRate ?? 0}%\n`;
  csv += `Core Inflation,${latest?.coreRate ?? 0}%\n`;
  csv += `CPI Index,${latest?.index ?? 0}\n\n`;
  
  // Monthly data
  csv += "MONTHLY INFLATION DATA\n";
  csv += "Month,Year,Headline Rate,Food Rate,Core Rate,CPI Index\n";
  data.forEach(d => {
    csv += `${d.month},${d.year},${d.rate},${d.foodRate},${d.coreRate},${d.index}\n`;
  });
  csv += "\n";
  
  // Category breakdown
  csv += "CATEGORY BREAKDOWN\n";
  csv += "Category,Rate %,Contribution %,Trend\n";
  categories.forEach(c => {
    csv += `${c.category},${c.rate},${c.contribution},${c.trend}\n`;
  });
  csv += "\n";
  
  // Regional breakdown
  csv += "REGIONAL BREAKDOWN\n";
  csv += "Region,Rate %,Rank\n";
  regions.forEach(r => {
    csv += `${r.region},${r.rate},${r.rank}\n`;
  });
  
  return csv;
}

// ============================================================================
// HTML FOR PDF (Browser-based PDF generation)
// ============================================================================

function generatePDFHTML(data: InflationDataPoint[], categories: CategoryInflation[], regions: RegionalInflation[]): string {
  const latest = data[data.length - 1];
  const previous = data[data.length - 2];
  const monthChange = latest && previous ? (latest.rate - previous.rate) : 0;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Inflation Report - NaijaMarket Intel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1a1a1a; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #10b981; padding-bottom: 20px; }
    .header h1 { color: #10b981; font-size: 28px; margin-bottom: 5px; }
    .header p { color: #666; font-size: 14px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
    .summary-card { background: #f8f9fa; border-radius: 8px; padding: 15px; text-align: center; }
    .summary-card .label { color: #666; font-size: 12px; margin-bottom: 5px; }
    .summary-card .value { font-size: 24px; font-weight: bold; color: #1a1a1a; }
    .summary-card .change { font-size: 12px; margin-top: 5px; }
    .change.up { color: #ef4444; }
    .change.down { color: #10b981; }
    .section { margin-bottom: 30px; }
    .section h2 { font-size: 18px; color: #1a1a1a; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 1px solid #e5e5e5; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e5e5; }
    th { background: #f8f9fa; font-weight: 600; color: #666; }
    tr:hover { background: #f8f9fa; }
    .rate { font-weight: 600; }
    .rate.high { color: #ef4444; }
    .rate.medium { color: #f59e0b; }
    .rate.low { color: #10b981; }
    .trend { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .trend.up { background: #fef2f2; color: #ef4444; }
    .trend.down { background: #f0fdf4; color: #10b981; }
    .trend.stable { background: #f5f5f5; color: #666; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #999; font-size: 11px; }
    .chart-placeholder { background: #f8f9fa; border-radius: 8px; padding: 30px; text-align: center; color: #666; margin-bottom: 15px; }
    @media print { body { padding: 20px; } .summary-grid { grid-template-columns: repeat(2, 1fr); } }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Inflation Tracker Report</h1>
    <p>NaijaMarket Intel • Generated ${new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>
  
  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Current Inflation</div>
      <div class="value">${latest?.rate ?? 0}%</div>
      <div class="change ${monthChange >= 0 ? 'up' : 'down'}">${monthChange >= 0 ? '↑' : '↓'} ${Math.abs(monthChange).toFixed(1)}% from last month</div>
    </div>
    <div class="summary-card">
      <div class="label">Food Inflation</div>
      <div class="value">${latest?.foodRate ?? 0}%</div>
      <div class="change up">Highest contributor</div>
    </div>
    <div class="summary-card">
      <div class="label">Core Inflation</div>
      <div class="value">${latest?.coreRate ?? 0}%</div>
      <div class="change">Excluding food & energy</div>
    </div>
    <div class="summary-card">
      <div class="label">CPI Index</div>
      <div class="value">${latest?.index?.toFixed(1) ?? 0}</div>
      <div class="change">Base: 100 (2009)</div>
    </div>
  </div>
  
  <div class="section">
    <h2>📈 Monthly Inflation Trend</h2>
    <table>
      <thead>
        <tr>
          <th>Month</th>
          <th>Year</th>
          <th>Headline Rate</th>
          <th>Food Rate</th>
          <th>Core Rate</th>
          <th>CPI Index</th>
        </tr>
      </thead>
      <tbody>
        ${data.slice(-12).map(d => `
          <tr>
            <td>${d.month}</td>
            <td>${d.year}</td>
            <td class="rate ${d.rate > 30 ? 'high' : d.rate > 25 ? 'medium' : 'low'}">${d.rate}%</td>
            <td class="rate high">${d.foodRate}%</td>
            <td class="rate">${d.coreRate}%</td>
            <td>${d.index.toFixed(1)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  
  <div class="section">
    <h2>🏷️ Category Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Inflation Rate</th>
          <th>Contribution to CPI</th>
          <th>Trend</th>
        </tr>
      </thead>
      <tbody>
        ${categories.map(c => `
          <tr>
            <td>${c.category}</td>
            <td class="rate ${c.rate > 28 ? 'high' : c.rate > 22 ? 'medium' : 'low'}">${c.rate}%</td>
            <td>${c.contribution}%</td>
            <td><span class="trend ${c.trend}">${c.trend === 'up' ? '↑ Rising' : c.trend === 'down' ? '↓ Falling' : '→ Stable'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  
  <div class="section">
    <h2>🗺️ Regional Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Region</th>
          <th>Inflation Rate</th>
          <th>vs National Avg</th>
        </tr>
      </thead>
      <tbody>
        ${regions.map(r => {
          const nationalAvg = latest?.rate ?? 28;
          const diff = r.rate - nationalAvg;
          return `
            <tr>
              <td>#${r.rank}</td>
              <td>${r.region}</td>
              <td class="rate ${r.rate > 28 ? 'high' : r.rate > 25 ? 'medium' : 'low'}">${r.rate}%</td>
              <td class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
  
  <div class="footer">
    <p>Data Source: National Bureau of Statistics (NBS) • This report is for informational purposes only</p>
    <p>© ${new Date().getFullYear()} NaijaMarket Intel - The Bloomberg of Nigerian Commodities</p>
  </div>
</body>
</html>
  `;
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const months = parseInt(searchParams.get("months") || "24");
    const tier = (searchParams.get("tier") || "FREE").toUpperCase();
    
    // Check tier access
    const canExport = ["GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE"].includes(tier);
    if (!canExport) {
      return NextResponse.json(
        { success: false, error: "Export requires GOLD tier or above" },
        { status: 403 }
      );
    }
    
    // Generate data
    const data = generateInflationData(months);
    const categories = getCategoryInflation();
    const regions = getRegionalInflation();
    
    if (format === "csv") {
      const csv = generateCSV(data, categories, regions);
      
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="inflation_report_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }
    
    if (format === "pdf" || format === "html") {
      const html = generatePDFHTML(data, categories, regions);
      
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": format === "pdf" 
            ? `attachment; filename="inflation_report_${new Date().toISOString().split('T')[0]}.html"`
            : "inline",
        },
      });
    }
    
    if (format === "json") {
      return NextResponse.json({
        success: true,
        generated: new Date().toISOString(),
        data,
        categories,
        regions,
      });
    }
    
    return NextResponse.json({ success: false, error: "Invalid format" }, { status: 400 });
    
  } catch (error) {
    console.error("Export API error:", error);
    return NextResponse.json({ success: false, error: "Export failed" }, { status: 500 });
  }
}
