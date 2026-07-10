// src/app/api/nfpi/pdf/route.ts
// NaijaMarket Intel - NFPI PDF Report Generator
// Generates professional Bloomberg-style PDF reports
// Created: 2026-01-18

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

// Tier access - PDF requires BUSINESS+ 
const PDF_TIERS = ["BUSINESS", "CORPORATE", "ENTERPRISE"];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tier = ((session.user as any).tier || "FREE").toUpperCase();
    
    // Check access
    if (!PDF_TIERS.includes(tier)) {
      return NextResponse.json({
        success: false,
        error: "PDF reports require BUSINESS tier or higher"
      }, { status: 403 });
    }

    // Fetch all data for PDF
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

    // Get basket items with current prices
    const basket = await prisma.$queryRaw`
      SELECT b.*, p.avg_price, p.price_change_pct
      FROM NFPI_Basket b
      LEFT JOIN NFPI_Item_Prices p ON b.item_id = p.item_id 
        AND p.week_id = (SELECT MAX(week_id) FROM NFPI_Weekly)
      WHERE b.is_active = 1
      ORDER BY b.category, b.item_name
    ` as any[];

    // Get trend for chart (last 12 months)
    const trend = await prisma.$queryRaw`
      SELECT TOP 12
        FORMAT(week_id, 'yyyy-MM') as period,
        national_index,
        national_change_pct,
        grains_index,
        proteins_index,
        vegetables_index,
        oils_index
      FROM NFPI_Weekly
      ORDER BY week_id DESC
    ` as any[];

    // Generate HTML for PDF
    const html = generatePDFHTML({
      latest: latestNFPI,
      basket,
      trend: trend.reverse(),
      generatedAt: new Date().toISOString()
    });

    // Return HTML that can be converted to PDF on client
    // Or use a PDF library server-side
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="NFPI_Report_${latestNFPI.period}.html"`
      }
    });

  } catch (error) {
    console.error("NFPI PDF Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    }, { status: 500 });
  }
}

// Generate Bloomberg-style HTML report
function generatePDFHTML(data: {
  latest: any;
  basket: any[];
  trend: any[];
  generatedAt: string;
}): string {
  const { latest, basket, trend, generatedAt } = data;
  
  // Calculate inflation status
  const index = parseFloat(latest.national_index);
  let statusColor = "#22c55e";
  let statusLabel = "LOW";
  if (index >= 140) { statusColor = "#ef4444"; statusLabel = "VERY HIGH"; }
  else if (index >= 125) { statusColor = "#f97316"; statusLabel = "HIGH"; }
  else if (index >= 110) { statusColor = "#eab308"; statusLabel = "MODERATE"; }

  // Group basket by category
  const byCategory: Record<string, any[]> = {};
  basket.forEach(item => {
    const cat = item.category || "Other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>NFPI Report - ${latest.period}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      padding: 40px;
      line-height: 1.5;
    }
    .container { max-width: 800px; margin: 0 auto; }
    
    /* Header */
    .header {
      text-align: center;
      padding-bottom: 30px;
      border-bottom: 2px solid #00A36C;
      margin-bottom: 30px;
    }
    .logo { font-size: 28px; font-weight: 700; color: #00A36C; margin-bottom: 5px; }
    .subtitle { color: #9ca3af; font-size: 14px; }
    .period { font-size: 20px; color: #fff; margin-top: 15px; }
    
    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    .stat-label { color: #9ca3af; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
    .stat-value { font-size: 36px; font-weight: 700; color: #fff; }
    .stat-change { font-size: 14px; margin-top: 5px; }
    .stat-change.up { color: #ef4444; }
    .stat-change.down { color: #22c55e; }
    
    /* Status Badge */
    .status-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
    }
    
    /* Section */
    .section {
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    /* Categories Grid */
    .categories-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
    }
    .category-card {
      background: #111827;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }
    .category-icon { font-size: 24px; margin-bottom: 8px; }
    .category-name { color: #9ca3af; font-size: 11px; margin-bottom: 5px; }
    .category-value { font-size: 24px; font-weight: 700; }
    
    /* Table */
    table { width: 100%; border-collapse: collapse; }
    th { 
      text-align: left; 
      color: #9ca3af; 
      font-size: 11px; 
      text-transform: uppercase;
      padding: 10px 8px;
      border-bottom: 1px solid #374151;
    }
    td {
      padding: 12px 8px;
      border-bottom: 1px solid #374151;
      font-size: 13px;
    }
    tr:hover { background: #111827; }
    .text-right { text-align: right; }
    .text-red { color: #ef4444; }
    .text-green { color: #22c55e; }
    
    /* Insight */
    .insight {
      background: rgba(0, 163, 108, 0.1);
      border: 1px solid rgba(0, 163, 108, 0.3);
      border-radius: 8px;
      padding: 16px;
      margin-top: 20px;
    }
    .insight-title { color: #00A36C; font-weight: 600; margin-bottom: 8px; }
    
    /* Footer */
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #374151;
      color: #6b7280;
      font-size: 12px;
    }
    
    /* Print styles */
    @media print {
      body { background: #fff; color: #000; }
      .stat-card, .section, .category-card { border-color: #e5e7eb; }
      .stat-value, .category-value { color: #000; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo">📊 NaijaMarket Intel</div>
      <div class="subtitle">NaijaFood Price Index (NFPI) Weekly Report</div>
      <div class="period">${latest.period}</div>
    </div>
    
    <!-- Main Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">National NFPI</div>
        <div class="stat-value">${parseFloat(latest.national_index).toFixed(1)}</div>
        <div class="stat-change ${parseFloat(latest.national_change_pct) > 0 ? 'up' : 'down'}">
          ${parseFloat(latest.national_change_pct) > 0 ? '+' : ''}${parseFloat(latest.national_change_pct || 0).toFixed(1)}% MoM
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Inflation Status</div>
        <div class="status-badge" style="background: ${statusColor}20; color: ${statusColor};">
          ${statusLabel}
        </div>
        <div class="stat-change" style="color: #9ca3af;">
          +${(parseFloat(latest.national_index) - 100).toFixed(1)}% since baseline
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Basket Value</div>
        <div class="stat-value" style="font-size: 28px;">₦${parseFloat(latest.basket_value_naira || 0).toLocaleString()}</div>
        <div class="stat-change" style="color: #9ca3af;">
          Base: ₦${parseFloat(latest.baseline_value || 0).toLocaleString()}
        </div>
      </div>
    </div>
    
    <!-- Category Breakdown -->
    <div class="section">
      <div class="section-title">📦 Category Indices</div>
      <div class="categories-grid">
        <div class="category-card">
          <div class="category-icon">🌾</div>
          <div class="category-name">GRAINS & STAPLES</div>
          <div class="category-value" style="color: #f59e0b;">${parseFloat(latest.grains_index || 100).toFixed(1)}</div>
        </div>
        <div class="category-card">
          <div class="category-icon">🥩</div>
          <div class="category-name">PROTEINS</div>
          <div class="category-value" style="color: #ef4444;">${parseFloat(latest.proteins_index || 100).toFixed(1)}</div>
        </div>
        <div class="category-card">
          <div class="category-icon">🥬</div>
          <div class="category-name">VEGETABLES</div>
          <div class="category-value" style="color: #22c55e;">${parseFloat(latest.vegetables_index || 100).toFixed(1)}</div>
        </div>
        <div class="category-card">
          <div class="category-icon">🛢️</div>
          <div class="category-name">COOKING OILS</div>
          <div class="category-value" style="color: #8b5cf6;">${parseFloat(latest.oils_index || 100).toFixed(1)}</div>
        </div>
      </div>
    </div>
    
    <!-- Top Movers -->
    <div class="section">
      <div class="section-title">📈 Top Movers</div>
      <table>
        <tr>
          <td style="width: 50%;">
            <strong style="color: #ef4444;">↑ Biggest Gainers</strong><br>
            <span style="color: #9ca3af;">${latest.top_gainers || 'No data'}</span>
          </td>
          <td style="width: 50%;">
            <strong style="color: #22c55e;">↓ Biggest Losers</strong><br>
            <span style="color: #9ca3af;">${latest.top_losers || 'No data'}</span>
          </td>
        </tr>
      </table>
    </div>
    
    <!-- Basket Details -->
    <div class="section">
      <div class="section-title">🧺 NFPI Basket Items (${basket.length})</div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Category</th>
            <th class="text-right">Weight</th>
            <th class="text-right">Baseline</th>
            <th class="text-right">Current</th>
            <th class="text-right">Change</th>
          </tr>
        </thead>
        <tbody>
          ${basket.map(item => {
            const change = parseFloat(item.price_change_pct || 0);
            return `
              <tr>
                <td><strong>${item.item_name}</strong></td>
                <td style="color: #9ca3af;">${item.category}</td>
                <td class="text-right" style="color: #9ca3af;">${parseFloat(item.weight_pct)}%</td>
                <td class="text-right" style="color: #9ca3af;">₦${parseFloat(item.baseline_price).toLocaleString()}</td>
                <td class="text-right">₦${parseFloat(item.avg_price || 0).toLocaleString()}</td>
                <td class="text-right ${change > 0 ? 'text-red' : 'text-green'}">
                  ${change > 0 ? '+' : ''}${change.toFixed(1)}%
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <!-- Trend Table -->
    <div class="section">
      <div class="section-title">📊 Historical Trend (Last ${trend.length} Months)</div>
      <table>
        <thead>
          <tr>
            <th>Period</th>
            <th class="text-right">National</th>
            <th class="text-right">Grains</th>
            <th class="text-right">Proteins</th>
            <th class="text-right">Vegetables</th>
            <th class="text-right">Oils</th>
          </tr>
        </thead>
        <tbody>
          ${trend.map(t => `
            <tr>
              <td><strong>${t.period}</strong></td>
              <td class="text-right">${parseFloat(t.national_index).toFixed(1)}</td>
              <td class="text-right" style="color: #f59e0b;">${parseFloat(t.grains_index || 100).toFixed(1)}</td>
              <td class="text-right" style="color: #ef4444;">${parseFloat(t.proteins_index || 100).toFixed(1)}</td>
              <td class="text-right" style="color: #22c55e;">${parseFloat(t.vegetables_index || 100).toFixed(1)}</td>
              <td class="text-right" style="color: #8b5cf6;">${parseFloat(t.oils_index || 100).toFixed(1)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <!-- Insight -->
    ${latest.insight ? `
      <div class="insight">
        <div class="insight-title">💡 Market Insight</div>
        <p>${latest.insight}</p>
      </div>
    ` : ''}
    
    <!-- Footer -->
    <div class="footer">
      <p><strong>NaijaMarket Intel</strong> - The Bloomberg of Nigerian Commodities</p>
      <p>Report generated: ${new Date(generatedAt).toLocaleString()}</p>
      <p>© ${new Date().getFullYear()} Giggababytes Oy. All rights reserved.</p>
      <p style="margin-top: 10px;">
        📞 Support: support@naijamarket.com | 🌐 www.naijamarket.com
      </p>
    </div>
  </div>
  
  <script>
    // Auto-trigger print dialog for PDF
    // window.print();
  </script>
</body>
</html>`;
}
