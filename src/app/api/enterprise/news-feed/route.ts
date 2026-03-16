// src/app/api/enterprise/news-feed/route.ts
// FRS v2.2 Section 7.3 — GET /api/enterprise/news-feed
// Raw article feed for Enterprise API subscribers — all fields
// ENTERPRISE JWT required. 403 for all other tiers.
// AC-014: ENTERPRISE JWT → full response | GOLD JWT → 403

import { NextRequest, NextResponse } from 'next/server'
import { getAzureSqlConnection } from '@/lib/db'
import { verifySubscriptionToken } from '@/lib/auth'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    // ── JWT verification ────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      )
    }

    const session = await verifySubscriptionToken(token)
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Only ENTERPRISE tier gets this feed (AC-014)
    if (session.subscription_tier !== 'ENTERPRISE') {
      return NextResponse.json(
        {
          error:   'Enterprise subscription required',
          message: 'This endpoint is available to ENTERPRISE subscribers only.',
          upgrade: 'https://naijamarketintel.ng/subscribe'
        },
        { status: 403 }
      )
    }

    // ── Query params ─────────────────────────────────────────────────────
    const { searchParams } = new URL(req.url)
    const page       = Math.max(1, parseInt(searchParams.get('page')     || '1'))
    const per_page   = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '50')))
    const category   = searchParams.get('category')   || null
    const week_start = searchParams.get('week_start') || null
    const offset     = (page - 1) * per_page

    const pool = await getAzureSqlConnection()

    const conditions: string[] = ['is_published = 1']
    if (category)   conditions.push(`category   = @category`)
    if (week_start) conditions.push(`week_start = @week_start`)
    const whereClause = `WHERE ${conditions.join(' AND ')}`

    // Count
    const countResult = await pool.request()
      .input('category',   category   || '')
      .input('week_start', week_start || '')
      .query(`SELECT COUNT(*) AS total FROM dbo.News_Articles ${whereClause}`)

    const total = countResult.recordset[0]?.total || 0

    // Full fields — Enterprise gets everything including tier_access field
    const result = await pool.request()
      .input('category',   category   || '')
      .input('week_start', week_start || '')
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
          tier_access,
          is_published,
          created_at
        FROM dbo.News_Articles
        ${whereClause}
        ORDER BY published_date DESC, created_at DESC
        OFFSET @offset ROWS FETCH NEXT @per_page ROWS ONLY
      `)

    const articles = result.recordset.map(row => ({
      ...row,
      affected_commodities: safeParseJson(row.affected_commodities),
      affected_states:      safeParseJson(row.affected_states),
    }))

    return NextResponse.json({
      articles,
      total,
      page,
      per_page,
      total_pages:   Math.ceil(total / per_page),
      subscriber_id: session.user_id,
      tier:          'ENTERPRISE',
      generated_at:  new Date().toISOString(),
    })

  } catch (error) {
    console.error('GET /api/enterprise/news-feed error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
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
