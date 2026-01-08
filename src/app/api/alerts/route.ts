// src/app/api/alerts/route.ts
// NaijaMarket Intel - Price Alerts API (Bloomberg ALRT equivalent)

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Alert limits by subscription tier
const ALERT_LIMITS: Record<string, number> = {
  FREE: 0,
  SILVER: 0,
  GOLD: 5,
  BUSINESS: 10,
  CORPORATE: 20,
  ENTERPRISE: -1, // Unlimited
};

// Helper to generate unique ID
function generateAlertId(): string {
  return `ALT${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

// GET - List alerts for a consumer
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");
    const consumerId = searchParams.get("consumer_id");
    const status = searchParams.get("status"); // ACTIVE, TRIGGERED, DELETED

    if (!phone && !consumerId) {
      return NextResponse.json(
        { success: false, error: "Phone or consumer_id is required" },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = {};
    if (phone) where.phone_number = phone.replace(/\D/g, "");
    if (consumerId) where.consumer_id = consumerId;
    if (status) where.status = status;

    // Note: You'll need to create a Price_Alerts table in your database
    // For now, returning mock structure
    const alerts = await prisma.$queryRaw`
      SELECT * FROM Price_Alerts 
      WHERE (phone_number = ${phone} OR consumer_id = ${consumerId})
      ${status ? `AND status = '${status}'` : ""}
      ORDER BY created_at DESC
    ` as any[];

    return NextResponse.json({
      success: true,
      data: alerts,
      count: alerts.length,
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
    if (!["ABOVE", "BELOW"].includes(alert_type)) {
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

    // Count existing active alerts
    const existingCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM Price_Alerts 
      WHERE phone_number = ${phone.replace(/\D/g, "")} 
      AND status = 'ACTIVE'
    ` as any[];

    const currentCount = parseInt(existingCount[0]?.count || "0");

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

    // Create the alert
    const alertId = generateAlertId();
    const now = new Date().toISOString();

    await prisma.$executeRaw`
      INSERT INTO Price_Alerts (
        alert_id, consumer_id, phone_number, item_id, item_name,
        market_id, market_name, category_id, category_name,
        target_price, alert_type, status, created_at, updated_at
      ) VALUES (
        ${alertId}, ${consumer_id}, ${phone.replace(/\D/g, "")}, 
        ${item_id}, ${item_name}, ${market_id}, ${market_name},
        ${category_id}, ${category_name}, ${target_price}, 
        ${alert_type}, 'ACTIVE', ${now}, ${now}
      )
    `;

    return NextResponse.json({
      success: true,
      message: "Price alert created successfully",
      data: {
        alert_id: alertId,
        item_name,
        market_name,
        target_price,
        alert_type,
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

    // Soft delete - set status to DELETED
     await prisma.$executeRaw`
      UPDATE Price_Alerts 
      SET status = 'DELETED', updated_at = ${new Date().toISOString()}
      WHERE alert_id = ${alertId}
      ${phone ? `AND phone_number = '${phone.replace(/\D/g, "")}'` : ""}
    `;

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

    // Build update query
    const updates: string[] = [`updated_at = '${new Date().toISOString()}'`];
    if (target_price) updates.push(`target_price = ${target_price}`);
    if (alert_type) updates.push(`alert_type = '${alert_type}'`);
    if (status) updates.push(`status = '${status}'`);

    await prisma.$executeRawUnsafe(`
      UPDATE Price_Alerts 
      SET ${updates.join(", ")}
      WHERE alert_id = '${alert_id}'
    `);

    return NextResponse.json({
      success: true,
      message: "Alert updated successfully",
      alert_id,
    });
  } catch (error) {
    console.error("Update Alert Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update alert" },
      { status: 500 }
    );
  }
}
 
