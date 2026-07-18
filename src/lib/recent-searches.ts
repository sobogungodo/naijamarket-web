// src/lib/recent-searches.ts
// NaijaMarket Intel — cross-platform recent-searches (the founding-ask read).
//
// Reads a consumer's own search history out of dbo.Query_Log, keyed on the SAME
// naked-digit consumer_phone the query-gate writes (resolveConsumer, reused). That
// phone is the ONLY identity column Query_Log carries, and it is uniform across
// WEB / MOBILE / WhatsApp — so this returns one unified history spanning every
// surface, which is the whole point.
//
// Design notes:
//   - Identity is server-derived (consumer_id -> resolveConsumer -> naked phone).
//     The route never trusts a client-supplied identity.
//   - Match guard: consumer_phone IN (naked, '+'+naked). Existing rows are all
//     naked; the '+'-form is cheap insurance against a future surface writing the
//     +prefixed form (the silent-empty failure mode this arc exists to kill).
//   - Provenance preserved: `sources` is STRING_AGG over an inner GROUP BY
//     (item_name, query_source), so it lists the DISTINCT surfaces a term was
//     seen on (e.g. "WEB,WHATSAPP") — one chip per term, continuity still provable.
//   - item_name <> '' drops blank rows. This USED TO black out mobile entirely:
//     the mobile /query gate logged at gate-time with no item, so mobile-ORIGIN
//     searches never surfaced here. FIXED 2026-07-08; re-verified against
//     Query_Log on 2026-07-17 — all 7 blank MOBILE rows are a single tester on
//     2026-07-07 (last 13:27:22), and every MOBILE row from 2026-07-08 08:16:32
//     onward carries a real item_name (30 of 37 MOBILE rows, 2 phones, through
//     2026-07-16). Mobile-ORIGIN searches DO appear, so the cross-surface chip
//     renders for real (e.g. phone 358417203868 logged "Yam" on WEB and MOBILE).
//     The guard now only drops genuinely item-less rows (1 WEB, 2 WHATSAPP, and
//     9 rows written with no query_source — those remain unexplained).
//   - Prisma-only (vercel_web), same as the gate — which already SELECTs Query_Log
//     in prod, so no new grant is required for this read.

import { prisma } from "@/lib/prisma";
import { resolveConsumer } from "@/lib/query-gate";

export interface RecentSearch {
  item_name: string;
  market_name: string;
  sources: string; // comma-joined distinct surfaces, e.g. "WEB,WHATSAPP"
  last_seen: Date;
}

/**
 * Recent searches for a consumer, newest first, deduped to one row per item.
 * Returns [] when the consumer is unknown or has no resolvable phone (fail-soft —
 * a history read must never throw into the caller's response path).
 */
export async function getRecentSearches(
  consumerId: string | null | undefined
): Promise<RecentSearch[]> {
  if (!consumerId) return [];
  try {
    const c = await resolveConsumer(consumerId);
    if (!c?.phone) return []; // no phone key -> no history to join on
    const naked = c.phone;
    const plus = `+${naked}`;

    const rows = (await prisma.$queryRaw`
      SELECT TOP 20 item_name, MAX(market_name) AS market_name,
             STRING_AGG(query_source, ',') AS sources, MAX(last_seen) AS last_seen
      FROM ( SELECT item_name, query_source, MAX(market_name) AS market_name,
                    MAX(created_at) AS last_seen
             FROM dbo.Query_Log
             WHERE consumer_phone IN (${naked}, ${plus})
               AND item_name IS NOT NULL AND item_name <> ''
             GROUP BY item_name, query_source ) d
      GROUP BY item_name ORDER BY MAX(last_seen) DESC
    `) as Array<{
      item_name: string;
      market_name: string | null;
      sources: string | null;
      last_seen: Date;
    }>;

    return rows.map((r) => ({
      item_name: r.item_name,
      market_name: r.market_name ?? "",
      sources: r.sources ?? "",
      last_seen: r.last_seen,
    }));
  } catch (error: any) {
    console.error("[recent-searches] fail-soft:", error?.message);
    return [];
  }
}
