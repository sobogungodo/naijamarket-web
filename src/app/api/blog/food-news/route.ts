// src/app/api/blog/food-news/route.ts
// FRS v2.2 Section 7.3 — GET /api/blog/food-news
// Returns published articles, paginated, filterable by category/week/commodity
// ALL subscription tiers
// NFR-009: No internal metadata in consumer responses

import { NextRequest, NextResponse } from 'next/server'
import { getAzureSqlConnection } from '@/lib/db'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page       = Math.max(1, parseInt(searchParams.get('page')     || '1'))
    const per_page   = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '12')))
    const category   = searchParams.get('category')   || null
    const week_start = searchParams.get('week_start') || null
    const commodity  = searchParams.get('commodity')  || null
    const offset     = (page - 1) * per_page

    const pool = await getAzureSqlConnection()

    // Build WHERE clauses
    const conditions: string[] = ['is_published = 1', "tier_access = 'ALL'"]
    const params: (string | number)[] = []

    if (category) {
      conditions.push(`category = @category`)
      params.push(category)
    }
    if (week_start) {
      conditions.push(`week_start = @week_start`)
      params.push(week_start)
    }
    if (commodity) {
      conditions.push(`affected_commodities LIKE @commodity`)
      params.push(`%${commodity}%`)
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : ''

    // Count total
    const countResult = await pool.request()
      .input('category',   category   || '')
      .input('week_start', week_start || '')
      .input('commodity',  commodity  ? `%${commodity}%` : '')
      .query(`
        SELECT COUNT(*) AS total
        FROM dbo.News_Articles
        ${whereClause}
      `)

    const total = countResult.recordset[0]?.total || 0

    // Fetch page — NFR-009: only consumer-safe fields
    const result = await pool.request()
      .input('category',   category   || '')
      .input('week_start', week_start || '')
      .input('commodity',  commodity  ? `%${commodity}%` : '')
      .input('per_page', per_page)
      .input('offset',   offset)
      .query(`
        SELECT
          article_id,
          slug,
          title,
          summary,
          source_name,
          source_url,
          category,
          affected_commodities,
          affected_states,
          published_date,
          week_start,
          created_at
        FROM dbo.News_Articles
        ${whereClause}
        ORDER BY published_date DESC, created_at DESC
        OFFSET @offset ROWS FETCH NEXT @per_page ROWS ONLY
      `)

    const articles = result.recordset.map(row => ({
      ...row,
      affected_commodities: row.affected_commodities
        ? safeParseJson(row.affected_commodities)
        : [],
      affected_states: row.affected_states
        ? safeParseJson(row.affected_states)
        : [],
    }))

    return NextResponse.json({
      articles,
      total,
      page,
      per_page,
      total_pages: Math.ceil(total / per_page),
    })

  } catch (error) {
    console.error('GET /api/blog/food-news error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    )
  }
}

function safeParseJson(val: unknown) {
  if (!val) return []
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
