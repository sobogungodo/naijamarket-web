import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

// Daily social poster — publishes the price card + caption to the Facebook Page and Instagram.
// Triggered by a Vercel cron (07:00 WAT). Guarded by CRON_SECRET (Vercel adds the Bearer header).
// ?dryRun=1 returns the caption + card URL WITHOUT posting, for testing. Best-effort per platform;
// self-heals (no-ops) until PAGE_ACCESS_TOKEN is set.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || '';
const FB_PAGE_ID  = process.env.FB_PAGE_ID  || '1235437569645195';   // NaijaMarket Intel Page
const IG_USER_ID  = process.env.IG_USER_ID  || '17841416251692661';  // @naijamarketintel
const PAGE_TOKEN  = process.env.PAGE_ACCESS_TOKEN || '';
const GRAPH = 'https://graph.facebook.com/v22.0';

type Mover = { item_name: string; price: number; change_pct: number; as_of: Date };

async function buildCaption(): Promise<{ caption: string; asOf: Date | null; count: number }> {
  const movers = await prisma.$queryRaw<Mover[]>(Prisma.sql`
    SELECT TOP 5 item_name,
           AVG(price_naira)      AS price,
           AVG(price_change_pct) AS change_pct,
           MAX(price_date)       AS as_of
    FROM dbo.Latest_Prices_Summary
    WHERE is_food = 1 AND is_nbs_ref = 0 AND price_change_pct IS NOT NULL AND price_naira > 0
    GROUP BY item_name
    ORDER BY ABS(AVG(price_change_pct)) DESC
  `);
  const asOf = movers[0]?.as_of ?? null;
  const dateStr = (asOf ?? new Date()).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' });

  let cap = `📊 NaijaMarket Daily Food Prices — ${dateStr}\n\nToday's national-average staple prices are in. Notable moves:\n`;
  for (const m of movers) {
    const c = Number(m.change_pct);
    const s = c >= 0 ? '▲' : '▼';
    cap += `${s} ${m.item_name}: ₦${Math.round(Number(m.price)).toLocaleString('en-NG')} (${c >= 0 ? '+' : ''}${c.toFixed(1)}%)\n`;
  }
  cap += `\n📍 Want the CHEAPEST state and the EXACT market for each item? Get full live prices across 200+ markets:\n🌐 Visit naijamarketintel.com\n📲 Download the NaijaMarket app — or add our PWA to your phone.\n\n#NaijaMarket #FoodPrices #Nigeria #MarketPrices #FoodInflation #Lagos #Naija`;
  return { caption: cap, asOf, count: movers.length };
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';
  const force = request.nextUrl.searchParams.get('force') === '1'; // manual test: bypass the stale/count guard

  // Cron guard — Vercel cron sends Authorization: Bearer ${CRON_SECRET}. Applies to dryRun too.
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cardUrl = `${request.nextUrl.origin}/api/social/card`;

  let caption = '', asOf: Date | null = null, count = 0;
  try {
    ({ caption, asOf, count } = await buildCaption());
  } catch (e) {
    console.error('[social/post] caption build failed:', e);
    return NextResponse.json({ skipped: true, reason: 'query failed' }, { status: 200 });
  }

  // Bad-data guard: don't publish an empty/stale card.
  const stale = !asOf || (Date.now() - new Date(asOf).getTime()) > 2 * 86400000;
  if (!force && (count < 5 || stale)) {
    console.warn('[social/post] skipped — count', count, 'stale', stale);
    return NextResponse.json({ skipped: true, reason: count < 5 ? 'too few items' : 'stale data', asOf, count });
  }

  if (dryRun) {
    return NextResponse.json({ dryRun: true, cardUrl, caption, asOf, count });
  }
  if (!PAGE_TOKEN) {
    console.warn('[social/post] PAGE_ACCESS_TOKEN not set — skipping post');
    return NextResponse.json({ skipped: true, reason: 'PAGE_ACCESS_TOKEN not set', cardUrl });
  }

  const results: { fb?: unknown; ig?: unknown } = {};

  // ── Facebook Page photo ──
  try {
    const u = new URL(`${GRAPH}/${FB_PAGE_ID}/photos`);
    u.searchParams.set('url', cardUrl);
    u.searchParams.set('caption', caption);
    u.searchParams.set('access_token', PAGE_TOKEN);
    const r = await fetch(u.toString(), { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    results.fb = { ok: r.ok, ...j };
  } catch (e) {
    results.fb = { ok: false, error: String(e) };
  }

  // ── Instagram: create media container → publish ──
  try {
    const c = new URL(`${GRAPH}/${IG_USER_ID}/media`);
    c.searchParams.set('image_url', cardUrl);
    c.searchParams.set('caption', caption);
    c.searchParams.set('access_token', PAGE_TOKEN);
    const cr = await fetch(c.toString(), { method: 'POST' });
    const cj = await cr.json().catch(() => ({}));
    if (cj?.id) {
      const p = new URL(`${GRAPH}/${IG_USER_ID}/media_publish`);
      p.searchParams.set('creation_id', cj.id);
      p.searchParams.set('access_token', PAGE_TOKEN);
      const pr = await fetch(p.toString(), { method: 'POST' });
      const pj = await pr.json().catch(() => ({}));
      results.ig = { ok: pr.ok, creation_id: cj.id, ...pj };
    } else {
      results.ig = { ok: false, error: 'no creation_id', detail: cj };
    }
  } catch (e) {
    results.ig = { ok: false, error: String(e) };
  }

  console.log('[social/post] done', JSON.stringify(results));
  return NextResponse.json({ posted: true, cardUrl, ...results });
}
