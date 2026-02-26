// src/app/blog/[slug]/page.tsx
// CORRECT: light styles = default, dark: = dark overrides

import { getPostBySlug, getAllPosts, getRecentPosts, formatDate } from "@/lib/blog";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { marked } from "marked";
import BlogNavbar from "@/components/blog/BlogNavbar";

interface Props { params: { slug: string } }

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPostBySlug(params.slug);
  if (!post) return { title: "Post Not Found" };
  return {
    title: `${post.title} | NaijaMarket Intel`,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, type: "article", publishedTime: post.date },
  };
}

const CAT_STYLE: Record<string, string> = {
  "Annual Report":    "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800/50",
  "Quarterly Report": "bg-blue-50   text-blue-700   border border-blue-200   dark:bg-blue-900/40   dark:text-blue-400   dark:border-blue-800/50",
  "Monthly Report":   "bg-amber-50  text-amber-700  border border-amber-200  dark:bg-amber-900/40  dark:text-amber-400  dark:border-amber-800/50",
  "Deep Dive":        "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-400 dark:border-purple-800/50",
  "Regional Analysis":"bg-teal-50   text-teal-700   border border-teal-200   dark:bg-teal-900/40   dark:text-teal-400   dark:border-teal-800/50",
};

export default function BlogPostPage({ params }: Props) {
  const post = getPostBySlug(params.slug);
  if (!post) notFound();

  const recent      = getRecentPosts(5).filter((p) => p.slug !== post.slug).slice(0, 4);
  const htmlContent = marked(post.content) as string;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-200">

      {/* ── NAVBAR ─────────────────────────────────────────── */}
      <BlogNavbar />

      {/* ── BREADCRUMB ────────────────────────────────────── */}
      <div className="border-b bg-white border-gray-200 dark:bg-[#0f0f0f] dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-2 text-xs font-mono
                        text-gray-500 dark:text-gray-600">
          <Link href="/"     className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Home</Link>
          <span className="text-gray-300 dark:text-gray-700">/</span>
          <Link href="/blog" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Blog</Link>
          <span className="text-gray-300 dark:text-gray-700">/</span>
          <span className="text-gray-700 dark:text-gray-400 truncate">{post.title}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-3 gap-10">

          {/* ── MAIN ARTICLE ──────────────────────────────── */}
          <main className="lg:col-span-2">

            {/* Header */}
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className={`text-xs font-mono font-semibold px-2.5 py-1 rounded ${CAT_STYLE[post.category] || "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"}`}>
                  {post.category}
                </span>
                {post.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="text-xs font-mono text-emerald-600 dark:text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded">
                    #{tag}
                  </span>
                ))}
              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-snug mb-5"
                  style={{ letterSpacing: "-0.02em", lineHeight: 1.3 }}>
                {post.title}
              </h1>

              <p className="text-gray-600 dark:text-gray-400 text-base leading-relaxed mb-6">
                {post.excerpt}
              </p>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-5 py-4 border-t border-b
                              border-gray-200 dark:border-gray-800
                              text-xs font-mono text-gray-500 dark:text-gray-600">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">N</span>
                  </div>
                  <div>
                    <p className="text-gray-700 dark:text-gray-300 font-semibold">{post.author}</p>
                    <p className="text-gray-400 dark:text-gray-600">NaijaMarket Intel</p>
                  </div>
                </div>
                <span className="text-gray-200 dark:text-gray-700">·</span>
                <span>{formatDate(post.date)}</span>
                <span className="text-gray-200 dark:text-gray-700">·</span>
                <span>{post.readTime}</span>
              </div>
            </div>

            {/* Article body */}
            <div className="blog-prose" dangerouslySetInnerHTML={{ __html: htmlContent }} />

            {/* Scoped prose CSS — light default, dark overrides */}
            <style>{`
              .blog-prose { line-height: 1.85; }

              /* ── HEADINGS ── */
              .blog-prose h2 {
                font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em;
                margin-top: 2.5rem; margin-bottom: 1rem;
                padding-bottom: 0.5rem;
                color: #059669;          /* emerald-600 */
                border-bottom: 1px solid #d1fae5;
              }
              .dark .blog-prose h2 {
                color: #34d399;          /* emerald-400 */
                border-bottom-color: #1f2937;
              }

              .blog-prose h3 {
                font-size: 1.1rem; font-weight: 700;
                margin-top: 2rem; margin-bottom: 0.75rem;
                color: #047857;          /* emerald-700 */
              }
              .dark .blog-prose h3 { color: #6ee7b7; /* emerald-300 */ }

              /* ── PARAGRAPHS ── */
              .blog-prose p {
                font-size: 0.95rem; margin-bottom: 1.4rem;
                color: #374151;          /* gray-700 */
              }
              .dark .blog-prose p { color: #9ca3af; /* gray-400 */ }

              /* ── TABLES ── */
              .blog-prose table {
                width: 100%; border-collapse: collapse;
                margin: 1.5rem 0; font-size: 0.85rem; font-family: monospace;
                border-radius: 8px; overflow: hidden;
                border: 1px solid #d1fae5;
              }
              .dark .blog-prose table { border-color: #1f2937; }

              .blog-prose thead tr { background: #d1fae5; }
              .dark .blog-prose thead tr { background: #064e3b; }

              .blog-prose thead th {
                padding: 10px 12px; text-align: left; font-weight: 600;
                color: #065f46;
                border-bottom: 1px solid #a7f3d0;
              }
              .dark .blog-prose thead th {
                color: #6ee7b7; border-bottom-color: #065f46;
              }

              .blog-prose tbody tr { border-bottom: 1px solid #f0fdf4; }
              .dark .blog-prose tbody tr { border-bottom-color: #111827; }

              .blog-prose tbody tr:nth-child(even) { background: #f0fdf4; }
              .dark .blog-prose tbody tr:nth-child(even) { background: #111827; }

              .blog-prose tbody tr:hover { background: #dcfce7; }
              .dark .blog-prose tbody tr:hover { background: #0f2027; }

              .blog-prose td {
                padding: 8px 12px; font-family: monospace;
                color: #374151;
              }
              .dark .blog-prose td { color: #d1d5db; }

              /* ── STRONG ── */
              .blog-prose strong { color: #047857; font-weight: 700; }
              .dark .blog-prose strong { color: #34d399; }

              /* ── BLOCKQUOTE ── */
              .blog-prose blockquote {
                border-left: 3px solid #f59e0b;
                padding: 0.75rem 1.25rem;
                background: #fffbeb;
                border-radius: 0 6px 6px 0;
                margin: 1.5rem 0; font-style: italic;
                color: #92400e;
              }
              .dark .blog-prose blockquote {
                background: #1c1400; color: #d4c080;
              }

              /* ── LISTS ── */
              .blog-prose ul { list-style: none; padding: 0; margin-bottom: 1.4rem; }
              .blog-prose ul li {
                position: relative; padding-left: 1.5rem;
                margin-bottom: 0.5rem;
                color: #374151; font-size: 0.95rem;
              }
              .dark .blog-prose ul li { color: #9ca3af; }
              .blog-prose ul li::before {
                content: "▸"; font-weight: bold;
                position: absolute; left: 0;
                color: #10b981;
              }

              .blog-prose ol { padding-left: 1.5rem; margin-bottom: 1.4rem; }
              .blog-prose ol li { margin-bottom: 0.5rem; color: #374151; font-size: 0.95rem; }
              .dark .blog-prose ol li { color: #9ca3af; }

              /* ── LINKS ── */
              .blog-prose a { color: #059669; text-decoration: underline; text-decoration-color: #f59e0b; }
              .dark .blog-prose a { color: #34d399; }

              /* ── CODE ── */
              .blog-prose code {
                background: #f0fdf4; padding: 2px 6px; border-radius: 4px;
                font-size: 0.85em; color: #059669; font-family: monospace;
              }
              .dark .blog-prose code { background: #1f2937; color: #34d399; }

              /* ── HR ── */
              .blog-prose hr {
                border: none; border-top: 1px solid #e5e7eb;
                margin: 2.5rem 0;
              }
              .dark .blog-prose hr { border-top-color: #374151; }
            `}</style>

            {/* Share */}
            <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-800">
              <p className="text-xs font-mono text-gray-400 mb-3 uppercase tracking-wider">Share Report</p>
              <div className="flex gap-3 flex-wrap">
                {[
                  { label: "🟢 WhatsApp", bg: "#25D366", href: "https://wa.me/?text=" },
                  { label: "𝕏 Twitter",  bg: "#000000", href: "https://twitter.com/intent/tweet" },
                  { label: "💼 LinkedIn", bg: "#0077B5", href: "https://linkedin.com/sharing/share-offsite/" },
                ].map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                     className="px-4 py-2 rounded-lg text-white text-xs font-semibold font-mono hover:opacity-80 transition-opacity"
                     style={{ background: s.bg }}>
                    {s.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <Link href="/blog" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 text-sm font-mono transition-colors">
                ← Back to All Reports
              </Link>
            </div>
          </main>

          {/* ── SIDEBAR ───────────────────────────────────── */}
          <aside className="space-y-6">

            {/* WhatsApp CTA */}
            <div className="rounded-xl border p-5
                            bg-emerald-50 border-emerald-200
                            dark:bg-emerald-900/10 dark:border-emerald-900/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-600 dark:text-emerald-400 text-xs font-mono uppercase tracking-wider">Live Service</span>
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">Get Live Prices on WhatsApp</h3>
              <p className="text-gray-500 dark:text-gray-500 text-xs mb-4">Real-time prices from verified traders. No app needed.</p>
              <a href="https://wa.me/message/NAIJAMARKET"
                 className="block w-full text-center py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold rounded-lg transition-colors">
                🟢 Start Free →
              </a>
            </div>

            {/* Recent posts */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 bg-amber-500 rounded" />
                <h3 className="text-xs font-mono font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Recent Reports</h3>
              </div>
              <div className="space-y-3">
                {recent.map((r) => (
                  <Link key={r.slug} href={`/blog/${r.slug}`} className="group block">
                    <div className="rounded-lg p-4 border transition-all
                                    bg-white border-gray-200 hover:border-emerald-300 hover:shadow-sm
                                    dark:bg-[#141414] dark:border-gray-800 dark:hover:border-emerald-800">
                      <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${CAT_STYLE[r.category] || "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700"}`}>
                        {r.category}
                      </span>
                      <p className="text-gray-700 dark:text-gray-300 text-xs font-semibold mt-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-snug">
                        {r.title}
                      </p>
                      <p className="text-gray-400 dark:text-gray-600 text-xs font-mono mt-1">{formatDate(r.date)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 bg-emerald-500 rounded" />
                <h3 className="text-xs font-mono font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Browse Topics</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {["rice","beans","garri","tomatoes","palm-oil","onions","inflation","Lagos","Abuja","Kano","NBS-data"].map((tag) => (
                  <span key={tag}
                        className="text-xs font-mono cursor-pointer px-2.5 py-1 rounded transition-colors
                                   text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100
                                   dark:text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-900/40 dark:hover:bg-emerald-900/40">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

          </aside>
        </div>
      </div>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <div className="mt-12 py-5 border-t text-center text-xs font-mono
                      border-gray-200 text-gray-400
                      dark:border-gray-800 dark:text-gray-600">
        © 2025 NaijaMarket Intel · Giggababytes Oy · NBS + 226 verified market reporters
      </div>
    </div>
  );
}
