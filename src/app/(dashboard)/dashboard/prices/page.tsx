// ============================================================================
// src/app/(dashboard)/dashboard/prices/page.tsx
// NaijaMarket Intel - Live Prices Page (Dynamic)
// Version: 3.0.0 - Fetches from Google Sheets → Database → Mock
// ============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
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
  X
} from "lucide-react";
import PriceHistoryModal from "@/components/PriceHistoryModal";

// ============================================================================
// TYPES
// ============================================================================

interface PriceItem {
  id: string;
  item_name: string;
  item_variant: string | null;
  category: string;
  market_name: string;
  state: string;
  price_naira: number;
  change_percent: number;
  change_amount: number;
  low_24h: number;
  high_24h: number;
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

// ============================================================================
// PRICES PAGE
// ============================================================================

export default function PricesPage() {
  // Data state
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>("loading");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [trendFilter, setTrendFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");

  // Dropdown state
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showMarketDropdown, setShowMarketDropdown] = useState(false);

  // Modal state
  const [selectedPrice, setSelectedPrice] = useState<SelectedPrice | null>(null);

  // Filter options
  const categories = ["Grains", "Vegetables", "Oils", "Tubers", "Building", "Sweeteners", "Fruits", "Proteins"];
  const states = ["Lagos", "Kano", "Anambra", "FCT", "Abia", "Oyo", "Rivers"];
  const markets = ["Mile 12", "Iddo", "Kano Main", "Onitsha", "Wuse", "Ariaria", "Alaba"];

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

      const response = await fetch("/api/prices?" + params.toString());
      const result = await response.json();

      if (result.success) {
        setPrices(result.data || []);
        setDataSource(result.source || "unknown");
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

  // Initial load and filter changes
  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchPrices();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchPrices]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleRefresh = () => {
    fetchPrices(true);
  };

  const handleExport = () => {
    const headers = ["Item", "Category", "Market", "State", "Price (₦)", "Change (%)", "24H Low", "24H High", "Confidence", "Updated"];
    const rows = prices.map(p => [
      p.item_name,
      p.category,
      p.market_name,
      p.state,
      p.price_naira,
      p.change_percent,
      p.low_24h,
      p.high_24h,
      p.confidence + "%",
      new Date(p.updated_at).toLocaleString(),
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
  };

  const hasActiveFilters = searchQuery || categoryFilter || stateFilter || marketFilter || trendFilter !== "all";

  // Format time ago
  const formatTimeAgo = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    return `${Math.floor(diffMs / 86400000)} day ago`;
  };

  // Get source display
  const getSourceDisplay = (source: string): string => {
    switch (source) {
      case "sheets": return "Google Sheets";
      case "database": return "Database";
      case "mock": return "Demo Data";
      default: return source;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Live Prices</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time commodity prices from 226 markets
            {dataSource && dataSource !== "loading" && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-terminal-muted text-gray-400">
                Source: {getSourceDisplay(dataSource)}
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
            className="flex items-center gap-2 px-3 py-2 bg-terminal-surface border border-terminal-border rounded-lg text-sm text-gray-400 hover:text-white hover:bg-terminal-elevated transition-colors"
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
          <div className="flex-1 min-w-[300px] flex items-center gap-2 bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2">
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

          {/* Category Filter */}
          <div className="relative">
            <button 
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="flex items-center gap-2 px-3 py-2 bg-terminal-bg border border-terminal-border rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
            >
              <Filter className="w-4 h-4" />
              {categoryFilter || "Category"}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showCategoryDropdown && (
              <div className="absolute top-full mt-1 w-40 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-20">
                <button
                  onClick={() => { setCategoryFilter(""); setShowCategoryDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-terminal-muted hover:text-white"
                >
                  All Categories
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setCategoryFilter(cat); setShowCategoryDropdown(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-terminal-muted hover:text-white"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* State Filter */}
          <div className="relative">
            <button 
              onClick={() => setShowStateDropdown(!showStateDropdown)}
              className="flex items-center gap-2 px-3 py-2 bg-terminal-bg border border-terminal-border rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
            >
              {stateFilter || "State"}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showStateDropdown && (
              <div className="absolute top-full mt-1 w-36 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-20">
                <button
                  onClick={() => { setStateFilter(""); setShowStateDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-terminal-muted hover:text-white"
                >
                  All States
                </button>
                {states.map(s => (
                  <button
                    key={s}
                    onClick={() => { setStateFilter(s); setShowStateDropdown(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-terminal-muted hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Market Filter */}
          <div className="relative">
            <button 
              onClick={() => setShowMarketDropdown(!showMarketDropdown)}
              className="flex items-center gap-2 px-3 py-2 bg-terminal-bg border border-terminal-border rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
            >
              {marketFilter || "Market"}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showMarketDropdown && (
              <div className="absolute top-full mt-1 w-40 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-20">
                <button
                  onClick={() => { setMarketFilter(""); setShowMarketDropdown(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-terminal-muted hover:text-white"
                >
                  All Markets
                </button>
                {markets.map(m => (
                  <button
                    key={m}
                    onClick={() => { setMarketFilter(m); setShowMarketDropdown(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-terminal-muted hover:text-white"
                  >
                    {m}
                  </button>
                ))}
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
            Showing <span className="text-naija-green font-medium">{prices.length}</span> prices
          </span>
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
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-naija-green animate-spin mb-4" />
          <p className="text-gray-400">Loading prices...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-price-down mb-4">{error}</p>
          <button
            onClick={() => fetchPrices()}
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
            <table className="price-table">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th>ITEM</th>
                  <th>CATEGORY</th>
                  <th>MARKET</th>
                  <th>STATE</th>
                  <th className="numeric">PRICE (₦)</th>
                  <th className="numeric">CHANGE</th>
                  <th className="numeric">24H RANGE</th>
                  <th>CONFIDENCE</th>
                  <th>UPDATED</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {prices.map((item) => (
                  <tr 
                    key={item.id} 
                    className="group cursor-pointer"
                    onClick={() => handleRowClick(item)}
                  >
                    <td>
                      <button 
                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-naija-gold transition-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div>
                          <div className="font-medium text-white group-hover:text-naija-green transition-colors">
                            {item.item_name}
                          </div>
                          {item.item_variant && (
                            <div className="text-2xs text-gray-500">{item.item_variant}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="px-2 py-0.5 bg-terminal-muted text-gray-400 text-2xs rounded">
                        {item.category}
                      </span>
                    </td>
                    <td className="text-gray-400">{item.market_name}</td>
                    <td className="text-gray-500 text-xs">{item.state}</td>
                    <td className="numeric font-mono text-white text-lg">
                      {item.price_naira.toLocaleString()}
                    </td>
                    <td className="numeric">
                      <div className={`flex items-center justify-end gap-1 ${
                        item.change_percent > 0 ? "text-price-up" : 
                        item.change_percent < 0 ? "text-price-down" : "text-gray-500"
                      }`}>
                        {item.change_percent > 0 ? <TrendingUp className="w-3 h-3" /> : 
                         item.change_percent < 0 ? <TrendingDown className="w-3 h-3" /> : 
                         <Minus className="w-3 h-3" />}
                        <span>{item.change_percent >= 0 ? "+" : ""}{item.change_percent.toFixed(2)}%</span>
                      </div>
                      <div className="text-2xs text-gray-500 text-right mt-0.5">
                        {item.change_amount >= 0 ? "+" : ""}₦{Math.abs(item.change_amount).toLocaleString()}
                      </div>
                    </td>
                    <td className="numeric text-gray-400 font-mono text-xs">
                      <div>{item.low_24h.toLocaleString()}</div>
                      <div className="text-gray-600">to</div>
                      <div>{item.high_24h.toLocaleString()}</div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-terminal-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              item.confidence >= 85 ? "bg-price-up" : 
                              item.confidence >= 70 ? "bg-naija-gold" : 
                              item.confidence >= 50 ? "bg-orange-500" : "bg-price-down"
                            }`}
                            style={{ width: `${item.confidence}%` }}
                          />
                        </div>
                        <span className="text-2xs text-gray-500 w-8">{item.confidence}%</span>
                      </div>
                      <div className="text-2xs text-gray-600 mt-0.5">
                        {item.validators} validators
                      </div>
                    </td>
                    <td className="text-gray-500 text-xs">
                      <div>{formatTimeAgo(item.updated_at)}</div>
                      <div className="text-gray-600">
                        {item.source === "mock" ? "Demo" : "Verified"}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
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
          {prices.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-gray-400 mb-4">No prices found matching your filters</p>
              <button onClick={clearFilters} className="text-naija-green hover:text-white">
                Clear filters
              </button>
            </div>
          )}

          {/* Footer */}
          {prices.length > 0 && (
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
