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
  // PHN v2 provenance. All optional: the gated response returns data: [] with
  // none of these, and older cached payloads will not carry them either.
  temporal_source?: string;   // NBS_ANCHOR | NBS_INTERP | NBS_PROXY
  spatial_source?: string;    // NBS_STATE_BOUND | MODELED_STATE[_CLAMPED|_UNBOUNDED]
  state?: string;
  zone?: string;
}

// Series-level counts from the route. Field names match the API exactly
// (snake_case, printed_both_pct) — see src/app/api/prices/history/route.ts.
interface ProvenanceSummary {
  printed_both: number;
  printed_month: number;
  printed_state: number;
  modeled: number;
  total: number;
  printed_both_pct: number;
}

interface ProvenanceTier {
  label: string;
  glyph: string;
  className: string;
}

// SPATIAL TAKES PRECEDENCE. NBS_STATE_BOUND means NBS printed a figure for this
// state in this month, so it is a published number whatever the national layer
// did — including the 2 rows that are NBS_STATE_BOUND inside an NBS_INTERP
// month. Testing temporal first (as the original spec did) labelled those
// "Estimated between NBS months", which under-claims a real published figure.
//
// Returns null when provenance is absent, so the gated response renders with no
// badge rather than an empty one.
function getProvenanceTier(
  temporal?: string,
  spatial?: string
): ProvenanceTier | null {
  if (!temporal) return null;
  if (spatial === "NBS_STATE_BOUND") {
    return { label: "NBS published", glyph: "●", className: "text-emerald-400" };
  }
  if (temporal === "NBS_ANCHOR") {
    return {
      label: "NBS month · state estimated",
      glyph: "◐",
      className: "text-amber-400",
    };
  }
  if (temporal === "NBS_INTERP") {
    return { label: "Estimated between NBS months", glyph: "○", className: "text-gray-400" };
  }
  if (temporal === "NBS_PROXY") {
    return { label: "Trended from related item", glyph: "○", className: "text-blue-400" };
  }
  return null;
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
  const [period, setPeriod] = useState<"1y" | "3y" | "5y" | "10y" | "all">(
    "1y"
  );
  const [data, setData] = useState<PriceHistoryPoint[]>([]);
  const [statistics, setStatistics] = useState<PriceStatistics | null>(null);
  // null whenever the route omits the block — which is exactly the gated
  // response, so every provenance affordance below stays hidden while gated.
  const [provenance, setProvenance] = useState<ProvenanceSummary | null>(null);
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
        setProvenance(result.provenance ?? null);
      } else {
        setError(result.error || "Failed to load price history");
        setProvenance(null);
      }
    } catch (err) {
      console.error("Error fetching price history:", err);
      setError("Failed to load data. Please try again.");
      setProvenance(null);
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

  // Format date for chart.
  // PHN data is monthly (observation_date is always day-01), so the day part is
  // always "1" and carries no information. Long ranges need the year, or every
  // label repeats identically across a decade.
  const formatChartDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    if (period === "5y" || period === "10y" || period === "all") {
      return date.toLocaleDateString("en-NG", { year: "numeric" });
    }
    return date.toLocaleDateString("en-NG", {
      month: "short",
      year: "2-digit",
    });
  };

  // Custom tooltip component.
  // payload[0].payload is the full datum — the previous signature typed payload
  // as Array<{ value: number }>, which discarded it and made per-point
  // provenance unreachable.
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; payload: PriceHistoryPoint }>;
    label?: string;
  }) => {
    if (active && payload && payload.length > 0 && payload[0] && label) {
      const priceValue = payload[0].value;
      const point = payload[0].payload;
      const tier = getProvenanceTier(point?.temporal_source, point?.spatial_source);
      // PHN is monthly — the day part is always 1, so it is left out here.
      const when = new Date(label).toLocaleDateString("en-NG", {
        month: "short",
        year: "numeric",
      });
      const place = [market, point?.state].filter(Boolean).join(" · ");

      return (
        <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-3 shadow-xl">
          {place && <p className="text-gray-500 text-xs mb-1">{place}</p>}
          <p className="text-white font-bold text-lg">
            {formatFullPrice(priceValue)}
            <span className="text-gray-400 font-normal text-sm">
              {" · "}
              {when}
            </span>
          </p>
          {/* No provenance on the gated response — render price + date only. */}
          {tier && (
            <p className={"flex items-center gap-1.5 text-xs mt-1.5 " + tier.className}>
              <span aria-hidden="true">{tier.glyph}</span>
              <span>{tier.label}</span>
            </p>
          )}
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

  // ── Derived provenance affordances ──────────────────────────────────────
  // Each is inert unless the route supplied the data, so the gated response
  // (data: [], no provenance) renders exactly as it did before this change.

  // ISO YYYY-MM-DD sorts lexically, so min/max need no Date parsing.
  const earliestDate = data.reduce<string | null>(
    (min, p) => (p.date && (min === null || p.date < min) ? p.date : min),
    null
  );
  const latestDate = data.reduce<string | null>(
    (max, p) => (p.date && (max === null || p.date > max) ? p.date : max),
    null
  );

  const seriesState = data.find((p) => p.state)?.state ?? null;

  // NBS published no state or zone breakdown before 2022-06.
  const showPre2022Note = earliestDate !== null && earliestDate < "2022-06-01";

  // The Tier-3 five stop at 2024-12; NBS stopped publishing them.
  const showDiscontinuedNote = latestDate === "2024-12-01";

  // ITM01018 is deliberately absent from PHN v2 — NBS prices it per unit, which
  // will not convert to the per-kg basis the rest of the series uses.
  const isExcludedItem = item === "Chicken - Frozen (per kg)";

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
              {(["1y", "3y", "5y", "10y", "all"] as const).map((p) => (
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
                      minTickGap={40}
                      interval="preserveStartEnd"
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

              {/* Series-level provenance. Omitted entirely when the route did
                  not send the block (i.e. while the gate is on). */}
              {provenance && provenance.total > 0 && (
                <p className="mt-3 text-xs text-gray-500 leading-relaxed">
                  Data provenance: {provenance.printed_both} of {provenance.total}{" "}
                  months are published NBS figures
                  {seriesState ? ` for ${seriesState}` : ""}. The remainder are
                  estimated from published national and regional data.
                </p>
              )}

              {showPre2022Note && (
                <p className="mt-2 text-xs text-gray-600 leading-relaxed">
                  Before 2022, NBS did not publish state or regional breakdowns.
                  Regional lines converge in this period because the data does
                  not exist — not because prices were uniform.
                </p>
              )}

              {showDiscontinuedNote && (
                <p className="mt-2 text-xs text-amber-500/80 leading-relaxed">
                  NBS discontinued publishing this item after December 2024.
                </p>
              )}

              {/* Footer Info */}
              <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                <span>
                  {statistics?.dataPoints || data.length} data points
                </span>
                <span className="font-mono">Bloomberg: HP &lt;GO&gt;</span>
              </div>
              <p className="mt-2 text-xs text-gray-600 leading-relaxed">
                Prices are anchored to National Bureau of Statistics published
                figures (2018–2026). Every point is labelled by source.
              </p>
            </>
          )}

          {/* Empty State.
              The excluded-item wording is shown ONLY when the route sent a
              provenance block, i.e. when the gate is off. While gated,
              provenance is null and this falls through to the original generic
              message, byte-for-byte unchanged. */}
          {!loading && !error && data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <BarChart3 className="w-10 h-10 text-gray-600 mb-4" />
              {provenance && isExcludedItem ? (
                <p className="text-gray-400 text-center max-w-sm leading-relaxed">
                  No history available. NBS prices this item by unit, which
                  cannot be converted to a per-kg series.
                </p>
              ) : (
                <p className="text-gray-400">
                  No historical data for this item and market.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
