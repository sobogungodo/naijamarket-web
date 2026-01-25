// ============================================================================
// src/app/api/settings/route.ts
// NaijaMarket Intel - User Settings API
// Version: 1.0.0
// Date: 2026-01-25
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface UserSettings {
  // Profile
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
    role: string;
    avatar: string | null;
  };
  // Subscription
  subscription: {
    tier: string;
    status: string;
    expiresAt: string | null;
    features: string[];
  };
  // Notifications
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
  // Price Alerts
  priceAlerts: {
    enabled: boolean;
    threshold: number; // percentage change to trigger alert
    frequency: "instant" | "hourly" | "daily";
    quietHoursStart: string; // "22:00"
    quietHoursEnd: string; // "07:00"
    maxAlertsPerDay: number;
  };
  // Preferences
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
  // Data & Privacy
  dataPrivacy: {
    shareAnonymousData: boolean;
    allowMarketingEmails: boolean;
    showProfilePublicly: boolean;
    exportFormat: "csv" | "xlsx" | "json";
  };
  // Security
  security: {
    twoFactorEnabled: boolean;
    lastPasswordChange: string | null;
    activeSessions: number;
  };
}

// Default settings for new users
const DEFAULT_SETTINGS: UserSettings = {
  profile: {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    role: "",
    avatar: null,
  },
  subscription: {
    tier: "FREE",
    status: "active",
    expiresAt: null,
    features: ["Basic price access", "3 markets", "Limited history"],
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
    twoFactorEnabled: false,
    lastPasswordChange: null,
    activeSessions: 1,
  },
};

// Tier features mapping
const TIER_FEATURES: Record<string, string[]> = {
  FREE: [
    "Basic price access",
    "3 markets",
    "1 month history",
    "5 price alerts",
  ],
  SILVER: [
    "All FREE features",
    "10 markets",
    "3 month history",
    "20 price alerts",
    "Email notifications",
  ],
  GOLD: [
    "All SILVER features",
    "50 markets",
    "6 month history",
    "Unlimited price alerts",
    "SMS & WhatsApp alerts",
    "NBS comparison data",
    "Regional breakdown",
  ],
  BUSINESS: [
    "All GOLD features",
    "All 226 markets",
    "12 month history",
    "Priority support",
    "Bulk buyer tools",
    "Data export (CSV/Excel)",
    "Custom reports",
  ],
  CORPORATE: [
    "All BUSINESS features",
    "24 month history",
    "Dedicated account manager",
    "Custom integrations",
    "Team access (5 users)",
    "API access (1000 calls/day)",
  ],
  ENTERPRISE: [
    "All CORPORATE features",
    "Unlimited history",
    "White-label options",
    "Unlimited team access",
    "Unlimited API access",
    "Custom SLA",
    "On-premise deployment",
  ],
};

// In-memory storage (replace with database in production)
const userSettingsStore = new Map<string, UserSettings>();

// ============================================================================
// GET - Fetch user settings
// ============================================================================

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.email;
    
    // Get stored settings or create defaults
    let settings = userSettingsStore.get(userId);
    
    if (!settings) {
      // Create default settings with user info from session
      const userTier = ((session.user as { tier?: string })?.tier || "FREE").toUpperCase();
      const tierFeatures = TIER_FEATURES[userTier as keyof typeof TIER_FEATURES] || TIER_FEATURES.FREE;
      
      settings = {
        ...DEFAULT_SETTINGS,
        profile: {
          ...DEFAULT_SETTINGS.profile,
          firstName: session.user.name?.split(" ")[0] || "",
          lastName: session.user.name?.split(" ").slice(1).join(" ") || "",
          email: session.user.email || "",
          phone: (session.user as { phone?: string })?.phone || "",
          avatar: session.user.image || null,
        },
        subscription: {
          ...DEFAULT_SETTINGS.subscription,
          tier: userTier,
          features: tierFeatures,
        },
      };
      
      userSettingsStore.set(userId, settings);
    }

    return NextResponse.json({
      success: true,
      data: settings,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update user settings
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.email;
    const body = await request.json();
    const { section, data } = body;

    // Get existing settings
    let settings = userSettingsStore.get(userId);
    
    if (!settings) {
      settings = { ...DEFAULT_SETTINGS };
    }

    // Update specific section
    if (section && data) {
      switch (section) {
        case "profile":
          settings.profile = { ...settings.profile, ...data };
          break;
        case "notifications":
          settings.notifications = { ...settings.notifications, ...data };
          break;
        case "priceAlerts":
          settings.priceAlerts = { ...settings.priceAlerts, ...data };
          break;
        case "preferences":
          settings.preferences = { ...settings.preferences, ...data };
          break;
        case "dataPrivacy":
          settings.dataPrivacy = { ...settings.dataPrivacy, ...data };
          break;
        case "security":
          settings.security = { ...settings.security, ...data };
          break;
        default:
          // Update entire settings object
          settings = { ...settings, ...data };
      }
    } else if (data) {
      // Full settings update
      settings = { ...settings, ...data };
    }

    // Save settings
    userSettingsStore.set(userId, settings);

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
      data: settings,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Special actions (password change, delete account, etc.)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.email;
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case "changePassword": {
        // Validate password requirements
        const { currentPassword, newPassword, confirmPassword } = data;
        
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

        // In production, verify current password and hash new password
        // For now, just update the last password change date
        const settings = userSettingsStore.get(userId);
        if (settings) {
          settings.security.lastPasswordChange = new Date().toISOString();
          userSettingsStore.set(userId, settings);
        }

        return NextResponse.json({
          success: true,
          message: "Password changed successfully",
        });
      }

      case "enable2FA": {
        const settings = userSettingsStore.get(userId);
        if (settings) {
          settings.security.twoFactorEnabled = true;
          userSettingsStore.set(userId, settings);
        }

        return NextResponse.json({
          success: true,
          message: "Two-factor authentication enabled",
          // In production, return QR code for authenticator app
          qrCode: "data:image/png;base64,mock_qr_code",
          backupCodes: ["ABCD-1234", "EFGH-5678", "IJKL-9012"],
        });
      }

      case "disable2FA": {
        const settings = userSettingsStore.get(userId);
        if (settings) {
          settings.security.twoFactorEnabled = false;
          userSettingsStore.set(userId, settings);
        }

        return NextResponse.json({
          success: true,
          message: "Two-factor authentication disabled",
        });
      }

      case "exportData": {
        // In production, generate and return user data export
        return NextResponse.json({
          success: true,
          message: "Data export initiated",
          downloadUrl: `/api/settings/export?format=${data?.format || "csv"}`,
        });
      }

      case "deleteAccount": {
        const { confirmation } = data;
        
        if (confirmation !== "DELETE MY ACCOUNT") {
          return NextResponse.json(
            { success: false, error: "Invalid confirmation text" },
            { status: 400 }
          );
        }

        // In production, schedule account deletion
        // For now, just remove from memory store
        userSettingsStore.delete(userId);

        return NextResponse.json({
          success: true,
          message: "Account scheduled for deletion. You will be logged out.",
        });
      }

      case "logoutAllSessions": {
        const settings = userSettingsStore.get(userId);
        if (settings) {
          settings.security.activeSessions = 1;
          userSettingsStore.set(userId, settings);
        }

        return NextResponse.json({
          success: true,
          message: "All other sessions have been logged out",
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Unknown action" },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error("Settings POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to perform action" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
