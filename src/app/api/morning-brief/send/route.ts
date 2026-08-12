// ============================================================================
// src/app/api/morning-brief/send/route.ts
// NaijaMarket Intel - Morning Brief Sender (Cron Job)
// Version: 3.0.0 | Migrated Twilio → Meta: 2026-08-13
//
// The daily brief now sends the approved `morning_brief_ready` template
// (wrapper sendMorningBrief) — a short "brief ready" teaser carrying the
// market count, top mover, and its change %, linking to the site. WhatsApp
// can't deliver free-form rich text outside its 24h service window, so the
// full in-chat brief (top-10 movers / personalized per-market) was retired
// alongside Twilio. Cron + registry + vercel.json entry are unchanged.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma as sharedPrisma } from "@/lib/db";
import { PrismaClient } from "@prisma/client";
import { cronGuard } from "@/lib/scheduler";
import { sendMorningBrief } from "@/lib/whatsapp";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = sharedPrisma;
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const SEND_DELAY_MS = 150;

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function fmtPct(v: number): string {
  const n = Number.isFinite(v) ? v : 0;
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
}

// Teaser payload for the `morning_brief_ready` template.
interface BriefTeaser {
  marketCount: number;
  topItem: string;
  changePct: string; // formatted, e.g. "+4.2"
}

// ── Teaser params: default (all markets, shared across DEFAULT subs) ──────────

async function defaultTeaser(): Promise<BriefTeaser | null> {
  const rows = await prisma.$queryRaw`
    SELECT TOP 1
      item_name,
      price_change_pct AS change_pct,
      (SELECT COUNT(DISTINCT market_name)
         FROM dbo.Latest_Prices_Summary
         WHERE price_naira > 0) AS market_count
    FROM dbo.Latest_Prices_Summary
    WHERE price_change_pct IS NOT NULL
      AND price_naira > 0
    ORDER BY ABS(price_change_pct) DESC
  ` as any[];
  if (!rows.length) return null;
  const r = rows[0];
  return {
    marketCount: Number(r.market_count) || 0,
    topItem: r.item_name,
    changePct: fmtPct(Number(r.change_pct)),
  };
}

// ── Teaser params: personalized (subscriber's selected markets) ───────────────

async function personalizedTeaser(markets: string[]): Promise<BriefTeaser | null> {
  const marketList = markets.map((m) => `'${m.replace(/'/g, "''")}'`).join(",");
  const rows = await prisma.$queryRawUnsafe(`
    SELECT TOP 1
      item_name,
      price_change_pct AS change_pct
    FROM dbo.Latest_Prices_Summary
    WHERE market_id IN (${marketList})
      AND price_change_pct IS NOT NULL
      AND price_naira > 0
    ORDER BY ABS(ISNULL(price_change_pct, 0)) DESC
  `) as any[];
  if (!rows.length) return null;
  const r = rows[0];
  return {
    marketCount: markets.length,
    topItem: r.item_name,
    changePct: fmtPct(Number(r.change_pct)),
  };
}

// ── Main Cron Handler ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // SECURITY: auth is required unconditionally. Previously a `!isTest` clause let
  // anyone call ?test=1&phone=<any> with no CRON_SECRET, triggering a brief SEND
  // to an arbitrary phone (spam / messaging-cost abuse) plus a per-phone
  // subscription read. A caller holding the CRON_SECRET can still pass ?phone= to
  // target a single subscriber for a legitimate test.
  const denied = cronGuard(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const testPhone = searchParams.get("phone");

  const t0 = Date.now();
  const stats = {
    totalSubscribers: 0,
    defaultBriefs: 0,
    personalizedBriefs: 0,
    sent: 0,
    failed: 0,
    skippedNoData: 0,
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

    // Default teaser computed once (shared). `undefined` = not computed yet;
    // `null` = computed but no price data today.
    let defaultBrief: BriefTeaser | null | undefined;

    for (const sub of subscribers) {
      try {
        let teaser: BriefTeaser | null;

        if (sub.plan_type === "PERSONALIZED") {
          let markets: string[] = [];
          try { markets = JSON.parse(sub.selected_markets || "[]"); } catch {}

          if (markets.length === 0) {
            if (defaultBrief === undefined) defaultBrief = await defaultTeaser();
            teaser = defaultBrief;
            stats.defaultBriefs++;
          } else {
            teaser = await personalizedTeaser(markets);
            stats.personalizedBriefs++;
          }
        } else {
          if (defaultBrief === undefined) defaultBrief = await defaultTeaser();
          teaser = defaultBrief;
          stats.defaultBriefs++;
        }

        if (!teaser) { stats.skippedNoData++; continue; }

        const sent = await sendMorningBrief(
          sub.phone_number,
          String(teaser.marketCount),
          teaser.topItem,
          teaser.changePct,
        );

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
    console.log(`[Brief] ✅ DONE ${duration}ms | sent=${stats.sent} failed=${stats.failed} skipped=${stats.skippedNoData}`);

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
