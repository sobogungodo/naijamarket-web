// src/lib/query-gate.ts
// NaijaMarket Intel — cross-platform query gate (WEB + MOBILE), at parity with the
// WhatsApp engine (shared/query_limit.py). Single source of truth per tier:
//   FREE       3 / WEEK  → Consumers.queries_remaining (resets Monday 00:00 UTC)
//   SILVER    10 / DAY  ─┐
//   GOLD      25 / DAY   ├ counted from Query_Log rows (counted_against_limit = 'Y')
//   BUSINESS 100 / DAY  ─┘
//   CORPORATE / ENTERPRISE / API_* (-1)  UNLIMITED → never blocked (still logged)
//
// Design:
//   checkQuery()  gates BEFORE the search — reads only, mutates nothing.
//   logQuery()    runs AFTER a successful result — so a failed lookup never burns
//                 a query. Decrements FREE + writes Query_Log for every tier.
//   gatedQuery()  wraps both so the post-success log can't be forgotten.
// Fails OPEN on any error — never block a price check on a gate/DB glitch.
//
// DB access: Prisma only. Phone is resolved once from consumer_id. Limits come
// from dbo.Subscription_Tiers (DB-driven, same source the WA engine reads).

import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

const FREE_WEEKLY_LIMIT = 3;
const UNLIMITED = -1;

export type QuerySource = "WEB" | "MOBILE";

export const UPSELL_MESSAGE =
  "You've used your 3 free price checks this week.\n\n" +
  "SILVER — ₦500/week unlocks:\n" +
  "✅ 10 price checks/day\n" +
  "✅ Price alerts on any item\n" +
  "✅ Weekly price forecast\n" +
  "✅ Best market finder\n\n" +
  "Most users save more than ₦500/week by buying at the right market.";

export interface QueryGateResult {
  allowed: boolean;
  remaining: number; // -1 = not gated (UNLIMITED / unknown / error)
  upsell?: string;
}

interface ConsumerRow {
  phone: string | null; // '+'-stripped — the Query_Log key
  tier: string;
  queries_remaining: number | null;
  last_query_date: Date | null;
}

export interface QueryMeta {
  item_name?: string;
  market_name?: string;
  item_id?: string;
  market_id?: string;
}

// Monday 00:00 UTC of the current week.
function startOfWeekUTC(now: Date = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
}

function normTier(tier: string | null | undefined): string {
  return (tier || "FREE").toUpperCase();
}

// Resolve the consumer's phone (+ FREE counters) once from consumer_id.
// Exported so read-only siblings (e.g. recent-searches) reuse the SAME naked-phone
// derivation and can't drift from the gate's Query_Log key.
export async function resolveConsumer(consumerId: string): Promise<ConsumerRow | null> {
  const c = await prisma.consumers.findUnique({
    where: { consumer_id: consumerId },
    select: {
      phone_number: true,
      phone: true,
      subscription_tier: true,
      queries_remaining: true,
      last_query_date: true,
    },
  });
  if (!c) return null;
  const raw = c.phone_number || c.phone || null;
  return {
    phone: raw ? raw.replace(/\+/g, "").trim() : null,
    tier: normTier(c.subscription_tier),
    queries_remaining: c.queries_remaining ?? null,
    last_query_date: c.last_query_date ?? null,
  };
}

// query_limit + query_period from Subscription_Tiers (matches the WA engine).
async function tierLimit(tier: string): Promise<{ limit: number; period: string } | null> {
  const rows = (await prisma.$queryRaw`
    SELECT query_limit, query_period
    FROM dbo.Subscription_Tiers
    WHERE tier_id = ${tier}
  `) as Array<{ query_limit: number | null; query_period: string | null }>;
  if (!rows?.[0]) return null;
  return {
    limit: Number(rows[0].query_limit ?? UNLIMITED),
    period: (rows[0].query_period || "DAY").toUpperCase(),
  };
}

/**
 * Gate check — call BEFORE running the search. Reads only; mutates nothing.
 * FREE: reads queries_remaining (weekly reset). DAY: counts today's Query_Log
 * rows for this consumer. UNLIMITED / unknown: allowed. Fails OPEN.
 */
export async function checkQuery(
  consumerId: string | null | undefined,
  tier: string | null | undefined
): Promise<QueryGateResult> {
  if (!consumerId) return { allowed: true, remaining: UNLIMITED };
  try {
    // SECURITY: tier is authoritative from the DB (Consumers.subscription_tier),
    // NOT the caller-passed value. A 30-day mobile JWT (and a cached web session)
    // keeps asserting a paid tier for up to a month after a downgrade/lapse, which
    // would let a lapsed user retain elevated daily caps (or UNLIMITED). resolveConsumer
    // reads the same column the token snapshotted, but live. `tier` is a dead
    // fallback (c.tier is always ≥ "FREE") kept only for signature compatibility.
    const c = await resolveConsumer(consumerId);
    if (!c) return { allowed: true, remaining: UNLIMITED }; // unknown — fail open
    const t = c.tier || normTier(tier);

    // FREE — weekly counter on Consumers.
    if (t === "FREE") {
      const needsReset = !c.last_query_date || c.last_query_date < startOfWeekUTC();
      const remaining = needsReset
        ? FREE_WEEKLY_LIMIT
        : Number(c.queries_remaining ?? FREE_WEEKLY_LIMIT);
      if (remaining <= 0) return { allowed: false, remaining: 0, upsell: UPSELL_MESSAGE };
      return { allowed: true, remaining };
    }

    // Non-FREE — resolve limit from Subscription_Tiers.
    const tl = await tierLimit(t);
    if (!tl || tl.limit === UNLIMITED) return { allowed: true, remaining: UNLIMITED };

    // DAY tiers — count today's counted rows for this consumer's phone.
    if (!c?.phone) return { allowed: true, remaining: UNLIMITED }; // no phone key — fail open
    const rows = (await prisma.$queryRaw`
      SELECT COUNT(*) AS cnt
      FROM dbo.Query_Log
      WHERE consumer_phone = ${c.phone}
        AND query_date = CAST(GETUTCDATE() AS date)
        AND counted_against_limit = 'Y'
    `) as Array<{ cnt: number | bigint }>;
    const used = Number(rows?.[0]?.cnt ?? 0);
    const remaining = tl.limit - used;
    if (remaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        upsell: `You've reached your ${tl.limit} price checks for today (${t} plan).\n\nUpgrade for more — visit /subscribe.`,
      };
    }
    return { allowed: true, remaining };
  } catch (error: any) {
    console.error("[query-gate:check] fail-open:", error?.message);
    return { allowed: true, remaining: UNLIMITED };
  }
}

/**
 * Log a SUCCESSFUL query — call AFTER a real result is produced.
 * All tiers: INSERT a Query_Log row (counted_against_limit = 'Y' for gated tiers,
 * 'N' for UNLIMITED). FREE also decrements queries_remaining (weekly-reset-aware)
 * and bumps total_queries. Best-effort — never throws.
 */
export async function logQuery(
  consumerId: string | null | undefined,
  tier: string | null | undefined,
  source: QuerySource,
  meta?: QueryMeta
): Promise<void> {
  if (!consumerId) return;
  try {
    const c = await resolveConsumer(consumerId);
    if (!c) return;
    // SECURITY: count against the authoritative DB tier, not the caller-passed
    // (possibly stale) value — see checkQuery. Keeps FREE decrement + counted
    // flag honest when a 30-day token still asserts an old paid tier.
    const t = c.tier || normTier(tier);

    // Does this tier count against a limit?
    let counted = "N";
    if (t === "FREE") {
      counted = "Y";
    } else {
      const tl = await tierLimit(t);
      counted = tl && tl.limit !== UNLIMITED ? "Y" : "N";
    }

    // INSERT Query_Log (raw — deliberately OMIT the mis-typed `category_name` bit column).
    await prisma.$executeRaw`
      INSERT INTO dbo.Query_Log (
        query_id, consumer_phone, subscription_tier,
        item_name, market_name, item_id, market_id,
        query_source, query_type,
        query_timestamp, query_date,
        counted_against_limit, created_at
      ) VALUES (
        ${randomUUID()}, ${c.phone}, ${t},
        ${meta?.item_name ?? ""}, ${meta?.market_name ?? ""}, ${meta?.item_id ?? ""}, ${meta?.market_id ?? ""},
        ${source}, 'PRICE',
        GETUTCDATE(), CAST(GETUTCDATE() AS date),
        ${counted}, GETUTCDATE()
      )
    `;

    // FREE — decrement the shared weekly counter (single source of truth with WA + app).
    if (t === "FREE") {
      const needsReset = !c.last_query_date || c.last_query_date < startOfWeekUTC();
      const base = needsReset ? FREE_WEEKLY_LIMIT : Number(c.queries_remaining ?? FREE_WEEKLY_LIMIT);
      const newRemaining = Math.max(0, base - 1);
      await prisma.$executeRaw`
        UPDATE dbo.Consumers
        SET queries_remaining = ${newRemaining},
            total_queries = ISNULL(total_queries, 0) + 1,
            last_query_date = CAST(GETUTCDATE() AS date)
        WHERE consumer_id = ${consumerId}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE dbo.Consumers
        SET total_queries = ISNULL(total_queries, 0) + 1,
            last_query_date = CAST(GETUTCDATE() AS date)
        WHERE consumer_id = ${consumerId}
      `;
    }
  } catch (error: any) {
    console.error("[query-gate:log] non-fatal:", error?.message);
  }
}

export interface GatedResult<T> {
  allowed: boolean;
  remaining: number; // -1 = not gated
  upsell?: string;
  result?: T;
}

/**
 * Wrap a gated operation: check → (block, or) run fn → log-on-success.
 * The route calls this and, when `!allowed`, returns 429 with `upsell`.
 * logQuery only runs when fn() resolves WITHOUT throwing (a thrown error
 * propagates and is NOT logged/charged).
 */
export async function gatedQuery<T>(
  consumerId: string | null | undefined,
  tier: string | null | undefined,
  source: QuerySource,
  meta: QueryMeta | undefined,
  fn: () => Promise<T>
): Promise<GatedResult<T>> {
  const gate = await checkQuery(consumerId, tier);
  if (!gate.allowed) {
    return { allowed: false, remaining: 0, upsell: gate.upsell };
  }
  const result = await fn(); // throws → propagates, no log (correct)
  await logQuery(consumerId, tier, source, meta); // best-effort, never throws
  const remaining = gate.remaining < 0 ? UNLIMITED : Math.max(0, gate.remaining - 1);
  return { allowed: true, remaining, result };
}
