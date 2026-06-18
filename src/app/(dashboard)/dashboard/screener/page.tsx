"use client";

// ============================================================================
// src/app/(dashboard)/dashboard/screener/page.tsx
// NaijaMarket Intel - Commodity Screener Page
// Bloomberg Equivalent: EQS <GO> (Equity Screener)
// Version: 1.0.0
// Date: 2026-01-25
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Filter,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Download,
  Lock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  SlidersHorizontal,
  X,
  ArrowUpDown,
} from "lucide-react";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ScreenerResult {
  item: string;
  itemId: string;
  category: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  priceSpread: number;
  dayChange: number;
  dayChangePercent: number;
  weekChange: number;
  monthChange: number;
  trend: "up" | "down" | "stable";
  volatility: number;
  marketCount: number;
  topMarket: { name: string; price: number };
  bottomMarket: { name: string; price: number };
  signal: "buy" | "sell" | "hold";
  signalStrength: number;
}

interface TierLimits {
  tier: string;
  maxResults: number;
  advancedFilters: boolean;
  savePresets: boolean;
  canExport: boolean;
}

interface ScreenerData {
  success: boolean;
  timestamp: string;
  summary: {
    totalMatches: number;
    returned: number;
    avgChange: number;
    topGainer: { item: string; change: number } | null;
    topLoser: { item: string; change: number } | null;
  };
  results: ScreenerResult[];
  availableFilters: {
    categories: string[];
    regions: { code: string; name: string }[];
    states: string[];
    markets: string[];
  };
  tierLimits: TierLimits;
  dataSource: string;
  recordCount: number;
}

interface Filters {
  categories: string[];
  regions: string[];
  trend: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  priceMin: string;
  priceMax: string;
  changeMin: string;
  changeMax: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ScreenerPage() {
  const { status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ScreenerData | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    categories: [],
    regions: [],
    trend: "all",
    sortBy: "change",
    sortOrder: "desc",
    priceMin: "",
    priceMax: "",
    changeMin: "",
    changeMax: "",
  });
  
  const userTier = "GOLD";
  
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);
  
  const fetchScreenerData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.set("tier", userTier);
      if (filters.categories.length) params.set("categories", filters.categories.join(","));
      if (filters.regions.length) params.set("regions", filters.regions.join(","));
      if (filters.trend !== "all") params.set("trend", filters.trend);
      params.set("sortBy", filters.sortBy);
      params.set("sortOrder", filters.sortOrder);
      if (filters.priceMin) params.set("priceMin", filters.priceMin);
      if (filters.priceMax) params.set("priceMax", filters.priceMax);
      if (filters.changeMin) params.set("changeMin", filters.changeMin);
      if (filters.changeMax) params.set("changeMax", filters.changeMax);
      
      const response = await fetch(`/api/screener?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      } else {
        setError(result.error || "Failed to load screener data");
      }
    } catch (err) {
      setError("Failed to connect to screener service");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters, userTier]);
  
  useEffect(() => {
    if (status === "authenticated") {
      fetchScreenerData();
    }
  }, [status, fetchScreenerData]);
  
  const toggleCategory = (category: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category],
    }));
  };
  
  const toggleRegion = (region: string) => {
    setFilters(prev => ({
      ...prev,
      regions: prev.regions.includes(region)
        ? prev.regions.filter(r => r !== region)
        : [...prev.regions, region],
    }));
  };
  
  const clearFilters = () => {
    setFilters({
      categories: [],
      regions: [],
      trend: "all",
      sortBy: "change",
      sortOrder: "desc",
      priceMin: "",
      priceMax: "",
      changeMin: "",
      changeMax: "",
    });
  };
  
  const handleSort = (column: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === "desc" ? "asc" : "desc",
    }));
  };
  
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };
  
  const formatPercent = (value: number): string => {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };
  
  const handleExport = () => {
    if (!data || !data.tierLimits.canExport) {
      setError("Export available for GOLD tier and above");
      return;
    }
    
    let csv = "COMMODITY SCREENER - NAIJAMARKET INTEL\n";
    csv += `Generated: ${new Date().toLocaleString()}\n\n`;
    csv += "Item,Category,Avg Price,Min Price,Max Price,Spread %,Day Change %,Week Change %,Month Change %,Volatility,Signal,Markets\n";
    
    data.results.forEach(r => {
      csv += `${r.item},${r.category},${r.avgPrice},${r.minPrice},${r.maxPrice},${r.priceSpread},${r.dayChangePercent},${r.weekChange},${r.monthChange},${r.volatility},${r.signal.toUpperCase()},${r.marketCount}\n`;
    });
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `screener_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const getSignalColor = (signal: string) => {
    switch (signal) {
      case "buy": return "bg-emerald-900/50 text-emerald-400 border-emerald-700";
      case "sell": return "bg-red-900/50 text-red-400 border-red-700";
      default: return "bg-gray-700 text-gray-400 border-gray-600";
    }
  };
  
  if (status === "loading" || (loading && !data)) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading screener...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Filter className="w-6 h-6 text-purple-400" />
              <h1 className="text-2xl md:text-3xl font-bold">Commodity Screener</h1>
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">EQS</span>
            </div>
            <p className="text-gray-400 text-sm">
              Filter and analyze commodities across Nigerian markets
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg hover:bg-[#252525]"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            <button
              onClick={handleExport}
              disabled={!data?.tierLimits.canExport}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                data?.tierLimits.canExport
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-gray-700 cursor-not-allowed"
              }`}
            >
              {data?.tierLimits.canExport ? <Download className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              Export
            </button>
            
            <button
              onClick={fetchScreenerData}
              disabled={loading}
              className="p-2 bg-[#1a1a1a] border border-gray-700 rounded-lg hover:bg-[#252525]"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">×</button>
        </div>
      )}
      
      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Filter className="w-4 h-4 text-purple-400" />
              Filter Criteria
            </h3>
            <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
              <X className="w-3 h-3" />
              Clear All
            </button>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Categories */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Categories</label>
              <div className="flex flex-wrap gap-2">
                {data?.availableFilters.categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`px-2 py-1 text-xs rounded-lg transition-all ${
                      filters.categories.includes(cat)
                        ? "bg-purple-600 text-white"
                        : "bg-[#252525] text-gray-400 hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Regions */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Regions</label>
              <div className="flex flex-wrap gap-2">
                {data?.availableFilters.regions.map(region => (
                  <button
                    key={region.code}
                    onClick={() => toggleRegion(region.code)}
                    className={`px-2 py-1 text-xs rounded-lg transition-all ${
                      filters.regions.includes(region.code)
                        ? "bg-blue-600 text-white"
                        : "bg-[#252525] text-gray-400 hover:text-white"
                    }`}
                  >
                    {region.code}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Trend */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Trend</label>
              <select
                value={filters.trend}
                onChange={(e) => setFilters(prev => ({ ...prev, trend: e.target.value }))}
                className="w-full px-3 py-2 bg-[#252525] border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Trends</option>
                <option value="up">📈 Rising</option>
                <option value="down">📉 Falling</option>
                <option value="stable">➡️ Stable</option>
              </select>
            </div>
            
            {/* Sort */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                className="w-full px-3 py-2 bg-[#252525] border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="change">Day Change %</option>
                <option value="weekChange">Week Change %</option>
                <option value="monthChange">Month Change %</option>
                <option value="price">Avg Price</option>
                <option value="volatility">Volatility</option>
                <option value="spread">Price Spread</option>
                <option value="signal">Signal Strength</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>
          </div>
          
          {/* Advanced Filters */}
          {data?.tierLimits.advancedFilters && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-400 mb-3">Advanced Filters</p>
              <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Min Price (₦)</label>
                  <input
                    type="number"
                    value={filters.priceMin}
                    onChange={(e) => setFilters(prev => ({ ...prev, priceMin: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-[#252525] border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Max Price (₦)</label>
                  <input
                    type="number"
                    value={filters.priceMax}
                    onChange={(e) => setFilters(prev => ({ ...prev, priceMax: e.target.value }))}
                    placeholder="∞"
                    className="w-full px-3 py-2 bg-[#252525] border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Min Change (%)</label>
                  <input
                    type="number"
                    value={filters.changeMin}
                    onChange={(e) => setFilters(prev => ({ ...prev, changeMin: e.target.value }))}
                    placeholder="-100"
                    className="w-full px-3 py-2 bg-[#252525] border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Max Change (%)</label>
                  <input
                    type="number"
                    value={filters.changeMax}
                    onChange={(e) => setFilters(prev => ({ ...prev, changeMax: e.target.value }))}
                    placeholder="100"
                    className="w-full px-3 py-2 bg-[#252525] border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={fetchScreenerData}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Apply Filters
            </button>
          </div>
        </div>
      )}
      
      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Total Matches</p>
            <p className="text-2xl font-bold text-white">{data.summary.totalMatches}</p>
            <p className="text-xs text-gray-500">Showing {data.summary.returned}</p>
          </div>
          
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Avg Change</p>
            <p className={`text-2xl font-bold ${
              data.summary.avgChange > 0 ? "text-emerald-400" : 
              data.summary.avgChange < 0 ? "text-red-400" : "text-gray-400"
            }`}>
              {formatPercent(data.summary.avgChange)}
            </p>
          </div>
          
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Top Gainer</p>
            <p className="text-lg font-bold text-emerald-400 truncate">
              {data.summary.topGainer?.item.split(" ")[0] ?? "N/A"}
            </p>
            <p className="text-xs text-emerald-400">
              {data.summary.topGainer ? formatPercent(data.summary.topGainer.change) : ""}
            </p>
          </div>
          
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Top Loser</p>
            <p className="text-lg font-bold text-red-400 truncate">
              {data.summary.topLoser?.item.split(" ")[0] ?? "N/A"}
            </p>
            <p className="text-xs text-red-400">
              {data.summary.topLoser ? formatPercent(data.summary.topLoser.change) : ""}
            </p>
          </div>
        </div>
      )}
      
      {/* Results Table */}
      {data && (
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="overflow-x-auto rounded-lg">
            <table className="w-full">
              <thead className="bg-[#252525] border-b border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                    <button onClick={() => handleSort("name")} className="flex items-center gap-1 hover:text-white">
                      Commodity
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Category</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">
                    <button onClick={() => handleSort("price")} className="flex items-center gap-1 ml-auto hover:text-white">
                      Avg Price
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">
                    <button onClick={() => handleSort("change")} className="flex items-center gap-1 ml-auto hover:text-white">
                      Day %
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-400 hidden md:table-cell">
                    <button onClick={() => handleSort("weekChange")} className="flex items-center gap-1 ml-auto hover:text-white">
                      Week %
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-400 hidden lg:table-cell">
                    <button onClick={() => handleSort("volatility")} className="flex items-center gap-1 ml-auto hover:text-white">
                      Volatility
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">Signal</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-400 hidden md:table-cell">Markets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.results.map((result) => (
                  <tr
                    key={result.itemId}
                    className="hover:bg-[#252525] cursor-pointer transition-colors"
                    onClick={() => router.push(`/dashboard/prices?item=${encodeURIComponent(result.item)}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {result.trend === "up" ? (
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                        ) : result.trend === "down" ? (
                          <TrendingDown className="w-4 h-4 text-red-400" />
                        ) : (
                          <Minus className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="font-medium">{result.item}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-[#252525] text-xs rounded text-gray-400">
                        {result.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatPrice(result.avgPrice)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      result.dayChangePercent > 0 ? "text-emerald-400" :
                      result.dayChangePercent < 0 ? "text-red-400" : "text-gray-400"
                    }`}>
                      {formatPercent(result.dayChangePercent)}
                    </td>
                    <td className={`px-4 py-3 text-right hidden md:table-cell ${
                      result.weekChange > 0 ? "text-emerald-400" :
                      result.weekChange < 0 ? "text-red-400" : "text-gray-400"
                    }`}>
                      {formatPercent(result.weekChange)}
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              result.volatility > 15 ? "bg-red-500" :
                              result.volatility > 8 ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(100, result.volatility * 5)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-10">{result.volatility}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-lg border ${getSignalColor(result.signal)}`}>
                        {result.signal.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span className="text-gray-400">{result.marketCount}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          
          {data.results.length === 0 && (
            <div className="p-12 text-center">
              <Filter className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">No commodities match your filters</p>
              <button onClick={clearFilters} className="mt-2 text-purple-400 hover:text-purple-300 text-sm">
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Tier Limit Notice */}
      {data && data.summary.totalMatches > data.summary.returned && (
        <div className="mt-4 p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-amber-400" />
            <p className="text-amber-200">
              Showing {data.summary.returned} of {data.summary.totalMatches} matches.
              <span className="text-amber-400"> Upgrade for more results.</span>
            </p>
          </div>
          <button onClick={() => router.push("/subscribe")} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">
            Upgrade
          </button>
        </div>
      )}
      
      {/* Footer */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>Data Source: {data?.dataSource ?? "Loading..."} • {data?.recordCount ?? 0} records analyzed</p>
      </div>
    </div>
  );
}
