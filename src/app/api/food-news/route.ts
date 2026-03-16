// src/app/api/food-news/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page      = Math.max(1, parseInt(searchParams.get('page')      || '1'))
    const per_page  = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '12')))
    const category  = searchParams.get('category')  || null
    const commodity = searchParams.get('commodity') || null
    const offset    = (page - 1) * per_page

    const catClause  = category  ? `AND category = '${category.replace(/'/g, "''")}'`  : ''
    const commClause = commodity ? `AND affected_commodities LIKE '%${commodity.replace(/'/g, "''")}%'` : ''

    // CAST to INT avoids Prisma BigInt serialisation error
    const countRows = await prisma.$queryRawUnsafe<{ total: number }[]>(`
      SELECT CAST(COUNT(*) AS INT) AS total
      FROM dbo.News_Articles
      WHERE is_published = 1 AND tier_access = 'ALL'
      ${catClause} ${commClause}
    `)
    const total = Number(countRows?.[0]?.total ?? 0)

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        article_id, slug, title, summary,
        source_name, source_url, category,
        affected_commodities, affected_states,
        published_date, week_start, created_at
      FROM dbo.News_Articles
      WHERE is_published = 1 AND tier_access = 'ALL'
      ${catClause} ${commClause}
      ORDER BY published_date DESC, created_at DESC
      OFFSET ${offset} ROWS FETCH NEXT ${per_page} ROWS ONLY
    `)

    const articles = (rows || []).map(row => ({
      ...row,
      article_id:           Number(row.article_id),
      affected_commodities: safeJson(row.affected_commodities),
      affected_states:      safeJson(row.affected_states),
    }))

    return NextResponse.json({ articles, total, page, per_page, total_pages: Math.ceil(total / per_page) })

  } catch (err) {
    console.error('[/api/food-news]', err)
    return NextResponse.json({ error: 'Failed to fetch articles', detail: String(err) }, { status: 500 })
  }
}

function safeJson(val: unknown): string[] {
  if (!val) return []
  try { const p = typeof val === 'string' ? JSON.parse(val) : val; return Array.isArray(p) ? p : [] }
  catch { return [] }
}
