import { ImageResponse } from 'next/og';
import type { CSSProperties } from 'react';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Weekly bulk-staples card (1080x1350 JPEG, IG 4:5): cheapest vs priciest by geopolitical zone.
// Columns = 6 zones + cheapest/priciest zone + spread%. Rows = ~7 core bulk staples.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// item_name -> short label for the card
const BULK: { name: string; label: string }[] = [
  { name: 'Rice (50kg) - Local Long Grain', label: 'Rice 50kg' },
  { name: 'Garri - White (50kg)',           label: 'Garri 50kg' },
  { name: 'Beans - Brown (100kg)',          label: 'Beans 100kg' },
  { name: 'Maize/Corn (100kg)',             label: 'Maize 100kg' },
  { name: 'Sorghum/Guinea Corn (100kg)',    label: 'Sorghum 100kg' },
  { name: 'Palm Oil (25L)',                 label: 'Palm Oil 25L' },
  { name: 'Onions (big bag)',               label: 'Onions bag' },
];
const NAMES = BULK.map((b) => b.name);
const ZONES = ['NW', 'NE', 'NC', 'SW', 'SE', 'SS'] as const;
const ZLABEL: Record<string, string> = { NW: 'N.West', NE: 'N.East', NC: 'N.Cent', SW: 'S.West', SE: 'S.East', SS: 'S.South' };

const ZONE_SQL = Prisma.sql`CASE
  WHEN state IN ('Kano','Kaduna','Katsina','Sokoto','Zamfara','Kebbi','Jigawa') THEN 'NW'
  WHEN state IN ('Borno','Yobe','Adamawa','Bauchi','Gombe','Taraba') THEN 'NE'
  WHEN state IN ('Niger','Kwara','Kogi','Benue','Plateau','Nasarawa','Nassarawa','FCT','FCT Abuja','Abuja') THEN 'NC'
  WHEN state IN ('Lagos','Ogun','Oyo','Osun','Ondo','Ekiti') THEN 'SW'
  WHEN state IN ('Enugu','Anambra','Imo','Abia','Ebonyi') THEN 'SE'
  WHEN state IN ('Rivers','Delta','Edo','Cross River','Akwa Ibom','Bayelsa') THEN 'SS'
  ELSE 'other' END`;

function k(n: number) { return '₦' + (n >= 1000 ? Math.round(n / 1000).toLocaleString('en-NG') + 'k' : Math.round(n).toLocaleString('en-NG')); }

type ZoneRow = { item_name: string; zone: string; avg_p: number };

export async function GET() {
  let rows: ZoneRow[] = [];
  let asOf: Date | null = null;
  try {
    rows = await prisma.$queryRaw<ZoneRow[]>(Prisma.sql`
      WITH stats AS (
        SELECT item_name, AVG(price_naira) AS avg_p
        FROM dbo.Latest_Prices_Summary
        WHERE is_food = 1 AND is_nbs_ref = 0 AND price_naira > 0 AND item_name IN (${Prisma.join(NAMES)})
        GROUP BY item_name
      ),
      z AS (
        SELECT l.item_name, ${ZONE_SQL} AS zone, l.price_naira
        FROM dbo.Latest_Prices_Summary l
        JOIN stats s ON s.item_name = l.item_name
        WHERE l.is_food = 1 AND l.is_nbs_ref = 0 AND l.item_name IN (${Prisma.join(NAMES)})
          AND l.price_naira >= s.avg_p * 0.4 AND l.price_naira <= s.avg_p * 2.5
      )
      SELECT item_name, zone, AVG(price_naira) AS avg_p
      FROM z WHERE zone <> 'other'
      GROUP BY item_name, zone
    `);
    const d = await prisma.$queryRaw<{ d: Date }[]>(Prisma.sql`SELECT MAX(price_date) AS d FROM dbo.Latest_Prices_Summary WHERE is_food = 1`);
    asOf = d[0]?.d ?? null;
  } catch (e) {
    console.error('[social/card-weekly] query failed:', e);
  }

  // item -> { zone: avg }, cheapest/priciest zone, spread
  const items = BULK.map(({ name, label }) => {
    const zp: Record<string, number> = {};
    for (const z of ZONES) {
      const r = rows.find((x) => x.item_name === name && x.zone === z);
      if (r) zp[z] = Number(r.avg_p);
    }
    const present = ZONES.filter((z) => zp[z] != null);
    if (present.length < 2) return null;
    const lo = present.reduce((a, b) => (zp[b] < zp[a] ? b : a));
    const hi = present.reduce((a, b) => (zp[b] > zp[a] ? b : a));
    const spread = ((zp[hi] - zp[lo]) / zp[lo]) * 100;
    return { label, zp, lo, hi, spread };
  }).filter(Boolean) as { label: string; zp: Record<string, number>; lo: string; hi: string; spread: number }[];

  const dateStr = (asOf ?? new Date()).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });

  let logoUri = '';
  try { logoUri = 'data:image/png;base64,' + fs.readFileSync(path.join(process.cwd(), 'public', 'logo.png')).toString('base64'); } catch { /* optional */ }
  const fontDir = path.join(process.cwd(), 'public', 'fonts');
  const fontReg = fs.readFileSync(path.join(fontDir, 'DejaVuSans.ttf'));
  const fontBold = fs.readFileSync(path.join(fontDir, 'DejaVuSans-Bold.ttf'));

  const W = { name: 168, zone: 92, loc: 104, spread: 80 };
  const cell = (w: number, extra?: CSSProperties): CSSProperties => ({ display: 'flex', width: w, alignItems: 'center', justifyContent: 'center', ...extra });

  const png = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#04160c', color: '#fff', fontFamily: 'DejaVu Sans', padding: '40px 34px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          {logoUri ? <img src={logoUri} width={78} height={78} style={{ borderRadius: 14, marginRight: 18 }} /> : null}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 800 }}>
              <span style={{ color: '#3ddc84' }}>Cheapest</span><span style={{ color: '#cbd5c0', margin: '0 8px' }}>vs</span><span style={{ color: '#ff6b6b' }}>Priciest</span>
            </div>
            <div style={{ display: 'flex', fontSize: 24, color: '#cbd5c0' }}>Nigeria bulk staples by geopolitical zone</div>
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 20, color: '#7f9587', marginBottom: 10 }}>National market averages · {dateStr}</div>

        {/* table header */}
        <div style={{ display: 'flex', alignItems: 'stretch', fontSize: 19, fontWeight: 700, color: '#9fe6c2', background: '#0c2418', borderRadius: 8, padding: '10px 0' }}>
          <div style={cell(W.name, { justifyContent: 'flex-start', paddingLeft: 10 })}>Item</div>
          {ZONES.map((z) => <div key={z} style={cell(W.zone)}>{ZLABEL[z]}</div>)}
          <div style={cell(W.loc, { color: '#3ddc84' })}>Cheapest</div>
          <div style={cell(W.loc, { color: '#ff6b6b' })}>Priciest</div>
          <div style={cell(W.spread, { color: '#ffb454' })}>Spread</div>
        </div>

        {/* rows */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', marginTop: 6 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'stretch', padding: '6px 0', borderBottom: '1px solid #14301f', fontSize: 22 }}>
              <div style={cell(W.name, { justifyContent: 'flex-start', paddingLeft: 10, fontWeight: 700, color: '#e8f0e8', fontSize: 21 })}>{it.label}</div>
              {ZONES.map((z) => {
                const isLo = z === it.lo, isHi = z === it.hi;
                const col = isLo ? '#3ddc84' : isHi ? '#ff6b6b' : '#d7e2d7';
                return <div key={z} style={cell(W.zone, { color: col, fontWeight: isLo || isHi ? 700 : 400, fontSize: 20 })}>{it.zp[z] != null ? k(it.zp[z]) : '—'}</div>;
              })}
              <div style={cell(W.loc, { flexDirection: 'column', color: '#3ddc84', fontSize: 17 })}>
                <div style={{ display: 'flex', fontWeight: 700 }}>{it.lo}</div>
                <div style={{ display: 'flex' }}>{k(it.zp[it.lo])}</div>
              </div>
              <div style={cell(W.loc, { flexDirection: 'column', color: '#ff6b6b', fontSize: 17 })}>
                <div style={{ display: 'flex', fontWeight: 700 }}>{it.hi}</div>
                <div style={{ display: 'flex' }}>{k(it.zp[it.hi])}</div>
              </div>
              <div style={cell(W.spread, { color: '#ffb454', fontWeight: 800, fontSize: 24 })}>+{it.spread.toFixed(0)}%</div>
            </div>
          ))}
        </div>

        {/* footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 21, color: '#7f9587' }}>
          <div style={{ display: 'flex' }}>naijamarketintel.com · live prices, 200+ markets</div>
          <div style={{ display: 'flex' }}>@naijamarketintel</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, fonts: [
      { name: 'DejaVu Sans', data: fontReg, weight: 400, style: 'normal' },
      { name: 'DejaVu Sans', data: fontBold, weight: 700, style: 'normal' },
    ] },
  );

  const jpeg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 90 }).toBuffer();
  return new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=1800, s-maxage=1800' } });
}
