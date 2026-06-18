"use client";

// ============================================================================
// src/app/(dashboard)/dashboard/bulk-buyer/page.tsx
// NaijaMarket Intel - Bulk Buyer Calculator Page
// Bloomberg Equivalent: PMON <GO> (Portfolio Monitor)
// Version: 1.0.0
// Date: 2026-01-25
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Calculator,
  MapPin,
  Package,
  AlertTriangle,
  RefreshCw,
  Download,
  Lock,
  Lightbulb,
  CheckCircle,
  Sparkles,
  Target,
  Building2,
} from "lucide-react";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface AvailableItem {
  id: string;
  name: string;
  category: string;
  unit: string;
}

interface CartItem {
  item: string;
  quantity: number;
  unit: string;
}

interface MarketQuote {
  market: string;
  marketId: string;
  state: string;
  region: string;
  unitPrice: number;
  totalPrice: number;
  available: boolean;
  priceRank: number;
  savingsVsAvg: number;
  savingsPercent: number;
}

interface ItemBreakdown {
  item: string;
  quantity: number;
  unit: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  priceRange: number;
  marketQuotes: MarketQuote[];
  bestMarket: { market: string; price: number; savings: number } | null;
  worstMarket: { market: string; price: number; premium: number } | null;
}

interface OptimalStrategy {
  totalCost: number;
  totalSavings: number;
  savingsPercent: number;
  purchases: {
    item: string;
    quantity: number;
    market: string;
    unitPrice: number;
    totalPrice: number;
  }[];
  marketBreakdown: {
    market: string;
    items: number;
    subtotal: number;
  }[];
}

interface TierLimits {
  tier: string;
  maxItems: number;
  showSavings: boolean;
  showOptimal: boolean;
  canExport: boolean;
}

interface CalculatorResponse {
  success: boolean;
  timestamp: string;
  cartSummary: {
    totalItems: number;
    totalQuantity: number;
    estimatedCost: number;
    potentialSavings: number;
    savingsPercent: number;
  };
  itemBreakdowns: ItemBreakdown[];
  optimalStrategy: OptimalStrategy | null;
  singleMarketComparison: {
    market: string;
    totalCost: number;
    vsOptimal: number;
    itemsAvailable: number;
  }[];
  insights: {
    type: string;
    message: string;
    impact: "high" | "medium" | "low";
  }[];
  tierLimits: TierLimits;
  dataSource: string;
  recordCount: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function BulkBuyerPage() {
  const { status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [results, setResults] = useState<CalculatorResponse | null>(null);
  const [tierLimits, setTierLimits] = useState<TierLimits | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeTab, setActiveTab] = useState<"breakdown" | "optimal" | "compare">("breakdown");
  
  const userTier = "GOLD"; // Would come from session
  
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);
  
  // Fetch available items on mount
  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/bulk-calculator?tier=${userTier}`);
        const data = await response.json();
        if (data.success) {
          setAvailableItems(data.items);
          setTierLimits(data.tierLimits);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load items");
      } finally {
        setLoading(false);
      }
    };
    
    if (status === "authenticated") {
      fetchItems();
    }
  }, [status, userTier]);
  
  const addToCart = (item: AvailableItem) => {
    const existingIdx = cart.findIndex(c => c.item === item.name);
    if (existingIdx >= 0) {
      const newCart = [...cart];
      const existing = newCart[existingIdx];
      if (existing) {
        existing.quantity += 1;
      }
      setCart(newCart);
    } else {
      if (tierLimits && cart.length >= tierLimits.maxItems) {
        setError(`Maximum ${tierLimits.maxItems} items allowed for ${tierLimits.tier} tier`);
        return;
      }
      setCart([...cart, { item: item.name, quantity: 1, unit: item.unit }]);
    }
    setResults(null);
  };
  
  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    if (item) {
      item.quantity = Math.max(1, item.quantity + delta);
      setCart(newCart);
      setResults(null);
    }
  };
  
  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
    setResults(null);
  };
  
  const clearCart = () => {
    setCart([]);
    setResults(null);
  };
  
  const calculateBulk = useCallback(async () => {
    if (cart.length === 0) {
      setError("Add items to cart first");
      return;
    }
    
    setCalculating(true);
    setError(null);
    
    try {
      const response = await fetch("/api/bulk-calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart, tier: userTier }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResults(data);
        setActiveTab("breakdown");
      } else {
        setError(data.error || "Calculation failed");
      }
    } catch (err) {
      setError("Failed to calculate");
      console.error(err);
    } finally {
      setCalculating(false);
    }
  }, [cart, userTier]);
  
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };
  
  const handleExport = () => {
    if (!results || !tierLimits?.canExport) {
      setError("Export available for GOLD tier and above");
      return;
    }
    
    let csv = "BULK BUYER CALCULATOR - NAIJAMARKET INTEL\n";
    csv += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    csv += "CART SUMMARY\n";
    csv += `Total Items,${results.cartSummary.totalItems}\n`;
    csv += `Total Quantity,${results.cartSummary.totalQuantity}\n`;
    csv += `Estimated Cost,${results.cartSummary.estimatedCost}\n`;
    csv += `Potential Savings,${results.cartSummary.potentialSavings}\n\n`;
    
    csv += "ITEM BREAKDOWN\n";
    csv += "Item,Quantity,Unit,Avg Price,Min Price,Max Price,Best Market\n";
    results.itemBreakdowns.forEach(b => {
      csv += `${b.item},${b.quantity},${b.unit},${b.avgPrice},${b.minPrice},${b.maxPrice},${b.bestMarket?.market ?? "N/A"}\n`;
    });
    
    if (results.optimalStrategy) {
      csv += "\nOPTIMAL STRATEGY\n";
      csv += "Item,Quantity,Market,Unit Price,Total\n";
      results.optimalStrategy.purchases.forEach(p => {
        csv += `${p.item},${p.quantity},${p.market},${p.unitPrice},${p.totalPrice}\n`;
      });
      csv += `\nTOTAL,,,${results.optimalStrategy.totalCost}\n`;
      csv += `SAVINGS,,,${results.optimalStrategy.totalSavings}\n`;
    }
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bulk_order_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const categories = ["All", ...new Set(availableItems.map(i => i.category))];
  const filteredItems = selectedCategory === "All" 
    ? availableItems 
    : availableItems.filter(i => i.category === selectedCategory);
  
  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading bulk buyer tool...</p>
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
              <ShoppingCart className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl md:text-3xl font-bold">Bulk Buyer Tool</h1>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">PMON</span>
            </div>
            <p className="text-gray-400 text-sm">
              Calculate optimal bulk purchase costs across markets
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {results && (
              <button
                onClick={handleExport}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  tierLimits?.canExport
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-gray-700 cursor-not-allowed"
                }`}
              >
                {tierLimits?.canExport ? <Download className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                Export
              </button>
            )}
          </div>
        </div>
        
        {/* Tier Banner */}
        {tierLimits && !tierLimits.showOptimal && (
          <div className="mt-4 bg-gradient-to-r from-amber-900/30 to-orange-800/20 border border-amber-700/50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-amber-200 font-medium">Limited to {tierLimits.maxItems} items</p>
                <p className="text-amber-400/70 text-sm">Upgrade to GOLD for optimal strategy & savings analysis</p>
              </div>
            </div>
            <button onClick={() => router.push("/subscribe")} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">
              Upgrade
            </button>
          </div>
        )}
      </div>
      
      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">×</button>
        </div>
      )}
      
      <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left Column - Item Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  selectedCategory === cat
                    ? "bg-emerald-600 text-white"
                    : "bg-[#1a1a1a] text-gray-400 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          
          {/* Item Grid */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-400" />
              Select Items ({tierLimits?.maxItems ?? 10} max)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredItems.map(item => {
                const inCart = cart.some(c => c.item === item.name);
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className={`p-3 rounded-lg text-left transition-all ${
                      inCart
                        ? "bg-emerald-900/30 border-2 border-emerald-500"
                        : "bg-[#252525] border border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.category}</p>
                    {inCart && (
                      <div className="mt-1 flex items-center gap-1 text-emerald-400 text-xs">
                        <CheckCircle className="w-3 h-3" />
                        In cart
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Results Section */}
          {results && (
            <div className="space-y-4">
              {/* Result Summary */}
              <div className="bg-gradient-to-br from-emerald-900/30 to-green-900/20 border border-emerald-700/50 rounded-xl p-4 md:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">Items</p>
                    <p className="text-2xl font-bold text-white">{results.cartSummary.totalItems}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">Quantity</p>
                    <p className="text-2xl font-bold text-white">{results.cartSummary.totalQuantity}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">Est. Cost</p>
                    <p className="text-2xl font-bold text-white">{formatPrice(results.cartSummary.estimatedCost)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">Savings</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {tierLimits?.showSavings ? formatPrice(results.cartSummary.potentialSavings) : <Lock className="w-5 h-5 inline" />}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setActiveTab("breakdown")}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                    activeTab === "breakdown" ? "bg-emerald-600 text-white" : "bg-[#1a1a1a] text-gray-400"
                  }`}
                >
                  <Package className="w-4 h-4 inline mr-2" />
                  Item Breakdown
                </button>
                <button
                  onClick={() => setActiveTab("optimal")}
                  disabled={!tierLimits?.showOptimal}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                    activeTab === "optimal" ? "bg-emerald-600 text-white" : 
                    tierLimits?.showOptimal ? "bg-[#1a1a1a] text-gray-400" : "bg-[#1a1a1a] text-gray-600 cursor-not-allowed"
                  }`}
                >
                  <Target className="w-4 h-4 inline mr-2" />
                  Optimal Strategy
                  {!tierLimits?.showOptimal && <Lock className="w-3 h-3 inline ml-1" />}
                </button>
                <button
                  onClick={() => setActiveTab("compare")}
                  disabled={!tierLimits?.showSavings}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                    activeTab === "compare" ? "bg-emerald-600 text-white" : 
                    tierLimits?.showSavings ? "bg-[#1a1a1a] text-gray-400" : "bg-[#1a1a1a] text-gray-600 cursor-not-allowed"
                  }`}
                >
                  <Building2 className="w-4 h-4 inline mr-2" />
                  Market Compare
                  {!tierLimits?.showSavings && <Lock className="w-3 h-3 inline ml-1" />}
                </button>
              </div>
              
              {/* Tab Content */}
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
                {activeTab === "breakdown" && (
                  <div className="space-y-4">
                    {results.itemBreakdowns.map((item, idx) => (
                      <div key={idx} className="p-4 bg-[#252525] rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold">{item.item}</p>
                            <p className="text-sm text-gray-500">{item.quantity} × {item.unit}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-400">Price Range</p>
                            <p className="font-medium">
                              {formatPrice(item.minPrice)} - {formatPrice(item.maxPrice)}
                            </p>
                          </div>
                        </div>
                        
                        {item.bestMarket && tierLimits?.showSavings && (
                          <div className="flex items-center justify-between p-2 bg-emerald-900/30 rounded-lg text-sm">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-emerald-400" />
                              <span className="text-emerald-300">Best: {item.bestMarket.market}</span>
                            </div>
                            <span className="text-emerald-400 font-medium">
                              Save {formatPrice(item.bestMarket.savings)}
                            </span>
                          </div>
                        )}
                        
                        {/* Market quotes preview */}
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-2">
                          {item.marketQuotes.slice(0, 4).map((quote, qIdx) => (
                            <div key={qIdx} className={`p-2 rounded text-xs ${
                              qIdx === 0 ? "bg-emerald-900/30 border border-emerald-700" : "bg-[#1a1a1a]"
                            }`}>
                              <p className="text-gray-400 truncate">{quote.market.split(" ")[0]}</p>
                              <p className="font-medium">{formatPrice(quote.unitPrice)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {activeTab === "optimal" && results.optimalStrategy && (
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-emerald-900/30 to-green-900/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-emerald-400" />
                        <span className="font-semibold">Optimal Shopping List</span>
                      </div>
                      <p className="text-sm text-gray-400">
                        Following this strategy saves you {formatPrice(results.optimalStrategy.totalSavings)} 
                        ({results.optimalStrategy.savingsPercent}% off average prices)
                      </p>
                    </div>
                    
                    {results.optimalStrategy.marketBreakdown.map((market, idx) => (
                      <div key={idx} className="p-4 bg-[#252525] rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-blue-400" />
                            <span className="font-semibold">{market.market}</span>
                          </div>
                          <span className="font-bold text-lg">{formatPrice(market.subtotal)}</span>
                        </div>
                        <div className="space-y-2">
                          {results.optimalStrategy?.purchases
                            .filter(p => p.market === market.market)
                            .map((purchase, pIdx) => (
                              <div key={pIdx} className="flex items-center justify-between text-sm p-2 bg-[#1a1a1a] rounded">
                                <div>
                                  <span className="text-gray-300">{purchase.item}</span>
                                  <span className="text-gray-500 ml-2">×{purchase.quantity}</span>
                                </div>
                                <span className="font-medium">{formatPrice(purchase.totalPrice)}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex items-center justify-between p-4 bg-emerald-900/30 rounded-lg">
                      <span className="font-semibold text-lg">Total Cost</span>
                      <span className="font-bold text-2xl text-emerald-400">
                        {formatPrice(results.optimalStrategy.totalCost)}
                      </span>
                    </div>
                  </div>
                )}
                
                {activeTab === "compare" && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-400 mb-4">
                      What if you bought everything from a single market?
                    </p>
                    {results.singleMarketComparison.map((market, idx) => (
                      <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${
                        idx === 0 ? "bg-emerald-900/30 border border-emerald-700" : "bg-[#252525]"
                      }`}>
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0 ? "bg-emerald-500 text-white" : "bg-gray-700 text-gray-400"
                          }`}>
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-medium">{market.market}</p>
                            <p className="text-xs text-gray-500">{market.itemsAvailable} items available</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatPrice(market.totalCost)}</p>
                          {market.vsOptimal > 0 && (
                            <p className="text-xs text-red-400">+{formatPrice(market.vsOptimal)} vs optimal</p>
                          )}
                          {market.vsOptimal === 0 && (
                            <p className="text-xs text-emerald-400">Best option!</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Insights */}
              {results.insights.length > 0 && tierLimits?.showSavings && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-5 h-5 text-amber-400" />
                    <h3 className="font-semibold">Insights</h3>
                  </div>
                  <div className="space-y-2">
                    {results.insights.map((insight, idx) => (
                      <div key={idx} className={`p-3 rounded-lg ${
                        insight.impact === "high" ? "bg-emerald-900/30 border border-emerald-700" :
                        insight.impact === "medium" ? "bg-amber-900/20 border border-amber-700/50" :
                        "bg-[#252525]"
                      }`}>
                        <p className="text-sm">{insight.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Right Column - Cart */}
        <div className="lg:col-span-1">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
                Your Cart ({cart.length})
              </h3>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-300">
                  Clear All
                </button>
              )}
            </div>
            
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">Your cart is empty</p>
                <p className="text-xs text-gray-600 mt-1">Click items to add them</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item, idx) => (
                  <div key={idx} className="p-3 bg-[#252525] rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{item.item}</p>
                        <p className="text-xs text-gray-500">{item.unit}</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(idx)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(idx, -1)}
                          className="w-8 h-8 flex items-center justify-center bg-[#1a1a1a] rounded-lg hover:bg-[#333]"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-12 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(idx, 1)}
                          className="w-8 h-8 flex items-center justify-center bg-[#1a1a1a] rounded-lg hover:bg-[#333]"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                <button
                  onClick={calculateBulk}
                  disabled={calculating || cart.length === 0}
                  className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {calculating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-5 h-5" />
                      Calculate Best Prices
                    </>
                  )}
                </button>
              </div>
            )}
            
            {/* Tier Info */}
            {tierLimits && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-500 mb-2">Your Plan: {tierLimits.tier}</p>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    {tierLimits.showOptimal ? (
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Lock className="w-3 h-3 text-gray-500" />
                    )}
                    <span className={tierLimits.showOptimal ? "text-gray-300" : "text-gray-500"}>
                      Optimal Strategy
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {tierLimits.showSavings ? (
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Lock className="w-3 h-3 text-gray-500" />
                    )}
                    <span className={tierLimits.showSavings ? "text-gray-300" : "text-gray-500"}>
                      Savings Analysis
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {tierLimits.canExport ? (
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Lock className="w-3 h-3 text-gray-500" />
                    )}
                    <span className={tierLimits.canExport ? "text-gray-300" : "text-gray-500"}>
                      Export to CSV
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>Data Source: {results?.dataSource ?? "Not calculated yet"}</p>
        <p className="mt-1">Prices are indicative and may vary. Always confirm with vendors.</p>
      </div>
    </div>
  );
}
