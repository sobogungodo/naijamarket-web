"use client";

// ============================================================================
// src/app/(dashboard)/dashboard/inflation/page.tsx
// NaijaMarket Intel - Inflation Tracker Page
// Bloomberg Equivalent: ECST <GO> (Economic Statistics)
// Version: 2.0.0 - With Time Period Tabs and NBS Comparison
// Date: 2026-01-25
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  BarChart3,
  PieChart,
  Activity,
  Globe2,
  Calendar,
  Info,
  Download,
  Scale,
  ShoppingBasket,
  Flame,
  Snowflake,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Area,
} from "recharts";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface MonthlyInflation {
  month: string;
  monthName: string;
  year: number;
  naijaMarketRate: number;
  nbsRate: number | null;
  difference: number | null;
  avgPrice: number;
  prevAvgPrice: number;
  priceChange: number;
}

interface RegionalInflation {
  region: string;
  regionName: string;
  inflationRate: number;
  monthOverMonth: number;
  trend: "up" | "down" | "stable";
  marketCount: number;
  topInflator: string | null;
}

interface ItemInflation {
  item: string;
  category: string;
  currentPrice: number;
  previousPrice: number;
  priceChange: number;
  inflationRate: number;
  contribution: number;
  trend: "up" | "down" | "stable";
}

interface BasketItem {
  item: string;
  category: string;
  weight: number;
  currentPrice: number;
  previousPrice: number;
  inflationRate: number;
  contribution: number;
}

interface CategoryBreakdown {
  category: string;
  weight: number;
  inflationRate: number;
  contribution: number;
}

interface InflationData {
  success: boolean;
  timestamp: string;
  period: string;
  periodLabel: string;
  currentInflation: {
    rate: number;
    monthOverMonth: number;
    yearOverYear: number;
    trend: "up" | "down" | "stable";
    asOf: string;
  };
  monthlyTrend: MonthlyInflation[];
  regionalBreakdown: RegionalInflation[];
  nbsComparison: {
    naijaMarket: number;
    nbs: number;
    difference: number;
    interpretation: string;
  };
  topInflators: ItemInflation[];
  topDeflators: ItemInflation[];
  basketComposition: BasketItem[];
  categoryBreakdown: CategoryBreakdown[];
  dataSource: string;
  recordCount: number;
}

// Time period options
const TIME_PERIODS = [
  { value: "1m", label: "1M", fullLabel: "1 Month" },
  { value: "3m", label: "3M", fullLabel: "3 Months" },
  { value: "6m", label: "6M", fullLabel: "6 Months" },
  { value: "12m", label: "12M", fullLabel: "12 Months" },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function InflationPage() {
  const { status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<InflationData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("12m");
  const [selectedRegion, setSelectedRegion] = useState("ALL");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);
  
  const fetchInflation = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/inflation?period=${selectedPeriod}&region=${selectedRegion}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result);
        setLastUpdate(new Date());
      } else {
        setError(result.error || "Failed to load inflation data");
      }
    } catch (err) {
      setError("Failed to connect to inflation service");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedRegion]);
  
  useEffect(() => {
    if (status === "authenticated") {
      fetchInflation();
    }
  }, [status, fetchInflation]);
  
  const formatPercent = (value: number, showSign: boolean = true): string => {
    const sign = showSign && value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };
  
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };
  
  const exportData = () => {
    if (!data) return;
    
    const csvContent = [
      ["Month", "NaijaMarket Rate (%)", "NBS Rate (%)", "Difference (%)"].join(","),
      ...data.monthlyTrend.map(m => 
        [m.monthName, m.naijaMarketRate, m.nbsRate ?? "N/A", m.difference ?? "N/A"].join(",")
      ),
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `naija-inflation-${selectedPeriod}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  if (status === "loading" || (loading && !data)) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Calculating inflation metrics...</p>
        </div>
      </div>
    );
  }
  
  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetchInflation} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  const currentPeriod = TIME_PERIODS.find(p => p.value === selectedPeriod);
  const inflation = data?.currentInflation;
  const nbs = data?.nbsComparison;
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-6 h-6 text-orange-400" />
              <h1 className="text-2xl md:text-3xl font-bold">Inflation Tracker</h1>
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">ECST</span>
            </div>
            <p className="text-gray-400 text-sm">
              {currentPeriod?.fullLabel} analysis • {data?.dataSource} • Updated {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {/* Time Period Tabs */}
            <div className="flex bg-[#1a1a1a] border border-gray-700 rounded-lg p-1">
              {TIME_PERIODS.map((period) => (
                <button
                  key={period.value}
                  onClick={() => setSelectedPeriod(period.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    selectedPeriod === period.value
                      ? "bg-orange-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
            
            {/* Region Filter */}
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="ALL">All Regions</option>
              <option value="SW">South West</option>
              <option value="SE">South East</option>
              <option value="NC">North Central</option>
              <option value="NW">North West</option>
              <option value="NE">North East</option>
              <option value="SS">South South</option>
            </select>
            
            {/* Export Button */}
            <button
              onClick={exportData}
              className="p-2 bg-[#1a1a1a] border border-gray-700 rounded-lg hover:bg-[#252525]"
              title="Export CSV"
            >
              <Download className="w-5 h-5" />
            </button>
            
            {/* Refresh Button */}
            <button
              onClick={fetchInflation}
              disabled={loading}
              className="p-2 bg-[#1a1a1a] border border-gray-700 rounded-lg hover:bg-[#252525] disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Current Inflation Hero */}
      <div className="bg-gradient-to-br from-orange-900/30 to-red-900/20 border border-orange-700/50 rounded-xl p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-gray-400 text-sm">NaijaMarket Food Inflation (YoY)</p>
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {inflation?.asOf}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl md:text-6xl font-bold text-white">{inflation?.rate ?? 0}%</span>
              <div className={`flex items-center gap-1 text-xl font-medium ${
                (inflation?.trend ?? "stable") === "up" ? "text-red-400" :
                (inflation?.trend ?? "stable") === "down" ? "text-emerald-400" : "text-gray-400"
              }`}>
                {inflation?.trend === "up" ? <TrendingUp className="w-5 h-5" /> :
                 inflation?.trend === "down" ? <TrendingDown className="w-5 h-5" /> :
                 <Minus className="w-5 h-5" />}
                {formatPercent(inflation?.monthOverMonth ?? 0)} MoM
              </div>
            </div>
            <p className="text-gray-500 text-sm mt-2">
              Year-over-year change in food prices across Nigerian markets
            </p>
          </div>
          
          {/* NBS Comparison */}
          <div className="bg-[#1a1a1a]/50 rounded-xl p-4 min-w-[280px]">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="w-5 h-5 text-blue-400" />
              <p className="text-sm font-medium">vs NBS Official Data</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-gray-500">NaijaMarket</p>
                <p className="text-2xl font-bold text-orange-400">{nbs?.naijaMarket ?? 0}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">NBS Official</p>
                <p className="text-2xl font-bold text-blue-400">{nbs?.nbs ?? 0}%</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 p-2 rounded-lg ${
              (nbs?.difference ?? 0) > 0 ? "bg-red-900/30" : 
              (nbs?.difference ?? 0) < 0 ? "bg-emerald-900/30" : "bg-gray-800"
            }`}>
              <Info className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-300">
                {(nbs?.difference ?? 0) > 0 ? "+" : ""}{nbs?.difference ?? 0}% difference
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Monthly Trend Chart */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-400" />
            <h3 className="font-semibold">Monthly Inflation Trend</h3>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-gray-400">NaijaMarket</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-gray-400">NBS Official</span>
            </div>
          </div>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data?.monthlyTrend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="monthName" 
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={{ stroke: "#4b5563" }}
              />
              <YAxis 
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={{ stroke: "#4b5563" }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: "8px" }}
                labelStyle={{ color: "#fff" }}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(1)}%`,
                  name === "naijaMarketRate" ? "NaijaMarket" : "NBS Official"
                ]}
              />
              <Legend />
              <ReferenceLine y={30} stroke="#666" strokeDasharray="5 5" label={{ value: "30%", fill: "#666", fontSize: 10 }} />
              <Area
                type="monotone"
                dataKey="naijaMarketRate"
                fill="#f97316"
                fillOpacity={0.2}
                stroke="#f97316"
                strokeWidth={2}
                name="NaijaMarket"
              />
              <Line
                type="monotone"
                dataKey="nbsRate"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: "#3b82f6", strokeWidth: 0, r: 3 }}
                name="NBS Official"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Top Inflators & Deflators */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Top Inflators */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold">Top Inflators</h3>
            <span className="text-xs text-gray-500">(Price Increases)</span>
          </div>
          <div className="space-y-2">
            {(data?.topInflators ?? []).slice(0, 6).map((item, idx) => (
              <div 
                key={item.item} 
                className="flex items-center justify-between p-3 bg-[#252525] rounded-lg hover:bg-[#2a2a2a] cursor-pointer transition-colors"
                onClick={() => router.push(`/dashboard/prices?item=${encodeURIComponent(item.item)}`)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-red-400/50 w-6">{idx + 1}</span>
                  <div>
                    <p className="font-medium text-sm">{item.item}</p>
                    <p className="text-xs text-gray-500">{item.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-400 flex items-center gap-1">
                    <ArrowUp className="w-4 h-4" />
                    {formatPercent(item.inflationRate)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatPrice(item.previousPrice)} → {formatPrice(item.currentPrice)}
                  </p>
                </div>
              </div>
            ))}
            {(data?.topInflators ?? []).length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">No inflators in this period</p>
            )}
          </div>
        </div>
        
        {/* Top Deflators */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Snowflake className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold">Top Deflators</h3>
            <span className="text-xs text-gray-500">(Price Decreases)</span>
          </div>
          <div className="space-y-2">
            {(data?.topDeflators ?? []).slice(0, 6).map((item, idx) => (
              <div 
                key={item.item} 
                className="flex items-center justify-between p-3 bg-[#252525] rounded-lg hover:bg-[#2a2a2a] cursor-pointer transition-colors"
                onClick={() => router.push(`/dashboard/prices?item=${encodeURIComponent(item.item)}`)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-emerald-400/50 w-6">{idx + 1}</span>
                  <div>
                    <p className="font-medium text-sm">{item.item}</p>
                    <p className="text-xs text-gray-500">{item.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-400 flex items-center gap-1">
                    <ArrowDown className="w-4 h-4" />
                    {formatPercent(item.inflationRate)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatPrice(item.previousPrice)} → {formatPrice(item.currentPrice)}
                  </p>
                </div>
              </div>
            ))}
            {(data?.topDeflators ?? []).length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">No deflators in this period</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Regional Breakdown & Category Breakdown */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Regional Breakdown */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Globe2 className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold">Regional Inflation</h3>
          </div>
          <div className="space-y-3">
            {(data?.regionalBreakdown ?? []).map((region) => (
              <div 
                key={region.region} 
                className="flex items-center justify-between p-3 bg-[#252525] rounded-lg hover:bg-[#2a2a2a] cursor-pointer transition-colors"
                onClick={() => setSelectedRegion(region.region)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                    region.inflationRate > 35 ? "bg-red-900/50 text-red-400" :
                    region.inflationRate < 25 ? "bg-emerald-900/50 text-emerald-400" :
                    "bg-orange-900/50 text-orange-400"
                  }`}>
                    {region.region}
                  </div>
                  <div>
                    <p className="font-medium">{region.regionName}</p>
                    <p className="text-xs text-gray-500">{region.marketCount} markets</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${
                    region.inflationRate > 35 ? "text-red-400" :
                    region.inflationRate < 25 ? "text-emerald-400" : "text-orange-400"
                  }`}>
                    {formatPercent(region.inflationRate, false)}
                  </p>
                  <p className={`text-xs flex items-center justify-end gap-1 ${
                    region.monthOverMonth > 0 ? "text-red-400" : "text-emerald-400"
                  }`}>
                    {region.trend === "up" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {formatPercent(region.monthOverMonth)} MoM
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Category Breakdown */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold">Category Breakdown</h3>
          </div>
          <div className="space-y-3">
            {(data?.categoryBreakdown ?? []).map((cat) => (
              <div key={cat.category} className="p-3 bg-[#252525] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">{cat.category}</p>
                  <p className={`font-bold ${
                    cat.inflationRate > 30 ? "text-red-400" :
                    cat.inflationRate < 20 ? "text-emerald-400" : "text-orange-400"
                  }`}>
                    {formatPercent(cat.inflationRate, false)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        cat.inflationRate > 30 ? "bg-red-500" :
                        cat.inflationRate < 20 ? "bg-emerald-500" : "bg-orange-500"
                      }`}
                      style={{ width: `${Math.min(cat.weight, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-12">{cat.weight}% wt</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Contribution: {formatPercent(cat.contribution)} to overall inflation
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* NFPI Basket Composition */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingBasket className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold">NFPI Basket Composition</h3>
          </div>
          <p className="text-xs text-gray-500">13 items • 100% weight</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Item</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Category</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Weight</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Current</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">YoY Ago</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Inflation</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {(data?.basketComposition ?? []).map((item) => (
                <tr key={item.item} className="border-b border-gray-800 hover:bg-[#252525]">
                  <td className="py-2 px-3 font-medium">{item.item}</td>
                  <td className="py-2 px-3 text-gray-400">{item.category}</td>
                  <td className="py-2 px-3 text-right">{item.weight}%</td>
                  <td className="py-2 px-3 text-right">{formatPrice(item.currentPrice)}</td>
                  <td className="py-2 px-3 text-right text-gray-500">{formatPrice(item.previousPrice)}</td>
                  <td className={`py-2 px-3 text-right font-medium ${
                    item.inflationRate > 30 ? "text-red-400" :
                    item.inflationRate < 0 ? "text-emerald-400" : "text-orange-400"
                  }`}>
                    {formatPercent(item.inflationRate)}
                  </td>
                  <td className={`py-2 px-3 text-right ${
                    item.contribution > 0 ? "text-red-400" : "text-emerald-400"
                  }`}>
                    {formatPercent(item.contribution)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* NBS Interpretation */}
      <div className="bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-700/50 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-300 mb-1">NBS Comparison Analysis</p>
            <p className="text-sm text-gray-300">{nbs?.interpretation}</p>
            <p className="text-xs text-gray-500 mt-2">
              NBS = National Bureau of Statistics official monthly food inflation data
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="text-center text-sm text-gray-500">
        <p>Data Source: {data?.dataSource} • {(data?.recordCount ?? 0).toLocaleString()} records analyzed</p>
        <p className="mt-1">Period: {currentPeriod?.fullLabel} • Last Updated: {lastUpdate.toLocaleString()}</p>
      </div>
    </div>
  );
}
