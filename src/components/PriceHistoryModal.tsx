// ============================================================================
// src/components/PriceHistoryModal.tsx
// NaijaMarket Intel - Price History Chart Modal
// Bloomberg Equivalent: HP <GO>
// Version: 1.0.0
// ============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PriceHistoryPoint {
  date: string;
  price: number;
  trend: string;
  source: string;
}

interface PriceStatistics {
  current: number;
  high: number;
  low: number;
  average: number;
  change: number;
  changePercent: number;
  volatility: number;
  dataPoints: number;
}

interface PriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: string;
  itemSubtitle?: string;
  market: string;
  state?: string;
  category?: string;
  currentPrice?: number;
  currentChange?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function PriceHistoryModal({
  isOpen,
  onClose,
  item,
  itemSubtitle,
  market,
  state,
  category,
}: PriceHistoryModalProps) {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PriceHistoryPoint[]>([]);
  const [statistics, setStatistics] = useState<PriceStatistics | null>(null);
  const [source, setSource] = useState<string>("database");

  // Fetch price history
  const fetchHistory = useCallback(async () => {
    if (!isOpen || !item || !market) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        \`/api/prices/history?item=\${encodeURIComponent(item)}&market=\${encodeURIComponent(market)}&period=\${period}\`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch price history");
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data || []);
        setStatistics(result.statistics);
        setSource(result.source || "database");
      } else {
        setError(result.error || "Unknown error");
      }
    } catch (err) {
      console.error("Error fetching price history:", err);
      setError("Failed to load price history. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [isOpen, item, market, period]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Don't render if not open
  if (!isOpen) return null;

  // Format price
  const formatPrice = (value: number): string => {
    if (value >= 1000000) {
      return \`₦\${(value / 1000000).toFixed(1)}M\`;
    }
    if (value >= 1000) {
      return \`₦\${(value / 1000).toFixed(0)}K\`;
    }
    return \`₦\${value.toLocaleString()}\`;
  };

  // Format full price
  const formatFullPrice = (value: number): string => {
    return \`₦\${value.toLocaleString()}\`;
  };

  // Format date for chart
  const formatChartDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-NG", {
      month: "short",
      day: "numeric",
    });
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (active && payload && payload.length && label) {
      return (
        <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-gray-400 text-xs mb-1">
            {new Date(label).toLocaleDateString("en-NG", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <p className="text-white font-bold text-lg">
            {formatFullPrice(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Get trend color
  const getTrendColor = (change: number): string => {
    if (change > 0) return "text-red-400";
    if (change < 0) return "text-emerald-400";
    return "text-gray-400";
  };

  // Get chart color based on trend
  const chartColor = statistics && statistics.changePercent >= 0 ? "#ef4444" : "#10b981";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#0f0f0f] border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
              <BarChart3 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{item}</h2>
              {itemSubtitle && (
                <p className="text-sm text-gray-500">{itemSubtitle}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  📍 {market}
                </span>
                {state && <span className="text-gray-600">•</span>}
                {state && <span>{state}</span>}
                {category && (
                  <span className="px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-300">
                    {category}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Period Selector */}
        <div className="px-5 py-3 border-b border-gray-800/50 flex items-center justify-between bg-[#0a0a0a]">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>Historical Data</span>
          </div>
          <div className="flex gap-1.5">
            {(["7d", "30d", "90d"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                disabled={loading}
                className={\`px-4 py-1.5 rounded-lg text-sm font-medium transition-all \${
                  period === p
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    : "bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-white"
                } disabled:opacity-50\`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-180px)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-72 gap-3">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
              <p className="text-gray-500 text-sm">Loading price history...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-72 gap-3">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-red-400">{error}</p>
              <button
                onClick={fetchHistory}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Statistics Cards */}
              {statistics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  {/* Current Price */}
                  <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl p-4 border border-gray-700/50">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                      Current
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {formatPrice(statistics.current)}
                    </p>
                    <div className={\`flex items-center gap-1 mt-1 \${getTrendColor(statistics.changePercent)}\`}>
                      {statistics.changePercent > 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : statistics.changePercent < 0 ? (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      ) : (
                        <Minus className="w-3.5 h-3.5" />
                      )}
                      <span className="text-sm font-semibold">
                        {statistics.changePercent > 0 ? "+" : ""}
                        {statistics.changePercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* High */}
                  <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-800/50">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                      {period.toUpperCase()} High
                    </p>
                    <p className="text-xl font-semibold text-red-400">
                      {formatPrice(statistics.high)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Peak price</p>
                  </div>

                  {/* Low */}
                  <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-800/50">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                      {period.toUpperCase()} Low
                    </p>
                    <p className="text-xl font-semibold text-emerald-400">
                      {formatPrice(statistics.low)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Lowest price</p>
                  </div>

                  {/* Average */}
                  <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-800/50">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                      Average
                    </p>
                    <p className="text-xl font-semibold text-blue-400">
                      {formatPrice(statistics.average)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      σ {statistics.volatility}%
                    </p>
                  </div>
                </div>
              )}

              {/* Chart */}
              <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
                {data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart
                      data={data}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#222"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatChartDate}
                        stroke="#444"
                        tick={{ fill: "#666", fontSize: 11 }}
                        axisLine={{ stroke: "#333" }}
                        tickLine={false}
                        interval="preserveStartEnd"
                        minTickGap={30}
                      />
                      <YAxis
                        tickFormatter={(value) => formatPrice(value)}
                        stroke="#444"
                        tick={{ fill: "#666", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={65}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke={chartColor}
                        strokeWidth={2}
                        fill="url(#priceGradient)"
                        dot={false}
                        activeDot={{
                          r: 6,
                          fill: chartColor,
                          stroke: "#fff",
                          strokeWidth: 2,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    No chart data available
                  </div>
                )}
              </div>

              {/* Footer Info */}
              <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
                <span>
                  {statistics?.dataPoints || 0} data points • {source === "mock" ? "Simulated data" : "Historical data"}
                </span>
                <span className="font-mono">
                  Bloomberg: HP &lt;GO&gt;
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
