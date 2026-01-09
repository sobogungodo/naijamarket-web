// src/app/api/alerts/route.ts
// NaijaMarket Intel - Price Alerts API (Bloomberg ALRT equivalent)
// Updated: Added current price fetching, fixed SQL injection, singleton Prisma

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Use singleton

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

// Helper to sanitize phone number
function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

// GET - List alerts for a consumer
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");
    const consumerId = searchParams.get("consumer_id");
    const status = searchParams.get("status"); // ACTIVE, TRIGGERED, DELETED
    const tier = (searchParams.get("tier") || "FREE").toUpperCase();

    if (!phone && !consumerId) {
      return NextResponse.json(
        { success: false, error: "Phone or consumer_id is required" },
        { status: 400 }
      );
    }

    const sanitizedPhone = phone ? sanitizePhone(phone) : null;

    // Build query based on parameters
    let alerts: any[] = [];
    
    try {
      if (status) {
        alerts = await prisma.$queryRaw`
          SELECT * FROM Price_Alerts 
          WHERE (phone_number = ${sanitizedPhone} OR consumer_id = ${consumerId})
          AND status = ${status}
          ORDER BY created_at DESC
        ` as any[];
      } else {
        alerts = await prisma.$queryRaw`
          SELECT * FROM Price_Alerts 
          WHERE (phone_number = ${sanitizedPhone} OR consumer_id = ${consumerId})
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
        WHERE (phone_number = ${sanitizedPhone} OR consumer_id = ${consumerId})
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
      phone,
      consumer_id,
      item_id,
      item_name,
      market_id,
      market_name,
      category_id,
      category_name,
      target_price,
      alert_type, // "ABOVE" or "BELOW"
      subscription_tier = "FREE",
    } = body;

    // Validate required fields
    if (!phone || !item_id || !market_id || !target_price || !alert_type) {
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

    // Check tier limit
    const tier = subscription_tier.toUpperCase();
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

    const sanitizedPhone = sanitizePhone(phone);

    // Count existing active alerts
    let currentCount = 0;
    try {
      const existingCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM Price_Alerts 
        WHERE phone_number = ${sanitizedPhone}
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
        WHERE phone_number = ${sanitizedPhone}
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
        ${alertId}, ${consumer_id || null}, ${sanitizedPhone}, 
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
    const phone = searchParams.get("phone");

    if (!alertId) {
      return NextResponse.json(
        { success: false, error: "alert_id is required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Soft delete - set status to DELETED (use parameterized query to prevent SQL injection)
    if (phone) {
      const sanitizedPhone = sanitizePhone(phone);
      await prisma.$executeRaw`
        UPDATE Price_Alerts 
        SET status = 'DELETED', updated_at = ${now}
        WHERE alert_id = ${alertId}
        AND phone_number = ${sanitizedPhone}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE Price_Alerts 
        SET status = 'DELETED', updated_at = ${now}
        WHERE alert_id = ${alertId}
      `;
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
    const { alert_id, phone, target_price, alert_type, status } = body;

    if (!alert_id) {
      return NextResponse.json(
        { success: false, error: "alert_id is required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const sanitizedPhone = phone ? sanitizePhone(phone) : null;

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

    // Build and execute update based on what's provided
    // Using separate queries to avoid SQL injection while keeping flexibility
    if (target_price !== undefined && alert_type && status) {
      await prisma.$executeRaw`
        UPDATE Price_Alerts 
        SET target_price = ${parseFloat(target_price)},
            alert_type = ${alert_type.toUpperCase()},
            status = ${status.toUpperCase()},
            updated_at = ${now}
        WHERE alert_id = ${alert_id}
        ${sanitizedPhone ? prisma.$executeRaw`AND phone_number = ${sanitizedPhone}` : prisma.$executeRaw``}
      `;
    } else if (target_price !== undefined) {
      await prisma.$executeRaw`
        UPDATE Price_Alerts 
        SET target_price = ${parseFloat(target_price)}, updated_at = ${now}
        WHERE alert_id = ${alert_id}
      `;
    } else if (alert_type) {
      await prisma.$executeRaw`
        UPDATE Price_Alerts 
        SET alert_type = ${alert_type.toUpperCase()}, updated_at = ${now}
        WHERE alert_id = ${alert_id}
      `;
    } else if (status) {
      const triggeredAt = status.toUpperCase() === "TRIGGERED" ? now : null;
      await prisma.$executeRaw`
        UPDATE Price_Alerts 
        SET status = ${status.toUpperCase()}, 
            triggered_at = ${triggeredAt},
            updated_at = ${now}
        WHERE alert_id = ${alert_id}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE Price_Alerts 
        SET updated_at = ${now}
        WHERE alert_id = ${alert_id}
      `;
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
