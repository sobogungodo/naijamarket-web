"use client";

// ============================================================================
// src/app/(dashboard)/dashboard/inflation/page.tsx
// NaijaMarket Intel - Inflation Tracker Page
// Bloomberg Equivalent: ECST <GO> (Economic Statistics)
// Version: 1.0.0
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
  Download,
  Lock,
  Info,
  Activity,
  MapPin,
  BarChart3,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Scale,
  Building2,
  Flame,
  Snowflake,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface MonthlyInflation {
  month: string;
  monthName: string;
  year: number;
  inflationRate: number;
  nbsRate: number | null;
  difference: number | null;
  avgPrice: number;
  prevAvgPrice: number;
}

interface RegionalInflation {
  region: string;
  regionName: string;
  inflationRate: number;
  change: number;
  trend: "up" | "down" | "stable";
  markets: string[];
}

interface ItemInflation {
  item: string;
  currentPrice: number;
  previousPrice: number;
  inflationRate: number;
  change30d: number;
  trend: "up" | "down" | "stable";
}

interface TierLimits {
  tier: string;
  monthsBack: number;
  showRegional: boolean;
  showNBSComparison: boolean;
  canExport: boolean;
}

interface InflationData {
  success: boolean;
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
  } | null;
  topInflators: ItemInflation[];
  topDeflators: ItemInflation[];
  basketComposition: {
    item: string;
    weight: number;
    contribution: number;
  }[];
  tierLimits: TierLimits;
  dataSource: string;
  lastUpdated: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function InflationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inflationData, setInflationData] = useState<InflationData | null>(null);
  const [activeTab, setActiveTab] = useState<"trend" | "regional" | "basket">("trend");
  
  const userTier = (session?.user as { tier?: string })?.tier || "FREE";
  
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);
  
  const fetchInflation = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/inflation?tier=${userTier}`);
      const data = await response.json();
      
      if (data.success) {
        setInflationData(data);
      } else {
        setError(data.error || "Failed to load inflation data");
      }
    } catch (err) {
      setError("Failed to connect to inflation service");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userTier]);
  
  useEffect(() => {
    if (status === "authenticated") {
      fetchInflation();
    }
  }, [status, fetchInflation]);
  
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };
  
  const formatPercent = (value: number, showSign: boolean = true): string => {
    const sign = showSign && value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };
  
  const handleExport = () => {
    if (!inflationData?.tierLimits?.canExport) {
      alert("Export is available for GOLD tier and above. Please upgrade your subscription.");
      return;
    }
    
    let csv = "Month,Year,Inflation Rate,NBS Rate,Difference,Avg Price\n";
    inflationData.monthlyTrend.forEach(m => {
      csv += `${m.monthName},${m.year},${m.inflationRate}%,${m.nbsRate ?? "N/A"},${m.difference ?? "N/A"},${m.avgPrice}\n`;
    });
    
    csv += "\nTop Inflators\nItem,Current Price,Previous Price,Inflation Rate\n";
    inflationData.topInflators.forEach(i => {
      csv += `${i.item},${i.currentPrice},${i.previousPrice},${i.inflationRate}%\n`;
    });
    
    csv += "\nTop Deflators\nItem,Current Price,Previous Price,Inflation Rate\n";
    inflationData.topDeflators.forEach(d => {
      csv += `${d.item},${d.currentPrice},${d.previousPrice},${d.inflationRate}%\n`;
    });
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inflation_tracker_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const getTrendChartData = () => {
    if (!inflationData) return [];
    return [...inflationData.monthlyTrend].reverse().map(m => ({
      name: `${m.monthName.slice(0, 3)} '${String(m.year).slice(2)}`,
      naijaMarket: m.inflationRate,
      nbs: m.nbsRate,
      difference: m.difference,
    }));
  };
  
  const getRegionalChartData = () => {
    if (!inflationData) return [];
    return inflationData.regionalBreakdown.map(r => ({
      name: r.region,
      fullName: r.regionName,
      rate: r.inflationRate,
      change: r.change,
      fill: r.inflationRate > 35 ? "#ef4444" : r.inflationRate > 30 ? "#f59e0b" : "#10b981",
    }));
  };
  
  if (status === "loading" || (loading && !inflationData)) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading inflation data...</p>
        </div>
      </div>
    );
  }
  
  if (error && !inflationData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchInflation}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  const tierLimits = inflationData?.tierLimits;
  const canExport = tierLimits?.canExport ?? false;
  const showRegional = tierLimits?.showRegional ?? false;
  const showNBSComparison = tierLimits?.showNBSComparison ?? false;
  const tierName = tierLimits?.tier ?? "FREE";
  const currentInflation = inflationData?.currentInflation;
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-6 h-6 text-red-400" />
              <h1 className="text-2xl md:text-3xl font-bold">Inflation Tracker</h1>
              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                ECST
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              Real-time food inflation tracking vs NBS official data
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={fetchInflation}
              disabled={loading}
              className="p-2 bg-[#1a1a1a] border border-gray-700 rounded-lg hover:bg-[#252525] disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
            
            <button
              onClick={handleExport}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                canExport
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-gray-700 cursor-not-allowed"
              }`}
            >
              {canExport ? (
                <Download className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              Export
            </button>
          </div>
        </div>
        
        {/* Tier Banner for FREE/SILVER */}
        {["FREE", "SILVER"].includes(tierName) && (
          <div className="mt-4 bg-gradient-to-r from-red-900/30 to-orange-800/20 border border-red-700/50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-red-200 font-medium">
                  Limited Data ({tierLimits?.monthsBack ?? 3} months)
                </p>
                <p className="text-red-400/70 text-sm">
                  Upgrade to GOLD for NBS comparison & regional breakdown
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/subscribe")}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 whitespace-nowrap"
            >
              Upgrade Now
            </button>
          </div>
        )}
      </div>
      
      {/* Main Inflation Card */}
      <div className="bg-gradient-to-br from-red-900/30 to-orange-900/20 border border-red-700/50 rounded-xl p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-gray-400 text-sm mb-2">NaijaFood Inflation Rate (YoY)</p>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl md:text-6xl font-bold text-white">
                {currentInflation?.rate ?? 0}%
              </span>
              <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                (currentInflation?.trend ?? "stable") === "up" 
                  ? "bg-red-500/20 text-red-400" 
                  : (currentInflation?.trend ?? "stable") === "down"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-gray-500/20 text-gray-400"
              }`}>
                {currentInflation?.trend === "up" ? (
                  <TrendingUp className="w-4 h-4" />
                ) : currentInflation?.trend === "down" ? (
                  <TrendingDown className="w-4 h-4" />
                ) : (
                  <Minus className="w-4 h-4" />
                )}
                {formatPercent(currentInflation?.monthOverMonth ?? 0)} MoM
              </div>
            </div>
            <p className="text-gray-500 text-sm mt-2">
              As of {currentInflation?.asOf ?? "N/A"}
            </p>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#1a1a1a]/50 rounded-lg p-4">
              <p className="text-gray-400 text-xs mb-1">Month-over-Month</p>
              <p className={`text-xl font-bold ${
                (currentInflation?.monthOverMonth ?? 0) > 0 ? "text-red-400" : "text-emerald-400"
              }`}>
                {formatPercent(currentInflation?.monthOverMonth ?? 0)}
              </p>
            </div>
            <div className="bg-[#1a1a1a]/50 rounded-lg p-4">
              <p className="text-gray-400 text-xs mb-1">Year-over-Year</p>
              <p className={`text-xl font-bold ${
                (currentInflation?.yearOverYear ?? 0) > 0 ? "text-red-400" : "text-emerald-400"
              }`}>
                {formatPercent(currentInflation?.yearOverYear ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* NBS Comparison Card (GOLD+) */}
      {showNBSComparison && inflationData?.nbsComparison && (
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 md:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold">NBS Comparison</h3>
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
              Official
            </span>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-2">NaijaMarket Intel</p>
              <p className="text-3xl font-bold text-white">
                {inflationData.nbsComparison.naijaMarket}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Crowdsourced Data</p>
            </div>
            
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-2">NBS Official</p>
              <p className="text-3xl font-bold text-blue-400">
                {inflationData.nbsComparison.nbs}%
              </p>
              <p className="text-xs text-gray-500 mt-1">National Bureau of Statistics</p>
            </div>
            
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-2">Difference</p>
              <p className={`text-3xl font-bold ${
                inflationData.nbsComparison.difference > 0 ? "text-red-400" : "text-emerald-400"
              }`}>
                {formatPercent(inflationData.nbsComparison.difference)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {inflationData.nbsComparison.difference > 0 ? "Higher" : "Lower"} than official
              </p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5" />
              <p className="text-sm text-blue-200">
                {inflationData.nbsComparison.interpretation}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab("trend")}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === "trend"
              ? "bg-red-600 text-white"
              : "bg-[#1a1a1a] text-gray-400 hover:text-white"
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Monthly Trend
        </button>
        <button
          onClick={() => setActiveTab("regional")}
          disabled={!showRegional}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === "regional"
              ? "bg-red-600 text-white"
              : showRegional
              ? "bg-[#1a1a1a] text-gray-400 hover:text-white"
              : "bg-[#1a1a1a] text-gray-600 cursor-not-allowed"
          }`}
        >
          <MapPin className="w-4 h-4 inline mr-2" />
          Regional
          {!showRegional && <Lock className="w-3 h-3 inline ml-1" />}
        </button>
        <button
          onClick={() => setActiveTab("basket")}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === "basket"
              ? "bg-red-600 text-white"
              : "bg-[#1a1a1a] text-gray-400 hover:text-white"
          }`}
        >
          <Scale className="w-4 h-4 inline mr-2" />
          Basket Analysis
        </button>
      </div>
      
      {/* Chart Section */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 md:p-6 mb-6">
        <div className="h-[400px]">
          {activeTab === "trend" && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={getTrendChartData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`${value}%`, ""]}
                />
                <Legend />
                <ReferenceLine y={30} stroke="#666" strokeDasharray="5 5" label={{ value: "30%", fill: "#666", fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="naijaMarket"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ fill: "#ef4444", strokeWidth: 2, r: 4 }}
                  name="NaijaMarket"
                />
                {showNBSComparison && (
                  <Line
                    type="monotone"
                    dataKey="nbs"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "#3b82f6", strokeWidth: 2, r: 3 }}
                    name="NBS Official"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
          
          {activeTab === "regional" && showRegional && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getRegionalChartData()} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" stroke="#666" tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" stroke="#666" width={50} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string, props: { payload: { fullName: string } }) => [
                    `${value}%`,
                    props.payload.fullName
                  ]}
                />
                <Bar dataKey="rate" name="Inflation Rate" radius={[0, 4, 4, 0]}>
                  {getRegionalChartData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          
          {activeTab === "basket" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inflationData?.basketComposition ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis 
                  dataKey="item" 
                  stroke="#666" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                  tick={{ fontSize: 11 }}
                />
                <YAxis stroke="#666" tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string) => [
                    `${value}%`,
                    name === "contribution" ? "Contribution" : "Weight"
                  ]}
                />
                <Legend />
                <Bar dataKey="weight" fill="#6366f1" name="Basket Weight" />
                <Bar dataKey="contribution" fill="#ef4444" name="Inflation Contribution" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      
      {/* Top Movers Grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Top Inflators */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-red-400" />
            <h3 className="text-lg font-semibold">Top Inflators (30d)</h3>
          </div>
          <div className="space-y-3">
            {(inflationData?.topInflators ?? []).map((item, idx) => (
              <div
                key={item.item}
                className="flex items-center justify-between p-3 bg-[#252525] rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center bg-red-900/50 text-red-400 rounded-full text-sm font-medium">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-medium">{item.item}</p>
                    <p className="text-xs text-gray-500">
                      {formatPrice(item.previousPrice)} → {formatPrice(item.currentPrice)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUp className="w-4 h-4 text-red-400" />
                  <span className="text-red-400 font-bold">
                    {formatPercent(item.inflationRate, false)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Top Deflators */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Snowflake className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold">Top Deflators (30d)</h3>
          </div>
          <div className="space-y-3">
            {(inflationData?.topDeflators ?? []).map((item, idx) => (
              <div
                key={item.item}
                className="flex items-center justify-between p-3 bg-[#252525] rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center bg-emerald-900/50 text-emerald-400 rounded-full text-sm font-medium">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-medium">{item.item}</p>
                    <p className="text-xs text-gray-500">
                      {formatPrice(item.previousPrice)} → {formatPrice(item.currentPrice)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowDown className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">
                    {formatPercent(item.inflationRate, false)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Regional Breakdown Table (SILVER+) */}
      {showRegional && (inflationData?.regionalBreakdown?.length ?? 0) > 0 && (
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 md:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold">Regional Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Region</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Inflation Rate</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Change</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Markets</th>
                </tr>
              </thead>
              <tbody>
                {(inflationData?.regionalBreakdown ?? []).map((region) => (
                  <tr key={region.region} className="border-b border-gray-800 hover:bg-[#252525]">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{region.regionName}</span>
                        <span className="text-xs text-gray-500">({region.region})</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-bold ${
                        region.inflationRate > 35 ? "text-red-400" : 
                        region.inflationRate > 30 ? "text-amber-400" : 
                        "text-emerald-400"
                      }`}>
                        {region.inflationRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className={`flex items-center justify-end gap-1 ${
                        region.change > 0 ? "text-red-400" : "text-emerald-400"
                      }`}>
                        {region.trend === "up" ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : region.trend === "down" ? (
                          <ArrowDown className="w-3 h-3" />
                        ) : (
                          <Minus className="w-3 h-3" />
                        )}
                        {formatPercent(region.change)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-sm">
                      {region.markets.slice(0, 3).join(", ")}
                      {region.markets.length > 3 && ` +${region.markets.length - 3}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Data Source Footer */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>
          Data Source: {inflationData?.dataSource ?? "N/A"} • Last Updated: {inflationData?.lastUpdated ?? "N/A"}
        </p>
        <p className="mt-1">
          Inflation calculated using a weighted basket of essential food commodities
        </p>
      </div>
    </div>
  );
}
