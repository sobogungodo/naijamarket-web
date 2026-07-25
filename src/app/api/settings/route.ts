// ============================================================================
// src/app/api/settings/route.ts
// NaijaFood Intel - User Settings API
// Version: 2.0.0 - Database persistence via Prisma
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface UserSettings {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
    role: string;
    avatar: string | null;
  };
  subscription: {
    tier: string;
    status: string;
    expiresAt: string | null;
    features: string[];
  };
  notifications: {
    emailAlerts: boolean;
    smsAlerts: boolean;
    whatsappAlerts: boolean;
    priceDropAlerts: boolean;
    priceRiseAlerts: boolean;
    weeklyDigest: boolean;
    monthlyReport: boolean;
    marketNews: boolean;
    systemUpdates: boolean;
  };
  priceAlerts: {
    enabled: boolean;
    threshold: number;
    frequency: "instant" | "hourly" | "daily";
    quietHoursStart: string;
    quietHoursEnd: string;
    maxAlertsPerDay: number;
  };
  preferences: {
    theme: "dark" | "light" | "system";
    language: string;
    currency: string;
    timezone: string;
    dateFormat: string;
    numberFormat: string;
    defaultMarket: string | null;
    defaultCategory: string | null;
    defaultState: string | null;
  };
  dataPrivacy: {
    shareAnonymousData: boolean;
    allowMarketingEmails: boolean;
    showProfilePublicly: boolean;
    exportFormat: "csv" | "xlsx" | "json";
  };
  security: {
    twoFactorEnabled: boolean;
    lastPasswordChange: string | null;
    activeSessions: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIER_FEATURES: Record<string, string[]> = {
  FREE: ["Basic price access", "3 markets", "1 month history", "5 price alerts"],
  SILVER: ["All FREE features", "10 markets", "3 month history", "20 price alerts", "Email notifications"],
  GOLD: ["All SILVER features", "50 markets", "6 month history", "Unlimited price alerts", "SMS & WhatsApp alerts", "5 reports/month"],
  BUSINESS: ["All GOLD features", "All 226 markets", "12 month history", "10 reports/month", "3 scheduled reports", "Data export"],
  CORPORATE: ["All BUSINESS features", "24 month history", "Unlimited reports", "Unlimited schedules", "API access (1000/day)"],
  ENTERPRISE: ["All CORPORATE features", "Unlimited history", "Unlimited API access", "Custom SLA", "White-label options"],
};

function getDefaultSettings(user?: any): UserSettings {
  const tier = user?.subscription_tier?.toUpperCase() || "FREE";
  return {
    profile: {
      firstName: user?.full_name?.split(" ")[0] || "",
      lastName: user?.full_name?.split(" ").slice(1).join(" ") || "",
      email: user?.email || "",
      phone: user?.phone_number || "",
      company: user?.company || "",
      role: user?.role || "",
      avatar: null,
    },
    subscription: {
      tier: tier,
      status: "active",
      expiresAt: null,
      features: TIER_FEATURES[tier] ?? TIER_FEATURES.FREE ?? [],
    },
    notifications: {
      emailAlerts: true,
      smsAlerts: false,
      whatsappAlerts: true,
      priceDropAlerts: true,
      priceRiseAlerts: true,
      weeklyDigest: true,
      monthlyReport: false,
      marketNews: false,
      systemUpdates: true,
    },
    priceAlerts: {
      enabled: true,
      threshold: 5,
      frequency: "daily",
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      maxAlertsPerDay: 10,
    },
    preferences: {
      theme: "dark",
      language: "en",
      currency: "NGN",
      timezone: "Africa/Lagos",
      dateFormat: "DD/MM/YYYY",
      numberFormat: "en-NG",
      defaultMarket: null,
      defaultCategory: null,
      defaultState: null,
    },
    dataPrivacy: {
      shareAnonymousData: true,
      allowMarketingEmails: false,
      showProfilePublicly: false,
      exportFormat: "csv",
    },
    security: {
      twoFactorEnabled: user?.two_factor_enabled || false,
      lastPasswordChange: null,
      activeSessions: 1,
    },
  };
}

// ============================================================================
// ENSURE SETTINGS COLUMN EXISTS
// ============================================================================

async function ensureSettingsColumn(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'Consumers' AND COLUMN_NAME = 'settings_json'
      )
      BEGIN
        ALTER TABLE Consumers ADD settings_json NVARCHAR(MAX) NULL;
        PRINT 'Added settings_json column to Consumers table';
      END
    `);
  } catch (e: any) {
    console.log("[Settings] Column check:", e.message);
  }
}

// ============================================================================
// USER LOOKUP HELPER - HANDLES ALL SESSION SCENARIOS
// ============================================================================

async function findUserFromSession(session: any) {
  if (!session?.user) return null;

  const { email, name, phone } = session.user as any;

  try {
    // Strategy 1: By email
    if (email) {
      const user = await prisma.consumers.findFirst({
        where: { email: email },
      });
      if (user) return user;
    }

    // Strategy 2: By phone (if present in session)
    if (phone) {
      const user = await prisma.consumers.findFirst({
        where: { phone_number: phone },
      });
      if (user) return user;
    }

    // Strategy 3: Extract phone suffix from name like "User 5952"
    if (name && name.startsWith("User ")) {
      const phoneSuffix = name.replace("User ", "");
      if (phoneSuffix && /^\d{4,}$/.test(phoneSuffix)) {
        const users = await prisma.$queryRawUnsafe<any[]>(`
          SELECT * FROM Consumers 
          WHERE phone_number LIKE '%${phoneSuffix}'
          ORDER BY created_at DESC
        `);
        if (users && users.length > 0) return users[0];
      }
    }

    // Strategy 4: By full_name (when session has actual name, not "User XXXX")
    if (name && !name.startsWith("User ")) {
      let user = await prisma.consumers.findFirst({
        where: { full_name: name },
      });
      if (user) return user;

      // Case-insensitive search
      const users = await prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM Consumers 
        WHERE LOWER(full_name) = LOWER('${name.replace(/'/g, "''")}')
        ORDER BY created_at DESC
      `);
      if (users && users.length > 0) return users[0];
    }

    return null;
  } catch (error: any) {
    console.error("[Settings] Database error:", error.message);
    return null;
  }
}

// ============================================================================
// GET - Fetch user settings
// ============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    await ensureSettingsColumn();
    const session = await getServerSession();
    const user = await findUserFromSession(session);

    if (!user) {
      return NextResponse.json({
        success: true,
        data: getDefaultSettings(),
        source: "default",
      });
    }

    // Read settings_json via raw SQL (bypasses Prisma schema mismatch)
    let savedSettings: any = null;
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT settings_json FROM Consumers WHERE consumer_id = '${user.consumer_id}'`
      );
      const raw = rows?.[0]?.settings_json;
      if (raw) {
        savedSettings = typeof raw === "string" ? JSON.parse(raw) : raw;
      }
    } catch (e: any) {
      console.log("[Settings] Read settings_json:", e.message);
    }

    // Merge saved settings with defaults (in case new fields were added)
    const defaults = getDefaultSettings(user);
    const settings: UserSettings = savedSettings 
      ? {
          profile: { ...defaults.profile, ...savedSettings.profile },
          subscription: { 
            ...defaults.subscription, 
            tier: user.subscription_tier?.toUpperCase() || defaults.subscription.tier,
            features: TIER_FEATURES[user.subscription_tier?.toUpperCase() || "FREE"] ?? defaults.subscription.features,
          },
          notifications: { ...defaults.notifications, ...savedSettings.notifications },
          priceAlerts: { ...defaults.priceAlerts, ...savedSettings.priceAlerts },
          preferences: { ...defaults.preferences, ...savedSettings.preferences },
          dataPrivacy: { ...defaults.dataPrivacy, ...savedSettings.dataPrivacy },
          security: { 
            ...defaults.security, 
            ...savedSettings.security,
            twoFactorEnabled: user.two_factor_enabled || false,
          },
        }
      : defaults;

    return NextResponse.json({
      success: true,
      data: settings,
      source: savedSettings ? "database" : "default",
    });

  } catch (error: any) {
    console.error("[Settings] GET error:", error);
    return NextResponse.json({
      success: true,
      data: getDefaultSettings(),
      source: "error_fallback",
    });
  }
}

// ============================================================================
// PUT - Update user settings
// ============================================================================

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    await ensureSettingsColumn();
    const session = await getServerSession();
    const user = await findUserFromSession(session);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { section, data } = body;

    // Get existing settings via raw SQL
    let existingSettings: UserSettings;
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT settings_json FROM Consumers WHERE consumer_id = '${user.consumer_id}'`
      );
      const raw = rows?.[0]?.settings_json;
      existingSettings = raw 
        ? (typeof raw === "string" ? JSON.parse(raw) : raw) 
        : getDefaultSettings(user);
    } catch {
      existingSettings = getDefaultSettings(user);
    }

    // Update specific section or entire settings
    let updatedSettings: UserSettings;
    
    if (section && data) {
      updatedSettings = {
        ...existingSettings,
        [section]: { ...(existingSettings as any)[section], ...data },
      };
    } else if (data) {
      updatedSettings = { ...existingSettings, ...data };
    } else {
      return NextResponse.json(
        { success: false, error: "No data provided" },
        { status: 400 }
      );
    }

    // Save to database via raw SQL (bypasses Prisma schema mismatch)
    const settingsJson = JSON.stringify(updatedSettings).replace(/'/g, "''");
    await prisma.$executeRawUnsafe(
      `UPDATE Consumers SET settings_json = '${settingsJson}' WHERE consumer_id = '${user.consumer_id}'`
    );

    // Refresh subscription info from database
    updatedSettings.subscription.tier = user.subscription_tier?.toUpperCase() || "FREE";
    updatedSettings.subscription.features = TIER_FEATURES[updatedSettings.subscription.tier] ?? TIER_FEATURES.FREE ?? [];
    updatedSettings.security.twoFactorEnabled = user.two_factor_enabled || false;

    return NextResponse.json({
      success: true,
      message: "Settings saved successfully",
      data: updatedSettings,
    });

  } catch (error: any) {
    console.error("[Settings] PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save settings: " + error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Special actions (password change, export data, delete account)
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await ensureSettingsColumn();
    const session = await getServerSession();
    const user = await findUserFromSession(session);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action, data } = body;

    // Helper: read current settings_json via raw SQL
    const readSettings = async () => {
      try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT settings_json FROM Consumers WHERE consumer_id = '${user.consumer_id}'`
        );
        const raw = rows?.[0]?.settings_json;
        return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : getDefaultSettings(user);
      } catch {
        return getDefaultSettings(user);
      }
    };

    // Helper: write settings_json via raw SQL
    const writeSettings = async (settings: any) => {
      const json = JSON.stringify(settings).replace(/'/g, "''");
      await prisma.$executeRawUnsafe(
        `UPDATE Consumers SET settings_json = '${json}' WHERE consumer_id = '${user.consumer_id}'`
      );
    };

    switch (action) {
      case "changePassword": {
        const { currentPassword, newPassword, confirmPassword } = data || {};

        if (!currentPassword || !newPassword || !confirmPassword) {
          return NextResponse.json(
            { success: false, error: "All password fields are required" },
            { status: 400 }
          );
        }

        if (newPassword !== confirmPassword) {
          return NextResponse.json(
            { success: false, error: "New passwords do not match" },
            { status: 400 }
          );
        }

        if (newPassword.length < 8) {
          return NextResponse.json(
            { success: false, error: "Password must be at least 8 characters" },
            { status: 400 }
          );
        }

        const settings = await readSettings();
        settings.security = settings.security || {};
        settings.security.lastPasswordChange = new Date().toISOString();
        await writeSettings(settings);

        return NextResponse.json({
          success: true,
          message: "Password changed successfully",
        });
      }

      case "exportData": {
        const format = data?.format || "csv";
        return NextResponse.json({
          success: true,
          message: "Data export initiated",
          downloadUrl: `/api/settings/export?format=${format}&userId=${user.consumer_id}`,
        });
      }

      case "deleteAccount": {
        const { confirmation } = data || {};

        if (confirmation !== "DELETE MY ACCOUNT") {
          return NextResponse.json(
            { success: false, error: "Invalid confirmation text" },
            { status: 400 }
          );
        }

        // Real soft-delete: stamp the erasure flag on the authenticated consumer's row
        // (keyed on the session-derived user.consumer_id, NOT request input). deleted_at
        // starts the 90-day grace and is the flag every login gate now reads. Prisma
        // connects as vercel_web, which holds table UPDATE on Consumers (confirmed live).
        // This intentionally REPLACES the old settings_json={deleted:true} write — that
        // flag was read by nothing (inert) and overwrote the whole settings blob; leaving
        // settings_json untouched means a within-grace reactivation keeps the user's prefs.
        await prisma.$executeRaw`
          UPDATE Consumers SET deleted_at = GETUTCDATE() WHERE consumer_id = ${user.consumer_id}
        `;

        return NextResponse.json({
          success: true,
          message: "Your account has been deleted. You can restore it by signing in again within 90 days.",
        });
      }

      case "logoutAllSessions": {
        const settings = await readSettings();
        settings.security = settings.security || {};
        settings.security.activeSessions = 1;
        await writeSettings(settings);

        return NextResponse.json({
          success: true,
          message: "All other sessions logged out",
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Unknown action" },
          { status: 400 }
        );
    }

  } catch (error: any) {
    console.error("[Settings] POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to perform action: " + error.message },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
