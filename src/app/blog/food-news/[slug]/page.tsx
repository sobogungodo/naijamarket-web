// src/app/blog/food-news/[slug]/page.tsx
// FRS v2.2 Section 7.3 — /blog/food-news/[slug]
// Individual article page — title, source attribution, summary,
// commodity tags, link to original. ALL tiers.
// NFR-009: NO internal metadata (data_source, confidence etc.) surfaced.

import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const CATEGORY_STYLES: Record<string, string> = {
  PRICE_MOVEMENT: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800',
  SUPPLY_CHAIN:   'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
  GOVT_POLICY:    'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border border-purple-200 dark:border-purple-800',
  MARKET_EVENT:   'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  REGIONAL:       'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800',
}

interface Article {
  article_id:          number
  slug:                string
  title:               string
  summary:             string
  source_name:         string
  source_url:          string
  category:            string
  published_date:      string
  week_start:          string
  affected_commodities?: string[]
  affected_states?:    string[]
}

async function getArticle(slug: string): Promise<Article | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://naijamarket-web.vercel.app'
    const res = await fetch(`${baseUrl}/api/blog/food-news/${slug}`, {
      next: { revalidate: 3600 },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`API error ${res.status}`)
    return res.json()
  } catch {
    return null
  }
}

async function getRecentArticles(excludeSlug: string): Promise<Article[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://naijamarket-web.vercel.app'
    const res = await fetch(`${baseUrl}/api/blog/food-news?per_page=4`, {
      next: { revalidate: 1800 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.articles || []).filter((a: Article) => a.slug !== excludeSlug).slice(0, 3)
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const article = await getArticle(params.slug)
  if (!article) return { title: 'Article Not Found | NaijaMarket Intel' }

  return {
    title: `${article.title} | NaijaMarket Intel`,
    description: article.summary.slice(0, 160),
    openGraph: {
      title:       article.title,
      description: article.summary.slice(0, 160),
      type:        'article',
      publishedTime: article.published_date,
      url:         `https://naijamarketintel.ng/blog/food-news/${article.slug}`,
    },
  }
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      year: 'numeric', month: 'long', day: 'numeric'
    })
  } catch {
    return dateStr
  }
}

function weekLabel(weekStart: string) {
  try {
    const d = new Date(weekStart)
    const end = new Date(d)
    end.setDate(end.getDate() + 6)
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
    return `Week of ${d.toLocaleDateString('en-NG', opts)} – ${end.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}`
  } catch {
    return weekStart
  }
}

export default async function FoodNewsArticlePage({
  params,
}: {
  params: { slug: string }
}) {
  const [article, recent] = await Promise.all([
    getArticle(params.slug),
    getRecentArticles(params.slug),
  ])

  if (!article) notFound()

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">

      {/* ── BREADCRUMB ──────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0d0d0d] border-b border-gray-100 dark:border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-2 text-sm font-sans text-gray-500 dark:text-gray-400">
            <Link href="/" className="hover:text-[#1A6B37] dark:hover:text-[#4ade80] transition-colors">Home</Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-[#1A6B37] dark:hover:text-[#4ade80] transition-colors">Blog</Link>
            <span>/</span>
            <Link href="/blog/food-news" className="hover:text-[#1A6B37] dark:hover:text-[#4ade80] transition-colors">Food News</Link>
            <span>/</span>
            <span className="text-gray-700 dark:text-gray-300 truncate max-w-xs">{article.title}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* ── ARTICLE MAIN ──────────────────────────────────────────── */}
          <article className="lg:col-span-2">
            <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-[#2a2a2a] p-8">

              {/* Category + week label */}
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full font-sans ${CATEGORY_STYLES[article.category] || 'bg-gray-100 text-gray-600'}`}>
                  {article.category.replace('_', ' ')}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-sans">
                  {weekLabel(article.week_start)}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4 font-sans leading-tight" style={{ letterSpacing: '-0.02em' }}>
                {article.title}
              </h1>

              {/* Source attribution — required per FRS Section 7 */}
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-[#2a2a2a]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#1A6B37] rounded-full" />
                  <span className="text-sm font-semibold text-[#1A6B37] dark:text-[#4ade80] font-sans">
                    Source: {article.source_name}
                  </span>
                </div>
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <time className="text-sm text-gray-500 dark:text-gray-400 font-sans">
                  {formatDate(article.published_date)}
                </time>
              </div>

              {/* Summary */}
              <div className="prose prose-gray dark:prose-invert max-w-none mb-8">
                <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed font-sans">
                  {article.summary}
                </p>
              </div>

              {/* Commodity tags */}
              {article.affected_commodities && article.affected_commodities.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-sans mb-2">
                    Commodities Covered
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {article.affected_commodities.map(c => (
                      <span key={c} className="px-3 py-1 bg-[#f0faf4] dark:bg-[#0d2418] text-[#1A6B37] dark:text-[#4ade80] text-sm font-semibold rounded-full border border-[#c6e8d1] dark:border-[#1a4d2a] font-sans">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* States coverage */}
              {article.affected_states && article.affected_states.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-sans mb-2">
                    States Affected
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-sans">
                    {article.affected_states.join(', ')}
                  </p>
                </div>
              )}

              {/* Read original source — required, direct link (FRS Section 7.2) */}
              <div className="pt-6 border-t border-gray-100 dark:border-[#2a2a2a]">
                <a
                  href={article.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1A6B37] text-white text-sm font-semibold font-sans rounded-xl hover:bg-[#155c2e] transition-colors"
                >
                  Read full article at {article.source_name}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-sans mt-2">
                  Summary by NaijaMarket Intel research team · Original article published by {article.source_name}
                </p>
              </div>
            </div>

            {/* Back link */}
            <div className="mt-6">
              <Link href="/blog/food-news" className="inline-flex items-center gap-2 text-[#1A6B37] dark:text-[#4ade80] font-sans font-semibold text-sm hover:underline">
                ← Back to Food News
              </Link>
            </div>
          </article>

          {/* ── SIDEBAR ───────────────────────────────────────────────── */}
          <aside className="space-y-6">

            {/* Live prices CTA */}
            <div className="bg-[#0f2419] dark:bg-[#0d1f15] rounded-2xl p-6 border border-[#1a3d25]">
              <p className="text-xs font-semibold text-[#D4A017] uppercase tracking-widest font-sans mb-2">
                Live Intelligence
              </p>
              <h3 className="text-base font-bold text-white font-sans mb-2">
                See Current Market Prices
              </h3>
              <p className="text-gray-400 text-sm font-sans mb-4">
                Real-time prices from verified traders across 226 Nigerian markets.
              </p>
              <Link
                href="/prices"
                className="block w-full text-center bg-[#1A6B37] text-white text-sm font-semibold font-sans py-2.5 rounded-xl hover:bg-[#155c2e] transition-colors"
              >
                View Live Prices →
              </Link>
            </div>

            {/* Recent articles */}
            {recent.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-0.5 h-5 bg-[#1A6B37] rounded" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white font-sans">
                    Recent Reports
                  </h3>
                </div>
                <div className="space-y-3">
                  {recent.map(r => (
                    <Link key={r.slug} href={`/blog/food-news/${r.slug}`} className="group block">
                      <div className="bg-white dark:bg-[#141414] rounded-xl p-4 border border-gray-100 dark:border-[#2a2a2a] hover:border-[#1A6B37] dark:hover:border-[#2d8a50] transition-all">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full font-sans ${CATEGORY_STYLES[r.category] || 'bg-gray-100 text-gray-600'}`}>
                          {r.category.replace('_', ' ')}
                        </span>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-2 leading-snug group-hover:text-[#1A6B37] dark:group-hover:text-[#4ade80] transition-colors font-sans line-clamp-2">
                          {r.title}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-sans mt-1">
                          {formatDate(r.published_date)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* WhatsApp CTA */}
            <div className="bg-[#1a6b37]/10 dark:bg-[#1a6b37]/5 rounded-2xl p-6 border border-[#1a6b37]/20">
              <p className="text-xs font-semibold text-[#1A6B37] dark:text-[#4ade80] uppercase tracking-widest font-sans mb-2">
                Free on WhatsApp
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 font-sans mb-4">
                Get live market prices, price alerts and weekly briefings directly on WhatsApp.
              </p>
              <a
                href="https://wa.me/message/NAIJAMARKET"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-[#25D366] text-white text-sm font-semibold font-sans py-2.5 rounded-xl hover:bg-[#1fb958] transition-colors"
              >
                🟢 Start on WhatsApp
              </a>
            </div>

          </aside>
        </div>
      </div>
    </main>
  )
}
