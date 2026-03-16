// src/app/api/enterprise/news-feed/route.ts
// Route: GET /api/enterprise/news-feed
// ENTERPRISE tier only — raw article feed for API subscribers

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifySubscriptionToken } from '@/lib/auth'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization') || ''
    const token      = authHeader.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 })
    }

    const session = await verifySubscriptionToken(token)
    if (!session) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

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

    const { searchParams } = new URL(req.url)
    const page     = Math.max(1, parseInt(searchParams.get('page')     || '1'))
    const per_page = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '50')))
    const category = searchParams.get('category') || null
    const offset   = (page - 1) * per_page

    const total = await prisma.$queryRawUnsafe<{ cnt: number }[]>(`
      SELECT COUNT(*) AS cnt FROM dbo.News_Articles
      WHERE is_published = 1
      ${category ? `AND category = '${category.replace(/'/g, "''")}'` : ''}
    `).then(r => Number(r[0]?.cnt ?? 0))

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        article_id, slug, title, summary,
        source_name, source_url, category,
        affected_commodities, affected_states,
        published_date, week_start,
        tier_access, is_published, created_at
      FROM dbo.News_Articles
      WHERE is_published = 1
      ${category ? `AND category = '${category.replace(/'/g, "''")}'` : ''}
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
      total_pages:  Math.ceil(total / per_page),
      generated_at: new Date().toISOString(),
      tier:         'ENTERPRISE',
    })

  } catch (error) {
    console.error('GET /api/enterprise/news-feed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function safeParseJson(val: unknown) {
  if (!val) return []
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}
