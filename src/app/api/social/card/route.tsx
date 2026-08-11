import { ImageResponse } from 'next/og';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Public daily food-price card (1080x1080 JPEG). Instagram requires a JPEG at a public URL;
// next/og renders PNG, so we convert with sharp. Facebook /photos fetches the same URL.
// No auth: it's public price info, and IG/FB fetch it server-side.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Curated staple set (exact dbo.Latest_Prices_Summary item_name values). Order is the card order;
// any item missing on a given day is simply skipped.
const STAPLES = [
  'Rice (50kg) - Local Long Grain',
  'Garri - White (per kg)',
  'Beans - Brown (per kg)',
  'Yam Tuber (per kg)',
  'Tomatoes - Fresh (per kg)',
  'Onions - Bulb (per kg)',
  'Palm Oil - 1 Litre Bottle',
  'Vegetable Oil - 1 Litre Bottle',
  'Eggs (crate - 30)',
  'Bread - Sliced 500g',
];

type Row = { item_name: string; price: number; change_pct: number | null; as_of: Date | null };

function naira(n: number) { return '₦' + Math.round(n).toLocaleString('en-NG'); }

export async function GET() {
  let items: Row[] = [];
  let asOf: Date | null = null;
  try {
    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT item_name,
             AVG(price_naira)      AS price,
             AVG(price_change_pct) AS change_pct,
             MAX(price_date)       AS as_of
      FROM dbo.Latest_Prices_Summary
      WHERE is_food = 1 AND is_nbs_ref = 0 AND price_naira > 0
        AND item_name IN (${Prisma.join(STAPLES)})
      GROUP BY item_name
    `);
    const byName = new Map(rows.map((r) => [r.item_name, r]));
    items = STAPLES.map((n) => byName.get(n)).filter(Boolean) as Row[];
    asOf = items.reduce<Date | null>((m, r) => (r.as_of && (!m || r.as_of > m) ? r.as_of : m), null);
  } catch (e) {
    console.error('[social/card] query failed:', e);
  }

  const dateStr = (asOf ?? new Date()).toLocaleDateString('en-NG', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  let logoUri = '';
  try {
    const b = fs.readFileSync(path.join(process.cwd(), 'public', 'logo.png'));
    logoUri = 'data:image/png;base64,' + b.toString('base64');
  } catch { /* logo optional */ }

  // DejaVu Sans covers the Naira sign (₦) and ▲/▼ arrows, which next/og's default font lacks.
  const fontDir = path.join(process.cwd(), 'public', 'fonts');
  const fontReg = fs.readFileSync(path.join(fontDir, 'DejaVuSans.ttf'));
  const fontBold = fs.readFileSync(path.join(fontDir, 'DejaVuSans-Bold.ttf'));

  const png = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#04160c', color: '#fff', fontFamily: 'DejaVu Sans', padding: '56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22 }}>
          {logoUri ? <img src={logoUri} width={82} height={82} style={{ borderRadius: 16, marginRight: 20 }} /> : null}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 46, fontWeight: 800, color: '#00e08a' }}>NaijaMarket Intel</div>
            <div style={{ fontSize: 27, color: '#cbd5c0' }}>Daily Food Prices</div>
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 23, color: '#9fb3a4', marginBottom: 16 }}>{dateStr}  ·  national average</div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
          {items.map((r, i) => {
            const chg = r.change_pct == null ? null : Number(r.change_pct);
            const up = chg != null && chg > 0.5;
            const down = chg != null && chg < -0.5;
            const col = up ? '#ff6b6b' : down ? '#3ddc84' : '#9fb3a4';
            const arrow = up ? '▲' : down ? '▼' : '–';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #14301f' }}>
                <div style={{ display: 'flex', fontSize: 29, color: '#e8f0e8', flex: 1, overflow: 'hidden' }}>{r.item_name}</div>
                <div style={{ display: 'flex', fontSize: 31, fontWeight: 700, width: 250, justifyContent: 'flex-end' }}>{naira(Number(r.price))}</div>
                <div style={{ display: 'flex', fontSize: 25, color: col, width: 150, justifyContent: 'flex-end' }}>{arrow} {chg == null ? '—' : Math.abs(chg).toFixed(1) + '%'}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, fontSize: 23, color: '#7f9587' }}>
          <div style={{ display: 'flex' }}>naijamarketintel.com</div>
          <div style={{ display: 'flex' }}>@naijamarketintel</div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      fonts: [
        { name: 'DejaVu Sans', data: fontReg, weight: 400, style: 'normal' },
        { name: 'DejaVu Sans', data: fontBold, weight: 700, style: 'normal' },
      ],
    },
  );

  const pngBuf = Buffer.from(await png.arrayBuffer());
  const jpeg = await sharp(pngBuf).jpeg({ quality: 90 }).toBuffer();
  return new Response(jpeg, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=300, s-maxage=300' },
  });
}
