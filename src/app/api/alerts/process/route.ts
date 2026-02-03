// src/app/api/alerts/process/route.ts
// NaijaMarket Intel - Alert Processing Engine
// Checks active alerts against current prices and sends WhatsApp notifications
// Called by Vercel Cron every 15 minutes
// Updated: 2026-02-03

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================================
// CONFIGURATION
// ============================================================================

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

// Cooldown period - don't send same alert type within this period (in hours)
const ALERT_COOLDOWN_HOURS = 6;

// Maximum alerts to process per run (prevent timeout)
const MAX_ALERTS_PER_RUN = 100;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatPrice(price: number): string {
  return `₦${price.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPhoneForWhatsApp(phone: string): string {
  // Remove any non-digit characters
  let cleaned = phone.replace(/\D/g, "");
  
  // Ensure it starts with country code (default to Nigeria 234)
  if (cleaned.startsWith("0")) {
    cleaned = "234" + cleaned.substring(1);
  } else if (!cleaned.startsWith("234") && cleaned.length === 10) {
    cleaned = "234" + cleaned;
  }
  
  return `whatsapp:+${cleaned}`;
}

function generateNotificationId(): string {
  return `NTF${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

// ============================================================================
// WHATSAPP SENDER
// ============================================================================

async function sendWhatsAppAlert(
  phone: string,
  alertData: {
    itemName: string;
    marketName: string;
    alertType: string;
    targetPrice: number;
    currentPrice: number;
    priceChange: number;
    priceChangePercent: number;
  }
): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.log("⚠️ Twilio not configured. Alert message would be:");
    console.log(alertData);
    return { success: true, messageSid: "TEST-MODE" };
  }

  const formattedPhone = formatPhoneForWhatsApp(phone);
  const { itemName, marketName, alertType, targetPrice, currentPrice, priceChange, priceChangePercent } = alertData;
  
  // Determine emoji and direction
  const emoji = alertType === "ABOVE" ? "📈" : "📉";
  const direction = alertType === "ABOVE" ? "risen above" : "dropped below";
  const changeEmoji = priceChange > 0 ? "🔺" : "🔻";
  
  // Create message
  const message = `🔔 *PRICE ALERT TRIGGERED*

${emoji} *${itemName}* at *${marketName}*

The price has ${direction} your target!

┌─────────────────────────
│ 🎯 Your Target: ${formatPrice(targetPrice)}
│ 💰 Current Price: ${formatPrice(currentPrice)}
│ ${changeEmoji} Change: ${formatPrice(Math.abs(priceChange))} (${priceChangePercent > 0 ? "+" : ""}${priceChangePercent.toFixed(1)}%)
└─────────────────────────

⏰ Triggered: ${new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}

📊 View more prices: naijamarket-web.vercel.app

_Reply STOP to disable this alert_`;

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: formattedPhone,
          From: TWILIO_WHATSAPP_NUMBER,
          Body: message,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ WhatsApp send failed:", result);
      return { success: false, error: result.message || "Failed to send" };
    }

    console.log(`✅ Alert sent to ${formattedPhone}. SID: ${result.sid}`);
    return { success: true, messageSid: result.sid };
    
  } catch (error: any) {
    console.error("❌ WhatsApp send error:", error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// MAIN PROCESSOR
// ============================================================================

export async function GET(request: NextRequest) {
  // Verify cron secret (optional security)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow manual trigger for testing without secret
    const { searchParams } = new URL(request.url);
    if (!searchParams.get("test")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  console.log("🔔 ═══════════════════════════════════════════════════════════");
  console.log("🔔 ALERT PROCESSOR STARTED:", new Date().toISOString());
  console.log("🔔 ═══════════════════════════════════════════════════════════");

  const stats = {
    startTime: new Date().toISOString(),
    alertsChecked: 0,
    alertsTriggered: 0,
    notificationsSent: 0,
    notificationsFailed: 0,
    alertsSkippedCooldown: 0,
    alertsNoPriceData: 0,
    errors: [] as string[],
  };

  try {
    // ========================================================================
    // STEP 1: Get all ACTIVE alerts
    // ========================================================================
    
    const activeAlerts = await prisma.$queryRaw`
      SELECT 
        pa.alert_id,
        pa.consumer_id,
        pa.phone_number,
        pa.item_id,
        pa.item_name,
        pa.market_id,
        pa.market_name,
        pa.target_price,
        pa.alert_type,
        pa.created_at,
        pa.triggered_at
      FROM Price_Alerts pa
      WHERE pa.status = 'ACTIVE'
      ORDER BY pa.created_at ASC
    ` as any[];

    stats.alertsChecked = activeAlerts.length;
    console.log(`📋 Found ${activeAlerts.length} active alerts to check`);

    if (activeAlerts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active alerts to process",
        stats,
      });
    }

    // Limit alerts per run
    const alertsToProcess = activeAlerts.slice(0, MAX_ALERTS_PER_RUN);

    // ========================================================================
    // STEP 2: Process each alert
    // ========================================================================

    for (const alert of alertsToProcess) {
      try {
        console.log(`\n🔍 Checking alert ${alert.alert_id}: ${alert.item_name} @ ${alert.market_name}`);
        
        // Get current price for this item/market
        const currentPriceResult = await prisma.$queryRaw`
          SELECT TOP 1
            price_naira,
            validated_at,
            price_change_pct,
            previous_price
          FROM Validated_Prices
          WHERE item = ${alert.item_name}
            AND market = ${alert.market_name}
          ORDER BY validated_at DESC
        ` as any[];

        if (!currentPriceResult || currentPriceResult.length === 0) {
          console.log(`   ⚠️ No price data found for ${alert.item_name} @ ${alert.market_name}`);
          stats.alertsNoPriceData++;
          continue;
        }

        const currentPrice = parseFloat(currentPriceResult[0].price_naira);
        const targetPrice = parseFloat(alert.target_price);
        const alertType = alert.alert_type?.toUpperCase();

        console.log(`   📊 Current: ${formatPrice(currentPrice)} | Target: ${formatPrice(targetPrice)} | Type: ${alertType}`);

        // Check if alert should trigger
        let shouldTrigger = false;
        
        if (alertType === "ABOVE" && currentPrice >= targetPrice) {
          shouldTrigger = true;
          console.log(`   🎯 ABOVE trigger: ${currentPrice} >= ${targetPrice}`);
        } else if (alertType === "BELOW" && currentPrice <= targetPrice) {
          shouldTrigger = true;
          console.log(`   🎯 BELOW trigger: ${currentPrice} <= ${targetPrice}`);
        }

        if (!shouldTrigger) {
          console.log(`   ⏳ Not triggered yet`);
          continue;
        }

        // ====================================================================
        // STEP 3: Check cooldown (don't spam users)
        // ====================================================================
        
        const cooldownTime = new Date();
        cooldownTime.setHours(cooldownTime.getHours() - ALERT_COOLDOWN_HOURS);

        const recentNotification = await prisma.$queryRaw`
          SELECT notification_id, sent_at
          FROM Alert_Notifications
          WHERE alert_id = ${alert.alert_id}
            AND sent_at > ${cooldownTime.toISOString()}
          ORDER BY sent_at DESC
        ` as any[];

        if (recentNotification && recentNotification.length > 0) {
          console.log(`   ⏸️ Skipping - notification sent within ${ALERT_COOLDOWN_HOURS}h cooldown`);
          stats.alertsSkippedCooldown++;
          continue;
        }

        // ====================================================================
        // STEP 4: Send WhatsApp notification
        // ====================================================================

        const priceChange = currentPrice - targetPrice;
        const priceChangePercent = (priceChange / targetPrice) * 100;

        const sendResult = await sendWhatsAppAlert(alert.phone_number, {
          itemName: alert.item_name || "Item",
          marketName: alert.market_name || "Market",
          alertType: alertType,
          targetPrice: targetPrice,
          currentPrice: currentPrice,
          priceChange: priceChange,
          priceChangePercent: priceChangePercent,
        });

        if (sendResult.success) {
          stats.notificationsSent++;
          stats.alertsTriggered++;

          // ==================================================================
          // STEP 5: Log notification
          // ==================================================================
          
          const notificationId = generateNotificationId();
          const now = new Date().toISOString();

          await prisma.$executeRaw`
            INSERT INTO Alert_Notifications (
              alert_id,
              phone_number,
              item_name,
              market_name,
              target_price,
              triggered_price,
              alert_type,
              message_sid,
              delivery_status,
              sent_at,
              created_at
            ) VALUES (
              ${alert.alert_id},
              ${alert.phone_number},
              ${alert.item_name || 'Item'},
              ${alert.market_name || 'Market'},
              ${targetPrice},
              ${currentPrice},
              ${alertType},
              ${sendResult.messageSid || null},
              'SENT',
              ${now},
              ${now}
            )
          `;

          // ==================================================================
          // STEP 6: Update alert status to TRIGGERED
          // ==================================================================

          await prisma.$executeRaw`
            UPDATE Price_Alerts
            SET status = 'TRIGGERED',
                triggered_at = ${now},
                updated_at = ${now}
            WHERE alert_id = ${alert.alert_id}
          `;

          console.log(`   ✅ Alert triggered and notification sent!`);

        } else {
          stats.notificationsFailed++;
          stats.errors.push(`Alert ${alert.alert_id}: ${sendResult.error}`);
          console.log(`   ❌ Failed to send notification: ${sendResult.error}`);
        }

      } catch (alertError: any) {
        console.error(`   ❌ Error processing alert ${alert.alert_id}:`, alertError);
        stats.errors.push(`Alert ${alert.alert_id}: ${alertError.message}`);
      }
    }

    // ========================================================================
    // STEP 7: Return summary
    // ========================================================================

    stats.startTime = new Date().toISOString();
    
    console.log("\n🔔 ═══════════════════════════════════════════════════════════");
    console.log("🔔 ALERT PROCESSOR COMPLETED");
    console.log(`🔔 Checked: ${stats.alertsChecked} | Triggered: ${stats.alertsTriggered} | Sent: ${stats.notificationsSent}`);
    console.log("🔔 ═══════════════════════════════════════════════════════════\n");

    return NextResponse.json({
      success: true,
      message: "Alert processing completed",
      stats,
    });

  } catch (error: any) {
    console.error("❌ Alert Processor Error:", error);
    stats.errors.push(error.message);
    
    return NextResponse.json({
      success: false,
      error: "Alert processing failed",
      stats,
    }, { status: 500 });
  }
}

// POST - Manual trigger with options
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId, testMode } = body;

    if (testMode) {
      // Test mode - just check what would trigger
      const alerts = await prisma.$queryRaw`
        SELECT 
          pa.*,
          vp.price_naira as current_price,
          vp.validated_at as price_updated_at
        FROM Price_Alerts pa
        LEFT JOIN (
          SELECT item, market, price_naira, validated_at,
                 ROW_NUMBER() OVER (PARTITION BY item, market ORDER BY validated_at DESC) as rn
          FROM Validated_Prices
        ) vp ON pa.item_name = vp.item AND pa.market_name = vp.market AND vp.rn = 1
        WHERE pa.status = 'ACTIVE'
        ${alertId ? prisma.$queryRaw`AND pa.alert_id = ${alertId}` : prisma.$queryRaw``}
      ` as any[];

      const analysis = alerts.map((alert: any) => {
        const currentPrice = parseFloat(alert.current_price || 0);
        const targetPrice = parseFloat(alert.target_price || 0);
        const alertType = alert.alert_type?.toUpperCase();
        
        let wouldTrigger = false;
        if (alertType === "ABOVE" && currentPrice >= targetPrice) wouldTrigger = true;
        if (alertType === "BELOW" && currentPrice <= targetPrice) wouldTrigger = true;

        return {
          alert_id: alert.alert_id,
          item: alert.item_name,
          market: alert.market_name,
          target_price: targetPrice,
          current_price: currentPrice,
          alert_type: alertType,
          would_trigger: wouldTrigger,
          price_diff: currentPrice - targetPrice,
          phone: alert.phone_number?.slice(-4) ? `***${alert.phone_number.slice(-4)}` : 'N/A',
        };
      });

      return NextResponse.json({
        success: true,
        testMode: true,
        alerts: analysis,
        wouldTrigger: analysis.filter((a: any) => a.would_trigger).length,
        total: analysis.length,
      });
    }

    // Regular processing
    return GET(request);

  } catch (error: any) {
    console.error("POST Alert Process Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
