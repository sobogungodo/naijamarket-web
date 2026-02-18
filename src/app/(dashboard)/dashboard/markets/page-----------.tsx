// ============================================================================
// src/app/(dashboard)/dashboard/markets/page.tsx
// NaijaMarket Intel - Markets Explorer with Interactive Map
// Version: 3.0 - All 226 markets, clustering, dark tiles, price popups
// ============================================================================

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search,
  MapPin,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ChevronDown,
  Package,
  Store,
  Activity,
  Filter,
  X,
  Layers,
  ZoomIn,
  BarChart3,
  Globe,
  Star,
  AlertCircle,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface TopPrice {
  item_name: string;
  price_naira: number;
  price_change_pct: number;
  category_name: string;
  unit: string;
}

interface Market {
  market_id: string;
  market_name: string;
  state: string;
  region: string;
  gps_lat: number | null;
  gps_lng: number | null;
  status: string;
  items_tracked: number;
  avg_change: number;
  min_price: number;
  max_price: number;
  total_prices: number;
  top_prices?: TopPrice[];
}

interface MarketFilters {
  states: string[];
  regions: string[];
}

interface MarketStats {
  total_markets: number;
  active_markets: number;
  markets_with_data: number;
  total_items_tracked: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Nigerian geopolitical zone colors
const REGION_COLORS: Record<string, string> = {
  "South West": "#10b981", // emerald
  "South East": "#f59e0b", // amber
  "South South": "#3b82f6", // blue
  "North Central": "#8b5cf6", // violet
  "North West": "#ef4444", // red
  "North East": "#ec4899", // pink
};

const REGION_ABBR: Record<string, string> = {
  "South West": "SW",
  "South East": "SE",
  "South South": "SS",
  "North Central": "NC",
  "North West": "NW",
  "North East": "NE",
};

// ============================================================================
// HELPERS
// ============================================================================

function formatPrice(price: number): string {
  if (price >= 1_000_000) return `₦${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `₦${(price / 1_000).toFixed(0)}K`;
  return `₦${price.toLocaleString()}`;
}

function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

// ============================================================================
// MAP COMPONENT (Leaflet loaded client-side via CDN)
// ============================================================================

interface MapProps {
  markets: Market[];
  selectedMarket: string | null;
  onMarketClick: (market: Market) => void;
}

function MarketsMap({ markets, selectedMarket, onMarketClick }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // Load Leaflet + MarkerCluster from CDN
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already loaded
    if ((window as any).L && mapReady) return;

    const loadScript = (src: string): Promise<void> =>
      new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });

    const loadCSS = (href: string): void => {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    };

    async function initLeaflet() {
      // CSS
      loadCSS(
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      );
      loadCSS(
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.css"
      );
      loadCSS(
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.css"
      );

      // JS
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"
      );
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.min.js"
      );

      setMapReady(true);
    }

    initLeaflet().catch(console.error);
  }, []);

  // Initialize map once Leaflet is loaded
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstanceRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Create map centered on Nigeria
    const map = L.map(mapRef.current, {
      center: [9.0, 7.5],
      zoom: 6,
      zoomControl: false,
      attributionControl: false,
    });

    // Dark tiles - CartoDB Dark Matter
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        subdomains: "abcd",
      }
    ).addTo(map);

    // Custom zoom control (top-right)
    L.control.zoom({ position: "topright" }).addTo(map);

    // Attribution bottom-right
    L.control
      .attribution({ position: "bottomright" })
      .addAttribution(
        '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
      )
      .addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [mapReady]);

  // Update markers when markets data changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const L = (window as any).L;
    if (!L) return;
    const map = mapInstanceRef.current;

    // Remove existing markers
    if (markersRef.current) {
      map.removeLayer(markersRef.current);
    }

    // Create marker cluster group with dark-themed styling
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let size = "small";
        let px = 36;
        if (count > 50) {
          size = "large";
          px = 48;
        } else if (count > 20) {
          size = "medium";
          px = 42;
        }
        return L.divIcon({
          html: `<div style="
            background: rgba(16, 185, 129, 0.85);
            color: white;
            border: 2px solid rgba(16, 185, 129, 1);
            border-radius: 50%;
            width: ${px}px;
            height: ${px}px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: ${size === "large" ? "14px" : "12px"};
            box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
            font-family: system-ui, sans-serif;
          ">${count}</div>`,
          className: "nm-cluster",
          iconSize: L.point(px, px),
        });
      },
    });

    // Add markers for each market with GPS
    const validMarkets = markets.filter(
      (m) => m.gps_lat && m.gps_lng && m.gps_lat !== 0 && m.gps_lng !== 0
    );

    for (const m of validMarkets) {
      const regionColor = REGION_COLORS[m.region] || "#10b981";
      const isSelected = selectedMarket === m.market_id;
      const pulseClass = isSelected ? "nm-marker-pulse" : "";

      // Custom marker icon
      const icon = L.divIcon({
        html: `<div class="${pulseClass}" style="
          background: ${regionColor};
          width: ${isSelected ? "16px" : "12px"};
          height: ${isSelected ? "16px" : "12px"};
          border-radius: 50%;
          border: 2px solid ${isSelected ? "white" : "rgba(255,255,255,0.6)"};
          box-shadow: 0 0 ${isSelected ? "12px" : "6px"} ${regionColor}80;
          transition: all 0.3s;
        "></div>`,
        className: "nm-market-marker",
        iconSize: L.point(isSelected ? 16 : 12, isSelected ? 16 : 12),
        iconAnchor: L.point(isSelected ? 8 : 6, isSelected ? 8 : 6),
      });

      const marker = L.marker([m.gps_lat, m.gps_lng], { icon });

      // Build popup HTML
      const changeColor =
        m.avg_change > 0 ? "#ef4444" : m.avg_change < 0 ? "#10b981" : "#9ca3af";
      const changeSign = m.avg_change >= 0 ? "+" : "";

      let pricesHtml = "";
      if (m.top_prices && m.top_prices.length > 0) {
        pricesHtml = `
          <div style="margin-top:8px;border-top:1px solid #333;padding-top:8px;">
            <div style="font-size:10px;color:#9ca3af;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Top Prices</div>
            ${m.top_prices
              .map((tp) => {
                const tpChangeColor =
                  tp.price_change_pct > 0
                    ? "#ef4444"
                    : tp.price_change_pct < 0
                    ? "#10b981"
                    : "#9ca3af";
                const tpSign = tp.price_change_pct >= 0 ? "+" : "";
                return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #222;">
                  <div>
                    <span style="color:#e5e7eb;font-size:12px;">${tp.item_name}</span>
                    <span style="color:#6b7280;font-size:9px;margin-left:4px;">${tp.unit}</span>
                  </div>
                  <div style="text-align:right;">
                    <span style="color:white;font-weight:600;font-size:12px;font-family:monospace;">₦${tp.price_naira.toLocaleString()}</span>
                    <span style="color:${tpChangeColor};font-size:10px;margin-left:4px;">${tpSign}${tp.price_change_pct.toFixed(1)}%</span>
                  </div>
                </div>`;
              })
              .join("")}
          </div>`;
      }

      const popupHtml = `
        <div style="font-family:system-ui,-apple-system,sans-serif;min-width:260px;max-width:300px;background:#1a1a1a;color:white;padding:12px;border-radius:8px;border:1px solid #333;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <div>
              <div style="font-weight:700;font-size:14px;color:white;">${m.market_name}</div>
              <div style="font-size:11px;color:#9ca3af;">${m.state} • ${REGION_ABBR[m.region] || m.region}</div>
            </div>
            <div style="background:${regionColor}22;color:${regionColor};padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;">
              ${m.status}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px;">
            <div style="background:#111;padding:6px;border-radius:6px;text-align:center;">
              <div style="font-size:18px;font-weight:700;color:white;">${m.items_tracked}</div>
              <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;">Items</div>
            </div>
            <div style="background:#111;padding:6px;border-radius:6px;text-align:center;">
              <div style="font-size:18px;font-weight:700;color:${changeColor};">${changeSign}${m.avg_change.toFixed(1)}%</div>
              <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;">Avg Change</div>
            </div>
            <div style="background:#111;padding:6px;border-radius:6px;text-align:center;">
              <div style="font-size:18px;font-weight:700;color:white;">${m.total_prices}</div>
              <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;">Prices</div>
            </div>
          </div>
          ${pricesHtml}
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: "nm-dark-popup",
        maxWidth: 320,
        closeButton: true,
        autoPan: true,
      });

      marker.on("click", () => onMarketClick(m));

      clusterGroup.addLayer(marker);
    }

    map.addLayer(clusterGroup);
    markersRef.current = clusterGroup;

    // Fit bounds to all markers
    if (validMarkets.length > 0) {
      const bounds = L.latLngBounds(
        validMarkets.map((m) => [m.gps_lat, m.gps_lng])
      );
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [markets, mapReady, selectedMarket, onMarketClick]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-gray-800">
      <div ref={mapRef} className="w-full h-full" />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#111]">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Loading map...</p>
          </div>
        </div>
      )}
      {/* Custom dark popup + cluster styles */}
      <style jsx global>{`
        .nm-dark-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 8px !important;
        }
        .nm-dark-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        .nm-dark-popup .leaflet-popup-tip {
          background: #1a1a1a !important;
          border: 1px solid #333 !important;
          border-top: none !important;
          border-right: none !important;
        }
        .nm-dark-popup .leaflet-popup-close-button {
          color: #9ca3af !important;
          top: 8px !important;
          right: 8px !important;
          font-size: 18px !important;
        }
        .nm-dark-popup .leaflet-popup-close-button:hover {
          color: white !important;
        }
        .nm-cluster {
          background: transparent !important;
        }
        .nm-market-marker {
          background: transparent !important;
          border: none !important;
        }
        .nm-marker-pulse {
          animation: nm-pulse 1.5s ease-in-out infinite;
        }
        @keyframes nm-pulse {
          0%,100% { box-shadow: 0 0 6px rgba(16,185,129,0.5); }
          50% { box-shadow: 0 0 18px rgba(16,185,129,0.8); }
        }
        .leaflet-control-zoom a {
          background: #1a1a1a !important;
          color: #e5e7eb !important;
          border-color: #333 !important;
        }
        .leaflet-control-zoom a:hover {
          background: #333 !important;
        }
        .leaflet-control-attribution {
          background: rgba(0,0,0,0.6) !important;
          color: #6b7280 !important;
          font-size: 10px !important;
        }
        .leaflet-control-attribution a {
          color: #9ca3af !important;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// MARKET CARD COMPONENT
// ============================================================================

interface MarketCardProps {
  market: Market;
  isSelected: boolean;
  onClick: () => void;
}

function MarketCard({ market, isSelected, onClick }: MarketCardProps) {
  const regionColor = REGION_COLORS[market.region] || "#10b981";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-[#1a1a1a] border rounded-xl p-4 transition-all hover:border-gray-600 hover:bg-[#1f1f1f] group ${
        isSelected
          ? "border-emerald-500/50 ring-1 ring-emerald-500/20"
          : "border-gray-800"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold text-sm truncate group-hover:text-emerald-400 transition-colors">
              {market.market_name}
            </h3>
            {market.items_tracked > 100 && (
              <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">{market.state}</span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: `${regionColor}15`,
                color: regionColor,
              }}
            >
              {REGION_ABBR[market.region] || market.region}
            </span>
          </div>
        </div>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            market.status === "ACTIVE"
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-gray-500/15 text-gray-400"
          }`}
        >
          {market.status === "ACTIVE" ? "Active" : market.status}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#111] rounded-lg p-2 text-center">
          <div className="text-white font-bold text-lg leading-tight">
            {market.items_tracked}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
            Items
          </div>
        </div>
        <div className="bg-[#111] rounded-lg p-2 text-center">
          <div
            className={`font-bold text-lg leading-tight ${
              market.avg_change > 0
                ? "text-red-400"
                : market.avg_change < 0
                ? "text-emerald-400"
                : "text-gray-400"
            }`}
          >
            {formatChange(market.avg_change)}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
            Avg Chg
          </div>
        </div>
        <div className="bg-[#111] rounded-lg p-2 text-center">
          <div className="text-white font-bold text-lg leading-tight">
            {market.total_prices}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
            Prices
          </div>
        </div>
      </div>

      {/* Top prices preview */}
      {market.top_prices && market.top_prices.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800/50 space-y-1.5">
          {market.top_prices.slice(0, 3).map((tp, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-gray-400 truncate mr-2">
                {tp.item_name}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-white font-mono">
                  ₦{tp.price_naira.toLocaleString()}
                </span>
                <span
                  className={`text-[10px] ${
                    tp.price_change_pct > 0
                      ? "text-red-400"
                      : tp.price_change_pct < 0
                      ? "text-emerald-400"
                      : "text-gray-500"
                  }`}
                >
                  {tp.price_change_pct >= 0 ? "+" : ""}
                  {tp.price_change_pct.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [filters, setFilters] = useState<MarketFilters>({
    states: [],
    regions: [],
  });
  const [stats, setStats] = useState<MarketStats>({
    total_markets: 0,
    active_markets: 0,
    markets_with_data: 0,
    total_items_tracked: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);

  // Refs
  const stateRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------
  // Fetch data
  // -------------------------------------------------------------------
  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ with_prices: "true", limit: "300" });
      if (stateFilter) params.set("state", stateFilter);
      if (regionFilter) params.set("region", regionFilter);

      const res = await fetch(`/api/markets?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        setMarkets(data.data || []);
        setFilters(data.filters || { states: [], regions: [] });
        setStats(
          data.stats || {
            total_markets: 0,
            active_markets: 0,
            markets_with_data: 0,
            total_items_tracked: 0,
          }
        );
      } else {
        setError(data.error || "Failed to load markets");
      }
    } catch (e: any) {
      console.error("Markets fetch error:", e);
      setError(e.message || "Failed to load markets");
    } finally {
      setLoading(false);
    }
  }, [stateFilter, regionFilter]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (stateRef.current && !stateRef.current.contains(t))
        setShowStateDropdown(false);
      if (regionRef.current && !regionRef.current.contains(t))
        setShowRegionDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // -------------------------------------------------------------------
  // Filtered markets (client-side search)
  // -------------------------------------------------------------------
  const filteredMarkets = useMemo(() => {
    if (!search) return markets;
    const q = search.toLowerCase();
    return markets.filter(
      (m) =>
        m.market_name.toLowerCase().includes(q) ||
        m.state.toLowerCase().includes(q) ||
        m.region.toLowerCase().includes(q)
    );
  }, [markets, search]);

  // Markets with GPS for map
  const mapMarkets = useMemo(
    () =>
      filteredMarkets.filter(
        (m) => m.gps_lat && m.gps_lng && m.gps_lat !== 0 && m.gps_lng !== 0
      ),
    [filteredMarkets]
  );

  // Sort: markets with most items first
  const sortedMarkets = useMemo(
    () => [...filteredMarkets].sort((a, b) => b.items_tracked - a.items_tracked),
    [filteredMarkets]
  );

  const handleMarketClick = useCallback((market: Market) => {
    setSelectedMarket(market.market_id);
  }, []);

  const clearFilters = () => {
    setSearch("");
    setStateFilter("");
    setRegionFilter("");
  };

  const hasActiveFilters = search || stateFilter || regionFilter;

  // -------------------------------------------------------------------
  // Aggregate region stats
  // -------------------------------------------------------------------
  const regionStats = useMemo(() => {
    const map = new Map<
      string,
      { count: number; items: number; avgChange: number }
    >();
    for (const m of markets) {
      if (!m.region) continue;
      const existing = map.get(m.region) || {
        count: 0,
        items: 0,
        avgChange: 0,
      };
      existing.count++;
      existing.items += m.items_tracked;
      existing.avgChange += m.avg_change;
      map.set(m.region, existing);
    }
    return Array.from(map.entries())
      .map(([region, data]) => ({
        region,
        count: data.count,
        items: data.items,
        avgChange: data.count > 0 ? data.avgChange / data.count : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [markets]);

  // ===================================================================
  // RENDER
  // ===================================================================

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Globe className="w-7 h-7 text-emerald-400" />
            Market Explorer
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {stats.total_markets} markets across Nigeria •{" "}
            {stats.total_items_tracked.toLocaleString()} items tracked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMarkets}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-[#222] transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* ---- Region Summary Badges ---- */}
      <div className="flex flex-wrap gap-2">
        {regionStats.map((rs) => {
          const color = REGION_COLORS[rs.region] || "#10b981";
          const isActive = regionFilter === rs.region;
          return (
            <button
              key={rs.region}
              onClick={() =>
                setRegionFilter(isActive ? "" : rs.region)
              }
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                isActive
                  ? "border-white/30 scale-105"
                  : "border-transparent hover:border-gray-700"
              }`}
              style={{
                backgroundColor: isActive ? `${color}25` : `${color}10`,
                color: color,
              }}
            >
              <span className="font-bold">
                {REGION_ABBR[rs.region] || rs.region}
              </span>
              <span className="opacity-70">{rs.count} mkts</span>
              <span
                className={`${
                  rs.avgChange > 0
                    ? "text-red-400"
                    : rs.avgChange < 0
                    ? "text-emerald-400"
                    : "opacity-50"
                }`}
              >
                {formatChange(rs.avgChange)}
              </span>
            </button>
          );
        })}
      </div>

      {/* ---- Filters ---- */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[240px] flex items-center gap-2 bg-[#1a1a1a] border border-gray-800 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search markets, states..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* State dropdown */}
        <div className="relative" ref={stateRef}>
          <button
            onClick={() => {
              setShowStateDropdown(!showStateDropdown);
              setShowRegionDropdown(false);
            }}
            className={`flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border rounded-lg text-sm transition-colors ${
              stateFilter
                ? "border-emerald-500 text-emerald-400"
                : "border-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            <MapPin className="w-4 h-4" />
            {stateFilter || "State"}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                showStateDropdown ? "rotate-180" : ""
              }`}
            />
          </button>
          {showStateDropdown && (
            <div className="absolute top-full mt-1 w-48 max-h-64 overflow-y-auto bg-[#1a1a1a] border border-gray-800 rounded-lg shadow-xl z-50">
              <button
                onClick={() => {
                  setStateFilter("");
                  setShowStateDropdown(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-[#222] hover:text-white border-b border-gray-800"
              >
                All States
              </button>
              {filters.states.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStateFilter(s);
                    setShowStateDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-[#222] hover:text-white ${
                    stateFilter === s
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-gray-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active filter badges */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            {stateFilter && (
              <span className="px-2 py-1 bg-emerald-500/15 text-emerald-400 text-xs rounded flex items-center gap-1">
                {stateFilter}
                <button
                  onClick={() => setStateFilter("")}
                  className="hover:text-white"
                >
                  ×
                </button>
              </span>
            )}
            {regionFilter && (
              <span className="px-2 py-1 bg-emerald-500/15 text-emerald-400 text-xs rounded flex items-center gap-1">
                {regionFilter}
                <button
                  onClick={() => setRegionFilter("")}
                  className="hover:text-white"
                >
                  ×
                </button>
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-white"
            >
              Clear all
            </button>
          </div>
        )}

        <div className="text-xs text-gray-500 ml-auto">
          Showing{" "}
          <span className="text-emerald-400 font-medium">
            {filteredMarkets.length}
          </span>{" "}
          markets • {mapMarkets.length} on map
        </div>
      </div>

      {/* ---- Error ---- */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button
            onClick={fetchMarkets}
            className="ml-auto text-xs underline hover:text-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {/* ---- Map ---- */}
      {!error && (
        <div className="h-[480px] w-full">
          <MarketsMap
            markets={filteredMarkets}
            selectedMarket={selectedMarket}
            onMarketClick={handleMarketClick}
          />
        </div>
      )}

      {/* ---- Market Cards Grid ---- */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sortedMarkets.map((market) => (
              <MarketCard
                key={market.market_id}
                market={market}
                isSelected={selectedMarket === market.market_id}
                onClick={() => handleMarketClick(market)}
              />
            ))}
          </div>

          {filteredMarkets.length === 0 && !loading && (
            <div className="text-center py-12">
              <Store className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No markets found</p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-2 text-emerald-400 text-sm hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
