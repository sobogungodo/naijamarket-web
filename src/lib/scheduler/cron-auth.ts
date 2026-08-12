/**
 * Scheduler seam — cron authorization (FAIL-CLOSED).
 *
 * Every scheduled/cron endpoint must call cronGuard() first. Authorization
 * succeeds ONLY when CRON_SECRET is set AND the request carries
 * `Authorization: Bearer <CRON_SECRET>`. If CRON_SECRET is unset we REJECT
 * (fail-closed) — historically some routes failed OPEN (no secret = no guard),
 * which let anyone trigger them. Vercel Cron sends this header automatically.
 */
export function checkCronAuth(
  headers: Headers,
  secret: string | undefined,
): { ok: boolean; status: number; reason?: string } {
  if (!secret) return { ok: false, status: 401, reason: "CRON_SECRET not configured" };
  if (headers.get("authorization") !== `Bearer ${secret}`) {
    return { ok: false, status: 401, reason: "unauthorized" };
  }
  return { ok: true, status: 200 };
}

export function cronGuard(req: Request): Response | null {
  const r = checkCronAuth(req.headers, process.env.CRON_SECRET);
  if (r.ok) return null;
  // Client-facing body is intentionally generic — r.reason (e.g. "CRON_SECRET not
  // configured") is for internal/log use only and must never leak to an
  // unauthenticated caller.
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: r.status,
    headers: { "content-type": "application/json" },
  });
}
