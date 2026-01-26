// ============================================================================
// src/app/api/reports/route.ts
// NaijaMarket Intel - Market Intelligence Reports API
// Version: 1.1.0 - Using Prisma instead of mssql
// Bloomberg Equivalent: NI <GO>
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// GET USER TIER FROM DATABASE (Using Prisma)
// ============================================================================

async function getUserTierFromDB(session: any): Promise<string> {
  if (!session?.user) return "FREE";
  
  const { email, name, phone } = session.user as any;
  
  try {
    // Strategy 1: Try by email
    if (email) {
      const user = await prisma.consumers.findFirst({
        where: { email: email },
        select: { subscription_tier: true },
      });
      if (user?.subscription_tier) {
        return user.subscription_tier.toUpperCase();
      }
    }
    
    // Strategy 2: Try by phone (if in session)
    if (phone) {
      const user = await prisma.consumers.findFirst({
        where: { phone_number: phone },
        select: { subscription_tier: true },
      });
      if (user?.subscription_tier) {
        return user.subscription_tier.toUpperCase();
      }
    }
    
    // Strategy 3: Extract phone suffix from name like "User 5952"
    if (name && name.startsWith("User ")) {
      const phoneSuffix = name.replace("User ", "");
      if (phoneSuffix && /^\d{4,}$/.test(phoneSuffix)) {
        const users = await prisma.$queryRawUnsafe<any[]>(`
          SELECT TOP 1 subscription_tier 
          FROM Consumers 
          WHERE phone_number LIKE '%${phoneSuffix}'
          ORDER BY created_at DESC
        `);
        
        if (users && users.length > 0 && users[0].subscription_tier) {
          return users[0].subscription_tier.toUpperCase();
        }
      }
    }
    
    console.log("[Reports] User not found. Session:", JSON.stringify(session.user));
    return "FREE";
  } catch (error) {
    console.error("[Reports] Error fetching tier from DB:", error);
    return "FREE";
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ReportType {
  id: string;
  name: string;
  description: string;
  frequency: string;
  sections: string[];
  estimatedPages: number;
  icon: string;
}

interface ReportRequest {
  reportType: "weekly" | "monthly" | "regional" | "inflation" | "custom";
  format: "pdf" | "excel" | "html";
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  region?: string;
  categories?: string[];
  includeForecasts?: boolean;
  includeSections?: string[];
}

interface GeneratedReport {
  id: string;
  type: string;
  title: string;
  generatedAt: string;
  expiresAt: string;
  format: string;
  fileSize: string;
  downloadUrl: string;
  sections: string[];
  metrics: ReportMetrics;
}

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
  state: string;
  avgPrice: number;
  avgChange: number;
  marketCount: number;
}

interface NFPIData {
  currentValue: number;
  previousValue: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  historicalData: { date: string; value: number }[];
}

interface NBSComparison {
  officialInflation: number;
  nfpiInflation: number;
  variance: number;
  period: string;
}

interface ScheduledReport {
  id: string;
  userId: string;
  reportType: string;
  format: string;
  frequency: string;
  deliveryMethod: string;
  deliveryAddress: {
    email?: string;
    phone?: string;
  };
  nextDelivery: string;
  isActive: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIER_ACCESS: Record<string, number> = {
  FREE: 0,
  SILVER: 0,
  GOLD: 0,
  BUSINESS: 10,
  CORPORATE: 999,
  ENTERPRISE: 999,
};

const TIER_FEATURES: Record<string, string[]> = {
  BUSINESS: ["10 reports/month", "PDF & Excel", "Download only"],
  CORPORATE: ["Unlimited reports", "All formats", "Scheduled delivery", "Email & WhatsApp"],
  ENTERPRISE: ["Unlimited reports", "All formats", "Scheduled delivery", "API access", "White-label"],
};

const REPORT_TYPES: ReportType[] = [
  {
    id: "weekly",
    name: "Weekly Market Summary",
    description: "Comprehensive overview of price movements, top movers, and market trends",
    frequency: "Weekly",
    sections: [
      "Executive Summary",
      "Key Metrics Dashboard",
      "Top 10 Price Increases",
      "Top 10 Price Decreases",
      "Category Breakdown",
      "Regional Heatmap",
      "NBS Comparison",
      "NFPI Index Trend",
      "Market Spotlight",
      "Methodology Notes",
    ],
    estimatedPages: 12,
    icon: "📊",
  },
  {
    id: "monthly",
    name: "Monthly Commodity Analysis",
    description: "Deep-dive into specific commodities with forecast and historical analysis",
    frequency: "Monthly",
    sections: [
      "Executive Summary",
      "Key Metrics Dashboard",
      "Top 10 Price Increases",
      "Top 10 Price Decreases",
      "Commodity Deep Dive",
      "Seasonal Patterns",
      "Price Forecasts",
      "Supply Chain Analysis",
      "Import/Export Impact",
      "Methodology Notes",
    ],
    estimatedPages: 20,
    icon: "📈",
  },
  {
    id: "regional",
    name: "Regional Price Report",
    description: "State-by-state and market-by-market price comparison",
    frequency: "On-demand",
    sections: [
      "Executive Summary",
      "Regional Overview Map",
      "State Rankings",
      "Market Comparisons",
      "Price Arbitrage Opportunities",
      "Transport Cost Analysis",
      "Regional Trends",
      "Methodology Notes",
    ],
    estimatedPages: 15,
    icon: "🗺️",
  },
  {
    id: "inflation",
    name: "Inflation Tracker Report",
    description: "NFPI vs NBS inflation comparison with detailed variance analysis",
    frequency: "Monthly",
    sections: [
      "Executive Summary",
      "NFPI vs NBS Comparison",
      "Category Inflation Breakdown",
      "Regional Inflation Variance",
      "Historical Trend Analysis",
      "Purchasing Power Impact",
      "Forecast & Projections",
      "Methodology Notes",
    ],
    estimatedPages: 18,
    icon: "📉",
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTierLevel(tier: string): number {
  return TIER_ACCESS[tier.toUpperCase()] ?? 0;
}

function canAccessReports(tier: string): boolean {
  return getTierLevel(tier) > 0;
}

function getReportsRemaining(tier: string, usedThisMonth: number): number {
  const limit = TIER_ACCESS[tier.toUpperCase()] ?? 0;
  if (limit === 999) return 999; // Unlimited
  return Math.max(0, limit - usedThisMonth);
}

function canScheduleDelivery(tier: string): boolean {
  const t = tier.toUpperCase();
  return t === "CORPORATE" || t === "ENTERPRISE";
}

function generateReportId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `RPT-${timestamp}-${random}`.toUpperCase();
}

function getDateRange(reportType: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  let startDate = new Date();

  switch (reportType) {
    case "weekly":
      startDate.setDate(endDate.getDate() - 7);
      break;
    case "monthly":
      startDate.setMonth(endDate.getMonth() - 1);
      break;
    case "regional":
      startDate.setDate(endDate.getDate() - 14);
      break;
    case "inflation":
      startDate.setMonth(endDate.getMonth() - 1);
      break;
    default:
      startDate.setDate(endDate.getDate() - 7);
  }

  return { startDate, endDate };
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================================================
// MOCK DATA GENERATORS (Replace with real DB queries)
// ============================================================================

function generateMockMetrics(): ReportMetrics {
  const topGainers: PriceMovement[] = [
    { item: "Tomatoes", market: "Mile 12", state: "Lagos", currentPrice: 45000, previousPrice: 38000, changePercent: 18.4, changeAmount: 7000 },
    { item: "Onions", market: "Kano Main", state: "Kano", currentPrice: 32000, previousPrice: 28000, changePercent: 14.3, changeAmount: 4000 },
    { item: "Pepper", market: "Bodija", state: "Oyo", currentPrice: 28000, previousPrice: 25000, changePercent: 12.0, changeAmount: 3000 },
    { item: "Yam", market: "Zaki Biam", state: "Benue", currentPrice: 15000, previousPrice: 13500, changePercent: 11.1, changeAmount: 1500 },
    { item: "Palm Oil", market: "Onitsha", state: "Anambra", currentPrice: 52000, previousPrice: 48000, changePercent: 8.3, changeAmount: 4000 },
  ];

  const topLosers: PriceMovement[] = [
    { item: "Rice (Local)", market: "Dawanau", state: "Kano", currentPrice: 68000, previousPrice: 75000, changePercent: -9.3, changeAmount: -7000 },
    { item: "Beans", market: "Mile 12", state: "Lagos", currentPrice: 85000, previousPrice: 92000, changePercent: -7.6, changeAmount: -7000 },
    { item: "Garri", market: "Eke Awka", state: "Anambra", currentPrice: 28000, previousPrice: 30000, changePercent: -6.7, changeAmount: -2000 },
    { item: "Maize", market: "Jos Main", state: "Plateau", currentPrice: 32000, previousPrice: 34000, changePercent: -5.9, changeAmount: -2000 },
    { item: "Groundnut", market: "Sabon Gari", state: "Kaduna", currentPrice: 45000, previousPrice: 47000, changePercent: -4.3, changeAmount: -2000 },
  ];

  const categoryBreakdown: CategoryMetric[] = [
    { category: "Grains & Cereals", avgPrice: 55000, avgChange: -2.1, itemCount: 8, trend: "down" },
    { category: "Vegetables", avgPrice: 35000, avgChange: 12.5, itemCount: 12, trend: "up" },
    { category: "Tubers", avgPrice: 18000, avgChange: 5.3, itemCount: 5, trend: "up" },
    { category: "Oils & Fats", avgPrice: 48000, avgChange: 3.2, itemCount: 4, trend: "up" },
    { category: "Proteins", avgPrice: 72000, avgChange: -1.5, itemCount: 6, trend: "stable" },
  ];

  const regionalData: RegionalMetric[] = [
    { region: "South West", state: "Lagos", avgPrice: 52000, avgChange: 8.2, marketCount: 45 },
    { region: "North West", state: "Kano", avgPrice: 42000, avgChange: 3.5, marketCount: 38 },
    { region: "South East", state: "Anambra", avgPrice: 48000, avgChange: 5.1, marketCount: 28 },
    { region: "North Central", state: "Plateau", avgPrice: 38000, avgChange: 2.8, marketCount: 22 },
    { region: "South South", state: "Rivers", avgPrice: 55000, avgChange: 6.4, marketCount: 18 },
  ];

  return {
    totalItems: 156,
    totalMarkets: 226,
    priceChanges: {
      increases: 89,
      decreases: 45,
      unchanged: 22,
    },
    topGainers,
    topLosers,
    categoryBreakdown,
    regionalData,
    nfpiIndex: {
      currentValue: 428.5,
      previousValue: 412.3,
      changePercent: 3.9,
      trend: "up",
      historicalData: [
        { date: "2024-01-01", value: 385.2 },
        { date: "2024-02-01", value: 392.8 },
        { date: "2024-03-01", value: 401.5 },
        { date: "2024-04-01", value: 412.3 },
        { date: "2024-05-01", value: 428.5 },
      ],
    },
    nbsComparison: {
      officialInflation: 33.2,
      nfpiInflation: 38.5,
      variance: 5.3,
      period: "April 2024",
    },
  };
}

function generateReport(reportType: string, format: string): GeneratedReport {
  const { startDate, endDate } = getDateRange(reportType);
  const reportTypeInfo = REPORT_TYPES.find((t) => t.id === reportType) || REPORT_TYPES[0];
  const reportId = generateReportId();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  return {
    id: reportId,
    type: reportType,
    title: `${reportTypeInfo.name} - ${formatDate(startDate)} to ${formatDate(endDate)}`,
    generatedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    format: format.toUpperCase(),
    fileSize: format === "pdf" ? "2.4 MB" : format === "excel" ? "1.8 MB" : "856 KB",
    downloadUrl: `/api/reports/${reportId}/download?format=${format}`,
    sections: reportTypeInfo.sections,
    metrics: generateMockMetrics(),
  };
}

// ============================================================================
// GET - List available reports and user's generated reports
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");

  // Get user tier from database using Prisma
  const userTier = await getUserTierFromDB(session);

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

  // List available report types
  if (action === "types") {
    return NextResponse.json({
      success: true,
      reportTypes: REPORT_TYPES,
      userTier,
      features: TIER_FEATURES[userTier] || [],
      reportsRemaining: getReportsRemaining(userTier, 0), // TODO: Get actual usage
      canSchedule: canScheduleDelivery(userTier),
    });
  }

  // List user's scheduled reports
  if (action === "scheduled") {
    if (!canScheduleDelivery(userTier)) {
      return NextResponse.json({
        success: false,
        error: "Scheduled delivery requires CORPORATE tier or higher",
        currentTier: userTier,
        requiredTier: "CORPORATE",
      }, { status: 403 });
    }

    // TODO: Fetch from database
    const scheduledReports: ScheduledReport[] = [];

    return NextResponse.json({
      success: true,
      scheduledReports,
      canSchedule: true,
    });
  }

  // Default: Return report types and capabilities
  return NextResponse.json({
    success: true,
    reportTypes: REPORT_TYPES,
    userTier,
    features: TIER_FEATURES[userTier] || [],
    reportsRemaining: getReportsRemaining(userTier, 0),
    canSchedule: canScheduleDelivery(userTier),
    recentReports: [], // TODO: Fetch from database
  });
}

// ============================================================================
// POST - Generate a new report
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();

  // Get user tier from database using Prisma
  const userTier = await getUserTierFromDB(session);

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

  try {
    const body: ReportRequest = await request.json();
    const { reportType, format } = body;

    // Validate report type
    const validTypes = REPORT_TYPES.map((t) => t.id);
    if (!validTypes.includes(reportType)) {
      return NextResponse.json({
        success: false,
        error: `Invalid report type. Valid types: ${validTypes.join(", ")}`,
      }, { status: 400 });
    }

    // Validate format
    const validFormats = ["pdf", "excel", "html"];
    if (!validFormats.includes(format)) {
      return NextResponse.json({
        success: false,
        error: `Invalid format. Valid formats: ${validFormats.join(", ")}`,
      }, { status: 400 });
    }

    // Check report limits for non-unlimited tiers
    const reportsRemaining = getReportsRemaining(userTier, 0); // TODO: Get actual usage
    if (reportsRemaining <= 0 && reportsRemaining !== 999) {
      return NextResponse.json({
        success: false,
        error: "Monthly report limit reached. Upgrade to generate more reports.",
        currentTier: userTier,
        upgradeUrl: "/subscribe",
      }, { status: 403 });
    }

    // Generate the report
    const report = generateReport(reportType, format);

    // TODO: Save to database
    // TODO: Actually generate the file

    return NextResponse.json({
      success: true,
      report,
      message: `${format.toUpperCase()} report generated successfully`,
      reportsRemaining: reportsRemaining === 999 ? 999 : reportsRemaining - 1,
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to generate report",
    }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
