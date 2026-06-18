"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Truck, AlertTriangle, TrendingUp, TrendingDown, BarChart3, MapPin,
  RefreshCw, Filter, ArrowUpRight, ArrowDownRight, Package, Minus,
  ShieldAlert, Activity, Gauge, Lock, ArrowRight,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface SupplierMetric {
  market_name: string;
  state: string;
  zone: string;
  item_name: string;
  category_name: string;
  metric_date: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  price_volatility: number;
  submission_count: number;
  supply_score: number;
  demand_indicator: string;
  trend_7d: number;
  trend_30d: number;
  shortage_risk: string;
}

interface DashboardStats {
  total_commodities: number;
  total_markets: number;
  avg_supply_score: number;
  critical_alerts: number;
  warning_alerts: number;
  avg_volatility: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIER_HIERARCHY = ["FREE", "SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"];
const MIN_TIER = "CORPORATE";

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof AlertTriangle }> = {
  CRITICAL: { label: "Critical", color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800", icon: ShieldAlert },
  WARNING: { label: "Warning", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800", icon: AlertTriangle },
  WATCH: { label: "Watch", color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800", icon: Activity },
  NORMAL: { label: "Normal", color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800", icon: Gauge },
};

const ZONES = ["All Zones", "South-West", "South-East", "South-South", "North-Central", "North-West", "North-East"];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SupplierDashboardPage() {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<SupplierMetric[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userTier, setUserTier] = useState("FREE");
  const [filterZone, setFilterZone] = useState("All Zones");
  const [filterRisk, setFilterRisk] = useState("ALL");
  const [sortField, setSortField] = useState<"shortage_risk" | "supply_score" | "price_volatility" | "trend_7d">("shortage_risk");

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
      const res = await fetch("/api/supplier");
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics || []);
        setStats(data.stats || null);
      } else {
        setError(data.error || "Failed to load data");
      }
    } catch (e) {
      setError("Network error: " + String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (hasTierAccess) loadData(); }, [hasTierAccess, loadData]);

  // Filter and sort
  const filtered = metrics
    .filter(m => filterZone === "All Zones" || m.zone === filterZone)
    .filter(m => filterRisk === "ALL" || m.shortage_risk === filterRisk)
    .sort((a, b) => {
      if (sortField === "shortage_risk") {
        const order = { CRITICAL: 0, WARNING: 1, WATCH: 2, NORMAL: 3 };
        return (order[a.shortage_risk as keyof typeof order] ?? 4) - (order[b.shortage_risk as keyof typeof order] ?? 4);
      }
      if (sortField === "supply_score") return (a.supply_score ?? 0) - (b.supply_score ?? 0);
      if (sortField === "price_volatility") return (b.price_volatility ?? 0) - (a.price_volatility ?? 0);
      if (sortField === "trend_7d") return Math.abs(b.trend_7d ?? 0) - Math.abs(a.trend_7d ?? 0);
      return 0;
    });

  const criticals = metrics.filter(m => m.shortage_risk === "CRITICAL");
  const warnings = metrics.filter(m => m.shortage_risk === "WARNING");

  // Supply score color
  const scoreColor = (s: number) => s >= 70 ? "text-green-600" : s >= 40 ? "text-yellow-600" : "text-red-600";
  const scoreBar = (s: number) => s >= 70 ? "bg-green-500" : s >= 40 ? "bg-yellow-500" : "bg-red-500";

  if (!hasTierAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Lock className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Supplier Intelligence</h1>
        <p className="text-gray-500 mb-6 max-w-md">
          Real-time supply chain monitoring, shortage alerts, and supplier metrics.
          Available for CORPORATE and ENTERPRISE subscribers.
        </p>
        <a href="/subscribe" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
          Upgrade to CORPORATE <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-900 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Truck className="w-8 h-8 text-emerald-400" />
              <h1 className="text-2xl font-bold">Supplier Intelligence</h1>
            </div>
            <p className="text-emerald-200 text-sm">
              Supply chain monitoring • Shortage alerts • Price volatility tracking
            </p>
          </div>
          <button onClick={loadData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Markets", value: stats.total_markets, icon: MapPin, color: "text-blue-600" },
            { label: "Commodities", value: stats.total_commodities, icon: Package, color: "text-purple-600" },
            { label: "Avg Supply Score", value: stats.avg_supply_score + "/100", icon: Gauge, color: scoreColor(stats.avg_supply_score) },
            { label: "Critical Alerts", value: stats.critical_alerts, icon: ShieldAlert, color: "text-red-600" },
            { label: "Warnings", value: stats.warning_alerts, icon: AlertTriangle, color: "text-orange-600" },
            { label: "Avg Volatility", value: (stats.avg_volatility * 100).toFixed(1) + "%", icon: Activity, color: "text-indigo-600" },
          ].map((kpi, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2`} />
              <p className="text-xl font-bold">{kpi.value}</p>
              <p className="text-xs text-gray-500">{kpi.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Critical Alerts Banner */}
      {criticals.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-xl p-5">
          <h3 className="text-red-700 dark:text-red-300 font-bold flex items-center gap-2 mb-3">
            <ShieldAlert className="w-5 h-5" /> {criticals.length} CRITICAL Shortage Alert{criticals.length > 1 ? "s" : ""}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {criticals.map((m, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{m.item_name}</p>
                  <p className="text-xs text-gray-500">{m.market_name}, {m.state}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">Supply: {m.supply_score}/100</p>
                  <p className="text-xs text-gray-500">{m.trend_7d > 0 ? "+" : ""}{m.trend_7d}% (7d)</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-gray-400" />
        <select value={filterZone} onChange={e => setFilterZone(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700">
          {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700">
          <option value="ALL">All Risk Levels</option>
          <option value="CRITICAL">🔴 Critical</option>
          <option value="WARNING">🟠 Warning</option>
          <option value="WATCH">🟡 Watch</option>
          <option value="NORMAL">🟢 Normal</option>
        </select>
        <select value={sortField} onChange={e => setSortField(e.target.value as typeof sortField)}
          className="border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700">
          <option value="shortage_risk">Sort: Risk Level</option>
          <option value="supply_score">Sort: Supply Score (low first)</option>
          <option value="price_volatility">Sort: Volatility (high first)</option>
          <option value="trend_7d">Sort: Biggest Price Move</option>
        </select>
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} of {metrics.length} items</span>
      </div>

      {/* Supplier Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="overflow-x-auto rounded-lg">
            <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-xs uppercase tracking-wide">
                <th className="text-left p-3">Commodity</th>
                <th className="text-left p-3">Market</th>
                <th className="text-right p-3">Price (₦)</th>
                <th className="text-center p-3">Supply Score</th>
                <th className="text-center p-3">Volatility</th>
                <th className="text-right p-3">7d Trend</th>
                <th className="text-right p-3">30d Trend</th>
                <th className="text-center p-3">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading supplier data...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No data matches your filters.</td></tr>
              ) : filtered.map((m, i) => {
                const risk = RISK_CONFIG[m.shortage_risk] || RISK_CONFIG.NORMAL;
                return (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="p-3">
                      <p className="font-medium">{m.item_name}</p>
                    </td>
                    <td className="p-3">
                      <p>{m.market_name}</p>
                      <p className="text-xs text-gray-500">{m.state} • {m.zone}</p>
                    </td>
                    <td className="p-3 text-right font-mono">
                      ₦{m.avg_price?.toLocaleString()}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col items-center">
                        <span className={`text-sm font-bold ${scoreColor(m.supply_score)}`}>{m.supply_score}</span>
                        <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                          <div className={`h-full rounded-full ${scoreBar(m.supply_score)}`} style={{ width: `${m.supply_score}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-xs font-medium ${m.price_volatility > 0.15 ? "text-red-600" : m.price_volatility > 0.08 ? "text-yellow-600" : "text-green-600"}`}>
                        {(m.price_volatility * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${m.trend_7d > 0 ? "text-red-600" : m.trend_7d < 0 ? "text-green-600" : "text-gray-500"}`}>
                        {m.trend_7d > 0 ? <ArrowUpRight className="w-3 h-3" /> : m.trend_7d < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {m.trend_7d > 0 ? "+" : ""}{m.trend_7d}%
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className={`text-xs ${m.trend_30d > 0 ? "text-red-600" : "text-green-600"}`}>
                        {m.trend_30d > 0 ? "+" : ""}{m.trend_30d}%
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${risk.bg} ${risk.color} border`}>
                        {m.shortage_risk}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
            </div>
        </div>
      </div>
    </div>
  );
}
