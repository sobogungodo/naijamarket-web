// src/app/api/reports/generate/route.ts
// NaijaMarket Intel - Report Generation API
// Handles all report types with PDF and Excel output
// Updated: 2026-02-08

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Import data queries
import {
  getDailyMarketSummaryData,
  getWeeklyTrendData,
  getMarketComparisonData,
  getArbitrageData,
  getInflationData,
  getSupplyChainData,
  getCustomAnalyticsData,
} from "@/lib/reports/queries/report-data";

// Import generators
import {
  generateDailyMarketSummaryPDF,
  generateWeeklyTrendPDF,
  generateMarketComparisonPDF,
  generateArbitragePDF,
  generateInflationPDF,
  generateSupplyChainPDF,
  generateCustomAnalyticsPDF,
} from "@/lib/reports/generators/pdf-generator";

import {
  generateDailyMarketSummaryExcel,
  generateWeeklyTrendExcel,
  generateMarketComparisonExcel,
  generateArbitrageExcel,
  generateInflationExcel,
  generateSupplyChainExcel,
  generateCustomAnalyticsExcel,
} from "@/lib/reports/generators/excel-generator";

// ============================================================================
// TYPES
// ============================================================================

type ReportType = 
  | "daily_market_summary"
  | "weekly_trend_analysis"
  | "market_comparison"
  | "arbitrage_opportunities"
  | "inflation_impact"
  | "supply_chain_intelligence"
  | "custom_analytics";

type OutputFormat = "pdf" | "excel" | "html";

interface ReportRequest {
  reportType: ReportType;
  outputFormat: OutputFormat;
  parameters?: {
    items?: string[];
    markets?: string[];
    categories?: string[];
    startDate?: string;
    endDate?: string;
  };
}

// ============================================================================
// TIER ACCESS CONTROL
// ============================================================================

const TIER_ACCESS: Record<string, ReportType[]> = {
  FREE: [],
  SILVER: [],
  GOLD: [],
  BUSINESS: [
    "daily_market_summary",
    "weekly_trend_analysis",
    "market_comparison",
  ],
  BUSINESS_PLUS: [
    "daily_market_summary",
    "weekly_trend_analysis",
    "market_comparison",
  ],
  CORPORATE: [
    "daily_market_summary",
    "weekly_trend_analysis",
    "market_comparison",
    "arbitrage_opportunities",
    "inflation_impact",
  ],
  ENTERPRISE: [
    "daily_market_summary",
    "weekly_trend_analysis",
    "market_comparison",
    "arbitrage_opportunities",
    "inflation_impact",
    "supply_chain_intelligence",
    "custom_analytics",
  ],
  OGA_BOSS: [
    "daily_market_summary",
    "weekly_trend_analysis",
    "market_comparison",
    "arbitrage_opportunities",
    "inflation_impact",
    "supply_chain_intelligence",
    "custom_analytics",
  ],
  GOVERNMENT: [
    "daily_market_summary",
    "weekly_trend_analysis",
    "market_comparison",
    "arbitrage_opportunities",
    "inflation_impact",
    "supply_chain_intelligence",
    "custom_analytics",
  ],
};

const REPORT_NAMES: Record<ReportType, string> = {
  daily_market_summary: "Daily Market Summary",
  weekly_trend_analysis: "Weekly Trend Analysis",
  market_comparison: "Market Comparison Report",
  arbitrage_opportunities: "Arbitrage Opportunities",
  inflation_impact: "Inflation Impact Report",
  supply_chain_intelligence: "Supply Chain Intelligence",
  custom_analytics: "Custom Analytics Report",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function checkTierAccess(tier: string, reportType: ReportType): boolean {
  const allowedReports = TIER_ACCESS[tier.toUpperCase()] || [];
  return allowedReports.includes(reportType);
}

function getMinimumTierForReport(reportType: ReportType): string {
  if (["daily_market_summary", "weekly_trend_analysis", "market_comparison"].includes(reportType)) {
    return "BUSINESS";
  }
  if (["arbitrage_opportunities", "inflation_impact"].includes(reportType)) {
    return "CORPORATE";
  }
  return "ENTERPRISE";
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  console.log("📊 Report Generation Request Received");

  try {
    // Get session
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required", code: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    const user = session.user as any;
    const userTier = user.tier || user.subscription_tier || "FREE";

    // Parse request body
    const body: ReportRequest = await request.json();
    const { reportType, outputFormat, parameters } = body;

    console.log(`📊 Report: ${reportType}, Format: ${outputFormat}, Tier: ${userTier}`);

    // Validate report type
    if (!reportType || !REPORT_NAMES[reportType]) {
      return NextResponse.json(
        { error: "Invalid report type", code: "INVALID_REPORT_TYPE" },
        { status: 400 }
      );
    }

    // Validate output format
    if (!outputFormat || !["pdf", "excel", "html"].includes(outputFormat)) {
      return NextResponse.json(
        { error: "Invalid output format. Use: pdf, excel, or html", code: "INVALID_FORMAT" },
        { status: 400 }
      );
    }

    // Check tier access
    if (!checkTierAccess(userTier, reportType)) {
      const minTier = getMinimumTierForReport(reportType);
      return NextResponse.json(
        { 
          error: `This report requires ${minTier} tier or higher. Your current tier: ${userTier}`,
          code: "TIER_RESTRICTED",
          requiredTier: minTier,
          currentTier: userTier
        },
        { status: 403 }
      );
    }

    // Fetch data based on report type
    console.log(`📊 Fetching data for: ${reportType}`);
    let reportData: any;

    switch (reportType) {
      case "daily_market_summary":
        reportData = await getDailyMarketSummaryData();
        break;
      case "weekly_trend_analysis":
        reportData = await getWeeklyTrendData();
        break;
      case "market_comparison":
        reportData = await getMarketComparisonData(parameters?.items);
        break;
      case "arbitrage_opportunities":
        reportData = await getArbitrageData();
        break;
      case "inflation_impact":
        reportData = await getInflationData();
        break;
      case "supply_chain_intelligence":
        reportData = await getSupplyChainData();
        break;
      case "custom_analytics":
        reportData = await getCustomAnalyticsData({
          items: parameters?.items,
          markets: parameters?.markets,
          categories: parameters?.categories,
          startDate: parameters?.startDate ? new Date(parameters.startDate) : undefined,
          endDate: parameters?.endDate ? new Date(parameters.endDate) : undefined,
        });
        break;
      default:
        return NextResponse.json(
          { error: "Report type not implemented", code: "NOT_IMPLEMENTED" },
          { status: 501 }
        );
    }

    // Generate report based on format
    console.log(`📊 Generating ${outputFormat.toUpperCase()} report...`);
    let fileBuffer: Buffer;
    let contentType: string;
    let fileExtension: string;

    if (outputFormat === "pdf") {
      switch (reportType) {
        case "daily_market_summary":
          fileBuffer = await generateDailyMarketSummaryPDF(reportData);
          break;
        case "weekly_trend_analysis":
          fileBuffer = await generateWeeklyTrendPDF(reportData);
          break;
        case "market_comparison":
          fileBuffer = await generateMarketComparisonPDF(reportData);
          break;
        case "arbitrage_opportunities":
          fileBuffer = await generateArbitragePDF(reportData);
          break;
        case "inflation_impact":
          fileBuffer = await generateInflationPDF(reportData);
          break;
        case "supply_chain_intelligence":
          fileBuffer = await generateSupplyChainPDF(reportData);
          break;
        case "custom_analytics":
          fileBuffer = await generateCustomAnalyticsPDF(reportData);
          break;
        default:
          throw new Error("PDF generator not found");
      }
      contentType = "application/pdf";
      fileExtension = "pdf";

    } else if (outputFormat === "excel") {
      switch (reportType) {
        case "daily_market_summary":
          fileBuffer = await generateDailyMarketSummaryExcel(reportData);
          break;
        case "weekly_trend_analysis":
          fileBuffer = await generateWeeklyTrendExcel(reportData);
          break;
        case "market_comparison":
          fileBuffer = await generateMarketComparisonExcel(reportData);
          break;
        case "arbitrage_opportunities":
          fileBuffer = await generateArbitrageExcel(reportData);
          break;
        case "inflation_impact":
          fileBuffer = await generateInflationExcel(reportData);
          break;
        case "supply_chain_intelligence":
          fileBuffer = await generateSupplyChainExcel(reportData);
          break;
        case "custom_analytics":
          fileBuffer = await generateCustomAnalyticsExcel(reportData);
          break;
        default:
          throw new Error("Excel generator not found");
      }
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      fileExtension = "xlsx";

    } else if (outputFormat === "html") {
      // For HTML, return JSON data for client-side rendering
      return NextResponse.json({
        success: true,
        reportType,
        reportName: REPORT_NAMES[reportType],
        data: reportData,
        generatedAt: new Date().toISOString(),
      });

    } else {
      return NextResponse.json(
        { error: "Unsupported format", code: "UNSUPPORTED_FORMAT" },
        { status: 400 }
      );
    }

    // Generate filename
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `NaijaMarket_${REPORT_NAMES[reportType].replace(/\s+/g, "_")}_${timestamp}.${fileExtension}`;

    console.log(`✅ Report generated: ${filename} (${fileBuffer.length} bytes)`);

    // Return file
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": fileBuffer.length.toString(),
        "X-Report-Type": reportType,
        "X-Report-Name": REPORT_NAMES[reportType],
      },
    });

  } catch (error: any) {
    console.error("❌ Report Generation Error:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to generate report. Please try again.",
        code: "GENERATION_FAILED",
        details: process.env.NODE_ENV === "development" ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - List available reports for user's tier
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = session.user as any;
    const userTier = user.tier || user.subscription_tier || "FREE";
    const allowedReports = TIER_ACCESS[userTier.toUpperCase()] || [];

    const reports = Object.entries(REPORT_NAMES).map(([type, name]) => ({
      type,
      name,
      available: allowedReports.includes(type as ReportType),
      requiredTier: getMinimumTierForReport(type as ReportType),
    }));

    return NextResponse.json({
      success: true,
      userTier,
      reports,
      availableFormats: ["pdf", "excel", "html"],
    });

  } catch (error: any) {
    console.error("Report List Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch report list" },
      { status: 500 }
    );
  }
}
