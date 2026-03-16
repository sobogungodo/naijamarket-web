// src/app/food-news/page.tsx
// Route: /food-news  (top-level, same level as /blog)
// Weekly food market intelligence index — category filter, pagination
// ALL subscription tiers

import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Nigerian Food Market Intelligence | NaijaMarket Intel',
  description:
    'Weekly food market intelligence from NBS, AFEX, WFP and leading Nigerian commodity desks — price movements, supply chain updates and policy changes.',
  openGraph: {
    title: 'Nigerian Food Market Intelligence | NaijaMarket Intel',
    description: 'Weekly commodity market intelligence for Nigeria.',
    url: 'https://naijamarketintel.ng/food-news',
  },
}

const CATEGORIES = [
  { value: '',               label: 'All News' },
  { value: 'PRICE_MOVEMENT', label: 'Price Movement' },
  { value: 'SUPPLY_CHAIN',   label: 'Supply Chain' },
  { value: 'GOVT_POLICY',    label: 'Government Policy' },
  { value: 'MARKET_EVENT',   label: 'Market Events' },
  { value: 'REGIONAL',       label: 'Regional' },
]

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

interface ArticlesResponse {
  articles:    Article[]
  total:       number
  page:        number
  per_page:    number
  total_pages: number
}

async function getArticles(page = 1, category = '', perPage = 12): Promise<ArticlesResponse> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://naijamarket-web.vercel.app'
    const params  = new URLSearchParams({
      page:     String(page),
      per_page: String(perPage),
      ...(category ? { category } : {}),
    })
    const res = await fetch(`${baseUrl}/api/food-news?${params}`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    return res.json()
  } catch {
    return { articles: [], total: 0, page: 1, per_page: 12, total_pages: 0 }
  }
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      year: 'numeric', month: 'long', day: 'numeric'
    })
  } catch { return dateStr }
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <Link href={`/food-news/${article.slug}`} className="group block">
      <article className="h-full bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-[#2a2a2a] p-6 hover:border-[#1A6B37] dark:hover:border-[#2d8a50] hover:shadow-lg transition-all duration-200">

        <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-3 font-sans ${CATEGORY_STYLES[article.category] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
          {article.category.replace('_', ' ')}
        </span>

        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3 leading-snug group-hover:text-[#1A6B37] dark:group-hover:text-[#4ade80] transition-colors font-sans line-clamp-3">
          {article.title}
        </h2>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 leading-relaxed font-sans line-clamp-3">
          {article.summary}
        </p>

        {article.affected_commodities && article.affected_commodities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {article.affected_commodities.slice(0, 4).map(c => (
              <span key={c} className="text-xs bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full font-sans">
                {c}
              </span>
            ))}
            {article.affected_commodities.length > 4 && (
              <span className="text-xs bg-gray-100 dark:bg-[#2a2a2a] text-gray-500 px-2 py-0.5 rounded-full font-sans">
                +{article.affected_commodities.length - 4} more
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-[#2a2a2a]">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-[#1A6B37] rounded-full" />
            <span className="text-xs font-semibold text-[#1A6B37] dark:text-[#4ade80] font-sans">
              {article.source_name}
            </span>
          </div>
          <time className="text-xs text-gray-400 dark:text-gray-500 font-sans">
            {formatDate(article.published_date)}
          </time>
        </div>
      </article>
    </Link>
  )
}

export default async function FoodNewsPage({
  searchParams,
}: {
  searchParams: { page?: string; category?: string }
}) {
  const page     = Math.max(1, parseInt(searchParams.page     || '1'))
  const category = searchParams.category || ''
  const data     = await getArticles(page, category)

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="bg-[#0f2419] dark:bg-[#0a0a0a] border-b border-[#1a3d25] dark:border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-0.5 bg-[#D4A017]" />
              <span className="text-xs font-semibold text-[#D4A017] uppercase tracking-widest font-sans">
                Market Intelligence
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-3 font-sans" style={{ letterSpacing: '-0.02em' }}>
              Nigerian Food Market News
            </h1>
            <p className="text-gray-300 text-sm font-sans leading-relaxed">
              Weekly intelligence from NBS, AFEX, WFP, CBN and leading Nigerian
              commodity desks — price movements, supply chain updates and policy
              changes affecting your market.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── CATEGORY FILTER ─────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map(cat => (
            <Link
              key={cat.value}
              href={cat.value ? `/food-news?category=${cat.value}` : '/food-news'}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold font-sans transition-all ${
                category === cat.value
                  ? 'bg-[#1A6B37] text-white shadow-sm'
                  : 'bg-white dark:bg-[#141414] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#2a2a2a] hover:border-[#1A6B37] hover:text-[#1A6B37] dark:hover:border-[#2d8a50] dark:hover:text-[#4ade80]'
              }`}
            >
              {cat.label}
            </Link>
          ))}
        </div>

        {data.total > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 font-sans mb-6">
            {data.total} article{data.total !== 1 ? 's' : ''}
            {category ? ` in ${CATEGORIES.find(c => c.value === category)?.label}` : ''}
          </p>
        )}

        {/* ── ARTICLE GRID ─────────────────────────────────────────────── */}
        {data.articles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {data.articles.map(article => (
              <ArticleCard key={article.article_id} article={article} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">📰</div>
            <p className="text-gray-500 dark:text-gray-400 font-sans">
              No articles found{category ? ' in this category' : ''}.
            </p>
            {category && (
              <Link href="/food-news" className="mt-3 inline-block text-[#1A6B37] dark:text-[#4ade80] text-sm font-semibold font-sans hover:underline">
                View all categories →
              </Link>
            )}
          </div>
        )}

        {/* ── PAGINATION ───────────────────────────────────────────────── */}
        {data.total_pages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {page > 1 && (
              <Link
                href={`/food-news?page=${page - 1}${category ? `&category=${category}` : ''}`}
                className="px-4 py-2 bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm font-sans font-semibold text-gray-700 dark:text-gray-300 hover:border-[#1A6B37] transition-colors"
              >
                ← Previous
              </Link>
            )}
            <span className="text-sm text-gray-500 dark:text-gray-400 font-sans px-3">
              Page {page} of {data.total_pages}
            </span>
            {page < data.total_pages && (
              <Link
                href={`/food-news?page=${page + 1}${category ? `&category=${category}` : ''}`}
                className="px-4 py-2 bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm font-sans font-semibold text-gray-700 dark:text-gray-300 hover:border-[#1A6B37] transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        )}

        {/* ── ENTERPRISE CTA ───────────────────────────────────────────── */}
        <div className="mt-16 bg-[#0f2419] dark:bg-[#0d1f15] rounded-2xl p-8 border border-[#1a3d25]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#D4A017] uppercase tracking-widest font-sans mb-1">
                Enterprise API
              </p>
              <h3 className="text-lg font-bold text-white font-sans">
                Get the raw article feed
              </h3>
              <p className="text-gray-400 text-sm font-sans mt-1">
                Enterprise subscribers access the full news feed via API — all fields, real-time.
              </p>
            </div>
            <Link
              href="/subscribe"
              className="whitespace-nowrap px-5 py-2.5 bg-[#1A6B37] text-white text-sm font-semibold font-sans rounded-xl hover:bg-[#155c2e] transition-colors"
            >
              Upgrade to Enterprise →
            </Link>
          </div>
        </div>

      </div>
    </main>
  )
}

