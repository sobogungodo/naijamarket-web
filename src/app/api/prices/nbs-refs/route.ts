// src/app/api/prices/nbs-refs/route.ts
// Returns a map of { item_name: national_avg_nbs_price } for all items
// where is_nbs_ref=1 in Latest_Prices_Summary.
// Used by the prices page to show NBS benchmark vs live market price.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

// Cache for 30 minutes — NBS data doesn't change intraday
let cache: { refs: Record<string, number>; cachedAt: number } | null = null
const CACHE_MS = 30 * 60 * 1000

export async function GET() {
  if (cache && Date.now() - cache.cachedAt < CACHE_MS) {
    return NextResponse.json({ refs: cache.refs })
  }

  try {
    const rows = await prisma.$queryRaw<{ item_name: string; nbs_price: unknown }[]>(
      Prisma.sql`
        SELECT item_name, AVG(price_naira) AS nbs_price
        FROM dbo.Latest_Prices_Summary
        WHERE is_nbs_ref = 1
          AND price_naira > 0
          AND item_name IS NOT NULL
        GROUP BY item_name
      `
    )

    const refs: Record<string, number> = {}
    for (const r of rows) {
      if (r.item_name && r.nbs_price != null) {
        const price = Number(r.nbs_price)
        if (price > 0 && isFinite(price)) {
          refs[r.item_name] = price
        }
      }
    }

    cache = { refs, cachedAt: Date.now() }
    return NextResponse.json({ refs })
  } catch (err) {
    console.error('[nbs-refs] GET error:', err)
    // Return empty refs on error — NBS comparison simply won't show
    return NextResponse.json({ refs: {} })
  }
}
