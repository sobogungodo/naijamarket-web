"use client";

// ============================================================================
// src/app/(dashboard)/dashboard/snapshot/page.tsx
// NaijaFood Intel - Market Snapshot Page
// Bloomberg Equivalent: TOP <GO> (Market Overview)
// Version: 2.0.0 - With Time Period Tabs (24h, 7d, 30d)
// Date: 2026-01-25
// ============================================================================

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Activity,
  MapPin,
  Package,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Zap,
  Clock,
  Building2,
  Globe2,
  BarChart3,
  Radio,
  Eye,
  Calendar,
} from "lucide-react";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface MarketSummary {
  marketId: number;
  marketName: string;
  state: string;
  region: string;
  itemCount: number;
  avgPrice: number;
  avgChange: number;
  topGainer: { item: string; change: number } | null;
  topLoser: { item: string; change: number } | null;
  status: "active" | "limited" | "offline";
}

interface RegionSummary {
  region: string;
  regionName: string;
  marketCount: number;
  avgInflation: number;
  trend: "up" | "down" | "stable";
}

interface TopMover {
  rank: number;
  item: string;
  market: string;
  state: string;
  price: number;
  previousPrice: number;
  change: number;
  changePercent: number;
  trend: "up" | "down";
  unit: string;
}

interface SnapshotData {
  success: boolean;
  timestamp: string;
  period: string;
  periodLabel: string;
  summary: {
    totalMarkets: number;
    activeMarkets: number;
    totalItems: number;
    totalPricePoints: number;
    avgInflation: number;
    lastUpdateTime: string;
  };
  nfpiIndex: {
    value: number;
    change: number;
    changePercent: number;
    trend: "up" | "down" | "stable";
    baseline: number;
    asOf: string;
  };
  regionBreakdown: RegionSummary[];
  topGainers: TopMover[];
  topLosers: TopMover[];
  mostVolatile: TopMover[];
  marketSummaries: MarketSummary[];
  recentActivity: { type: string; description: string; time: string }[];
  dataSource: string;
  recordCount: number;
}

// Time period options
const TIME_PERIODS = [
  { value: "24h", label: "24H", fullLabel: "24 Hours" },
  { value: "7d", label: "7D", fullLabel: "7 Days" },
  { value: "30d", label: "30D", fullLabel: "30 Days" },
];

// ============================================================================
// COMPONENT (wrapped in Suspense for useSearchParams)
// ============================================================================

export default function SnapshotPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading market snapshot...</p>
        </div>
      </div>
    }>
      <SnapshotPageInner />
    </Suspense>
  );
}

function SnapshotPageInner() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Read URL params: ?market=Mile+12&region=SW&period=7d
  const urlMarket = searchParams.get("market") || "";
  const urlRegion = searchParams.get("region") || "ALL";
  const urlPeriod = searchParams.get("period") || "24h";
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshotData, setSnapshotData] = useState<SnapshotData | null>(null);
  const [selectedRegion, setSelectedRegion] = useState(urlRegion);
  const [selectedPeriod, setSelectedPeriod] = useState(urlPeriod);
  const [selectedMarket, setSelectedMarket] = useState(urlMarket);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);
  
  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      let url = `/api/snapshot?region=${selectedRegion}&period=${selectedPeriod}`;
      if (selectedMarket) url += `&market=${encodeURIComponent(selectedMarket)}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setSnapshotData(data);
        setLastUpdate(new Date());
      } else {
        setError(data.error || "Failed to load snapshot");
      }
    } catch (err) {
      setError("Failed to connect to snapshot service");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedRegion, selectedPeriod, selectedMarket]);
  
  useEffect(() => {
    if (status === "authenticated") {
      fetchSnapshot();
    }
  }, [status, fetchSnapshot]);
  
  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchSnapshot, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchSnapshot]);
  
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
  
  const formatChange = (change: number): string => {
    const sign = change > 0 ? "+" : "";
    return `${sign}${new Intl.NumberFormat("en-NG").format(change)}`;
  };
  
  if (status === "loading" || (loading && !snapshotData)) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading market snapshot...</p>
        </div>
      </div>
    );
  }
  
  if (error && !snapshotData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetchSnapshot} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  const summary = snapshotData?.summary;
  const nfpi = snapshotData?.nfpiIndex;
  const currentPeriod = TIME_PERIODS.find(p => p.value === selectedPeriod);
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Globe2 className="w-6 h-6 text-blue-400" />
              <h1 className="text-2xl md:text-3xl font-bold">Market Snapshot</h1>
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">TOP</span>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                <Radio className="w-3 h-3 animate-pulse" />
                LIVE
              </div>
            </div>
            <p className="text-gray-400 text-sm">
              {currentPeriod?.fullLabel} overview • Updated {lastUpdate.toLocaleTimeString()}
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
                      ? "bg-emerald-600 text-white"
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
              className="px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Regions</option>
              <option value="SW">South West</option>
              <option value="SE">South East</option>
              <option value="NC">North Central</option>
              <option value="NW">North West</option>
              <option value="NE">North East</option>
              <option value="SS">South South</option>
            </select>
            
            {/* Auto-refresh Toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-emerald-500"
              />
              Auto
            </label>
            
            {/* Refresh Button */}
            <button
              onClick={fetchSnapshot}
              disabled={loading}
              className="p-2 bg-[#1a1a1a] border border-gray-700 rounded-lg hover:bg-[#252525] disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Market Filter Banner - shown when ?market= param is present */}
      {selectedMarket && (
        <div className="mb-4 p-3 bg-emerald-900/30 border border-emerald-700/50 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-300 font-medium">Filtered to: {selectedMarket}</span>
          </div>
          <button
            onClick={() => {
              setSelectedMarket("");
              router.replace("/dashboard/snapshot");
            }}
            className="text-sm text-gray-400 hover:text-white px-3 py-1 bg-gray-800 rounded-lg"
          >
            Clear Filter
          </button>
        </div>
      )}
      
      {/* NFPI Index Hero */}
      <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/20 border border-blue-700/50 rounded-xl p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-gray-400 text-sm">NaijaFood Price Index (NFPI)</p>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {currentPeriod?.fullLabel}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl md:text-6xl font-bold text-white">{nfpi?.value ?? 100}</span>
              <div className={`flex items-center gap-1 text-xl font-medium ${
                (nfpi?.trend ?? "stable") === "up" ? "text-red-400" :
                (nfpi?.trend ?? "stable") === "down" ? "text-emerald-400" : "text-gray-400"
              }`}>
                {nfpi?.trend === "up" ? <TrendingUp className="w-5 h-5" /> :
                 nfpi?.trend === "down" ? <TrendingDown className="w-5 h-5" /> :
                 <Minus className="w-5 h-5" />}
                {formatPercent(nfpi?.changePercent ?? 0)}
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-1">Baseline: {nfpi?.baseline ?? 100} ({nfpi?.asOf ?? "Jan 2026"})</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{summary?.totalMarkets ?? 0}</p>
              <p className="text-xs text-gray-500">Markets</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{summary?.totalItems ?? 0}</p>
              <p className="text-xs text-gray-500">Items</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{(summary?.totalPricePoints ?? 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500">Price Points</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${
                (summary?.avgInflation ?? 0) > 0 ? "text-red-400" : "text-emerald-400"
              }`}>
                {formatPercent(summary?.avgInflation ?? 0)}
              </p>
              <p className="text-xs text-gray-500">Avg Change ({currentPeriod?.label})</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <span className="text-xs text-gray-500">Active</span>
          </div>
          <p className="text-2xl font-bold">{summary?.activeMarkets ?? 0}</p>
          <p className="text-xs text-gray-500">of {summary?.totalMarkets ?? 0} markets</p>
        </div>
        
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Package className="w-5 h-5 text-blue-400" />
            <span className="text-xs text-gray-500">Tracked</span>
          </div>
          <p className="text-2xl font-bold">{summary?.totalItems ?? 0}</p>
          <p className="text-xs text-gray-500">commodities</p>
        </div>
        
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <span className="text-xs text-gray-500">Updates</span>
          </div>
          <p className="text-2xl font-bold">{(snapshotData?.recordCount ?? 0).toLocaleString()}</p>
          <p className="text-xs text-gray-500">price records</p>
        </div>
        
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-purple-400" />
            <span className="text-xs text-gray-500">Last Update</span>
          </div>
          <p className="text-lg font-bold">{summary?.lastUpdateTime ?? "N/A"}</p>
          <p className="text-xs text-gray-500">data freshness</p>
        </div>
      </div>
      
      {/* Main Grid - Top Movers */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Top Gainers */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold">Top Gainers</h3>
            </div>
            <span className="text-xs text-gray-500">{currentPeriod?.fullLabel}</span>
          </div>
          <div className="space-y-2">
            {(snapshotData?.topGainers ?? []).slice(0, 5).map((item) => (
              <div 
                key={`${item.item}-${item.market}`} 
                className="flex items-center justify-between p-2 bg-[#252525] rounded-lg hover:bg-[#2a2a2a] cursor-pointer transition-colors"
                onClick={() => router.push(`/dashboard/prices?item=${encodeURIComponent(item.item)}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.item}</p>
                  <p className="text-xs text-gray-500 truncate">{item.market}</p>
                </div>
                <div className="text-right ml-2">
                  <p className="font-medium text-sm">{formatPrice(item.price)}</p>
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-xs text-gray-500">{formatChange(item.change)}</span>
                    <span className="text-xs text-emerald-400 flex items-center gap-0.5">
                      <ArrowUp className="w-3 h-3" />
                      {formatPercent(item.changePercent)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {(snapshotData?.topGainers ?? []).length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">No gainers in this period</p>
            )}
          </div>
        </div>
        
        {/* Top Losers */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-400" />
              <h3 className="font-semibold">Top Losers</h3>
            </div>
            <span className="text-xs text-gray-500">{currentPeriod?.fullLabel}</span>
          </div>
          <div className="space-y-2">
            {(snapshotData?.topLosers ?? []).slice(0, 5).map((item) => (
              <div 
                key={`${item.item}-${item.market}`} 
                className="flex items-center justify-between p-2 bg-[#252525] rounded-lg hover:bg-[#2a2a2a] cursor-pointer transition-colors"
                onClick={() => router.push(`/dashboard/prices?item=${encodeURIComponent(item.item)}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.item}</p>
                  <p className="text-xs text-gray-500 truncate">{item.market}</p>
                </div>
                <div className="text-right ml-2">
                  <p className="font-medium text-sm">{formatPrice(item.price)}</p>
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-xs text-gray-500">{formatChange(item.change)}</span>
                    <span className="text-xs text-red-400 flex items-center gap-0.5">
                      <ArrowDown className="w-3 h-3" />
                      {formatPercent(item.changePercent)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {(snapshotData?.topLosers ?? []).length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">No losers in this period</p>
            )}
          </div>
        </div>
        
        {/* Most Volatile */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold">Most Volatile</h3>
            </div>
            <span className="text-xs text-gray-500">{currentPeriod?.fullLabel}</span>
          </div>
          <div className="space-y-2">
            {(snapshotData?.mostVolatile ?? []).slice(0, 5).map((item) => (
              <div 
                key={`${item.item}-${item.market}`} 
                className="flex items-center justify-between p-2 bg-[#252525] rounded-lg hover:bg-[#2a2a2a] cursor-pointer transition-colors"
                onClick={() => router.push(`/dashboard/prices?item=${encodeURIComponent(item.item)}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.item}</p>
                  <p className="text-xs text-gray-500 truncate">{item.market}</p>
                </div>
                <div className="text-right ml-2">
                  <p className="font-medium text-sm">{formatPrice(item.price)}</p>
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-xs text-gray-500">{formatChange(item.change)}</span>
                    <span className={`text-xs flex items-center gap-0.5 ${
                      item.changePercent > 0 ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {item.changePercent > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      {formatPercent(Math.abs(item.changePercent), false)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {(snapshotData?.mostVolatile ?? []).length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">No volatile items in this period</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Regional Breakdown & Markets */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Regional Breakdown */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold">Regional Breakdown</h3>
            </div>
            <span className="text-xs text-gray-500">{currentPeriod?.fullLabel} change</span>
          </div>
          <div className="space-y-3">
            {(snapshotData?.regionBreakdown ?? []).map((region) => (
              <div 
                key={region.region} 
                className="flex items-center justify-between p-3 bg-[#252525] rounded-lg hover:bg-[#2a2a2a] cursor-pointer transition-colors"
                onClick={() => setSelectedRegion(region.region)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                    region.avgInflation > 2 ? "bg-red-900/50 text-red-400" :
                    region.avgInflation < -2 ? "bg-emerald-900/50 text-emerald-400" :
                    "bg-gray-700 text-gray-300"
                  }`}>
                    {region.region}
                  </div>
                  <div>
                    <p className="font-medium">{region.regionName}</p>
                    <p className="text-xs text-gray-500">{region.marketCount} markets</p>
                  </div>
                </div>
                <div className={`flex items-center gap-1 font-semibold ${
                  region.avgInflation > 0 ? "text-red-400" :
                  region.avgInflation < 0 ? "text-emerald-400" : "text-gray-400"
                }`}>
                  {region.trend === "up" ? <TrendingUp className="w-4 h-4" /> :
                   region.trend === "down" ? <TrendingDown className="w-4 h-4" /> :
                   <Minus className="w-4 h-4" />}
                  {formatPercent(region.avgInflation)}
                </div>
              </div>
            ))}
            {(snapshotData?.regionBreakdown ?? []).length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">No regional data available</p>
            )}
          </div>
        </div>
        
        {/* Top Markets */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-400" />
              <h3 className="font-semibold">Top Markets</h3>
            </div>
            <button 
              onClick={() => router.push("/dashboard/markets")} 
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              View All
            </button>
          </div>
          <div className="space-y-2">
            {(snapshotData?.marketSummaries ?? []).slice(0, 6).map((market) => (
              <div 
                key={market.marketId} 
                className="flex items-center justify-between p-3 bg-[#252525] rounded-lg hover:bg-[#2a2a2a] cursor-pointer transition-colors"
                onClick={() => router.push(`/dashboard/markets?market=${encodeURIComponent(market.marketName)}`)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    market.status === "active" ? "bg-emerald-400" :
                    market.status === "limited" ? "bg-amber-400" : "bg-gray-500"
                  }`} />
                  <div>
                    <p className="font-medium text-sm">{market.marketName}</p>
                    <p className="text-xs text-gray-500">{market.state} • {market.itemCount} items</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-medium text-sm ${
                    market.avgChange > 0 ? "text-red-400" : market.avgChange < 0 ? "text-emerald-400" : "text-gray-400"
                  }`}>
                    {formatPercent(market.avgChange)}
                  </p>
                  <p className="text-xs text-gray-500">{currentPeriod?.label} change</p>
                </div>
              </div>
            ))}
            {(snapshotData?.marketSummaries ?? []).length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">No market data available</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Recent Activity */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold">Recent Activity</h3>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {(snapshotData?.recentActivity ?? []).map((activity, idx) => (
            <div key={idx} className="p-3 bg-[#252525] rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                {activity.type === "price_update" && <BarChart3 className="w-4 h-4 text-blue-400" />}
                {activity.type === "top_gainer" && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                {activity.type === "top_loser" && <TrendingDown className="w-4 h-4 text-red-400" />}
                {activity.type === "alert" && <Zap className="w-4 h-4 text-amber-400" />}
                <span className="text-xs text-gray-500">{activity.time}</span>
              </div>
              <p className="text-sm text-white">{activity.description}</p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>
          Period: {currentPeriod?.fullLabel} • 
          Auto-refresh: {autoRefresh ? "Every 60 seconds" : "Disabled"}
        </p>
      </div>
    </div>
  );
}
