"use client";

import { useState } from "react";
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
  BarChart3
} from "lucide-react";
import PriceHistoryModal from "@/components/PriceHistoryModal";

// ============================================================================
// TYPES
// ============================================================================

interface PriceItem {
  id: string;
  name: string;
  unit: string;
  category: string;
  market: string;
  state: string;
  price: number;
  change: number;
  priceChange: number;
  low: number;
  high: number;
  confidence: number;
  validators: number;
  updated: string;
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
  // State for the price history modal
  const [selectedPrice, setSelectedPrice] = useState<SelectedPrice | null>(null);

  // Handle row click to open modal
  const handleRowClick = (item: PriceItem) => {
    setSelectedPrice({
      item: item.name,
      itemSubtitle: item.unit,
      market: item.market,
      state: item.state,
      category: item.category,
      currentPrice: item.price,
      currentChange: item.change,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Live Prices</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time commodity prices from 226 markets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-terminal-surface border border-terminal-border rounded-lg text-sm text-gray-400 hover:text-white hover:bg-terminal-elevated transition-colors">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-terminal-surface border border-terminal-border rounded-lg text-sm text-gray-400 hover:text-white hover:bg-terminal-elevated transition-colors">
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
              className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 outline-none"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <button className="flex items-center gap-2 px-3 py-2 bg-terminal-bg border border-terminal-border rounded-lg text-sm text-gray-400 hover:text-white transition-colors">
              <Filter className="w-4 h-4" />
              Category
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* State Filter */}
          <div className="relative">
            <button className="flex items-center gap-2 px-3 py-2 bg-terminal-bg border border-terminal-border rounded-lg text-sm text-gray-400 hover:text-white transition-colors">
              State
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Market Filter */}
          <div className="relative">
            <button className="flex items-center gap-2 px-3 py-2 bg-terminal-bg border border-terminal-border rounded-lg text-sm text-gray-400 hover:text-white transition-colors">
              Market
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Price Trend Filter */}
          <div className="flex items-center gap-1 border-l border-terminal-border pl-4">
            <button className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-terminal-muted rounded transition-colors">
              All
            </button>
            <button className="px-2 py-1 text-xs text-price-up hover:bg-price-up/10 rounded transition-colors flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Up
            </button>
            <button className="px-2 py-1 text-xs text-price-down hover:bg-price-down/10 rounded transition-colors flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              Down
            </button>
          </div>

          {/* Active Filters */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-naija-green/20 text-naija-green text-xs rounded flex items-center gap-1">
              Lagos
              <button className="hover:text-white">×</button>
            </span>
            <span className="px-2 py-1 bg-naija-green/20 text-naija-green text-xs rounded flex items-center gap-1">
              Food
              <button className="hover:text-white">×</button>
            </span>
            <button className="text-xs text-gray-500 hover:text-white">
              Clear all
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-terminal-border">
          <span className="text-sm text-gray-500">
            Showing <span className="text-white font-medium">248</span> prices from <span className="text-white font-medium">12</span> markets
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort by:</span>
            <select className="bg-terminal-bg border border-terminal-border text-xs text-gray-400 rounded px-2 py-1 outline-none focus:border-naija-green">
              <option>Latest Update</option>
              <option>Price (Low to High)</option>
              <option>Price (High to Low)</option>
              <option>Change %</option>
              <option>Item Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Price Table */}
      <div className="bg-terminal-surface border border-terminal-border rounded-xl overflow-hidden">
        <div className="table-wrapper max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th>Item</th>
                <th>Category</th>
                <th>Market</th>
                <th>State</th>
                <th className="numeric">Price (₦)</th>
                <th className="numeric">Change</th>
                <th className="numeric">24h Range</th>
                <th>Confidence</th>
                <th>Updated</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {priceData.map((item, index) => (
                <tr 
                  key={index} 
                  className="group cursor-pointer hover:bg-terminal-elevated/50 transition-colors"
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
                          {item.name}
                        </div>
                        <div className="text-2xs text-gray-500">{item.unit}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="px-2 py-0.5 bg-terminal-muted text-gray-400 text-2xs rounded">
                      {item.category}
                    </span>
                  </td>
                  <td className="text-gray-400">{item.market}</td>
                  <td className="text-gray-500 text-xs">{item.state}</td>
                  <td className="numeric font-mono text-white text-lg">
                    {item.price.toLocaleString()}
                  </td>
                  <td className="numeric">
                    <div className={`flex items-center justify-end gap-1 ${
                      item.change > 0 ? "text-price-up" : 
                      item.change < 0 ? "text-price-down" : "text-gray-500"
                    }`}>
                      {item.change > 0 ? <TrendingUp className="w-3 h-3" /> : 
                       item.change < 0 ? <TrendingDown className="w-3 h-3" /> : 
                       <Minus className="w-3 h-3" />}
                      <span>{item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%</span>
                    </div>
                    <div className="text-2xs text-gray-500 text-right mt-0.5">
                      {item.change >= 0 ? "+" : ""}₦{Math.abs(item.priceChange).toLocaleString()}
                    </div>
                  </td>
                  <td className="numeric text-gray-400 font-mono text-xs">
                    <div>{item.low.toLocaleString()}</div>
                    <div className="text-gray-600">to</div>
                    <div>{item.high.toLocaleString()}</div>
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
                    <div>{item.updated}</div>
                    <div className="text-gray-600">{item.source}</div>
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

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-terminal-border flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Page 1 of 25
          </span>
          <div className="flex items-center gap-1">
            <button className="px-3 py-1 text-sm text-gray-500 bg-terminal-bg rounded hover:bg-terminal-muted transition-colors" disabled>
              Previous
            </button>
            <button className="px-3 py-1 text-sm text-white bg-naija-green/20 border border-naija-green/50 rounded">
              1
            </button>
            <button className="px-3 py-1 text-sm text-gray-400 bg-terminal-bg rounded hover:bg-terminal-muted transition-colors">
              2
            </button>
            <button className="px-3 py-1 text-sm text-gray-400 bg-terminal-bg rounded hover:bg-terminal-muted transition-colors">
              3
            </button>
            <span className="px-2 text-gray-500">...</span>
            <button className="px-3 py-1 text-sm text-gray-400 bg-terminal-bg rounded hover:bg-terminal-muted transition-colors">
              25
            </button>
            <button className="px-3 py-1 text-sm text-gray-400 bg-terminal-bg rounded hover:bg-terminal-muted transition-colors">
              Next
            </button>
          </div>
        </div>
      </div>

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
// MOCK DATA
// ============================================================================

const priceData: PriceItem[] = [
  { id: "rice-50kg", name: "Rice (50kg)", unit: "Foreign Parboiled", category: "Grains", market: "Mile 12", state: "Lagos", price: 78500, change: 2.3, priceChange: 1762, low: 75000, high: 82000, confidence: 92, validators: 3, updated: "2 min ago", source: "Verified" },
  { id: "beans-bag", name: "Beans (bag)", unit: "Brown/White", category: "Grains", market: "Mile 12", state: "Lagos", price: 62000, change: -1.2, priceChange: -753, low: 58000, high: 65000, confidence: 88, validators: 3, updated: "5 min ago", source: "Verified" },
  { id: "garri-bag", name: "Garri (bag)", unit: "White/Yellow", category: "Grains", market: "Iddo", state: "Lagos", price: 28000, change: 0.8, priceChange: 222, low: 26000, high: 30000, confidence: 85, validators: 3, updated: "3 min ago", source: "Verified" },
  { id: "palm-oil-25l", name: "Palm Oil", unit: "25 Liters", category: "Oils", market: "Mile 12", state: "Lagos", price: 52000, change: 1.5, priceChange: 769, low: 48000, high: 55000, confidence: 90, validators: 3, updated: "8 min ago", source: "Verified" },
  { id: "tomatoes-basket", name: "Tomatoes", unit: "Basket (Big)", category: "Vegetables", market: "Mile 12", state: "Lagos", price: 45000, change: -5.2, priceChange: -2468, low: 42000, high: 52000, confidence: 78, validators: 2, updated: "1 min ago", source: "Pending" },
  { id: "onions-bag", name: "Onions", unit: "Bag (50kg)", category: "Vegetables", market: "Kano Main", state: "Kano", price: 38500, change: 8.2, priceChange: 2918, low: 35000, high: 42000, confidence: 82, validators: 3, updated: "6 min ago", source: "Verified" },
  { id: "cement-bag", name: "Cement", unit: "Dangote 50kg", category: "Building", market: "Alaba", state: "Lagos", price: 6500, change: -0.3, priceChange: -20, low: 6200, high: 6800, confidence: 95, validators: 3, updated: "12 min ago", source: "Verified" },
  { id: "sugar-50kg", name: "Sugar", unit: "50kg Bag", category: "Sweeteners", market: "Mile 12", state: "Lagos", price: 85000, change: 0.5, priceChange: 422, low: 82000, high: 88000, confidence: 91, validators: 3, updated: "4 min ago", source: "Verified" },
  { id: "groundnut-oil", name: "Groundnut Oil", unit: "25 Liters", category: "Oils", market: "Onitsha", state: "Anambra", price: 58000, change: 2.1, priceChange: 1193, low: 54000, high: 62000, confidence: 87, validators: 3, updated: "10 min ago", source: "Verified" },
  { id: "yam-tuber", name: "Yam", unit: "Tuber (Large)", category: "Tubers", market: "Wuse", state: "FCT", price: 2800, change: 5.1, priceChange: 136, low: 2500, high: 3200, confidence: 75, validators: 2, updated: "15 min ago", source: "Pending" },
  { id: "pepper-basket", name: "Pepper", unit: "Basket (Rodo)", category: "Vegetables", market: "Ariaria", state: "Abia", price: 32000, change: 6.5, priceChange: 1951, low: 28000, high: 38000, confidence: 80, validators: 3, updated: "7 min ago", source: "Verified" },
  { id: "plantain-bunch", name: "Plantain", unit: "Bunch (Ripe)", category: "Fruits", market: "Mile 12", state: "Lagos", price: 4500, change: -3.8, priceChange: -178, low: 4000, high: 5500, confidence: 72, validators: 2, updated: "20 min ago", source: "Pending" },
];
