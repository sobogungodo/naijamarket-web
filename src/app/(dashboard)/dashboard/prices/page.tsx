// ============================================================================
// src/app/(dashboard)/dashboard/prices/page.tsx
// NaijaMarket Intel - Live Prices Page
// Version: 6.3.0 - Fixed price number formatting (en-NG locale), +0% change fix
// ============================================================================

"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  Bell,
  MoreHorizontal,
  BarChart3,
  Loader2,
  X,
  Database,
  AlertCircle
} from "lucide-react";
import PriceHistoryModal from "@/components/PriceHistoryModal";
import { FreshnessIndicator } from "@/components/FreshnessIndicator";
import { PriceDisclaimer } from "@/components/PriceDisclaimer";

// ============================================================================
// HELPERS
// ============================================================================

// Force en-US locale so numbers always render as 80,000.00 not 80 000,00
// (Vercel servers may use a non-English system locale)
const fmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const fmt2 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatNaira = (value: number): string => fmt2.format(value);
const formatNairaInt = (value: number): string => fmt.format(value);

// ============================================================================
// TYPES
// ============================================================================

interface PriceItem {
  id: string;
  item_name: string;
  item_variant: string | null;
  unit: string;
  category: string;
  market_name: string;
  state: string;
  price_naira: number;
  change_percent: number;
  change_amount: number;
  low_24h: number;
  high_24h: number;
  has_real_range?: boolean;
  confidence: number;
  validators: number;
  updated_at: string;
  source: string;
}

interface SelectedPrice {
  item: string;
  itemSubtitle?: string;
  market: string;
  state?: string;
  category?: string;
  currentPrice?: number;
  currentChange?: number;
}

interface FilterOptions {
  categories: string[];
  states: string[];
  markets: string[];
  stateMarkets: Record<string, string[]>;
}

// ============================================================================
// PRICES PAGE
// ============================================================================

function PricesPageContent() {
  // Read URL query params (from Screener, Watchlist, etc.)
  const searchParams = useSearchParams();
  const urlItem = searchParams.get("item") || "";
  const urlCategory = searchParams.get("category") || "";
  const urlState = searchParams.get("state") || "";
  const urlMarket = searchParams.get("market") || "";

  // Data state
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>("loading");

  // Filter options from database
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    categories: [],
    states: [],
    markets: [],
    stateMarkets: {},
  });

  // Filter state — pre-filled from URL if navigating from Screener/Watchlist
  const [searchQuery, setSearchQuery] = useState(urlItem);
  const [categoryFilter, setCategoryFilter] = useState(urlCategory);
  const [stateFilter, setStateFilter] = useState(urlState);
  const [marketFilter, setMarketFilter] = useState(urlMarket);
  const [trendFilter, setTrendFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [unitFilter, setUnitFilter] = useState("");

  // Dropdown state
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showMarketDropdown, setShowMarketDropdown] = useState(false);

  // Refs for dropdown containers
  const categoryRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HTMLDivElement>(null);
  const marketRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [selectedPrice, setSelectedPrice] = useState<SelectedPrice | null>(null);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchPrices = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (categoryFilter) params.append("category", categoryFilter);
      if (stateFilter) params.append("state", stateFilter);
      if (marketFilter) params.append("market", marketFilter);
      if (trendFilter && trendFilter !== "all") params.append("trend", trendFilter);
      params.append("sort", sortBy);
      params.append("limit", "200");

      const response = await fetch("/api/prices?" + params.toString());
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const result = await response.json();

      if (result.success) {
        setPrices(result.data || []);
        setDataSource(result.source || "unknown");
        
        // Update filter options from API
        if (result.filters) {
          setFilterOptions({
            categories: result.filters.categories || [],
            states: result.filters.states || [],
            markets: result.filters.markets || [],
            stateMarkets: result.filters.stateMarkets || {},
          });
        }
      } else {
        setError(result.error || "Failed to fetch prices");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load prices. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, categoryFilter, stateFilter, marketFilter, trendFilter, sortBy]);

  // Track whether this is the initial mount
  const isInitialMount = useRef(true);

  // Initial load — no debounce, fires immediately
  useEffect(() => {
    fetchPrices(false);
  }, []);

  // Sync URL params when navigating from other pages (Screener, Watchlist, etc.)
  useEffect(() => {
    if (urlItem) setSearchQuery(urlItem);
    if (urlCategory) setCategoryFilter(urlCategory);
    if (urlState) setStateFilter(urlState);
    if (urlMarket) setMarketFilter(urlMarket);
  }, [urlItem, urlCategory, urlState, urlMarket]);

  // Re-fetch when filters change — 600ms debounce (was 300ms)
  // Skips the very first render to avoid double-fetching on mount.
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const debounce = setTimeout(() => {
      fetchPrices(false);
    }, 600);  // 600ms: enough time for user to finish typing, short enough to feel responsive
    return () => clearTimeout(debounce);
  }, [searchQuery, categoryFilter, stateFilter, marketFilter, trendFilter, sortBy]);

  // Auto-refresh every hour between 6AM-10PM WAT (UTC+1)
  // Prices update 3× daily; hourly refresh ensures users see fresh data
  useEffect(() => {
    const checkAndRefresh = () => {
      const now = new Date();
      // WAT = UTC+1. Get current hour in WAT.
      const watHour = (now.getUTCHours() + 1) % 24;
      if (watHour >= 6 && watHour <= 22) {
        fetchPrices(true);
      }
    };

    // Refresh every 60 minutes
    const interval = setInterval(checkAndRefresh, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // CLOSE DROPDOWNS ON OUTSIDE CLICK - FIXED VERSION
  // ============================================================================

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Only close if click is outside all dropdown containers
      if (categoryRef.current && !categoryRef.current.contains(target)) {
        setShowCategoryDropdown(false);
      }
      if (stateRef.current && !stateRef.current.contains(target)) {
        setShowStateDropdown(false);
      }
      if (marketRef.current && !marketRef.current.contains(target)) {
        setShowMarketDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Clear market filter if selected market isn't in the newly selected state
  useEffect(() => {
    if (stateFilter && marketFilter && filterOptions.stateMarkets[stateFilter]) {
      if (!filterOptions.stateMarkets[stateFilter].includes(marketFilter)) {
        setMarketFilter("");
      }
    }
  }, [stateFilter]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleRefresh = () => {
    fetchPrices(true);
  };

  const handleExport = () => {
    if (prices.length === 0) return;
    
    const headers = ["Item", "Variant", "Category", "Market", "State", "Price (₦)", "Change (%)", "Wk Low", "Wk High", "Confidence", "Source", "Updated"];
    const rows = prices.map(p => [
      p.item_name,
      p.item_variant || "",
      p.category,
      p.market_name,
      p.state,
      p.price_naira,
      p.change_percent,
      p.low_24h,
      p.high_24h,
      p.confidence + "%",
      p.source,
      p.updated_at,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `naijamarket_prices_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const handleRowClick = (item: PriceItem) => {
    setSelectedPrice({
      item: item.item_name,
      itemSubtitle: item.item_variant || undefined,
      market: item.market_name,
      state: item.state,
      category: item.category,
      currentPrice: item.price_naira,
      currentChange: item.change_percent,
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("");
    setStateFilter("");
    setMarketFilter("");
    setTrendFilter("all");
    setUnitFilter("");
  };

  const hasActiveFilters = searchQuery || categoryFilter || stateFilter || marketFilter || trendFilter !== "all" || unitFilter;

  // When a state is selected, only show markets from that state
  const availableMarkets = stateFilter && filterOptions.stateMarkets[stateFilter]
    ? filterOptions.stateMarkets[stateFilter]
    : filterOptions.markets;

  // Format update timestamp — shows actual time (not "X hrs ago")
  // Data updates 3× daily so "16 hr ago" looks stale; "Today 6:00 AM" is clearer
  const formatUpdateTime = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;

      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();

      const timeStr = date.toLocaleTimeString("en-NG", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Africa/Lagos",
      });

      if (isToday) return `Today ${timeStr}`;
      if (isYesterday) return `Yesterday ${timeStr}`;

      return date.toLocaleDateString("en-NG", {
        month: "short",
        day: "numeric",
        timeZone: "Africa/Lagos",
      }) + ` ${timeStr}`;
    } catch {
      return dateStr;
    }
  };

  // Get source display
  const getSourceDisplay = (source: string): { text: string; color: string } => {
    if (source === "database") return { text: "Azure SQL", color: "text-blue-400" };
    if (source.includes("Daily")) return { text: "Daily Prices", color: "text-emerald-400" };
    if (source.includes("Latest")) return { text: "Latest Prices Summary", color: "text-emerald-400" };
    if (source.includes("NBS")) return { text: "NBS Historical", color: "text-cyan-400" };
    if (source.includes("Validated")) return { text: "Validated", color: "text-green-400" };
    if (source.includes("sheets")) return { text: "Google Sheets", color: "text-yellow-400" };
    if (source.includes("demo") || source.includes("mock") || source.includes("Demo")) return { text: "Demo Data", color: "text-orange-400" };
    return { text: source, color: "text-gray-400" };
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // Unit dropdown — built from current result set
  const availableUnits = Array.from(new Set(prices.map(p => p.unit).filter(Boolean))).sort();
  console.log("[prices] availableUnits:", availableUnits, "sample unit:", prices[0]?.unit);
  const filteredPrices = unitFilter ? prices.filter(p => p.unit === unitFilter) : prices;

  const sourceInfo = getSourceDisplay(dataSource);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Latest Prices</h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            Commodity prices from {filterOptions.markets.length || 224} markets · Updated 3× daily
            {dataSource && dataSource !== "loading" && (
              <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-terminal-muted ${sourceInfo.color}`}>
                <Database className="w-3 h-3" />
                {sourceInfo.text}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-terminal-surface border border-terminal-border rounded-lg text-sm text-gray-400 hover:text-white hover:bg-terminal-elevated transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button 
            onClick={handleExport}
            disabled={prices.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-terminal-surface border border-terminal-border rounded-lg text-sm text-gray-400 hover:text-white hover:bg-terminal-elevated transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-terminal-surface border border-terminal-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="w-96 flex items-center gap-2 bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search items, markets, or categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter - FIXED */}
          <div className="relative" ref={categoryRef}>
            <button 
              onClick={() => {
                setShowCategoryDropdown(!showCategoryDropdown);
                setShowStateDropdown(false);
                setShowMarketDropdown(false);
              }}
              className={`flex items-center gap-2 px-3 py-2 bg-terminal-bg border rounded-lg text-sm transition-colors ${
                categoryFilter 
                  ? "border-naija-green text-naija-green" 
                  : "border-terminal-border text-gray-400 hover:text-white"
              }`}
            >
              <Filter className="w-4 h-4" />
              {categoryFilter || "Category"}
              <ChevronDown className={`w-4 h-4 transition-transform ${showCategoryDropdown ? "rotate-180" : ""}`} />
            </button>
            {showCategoryDropdown && (
              <div className="absolute top-full mt-1 w-56 max-h-64 overflow-y-auto bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50">
                <button
                  onClick={() => { setCategoryFilter(""); setShowCategoryDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-terminal-muted hover:text-white border-b border-terminal-border"
                >
                  All Categories
                </button>
                {filterOptions.categories.length > 0 ? (
                  filterOptions.categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setCategoryFilter(cat); setShowCategoryDropdown(false); }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-terminal-muted hover:text-white ${
                        categoryFilter === cat ? "text-naija-green bg-naija-green/10" : "text-gray-300"
                      }`}
                    >
                      {cat}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">Loading categories...</div>
                )}
              </div>
            )}
          </div>

          {/* State Filter - FIXED */}
          <div className="relative" ref={stateRef}>
            <button 
              onClick={() => {
                setShowStateDropdown(!showStateDropdown);
                setShowCategoryDropdown(false);
                setShowMarketDropdown(false);
              }}
              className={`flex items-center gap-2 px-3 py-2 bg-terminal-bg border rounded-lg text-sm transition-colors ${
                stateFilter 
                  ? "border-naija-green text-naija-green" 
                  : "border-terminal-border text-gray-400 hover:text-white"
              }`}
            >
              {stateFilter || "State"}
              <ChevronDown className={`w-4 h-4 transition-transform ${showStateDropdown ? "rotate-180" : ""}`} />
            </button>
            {showStateDropdown && (
              <div className="absolute top-full mt-1 w-48 max-h-64 overflow-y-auto bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50">
                <button
                  onClick={() => { setStateFilter(""); setShowStateDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-terminal-muted hover:text-white border-b border-terminal-border"
                >
                  All States
                </button>
                {filterOptions.states.length > 0 ? (
                  filterOptions.states.map(s => (
                    <button
                      key={s}
                      onClick={() => { setStateFilter(s); setShowStateDropdown(false); }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-terminal-muted hover:text-white ${
                        stateFilter === s ? "text-naija-green bg-naija-green/10" : "text-gray-300"
                      }`}
                    >
                      {s}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">Loading states...</div>
                )}
              </div>
            )}
          </div>

          {/* Market Filter - FIXED */}
          <div className="relative" ref={marketRef}>
            <button 
              onClick={() => {
                setShowMarketDropdown(!showMarketDropdown);
                setShowCategoryDropdown(false);
                setShowStateDropdown(false);
              }}
              className={`flex items-center gap-2 px-3 py-2 bg-terminal-bg border rounded-lg text-sm transition-colors ${
                marketFilter 
                  ? "border-naija-green text-naija-green" 
                  : "border-terminal-border text-gray-400 hover:text-white"
              }`}
            >
              {marketFilter || "Market"}
              <ChevronDown className={`w-4 h-4 transition-transform ${showMarketDropdown ? "rotate-180" : ""}`} />
            </button>
            {showMarketDropdown && (
              <div className="absolute top-full mt-1 w-64 max-h-64 overflow-y-auto bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50">
                <button
                  onClick={() => { setMarketFilter(""); setShowMarketDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-terminal-muted hover:text-white border-b border-terminal-border"
                >
                  {stateFilter ? `All ${stateFilter} Markets` : "All Markets"}
                </button>
                {availableMarkets.length > 0 ? (
                  availableMarkets.map(m => (
                    <button
                      key={m}
                      onClick={() => { setMarketFilter(m); setShowMarketDropdown(false); }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-terminal-muted hover:text-white truncate ${
                        marketFilter === m ? "text-naija-green bg-naija-green/10" : "text-gray-300"
                      }`}
                      title={m}
                    >
                      {m}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    {stateFilter ? `No markets found in ${stateFilter}` : "Loading markets..."}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Price Trend Filter */}
          <div className="flex items-center gap-1 border-l border-terminal-border pl-4">
            <button 
              onClick={() => setTrendFilter("all")}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                trendFilter === "all" ? "bg-terminal-muted text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              All
            </button>
            <button 
              onClick={() => setTrendFilter("up")}
              className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                trendFilter === "up" ? "bg-price-up/20 text-price-up" : "text-price-up hover:bg-price-up/10"
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              Up
            </button>
            <button 
              onClick={() => setTrendFilter("down")}
              className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                trendFilter === "down" ? "bg-price-down/20 text-price-down" : "text-price-down hover:bg-price-down/10"
              }`}
            >
              <TrendingDown className="w-3 h-3" />
              Down
            </button>
          </div>

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              {categoryFilter && (
                <span className="px-2 py-1 bg-naija-green/20 text-naija-green text-xs rounded flex items-center gap-1">
                  {categoryFilter}
                  <button onClick={() => setCategoryFilter("")} className="hover:text-white">×</button>
                </span>
              )}
              {stateFilter && (
                <span className="px-2 py-1 bg-naija-green/20 text-naija-green text-xs rounded flex items-center gap-1">
                  {stateFilter}
                  <button onClick={() => setStateFilter("")} className="hover:text-white">×</button>
                </span>
              )}
              {marketFilter && (
                <span className="px-2 py-1 bg-naija-green/20 text-naija-green text-xs rounded flex items-center gap-1">
                  {marketFilter}
                  <button onClick={() => setMarketFilter("")} className="hover:text-white">×</button>
                </span>
              )}
              <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-white">
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="mt-3 pt-3 border-t border-terminal-border flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Showing <span className="text-naija-green font-medium">{filteredPrices.length}</span> prices
          </span>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-xs text-gray-400"
            >
              <option value="updated">Latest Update</option>
              <option value="price">Price (High to Low)</option>
              <option value="change">Change (%)</option>
              <option value="name">Name (A-Z)</option>
            </select>
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className={`bg-terminal-bg border rounded px-2 py-1 text-xs ${
                unitFilter ? "border-naija-green text-naija-green" : "border-terminal-border text-gray-400"
              }`}
            >
              <option value="">All Units</option>
              {availableUnits.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-naija-green animate-spin mb-4" />
          <p className="text-gray-400">Loading prices from database...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-20 bg-terminal-surface border border-terminal-border rounded-xl">
          <AlertCircle className="w-10 h-10 text-price-down mb-4" />
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => fetchPrices(false)}
            className="px-4 py-2 bg-naija-green/20 text-naija-green rounded-lg hover:bg-naija-green/30"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Prices Table */}
      {!loading && !error && (
        <div className="bg-terminal-surface border border-terminal-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "32px" }} />        {/* Star */}
                <col style={{ width: "17%" }} />          {/* Item */}
                <col style={{ width: "11%" }} />          {/* Category */}
                <col style={{ width: "14%" }} />          {/* Market */}
                <col style={{ width: "7%" }} />           {/* State */}
                <col style={{ width: "12%" }} />          {/* Price */}
                <col style={{ width: "11%" }} />          {/* Change */}
                <col style={{ width: "11%" }} />          {/* Wk Range */}
                <col style={{ width: "12%" }} />          {/* Confidence */}
                <col style={{ width: "10%" }} />          {/* Updated */}
                <col style={{ width: "48px" }} />         {/* Actions */}
              </colgroup>
              <thead>
                <tr className="border-b border-terminal-border bg-terminal-bg/50">
                  <th className="py-3"></th>
                  <th className="py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Item</th>
                  <th className="py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Market</th>
                  <th className="py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">State</th>
                  <th className="py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Price (₦)</th>
                  <th className="py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Change</th>
                  <th className="py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Wk Range</th>
                  <th className="py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Confidence</th>
                  <th className="py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Updated</th>
                  <th className="py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border/40">
                {filteredPrices.map((item) => (
                  <tr 
                    key={item.id} 
                    className="group cursor-pointer hover:bg-terminal-muted/40 transition-colors"
                    onClick={() => handleRowClick(item)}
                  >
                    {/* Star */}
                    <td className="py-3 text-center">
                      <button 
                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-naija-gold transition-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Star className="w-4 h-4 mx-auto" />
                      </button>
                    </td>

                    {/* Item Name */}
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-2 min-w-0">
                        <div className="shrink-0 p-1.5 bg-emerald-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div className="min-w-0 text-center">
                          <div className="font-medium text-sm text-white group-hover:text-naija-green transition-colors truncate" title={item.item_name}>
                            {item.item_name}
                          </div>
                          {item.item_variant && (
                            <div className="text-xs text-gray-500 truncate">{item.item_variant}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-2 py-3 text-center">
                      <span className="inline-block px-2.5 py-1 bg-terminal-muted text-gray-400 text-xs rounded-md" title={item.category}>
                        {item.category}
                      </span>
                    </td>

                    {/* Market */}
                    <td className="px-3 py-3 text-center">
                      <span className="text-sm text-gray-400 block truncate" title={item.market_name}>
                        {item.market_name}
                      </span>
                    </td>

                    {/* State */}
                    <td className="py-3 text-center">
                      <span className="text-xs text-gray-500">{item.state}</span>
                    </td>

                    {/* Price */}
                    <td className="px-3 py-3 text-center">
                      <span className="font-mono text-white text-base font-semibold">
                        {formatNaira(item.price_naira)}
                      </span>
                    </td>

                    {/* Change */}
                    <td className="px-2 py-3 text-center">
                      <div className={`flex items-center justify-center gap-1 text-sm ${
                        item.change_percent > 0 ? "text-price-up" : 
                        item.change_percent < 0 ? "text-price-down" : "text-gray-500"
                      }`}>
                        {item.change_percent > 0 ? <TrendingUp className="w-3 h-3 shrink-0" /> : 
                         item.change_percent < 0 ? <TrendingDown className="w-3 h-3 shrink-0" /> : 
                         <Minus className="w-3 h-3 shrink-0" />}
                        <span className="font-mono">{item.change_percent >= 0 ? "+" : ""}{item.change_percent.toFixed(2)}%</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 font-mono">
                        {item.change_amount >= 0 ? "+" : ""}₦{formatNairaInt(Math.abs(item.change_amount))}
                      </div>
                    </td>

                    {/* Wk Range - bright if real data, muted if estimated */}
                    <td className="px-2 py-3 text-center">
                      <div className="font-mono text-xs leading-relaxed">
                        <span className={item.has_real_range ? "text-gray-300" : "text-gray-600"}>
                          {formatNairaInt(item.low_24h)}
                        </span>
                        <span className="text-gray-700 mx-1">–</span>
                        <span className={item.has_real_range ? "text-gray-300" : "text-gray-600"}>
                          {formatNairaInt(item.high_24h)}
                        </span>
                        {!item.has_real_range && (
                          <div className="text-gray-700 text-[9px] mt-0.5">est.</div>
                        )}
                      </div>
                    </td>

                    {/* Confidence */}
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-terminal-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              item.confidence >= 85 ? "bg-price-up" : 
                              item.confidence >= 70 ? "bg-naija-gold" : 
                              item.confidence >= 50 ? "bg-orange-500" : "bg-price-down"
                            }`}
                            style={{ width: `${item.confidence}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 tabular-nums">{item.confidence}%</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5 text-center">
                        {item.validators} validators
                      </div>
                    </td>

                    {/* Updated */}
                    <td className="px-2 py-3 text-center">
                      <div className="text-xs text-gray-400">{formatUpdateTime(item.updated_at)}</div>
                      <div className="text-xs text-gray-600">{item.source.replace(/_/g, " ")}</div>
                      <FreshnessIndicator date={item.updated_at} compact className="mt-1" />
                    </td>

                    {/* Actions */}
                    <td className="py-3 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          className="p-1 text-gray-500 hover:text-naija-green transition-colors" 
                          title="Set Alert"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Bell className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          className="p-1 text-gray-500 hover:text-white transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {filteredPrices.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <Database className="w-12 h-12 text-gray-600 mb-4" />
              <p className="text-gray-400 mb-2">No prices found</p>
              <p className="text-sm text-gray-500 mb-4">
                {hasActiveFilters 
                  ? "Try adjusting your filters or search query" 
                  : "No price data available in the database"}
              </p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-naija-green hover:text-white">
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Footer */}
          {filteredPrices.length > 0 && (
            <div className="px-4 py-3 border-t border-terminal-border flex items-center justify-between">
              <span className="text-sm text-gray-500">
                💡 Click any row to view price history chart
              </span>
              <span className="text-xs text-gray-600">
                Bloomberg: HP &lt;GO&gt;
              </span>
            </div>
          )}
        </div>
      )}

      {/* Data accuracy disclaimer [1v] */}
      {!loading && !error && filteredPrices.length > 0 && <PriceDisclaimer className="mt-1" />}

      {/* Price History Modal */}
      {selectedPrice && (
        <PriceHistoryModal
          isOpen={!!selectedPrice}
          onClose={() => setSelectedPrice(null)}
          item={selectedPrice.item}
          itemSubtitle={selectedPrice.itemSubtitle}
          market={selectedPrice.market}
          state={selectedPrice.state}
          category={selectedPrice.category}
          currentPrice={selectedPrice.currentPrice}
          currentChange={selectedPrice.currentChange}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUSPENSE WRAPPER (required for useSearchParams in Next.js App Router)
// ============================================================================

export default function PricesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading prices...</p>
        </div>
      </div>
    }>
      <PricesPageContent />
    </Suspense>
  );
}
