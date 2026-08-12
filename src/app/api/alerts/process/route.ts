// src/app/api/alerts/process/route.ts
// NaijaMarket Intel - Alert Processing Engine v4.0 (consolidated sender)
// Checks active alerts against current prices and notifies via PUSH + EMAIL.
// Called by Vercel Cron every 15 minutes (GET, Authorization: Bearer CRON_SECRET).
//
// v4.0 (2026-07-06):
//   - CRON_SECRET required for ALL invocations (no test/diagnose bypass,
//     no hardcoded fallback; unset secret = 401 fail-closed).
//   - Twilio/WhatsApp REMOVED — the WHATSAPP channel is parked until alert
//     sends move to the Meta WA engine. No WhatsApp sends from here.
//   - PUSH channel: Expo push via Consumer_Push_Tokens (self-cleaning on
//     DeviceNotRegistered tickets).
//   - EMAIL channel: Resend primary / SendGrid fallback (from the retired
//     /api/alerts/check route), links point at www.naijamarketintel.ng.
//   - Preserved semantics: 6h cooldown via Alert_Notifications.sent_at,
//     send-then-TRIGGERED (failed send leaves alert ACTIVE for retry),
//     MAX_ALERTS_PER_RUN=50, maxDuration=60, 5-strategy price fallback,
//     ?dry=true mode, degraded-insert logging fallback.
//
// Endpoints (all require Bearer CRON_SECRET):
//   GET  /api/alerts/process                → live run
//   GET  /api/alerts/process?dry=true       → dry run (no sends)
//   GET  /api/alerts/process?diagnose=true  → system diagnostics

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cronGuard } from "@/lib/scheduler";

// ============================================================================
// CONFIGURATION
// ============================================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "alerts@naijamarket.com";

const SITE_URL = "https://www.naijamarketintel.ng";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_CHUNK_SIZE = 100; // Expo hard limit per request

// Cooldown period - don't send same alert type within this period (in hours)
const ALERT_COOLDOWN_HOURS = 6;

// Maximum alerts to process per run (prevent Vercel 60s timeout)
const MAX_ALERTS_PER_RUN = 50;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatPrice(price: number): string {
  return `₦${price.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Phone formats vary across writers (+234..., 234..., 0...): match all forms.
function phoneVariants(phone: string): { plain: string; plus: string } {
  const digits = String(phone || "").replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? "234" + digits.substring(1) : digits;
  return { plain: normalized, plus: "+" + normalized };
}

// ============================================================================
// PUSH SENDER (Expo)
// ============================================================================

type AlertPayload = {
  alertId: string;
  itemId: string | null;
  marketId: string | null;
  itemName: string;
  marketName: string;
  alertType: string;
  targetPrice: number;
  currentPrice: number;
  unit?: string;
};

async function sendExpoPush(
  tokens: string[],
  a: AlertPayload
): Promise<{ delivered: boolean; deadTokens: string[]; error?: string; firstTicketId?: string }> {
  const emoji = a.alertType === "ABOVE" ? "📈" : "📉";
  const direction = a.alertType === "ABOVE" ? "risen above" : "dropped below";
  const title = `${emoji} ${a.itemName} price alert`;
  const body = `${a.itemName}${a.unit ? ` (${a.unit})` : ""} at ${a.marketName} has ${direction} your target: now ${formatPrice(a.currentPrice)} (target ${formatPrice(a.targetPrice)}).`;

  const deadTokens: string[] = [];
  let delivered = false;
  let firstTicketId: string | undefined;
  let lastError: string | undefined;

  for (let i = 0; i < tokens.length; i += EXPO_CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + EXPO_CHUNK_SIZE);
    const messages = chunk.map((to) => ({
      to,
      title,
      body,
      data: { alert_id: a.alertId, item_id: a.itemId, market_id: a.marketId },
    }));

    try {
      const resp = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
      const result = await resp.json();

      if (!resp.ok) {
        lastError = `Expo HTTP ${resp.status}: ${JSON.stringify(result).substring(0, 200)}`;
        console.error("   ❌ Expo push failed:", lastError);
        continue;
      }

      // result.data is an array of tickets in the same order as the messages
      const tickets: any[] = Array.isArray(result?.data) ? result.data : [];
      tickets.forEach((ticket, idx) => {
        if (ticket?.status === "ok") {
          delivered = true;
          if (!firstTicketId && ticket.id) firstTicketId = String(ticket.id);
        } else {
          const errCode = ticket?.details?.error;
          lastError = errCode || ticket?.message || "unknown ticket error";
          if (errCode === "DeviceNotRegistered" && chunk[idx]) {
            deadTokens.push(chunk[idx]);
          }
        }
      });
    } catch (e: any) {
      lastError = e.message;
      console.error("   ❌ Expo push error:", e);
    }
  }

  return { delivered, deadTokens, error: delivered ? undefined : lastError, firstTicketId };
}

// ============================================================================
// EMAIL SENDER (Resend primary, SendGrid fallback — from retired /alerts/check)
// ============================================================================

async function sendEmail(
  to: string,
  a: AlertPayload,
  priceSource: string
): Promise<{ success: boolean; error?: string }> {
  const direction = a.alertType === "ABOVE" ? "risen above" : "fallen below";
  const emoji = a.alertType === "ABOVE" ? "📈" : "📉";
  const diff = Math.abs(a.currentPrice - a.targetPrice);
  const diffPercent = ((diff / a.targetPrice) * 100).toFixed(1);

  const subject = `${emoji} Price Alert: ${a.itemName} has ${direction} ₦${a.targetPrice.toLocaleString()}`;

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
      <h2 style="margin: 0 0 8px 0; color: #00a651; font-size: 22px;">${a.itemName}</h2>
      <p style="margin: 0; color: #666;">📍 ${a.marketName}</p>
    </div>

    <p style="font-size: 16px; color: #333; line-height: 1.6;">
      The price of <strong>${a.itemName}</strong> has <strong>${direction}</strong> your target price.
    </p>

    <div style="display: flex; gap: 15px; margin: 25px 0;">
      <div style="flex: 1; background: #e8f5e9; padding: 20px; border-radius: 12px; text-align: center;">
        <div style="color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Current Price</div>
        <div style="color: #00a651; font-size: 32px; font-weight: bold; margin-top: 5px;">₦${a.currentPrice.toLocaleString()}</div>
      </div>
      <div style="flex: 1; background: #f5f5f5; padding: 20px; border-radius: 12px; text-align: center;">
        <div style="color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Your Target</div>
        <div style="color: #333; font-size: 32px; font-weight: bold; margin-top: 5px;">₦${a.targetPrice.toLocaleString()}</div>
      </div>
    </div>

    <div style="background: ${a.alertType === "ABOVE" ? "#fff3e0" : "#e3f2fd"}; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 25px;">
      <span style="font-size: 14px; color: #666;">${a.alertType === "ABOVE" ? "Above" : "Below"} target by</span>
      <span style="font-size: 20px; font-weight: bold; color: ${a.alertType === "ABOVE" ? "#e65100" : "#1565c0"}; margin-left: 10px;">
        ₦${diff.toLocaleString()} (${diffPercent}%)
      </span>
    </div>

    <div style="text-align: center;">
      <a href="${SITE_URL}/dashboard/prices"
         style="display: inline-block; background: #00a651; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        View Live Prices →
      </a>
    </div>
  </div>

  <div style="padding: 20px; text-align: center; font-size: 12px; color: #999;">
    <p style="margin: 0 0 10px 0;">NaijaMarket Intel - The Bloomberg of Nigerian Commodities</p>
    <p style="margin: 0;">
      <a href="${SITE_URL}/dashboard/settings" style="color: #00a651;">Manage Alerts</a>
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
        console.log(`   ✅ [Email/Resend] Sent to ${to}`);
        return { success: true };
      }
      console.error("   ❌ [Email/Resend] Failed:", await response.text());
    } catch (error: any) {
      console.error("   ❌ [Email/Resend] Error:", error);
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
        console.log(`   ✅ [Email/SendGrid] Sent to ${to}`);
        return { success: true };
      }
      console.error("   ❌ [Email/SendGrid] Failed:", await response.text());
    } catch (error: any) {
      console.error("   ❌ [Email/SendGrid] Error:", error);
    }
  }

  return { success: false, error: "No email provider configured" };
}

// ============================================================================
// NOTIFICATION LOGGING (full insert, degraded fallback)
// ============================================================================

async function logNotification(opts: {
  alertId: string;
  phone: string;
  itemName: string;
  marketName: string;
  targetPrice: number;
  currentPrice: number;
  alertType: string;
  priceSource: string;
  channel: "PUSH" | "EMAIL";
  recipient: string;
  messageSid: string | null;
  status: "SENT" | "FAILED";
  errorMessage?: string | null;
}) {
  const now = new Date().toISOString();
  try {
    await prisma.$executeRaw`
      INSERT INTO Alert_Notifications (
        alert_id, phone_number, item_name, market_name,
        target_price, triggered_price, alert_type, price_source,
        channel, recipient, message_sid, status, sent_at, error_message, created_at
      ) VALUES (
        ${opts.alertId}, ${opts.phone}, ${opts.itemName}, ${opts.marketName},
        ${opts.targetPrice}, ${opts.currentPrice}, ${opts.alertType}, ${opts.priceSource},
        ${opts.channel}, ${opts.recipient}, ${opts.messageSid},
        ${opts.status}, ${opts.status === "SENT" ? now : null}, ${opts.errorMessage || null}, ${now}
      )`;
  } catch (logError: any) {
    // If INSERT fails (missing columns), try minimal insert
    console.log("   ⚠️ Full insert failed, trying minimal:", logError.message?.substring(0, 80));
    try {
      await prisma.$executeRaw`
        INSERT INTO Alert_Notifications (
          alert_id, phone_number, item_name, market_name,
          target_price, triggered_price, alert_type,
          channel, recipient, status, sent_at, created_at
        ) VALUES (
          ${opts.alertId}, ${opts.phone}, ${opts.itemName}, ${opts.marketName},
          ${opts.targetPrice}, ${opts.currentPrice}, ${opts.alertType},
          ${opts.channel}, ${opts.recipient},
          ${opts.status}, ${opts.status === "SENT" ? now : null}, ${now}
        )`;
    } catch (minError) {
      console.log("   ⚠️ Minimal insert also failed:", minError);
    }
  }
}

// ============================================================================
// MAIN PROCESSOR
// ============================================================================

export async function GET(request: NextRequest) {
  // Fail-closed auth: CRON_SECRET is required for EVERY invocation, including
  // dry runs and diagnostics. Unset secret = 401 (never fail open).
  const denied = cronGuard(request);
  if (denied) return denied;

  console.log("🔔 ═══════════════════════════════════════════════════════════");
  console.log("🔔 ALERT PROCESSOR STARTED:", new Date().toISOString());
  console.log("🔔 ═══════════════════════════════════════════════════════════");

  const { searchParams: params } = new URL(request.url);
  const isDiagnose = params.get("diagnose") === "true";
  const isDryRun = params.get("dry") === "true";

  // ========================================================================
  // DIAGNOSTICS MODE (authenticated): /api/alerts/process?diagnose=true
  // ========================================================================

  if (isDiagnose) {
    const checks: Record<string, any> = {};

    checks.env = {
      RESEND_API_KEY: RESEND_API_KEY ? "✅ Set (hidden)" : "❌ MISSING",
      SENDGRID_API_KEY: SENDGRID_API_KEY ? "✅ Set (hidden)" : "⚠️ Not set (fallback unavailable)",
      EMAIL_FROM,
      CRON_SECRET: "✅ Set (required to reach this endpoint)",
    };

    try {
      const rows = (await prisma.$queryRaw`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN status = 'TRIGGERED' THEN 1 ELSE 0 END) AS triggered
        FROM Price_Alerts
      `) as any[];
      checks.price_alerts = { status: "✅ Table exists", ...rows[0] };
    } catch (e: any) {
      checks.price_alerts = { status: "❌ " + e.message?.substring(0, 100) };
    }

    try {
      const rows = (await prisma.$queryRaw`
        SELECT COUNT(*) AS total_tokens, COUNT(DISTINCT phone_number) AS distinct_phones
        FROM Consumer_Push_Tokens
      `) as any[];
      checks.consumer_push_tokens = { status: "✅ Table exists", ...rows[0] };
    } catch (e: any) {
      checks.consumer_push_tokens = { status: "❌ " + e.message?.substring(0, 100) };
    }

    try {
      const rows = (await prisma.$queryRaw`
        SELECT COUNT(*) AS total_rows, MAX(price_date) AS latest_date
        FROM Daily_Prices WHERE price_naira > 0
      `) as any[];
      checks.daily_prices = { status: "✅ PRIMARY data source", ...rows[0] };
    } catch (e: any) {
      checks.daily_prices = { status: "❌ " + e.message?.substring(0, 100) };
    }

    try {
      const rows = (await prisma.$queryRaw`
        SELECT COUNT(*) AS total_rows FROM Approved_Prices WHERE validation_status = 'APPROVED'
      `) as any[];
      checks.approved_prices = { status: "⚠️ FALLBACK only", ...rows[0] };
    } catch (e: any) {
      checks.approved_prices = { status: "⚠️ " + e.message?.substring(0, 80) };
    }

    try {
      const rows = (await prisma.$queryRaw`
        SELECT COUNT(*) AS total,
          SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) AS sent,
          SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed,
          MAX(sent_at) AS last_sent
        FROM Alert_Notifications
      `) as any[];
      checks.alert_notifications = { status: "✅ Table exists", ...rows[0] };
    } catch {
      checks.alert_notifications = { status: "⚠️ Table missing (notifications will still be logged on first send)" };
    }

    return NextResponse.json({
      success: true,
      mode: "diagnostics",
      timestamp: new Date().toISOString(),
      checks,
    });
  }

  const stats = {
    startTime: new Date().toISOString(),
    dryRun: isDryRun,
    alertsChecked: 0,
    alertsTriggered: 0,
    pushSent: 0,
    emailsSent: 0,
    notificationsFailed: 0,
    alertsSkippedCooldown: 0,
    alertsNoPriceData: 0,
    priceDataFound: 0,
    deadTokensRemoved: 0,
    errors: [] as string[],
  };

  try {
    // ========================================================================
    // STEP 1: Get all ACTIVE alerts
    // ========================================================================

    const activeAlerts = (await prisma.$queryRaw`
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
    `) as any[];

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

        // Get current price: Daily_Prices FIRST, Approved_Prices FALLBACK
        let currentPriceResult: any[] = [];
        let priceSource = "";

        // ---- Strategy 1: Daily_Prices by item_id + market_id (fastest) ----
        if (alert.item_id && alert.market_id) {
          try {
            currentPriceResult = (await prisma.$queryRaw`
              SELECT TOP 1
                price_naira AS price,
                price_date AS validated_at,
                unit,
                item_name,
                market_name
              FROM Daily_Prices
              WHERE item_id = ${alert.item_id}
                AND market_id = ${alert.market_id}
                AND price_naira > 0
              ORDER BY price_date DESC, time_slot DESC
            `) as any[];
            if (currentPriceResult.length > 0) priceSource = "Daily_Prices (by ID)";
          } catch (e: any) {
            console.log(`   ⚠️ Daily_Prices ID lookup: ${e.message?.substring(0, 60)}`);
          }
        }

        // ---- Strategy 2: Daily_Prices by item_name + market_name ----
        if (currentPriceResult.length === 0 && alert.item_name && alert.market_name) {
          try {
            currentPriceResult = (await prisma.$queryRaw`
              SELECT TOP 1
                price_naira AS price,
                price_date AS validated_at,
                unit,
                item_name,
                market_name
              FROM Daily_Prices
              WHERE item_name = ${alert.item_name}
                AND market_name = ${alert.market_name}
                AND price_naira > 0
              ORDER BY price_date DESC, time_slot DESC
            `) as any[];
            if (currentPriceResult.length > 0) priceSource = "Daily_Prices (by name)";
          } catch (e: any) {
            console.log(`   ⚠️ Daily_Prices name lookup: ${e.message?.substring(0, 60)}`);
          }
        }

        // ---- Strategy 3: Daily_Prices by item_name only (any market) ----
        if (currentPriceResult.length === 0 && alert.item_name) {
          try {
            currentPriceResult = (await prisma.$queryRaw`
              SELECT TOP 1
                price_naira AS price,
                price_date AS validated_at,
                unit,
                item_name,
                market_name
              FROM Daily_Prices
              WHERE item_name = ${alert.item_name}
                AND price_naira > 0
              ORDER BY price_date DESC, time_slot DESC
            `) as any[];
            if (currentPriceResult.length > 0) priceSource = `Daily_Prices (any market: ${currentPriceResult[0].market_name})`;
          } catch (e: any) {
            console.log(`   ⚠️ Daily_Prices item-only: ${e.message?.substring(0, 60)}`);
          }
        }

        // ---- Strategy 4: Approved_Prices by ID (fallback) ----
        if (currentPriceResult.length === 0 && alert.item_id && alert.market_id) {
          try {
            currentPriceResult = (await prisma.$queryRaw`
              SELECT TOP 1
                price,
                validated_at,
                unit,
                item_name,
                market_name
              FROM Approved_Prices
              WHERE item_id = ${alert.item_id}
                AND market_id = ${alert.market_id}
                AND validation_status = 'APPROVED'
              ORDER BY validated_at DESC
            `) as any[];
            if (currentPriceResult.length > 0) priceSource = "Approved_Prices (fallback by ID)";
          } catch (e: any) {
            console.log(`   ⚠️ Approved_Prices fallback: ${e.message?.substring(0, 60)}`);
          }
        }

        // ---- Strategy 5: Approved_Prices by name (last resort) ----
        if (currentPriceResult.length === 0 && alert.item_name) {
          try {
            currentPriceResult = (await prisma.$queryRaw`
              SELECT TOP 1
                price,
                validated_at,
                unit,
                item_name,
                market_name
              FROM Approved_Prices
              WHERE item_name LIKE ${"%" + alert.item_name + "%"}
                AND validation_status = 'APPROVED'
              ORDER BY validated_at DESC
            `) as any[];
            if (currentPriceResult.length > 0) priceSource = "Approved_Prices (fallback by name)";
          } catch (e: any) {
            console.log(`   ⚠️ Approved_Prices name fallback: ${e.message?.substring(0, 60)}`);
          }
        }

        if (!currentPriceResult || currentPriceResult.length === 0) {
          console.log(`   ⚠️ No price data found in Daily_Prices OR Approved_Prices for ${alert.item_name} @ ${alert.market_name}`);
          stats.alertsNoPriceData++;
          continue;
        }

        const priceData = currentPriceResult[0];
        const currentPrice = parseFloat(priceData.price);
        const targetPrice = parseFloat(alert.target_price);
        const alertType = alert.alert_type?.toUpperCase();
        stats.priceDataFound++;

        console.log(`   📊 Current: ${formatPrice(currentPrice)} | Target: ${formatPrice(targetPrice)} | Type: ${alertType} | Source: ${priceSource}`);

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

        let recentNotification: any[] = [];
        try {
          recentNotification = (await prisma.$queryRaw`
            SELECT notification_id, sent_at
            FROM Alert_Notifications
            WHERE alert_id = ${alert.alert_id}
              AND sent_at > ${cooldownTime.toISOString()}
            ORDER BY sent_at DESC
          `) as any[];
        } catch (e) {
          console.log("   ⚠️ Cooldown check skipped - column may not exist");
        }

        if (recentNotification && recentNotification.length > 0) {
          console.log(`   ⏸️ Skipping - notification sent within ${ALERT_COOLDOWN_HOURS}h cooldown`);
          stats.alertsSkippedCooldown++;
          continue;
        }

        // ====================================================================
        // STEP 4: Send via PUSH + EMAIL (skip if dry run).
        // WHATSAPP is parked — no sends until alerts move to the Meta engine.
        // ====================================================================

        if (isDryRun) {
          stats.alertsTriggered++;
          console.log(`   🧪 DRY RUN — would send push/email for ${alert.phone_number} | Source: ${priceSource}`);
          continue;
        }

        const payload: AlertPayload = {
          alertId: alert.alert_id,
          itemId: alert.item_id ?? null,
          marketId: alert.market_id ?? null,
          itemName: priceData.item_name || alert.item_name || "Item",
          marketName: priceData.market_name || alert.market_name || "Market",
          alertType,
          targetPrice,
          currentPrice,
          unit: priceData.unit,
        };

        let anyChannelDelivered = false;

        // ---- Channel 1: PUSH (Expo) ----
        const { plain, plus } = phoneVariants(alert.phone_number || "");
        let tokens: string[] = [];
        try {
          const tokenRows = (await prisma.$queryRaw`
            SELECT expo_push_token FROM Consumer_Push_Tokens
            WHERE phone_number IN (${plain}, ${plus})
          `) as any[];
          tokens = tokenRows.map((r) => String(r.expo_push_token)).filter(Boolean);
        } catch (e: any) {
          console.log(`   ⚠️ Push token lookup failed: ${e.message?.substring(0, 60)}`);
        }

        if (tokens.length > 0) {
          const pushResult = await sendExpoPush(tokens, payload);

          // Self-cleaning: drop tokens Expo reports as DeviceNotRegistered
          for (const dead of pushResult.deadTokens) {
            try {
              await prisma.$executeRaw`
                DELETE FROM Consumer_Push_Tokens WHERE expo_push_token = ${dead}`;
              stats.deadTokensRemoved++;
              console.log(`   🧹 Removed dead push token`);
            } catch (e) {
              console.log("   ⚠️ Dead-token cleanup failed:", e);
            }
          }

          await logNotification({
            alertId: alert.alert_id,
            phone: alert.phone_number,
            itemName: payload.itemName,
            marketName: payload.marketName,
            targetPrice,
            currentPrice,
            alertType,
            priceSource,
            channel: "PUSH",
            recipient: alert.phone_number,
            messageSid: pushResult.firstTicketId || null,
            status: pushResult.delivered ? "SENT" : "FAILED",
            errorMessage: pushResult.error || null,
          });

          if (pushResult.delivered) {
            anyChannelDelivered = true;
            stats.pushSent++;
            console.log(`   ✅ Push sent (${tokens.length} device(s))`);
          }
        } else {
          console.log(`   ℹ️ No push tokens registered for ${alert.phone_number}`);
        }

        // ---- Channel 2: EMAIL (only when the consumer has an email) ----
        let email: string | null = null;
        if (alert.consumer_id) {
          try {
            const emailRows = (await prisma.$queryRaw`
              SELECT email FROM Consumers WHERE consumer_id = ${alert.consumer_id}
            `) as any[];
            const raw = emailRows?.[0]?.email;
            if (raw && String(raw).trim().length > 0) email = String(raw).trim();
          } catch (e: any) {
            console.log(`   ⚠️ Email lookup failed: ${e.message?.substring(0, 60)}`);
          }
        }

        if (email) {
          const emailResult = await sendEmail(email, payload, priceSource);

          await logNotification({
            alertId: alert.alert_id,
            phone: alert.phone_number,
            itemName: payload.itemName,
            marketName: payload.marketName,
            targetPrice,
            currentPrice,
            alertType,
            priceSource,
            channel: "EMAIL",
            recipient: email,
            messageSid: null,
            status: emailResult.success ? "SENT" : "FAILED",
            errorMessage: emailResult.error || null,
          });

          if (emailResult.success) {
            anyChannelDelivered = true;
            stats.emailsSent++;
          }
        } else {
          console.log(`   ℹ️ No email on file for consumer ${alert.consumer_id || "(none)"}`);
        }

        // ====================================================================
        // STEP 5: Send-then-TRIGGERED — only flip status if ANY channel
        // delivered; otherwise the alert stays ACTIVE and retries next run.
        // ====================================================================

        if (anyChannelDelivered) {
          stats.alertsTriggered++;
          const now = new Date().toISOString();
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
          stats.errors.push(`Alert ${alert.alert_id}: no channel delivered`);
          console.log(`   ❌ No channel delivered — alert stays ACTIVE for retry`);
        }
      } catch (alertError: any) {
        console.error(`   ❌ Error processing alert ${alert.alert_id}:`, alertError);
        stats.errors.push(`Alert ${alert.alert_id}: ${alertError.message}`);
      }
    }

    // ========================================================================
    // STEP 6: Return summary
    // ========================================================================

    console.log("\n🔔 ═══════════════════════════════════════════════════════════");
    console.log("🔔 ALERT PROCESSOR COMPLETED");
    console.log(`🔔 Checked: ${stats.alertsChecked} | PriceFound: ${stats.priceDataFound} | NoPriceData: ${stats.alertsNoPriceData}`);
    console.log(`🔔 Triggered: ${stats.alertsTriggered} | Push: ${stats.pushSent} | Email: ${stats.emailsSent} | Failed: ${stats.notificationsFailed} | Cooldown: ${stats.alertsSkippedCooldown}`);
    if (isDryRun) console.log(`🔔 MODE: DRY RUN (no messages sent)`);
    console.log("🔔 ═══════════════════════════════════════════════════════════\n");

    return NextResponse.json({
      success: true,
      message: "Alert processing completed",
      stats,
    });
  } catch (error: any) {
    console.error("❌ Alert Processor Error:", error);
    stats.errors.push(error.message);

    return NextResponse.json(
      {
        success: false,
        error: "Alert processing failed",
        stats,
      },
      { status: 500 }
    );
  }
}

// POST - same processing, same auth (delegates to GET)
export async function POST(request: NextRequest) {
  return GET(request);
}

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Pro allows 60s
