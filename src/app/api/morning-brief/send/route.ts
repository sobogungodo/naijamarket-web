// ============================================================================
// src/app/api/morning-brief/send/route.ts
// NaijaMarket Intel - Morning Brief Sender (Cron Job)
// Version: 2.0.0 | Fixed: 2026-03-06
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma as sharedPrisma } from "@/lib/db";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = sharedPrisma;
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM  = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
const CRON_SECRET  = process.env.CRON_SECRET || "";
const SEND_DELAY_MS = 150;

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  if (change > 5)  return "🔴";
  if (change > 0)  return "🟡";
  if (change < -5) return "🟢";
  if (change < 0)  return "🔵";
  return "⚪";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    console.error("[Brief] Twilio credentials missing");
    return false;
  }
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: TWILIO_FROM,
          To:   phoneToWA(phone),
          Body: message,
        }).toString(),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Brief] Twilio error for ${phone}:`, err);
    }
    return res.ok;
  } catch (e: any) {
    console.error(`[Brief] sendWhatsApp exception:`, e.message);
    return false;
  }
}

// ── Generate Default Brief ────────────────────────────────────────────────────
// Uses Latest_Prices_Summary (fast cache) with correct column names

async function generateDefaultBrief(): Promise<string> {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-NG", {
    weekday: "long", day: "numeric", month: "long",
  });

  // Top 10 movers — uses price_change_pct from Latest_Prices_Summary
  const topMovers = await prisma.$queryRaw`
    SELECT TOP 10
      item_name,
      market_name,
      state,
      price_naira      AS current_price,
      price_change_pct AS change_pct,
      trend
    FROM dbo.Latest_Prices_Summary
    WHERE price_change_pct IS NOT NULL
      AND price_naira > 0
    ORDER BY ABS(price_change_pct) DESC
  ` as any[];

  // Best buying opportunity (biggest drop)
  const bestDeal = await prisma.$queryRaw`
    SELECT TOP 1
      item_name, market_name,
      price_naira      AS current_price,
      price_change_pct AS change_pct
    FROM dbo.Latest_Prices_Summary
    WHERE price_change_pct < -2
      AND price_naira > 0
    ORDER BY price_change_pct ASC
  ` as any[];

  // Build message
  let msg = `📊 *NaijaMarket Morning Brief*\n`;
  msg += `📅 ${dateStr}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (topMovers.length === 0) {
    msg += `_No price movements recorded yet today._\n\n`;
    msg += `Visit naijamarketintel.ng for live prices.\n`;
    return msg;
  }

  msg += `📈 *Top 10 Price Movers:*\n`;
  msg += `──────────────────────\n`;

  for (const item of topMovers) {
    const emoji = trendEmoji(Number(item.change_pct) || 0);
    const sign  = Number(item.change_pct) >= 0 ? "+" : "";
    const pct   = Number(item.change_pct || 0).toFixed(1);
    msg += `${emoji} *${item.item_name}*\n`;
    msg += `   ${item.market_name} — ${naira(Number(item.current_price))} (${sign}${pct}%)\n\n`;
  }

  // Buying tip
  if (bestDeal.length > 0) {
    const deal = bestDeal[0];
    const pct  = Math.abs(Number(deal.change_pct)).toFixed(1);
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💡 *Buying Tip:* ${deal.item_name} dropped ${pct}% at ${deal.market_name}. Good day to buy!\n`;
  }

  msg += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔗 naijamarketintel.ng\n`;
  msg += `Reply *STOP BRIEF* to unsubscribe`;

  return msg;
}

// ── Generate Personalized Brief ───────────────────────────────────────────────

async function generatePersonalizedBrief(
  selectedMarkets: string[],
  selectedItems: string[]
): Promise<string> {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-NG", {
    weekday: "long", day: "numeric", month: "long",
  });

  const marketList = selectedMarkets.map(m => `'${m.replace(/'/g, "''")}'`).join(",");
  const itemFilter = selectedItems.length > 0
    ? `AND item_id IN (${selectedItems.map(i => `'${i.replace(/'/g, "''")}'`).join(",")})`
    : "";

  // Query Latest_Prices_Summary with correct columns
  const prices = await prisma.$queryRawUnsafe(`
    SELECT 
      item_name, market_name, state,
      price_naira      AS current_price,
      price_change_pct AS change_pct,
      trend
    FROM dbo.Latest_Prices_Summary
    WHERE market_id IN (${marketList})
      ${itemFilter}
      AND price_naira > 0
    ORDER BY market_name, ABS(ISNULL(price_change_pct, 0)) DESC
  `) as any[];

  // Group by market
  const byMarket: Record<string, any[]> = {};
  for (const p of prices) {
    if (!byMarket[p.market_name]) byMarket[p.market_name] = [];
    byMarket[p.market_name].push(p);
  }

  let msg = `📊 *Your Morning Brief*\n`;
  msg += `📅 ${dateStr}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (Object.keys(byMarket).length === 0) {
    msg += `_No price data for your markets today._\n`;
    msg += `Visit naijamarketintel.ng for live prices.\n`;
    return msg;
  }

  for (const [market, items] of Object.entries(byMarket)) {
    msg += `🏪 *${market}*\n`;
    for (const item of (items as any[]).slice(0, 10)) {
      const emoji  = trendEmoji(Number(item.change_pct) || 0);
      const change = item.change_pct != null
        ? ` (${Number(item.change_pct) >= 0 ? "+" : ""}${Number(item.change_pct).toFixed(1)}%)`
        : "";
      msg += `  ${emoji} ${item.item_name}: ${naira(Number(item.current_price))}${change}\n`;
    }
    msg += `\n`;
  }

  // Cross-market savings
  if (Object.keys(byMarket).length > 1) {
    const itemMap: Record<string, { market: string; price: number }[]> = {};
    for (const p of prices) {
      if (!itemMap[p.item_name]) itemMap[p.item_name] = [];
      itemMap[p.item_name].push({ market: p.market_name, price: Number(p.current_price) });
    }
    const savings: string[] = [];
    for (const [item, mkts] of Object.entries(itemMap)) {
      if (mkts.length < 2) continue;
      mkts.sort((a, b) => a.price - b.price);
      const diff = mkts[mkts.length-1].price - mkts[0].price;
      if (diff / mkts[mkts.length-1].price > 0.03) {
        savings.push(`💡 *${item}*: ${naira(diff)} cheaper at ${mkts[0].market}`);
      }
    }
    if (savings.length > 0) {
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🔍 *Best Deals:*\n`;
      for (const s of savings.slice(0, 3)) msg += `${s}\n`;
      msg += `\n`;
    }
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔗 naijamarketintel.ng\n`;
  msg += `Reply *STOP BRIEF* to unsubscribe`;

  return msg;
}

// ── Main Cron Handler ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const testPhone = searchParams.get("phone");

  // SECURITY: auth is required unconditionally. Previously a `!isTest` clause let
  // anyone call ?test=1&phone=<any> with no CRON_SECRET, triggering a brief SEND
  // to an arbitrary phone (spam / messaging-cost abuse) plus a per-phone
  // subscription read. A caller holding the CRON_SECRET can still pass ?phone= to
  // target a single subscriber for a legitimate test.
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const t0    = Date.now();
  const stats = {
    totalSubscribers: 0,
    defaultBriefs: 0,
    personalizedBriefs: 0,
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    console.log(`[Brief] ═══ Morning Brief Send START ═══`);

    // Fetch subscribers
    let subscribers: any[];
    if (testPhone) {
      subscribers = await prisma.$queryRaw`
        SELECT * FROM Morning_Brief_Subscriptions
        WHERE phone_number = ${testPhone} AND status = 'ACTIVE'
      ` as any[];
      if (subscribers.length === 0) {
        subscribers = [{ phone_number: testPhone, plan_type: "DEFAULT", selected_markets: "[]", selected_items: "[]" }];
      }
    } else {
      subscribers = await prisma.$queryRaw`
        SELECT * FROM Morning_Brief_Subscriptions
        WHERE status = 'ACTIVE'
      ` as any[];
    }

    stats.totalSubscribers = subscribers.length;
    console.log(`[Brief] ${subscribers.length} active subscribers`);

    if (subscribers.length === 0) {
      return NextResponse.json({ success: true, message: "No active subscribers", stats });
    }

    // Generate default brief once (shared)
    let defaultBrief: string | null = null;

    for (const sub of subscribers) {
      try {
        let message: string;

        if (sub.plan_type === "PERSONALIZED") {
          let markets: string[] = [];
          let items:   string[] = [];
          try { markets = JSON.parse(sub.selected_markets || "[]"); } catch {}
          try { items   = JSON.parse(sub.selected_items   || "[]"); } catch {}

          if (markets.length === 0) {
            if (!defaultBrief) defaultBrief = await generateDefaultBrief();
            message = defaultBrief;
            stats.defaultBriefs++;
          } else {
            message = await generatePersonalizedBrief(markets, items);
            stats.personalizedBriefs++;
          }
        } else {
          if (!defaultBrief) defaultBrief = await generateDefaultBrief();
          message = defaultBrief;
          stats.defaultBriefs++;
        }

        const sent = await sendWhatsApp(sub.phone_number, message);

        if (sent) {
          stats.sent++;
          if (sub.brief_id) {
            await prisma.$executeRaw`
              UPDATE Morning_Brief_Subscriptions
              SET last_sent_at = GETDATE(),
                  total_sent   = ISNULL(total_sent, 0) + 1,
                  updated_at   = GETDATE()
              WHERE brief_id = ${sub.brief_id}
            `;
          }
        } else {
          stats.failed++;
          stats.errors.push(`Failed: ${sub.phone_number}`);
        }

        await sleep(SEND_DELAY_MS);

      } catch (e: any) {
        stats.failed++;
        stats.errors.push(`${sub.phone_number}: ${e.message}`);
        console.error(`[Brief] Error for ${sub.phone_number}:`, e.message);
      }
    }

    const duration = Date.now() - t0;
    console.log(`[Brief] ✅ DONE ${duration}ms | sent=${stats.sent} failed=${stats.failed}`);

    return NextResponse.json({
      success: true,
      stats,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });

  } catch (e: any) {
    console.error("[Brief] FATAL:", e);
    return NextResponse.json({ success: false, error: e.message, stats }, { status: 500 });
  }
}