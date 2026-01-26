// ============================================================================
// src/app/api/alerts/check/route.ts
// NaijaMarket Intel - Alert Checker Background Job
// PRIMARY: Daily_Prices | FALLBACK: Approved_Prices
// Version: 2.0.0
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Security
const CRON_SECRET = process.env.CRON_SECRET || "naijamarket-cron-2026";

// Twilio
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

// Email
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "alerts@naijamarket.com";

// ============================================================================
// SEND WHATSAPP
// ============================================================================

async function sendWhatsApp(
  phone: string,
  itemName: string,
  marketName: string,
  alertType: string,
  targetPrice: number,
  triggeredPrice: number,
  priceSource: string
): Promise<{ success: boolean; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.log("[WhatsApp] Twilio not configured");
    return { success: false, error: "Twilio not configured" };
  }

  try {
    let formattedPhone = phone.replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "234" + formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith("234")) {
      formattedPhone = "234" + formattedPhone;
    }

    const emoji = alertType === "ABOVE" ? "📈" : "📉";
    const direction = alertType === "ABOVE" ? "risen above" : "fallen below";
    const diff = triggeredPrice - targetPrice;
    const diffPercent = ((diff / targetPrice) * 100).toFixed(1);

    const message = `${emoji} *NaijaMarket Price Alert*

*${itemName}* has ${direction} your target!

📍 *Market:* ${marketName}
🎯 *Your Target:* ₦${targetPrice.toLocaleString()}
💰 *Current Price:* ₦${triggeredPrice.toLocaleString()}
${alertType === "ABOVE" ? "📊 *Above by:*" : "📊 *Below by:*"} ₦${Math.abs(diff).toLocaleString()} (${Math.abs(Number(diffPercent))}%)

👉 View prices: https://naijamarket-web.vercel.app/dashboard/prices

_Data source: ${priceSource}_`;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
        },
        body: new URLSearchParams({
          From: TWILIO_WHATSAPP_FROM,
          To: `whatsapp:+${formattedPhone}`,
          Body: message,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[WhatsApp] Failed:", error);
      return { success: false, error };
    }

    console.log(`[WhatsApp] ✅ Sent to ${formattedPhone}`);
    return { success: true };
  } catch (error: any) {
    console.error("[WhatsApp] Error:", error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// SEND EMAIL
// ============================================================================

async function sendEmail(
  to: string,
  itemName: string,
  marketName: string,
  alertType: string,
  targetPrice: number,
  triggeredPrice: number,
  priceSource: string
): Promise<{ success: boolean; error?: string }> {
  const direction = alertType === "ABOVE" ? "risen above" : "fallen below";
  const emoji = alertType === "ABOVE" ? "📈" : "📉";
  const diff = Math.abs(triggeredPrice - targetPrice);
  const diffPercent = ((diff / targetPrice) * 100).toFixed(1);

  const subject = `${emoji} Price Alert: ${itemName} has ${direction} ₦${targetPrice.toLocaleString()}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #00a651, #008c44); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">${emoji} Price Alert</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your target has been reached!</p>
  </div>
  
  <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #00a651; margin-bottom: 25px;">
      <h2 style="margin: 0 0 8px 0; color: #00a651; font-size: 22px;">${itemName}</h2>
      <p style="margin: 0; color: #666;">📍 ${marketName}</p>
    </div>
    
    <p style="font-size: 16px; color: #333; line-height: 1.6;">
      The price of <strong>${itemName}</strong> has <strong>${direction}</strong> your target price.
    </p>
    
    <div style="display: flex; gap: 15px; margin: 25px 0;">
      <div style="flex: 1; background: #e8f5e9; padding: 20px; border-radius: 12px; text-align: center;">
        <div style="color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Current Price</div>
        <div style="color: #00a651; font-size: 32px; font-weight: bold; margin-top: 5px;">₦${triggeredPrice.toLocaleString()}</div>
      </div>
      <div style="flex: 1; background: #f5f5f5; padding: 20px; border-radius: 12px; text-align: center;">
        <div style="color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Your Target</div>
        <div style="color: #333; font-size: 32px; font-weight: bold; margin-top: 5px;">₦${targetPrice.toLocaleString()}</div>
      </div>
    </div>
    
    <div style="background: ${alertType === "ABOVE" ? "#fff3e0" : "#e3f2fd"}; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 25px;">
      <span style="font-size: 14px; color: #666;">${alertType === "ABOVE" ? "Above" : "Below"} target by</span>
      <span style="font-size: 20px; font-weight: bold; color: ${alertType === "ABOVE" ? "#e65100" : "#1565c0"}; margin-left: 10px;">
        ₦${diff.toLocaleString()} (${diffPercent}%)
      </span>
    </div>
    
    <div style="text-align: center;">
      <a href="https://naijamarket-web.vercel.app/dashboard/prices" 
         style="display: inline-block; background: #00a651; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        View Live Prices →
      </a>
    </div>
  </div>
  
  <div style="padding: 20px; text-align: center; font-size: 12px; color: #999;">
    <p style="margin: 0 0 10px 0;">NaijaMarket Intel - The Bloomberg of Nigerian Commodities</p>
    <p style="margin: 0;">
      <a href="https://naijamarket-web.vercel.app/dashboard/settings" style="color: #00a651;">Manage Alerts</a>
      &nbsp;•&nbsp;
      <span style="color: #ccc;">Data: ${priceSource}</span>
    </p>
  </div>
</body>
</html>`;

  // Try Resend first
  if (RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
      });

      if (response.ok) {
        console.log(`[Email/Resend] ✅ Sent to ${to}`);
        return { success: true };
      }
      console.error("[Email/Resend] Failed:", await response.text());
    } catch (error: any) {
      console.error("[Email/Resend] Error:", error);
    }
  }

  // Fallback to SendGrid
  if (SENDGRID_API_KEY) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: EMAIL_FROM, name: "NaijaMarket Alerts" },
          subject,
          content: [{ type: "text/html", value: html }],
        }),
      });

      if (response.ok) {
        console.log(`[Email/SendGrid] ✅ Sent to ${to}`);
        return { success: true };
      }
      console.error("[Email/SendGrid] Failed:", await response.text());
    } catch (error: any) {
      console.error("[Email/SendGrid] Error:", error);
    }
  }

  return { success: false, error: "No email provider configured" };
}

// ============================================================================
// MAIN CHECKER
// ============================================================================

async function checkAndTriggerAlerts() {
  const startTime = Date.now();
  console.log("\n" + "=".repeat(50));
  console.log("🔔 PRICE ALERT CHECK STARTED");
  console.log("=".repeat(50));

  let alertsTriggered = 0;
  let whatsappSent = 0;
  let emailsSent = 0;
  let errors = 0;
  let priceSourceUsed = { daily: 0, approved: 0 };

  try {
    // Step 1: Run stored procedure
    console.log("\n📊 Running sp_Check_Price_Alerts...");
    const result = await prisma.$queryRaw<any[]>`EXEC sp_Check_Price_Alerts`;
    alertsTriggered = result[0]?.alerts_triggered || 0;
    const pendingCount = result[0]?.pending_notifications || 0;

    console.log(`   Alerts triggered: ${alertsTriggered}`);
    console.log(`   Notifications queued: ${pendingCount}`);

    if (alertsTriggered === 0) {
      console.log("\n✅ No alerts triggered");
      return { alertsTriggered: 0, whatsappSent: 0, emailsSent: 0, errors: 0, priceSourceUsed, duration: Date.now() - startTime };
    }

    // Step 2: Get pending notifications
    console.log("\n📬 Processing notifications...");
    const pending = await prisma.$queryRaw<any[]>`
      SELECT 
        notification_id,
        alert_id,
        phone_number,
        item_name,
        market_name,
        target_price,
        triggered_price,
        alert_type,
        price_source,
        channel,
        recipient
      FROM Alert_Notifications
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
    `;

    // Step 3: Send notifications
    for (const notif of pending) {
      const {
        notification_id,
        item_name,
        market_name,
        target_price,
        triggered_price,
        alert_type,
        price_source,
        channel,
        recipient,
      } = notif;

      // Track price source
      if (price_source === "Daily_Prices") priceSourceUsed.daily++;
      else priceSourceUsed.approved++;

      let success = false;
      let errorMsg: string | null = null;

      if (channel === "WHATSAPP") {
        const result = await sendWhatsApp(
          recipient,
          item_name,
          market_name || "All Markets",
          alert_type,
          Number(target_price),
          Number(triggered_price),
          price_source || "Database"
        );
        success = result.success;
        errorMsg = result.error || null;
        if (success) whatsappSent++;
        else errors++;
      } else if (channel === "EMAIL") {
        const result = await sendEmail(
          recipient,
          item_name,
          market_name || "All Markets",
          alert_type,
          Number(target_price),
          Number(triggered_price),
          price_source || "Database"
        );
        success = result.success;
        errorMsg = result.error || null;
        if (success) emailsSent++;
        else errors++;
      }

      // Update notification status
      await prisma.$executeRaw`
        UPDATE Alert_Notifications
        SET status = ${success ? "SENT" : "FAILED"},
            sent_at = ${success ? new Date().toISOString() : null},
            error_message = ${errorMsg}
        WHERE notification_id = ${notification_id}
      `;
    }
  } catch (error: any) {
    console.error("❌ Alert check error:", error);
    throw error;
  }

  const duration = Date.now() - startTime;

  console.log("\n" + "=".repeat(50));
  console.log("✅ ALERT CHECK COMPLETE");
  console.log("=".repeat(50));
  console.log(`   Duration: ${duration}ms`);
  console.log(`   Alerts triggered: ${alertsTriggered}`);
  console.log(`   WhatsApp sent: ${whatsappSent}`);
  console.log(`   Emails sent: ${emailsSent}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Price sources: Daily=${priceSourceUsed.daily}, Approved=${priceSourceUsed.approved}`);
  console.log("");

  return { alertsTriggered, whatsappSent, emailsSent, errors, priceSourceUsed, duration };
}

// ============================================================================
// POST - Cron endpoint
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = request.headers.get("x-cron-secret");
    const token = authHeader?.replace("Bearer ", "") || cronSecret;

    if (token !== CRON_SECRET) {
      console.log("❌ Unauthorized alert check attempt");
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const result = await checkAndTriggerAlerts();

    return NextResponse.json({
      success: true,
      message: `Processed ${result.alertsTriggered} alerts`,
      data: {
        alertsTriggered: result.alertsTriggered,
        whatsappSent: result.whatsappSent,
        emailsSent: result.emailsSent,
        errors: result.errors,
        priceSources: result.priceSourceUsed,
        durationMs: result.duration,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("❌ Alert check failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ============================================================================
// GET - Status endpoint
// ============================================================================

export async function GET() {
  try {
    let stats = {
      activeAlerts: 0,
      pendingNotifications: 0,
      triggeredToday: 0,
      sentToday: 0,
      lastTriggered: null as string | null,
      priceCoverage: { daily: 0, approved: 0 },
    };

    try {
      const result = await prisma.$queryRaw<any[]>`
        SELECT 
          (SELECT COUNT(*) FROM Price_Alerts WHERE status = 'ACTIVE') as active_alerts,
          (SELECT COUNT(*) FROM Alert_Notifications WHERE status = 'PENDING') as pending_notifications,
          (SELECT COUNT(*) FROM Price_Alerts WHERE status = 'TRIGGERED' AND CAST(triggered_at AS DATE) = CAST(GETDATE() AS DATE)) as triggered_today,
          (SELECT COUNT(*) FROM Alert_Notifications WHERE status = 'SENT' AND CAST(sent_at AS DATE) = CAST(GETDATE() AS DATE)) as sent_today,
          (SELECT MAX(triggered_at) FROM Price_Alerts WHERE status = 'TRIGGERED') as last_triggered
      `;

      // Get price coverage
      const coverage = await prisma.$queryRaw<any[]>`
        SELECT price_source, COUNT(*) as count
        FROM vw_Current_Prices
        GROUP BY price_source
      `;

      if (result[0]) {
        stats.activeAlerts = Number(result[0].active_alerts) || 0;
        stats.pendingNotifications = Number(result[0].pending_notifications) || 0;
        stats.triggeredToday = Number(result[0].triggered_today) || 0;
        stats.sentToday = Number(result[0].sent_today) || 0;
        stats.lastTriggered = result[0].last_triggered?.toISOString() || null;
      }

      for (const row of coverage) {
        if (row.price_source === "Daily_Prices") stats.priceCoverage.daily = Number(row.count);
        else if (row.price_source === "Approved_Prices") stats.priceCoverage.approved = Number(row.count);
      }
    } catch (e) {
      console.warn("Stats query failed (tables may not exist):", e);
    }

    return NextResponse.json({
      success: true,
      message: "Alert checker status",
      data: stats,
      config: {
        priceSource: "Daily_Prices (primary) → Approved_Prices (fallback)",
        schedule: "Every 15 minutes recommended",
      },
      usage: {
        method: "POST",
        headers: { "x-cron-secret": "your-secret" },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
