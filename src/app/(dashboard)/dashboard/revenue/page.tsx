"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, PieChart,
  RefreshCw, Calendar, Users, Zap, Globe, ArrowUpRight,
  ArrowDownRight, Minus, CreditCard, Coins, FileText, Database,
  Lock, ArrowRight, Smartphone,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface RevenueEvent {
  event_type: string;
  channel: string;
  total_revenue: number;
  transactions: number;
  unique_customers: number;
}

interface RevenueTrend {
  date: string;
  total: number;
  subscriptions: number;
  tokens: number;
  api: number;
}

interface RevenueStats {
  total_revenue: number;
  total_transactions: number;
  unique_customers: number;
  avg_transaction: number;
  revenue_by_type: Record<string, number>;
  revenue_by_channel: Record<string, number>;
  revenue_by_tier: Record<string, number>;
  revenue_by_source: Record<string, number>;
  daily_trend: RevenueTrend[];
  top_customers: { phone: string; total: number; count: number }[];
  period_comparison: { current: number; previous: number; change_pct: number };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIER_HIERARCHY = ["FREE", "SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"];
const MIN_TIER = "ENTERPRISE";

const TYPE_ICONS: Record<string, { icon: typeof DollarSign; color: string }> = {
  SUBSCRIPTION: { icon: CreditCard, color: "text-blue-600" },
  TOKEN_PURCHASE: { icon: Coins, color: "text-amber-600" },
  API_CALL: { icon: Database, color: "text-purple-600" },
  REPORT_DOWNLOAD: { icon: FileText, color: "text-cyan-600" },
  DATA_EXPORT: { icon: Globe, color: "text-green-600" },
  AIRTIME_COST: { icon: Smartphone, color: "text-red-600" },
};

const CHANNEL_COLORS: Record<string, string> = {
  WEB: "bg-blue-500", WHATSAPP: "bg-green-500", API: "bg-purple-500", ADMIN: "bg-gray-500", SYSTEM: "bg-red-500",
};

const SOURCE_LABELS: Record<string, string> = {
  ORGANIC: "Direct / Organic", WHATSAPP_SHARE: "WhatsApp Shares", WEB_SEARCH: "Web Search",
  REFERRAL: "Referral Program", AD_CAMPAIGN: "Ad Campaigns",
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RevenueAttributionPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userTier, setUserTier] = useState("FREE");
  const [period, setPeriod] = useState("30d");

  useEffect(() => {
    if (session?.user) {
      setUserTier((session.user as { tier?: string }).tier || "FREE");
    }
  }, [session]);

  const hasTierAccess = TIER_HIERARCHY.indexOf(userTier) >= TIER_HIERARCHY.indexOf(MIN_TIER);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/revenue?period=${period}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      } else {
        setError(data.error || "Failed to load revenue data");
      }
    } catch (e) {
      setError("Network error: " + String(e));
    }
    setLoading(false);
  }, [period]);

  useEffect(() => { if (hasTierAccess) loadData(); }, [hasTierAccess, loadData]);

  const fmt = (n: number) => "₦" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const pct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(1) + "%";

  // Revenue bar chart (simple CSS bars)
  const maxRevByType = stats ? Math.max(...Object.values(stats.revenue_by_type), 1) : 1;
  const maxRevByChannel = stats ? Math.max(...Object.values(stats.revenue_by_channel), 1) : 1;
  const maxRevBySource = stats ? Math.max(...Object.values(stats.revenue_by_source), 1) : 1;

  if (!hasTierAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Lock className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Revenue Attribution</h1>
        <p className="text-gray-500 mb-6 max-w-md">
          Track revenue by source, channel, and feature. Understand which acquisition channels
          drive the most value. Available for ENTERPRISE subscribers.
        </p>
        <a href="/subscribe" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
          Upgrade to ENTERPRISE <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-900 via-purple-900 to-violet-900 rounded-xl p-4 md:p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-8 h-8 text-violet-400" />
              <h1 className="text-2xl font-bold">Revenue Attribution</h1>
            </div>
            <p className="text-violet-200 text-sm">
              Track revenue sources, channels, and feature monetization performance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select value={period} onChange={e => setPeriod(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white">
              <option value="7d" className="text-gray-900">Last 7 days</option>
              <option value="30d" className="text-gray-900">Last 30 days</option>
              <option value="90d" className="text-gray-900">Last 90 days</option>
              <option value="all" className="text-gray-900">All time</option>
            </select>
            <button onClick={loadData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400"><RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" /> Loading revenue data...</div>
      ) : stats ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <DollarSign className="w-5 h-5 text-green-600 mb-2" />
              <p className="text-2xl font-bold">{fmt(stats.total_revenue)}</p>
              <p className="text-xs text-gray-500">Total Revenue</p>
              {stats.period_comparison && (
                <p className={`text-xs mt-1 flex items-center gap-0.5 ${stats.period_comparison.change_pct >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {stats.period_comparison.change_pct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {pct(stats.period_comparison.change_pct)} vs prev period
                </p>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <Zap className="w-5 h-5 text-blue-600 mb-2" />
              <p className="text-2xl font-bold">{stats.total_transactions.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Transactions</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <Users className="w-5 h-5 text-purple-600 mb-2" />
              <p className="text-2xl font-bold">{stats.unique_customers.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Unique Customers</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <BarChart3 className="w-5 h-5 text-amber-600 mb-2" />
              <p className="text-2xl font-bold">{fmt(stats.avg_transaction)}</p>
              <p className="text-xs text-gray-500">Avg Transaction</p>
            </div>
          </div>

          {/* Revenue by Type + Channel (2-col) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By Type */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-blue-500" /> Revenue by Feature
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.revenue_by_type)
                  .filter(([, v]) => v > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, amount]) => {
                    const cfg = TYPE_ICONS[type] || { icon: DollarSign, color: "text-gray-600" };
                    const Icon = cfg.icon;
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${cfg.color}`} />
                            {type.replace(/_/g, " ")}
                          </span>
                          <span className="font-medium">{fmt(amount)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(amount / maxRevByType) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* By Channel */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-green-500" /> Revenue by Channel
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.revenue_by_channel)
                  .filter(([, v]) => v > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([channel, amount]) => (
                    <div key={channel}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${CHANNEL_COLORS[channel] || "bg-gray-400"}`} />
                          {channel}
                        </span>
                        <span className="font-medium">{fmt(amount)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                        <div className={`h-full rounded-full transition-all ${CHANNEL_COLORS[channel] || "bg-gray-400"}`} style={{ width: `${(amount / maxRevByChannel) * 100}%` }} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Attribution Sources + Tier Breakdown (2-col) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Attribution Sources */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-500" /> Attribution Sources
              </h3>
              <p className="text-xs text-gray-500 mb-3">How customers found NaijaMarket Intel</p>
              <div className="space-y-3">
                {Object.entries(stats.revenue_by_source)
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, amount]) => (
                    <div key={source}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>{SOURCE_LABELS[source] || source}</span>
                        <span className="font-medium">{fmt(amount)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                        <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${(amount / maxRevBySource) * 100}%` }} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Tier Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-500" /> Revenue by Subscription Tier
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.revenue_by_tier)
                  .sort(([, a], [, b]) => b - a)
                  .map(([tier, amount]) => {
                    const tierTotal = Object.values(stats.revenue_by_tier).reduce((a, b) => a + b, 0);
                    const share = tierTotal > 0 ? ((amount / tierTotal) * 100).toFixed(1) : "0";
                    return (
                      <div key={tier} className="flex items-center gap-3">
                        <span className="w-24 text-sm font-medium">{tier || "N/A"}</span>
                        <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden relative">
                          <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${share}%` }} />
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                            {fmt(amount)} ({share}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Revenue Trend (simple bar sparkline) */}
          {stats.daily_trend && stats.daily_trend.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-500" /> Daily Revenue Trend
              </h3>
              <div className="flex items-end gap-1 h-32">
                {(() => {
                  const maxDay = Math.max(...stats.daily_trend.map(d => d.total), 1);
                  return stats.daily_trend.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center group relative">
                      <div className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                        style={{ height: `${Math.max(2, (d.total / maxDay) * 100)}%` }}>
                      </div>
                      <div className="hidden group-hover:block absolute -top-10 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        {new Date(d.date).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}: {fmt(d.total)}
                      </div>
                    </div>
                  ));
                })()}
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>{stats.daily_trend.length > 0 ? new Date(stats.daily_trend[0].date).toLocaleDateString("en-NG", { month: "short", day: "numeric" }) : ""}</span>
                <span>{stats.daily_trend.length > 0 ? new Date(stats.daily_trend[stats.daily_trend.length - 1].date).toLocaleDateString("en-NG", { month: "short", day: "numeric" }) : ""}</span>
              </div>
            </div>
          )}

          {/* Top Customers */}
          {stats.top_customers && stats.top_customers.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-green-500" /> Top Revenue Customers
              </h3>
              <div className="overflow-x-auto">
                <div className="overflow-x-auto rounded-lg">
            <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-xs uppercase">
                      <th className="pb-2 pr-4">#</th><th className="pb-2 pr-4">Phone</th><th className="pb-2 pr-4 text-right">Revenue</th><th className="pb-2 text-right">Transactions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {stats.top_customers.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                        <td className="py-2 pr-4 font-medium">{i + 1}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{c.phone.slice(0, 6)}***{c.phone.slice(-3)}</td>
                        <td className="py-2 pr-4 text-right font-medium">{fmt(c.total)}</td>
                        <td className="py-2 text-right text-gray-500">{c.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
