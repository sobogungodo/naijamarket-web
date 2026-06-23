// src/lib/query-gate.ts
// NaijaMarket Intel — server-side weekly query gate for FREE tier.
// FREE = 5 price checks per WEEK (resets Monday 00:00 UTC).
// Uses the keyless-safe raw-SQL pattern; vercel_web has SELECT+UPDATE via
// db_datareader/db_datawriter. Fails OPEN on any error (never block on a glitch).

import { prisma } from "@/lib/prisma";

const FREE_WEEKLY_LIMIT = 5;

export const UPSELL_MESSAGE =
  "You've used your 5 free price checks this week.\n\n" +
  "SILVER — ₦500/week unlocks:\n" +
  "✅ 10 price checks/day\n" +
  "✅ Price alerts on any item\n" +
  "✅ Weekly price forecast\n" +
  "✅ Best market finder\n\n" +
  "Most users save more than ₦500/week by buying at the right market.";

export interface QueryGateResult {
  allowed: boolean;
  remaining: number; // -1 means "not gated" (non-FREE / unknown / error)
  upsell?: string;
}

// Monday 00:00 UTC of the current week.
function startOfWeekUTC(now: Date = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
}

export async function checkAndDecrementQuery(
  consumerId: string | undefined | null,
  tier: string | undefined | null
): Promise<QueryGateResult> {
  // Only FREE tier is gated. Everyone else (and missing id) passes through.
  if (!consumerId) return { allowed: true, remaining: -1 };
  if ((tier || "FREE").toUpperCase() !== "FREE") return { allowed: true, remaining: -1 };

  try {
    const rows = (await prisma.$queryRaw`
      SELECT queries_remaining, last_query_date
      FROM dbo.Consumers
      WHERE consumer_id = ${consumerId}
    `) as Array<{ queries_remaining: number | null; last_query_date: Date | string | null }>;

    if (!rows?.[0]) return { allowed: true, remaining: -1 }; // unknown consumer — fail open

    const weekStart = startOfWeekUTC();
    const lastRaw = rows[0].last_query_date;
    const last = lastRaw ? new Date(lastRaw) : null;
    const needsReset = !last || last < weekStart;

    // On a fresh week (or NULL), the weekly allowance is full again.
    const remaining = needsReset
      ? FREE_WEEKLY_LIMIT
      : Number(rows[0].queries_remaining ?? FREE_WEEKLY_LIMIT);

    if (remaining <= 0) {
      return { allowed: false, remaining: 0, upsell: UPSELL_MESSAGE };
    }

    const newRemaining = remaining - 1;
    await prisma.$executeRaw`
      UPDATE dbo.Consumers
      SET queries_remaining = ${newRemaining},
          last_query_date = CAST(GETUTCDATE() AS date)
      WHERE consumer_id = ${consumerId}
    `;

    return { allowed: true, remaining: newRemaining };
  } catch (error: any) {
    console.error("[query-gate] error (fail-open):", error?.message);
    return { allowed: true, remaining: -1 };
  }
}
