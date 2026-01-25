// ============================================================================
// src/app/api/reports/schedule/route.ts
// NaijaMarket Intel - Scheduled Report Delivery API
// Version: 1.0.0
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ScheduledReport {
  id: string;
  userId: string;
  reportType: "weekly" | "monthly" | "regional" | "inflation" | "custom";
  format: "pdf" | "excel" | "html";
  frequency: "daily" | "weekly" | "monthly";
  deliveryMethod: "email" | "whatsapp" | "both";
  deliveryAddress: {
    email?: string;
    phone?: string;
  };
  deliveryTime: string; // HH:MM format
  deliveryDay?: number; // 0-6 for weekly (0=Sunday), 1-31 for monthly
  timezone: string;
  nextDelivery: string;
  lastDelivery: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateScheduleRequest {
  reportType: "weekly" | "monthly" | "regional" | "inflation" | "custom";
  format: "pdf" | "excel" | "html";
  frequency: "daily" | "weekly" | "monthly";
  deliveryMethod: "email" | "whatsapp" | "both";
  email?: string;
  phone?: string;
  deliveryTime: string;
  deliveryDay?: number;
  timezone?: string;
}

interface UpdateScheduleRequest {
  isActive?: boolean;
  format?: string;
  frequency?: string;
  deliveryMethod?: string;
  email?: string;
  phone?: string;
  deliveryTime?: string;
  deliveryDay?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIER_ACCESS: Record<string, boolean> = {
  FREE: false,
  SILVER: false,
  GOLD: false,
  BUSINESS: false,
  CORPORATE: true,
  ENTERPRISE: true,
};

const REPORT_TYPE_NAMES: Record<string, string> = {
  weekly: "Weekly Market Summary",
  monthly: "Monthly Commodity Analysis",
  regional: "Regional Price Report",
  inflation: "Inflation Comparison Report",
  custom: "Custom Date Range Report",
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Every day",
  weekly: "Every week",
  monthly: "Every month",
};

// In-memory storage (replace with database in production)
const scheduledReportsStore = new Map<string, ScheduledReport[]>();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function canScheduleDelivery(tier: string): boolean {
  return TIER_ACCESS[tier.toUpperCase()] ?? false;
}

function generateScheduleId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `SCH-${timestamp}-${random}`.toUpperCase();
}

function calculateNextDelivery(
  frequency: string,
  deliveryTime: string,
  deliveryDay?: number,
  timezone: string = "Africa/Lagos"
): Date {
  const now = new Date();
  const [hours, minutes] = deliveryTime.split(":").map(Number);

  const next = new Date();
  next.setHours(hours, minutes, 0, 0);

  // If time has passed today, move to next occurrence
  if (next <= now) {
    switch (frequency) {
      case "daily":
        next.setDate(next.getDate() + 1);
        break;
      case "weekly":
        next.setDate(next.getDate() + 7);
        if (deliveryDay !== undefined) {
          const currentDay = next.getDay();
          const daysUntilTarget = (deliveryDay - currentDay + 7) % 7;
          next.setDate(next.getDate() - 7 + daysUntilTarget);
          if (next <= now) {
            next.setDate(next.getDate() + 7);
          }
        }
        break;
      case "monthly":
        next.setMonth(next.getMonth() + 1);
        if (deliveryDay !== undefined) {
          next.setDate(Math.min(deliveryDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
        }
        break;
    }
  } else if (frequency === "weekly" && deliveryDay !== undefined) {
    const currentDay = next.getDay();
    const daysUntilTarget = (deliveryDay - currentDay + 7) % 7;
    if (daysUntilTarget > 0) {
      next.setDate(next.getDate() + daysUntilTarget);
    }
  } else if (frequency === "monthly" && deliveryDay !== undefined) {
    const targetDay = Math.min(deliveryDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate());
    if (next.getDate() !== targetDay) {
      if (next.getDate() > targetDay) {
        next.setMonth(next.getMonth() + 1);
      }
      next.setDate(Math.min(deliveryDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
    }
  }

  return next;
}

function formatNextDelivery(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  };
  return date.toLocaleDateString("en-NG", options) + " WAT";
}

function validateDeliveryAddress(
  method: string,
  email?: string,
  phone?: string
): { valid: boolean; error?: string } {
  if (method === "email" || method === "both") {
    if (!email || !email.includes("@")) {
      return { valid: false, error: "Valid email address required" };
    }
  }

  if (method === "whatsapp" || method === "both") {
    if (!phone || phone.length < 10) {
      return { valid: false, error: "Valid phone number required for WhatsApp delivery" };
    }
  }

  return { valid: true };
}

// ============================================================================
// GET - List user's scheduled reports
// ============================================================================

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession();

  // Get user tier
  const userTier = ((session?.user as { tier?: string })?.tier || "FREE").toUpperCase();
  const userId = session?.user?.email || "demo-user";

  // Check access
  if (!canScheduleDelivery(userTier)) {
    return NextResponse.json({
      success: false,
      error: "Scheduled delivery requires CORPORATE tier or higher",
      currentTier: userTier,
      requiredTier: "CORPORATE",
      upgradeUrl: "/subscribe",
    }, { status: 403 });
  }

  // Get user's schedules
  const userSchedules = scheduledReportsStore.get(userId) || [];

  return NextResponse.json({
    success: true,
    schedules: userSchedules,
    count: userSchedules.length,
    maxSchedules: userTier === "ENTERPRISE" ? 20 : 5,
    reportTypes: Object.entries(REPORT_TYPE_NAMES).map(([id, name]) => ({ id, name })),
    frequencies: Object.entries(FREQUENCY_LABELS).map(([id, label]) => ({ id, label })),
  });
}

// ============================================================================
// POST - Create new scheduled report
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();

  // Get user tier
  const userTier = ((session?.user as { tier?: string })?.tier || "FREE").toUpperCase();
  const userId = session?.user?.email || "demo-user";

  // Check access
  if (!canScheduleDelivery(userTier)) {
    return NextResponse.json({
      success: false,
      error: "Scheduled delivery requires CORPORATE tier or higher",
      currentTier: userTier,
      requiredTier: "CORPORATE",
      upgradeUrl: "/subscribe",
    }, { status: 403 });
  }

  try {
    const body: CreateScheduleRequest = await request.json();
    const {
      reportType,
      format,
      frequency,
      deliveryMethod,
      email,
      phone,
      deliveryTime,
      deliveryDay,
      timezone = "Africa/Lagos",
    } = body;

    // Validate report type
    if (!REPORT_TYPE_NAMES[reportType]) {
      return NextResponse.json({
        success: false,
        error: "Invalid report type",
        validTypes: Object.keys(REPORT_TYPE_NAMES),
      }, { status: 400 });
    }

    // Validate format
    if (!["pdf", "excel", "html"].includes(format)) {
      return NextResponse.json({
        success: false,
        error: "Invalid format. Use: pdf, excel, or html",
      }, { status: 400 });
    }

    // Validate frequency
    if (!["daily", "weekly", "monthly"].includes(frequency)) {
      return NextResponse.json({
        success: false,
        error: "Invalid frequency. Use: daily, weekly, or monthly",
      }, { status: 400 });
    }

    // Validate delivery method
    if (!["email", "whatsapp", "both"].includes(deliveryMethod)) {
      return NextResponse.json({
        success: false,
        error: "Invalid delivery method. Use: email, whatsapp, or both",
      }, { status: 400 });
    }

    // Validate delivery address
    const addressValidation = validateDeliveryAddress(deliveryMethod, email, phone);
    if (!addressValidation.valid) {
      return NextResponse.json({
        success: false,
        error: addressValidation.error,
      }, { status: 400 });
    }

    // Validate delivery time format
    if (!/^\d{2}:\d{2}$/.test(deliveryTime)) {
      return NextResponse.json({
        success: false,
        error: "Invalid delivery time format. Use HH:MM (e.g., 09:00)",
      }, { status: 400 });
    }

    // Check schedule limit
    const userSchedules = scheduledReportsStore.get(userId) || [];
    const maxSchedules = userTier === "ENTERPRISE" ? 20 : 5;
    if (userSchedules.length >= maxSchedules) {
      return NextResponse.json({
        success: false,
        error: `Maximum ${maxSchedules} scheduled reports allowed for ${userTier} tier`,
        currentCount: userSchedules.length,
        maxSchedules,
      }, { status: 429 });
    }

    // Calculate next delivery
    const nextDeliveryDate = calculateNextDelivery(frequency, deliveryTime, deliveryDay, timezone);

    // Create schedule
    const schedule: ScheduledReport = {
      id: generateScheduleId(),
      userId,
      reportType: reportType as ScheduledReport["reportType"],
      format: format as ScheduledReport["format"],
      frequency: frequency as ScheduledReport["frequency"],
      deliveryMethod: deliveryMethod as ScheduledReport["deliveryMethod"],
      deliveryAddress: {
        email: email || undefined,
        phone: phone || undefined,
      },
      deliveryTime,
      deliveryDay,
      timezone,
      nextDelivery: nextDeliveryDate.toISOString(),
      lastDelivery: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save schedule
    userSchedules.push(schedule);
    scheduledReportsStore.set(userId, userSchedules);

    return NextResponse.json({
      success: true,
      schedule,
      message: `Scheduled ${REPORT_TYPE_NAMES[reportType]} for ${FREQUENCY_LABELS[frequency]} delivery`,
      nextDeliveryFormatted: formatNextDelivery(nextDeliveryDate),
    });
  } catch (error) {
    console.error("Schedule creation error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to create schedule",
    }, { status: 500 });
  }
}

// ============================================================================
// PUT - Update scheduled report
// ============================================================================

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();

  // Get user tier
  const userTier = ((session?.user as { tier?: string })?.tier || "FREE").toUpperCase();
  const userId = session?.user?.email || "demo-user";

  // Check access
  if (!canScheduleDelivery(userTier)) {
    return NextResponse.json({
      success: false,
      error: "Scheduled delivery requires CORPORATE tier or higher",
      currentTier: userTier,
      requiredTier: "CORPORATE",
      upgradeUrl: "/subscribe",
    }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const scheduleId = searchParams.get("id");

    if (!scheduleId) {
      return NextResponse.json({
        success: false,
        error: "Schedule ID required",
      }, { status: 400 });
    }

    const body: UpdateScheduleRequest = await request.json();
    const userSchedules = scheduledReportsStore.get(userId) || [];
    const scheduleIndex = userSchedules.findIndex(s => s.id === scheduleId);

    if (scheduleIndex === -1) {
      return NextResponse.json({
        success: false,
        error: "Schedule not found",
      }, { status: 404 });
    }

    const schedule = userSchedules[scheduleIndex];

    // Update fields
    if (body.isActive !== undefined) schedule.isActive = body.isActive;
    if (body.format) schedule.format = body.format as ScheduledReport["format"];
    if (body.frequency) schedule.frequency = body.frequency as ScheduledReport["frequency"];
    if (body.deliveryMethod) schedule.deliveryMethod = body.deliveryMethod as ScheduledReport["deliveryMethod"];
    if (body.email) schedule.deliveryAddress.email = body.email;
    if (body.phone) schedule.deliveryAddress.phone = body.phone;
    if (body.deliveryTime) schedule.deliveryTime = body.deliveryTime;
    if (body.deliveryDay !== undefined) schedule.deliveryDay = body.deliveryDay;

    // Recalculate next delivery if timing changed
    if (body.frequency || body.deliveryTime || body.deliveryDay !== undefined) {
      const nextDeliveryDate = calculateNextDelivery(
        schedule.frequency,
        schedule.deliveryTime,
        schedule.deliveryDay,
        schedule.timezone
      );
      schedule.nextDelivery = nextDeliveryDate.toISOString();
    }

    schedule.updatedAt = new Date().toISOString();

    // Save
    userSchedules[scheduleIndex] = schedule;
    scheduledReportsStore.set(userId, userSchedules);

    return NextResponse.json({
      success: true,
      schedule,
      message: "Schedule updated successfully",
    });
  } catch (error) {
    console.error("Schedule update error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to update schedule",
    }, { status: 500 });
  }
}

// ============================================================================
// DELETE - Remove scheduled report
// ============================================================================

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();

  // Get user tier
  const userTier = ((session?.user as { tier?: string })?.tier || "FREE").toUpperCase();
  const userId = session?.user?.email || "demo-user";

  // Check access
  if (!canScheduleDelivery(userTier)) {
    return NextResponse.json({
      success: false,
      error: "Scheduled delivery requires CORPORATE tier or higher",
      currentTier: userTier,
      requiredTier: "CORPORATE",
      upgradeUrl: "/subscribe",
    }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const scheduleId = searchParams.get("id");

  if (!scheduleId) {
    return NextResponse.json({
      success: false,
      error: "Schedule ID required",
    }, { status: 400 });
  }

  const userSchedules = scheduledReportsStore.get(userId) || [];
  const scheduleIndex = userSchedules.findIndex(s => s.id === scheduleId);

  if (scheduleIndex === -1) {
    return NextResponse.json({
      success: false,
      error: "Schedule not found",
    }, { status: 404 });
  }

  const deletedSchedule = userSchedules[scheduleIndex];
  userSchedules.splice(scheduleIndex, 1);
  scheduledReportsStore.set(userId, userSchedules);

  return NextResponse.json({
    success: true,
    message: `Scheduled ${REPORT_TYPE_NAMES[deletedSchedule.reportType]} deleted`,
    deletedId: scheduleId,
  });
}

export const dynamic = "force-dynamic";
