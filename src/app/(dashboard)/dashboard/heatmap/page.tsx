"use client";

// ============================================================================
// src/app/(dashboard)/dashboard/heatmap/page.tsx
// NaijaMarket Intel - Market Heatmap Page
// Bloomberg Equivalent: MAP <GO> (Market Map)
// Version: 1.0.0
// Date: 2026-01-25
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Map,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  Building2,
  ChevronRight,
  Info,
  BarChart3,
} from "lucide-react";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface RegionData {
  code: string;
  name: string;
  states: string[];
  capital: string;
  priceIndex: number;
  avgPrice: number;
  avgChange: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  marketCount: number;
  itemCount: number;
  priceRecords: number;
  heatLevel: number;
  topItems: { item: string; price: number; change: number }[];
  topMarkets: { name: string; state: string; itemCount: number }[];
  comparison: { vsNational: number; vsCheapest: number; rank: number };
}

interface StateData {
  name: string;
  region: string;
  avgPrice: number;
  avgChange: number;
  heatLevel: number;
  marketCount: number;
}

interface HeatmapData {
  success: boolean;
  timestamp: string;
  metric: string;
  national: {
    avgPrice: number;
    avgChange: number;
    totalMarkets: number;
    totalItems: number;
    priceRecords: number;
    nfpiIndex: number;
  };
  regions: RegionData[];
  states: StateData[];
  colorScale: {
    min: number;
    max: number;
    colors: string[];
    labels: string[];
  };
  dataSource: string;
  recordCount: number;
}

// Nigeria Map SVG paths for 6 geopolitical zones (simplified)
const REGION_PATHS: Record<string, string> = {
  NW: "M80,20 L180,20 L200,80 L180,140 L100,140 L60,100 Z",
  NE: "M200,20 L320,20 L340,80 L320,140 L200,140 L180,80 Z",
  NC: "M100,140 L180,140 L200,200 L180,260 L100,260 L80,200 Z",
  SW: "M40,260 L120,260 L140,320 L120,380 L40,380 L20,320 Z",
  SE: "M180,260 L260,260 L280,320 L260,380 L180,380 L160,320 Z",
  SS: "M120,320 L180,320 L200,380 L180,440 L120,440 L100,380 Z",
};

// Region centers for labels
const REGION_CENTERS: Record<string, { x: number; y: number }> = {
  NW: { x: 130, y: 80 },
  NE: { x: 260, y: 80 },
  NC: { x: 140, y: 200 },
  SW: { x: 80, y: 320 },
  SE: { x: 220, y: 320 },
  SS: { x: 150, y: 380 },
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function HeatmapPage() {
  const { status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HeatmapData | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [metric, setMetric] = useState<"price" | "change">("price");
  
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);
  
  const fetchHeatmapData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/heatmap?metric=${metric}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      } else {
        setError(result.error || "Failed to load heatmap data");
      }
    } catch (err) {
      setError("Failed to connect to heatmap service");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [metric]);
  
  useEffect(() => {
    if (status === "authenticated") {
      fetchHeatmapData();
    }
  }, [status, fetchHeatmapData]);
  
  const getRegionColor = (heatLevel: number): string => {
    if (heatLevel < 20) return "#10b981"; // Green - cheapest
    if (heatLevel < 40) return "#84cc16"; // Lime
    if (heatLevel < 60) return "#eab308"; // Yellow
    if (heatLevel < 80) return "#f97316"; // Orange
    return "#ef4444"; // Red - most expensive
  };
  
  const getRegionData = (code: string): RegionData | undefined => {
    return data?.regions.find(r => r.code === code);
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
  
  const selectedRegionData = selectedRegion ? getRegionData(selectedRegion) : null;
  const hoveredRegionData = hoveredRegion ? getRegionData(hoveredRegion) : null;
  const displayRegion = hoveredRegionData || selectedRegionData;
  
  if (status === "loading" || (loading && !data)) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading heatmap...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Map className="w-6 h-6 text-orange-400" />
              <h1 className="text-2xl md:text-3xl font-bold">Market Heatmap</h1>
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">MAP</span>
            </div>
            <p className="text-gray-400 text-sm">
              Regional price comparison across Nigeria&apos;s 6 geopolitical zones
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as "price" | "change")}
              className="px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="price">Price Level</option>
              <option value="change">Price Change</option>
            </select>
            
            <button
              onClick={fetchHeatmapData}
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
      
      {/* National Summary */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">NFPI Index</p>
            <p className="text-2xl font-bold text-white">{data.national.nfpiIndex}</p>
          </div>
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Avg Price</p>
            <p className="text-xl font-bold text-white">{formatPrice(data.national.avgPrice)}</p>
          </div>
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Avg Change</p>
            <p className={`text-xl font-bold ${
              data.national.avgChange > 0 ? "text-red-400" : 
              data.national.avgChange < 0 ? "text-emerald-400" : "text-gray-400"
            }`}>
              {formatPercent(data.national.avgChange)}
            </p>
          </div>
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Markets</p>
            <p className="text-2xl font-bold text-white">{data.national.totalMarkets}</p>
          </div>
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Items Tracked</p>
            <p className="text-2xl font-bold text-white">{data.national.totalItems}</p>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Map className="w-5 h-5 text-orange-400" />
              Nigeria Price Heatmap
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Info className="w-4 h-4" />
              Click a region for details
            </div>
          </div>
          
          {/* SVG Map */}
          <div className="relative">
            <svg viewBox="0 0 380 480" className="w-full max-w-lg mx-auto">
              {/* Background */}
              <rect x="0" y="0" width="380" height="480" fill="#0a0a0a" />
              
              {/* Regions */}
              {Object.entries(REGION_PATHS).map(([code, path]) => {
                const regionData = getRegionData(code);
                const isSelected = selectedRegion === code;
                const isHovered = hoveredRegion === code;
                const heatLevel = regionData?.heatLevel ?? 50;
                const color = getRegionColor(heatLevel);
                
                return (
                  <g key={code}>
                    <path
                      d={path}
                      fill={color}
                      stroke={isSelected ? "#fff" : isHovered ? "#fff" : "#333"}
                      strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
                      opacity={isHovered || isSelected ? 1 : 0.85}
                      className="cursor-pointer transition-all duration-200"
                      onMouseEnter={() => setHoveredRegion(code)}
                      onMouseLeave={() => setHoveredRegion(null)}
                      onClick={() => setSelectedRegion(isSelected ? null : code)}
                    />
                    {/* Region Label */}
                    <text
                      x={REGION_CENTERS[code]?.x ?? 0}
                      y={REGION_CENTERS[code]?.y ?? 0}
                      fill="#fff"
                      fontSize="14"
                      fontWeight="bold"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {code}
                    </text>
                    <text
                      x={REGION_CENTERS[code]?.x ?? 0}
                      y={(REGION_CENTERS[code]?.y ?? 0) + 16}
                      fill="#fff"
                      fontSize="10"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {regionData?.priceIndex ?? 100}
                    </text>
                  </g>
                );
              })}
              
              {/* Compass */}
              <g transform="translate(320, 40)">
                <circle cx="0" cy="0" r="25" fill="#1a1a1a" stroke="#333" />
                <text x="0" y="-8" fill="#fff" fontSize="10" textAnchor="middle">N</text>
                <path d="M0,-15 L3,0 L0,-5 L-3,0 Z" fill="#ef4444" />
              </g>
            </svg>
          </div>
          
          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            {data?.colorScale.colors.map((color, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                <span className="text-xs text-gray-400">{data.colorScale.labels[idx]}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Region Details */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            {displayRegion ? displayRegion.name : "Region Details"}
          </h3>
          
          {displayRegion ? (
            <div className="space-y-4">
              {/* Price Index */}
              <div className="p-4 rounded-lg" style={{ backgroundColor: getRegionColor(displayRegion.heatLevel) + "30" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Price Index</span>
                  <span className="text-xs px-2 py-1 bg-gray-800 rounded">
                    Rank #{displayRegion.comparison.rank}/6
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">{displayRegion.priceIndex}</span>
                  <span className={`text-sm ${
                    displayRegion.comparison.vsNational > 0 ? "text-red-400" : "text-emerald-400"
                  }`}>
                    {displayRegion.comparison.vsNational > 0 ? "+" : ""}
                    {displayRegion.comparison.vsNational}% vs national
                  </span>
                </div>
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#252525] rounded-lg">
                  <p className="text-gray-500 text-xs">Avg Price</p>
                  <p className="font-semibold">{formatPrice(displayRegion.avgPrice)}</p>
                </div>
                <div className="p-3 bg-[#252525] rounded-lg">
                  <p className="text-gray-500 text-xs">Change</p>
                  <p className={`font-semibold flex items-center gap-1 ${
                    displayRegion.changePercent > 0 ? "text-red-400" : 
                    displayRegion.changePercent < 0 ? "text-emerald-400" : "text-gray-400"
                  }`}>
                    {displayRegion.trend === "up" ? <TrendingUp className="w-4 h-4" /> :
                     displayRegion.trend === "down" ? <TrendingDown className="w-4 h-4" /> :
                     <Minus className="w-4 h-4" />}
                    {formatPercent(displayRegion.changePercent)}
                  </p>
                </div>
                <div className="p-3 bg-[#252525] rounded-lg">
                  <p className="text-gray-500 text-xs">Markets</p>
                  <p className="font-semibold">{displayRegion.marketCount}</p>
                </div>
                <div className="p-3 bg-[#252525] rounded-lg">
                  <p className="text-gray-500 text-xs">Items</p>
                  <p className="font-semibold">{displayRegion.itemCount}</p>
                </div>
              </div>
              
              {/* States */}
              <div>
                <p className="text-gray-400 text-sm mb-2">States</p>
                <div className="flex flex-wrap gap-2">
                  {displayRegion.states.map(state => (
                    <span key={state} className="px-2 py-1 bg-[#252525] text-xs rounded">
                      {state}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Top Items */}
              {displayRegion.topItems.length > 0 && (
                <div>
                  <p className="text-gray-400 text-sm mb-2">Top Items</p>
                  <div className="space-y-2">
                    {displayRegion.topItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-[#252525] rounded">
                        <span className="text-sm">{item.item.split(" ")[0]}</span>
                        <div className="text-right">
                          <span className="text-sm font-medium">{formatPrice(item.price)}</span>
                          <span className={`text-xs ml-2 ${
                            item.change > 0 ? "text-red-400" : "text-emerald-400"
                          }`}>
                            {formatPercent(item.change)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Top Markets */}
              {displayRegion.topMarkets.length > 0 && (
                <div>
                  <p className="text-gray-400 text-sm mb-2">Top Markets</p>
                  <div className="space-y-2">
                    {displayRegion.topMarkets.map((market, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-2 bg-[#252525] rounded cursor-pointer hover:bg-[#333]"
                        onClick={() => router.push(`/dashboard/markets?market=${encodeURIComponent(market.name)}`)}
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-sm">{market.name}</p>
                            <p className="text-xs text-gray-500">{market.state}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">Select a region on the map</p>
              <p className="text-xs text-gray-600 mt-1">Click or hover over a zone to see details</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Regional Ranking Table */}
      {data && (
        <div className="mt-6 bg-[#1a1a1a] border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h3 className="font-semibold">Regional Price Rankings</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#252525]">
                <tr>
                  <th className="px-4 py-3 text-left text-sm text-gray-400">Rank</th>
                  <th className="px-4 py-3 text-left text-sm text-gray-400">Region</th>
                  <th className="px-4 py-3 text-right text-sm text-gray-400">Price Index</th>
                  <th className="px-4 py-3 text-right text-sm text-gray-400">Avg Price</th>
                  <th className="px-4 py-3 text-right text-sm text-gray-400">Change</th>
                  <th className="px-4 py-3 text-right text-sm text-gray-400">vs Cheapest</th>
                  <th className="px-4 py-3 text-center text-sm text-gray-400">Markets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.regions.map((region, idx) => (
                  <tr
                    key={region.code}
                    className={`hover:bg-[#252525] cursor-pointer transition-colors ${
                      selectedRegion === region.code ? "bg-[#252525]" : ""
                    }`}
                    onClick={() => setSelectedRegion(region.code)}
                  >
                    <td className="px-4 py-3">
                      <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? "bg-red-500 text-white" :
                        idx === data.regions.length - 1 ? "bg-emerald-500 text-white" :
                        "bg-gray-700 text-gray-300"
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getRegionColor(region.heatLevel) }}
                        />
                        <span className="font-medium">{region.name}</span>
                        <span className="text-xs text-gray-500">({region.code})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{region.priceIndex}</td>
                    <td className="px-4 py-3 text-right">{formatPrice(region.avgPrice)}</td>
                    <td className={`px-4 py-3 text-right ${
                      region.changePercent > 0 ? "text-red-400" : 
                      region.changePercent < 0 ? "text-emerald-400" : "text-gray-400"
                    }`}>
                      {formatPercent(region.changePercent)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {region.comparison.vsCheapest > 0 ? (
                        <span className="text-red-400">+{region.comparison.vsCheapest}%</span>
                      ) : (
                        <span className="text-emerald-400">Cheapest</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400">{region.marketCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Footer */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>Data Source: {data?.dataSource ?? "Loading..."} • {data?.recordCount ?? 0} price records</p>
        <p className="mt-1">Price Index: 100 = National Average. Higher = More Expensive.</p>
      </div>
    </div>
  );
}
