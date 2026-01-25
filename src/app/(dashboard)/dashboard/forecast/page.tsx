"use client";

// ============================================================================
// src/app/(dashboard)/dashboard/forecast/page.tsx
// NaijaMarket Intel - Seasonal Forecast Page
// Bloomberg Equivalent: ECFC <GO> (Economic Forecasts)
// Version: 1.0.0
// Date: 2026-01-25
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  Download,
  Lock,
  Info,
  Sparkles,
  ThermometerSun,
  CloudRain,
  Sun,
  Leaf,
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
  ComposedChart,
} from "recharts";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface SeasonalPattern {
  month: number;
  monthName: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  stdDev: number;
  priceIndex: number;
  yearOverYear: number[];
  trend: "up" | "down" | "stable";
  volatility: "low" | "medium" | "high";
}

interface Prediction {
  month: number;
  monthName: string;
  year: number;
  predictedPrice: number;
  confidenceLow: number;
  confidenceHigh: number;
  confidence: number;
  basis: string;
}

interface ForecastData {
  success: boolean;
  item: string;
  market: string;
  currentPrice: number;
  lastUpdated: string;
  seasonalPatterns: SeasonalPattern[];
  predictions: Prediction[];
  insights: {
    bestMonthToBuy: { month: string; savings: string; index: number };
    worstMonthToBuy: { month: string; premium: string; index: number };
    currentSeasonalPosition: string;
    priceDirection: "increasing" | "decreasing" | "stable";
    volatilityRating: "low" | "medium" | "high";
    annualRange: { min: number; max: number; spread: string };
  };
  historicalAccuracy: {
    lastYearPrediction: number;
    actualPrice: number;
    accuracy: number;
  };
  tierLimits: {
    tier: string;
    monthsBack: number;
    predictionMonths: number;
    canExport: boolean;
    showConfidence: boolean;
  };
  dataSource: string;
  yearsOfData: number;
}

interface CommodityItem {
  id: number;
  name: string;
  category: string;
  hasData: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Season icons for Nigerian climate
const getSeasonIcon = (month: number) => {
  // Nigeria has Dry (Nov-Mar) and Wet (Apr-Oct) seasons
  if (month >= 4 && month <= 10) {
    return <CloudRain className="w-4 h-4 text-blue-400" />;
  }
  return <Sun className="w-4 h-4 text-amber-400" />;
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function ForecastPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [items, setItems] = useState<CommodityItem[]>([]);
  const [selectedItem, setSelectedItem] = useState("Rice (50kg)");
  const [activeChart, setActiveChart] = useState<"seasonal" | "prediction" | "yearly">("seasonal");
  
  // Get user tier
  const userTier = (session?.user as { tier?: string })?.tier || "FREE";
  
  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);
  
  // Fetch available items
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch("/api/forecast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "getItems" }),
        });
        const data = await response.json();
        if (data.success) {
          setItems(data.items);
        }
      } catch (err) {
        console.error("Failed to fetch items:", err);
      }
    };
    fetchItems();
  }, []);
  
  // Fetch forecast data
  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        item: selectedItem,
        market: "All Markets",
        tier: userTier,
      });
      
      const response = await fetch(`/api/forecast?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setForecastData(data);
      } else {
        setError(data.error || "Failed to load forecast");
      }
    } catch (err) {
      setError("Failed to connect to forecast service");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedItem, userTier]);
  
  useEffect(() => {
    if (status === "authenticated") {
      fetchForecast();
    }
  }, [status, fetchForecast]);
  
  // Format currency
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };
  
  // Handle export
  const handleExport = () => {
    if (!forecastData?.tierLimits.canExport) {
      alert("Export is available for GOLD tier and above. Please upgrade your subscription.");
      return;
    }
    
    // Create CSV content
    let csv = "Month,Average Price,Min Price,Max Price,Price Index,Trend,Volatility\n";
    forecastData.seasonalPatterns.forEach(p => {
      csv += `${p.monthName},${p.avgPrice},${p.minPrice},${p.maxPrice},${p.priceIndex},${p.trend},${p.volatility}\n`;
    });
    
    csv += "\nPredictions\nMonth,Year,Predicted Price,Confidence Low,Confidence High,Confidence %\n";
    forecastData.predictions.forEach(p => {
      csv += `${p.monthName},${p.year},${p.predictedPrice},${p.confidenceLow},${p.confidenceHigh},${p.confidence}%\n`;
    });
    
    // Download
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forecast_${selectedItem.replace(/\s/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Prepare chart data
  const getSeasonalChartData = () => {
    if (!forecastData) return [];
    
    const currentMonth = new Date().getMonth() + 1;
    
    return forecastData.seasonalPatterns.map(p => ({
      name: MONTH_SHORT[p.month - 1],
      month: p.month,
      priceIndex: p.priceIndex,
      avgPrice: p.avgPrice,
      minPrice: p.minPrice,
      maxPrice: p.maxPrice,
      isCurrent: p.month === currentMonth,
      fill: p.priceIndex < 95 ? "#10b981" : p.priceIndex > 105 ? "#ef4444" : "#6366f1",
    }));
  };
  
  const getPredictionChartData = () => {
    if (!forecastData) return [];
    
    // Add current month as starting point
    const currentMonth = new Date().getMonth();
    const data = [{
      name: MONTH_SHORT[currentMonth],
      predicted: forecastData.currentPrice,
      confidenceLow: forecastData.currentPrice,
      confidenceHigh: forecastData.currentPrice,
      isActual: true,
    }];
    
    // Add predictions
    forecastData.predictions.forEach(p => {
      data.push({
        name: `${MONTH_SHORT[p.month - 1]} '${String(p.year).slice(2)}`,
        predicted: p.predictedPrice,
        confidenceLow: p.confidenceLow || p.predictedPrice * 0.9,
        confidenceHigh: p.confidenceHigh || p.predictedPrice * 1.1,
        isActual: false,
      });
    });
    
    return data;
  };
  
  // Loading state
  if (status === "loading" || (loading && !forecastData)) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading seasonal forecast...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error && !forecastData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchForecast}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  const currentMonth = new Date().getMonth() + 1;
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-6 h-6 text-amber-400" />
              <h1 className="text-2xl md:text-3xl font-bold">Seasonal Forecast</h1>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                ECFC
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              AI-powered price predictions based on {forecastData?.yearsOfData || 9} years of historical data
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Item Selector */}
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="bg-[#1a1a1a] border border-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              {items.map(item => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
            
            {/* Refresh */}
            <button
              onClick={fetchForecast}
              disabled={loading}
              className="p-2 bg-[#1a1a1a] border border-gray-700 rounded-lg hover:bg-[#252525] disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
            
            {/* Export */}
            <button
              onClick={handleExport}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                forecastData?.tierLimits.canExport
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-gray-700 cursor-not-allowed"
              }`}
            >
              {forecastData?.tierLimits.canExport ? (
                <Download className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              Export
            </button>
          </div>
        </div>
        
        {/* Tier Banner */}
        {forecastData?.tierLimits.tier && ["FREE", "SILVER"].includes(forecastData.tierLimits.tier) && (
          <div className="mt-4 bg-gradient-to-r from-amber-900/30 to-amber-800/20 border border-amber-700/50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-amber-200 font-medium">
                  Limited Forecast ({forecastData.tierLimits.predictionMonths} month{forecastData.tierLimits.predictionMonths > 1 ? "s" : ""} ahead)
                </p>
                <p className="text-amber-400/70 text-sm">
                  Upgrade to GOLD for 3-month forecasts with confidence intervals
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/subscribe")}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 whitespace-nowrap"
            >
              Upgrade Now
            </button>
          </div>
        )}
      </div>
      
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Current Price */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Current Price</span>
            <BarChart3 className="w-4 h-4 text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-white">
            {formatPrice(forecastData?.currentPrice || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Updated {forecastData?.lastUpdated}
          </p>
        </div>
        
        {/* Best Month to Buy */}
        <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 border border-emerald-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-emerald-400 text-sm">Best Month to Buy</span>
            <TrendingDown className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-300">
            {forecastData?.insights.bestMonthToBuy.month}
          </p>
          <p className="text-xs text-emerald-400 mt-1">
            Save {forecastData?.insights.bestMonthToBuy.savings} below average
          </p>
        </div>
        
        {/* Worst Month to Buy */}
        <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 border border-red-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-400 text-sm">Worst Month to Buy</span>
            <TrendingUp className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-300">
            {forecastData?.insights.worstMonthToBuy.month}
          </p>
          <p className="text-xs text-red-400 mt-1">
            {forecastData?.insights.worstMonthToBuy.premium} above average
          </p>
        </div>
        
        {/* Forecast Accuracy */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Model Accuracy</span>
            <Target className="w-4 h-4 text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-white">
            {forecastData?.historicalAccuracy.accuracy}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Based on last year&apos;s predictions
          </p>
        </div>
      </div>
      
      {/* Chart Section */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 md:p-6 mb-6">
        {/* Chart Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveChart("seasonal")}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
              activeChart === "seasonal"
                ? "bg-emerald-600 text-white"
                : "bg-[#252525] text-gray-400 hover:text-white"
            }`}
          >
            <Calendar className="w-4 h-4 inline mr-2" />
            Seasonal Pattern
          </button>
          <button
            onClick={() => setActiveChart("prediction")}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
              activeChart === "prediction"
                ? "bg-emerald-600 text-white"
                : "bg-[#252525] text-gray-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4 inline mr-2" />
            Price Forecast
          </button>
          <button
            onClick={() => setActiveChart("yearly")}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
              activeChart === "yearly"
                ? "bg-emerald-600 text-white"
                : "bg-[#252525] text-gray-400 hover:text-white"
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Price Range
          </button>
        </div>
        
        {/* Charts */}
        <div className="h-[400px]">
          {activeChart === "seasonal" && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={getSeasonalChartData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" domain={[80, 120]} tickFormatter={(v) => `${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "priceIndex") return [`${value} (${value < 100 ? "below" : value > 100 ? "above" : "at"} average)`, "Price Index"];
                    return [formatPrice(value), name];
                  }}
                />
                <Legend />
                <ReferenceLine y={100} stroke="#666" strokeDasharray="5 5" label={{ value: "Average", fill: "#666", fontSize: 12 }} />
                <Bar
                  dataKey="priceIndex"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  name="Price Index"
                />
                <Line
                  type="monotone"
                  dataKey="priceIndex"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (payload.isCurrent) {
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={8}
                          fill="#10b981"
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      );
                    }
                    return <circle cx={cx} cy={cy} r={4} fill="#10b981" />;
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
          
          {activeChart === "prediction" && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getPredictionChartData()}>
                <defs>
                  <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" tickFormatter={(v) => `₦${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [formatPrice(value), ""]}
                />
                <Legend />
                {forecastData?.tierLimits.showConfidence && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="confidenceHigh"
                      stroke="transparent"
                      fill="url(#confidenceGradient)"
                      name="Confidence High"
                    />
                    <Area
                      type="monotone"
                      dataKey="confidenceLow"
                      stroke="transparent"
                      fill="#0a0a0a"
                      name="Confidence Low"
                    />
                  </>
                )}
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: "#10b981", strokeWidth: 2, r: 6 }}
                  name="Predicted Price"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
          
          {activeChart === "yearly" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getSeasonalChartData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" tickFormatter={(v) => `₦${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [formatPrice(value), ""]}
                />
                <Legend />
                <Bar dataKey="minPrice" fill="#10b981" name="Min Price" stackId="range" />
                <Bar dataKey="avgPrice" fill="#6366f1" name="Avg Price" />
                <Bar dataKey="maxPrice" fill="#ef4444" name="Max Price" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        
        {/* Chart Legend/Info */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>Below Average (Good to Buy)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500" />
            <span>Average</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Above Average (Wait if Possible)</span>
          </div>
        </div>
      </div>
      
      {/* Insights Grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Monthly Breakdown */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 md:p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            Monthly Price Index
          </h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {forecastData?.seasonalPatterns.map((pattern) => (
              <div
                key={pattern.month}
                className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                  pattern.month === currentMonth
                    ? "bg-emerald-900/30 border border-emerald-700/50"
                    : "bg-[#252525] hover:bg-[#2a2a2a]"
                }`}
              >
                <div className="flex items-center gap-3">
                  {getSeasonIcon(pattern.month)}
                  <div>
                    <span className="font-medium">{pattern.monthName}</span>
                    {pattern.month === currentMonth && (
                      <span className="ml-2 text-xs text-emerald-400">(Current)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold">{formatPrice(pattern.avgPrice)}</p>
                    <p className="text-xs text-gray-500">
                      {formatPrice(pattern.minPrice)} - {formatPrice(pattern.maxPrice)}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${
                      pattern.priceIndex < 95
                        ? "bg-emerald-900/50 text-emerald-400"
                        : pattern.priceIndex > 105
                        ? "bg-red-900/50 text-red-400"
                        : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    {pattern.priceIndex < 100 ? (
                      <ArrowDown className="w-3 h-3" />
                    ) : pattern.priceIndex > 100 ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <Minus className="w-3 h-3" />
                    )}
                    {pattern.priceIndex}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Predictions */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 md:p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Price Predictions
          </h3>
          
          {forecastData?.predictions.length === 0 ? (
            <div className="text-center py-8">
              <Lock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No predictions available for your tier</p>
              <button
                onClick={() => router.push("/subscribe")}
                className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Upgrade for Predictions
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {forecastData?.predictions.map((pred, idx) => (
                <div
                  key={`${pred.month}-${pred.year}`}
                  className="bg-[#252525] rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">
                        {pred.monthName} {pred.year}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({idx + 1} month{idx > 0 ? "s" : ""} ahead)
                      </span>
                    </div>
                    {forecastData?.tierLimits.showConfidence && pred.confidence > 0 && (
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          pred.confidence >= 80
                            ? "bg-emerald-900/50 text-emerald-400"
                            : pred.confidence >= 60
                            ? "bg-amber-900/50 text-amber-400"
                            : "bg-red-900/50 text-red-400"
                        }`}
                      >
                        {pred.confidence}% confidence
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-bold text-emerald-400">
                      {formatPrice(pred.predictedPrice)}
                    </p>
                    {forecastData?.tierLimits.showConfidence && pred.confidenceLow > 0 && (
                      <p className="text-sm text-gray-400">
                        Range: {formatPrice(pred.confidenceLow)} - {formatPrice(pred.confidenceHigh)}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Basis: {pred.basis}
                  </p>
                </div>
              ))}
              
              {/* Show upgrade prompt if limited */}
              {forecastData?.tierLimits.predictionMonths < 6 && (
                <div className="mt-4 p-4 bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-700/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-indigo-400" />
                    <span className="text-indigo-300 font-medium">Want more predictions?</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">
                    BUSINESS tier gets 6-month forecasts with full confidence intervals
                  </p>
                  <button
                    onClick={() => router.push("/subscribe")}
                    className="text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    View upgrade options →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Market Insights Summary */}
      <div className="bg-gradient-to-r from-[#1a1a1a] to-[#1f1f1f] border border-gray-800 rounded-xl p-4 md:p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-emerald-400" />
          Market Intelligence Summary
        </h3>
        
        <div className="grid md:grid-cols-3 gap-6">
          {/* Current Position */}
          <div>
            <h4 className="text-sm text-gray-400 mb-2">Current Seasonal Position</h4>
            <div className="flex items-center gap-2">
              {forecastData?.insights.priceDirection === "increasing" ? (
                <TrendingUp className="w-5 h-5 text-red-400" />
              ) : forecastData?.insights.priceDirection === "decreasing" ? (
                <TrendingDown className="w-5 h-5 text-emerald-400" />
              ) : (
                <Minus className="w-5 h-5 text-gray-400" />
              )}
              <span className="text-lg">{forecastData?.insights.currentSeasonalPosition}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Prices are {forecastData?.insights.priceDirection} over the next 3 months
            </p>
          </div>
          
          {/* Volatility */}
          <div>
            <h4 className="text-sm text-gray-400 mb-2">Price Volatility</h4>
            <div className="flex items-center gap-2">
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  forecastData?.insights.volatilityRating === "low"
                    ? "bg-emerald-900/50 text-emerald-400"
                    : forecastData?.insights.volatilityRating === "high"
                    ? "bg-red-900/50 text-red-400"
                    : "bg-amber-900/50 text-amber-400"
                }`}
              >
                {forecastData?.insights.volatilityRating?.toUpperCase()}
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Annual spread: {forecastData?.insights.annualRange.spread}
            </p>
          </div>
          
          {/* Expected Range */}
          <div>
            <h4 className="text-sm text-gray-400 mb-2">Expected Annual Range</h4>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">{formatPrice(forecastData?.insights.annualRange.min || 0)}</span>
              <span className="text-gray-500">→</span>
              <span className="text-red-400">{formatPrice(forecastData?.insights.annualRange.max || 0)}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Based on historical seasonal patterns
            </p>
          </div>
        </div>
      </div>
      
      {/* Data Source Footer */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>
          Data Source: {forecastData?.dataSource} • {forecastData?.yearsOfData} years of historical data
        </p>
        <p className="mt-1">
          Forecasts are based on historical patterns and should not be considered financial advice
        </p>
      </div>
    </div>
  );
}
