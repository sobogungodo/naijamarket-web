// src/app/blog/page.tsx
// CORRECT Tailwind dark mode: light styles = default, dark: = dark overrides

import { getAllPosts, getFeaturedPosts, getAllCategories, formatDate } from "@/lib/blog";
import Link from "next/link";
import type { Metadata } from "next";
import BlogNavbar from "@/components/blog/BlogNavbar";

export const metadata: Metadata = {
  title: "Market Intelligence Blog | NaijaMarket Intel",
  description: "Nigeria's most comprehensive food and commodity price intelligence. Weekly market reports, price analysis, and trading insights across 226 Nigerian markets.",
};

// Light-first category styles with dark: overrides
const CAT_STYLE: Record<string, string> = {
  "Annual Report":    "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800/50",
  "Quarterly Report": "bg-blue-50   text-blue-700   border border-blue-200   dark:bg-blue-900/40   dark:text-blue-400   dark:border-blue-800/50",
  "Monthly Report":   "bg-amber-50  text-amber-700  border border-amber-200  dark:bg-amber-900/40  dark:text-amber-400  dark:border-amber-800/50",
  "Deep Dive":        "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-400 dark:border-purple-800/50",
  "Regional Analysis":"bg-teal-50   text-teal-700   border border-teal-200   dark:bg-teal-900/40   dark:text-teal-400   dark:border-teal-800/50",
  "Market Update":    "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-800/50",
};

const CAT_DOT: Record<string, string> = {
  "Annual Report":    "bg-emerald-500",
  "Quarterly Report": "bg-blue-500",
  "Monthly Report":   "bg-amber-500",
  "Deep Dive":        "bg-purple-500",
  "Regional Analysis":"bg-teal-500",
  "Market Update":    "bg-orange-500",
};

export default function BlogPage({
  searchParams,
}: {
  searchParams: { category?: string; page?: string };
}) {
  const allPosts       = getAllPosts();
  const featured       = getFeaturedPosts();
  const categories     = getAllCategories();
  const activeCategory = searchParams.category || "All";

  const filtered =
    activeCategory === "All"
      ? allPosts
      : allPosts.filter((p) => p.category === activeCategory);

  const page    = parseInt(searchParams.page || "1");
  const perPage = 9;
  const total   = filtered.length;
  const posts   = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    // Light default bg, dark: override
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-200">

      {/* ── NAVBAR ─────────────────────────────────────────────── */}
      <BlogNavbar />

      {/* ── HERO HEADER ────────────────────────────────────────── */}
      <div className="border-b bg-white border-gray-200 dark:bg-[#0f0f0f] dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-14">
          {/* Terminal breadcrumb */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-emerald-600 dark:text-emerald-400 font-mono text-xs">NM://</span>
            <span className="text-gray-400 font-mono text-xs">research-desk</span>
            <span className="text-gray-300 dark:text-gray-700 font-mono text-xs">/</span>
            <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">market-intelligence</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3"
              style={{ letterSpacing: "-0.02em" }}>
            Market Intelligence{" "}
            <span className="text-emerald-600 dark:text-emerald-400">Weekly Reports</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-base max-w-xl">
            GPS-verified commodity price analysis from 226 Nigerian markets — powered by
            10,000+ verified traders across 37 states.
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-8 mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
            {[
              { value: "226",    label: "Markets Tracked",  color: "text-emerald-600 dark:text-emerald-400" },
              { value: "524+",   label: "Commodities",      color: "text-amber-600 dark:text-amber-400" },
              { value: "37",     label: "States Covered",   color: "text-blue-600 dark:text-blue-400" },
              { value: "Weekly", label: "Update Frequency", color: "text-purple-600 dark:text-purple-400" },
            ].map((s) => (
              <div key={s.label}>
                <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* ── FEATURED POSTS ─────────────────────────────────── */}
        {featured.length > 0 && activeCategory === "All" && page === 1 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-5 bg-emerald-500 dark:bg-emerald-400 rounded" />
              <h2 className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                Featured Reports
              </h2>
            </div>

            <div className="grid md:grid-cols-5 gap-4">
              {/* Large card */}
              <Link href={`/blog/${featured[0].slug}`} className="md:col-span-3 group">
                <div className="h-full bg-white dark:bg-[#141414] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-md transition-all duration-300">
                  <div className="h-0.5 bg-emerald-500" />
                  <div className="p-7">
                    <div className={`inline-flex text-xs font-mono font-semibold px-2.5 py-1 rounded mb-4 ${CAT_STYLE[featured[0].category] || "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"}`}>
                      {featured[0].category}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-snug mb-3 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors"
                        style={{ letterSpacing: "-0.01em" }}>
                      {featured[0].title}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-500 text-sm leading-relaxed line-clamp-3 mb-6">
                      {featured[0].excerpt}
                    </p>
                    <div className="flex items-center justify-between text-xs font-mono text-gray-400 dark:text-gray-600">
                      <span>{formatDate(featured[0].date)}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-500 font-semibold">
                        READ REPORT →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Two smaller */}
              <div className="md:col-span-2 flex flex-col gap-4">
                {featured.slice(1, 3).map((post) => (
                  <Link key={post.slug} href={`/blog/${post.slug}`} className="group flex-1">
                    <div className="h-full bg-white dark:bg-[#141414] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-sm transition-all duration-300">
                      <div className="h-0.5 bg-amber-500" />
                      <div className="p-5">
                        <div className={`inline-flex text-xs font-mono font-semibold px-2 py-0.5 rounded mb-3 ${CAT_STYLE[post.category] || "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"}`}>
                          {post.category}
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-snug mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {post.title}
                        </h3>
                        <p className="text-gray-400 dark:text-gray-500 text-xs leading-relaxed line-clamp-2 mb-3">
                          {post.excerpt}
                        </p>
                        <p className="text-xs font-mono text-gray-400 dark:text-gray-600">{formatDate(post.date)}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── CATEGORY FILTER ────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          <span className="text-gray-400 text-xs font-mono mr-1">FILTER:</span>
          {["All", ...categories].map((cat) => (
            <Link
              key={cat}
              href={cat === "All" ? "/blog" : `/blog?category=${encodeURIComponent(cat)}`}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
                activeCategory === cat
                  ? "bg-emerald-500 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-emerald-400 hover:text-emerald-600 dark:bg-[#1a1a1a] dark:text-gray-400 dark:border-gray-700 dark:hover:border-emerald-700 dark:hover:text-emerald-400"
              }`}
            >
              {cat}
            </Link>
          ))}
          <span className="ml-auto text-gray-400 text-xs font-mono">{total} reports</span>
        </div>

        {/* ── POST GRID ──────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
              <article className="h-full bg-white dark:bg-[#141414] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                <div className={`h-0.5 ${CAT_DOT[post.category] || "bg-gray-300"}`} />
                <div className="p-5 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${CAT_STYLE[post.category] || "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"}`}>
                      {post.category}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{post.readTime}</span>
                  </div>

                  <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-snug mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex-1"
                      style={{ letterSpacing: "-0.01em" }}>
                    {post.title}
                  </h3>

                  <p className="text-gray-500 dark:text-gray-500 text-xs leading-relaxed line-clamp-2 mb-4">
                    {post.excerpt}
                  </p>

                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {post.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs font-mono text-emerald-600 dark:text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800 text-xs font-mono text-gray-400 dark:text-gray-600">
                    <span>{formatDate(post.date)}</span>
                    <span className="text-emerald-600 dark:text-emerald-500 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 font-semibold">
                      READ →
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>

        {/* ── PAGINATION ─────────────────────────────────────── */}
        {total > perPage && (
          <div className="flex justify-center gap-2 mb-12">
            {Array.from({ length: Math.ceil(total / perPage) }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/blog?${activeCategory !== "All" ? `category=${encodeURIComponent(activeCategory)}&` : ""}page=${p}`}
                className={`w-9 h-9 flex items-center justify-center rounded-lg text-xs font-mono font-semibold transition-all ${
                  p === page
                    ? "bg-emerald-500 text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-emerald-400 dark:bg-[#1a1a1a] dark:text-gray-400 dark:border-gray-700"
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
        )}

        {/* ── WHATSAPP CTA ───────────────────────────────────── */}
        <div className="rounded-xl border p-8 flex flex-col md:flex-row items-center justify-between gap-6
                        bg-emerald-50 border-emerald-200
                        dark:bg-emerald-900/10 dark:border-emerald-900/50">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-mono uppercase tracking-widest">Live Service</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1" style={{ letterSpacing: "-0.01em" }}>
              Get Real-Time Prices on WhatsApp
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Skip the weekly reports. Live prices from 226 verified Nigerian markets — free, no app needed.
            </p>
          </div>
          <a href="https://wa.me/message/NAIJAMARKET"
             className="shrink-0 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-lg transition-colors whitespace-nowrap">
            🟢 Start Free on WhatsApp
          </a>
        </div>
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <div className="mt-12 py-5 border-t text-center text-xs font-mono
                      border-gray-200 text-gray-400
                      dark:border-gray-800 dark:text-gray-600">
        © 2025 NaijaMarket Intel · Giggababytes Oy · Data: NBS + 226 verified reporters
      </div>
    </div>
  );
}
