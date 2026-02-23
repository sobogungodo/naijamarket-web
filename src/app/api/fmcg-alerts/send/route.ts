// ============================================================================
// src/app/api/fmcg-alerts/send/route.ts
// NaijaMarket Intel - FMCG Competitor Price Tracking Alerts
// Version: 1.0.0 | Date: 2026-02-23
//
// Vercel cron: { "path": "/api/fmcg-alerts/send", "schedule": "0 5 * * *" }
// Manual: GET /api/fmcg-alerts/send?test=1
//
// Sends daily/weekly price intelligence to FMCG companies tracking competitors
// Delivery: Email (Brevo), WhatsApp (Twilio), or API webhook
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
const CRON_SECRET = process.env.CRON_SECRET || "";

// ============================================================================
// GET — Cron trigger
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isTest = searchParams.get("test") === "1";
  const cronSecret = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!isTest && CRON_SECRET && cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const alertTypes = ["DAILY"];
  if (dayOfWeek === 1) alertTypes.push("WEEKLY"); // Monday for weekly

  const stats = { total: 0, sent: 0, failed: 0, errors: [] as string[] };

  try {
    // Fetch active subscriptions due for alerts
    const subs = await prisma.$queryRawUnsafe<any[]>(`
      SELECT *
      FROM FMCG_Alert_Subscriptions
      WHERE status = 'ACTIVE'
        AND alert_type IN (${alertTypes.map(t => `'${t}'`).join(",")})
        AND (paid_through IS NULL OR paid_through >= CAST(GETDATE() AS DATE))
    `);

    stats.total = subs.length;

    for (const sub of subs) {
      try {
        // Parse tracked items and markets
        const items: string[] = JSON.parse(sub.tracked_items || "[]");
        const markets: string[] = sub.tracked_markets ? JSON.parse(sub.tracked_markets) : [];
        const threshold = Number(sub.price_change_threshold) || 5;

        if (items.length === 0) continue;

        // Fetch price data for tracked items
        const priceData = await fetchFMCGPrices(items, markets, threshold);

        if (priceData.length === 0) continue;

        // Generate alert content
        const alertContent = generateAlertContent(sub, priceData, threshold);

        // Send via configured method
        let sent = false;
        const method = sub.delivery_method || "EMAIL";

        if ((method === "EMAIL" || method === "BOTH") && sub.contact_email) {
          sent = await sendEmailAlert(sub, alertContent);
        }
        if ((method === "WHATSAPP" || method === "BOTH") && sub.whatsapp_number) {
          const waSent = await sendWhatsAppAlert(sub, alertContent.whatsappVersion);
          sent = sent || waSent;
        }
        if (method === "API" && sub.api_webhook_url) {
          sent = await sendWebhookAlert(sub, priceData);
        }

        if (sent) {
          stats.sent++;
          await prisma.$executeRaw`
            UPDATE FMCG_Alert_Subscriptions
            SET total_alerts_sent = total_alerts_sent + 1, last_alert_at = GETDATE(), updated_at = GETDATE()
            WHERE fmcg_id = ${sub.fmcg_id}
          `;
          await prisma.$executeRaw`
            INSERT INTO FMCG_Alert_Log (fmcg_id, alert_date, items_included, markets_included, delivery_status, delivery_method)
            VALUES (${sub.fmcg_id}, CAST(GETDATE() AS DATE), ${priceData.length}, ${markets.length || 0}, 'SENT', ${method})
          `;
        } else {
          stats.failed++;
        }
      } catch (e: any) {
        stats.failed++;
        stats.errors.push(`${sub.company_name}: ${e.message}`);
      }
    }

    return NextResponse.json({ success: true, stats, timestamp: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, stats }, { status: 500 });
  }
}

// ============================================================================
// FETCH PRICES FOR FMCG
// ============================================================================

async function fetchFMCGPrices(items: string[], markets: string[], threshold: number) {
  const itemFilter = items.map(i => `'${i.replace(/'/g, "''")}'`).join(",");
  let marketFilter = "";
  if (markets.length > 0) {
    marketFilter = `AND lps.market_name IN (${markets.map(m => `'${m.replace(/'/g, "''")}'`).join(",")})`;
  }

  const prices = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      lps.item_name,
      lps.market_name,
      lps.state,
      lps.latest_price,
      lps.previous_price,
      lps.price_change_pct,
      lps.price_date,
      lps.seven_day_avg,
      lps.thirty_day_avg,
      lps.unit,
      CASE 
        WHEN ABS(lps.price_change_pct) >= ${threshold} THEN 'ALERT'
        WHEN ABS(lps.price_change_pct) >= ${threshold * 0.5} THEN 'WATCH'
        ELSE 'STABLE'
      END as alert_level
    FROM Latest_Prices_Summary lps
    WHERE lps.item_name IN (${itemFilter})
    ${marketFilter}
    ORDER BY ABS(lps.price_change_pct) DESC
  `);

  return prices.map(p => ({
    item: p.item_name,
    market: p.market_name,
    state: p.state,
    price: Number(p.latest_price || 0),
    previousPrice: Number(p.previous_price || 0),
    change: Number(p.price_change_pct || 0),
    avg7d: Number(p.seven_day_avg || 0),
    avg30d: Number(p.thirty_day_avg || 0),
    unit: p.unit,
    date: p.price_date,
    alertLevel: p.alert_level,
  }));
}

// ============================================================================
// GENERATE ALERT CONTENT
// ============================================================================

function generateAlertContent(sub: any, prices: any[], threshold: number) {
  const alerts = prices.filter(p => Math.abs(p.change) >= threshold);
  const date = new Date().toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // WhatsApp version
  let wa = `📊 *FMCG Price Intelligence*\n📅 ${date}\n`;
  wa += `🏢 ${sub.company_name}\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (alerts.length > 0) {
    wa += `⚠️ *${alerts.length} PRICE ALERT${alerts.length > 1 ? "S" : ""}*\n\n`;
    alerts.slice(0, 10).forEach(p => {
      const arrow = p.change >= 0 ? "🔴⬆" : "🟢⬇";
      wa += `${arrow} *${p.item}* — ${p.market}\n`;
      wa += `   ₦${p.price.toLocaleString()} (${p.change >= 0 ? "+" : ""}${p.change.toFixed(1)}%)\n`;
      wa += `   7d avg: ₦${p.avg7d.toLocaleString()} | 30d avg: ₦${p.avg30d.toLocaleString()}\n\n`;
    });
  }

  wa += `📋 *ALL TRACKED ITEMS (${prices.length})*\n\n`;
  prices.slice(0, 15).forEach(p => {
    const emoji = p.change > 0 ? "📈" : p.change < 0 ? "📉" : "➡️";
    wa += `${emoji} ${p.item} — ${p.market}: ₦${p.price.toLocaleString()} (${p.change >= 0 ? "+" : ""}${p.change.toFixed(1)}%)\n`;
  });

  wa += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  wa += `Powered by NaijaMarket Intel\nhttps://naijamarketintel.com`;

  // Email HTML version
  const alertRows = prices.map(p => {
    const color = p.change > 0 ? "#ff1744" : p.change < 0 ? "#00c853" : "#666";
    const arrow = p.change > 0 ? "▲" : p.change < 0 ? "▼" : "—";
    const badge = p.alertLevel === "ALERT" ? '<span style="background:#ff1744;color:white;padding:2px 6px;border-radius:4px;font-size:10px;">ALERT</span>' : p.alertLevel === "WATCH" ? '<span style="background:#ff9100;color:white;padding:2px 6px;border-radius:4px;font-size:10px;">WATCH</span>' : "";
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1e1e1e;color:#e0e0e0;font-weight:600;">${p.item} ${badge}</td>
      <td style="padding:8px;border-bottom:1px solid #1e1e1e;color:#999;">${p.market}</td>
      <td style="padding:8px;border-bottom:1px solid #1e1e1e;color:#e0e0e0;text-align:right;font-weight:700;">₦${p.price.toLocaleString()}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e1e1e;color:${color};text-align:right;font-weight:600;">${arrow} ${Math.abs(p.change).toFixed(1)}%</td>
    </tr>`;
  }).join("");

  const emailHTML = `
    <div style="background:#0a0a0a;padding:20px;font-family:-apple-system,sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:#111;border-radius:12px;overflow:hidden;">
        <div style="background:#00a36c;padding:16px 24px;">
          <h1 style="color:white;margin:0;font-size:18px;">📊 FMCG Price Intelligence Report</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:12px;">${date} • ${sub.company_name}</p>
        </div>
        ${alerts.length > 0 ? `<div style="background:#1a0000;border-left:4px solid #ff1744;padding:12px 16px;margin:16px;">
          <p style="color:#ff1744;font-weight:700;margin:0;">⚠️ ${alerts.length} items exceeded your ${threshold}% change threshold</p>
        </div>` : ""}
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#0a0a0a;">
            <th style="text-align:left;padding:10px 12px;color:#666;font-size:11px;text-transform:uppercase;">Item</th>
            <th style="text-align:left;padding:10px 8px;color:#666;font-size:11px;">Market</th>
            <th style="text-align:right;padding:10px 8px;color:#666;font-size:11px;">Price</th>
            <th style="text-align:right;padding:10px 12px;color:#666;font-size:11px;">Change</th>
          </tr></thead>
          <tbody>${alertRows}</tbody>
        </table>
        <div style="padding:16px;text-align:center;">
          <a href="https://naijamarketintel.com/dashboard/prices" style="display:inline-block;background:#00a36c;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View Full Analysis →</a>
        </div>
        <div style="padding:12px;text-align:center;border-top:1px solid #1e1e1e;">
          <p style="color:#666;font-size:10px;margin:0;">NaijaMarket Intel • The Bloomberg of African Commodities</p>
        </div>
      </div>
    </div>`;

  return { whatsappVersion: wa, emailHTML, subject: `📊 Price Alert: ${alerts.length} items changed >${threshold}% — ${sub.company_name}` };
}

// ============================================================================
// DELIVERY METHODS
// ============================================================================

async function sendEmailAlert(sub: any, content: { emailHTML: string; subject: string }) {
  if (!BREVO_API_KEY) return false;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "NaijaMarket Intel", email: "noreply@naijamarketintel.ng" },
        to: [{ email: sub.contact_email, name: sub.contact_name }],
        subject: content.subject,
        htmlContent: content.emailHTML,
      }),
    });
    return res.ok;
  } catch { return false; }
}

async function sendWhatsAppAlert(sub: any, message: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN) return false;
  try {
    let phone = String(sub.whatsapp_number).replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "234" + phone.substring(1);
    if (!phone.startsWith("234")) phone = "234" + phone;

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: TWILIO_FROM, To: `whatsapp:+${phone}`, Body: message }),
    });
    return res.ok;
  } catch { return false; }
}

async function sendWebhookAlert(sub: any, priceData: any[]) {
  if (!sub.api_webhook_url) return false;
  try {
    const res = await fetch(sub.api_webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Source": "NaijaMarket-Intel" },
      body: JSON.stringify({
        company: sub.company_name,
        alert_date: new Date().toISOString(),
        prices: priceData,
        total_items: priceData.length,
        alerts: priceData.filter(p => p.alertLevel === "ALERT").length,
      }),
    });
    return res.ok;
  } catch { return false; }
}
