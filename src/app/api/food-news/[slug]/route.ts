import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic    = "force-dynamic"
export const revalidate = 0

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug
    if (!slug) return NextResponse.json({ error: "Slug required" }, { status: 400 })

    const safeSlug = slug.replace(/'/g, "''")
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT article_id, slug, title, summary, source_name, source_url, category,
              affected_commodities, affected_states, published_date, week_start, created_at
       FROM dbo.News_Articles
       WHERE slug = '${safeSlug}' AND is_published = 1 AND tier_access = 'ALL'`
    )

    if (!rows || rows.length === 0)
      return NextResponse.json({ error: "Article not found" }, { status: 404 })

    const row = rows[0]
    return NextResponse.json({
      ...row,
      article_id:           Number(row.article_id),
      affected_commodities: safeJson(row.affected_commodities),
      affected_states:      safeJson(row.affected_states),
    })
  } catch (err) {
    console.error("[/api/food-news/slug]", err)
    return NextResponse.json({ error: "Failed to fetch article", detail: String(err) }, { status: 500 })
  }
}

function safeJson(val: unknown): string[] {
  if (!val) return []
  try {
    const p = typeof val === "string" ? JSON.parse(val) : val
    return Array.isArray(p) ? p : []
  } catch { return [] }
}
