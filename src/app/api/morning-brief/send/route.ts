// ============================================================================
// src/app/api/morning-brief/send/route.ts
// NaijaMarket Intel - Morning Brief Sender (Cron Job)
// Version: 1.0.0 | Date: 2026-02-20
//
// Runs daily at 4:30 AM UTC (5:30 AM WAT) via Vercel Cron
// Generates price briefs and sends via WhatsApp (Twilio)
//
// DEFAULT brief: Top 10 movers across all markets
// PERSONALIZED brief: User's selected markets + items
//
// VERCEL CRON (add to vercel.json):
//   { "path": "/api/morning-brief/send", "schedule": "30 4 * * *" }
//
// MANUAL TEST:
//   GET /api/morning-brief/send?test=1
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// PRISMA
// ============================================================================

import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ============================================================================
// CONFIG
// ============================================================================

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
const CRON_SECRET = process.env.CRON_SECRET || "";

// Rate limit: 1 message per 100ms to avoid Twilio throttle
const SEND_DELAY_MS = 100;

// ============================================================================
// HELPERS
// ============================================================================

function phoneToWA(phone: string): string {
  let c = phone.replace(/\D/g, "");
  if (c.startsWith("0")) c = "234" + c.substring(1);
  if (!c.startsWith("234")) c = "234" + c;
  return `whatsapp:+${c}`;
}

function naira(amount: number): string {
  if (amount >= 1000) return `₦${Math.round(amount).toLocaleString("en-NG")}`;
  return `₦${amount.toFixed(0)}`;
}

function trendEmoji(change: number): string {
  if (change > 5) return "🔴⬆";
  if (change > 0) return "📈";
  if (change < -5) return "🟢⬇";
  if (change < 0) return "📉";
  return "➡️";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_TOKEN) return false;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: TWILIO_FROM,
          To: phoneToWA(phone),
          Body: message,
        }).toString(),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// GENERATE DEFAULT BRIEF (Top movers across all markets)
// ============================================================================

async function generateDefaultBrief(): Promise<string> {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  // Get top 10 commodities with biggest price changes
  const topMovers = (await prisma.$queryRaw`
    WITH LatestPrices AS (
      SELECT 
        item_name,
        market_name,
        price,
        ROW_NUMBER() OVER (PARTITION BY item_name, market_name ORDER BY created_at DESC) as rn
      FROM Daily_Prices
      WHERE created_at >= DATEADD(day, -1, GETDATE())
    ),
    PreviousPrices AS (
      SELECT 
        item_name,
        market_name,
        price,
        ROW_NUMBER() OVER (PARTITION BY item_name, market_name ORDER BY created_at DESC) as rn
      FROM Daily_Prices
      WHERE created_at >= DATEADD(day, -3, GETDATE())
        AND created_at < DATEADD(day, -1, GETDATE())
    )
    SELECT TOP 10
      l.item_name,
      l.market_name,
      l.price AS current_price,
      p.price AS previous_price,
      CASE 
        WHEN p.price > 0 THEN ((l.price - p.price) / p.price) * 100
        ELSE 0
      END AS change_pct
    FROM LatestPrices l
    LEFT JOIN PreviousPrices p 
      ON l.item_name = p.item_name AND l.market_name = p.market_name AND p.rn = 1
    WHERE l.rn = 1
      AND p.price IS NOT NULL
      AND p.price > 0
    ORDER BY ABS(CASE WHEN p.price > 0 THEN ((l.price - p.price) / p.price) * 100 ELSE 0 END) DESC
  `) as any[];

  // Get a tip (biggest drop = buying opportunity)
  const bestDeal = (await prisma.$queryRaw`
    WITH LatestPrices AS (
      SELECT 
        item_name, market_name, price,
        ROW_NUMBER() OVER (PARTITION BY item_name, market_name ORDER BY created_at DESC) as rn
      FROM Daily_Prices
      WHERE created_at >= DATEADD(day, -1, GETDATE())
    ),
    PreviousPrices AS (
      SELECT 
        item_name, market_name, price,
        ROW_NUMBER() OVER (PARTITION BY item_name, market_name ORDER BY created_at DESC) as rn
      FROM Daily_Prices
      WHERE created_at >= DATEADD(day, -3, GETDATE())
        AND created_at < DATEADD(day, -1, GETDATE())
    )
    SELECT TOP 1
      l.item_name, l.market_name,
      l.price AS current_price,
      CASE WHEN p.price > 0 THEN ((l.price - p.price) / p.price) * 100 ELSE 0 END AS change_pct
    FROM LatestPrices l
    JOIN PreviousPrices p ON l.item_name = p.item_name AND l.market_name = p.market_name AND p.rn = 1
    WHERE l.rn = 1 AND p.price > 0
    ORDER BY ((l.price - p.price) / p.price) ASC
  `) as any[];

  // Build message
  let msg = `🌅 *NaijaMarket Morning Brief*\n`;
  msg += `📅 ${dateStr} | 5:30 AM WAT\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (topMovers.length === 0) {
    msg += `_No price data available yet today._\n\n`;
    msg += `Check back later or type *price* to query.\n`;
    return msg;
  }

  msg += `📊 *Top Movers Today:*\n\n`;

  for (const item of topMovers) {
    const emoji = trendEmoji(item.change_pct);
    const sign = item.change_pct >= 0 ? "+" : "";
    msg += `${emoji} *${item.item_name}*\n`;
    msg += `   ${item.market_name}: ${naira(item.current_price)} (${sign}${item.change_pct.toFixed(1)}%)\n\n`;
  }

  // Tip
  if (bestDeal.length > 0 && bestDeal[0].change_pct < -2) {
    const deal = bestDeal[0];
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💡 *Tip:* ${deal.item_name} dropped ${naira(Math.abs(deal.current_price * deal.change_pct / 100))} at ${deal.market_name}. Good day to buy!\n`;
  }

  msg += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `Type *price* to check any item\n`;
  msg += `Type *STOP BRIEF* to unsubscribe`;

  return msg;
}

// ============================================================================
// GENERATE PERSONALIZED BRIEF (User's selected markets + items)
// ============================================================================

async function generatePersonalizedBrief(
  selectedMarkets: string[],
  selectedItems: string[]
): Promise<string> {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  // Build WHERE clauses
  const marketPlaceholders = selectedMarkets.map((_, i) => `@m${i}`).join(", ");
  const itemPlaceholders = selectedItems.length > 0
    ? selectedItems.map((_, i) => `@i${i}`).join(", ")
    : null;

  // Get latest prices for user's markets (and items if selected)
  let query = `
    WITH LatestPrices AS (
      SELECT 
        item_name, market_name, market_id, price,
        ROW_NUMBER() OVER (PARTITION BY item_name, market_name ORDER BY created_at DESC) as rn
      FROM Daily_Prices
      WHERE created_at >= DATEADD(day, -1, GETDATE())
        AND market_id IN (${selectedMarkets.map((m) => `'${m.replace(/'/g, "''")}'`).join(",")})
        ${selectedItems.length > 0 ? `AND item_id IN (${selectedItems.map((i) => `'${i.replace(/'/g, "''")}'`).join(",")})` : ""}
    ),
    PreviousPrices AS (
      SELECT 
        item_name, market_name, price,
        ROW_NUMBER() OVER (PARTITION BY item_name, market_name ORDER BY created_at DESC) as rn
      FROM Daily_Prices
      WHERE created_at >= DATEADD(day, -3, GETDATE())
        AND created_at < DATEADD(day, -1, GETDATE())
        AND market_id IN (${selectedMarkets.map((m) => `'${m.replace(/'/g, "''")}'`).join(",")})
    )
    SELECT 
      l.item_name, l.market_name, l.price AS current_price,
      p.price AS previous_price,
      CASE WHEN p.price > 0 THEN ((l.price - p.price) / p.price) * 100 ELSE 0 END AS change_pct
    FROM LatestPrices l
    LEFT JOIN PreviousPrices p 
      ON l.item_name = p.item_name AND l.market_name = p.market_name AND p.rn = 1
    WHERE l.rn = 1
    ORDER BY l.market_name, l.item_name
  `;

  const prices = (await prisma.$queryRawUnsafe(query)) as any[];

  // Group by market
  const byMarket: Record<string, any[]> = {};
  for (const p of prices) {
    if (!byMarket[p.market_name]) byMarket[p.market_name] = [];
    byMarket[p.market_name].push(p);
  }

  // Build message
  let msg = `🌅 *Your Morning Brief*\n`;
  msg += `📅 ${dateStr} | 5:30 AM WAT\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (Object.keys(byMarket).length === 0) {
    msg += `_No price data for your markets yet today._\n\n`;
    msg += `Check back later or type *price* to query.\n`;
    return msg;
  }

  for (const [market, items] of Object.entries(byMarket)) {
    msg += `🏪 *${market}*\n`;

    for (const item of items.slice(0, 10)) {
      const emoji = trendEmoji(item.change_pct || 0);
      const change =
        item.previous_price && item.change_pct
          ? ` (${item.change_pct >= 0 ? "+" : ""}${item.change_pct.toFixed(1)}%)`
          : "";
      msg += `  ${emoji} ${item.item_name}: ${naira(item.current_price)}${change}\n`;
    }

    msg += `\n`;
  }

  // Cross-market comparison (find cheapest for each item)
  if (Object.keys(byMarket).length > 1) {
    const itemPrices: Record<string, { market: string; price: number }[]> = {};
    for (const p of prices) {
      if (!itemPrices[p.item_name]) itemPrices[p.item_name] = [];
      itemPrices[p.item_name].push({ market: p.market_name, price: p.current_price });
    }

    const savings: string[] = [];
    for (const [item, mkts] of Object.entries(itemPrices)) {
      if (mkts.length < 2) continue;
      mkts.sort((a, b) => a.price - b.price);
      const cheapest = mkts[0];
      const priciest = mkts[mkts.length - 1];
      const diff = priciest.price - cheapest.price;
      if (diff > 0 && diff / priciest.price > 0.03) {
        savings.push(
          `💡 *${item}*: ${naira(diff)} cheaper at ${cheapest.market} vs ${priciest.market}`
        );
      }
    }

    if (savings.length > 0) {
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🔍 *Best Deals:*\n`;
      for (const s of savings.slice(0, 3)) {
        msg += `${s}\n`;
      }
      msg += `\n`;
    }
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `Type *price* to check any item\n`;
  msg += `Type *STOP BRIEF* to unsubscribe`;

  return msg;
}

// ============================================================================
// MAIN CRON HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  // Auth
  const auth = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const isTest = searchParams.get("test") === "1";
  const testPhone = searchParams.get("phone"); // Send to single phone for testing

  if (!isTest && CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();
  const stats = {
    totalSubscribers: 0,
    defaultBriefs: 0,
    personalizedBriefs: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    // Get current WAT time to match delivery_time
    const now = new Date();
    const watHour = (now.getUTCHours() + 1) % 24; // UTC+1 = WAT
    const watMin = now.getUTCMinutes();
    const currentTime = `${String(watHour).padStart(2, "0")}:${String(watMin).padStart(2, "0")}`;

    console.log(`[Brief] ═══ Morning Brief Send | WAT: ${currentTime} ═══`);

    // Fetch all active subscribers
    // For cron, we send to all with delivery_time matching current window (±15 min)
    let subscribers: any[];

    if (testPhone) {
      // Test mode: send to specific phone
      subscribers = (await prisma.$queryRaw`
        SELECT * FROM Morning_Brief_Subscriptions
        WHERE phone_number = ${testPhone} AND status = 'ACTIVE'
      `) as any[];

      // If no subscription exists for test phone, create a default brief
      if (subscribers.length === 0) {
        subscribers = [{
          phone_number: testPhone,
          plan_type: "DEFAULT",
          selected_markets: "[]",
          selected_items: "[]",
        }];
      }
    } else {
      subscribers = (await prisma.$queryRaw`
        SELECT * FROM Morning_Brief_Subscriptions
        WHERE status = 'ACTIVE'
      `) as any[];
    }

    stats.totalSubscribers = subscribers.length;
    console.log(`[Brief] Found ${subscribers.length} active subscribers`);

    if (subscribers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active subscribers",
        stats,
        duration_ms: Date.now() - t0,
      });
    }

    // Generate default brief once (shared by all DEFAULT subscribers)
    let defaultBrief: string | null = null;

    for (const sub of subscribers) {
      try {
        let message: string;

        if (sub.plan_type === "PERSONALIZED") {
          // Parse selected markets/items
          let markets: string[] = [];
          let items: string[] = [];
          try { markets = JSON.parse(sub.selected_markets || "[]"); } catch {}
          try { items = JSON.parse(sub.selected_items || "[]"); } catch {}

          if (markets.length === 0) {
            // Fallback to default if no markets selected
            if (!defaultBrief) defaultBrief = await generateDefaultBrief();
            message = defaultBrief;
            stats.defaultBriefs++;
          } else {
            message = await generatePersonalizedBrief(markets, items);
            stats.personalizedBriefs++;
          }
        } else {
          // Default brief
          if (!defaultBrief) defaultBrief = await generateDefaultBrief();
          message = defaultBrief;
          stats.defaultBriefs++;
        }

        // Send
        const sent = await sendWhatsApp(sub.phone_number, message);

        if (sent) {
          stats.sent++;
          // Update last_sent and counter
          if (sub.brief_id) {
            await prisma.$executeRaw`
              UPDATE Morning_Brief_Subscriptions
              SET last_sent_at = GETDATE(),
                  total_sent = total_sent + 1,
                  consecutive_failures = 0,
                  updated_at = GETDATE()
              WHERE brief_id = ${sub.brief_id}
            `;
          }
        } else {
          stats.failed++;
          if (sub.brief_id) {
            await prisma.$executeRaw`
              UPDATE Morning_Brief_Subscriptions
              SET consecutive_failures = consecutive_failures + 1,
                  updated_at = GETDATE()
              WHERE brief_id = ${sub.brief_id}
            `;
          }
        }

        // Rate limit
        await sleep(SEND_DELAY_MS);
      } catch (e: any) {
        stats.failed++;
        stats.errors.push(`${sub.phone_number}: ${e.message}`);
      }
    }

    // Auto-pause subscribers with 7+ consecutive failures
    await prisma.$executeRaw`
      UPDATE Morning_Brief_Subscriptions
      SET status = 'PAUSED', updated_at = GETDATE()
      WHERE consecutive_failures >= 7 AND status = 'ACTIVE'
    `;

    const duration = Date.now() - t0;
    console.log(
      `[Brief] ✅ ${duration}ms | sent=${stats.sent} failed=${stats.failed} default=${stats.defaultBriefs} personalized=${stats.personalizedBriefs}`
    );

    return NextResponse.json({
      success: true,
      stats,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[Brief] Fatal:", e);
    return NextResponse.json(
      { success: false, error: e.message, stats },
      { status: 500 }
    );
  }
}
