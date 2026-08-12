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
  return new Response(JSON.stringify({ error: r.reason }), {
    status: r.status,
    headers: { "content-type": "application/json" },
  });
}
