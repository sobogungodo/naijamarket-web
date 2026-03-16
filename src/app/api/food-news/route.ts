// src/app/api/food-news/route.ts
// Route: GET /api/food-news
// Paginated article list — ALL tiers

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page     = Math.max(1, parseInt(searchParams.get('page')     || '1'))
    const per_page = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '12')))
    const category = searchParams.get('category')   || null
    const commodity = searchParams.get('commodity') || null
    const offset   = (page - 1) * per_page

    // Build WHERE conditions
    const where: Record<string, unknown> = {
      is_published: true,
      tier_access:  'ALL',
    }
    if (category) where.category = category

    // Count total
    const total = await prisma.$queryRawUnsafe<{ cnt: number }[]>(`
      SELECT COUNT(*) AS cnt
      FROM dbo.News_Articles
      WHERE is_published = 1
        AND tier_access  = 'ALL'
        ${category  ? `AND category = '${category.replace(/'/g, "''")}'` : ''}
        ${commodity ? `AND affected_commodities LIKE '%${commodity.replace(/'/g, "''")}%'` : ''}
    `).then(r => Number(r[0]?.cnt ?? 0))

    // Fetch page
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        article_id, slug, title, summary,
        source_name, source_url, category,
        affected_commodities, affected_states,
        published_date, week_start, created_at
      FROM dbo.News_Articles
      WHERE is_published = 1
        AND tier_access  = 'ALL'
        ${category  ? `AND category = '${category.replace(/'/g, "''")}'` : ''}
        ${commodity ? `AND affected_commodities LIKE '%${commodity.replace(/'/g, "''")}%'` : ''}
      ORDER BY published_date DESC, created_at DESC
      OFFSET ${offset} ROWS FETCH NEXT ${per_page} ROWS ONLY
    `)

    const articles = rows.map(row => ({
      ...row,
      affected_commodities: safeParseJson(row.affected_commodities),
      affected_states:      safeParseJson(row.affected_states),
    }))

    return NextResponse.json({
      articles,
      total,
      page,
      per_page,
      total_pages: Math.ceil(total / per_page),
    })

  } catch (error) {
    console.error('GET /api/food-news error:', error)
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
  }
}

function safeParseJson(val: unknown) {
  if (!val) return []
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}
