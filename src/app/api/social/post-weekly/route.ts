import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { postCardToSocial } from '@/lib/socialPost';

// Weekly bulk-staples poster — publishes the by-zone price card + caption to FB + IG.
// Vercel cron (Monday 07:00 WAT). ?dryRun=1 previews without posting. Self-heals until token set.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || '';

const BULK: { name: string; label: string }[] = [
  { name: 'Rice (50kg) - Local Long Grain', label: 'Rice (50kg)' },
  { name: 'Garri - White (50kg)',           label: 'Garri (50kg)' },
  { name: 'Beans - Brown (100kg)',          label: 'Beans (100kg)' },
  { name: 'Maize/Corn (100kg)',             label: 'Maize (100kg)' },
  { name: 'Sorghum/Guinea Corn (100kg)',    label: 'Sorghum (100kg)' },
  { name: 'Palm Oil (25L)',                 label: 'Palm Oil (25L)' },
  { name: 'Onions (big bag)',               label: 'Onions (bag)' },
];
const NAMES = BULK.map((b) => b.name);
const ZFULL: Record<string, string> = { NW: 'North-West', NE: 'North-East', NC: 'North-Central', SW: 'South-West', SE: 'South-East', SS: 'South-South' };

const ZONE_SQL = Prisma.sql`CASE
  WHEN state IN ('Kano','Kaduna','Katsina','Sokoto','Zamfara','Kebbi','Jigawa') THEN 'NW'
  WHEN state IN ('Borno','Yobe','Adamawa','Bauchi','Gombe','Taraba') THEN 'NE'
  WHEN state IN ('Niger','Kwara','Kogi','Benue','Plateau','Nasarawa','Nassarawa','FCT','FCT Abuja','Abuja') THEN 'NC'
  WHEN state IN ('Lagos','Ogun','Oyo','Osun','Ondo','Ekiti') THEN 'SW'
  WHEN state IN ('Enugu','Anambra','Imo','Abia','Ebonyi') THEN 'SE'
  WHEN state IN ('Rivers','Delta','Edo','Cross River','Akwa Ibom','Bayelsa') THEN 'SS'
  ELSE 'other' END`;

function naira(n: number) { return '₦' + Math.round(n).toLocaleString('en-NG'); }
type ZoneRow = { item_name: string; zone: string; avg_p: number };

async function buildCaption(): Promise<{ caption: string; asOf: Date | null; count: number }> {
  const rows = await prisma.$queryRaw<ZoneRow[]>(Prisma.sql`
    WITH stats AS (
      SELECT item_name, AVG(price_naira) AS avg_p
      FROM dbo.Latest_Prices_Summary
      WHERE is_food = 1 AND is_nbs_ref = 0 AND price_naira > 0 AND item_name IN (${Prisma.join(NAMES)})
      GROUP BY item_name
    ),
    z AS (
      SELECT l.item_name, ${ZONE_SQL} AS zone, l.price_naira
      FROM dbo.Latest_Prices_Summary l JOIN stats s ON s.item_name = l.item_name
      WHERE l.is_food = 1 AND l.is_nbs_ref = 0 AND l.item_name IN (${Prisma.join(NAMES)})
        AND l.price_naira >= s.avg_p * 0.4 AND l.price_naira <= s.avg_p * 2.5
    )
    SELECT item_name, zone, AVG(price_naira) AS avg_p FROM z WHERE zone <> 'other' GROUP BY item_name, zone
  `);
  const d = await prisma.$queryRaw<{ d: Date }[]>(Prisma.sql`SELECT MAX(price_date) AS d FROM dbo.Latest_Prices_Summary WHERE is_food = 1`);
  const asOf = d[0]?.d ?? null;

  const items = BULK.map(({ name, label }) => {
    const zp: Record<string, number> = {};
    for (const r of rows) if (r.item_name === name) zp[r.zone] = Number(r.avg_p);
    const zk = Object.keys(zp);
    if (zk.length < 2) return null;
    const lo = zk.reduce((a, b) => (zp[b] < zp[a] ? b : a));
    const hi = zk.reduce((a, b) => (zp[b] > zp[a] ? b : a));
    return { label, lo, hi, loP: zp[lo], hiP: zp[hi], spread: ((zp[hi] - zp[lo]) / zp[lo]) * 100 };
  }).filter(Boolean) as { label: string; lo: string; hi: string; loP: number; hiP: number; spread: number }[];

  const dateStr = (asOf ?? new Date()).toLocaleDateString('en-NG', { day: 'numeric', month: 'long' });
  const top = [...items].sort((a, b) => b.spread - a.spread).slice(0, 3);

  let cap = `🛒💰 NaijaMarket Weekly Bulk Arbitrage — where to buy cheap & sell higher (week of ${dateStr})\n\nBiggest bulk margins across zones this week:\n`;
  for (const it of top) {
    const margin = Math.round(it.hiP - it.loP);
    cap += `• ${it.label}: buy ~${naira(it.loP)} in the ${ZFULL[it.lo]}, sells ~${naira(it.hiP)} in the ${ZFULL[it.hi]} → ~₦${margin.toLocaleString('en-NG')}/bag margin (${it.spread.toFixed(0)}%).\n`;
  }
  cap += `\nFind the exact cheapest market in any state — live prices across 200+ markets on the NaijaMarket app.\n👉 naijamarketintel.com\n\n#NaijaMarket #BulkPrices #Wholesale #Arbitrage #FoodPrices #Nigeria #Reseller`;
  return { caption: cap, asOf, count: items.length };
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';
  const force = request.nextUrl.searchParams.get('force') === '1'; // manual test: bypass the stale/count guard
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cardUrl = `${request.nextUrl.origin}/api/social/card-weekly`;
  let caption = '', asOf: Date | null = null, count = 0;
  try {
    ({ caption, asOf, count } = await buildCaption());
  } catch (e) {
    console.error('[social/post-weekly] caption failed:', e);
    return NextResponse.json({ skipped: true, reason: 'query failed' });
  }

  const stale = !asOf || (Date.now() - new Date(asOf).getTime()) > 3 * 86400000;
  if (!force && (count < 4 || stale)) {
    return NextResponse.json({ skipped: true, reason: count < 4 ? 'too few items' : 'stale data', asOf, count });
  }
  if (dryRun) {
    return NextResponse.json({ dryRun: true, cardUrl, caption, asOf, count });
  }

  const results = await postCardToSocial(cardUrl, caption);
  console.log('[social/post-weekly] done', JSON.stringify(results));
  return NextResponse.json({ posted: true, cardUrl, ...results });
}
