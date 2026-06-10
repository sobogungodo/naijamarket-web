"use client";

// src/app/(dashboard)/dashboard/history/page.tsx
// NaijaMarket Intel — Query History
// Reads from dbo.Query_Log — confirmed columns only (category_name skipped: type bit)

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  History,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Package,
  Clock,
  Lock,
  AlertCircle,
  X,
  BarChart2,
  Smartphone,
  Globe,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface QueryRecord {
  query_id: string;
  item_name: string;
  item_id: string;
  market_name: string;
  market_id: string;
  category_id: string | null;
  price_returned: number | null;
  unit: string | null;
  previous_price: number | null;
  price_change_pct: number | null;
  query_type: string | null;
  query_source: string | null;
  subscription_tier: string | null;
  counted_against_limit: string | null;
  query_timestamp: string;
}

interface HistoryResponse {
  queries: QueryRecord[];
  total: number;
  page: number;
  pages: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatPrice(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TrendIcon({ pct }: { pct: number | null }) {
  if (pct == null) return <Minus className="w-4 h-4 text-gray-500" />;
  if (pct > 0.5) return <TrendingUp className="w-4 h-4 text-red-400" />;
  if (pct < -0.5) return <TrendingDown className="w-4 h-4 text-emerald-400" />;
  return <Minus className="w-4 h-4 text-gray-500" />;
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null;
  const isWA = source.toLowerCase().includes("whatsapp") || source.toLowerCase().includes("wa");
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
      isWA ? "bg-green-900/40 text-green-400" : "bg-blue-900/40 text-blue-400"
    }`}>
      {isWA ? <Smartphone className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
      {isWA ? "WhatsApp" : "Web"}
    </span>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function QueryHistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const user = session?.user as { phone?: string; tier?: string } | undefined;
  const phone = user?.phone || "";

  const fetchHistory = useCallback(
    async (p: number) => {
      if (!phone) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/account/history?phone=${encodeURIComponent(phone)}&page=${p}`
        );
        const json: HistoryResponse = await res.json();
        setData(json);
      } catch {
        setError("Failed to load query history");
      } finally {
        setLoading(false);
      }
    },
    [phone]
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated" && phone) {
      fetchHistory(page);
    } else if (status === "authenticated" && !phone) {
      setLoading(false);
    }
  }, [status, phone, page, fetchHistory, router]);

  // Client-side search filter over current page
  const filtered = data?.queries.filter((q) =>
    search.trim() === "" ||
    q.item_name.toLowerCase().includes(search.toLowerCase()) ||
    q.market_name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  // ── Loading ──
  if (status === "loading" || (loading && !data)) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // ── Unauthenticated ──
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl text-white mb-2">Sign In Required</h2>
          <p className="text-gray-400">Please sign in to view your query history.</p>
        </div>
      </div>
    );
  }

  // ── No phone in session ──
  if (!phone) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl text-white mb-2">Phone Not Linked</h2>
          <p className="text-gray-400">Link your phone number to view query history.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-4xl mx-auto">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <History className="w-7 h-7 text-emerald-400" />
              Query History
            </h1>
            <p className="text-gray-400 mt-1">
              {data ? (
                <>
                  {data.total} total {data.total === 1 ? "query" : "queries"}
                  {data.pages > 1 && ` · page ${page} of ${data.pages}`}
                </>
              ) : "Your price lookup history"}
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by item or market…"
              className="w-full pl-10 pr-9 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Loading overlay ── */}
        {loading && data && (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && filtered.length === 0 && (
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-12 text-center">
            {search ? (
              <>
                <Search className="w-14 h-14 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg text-white mb-2">No results for &quot;{search}&quot;</h3>
                <button onClick={() => setSearch("")} className="text-sm text-emerald-400 hover:underline">
                  Clear filter
                </button>
              </>
            ) : (
              <>
                <BarChart2 className="w-14 h-14 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg text-white mb-2">No queries yet</h3>
                <p className="text-gray-500 text-sm mb-6">
                  Your price lookups — on web and WhatsApp — will appear here.
                </p>
                <button
                  onClick={() => router.push("/dashboard/prices")}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm inline-flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  Search Prices
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Query List ── */}
        {filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((q) => {
              const pct = q.price_change_pct;
              const trendColor = pct == null ? "text-gray-500"
                : pct > 0.5 ? "text-red-400"
                : pct < -0.5 ? "text-emerald-400"
                : "text-gray-400";

              return (
                <div
                  key={q.query_id}
                  className="bg-[#1a1a1a] border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Left — item + market */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-emerald-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Package className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{q.item_name}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {q.market_name}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <SourceBadge source={q.query_source} />
                          {q.query_type && (
                            <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full capitalize">
                              {q.query_type.replace(/_/g, " ").toLowerCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right — price + actions */}
                    <div className="flex items-start justify-between sm:justify-end sm:flex-col sm:items-end gap-3 sm:gap-1.5 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">
                          {formatPrice(q.price_returned)}
                          {q.unit && (
                            <span className="text-xs text-gray-500 font-normal ml-1">/{q.unit}</span>
                          )}
                        </p>
                        {pct != null && (
                          <p className={`text-xs flex items-center gap-1 justify-end ${trendColor}`}>
                            <TrendIcon pct={pct} />
                            {pct > 0 ? "+" : ""}{pct.toFixed(1)}% from prev
                          </p>
                        )}
                        {q.previous_price != null && q.price_returned != null && (
                          <p className="text-xs text-gray-600 mt-0.5">
                            Prev: {formatPrice(q.previous_price)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 flex items-center gap-1" title={formatTimestamp(q.query_timestamp)}>
                          <Clock className="w-3 h-3" />
                          {timeAgo(q.query_timestamp)}
                        </span>
                        <button
                          onClick={() =>
                            router.push(
                              `/dashboard/prices?item_id=${encodeURIComponent(q.item_id)}&market_id=${encodeURIComponent(q.market_id)}`
                            )
                          }
                          className="p-1.5 rounded-lg hover:bg-emerald-900/30 text-gray-500 hover:text-emerald-400 transition-colors"
                          title="Search this item again"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ── */}
        {data && data.pages > 1 && !search && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => { setPage((p) => p - 1); window.scrollTo(0, 0); }}
              disabled={page <= 1 || loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <span className="text-sm text-gray-500">
              Page {page} of {data.pages}
            </span>

            <button
              onClick={() => { setPage((p) => p + 1); window.scrollTo(0, 0); }}
              disabled={page >= data.pages || loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
