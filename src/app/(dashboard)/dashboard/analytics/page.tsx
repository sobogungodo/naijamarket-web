"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  MapPin,
  Package,
  Activity,
  Zap,
  Globe,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ============================================================================
// TYPES
// ============================================================================

interface PriceTrend {
  date: string;
  displayDate: string;
  nfpi: number;
  submissions: number;
  avgPrice: number;
}

interface RegionalIndex {
  region: string;
  name: string;
  index: number;
  change: number;
  marketCount: number;
}

interface CategoryStat {
  category_name: string;
  item_count: number;
  avg_price: number;
  price_updates: number;
}

interface Mover {
  item: string;
  market: string;
  price: number;
  change: number;
}

interface AnalyticsData {
  priceTrends: PriceTrend[];
  regionalIndices: RegionalIndex[];
  categoryBreakdown: CategoryStat[];
  topMovers: {
    gainers: Mover[];
    losers: Mover[];
  };
  nfpiHistory: PriceTrend[];
  platformStats: {
    totalMarkets: number;
    activeMarkets: number;
    totalItems: number;
    priceUpdates24h: number;
    avgResponseTime: number;
    activeAlerts: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CHART_COLORS = {
  primary: "#10b981",    // Emerald
  secondary: "#f59e0b",  // Amber
  tertiary: "#3b82f6",   // Blue
  danger: "#ef4444",     // Red
  purple: "#8b5cf6",
  cyan: "#06b6d4",
};

const PIE_COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#06b6d4", "#ef4444"];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Custom Tooltip for charts
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="text-gray-400 text-xs mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" ? entry.value.toFixed(2) : entry.value}
        </p>
      ))}
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  color = "emerald" 
}: { 
  title: string; 
  value: string | number; 
  change?: number; 
  icon: any; 
  color?: string;
}) {
  const colorClasses: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    purple: "text-purple-400 bg-purple-500/10",
  };

  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm">{title}</span>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold text-white">{value}</span>
        {change !== undefined && (
          <span className={`text-sm flex items-center gap-1 ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// Regional Index Card
function RegionalCard({ region }: { region: RegionalIndex }) {
  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-medium">{region.region}</span>
        <span className="text-xs text-gray-600">{region.marketCount} markets</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-xl font-bold text-white">{region.index.toFixed(1)}</span>
        <span className={`text-sm ${region.change >= 0 ? "text-red-400" : "text-emerald-400"}`}>
          {region.change >= 0 ? "+" : ""}{region.change}%
        </span>
      </div>
      <div className="text-xs text-gray-500 mt-1">{region.name}</div>
    </div>
  );
}

// Top Mover Item
function MoverItem({ mover, type }: { mover: Mover; type: "gainer" | "loser" }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          type === "gainer" ? "bg-red-500/10" : "bg-emerald-500/10"
        }`}>
          {type === "gainer" ? (
            <TrendingUp className="w-4 h-4 text-red-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-emerald-400" />
          )}
        </div>
        <div>
          <div className="text-sm text-white font-medium">{mover.item}</div>
          <div className="text-xs text-gray-500">{mover.market}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm text-white">{formatPrice(mover.price)}</div>
        <div className={`text-xs ${type === "gainer" ? "text-red-400" : "text-emerald-400"}`}>
          {mover.change > 0 ? "+" : ""}{mover.change.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  // Get user tier
  const user = session?.user as { tier?: string } | undefined;
  const tier = user?.tier || "FREE";

  // Fetch analytics data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ period, tier });
        const response = await fetch(`/api/analytics?${params}`);
        const result = await response.json();

        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || "Failed to load analytics");
        }
      } catch (err) {
        setError("Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period, tier]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-white text-lg mb-2">Failed to Load Analytics</p>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-emerald-400" />
            Market Analytics
          </h1>
          <p className="text-gray-400 mt-1">
            NaijaMarket Intelligence Dashboard • Bloomberg ECST Equivalent
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-lg p-1">
          {(["7d", "30d", "90d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? "bg-emerald-500 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          title="Markets Tracked"
          value={data.platformStats.totalMarkets}
          icon={MapPin}
          color="emerald"
        />
        <StatCard
          title="Active Today"
          value={data.platformStats.activeMarkets}
          icon={Activity}
          color="blue"
        />
        <StatCard
          title="Items Catalog"
          value={data.platformStats.totalItems}
          icon={Package}
          color="amber"
        />
        <StatCard
          title="Price Updates (24h)"
          value={formatNumber(data.platformStats.priceUpdates24h)}
          change={12.5}
          icon={Zap}
          color="purple"
        />
        <StatCard
          title="Avg Response"
          value={`${data.platformStats.avgResponseTime}s`}
          icon={RefreshCw}
          color="emerald"
        />
        <StatCard
          title="Active Alerts"
          value={data.platformStats.activeAlerts}
          icon={Activity}
          color="amber"
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* NFPI Trend Chart */}
        <div className="lg:col-span-2 bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold">NaijaFood Price Index (NFPI)</h3>
              <p className="text-gray-500 text-sm">Baseline: 100 (Jan 2026)</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {data.nfpiHistory[data.nfpiHistory.length - 1]?.nfpi.toFixed(1) || "127.4"}
              </div>
              <div className="text-emerald-400 text-sm">+2.3% this week</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.nfpiHistory}>
              <defs>
                <linearGradient id="nfpiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="displayDate" 
                stroke="#666" 
                tick={{ fill: "#666", fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                stroke="#666" 
                tick={{ fill: "#666", fontSize: 11 }}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="nfpi"
                name="NFPI"
                stroke={CHART_COLORS.primary}
                strokeWidth={2}
                fill="url(#nfpiGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Regional Indices */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Regional Price Indices</h3>
            <Globe className="w-5 h-5 text-gray-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {data.regionalIndices.map((region) => (
              <RegionalCard key={region.region} region={region} />
            ))}
          </div>
        </div>
      </div>

      {/* Second Row: Top Movers + Category Breakdown */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Top Gainers */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-red-400" />
            <h3 className="text-white font-semibold">Top Gainers</h3>
          </div>
          <div className="space-y-1">
            {data.topMovers.gainers.map((mover, index) => (
              <MoverItem key={index} mover={mover} type="gainer" />
            ))}
          </div>
        </div>

        {/* Top Losers */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-emerald-400" />
            <h3 className="text-white font-semibold">Top Losers</h3>
          </div>
          <div className="space-y-1">
            {data.topMovers.losers.map((mover, index) => (
              <MoverItem key={index} mover={mover} type="loser" />
            ))}
          </div>
        </div>

        {/* Category Breakdown Pie */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-amber-400" />
            <h3 className="text-white font-semibold">Price Updates by Category</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RechartsPie>
              <Pie
                data={data.categoryBreakdown}
                dataKey="price_updates"
                nameKey="category_name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
              >
                {data.categoryBreakdown.map((_, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </RechartsPie>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {data.categoryBreakdown.slice(0, 4).map((cat, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: PIE_COLORS[index] }}
                  />
                  <span className="text-gray-400">{cat.category_name}</span>
                </div>
                <span className="text-white">{cat.price_updates}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Third Row: Submissions Trend + Category Bar Chart */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Daily Submissions Trend */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Daily Price Submissions</h3>
            <div className="text-sm text-gray-400">
              Avg: {Math.round(data.priceTrends.reduce((sum, d) => sum + d.submissions, 0) / data.priceTrends.length)} / day
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.priceTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="displayDate" 
                stroke="#666" 
                tick={{ fill: "#666", fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis stroke="#666" tick={{ fill: "#666", fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="submissions" 
                name="Submissions"
                fill={CHART_COLORS.secondary} 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Comparison */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Items by Category</h3>
            <Package className="w-5 h-5 text-gray-500" />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.categoryBreakdown} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" stroke="#666" tick={{ fill: "#666", fontSize: 11 }} />
              <YAxis 
                type="category" 
                dataKey="category_name" 
                stroke="#666" 
                tick={{ fill: "#666", fontSize: 10 }}
                width={100}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="item_count" 
                name="Items"
                fill={CHART_COLORS.tertiary} 
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-6 text-center text-gray-600 text-sm">
        Data refreshed every 5 minutes • Last update: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}
