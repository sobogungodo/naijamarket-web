// src/app/api/practice-invite/route.ts
// Sends the reporter practice-access confirmation email. INTERNAL endpoint — authenticated
// by a shared secret (PRACTICE_INVITE_KEY) so it can never be an open phishing / email-
// bombing relay. Sends mail only: writes no row, does NOT call func waitlist_handler.
// Mirrors syncToBrevo()'s Brevo transactional call in src/app/api/waitlist/route.ts.
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory IP limiter (resets on cold start) — mirrors naijamarket-trader/src/lib/rateLimit.
// Runs AFTER auth, so only authenticated calls count; a generous ceiling backstops a
// compromised key (the caller is a Vercel egress IP, not the end user).
const rlStore = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const e = rlStore.get(key);
  if (!e || e.resetAt < now) { rlStore.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (e.count >= limit) return false;
  e.count++;
  return true;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inviteHtml(name: string, state: string, waitlistId: string): string {
  const n = escapeHtml(name);
  const st = escapeHtml(state);
  const wid = escapeHtml(waitlistId);
  const link = `https://trader.naijamarketintel.com/get-app?c=${encodeURIComponent(waitlistId)}`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;max-width:600px;">
      <tr><td style="background:linear-gradient(135deg,#00a651,#006428);padding:24px 32px;">
        <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:1px;">NAIJAMARKET REPORTER</h1>
      </td></tr>
      <tr><td style="padding:32px;color:#cccccc;font-size:15px;line-height:1.7;">
        <p style="margin:0 0 16px;">Hello ${n},</p>
        <p style="margin:0 0 16px;">You're on the waitlist to become a NaijaMarket Intel price reporter in ${st}.</p>
        <p style="margin:0 0 16px;">Your reference is <strong style="color:#ffffff;">${wid}</strong>.</p>
        <p style="margin:0 0 16px;">You can start practising now — open the reporter app, record prices the way a live reporter would, and get familiar with the submission flow before reporting opens in your area.</p>
        <table cellpadding="0" cellspacing="0" style="margin:8px 0 18px;"><tr>
          <td style="background:#00a651;border-radius:6px;">
            <a href="${link}" style="display:inline-block;padding:14px 28px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">Open practice access →</a>
          </td>
        </tr></table>
        <p style="margin:0 0 16px;color:#8a8a8a;font-size:13px;word-break:break-all;">${escapeHtml(link)}</p>
        <p style="margin:0 0 16px;">Practice prices are not published and are not paid. When live reporting opens in your area, we'll contact you on this number.</p>
        <p style="margin:24px 0 0;color:#777777;font-size:13px;">— NaijaMarket Intel · Giggababytes Oy</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export async function POST(req: NextRequest) {
  // ── Auth (FAIL CLOSED): missing env OR wrong/absent header → 401, no send. ──
  const KEY = process.env.PRACTICE_INVITE_KEY || '';
  const provided = req.headers.get('x-api-key') || '';
  if (!KEY || provided !== KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // ── IP rate limit (post-auth backstop). ──
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`practice-invite:${ip}`, 60, 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: { email?: unknown; name?: unknown; state?: unknown; waitlist_id?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const email      = typeof body.email === 'string' ? body.email.trim() : '';
  const name       = typeof body.name === 'string' ? body.name.trim() : '';
  const state      = typeof body.state === 'string' ? body.state.trim() : '';
  const waitlistId = typeof body.waitlist_id === 'string' ? body.waitlist_id.trim() : '';
  if (!email || !name || !state || !waitlistId) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('[practice-invite] BREVO_API_KEY not set');
    return NextResponse.json({ error: 'mailer_unconfigured' }, { status: 500 });
  }

  const emailBody = {
    sender:      { name: 'NaijaMarket Intel', email: 'noreply@naijamarketintel.ng' },
    to:          [{ email, name }],
    subject:     'Your NaijaMarket Reporter practice access',
    htmlContent: inviteHtml(name, state, waitlistId),
  };

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(emailBody),
    });
    if (!res.ok) {
      console.error('[practice-invite] Brevo send failed:', res.status, await res.text());
      return NextResponse.json({ error: 'send_failed' }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[practice-invite] Brevo error:', err);
    return NextResponse.json({ error: 'send_error' }, { status: 502 });
  }
}
