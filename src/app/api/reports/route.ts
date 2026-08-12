// ============================================================================
// src/app/api/reports/route.ts
// NaijaMarket Intel - Market Intelligence Reports API
// Version: 1.2.0 - Fixed user lookup with full_name strategy
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma as sharedPrisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = sharedPrisma;

// ============================================================================
// TIER ACCESS CONFIGURATION
// ============================================================================

// Reports per month by tier
const TIER_REPORTS: Record<string, number> = {
  FREE: 0,
  SILVER: 0,
  GOLD: 5,        // 5 reports per month
  BUSINESS: 10,   // 10 reports per month
  CORPORATE: 999, // Unlimited
  ENTERPRISE: 999, // Unlimited
};

// Schedule limits by tier (0 = cannot schedule)
const TIER_SCHEDULE_LIMIT: Record<string, number> = {
  FREE: 0,
  SILVER: 0,
  GOLD: 0,        // Cannot schedule
  BUSINESS: 3,    // Can schedule up to 3 reports
  CORPORATE: 999, // Unlimited
  ENTERPRISE: 999, // Unlimited
};

// Legacy: for tier level comparison (report type access)
const TIER_ACCESS: Record<string, number> = {
  FREE: 0,
  SILVER: 0,
  GOLD: 5,
  BUSINESS: 10,
  CORPORATE: 999,
  ENTERPRISE: 999,
};

// ============================================================================
// REPORT TYPES CONFIGURATION
// ============================================================================

const REPORT_TYPES = [
  {
    id: "daily-summary",
    name: "Daily Market Summary",
    description: "Comprehensive daily overview of price movements across all tracked commodities",
    frequency: "Daily",
    tier: "BUSINESS",
    icon: "📊",
    sections: ["Price Overview", "Top Movers", "Market Activity", "Regional Summary"],
    estimatedPages: 5,
  },
  {
    id: "weekly-trends",
    name: "Weekly Trend Analysis",
    description: "Week-over-week price trends with statistical analysis and forecasts",
    frequency: "Weekly",
    tier: "BUSINESS",
    icon: "📈",
    sections: ["Weekly Summary", "Price Trends", "Category Analysis", "Forecast"],
    estimatedPages: 12,
  },
  {
    id: "market-comparison",
    name: "Market Comparison Report",
    description: "Side-by-side comparison of prices across different markets",
    frequency: "On-demand",
    tier: "BUSINESS",
    icon: "🔄",
    sections: ["Market Overview", "Price Comparison", "Regional Analysis", "Recommendations"],
    estimatedPages: 8,
  },
  {
    id: "arbitrage-opportunities",
    name: "Arbitrage Opportunities",
    description: "Identifies profitable price differences between markets",
    frequency: "Daily",
    tier: "CORPORATE",
    icon: "💰",
    sections: ["Top Opportunities", "Risk Analysis", "Route Optimization", "ROI Projections"],
    estimatedPages: 10,
  },
  {
    id: "inflation-tracker",
    name: "Inflation Impact Report",
    description: "Tracks commodity price inflation with NBS data correlation",
    frequency: "Monthly",
    tier: "CORPORATE",
    icon: "📉",
    sections: ["Inflation Summary", "NBS Comparison", "Category Breakdown", "Historical Trends"],
    estimatedPages: 15,
  },
  {
    id: "supply-chain",
    name: "Supply Chain Intelligence",
    description: "Analyzes supply patterns, shortages, and logistics data",
    frequency: "Weekly",
    tier: "ENTERPRISE",
    icon: "🚛",
    sections: ["Supply Overview", "Shortage Alerts", "Logistics Analysis", "Vendor Insights"],
    estimatedPages: 20,
  },
  {
    id: "custom-analytics",
    name: "Custom Analytics Report",
    description: "Fully customizable report with your selected metrics and timeframes",
    frequency: "On-demand",
    tier: "ENTERPRISE",
    icon: "⚙️",
    sections: ["Custom Metrics", "Date Range Analysis", "Comparison Tools", "Export Options"],
    estimatedPages: 25,
  },
];

// ============================================================================
// USER TIER LOOKUP - HANDLES ALL SESSION SCENARIOS
// ============================================================================

async function getUserTierFromDB(session: any): Promise<string> {
  if (!session?.user) {
    console.log("[Reports] No session user");
    return "FREE";
  }

  const { email, name, phone } = session.user as any;
  console.log("[Reports] Session data:", { email, name, phone });

  try {
    // Strategy 1: Try by email
    if (email) {
      console.log("[Reports] Trying lookup by email:", email);
      const user = await prisma.consumers.findFirst({
        where: { email: email },
        select: { subscription_tier: true },
      });
      if (user?.subscription_tier) {
        console.log("[Reports] Found by email, tier:", user.subscription_tier);
        return user.subscription_tier.toUpperCase();
      }
    }

    // Strategy 2: Try by phone (if in session)
    if (phone) {
      console.log("[Reports] Trying lookup by phone:", phone);
      const user = await prisma.consumers.findFirst({
        where: { phone_number: phone },
        select: { subscription_tier: true },
      });
      if (user?.subscription_tier) {
        console.log("[Reports] Found by phone, tier:", user.subscription_tier);
        return user.subscription_tier.toUpperCase();
      }
    }

    // Strategy 3: Extract phone suffix from name like "User 5952"
    if (name && name.startsWith("User ")) {
      const phoneSuffix = name.replace("User ", "");
      if (phoneSuffix && /^\d{4,}$/.test(phoneSuffix)) {
        console.log("[Reports] Trying lookup by phone suffix:", phoneSuffix);
        const users = await prisma.$queryRawUnsafe<any[]>(`
          SELECT TOP 1 subscription_tier 
          FROM Consumers 
          WHERE phone_number LIKE '%${phoneSuffix}'
          ORDER BY created_at DESC
        `);

        if (users && users.length > 0 && users[0].subscription_tier) {
          console.log("[Reports] Found by phone suffix, tier:", users[0].subscription_tier);
          return users[0].subscription_tier.toUpperCase();
        }
      }
    }

    // Strategy 4: Try by full_name (when session has actual name, not "User XXXX")
    if (name && !name.startsWith("User ")) {
      console.log("[Reports] Trying lookup by full_name:", name);
      const user = await prisma.consumers.findFirst({
        where: { full_name: name },
        select: { subscription_tier: true },
      });
      if (user?.subscription_tier) {
        console.log("[Reports] Found by full_name, tier:", user.subscription_tier);
        return user.subscription_tier.toUpperCase();
      }

      // Strategy 4b: Try case-insensitive search with raw query
      console.log("[Reports] Trying case-insensitive full_name search");
      const users = await prisma.$queryRawUnsafe<any[]>(`
        SELECT TOP 1 subscription_tier 
        FROM Consumers 
        WHERE LOWER(full_name) = LOWER('${name.replace(/'/g, "''")}')
        ORDER BY created_at DESC
      `);

      if (users && users.length > 0 && users[0].subscription_tier) {
        console.log("[Reports] Found by full_name (case-insensitive), tier:", users[0].subscription_tier);
        return users[0].subscription_tier.toUpperCase();
      }
    }

    console.log("[Reports] User not found with any strategy");
    return "FREE";
  } catch (error: any) {
    console.error("[Reports] Database error:", error.message);
    return "FREE";
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateReportId(): string {
  return `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// GET HANDLER - Fetch report types and user's reports
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userTier = await getUserTierFromDB(session);
    const tierLevel = TIER_ACCESS[userTier] ?? 0;

    // Check minimum tier requirement (GOLD+ can access reports)
    if (tierLevel === 0) {
      return NextResponse.json({
        success: false,
        error: "Reports require GOLD tier or higher",
        currentTier: userTier,
        requiredTier: "GOLD",
        upgradeUrl: "/subscribe",
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "types";

    if (action === "types") {
      // Filter report types based on user tier
      const availableReports = REPORT_TYPES.map((report) => ({
        ...report,
        available: tierLevel >= (TIER_ACCESS[report.tier] ?? 999),
        requiredTier: report.tier,
      }));

      // Get reports per month for this tier
      const reportsPerMonth = TIER_REPORTS[userTier] ?? 0;
      
      // Get schedule limit for this tier
      const scheduleLimit = TIER_SCHEDULE_LIMIT[userTier] ?? 0;
      const canSchedule = scheduleLimit > 0;

      return NextResponse.json({
        success: true,
        userTier,
        tierLevel,
        // Frontend expects these field names:
        reportTypes: availableReports,
        reportsRemaining: reportsPerMonth,
        canSchedule: canSchedule,
        scheduleLimit: scheduleLimit,
        // Also include limits for completeness
        limits: {
          reportsPerMonth: reportsPerMonth,
          scheduledDelivery: canSchedule,
          maxScheduledReports: scheduleLimit,
          apiAccess: userTier === "ENTERPRISE",
        },
      });
    }

    if (action === "history") {
      // Return user's generated reports (placeholder - would fetch from DB)
      return NextResponse.json({
        success: true,
        userTier,
        reports: [],
        message: "Report history will be available after first report generation",
      });
    }

    return NextResponse.json({
      success: false,
      error: "Invalid action",
    }, { status: 400 });
  } catch (error: any) {
    console.error("[Reports API] Error:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error",
    }, { status: 500 });
  }
}

// ============================================================================
// POST HANDLER - Generate a new report
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userTier = await getUserTierFromDB(session);
    const tierLevel = TIER_ACCESS[userTier] ?? 0;

    if (tierLevel === 0) {
      return NextResponse.json({
        success: false,
        error: "Reports require GOLD tier or higher",
        currentTier: userTier,
        requiredTier: "GOLD",
        upgradeUrl: "/subscribe",
      }, { status: 403 });
    }

    const body = await request.json();
    const { reportType, parameters } = body;

    // Validate report type
    const reportConfig = REPORT_TYPES.find((r) => r.id === reportType);
    if (!reportConfig) {
      return NextResponse.json({
        success: false,
        error: "Invalid report type",
      }, { status: 400 });
    }

    // Check tier access for this report
    const requiredLevel = TIER_ACCESS[reportConfig.tier] ?? 999;
    if (tierLevel < requiredLevel) {
      return NextResponse.json({
        success: false,
        error: `This report requires ${reportConfig.tier} tier`,
        currentTier: userTier,
        requiredTier: reportConfig.tier,
        upgradeUrl: "/subscribe",
      }, { status: 403 });
    }

    // Generate report (placeholder - would trigger actual report generation)
    const reportId = generateReportId();
    const generatedAt = new Date();

    // Get reports per month for this tier
    const reportsRemaining = TIER_REPORTS[userTier] ?? 0;

    return NextResponse.json({
      success: true,
      report: {
        id: reportId,
        type: reportType,
        name: reportConfig.name,
        status: "generating",
        generatedAt: generatedAt.toISOString(),
        estimatedCompletion: new Date(generatedAt.getTime() + 30000).toISOString(),
        parameters,
      },
      reportsRemaining: reportsRemaining,
      message: "Report generation started. You will be notified when ready.",
    });
  } catch (error: any) {
    console.error("[Reports API] Error:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error",
    }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
