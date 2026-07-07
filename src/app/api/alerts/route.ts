// src/app/api/alerts/route.ts
// NaijaMarket Intel - Price Alerts API (Bloomberg ALRT equivalent)
// Updated: Added current price fetching, fixed SQL injection, singleton Prisma

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Use singleton
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Alert limits by subscription tier
const ALERT_LIMITS: Record<string, number> = {
  FREE: 0,
  SILVER: 0,
  GOLD: 5,
  BUSINESS: 10,
  CORPORATE: 20,
  ENTERPRISE: -1, // Unlimited
  OGA_BOSS: -1,
  GOVERNMENT: -1,
};

// Helper to generate unique ID
function generateAlertId(): string {
  return `ALT${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

// Canonical E.164 (+<digits>) — matches the +prefixed form stored in Consumers.phone_number
function toE164(p: string): string {
  const d = (p || "").replace(/\D/g, "");
  return d ? "+" + d : "";
}

// GET - List alerts for a consumer
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // ACTIVE, TRIGGERED, DELETED

    // Identity + tier derived from the session ONLY — never trust client-supplied
    // phone/consumer_id/tier (middleware already guarantees a valid session).
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
    }
    const consumerId = (session.user as any).id;
    const canonPhone = toE164((session.user as any).phone);
    const noPlus = canonPhone.replace("+", "");
    const tier = ((session.user as any).tier || "FREE").toUpperCase();

    // Build query based on parameters
    let alerts: any[] = [];
    
    try {
      if (status) {
        alerts = await prisma.$queryRaw`
          SELECT * FROM Price_Alerts 
          WHERE (consumer_id = ${consumerId} OR phone_number = ${canonPhone} OR phone_number = ${noPlus})
          AND status = ${status}
          ORDER BY created_at DESC
        ` as any[];
      } else {
        alerts = await prisma.$queryRaw`
          SELECT * FROM Price_Alerts 
          WHERE (consumer_id = ${consumerId} OR phone_number = ${canonPhone} OR phone_number = ${noPlus})
          AND status != 'DELETED'
          ORDER BY created_at DESC
        ` as any[];
      }
    } catch (dbError) {
      // Table might not exist yet - return empty array
      console.warn("Price_Alerts table may not exist:", dbError);
      alerts = [];
    }

    // Enrich alerts with current prices
    const enrichedAlerts = await Promise.all(
      alerts.map(async (alert) => {
        try {
          // Get current price for this item/market
          const currentPriceResult = await prisma.approved_Prices.findFirst({
            where: {
              item_id: alert.item_id,
              market_id: alert.market_id,
              validation_status: "APPROVED",
            },
            orderBy: { validated_at: "desc" },
            select: { price: true, validated_at: true },
          });

          const currentPrice = currentPriceResult ? Number(currentPriceResult.price) : null;
          
          // Check if alert should be triggered
          let shouldTrigger = false;
          if (currentPrice && alert.status === "ACTIVE") {
            if (alert.alert_type === "ABOVE" && currentPrice >= Number(alert.target_price)) {
              shouldTrigger = true;
            } else if (alert.alert_type === "BELOW" && currentPrice <= Number(alert.target_price)) {
              shouldTrigger = true;
            }
          }

          return {
            ...alert,
            current_price: currentPrice,
            last_price_update: currentPriceResult?.validated_at || null,
            should_trigger: shouldTrigger,
            price_diff: currentPrice ? currentPrice - Number(alert.target_price) : null,
            price_diff_percent: currentPrice 
              ? ((currentPrice - Number(alert.target_price)) / Number(alert.target_price) * 100).toFixed(2)
              : null,
          };
        } catch {
          return alert;
        }
      })
    );

    // Count triggered alerts today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let triggeredToday = 0;
    try {
      const triggeredResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM Price_Alerts 
        WHERE (consumer_id = ${consumerId} OR phone_number = ${canonPhone} OR phone_number = ${noPlus})
        AND status = 'TRIGGERED'
        AND triggered_at >= ${today.toISOString()}
      ` as any[];
      triggeredToday = parseInt(triggeredResult[0]?.count || "0");
    } catch {
      triggeredToday = 0;
    }

    // Get tier limit
    const limit = ALERT_LIMITS[tier] ?? 0;
    const activeCount = alerts.filter(a => a.status === "ACTIVE").length;

    return NextResponse.json({
      success: true,
      data: {
        alerts: enrichedAlerts,
        triggeredToday,
        limits: {
          maxAlerts: limit,
          canCreate: limit !== 0 && (limit === -1 || activeCount < limit),
          currentCount: activeCount,
          remaining: limit === -1 ? "Unlimited" : Math.max(0, limit - activeCount),
        },
      },
      count: alerts.length,
      meta: {
        tier,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Get Alerts Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

// POST - Create a new price alert
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      item_id,
      item_name,
      market_id,
      market_name,
      category_id,
      category_name,
      target_price,
      alert_type, // "ABOVE" or "BELOW"
    } = body;

    // Identity + tier derived from the session ONLY (never client-supplied).
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
    }
    const consumerId = (session.user as any).id;
    let canonPhone = toE164((session.user as any).phone);
    let tier = ((session.user as any).tier || "").toUpperCase();
    // One Consumers lookup backfills tier and/or phone when the session lacks them
    // (phone cols are nullable + the func-api mobile registration path is unread).
    let fallbackRow: any = null;
    if (!tier || !canonPhone) {
      const r = await prisma.$queryRaw`SELECT subscription_tier, phone, phone_number FROM Consumers WHERE consumer_id = ${consumerId}` as any[];
      fallbackRow = r[0] || null;
    }
    if (!tier) tier = (fallbackRow?.subscription_tier || "FREE").toUpperCase();
    if (!canonPhone) {
      const cp = (fallbackRow?.phone_number || fallbackRow?.phone || "");
      canonPhone = toE164(cp);
    }
    const noPlus = canonPhone.replace("+", "");

    // Never write an undeliverable alert — Alert_Notifications is phone-keyed, so an
    // empty phone_number would save an alert that silently never fires.
    if (!canonPhone) {
      return NextResponse.json(
        { success: false, error: "A phone number is required to create alerts. Update your profile." },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!item_id || !market_id || !target_price || !alert_type) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: phone, item_id, market_id, target_price, alert_type",
        },
        { status: 400 }
      );
    }

    // Check alert type validity
    const normalizedAlertType = alert_type.toUpperCase();
    if (!["ABOVE", "BELOW"].includes(normalizedAlertType)) {
      return NextResponse.json(
        { success: false, error: "alert_type must be 'ABOVE' or 'BELOW'" },
        { status: 400 }
      );
    }

    // Check tier limit (tier resolved from session above)
    const limit = ALERT_LIMITS[tier] ?? 0;

    if (limit === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Price alerts are not available on the ${tier} plan. Upgrade to GOLD or higher.`,
          upgrade_required: true,
          current_tier: tier,
          required_tier: "GOLD",
        },
        { status: 403 }
      );
    }

    // Count existing active alerts (across consumer_id + both phone formats)
    let currentCount = 0;
    try {
      const existingCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM Price_Alerts
        WHERE (consumer_id = ${consumerId} OR phone_number = ${canonPhone} OR phone_number = ${noPlus})
        AND status = 'ACTIVE'
      ` as any[];
      currentCount = parseInt(existingCount[0]?.count || "0");
    } catch {
      currentCount = 0;
    }

    if (limit !== -1 && currentCount >= limit) {
      return NextResponse.json(
        {
          success: false,
          error: `Alert limit reached (${currentCount}/${limit}). Upgrade your plan for more alerts.`,
          limit_reached: true,
          current_count: currentCount,
          limit: limit,
        },
        { status: 403 }
      );
    }

    // Check for duplicate alert
    try {
      const duplicate = await prisma.$queryRaw`
        SELECT alert_id FROM Price_Alerts
        WHERE (consumer_id = ${consumerId} OR phone_number = ${canonPhone} OR phone_number = ${noPlus})
        AND item_id = ${item_id}
        AND market_id = ${market_id}
        AND alert_type = ${normalizedAlertType}
        AND status = 'ACTIVE'
      ` as any[];

      if (duplicate.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "You already have an active alert for this item/market/type combination",
            existing_alert_id: duplicate[0].alert_id,
          },
          { status: 409 }
        );
      }
    } catch {
      // Ignore if table doesn't exist
    }

    // Create the alert
    const alertId = generateAlertId();
    const now = new Date().toISOString();

    await prisma.$executeRaw`
      INSERT INTO Price_Alerts (
        alert_id, consumer_id, phone_number, item_id, item_name,
        market_id, market_name, category_id, category_name,
        target_price, alert_type, status, created_at, updated_at
      ) VALUES (
        ${alertId}, ${consumerId}, ${canonPhone},
        ${item_id}, ${item_name || null}, ${market_id}, ${market_name || null},
        ${category_id || null}, ${category_name || null}, ${parseFloat(target_price)}, 
        ${normalizedAlertType}, 'ACTIVE', ${now}, ${now}
      )
    `;

    // Get current price for response
    let currentPrice = null;
    try {
      const priceResult = await prisma.approved_Prices.findFirst({
        where: {
          item_id: item_id,
          market_id: market_id,
          validation_status: "APPROVED",
        },
        orderBy: { validated_at: "desc" },
        select: { price: true },
      });
      currentPrice = priceResult ? Number(priceResult.price) : null;
    } catch {
      // Ignore
    }

    return NextResponse.json({
      success: true,
      message: "Price alert created successfully",
      data: {
        alert_id: alertId,
        item_id,
        item_name,
        market_id,
        market_name,
        target_price: parseFloat(target_price),
        current_price: currentPrice,
        alert_type: normalizedAlertType,
        status: "ACTIVE",
        created_at: now,
      },
      alerts_remaining: limit === -1 ? "Unlimited" : limit - currentCount - 1,
    });
  } catch (error) {
    console.error("Create Alert Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create alert" },
      { status: 500 }
    );
  }
}

// DELETE - Delete/deactivate an alert
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get("alert_id");

    if (!alertId) {
      return NextResponse.json(
        { success: false, error: "alert_id is required" },
        { status: 400 }
      );
    }

    // Ownership enforced server-side — a user may only delete their own alerts.
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
    }
    const consumerId = (session.user as any).id;
    const canonPhone = toE164((session.user as any).phone);
    const noPlus = canonPhone.replace("+", "");

    const now = new Date().toISOString();

    // Soft delete scoped to the caller's own alert (consumer_id + both phone forms).
    const affected = await prisma.$executeRaw`
      UPDATE Price_Alerts
      SET status = 'DELETED', updated_at = ${now}
      WHERE alert_id = ${alertId}
      AND (consumer_id = ${consumerId} OR phone_number = ${canonPhone} OR phone_number = ${noPlus})
    `;

    if (!affected) {
      return NextResponse.json(
        { success: false, error: "Alert not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Alert deleted successfully",
      alert_id: alertId,
    });
  } catch (error) {
    console.error("Delete Alert Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete alert" },
      { status: 500 }
    );
  }
}

// PATCH - Update an alert (e.g., change target price)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { alert_id, target_price, alert_type, status } = body;

    if (!alert_id) {
      return NextResponse.json(
        { success: false, error: "alert_id is required" },
        { status: 400 }
      );
    }

    // Ownership enforced server-side — a user may only update their own alerts.
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
    }
    const consumerId = (session.user as any).id;
    const canonPhone = toE164((session.user as any).phone);
    const noPlus = canonPhone.replace("+", "");

    const now = new Date().toISOString();

    // Validate alert_type if provided
    if (alert_type && !["ABOVE", "BELOW"].includes(alert_type.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: "alert_type must be 'ABOVE' or 'BELOW'" },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (status && !["ACTIVE", "TRIGGERED", "PAUSED", "DELETED"].includes(status.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: "status must be 'ACTIVE', 'TRIGGERED', 'PAUSED', or 'DELETED'" },
        { status: 400 }
      );
    }

    // Build and execute update based on what's provided.
    // Every branch scopes the WHERE to the caller's own alert (consumer_id + both phone forms).
    let affected = 0;
    if (target_price !== undefined && alert_type && status) {
      affected = await prisma.$executeRaw`
        UPDATE Price_Alerts
        SET target_price = ${parseFloat(target_price)},
            alert_type = ${alert_type.toUpperCase()},
            status = ${status.toUpperCase()},
            updated_at = ${now}
        WHERE alert_id = ${alert_id}
        AND (consumer_id = ${consumerId} OR phone_number = ${canonPhone} OR phone_number = ${noPlus})
      `;
    } else if (target_price !== undefined) {
      affected = await prisma.$executeRaw`
        UPDATE Price_Alerts
        SET target_price = ${parseFloat(target_price)}, updated_at = ${now}
        WHERE alert_id = ${alert_id}
        AND (consumer_id = ${consumerId} OR phone_number = ${canonPhone} OR phone_number = ${noPlus})
      `;
    } else if (alert_type) {
      affected = await prisma.$executeRaw`
        UPDATE Price_Alerts
        SET alert_type = ${alert_type.toUpperCase()}, updated_at = ${now}
        WHERE alert_id = ${alert_id}
        AND (consumer_id = ${consumerId} OR phone_number = ${canonPhone} OR phone_number = ${noPlus})
      `;
    } else if (status) {
      const triggeredAt = status.toUpperCase() === "TRIGGERED" ? now : null;
      affected = await prisma.$executeRaw`
        UPDATE Price_Alerts
        SET status = ${status.toUpperCase()},
            triggered_at = ${triggeredAt},
            updated_at = ${now}
        WHERE alert_id = ${alert_id}
        AND (consumer_id = ${consumerId} OR phone_number = ${canonPhone} OR phone_number = ${noPlus})
      `;
    } else {
      affected = await prisma.$executeRaw`
        UPDATE Price_Alerts
        SET updated_at = ${now}
        WHERE alert_id = ${alert_id}
        AND (consumer_id = ${consumerId} OR phone_number = ${canonPhone} OR phone_number = ${noPlus})
      `;
    }

    if (!affected) {
      return NextResponse.json(
        { success: false, error: "Alert not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Alert updated successfully",
      alert_id,
      updated_at: now,
    });
  } catch (error) {
    console.error("Update Alert Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update alert" },
      { status: 500 }
    );
  }
}
