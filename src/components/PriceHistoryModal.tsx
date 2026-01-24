// ============================================================================
// src/components/PriceHistoryModal.tsx
// NaijaMarket Intel - Price History Chart Modal
// Bloomberg Equivalent: HP <GO>
// Version: 1.0.3 - Fixed all TypeScript strict mode errors
// ============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
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
  const [data, setData] = useState<PriceHistoryPoint[]>([]);
  const [statistics, setStatistics] = useState<PriceStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch price history data
  const fetchHistory = useCallback(async () => {
    if (!isOpen || !item || !market) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        item: item,
        market: market,
        period: period,
      });

      const response = await fetch("/api/prices/history?" + params.toString());
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setStatistics(result.statistics);
      } else {
        setError(result.error || "Failed to load price history");
      }
    } catch (err) {
      console.error("Error fetching price history:", err);
      setError("Failed to load data. Please try again.");
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

  // Format price for axis
  const formatPrice = (value: number): string => {
    if (value >= 1000000) {
      return "\u20A6" + (value / 1000000).toFixed(1) + "M";
    }
    if (value >= 1000) {
      return "\u20A6" + (value / 1000).toFixed(0) + "K";
    }
    return "\u20A6" + value.toLocaleString();
  };

  // Format full price
  const formatFullPrice = (value: number): string => {
    return "\u20A6" + value.toLocaleString();
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
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (active && payload && payload.length > 0 && payload[0] && label) {
      const priceValue = payload[0].value;
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
            {formatFullPrice(priceValue)}
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
  const chartColor =
    statistics && statistics.changePercent >= 0 ? "#ef4444" : "#10b981";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#0a0a0a] border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{item}</h2>
                {itemSubtitle && (
                  <p className="text-sm text-gray-400">{itemSubtitle}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {market}
              </span>
              {state && (
                <>
                  <span>•</span>
                  <span>{state}</span>
                </>
              )}
              {category && (
                <>
                  <span>•</span>
                  <span>{category}</span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          {/* Period Selector */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-medium text-gray-400">
              Historical Price Data
            </h3>
            <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1">
              {(["7d", "30d", "90d"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors " +
                    (period === p
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-gray-400 hover:text-white")
                  }
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
              <p className="text-gray-400">Loading price history...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
              <p className="text-gray-400 mb-4">{error}</p>
              <button
                onClick={fetchHistory}
                className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Data Display */}
          {!loading && !error && data.length > 0 && (
            <>
              {/* Statistics Cards */}
              {statistics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {/* Current Price */}
                  <div className="bg-gray-800/30 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">CURRENT</p>
                    <p className="text-xl font-bold text-white">
                      {formatPrice(statistics.current)}
                    </p>
                    <div
                      className={
                        "flex items-center gap-1 text-sm " +
                        getTrendColor(statistics.changePercent)
                      }
                    >
                      {statistics.changePercent >= 0 ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      <span>
                        {statistics.changePercent >= 0 ? "+" : ""}
                        {statistics.changePercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* High */}
                  <div className="bg-gray-800/30 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">
                      {period.toUpperCase()} HIGH
                    </p>
                    <p className="text-xl font-bold text-white">
                      {formatPrice(statistics.high)}
                    </p>
                    <p className="text-sm text-gray-500">Peak</p>
                  </div>

                  {/* Low */}
                  <div className="bg-gray-800/30 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">
                      {period.toUpperCase()} LOW
                    </p>
                    <p className="text-xl font-bold text-white">
                      {formatPrice(statistics.low)}
                    </p>
                    <p className="text-sm text-gray-500">Lowest</p>
                  </div>

                  {/* Average */}
                  <div className="bg-gray-800/30 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">AVERAGE</p>
                    <p className="text-xl font-bold text-white">
                      {formatPrice(statistics.average)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {"\u03C3"} {statistics.volatility.toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}

              {/* Chart */}
              <div className="bg-gray-800/30 rounded-xl p-4">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart
                    data={data}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="priceGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={chartColor}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={chartColor}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#333"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatChartDate}
                      stroke="#666"
                      tick={{ fill: "#888", fontSize: 12 }}
                      axisLine={{ stroke: "#333" }}
                      tickLine={{ stroke: "#333" }}
                    />
                    <YAxis
                      tickFormatter={formatPrice}
                      stroke="#666"
                      tick={{ fill: "#888", fontSize: 12 }}
                      axisLine={{ stroke: "#333" }}
                      tickLine={{ stroke: "#333" }}
                      width={70}
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
              </div>

              {/* Footer Info */}
              <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                <span>
                  {statistics?.dataPoints || data.length} data points
                </span>
                <span className="font-mono">Bloomberg: HP &lt;GO&gt;</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
