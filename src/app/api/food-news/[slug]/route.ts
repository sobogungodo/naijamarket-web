// src/app/api/food-news/[slug]/route.ts
// Route: GET /api/food-news/[slug]
// Single article by slug — ALL tiers

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    if (!slug) return NextResponse.json({ error: 'Slug required' }, { status: 400 })

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        article_id, slug, title, summary,
        source_name, source_url, category,
        affected_commodities, affected_states,
        published_date, week_start, created_at
      FROM dbo.News_Articles
      WHERE slug         = '${slug.replace(/'/g, "''")}'
        AND is_published = 1
        AND tier_access  = 'ALL'
    `)

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const row = rows[0]
    return NextResponse.json({
      ...row,
      affected_commodities: safeParseJson(row.affected_commodities),
      affected_states:      safeParseJson(row.affected_states),
    })

  } catch (error) {
    console.error('GET /api/food-news/[slug] error:', error)
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 })
  }
}

function safeParseJson(val: unknown) {
  if (!val) return []
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}
