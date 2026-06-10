// src/app/api/account/history/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone')
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1'))
  const offset = (page - 1) * PAGE_SIZE

  if (!phone) return NextResponse.json({ queries: [], total: 0, page: 1, pages: 0 })

  try {
    const rows = await prisma.$queryRaw<{
      query_id: string
      item_name: string
      item_id: string
      market_name: string
      market_id: string
      category_id: string | null
      price_returned: unknown
      unit: string | null
      previous_price: unknown
      price_change_pct: unknown
      query_type: string | null
      query_source: string | null
      subscription_tier: string | null
      counted_against_limit: string | null
      query_timestamp: Date | string
    }[]>(
      Prisma.sql`
        SELECT
          query_id, item_name, item_id, market_name, market_id, category_id,
          price_returned, unit, previous_price, price_change_pct,
          query_type, query_source, subscription_tier, counted_against_limit,
          query_timestamp
        FROM dbo.Query_Log
        WHERE consumer_phone = ${phone}
        ORDER BY query_timestamp DESC
        OFFSET ${offset} ROWS
        FETCH NEXT ${PAGE_SIZE} ROWS ONLY
      `
    )

    const countRows = await prisma.$queryRaw<{ total: bigint }[]>(
      Prisma.sql`SELECT COUNT(*) AS total FROM dbo.Query_Log WHERE consumer_phone = ${phone}`
    )
    const total = Number(countRows[0]?.total ?? 0)

    return NextResponse.json({
      queries: rows.map(r => ({
        query_id: r.query_id,
        item_name: r.item_name,
        item_id: r.item_id,
        market_name: r.market_name,
        market_id: r.market_id,
        category_id: r.category_id ?? null,
        price_returned: r.price_returned != null ? Number(r.price_returned) : null,
        unit: r.unit ?? null,
        previous_price: r.previous_price != null ? Number(r.previous_price) : null,
        price_change_pct: r.price_change_pct != null ? Number(r.price_change_pct) : null,
        query_type: r.query_type ?? null,
        query_source: r.query_source ?? null,
        subscription_tier: r.subscription_tier ?? null,
        counted_against_limit: r.counted_against_limit ?? null,
        query_timestamp: r.query_timestamp instanceof Date
          ? r.query_timestamp.toISOString()
          : r.query_timestamp,
      })),
      total,
      page,
      pages: Math.ceil(total / PAGE_SIZE),
    })
  } catch (err) {
    console.error('[history] GET error:', err)
    return NextResponse.json({ queries: [], total: 0, page: 1, pages: 0 }, { status: 500 })
  }
}
