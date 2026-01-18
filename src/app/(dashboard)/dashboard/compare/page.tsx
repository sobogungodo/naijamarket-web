"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Search, 
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Trophy,
  Medal,
  Award,
  Sparkles,
  PiggyBank,
  X,
  AlertCircle,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface MarketPrice {
  marketId: string;
  marketName: string;
  state: string;
  price: number;
  trend: string | null;
  trendPercentage: number | null;
  updatedAt: string;
  rank: number;
  savings: number;
  savingsPercentage: number;
}

interface ComparisonResult {
  item: {
    id: string;
    name: string;
    category: string;
    unit: string;
  };
  lowestPrice: MarketPrice;
  highestPrice: MarketPrice;
  averagePrice: number;
  priceRange: number;
  markets: MarketPrice[];
  maxSavings: {
    amount: number;
    percentage: number;
    fromMarket: string;
    toMarket: string;
  };
}

interface Category {
  category_id: string;
  category_name: string;
}

interface Item {
  item_id: string;
  item_name: string;
  unit: string;
}

interface Market {
  market_id: string;
  market_name: string;
  state: string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function TrendIcon({ trend }: { trend: string | null }) {
  if (!trend) return <Minus className="w-4 h-4 text-gray-500" />;
  
  switch (trend.toUpperCase()) {
    case "UP":
      return <TrendingUp className="w-4 h-4 text-red-400" />;
    case "DOWN":
      return <TrendingDown className="w-4 h-4 text-emerald-400" />;
    default:
      return <Minus className="w-4 h-4 text-gray-500" />;
  }
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center gap-1 bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-xs">
        <Trophy className="w-3 h-3" />
        <span>Best Price</span>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center gap-1 bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full text-xs">
        <Medal className="w-3 h-3" />
        <span>2nd</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center gap-1 bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full text-xs">
        <Award className="w-3 h-3" />
        <span>3rd</span>
      </div>
    );
  }
  return null;
}

// ============================================================================
// SELECTION COMPONENTS
// ============================================================================

function CategorySelector({ 
  categories, 
  selected, 
  onSelect 
}: { 
  categories: Category[]; 
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p>No categories available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {categories.map((cat) => (
        <button
          key={cat.category_id}
          onClick={() => onSelect(cat.category_id)}
          className={`
            p-3 rounded-lg border text-left transition-all
            ${selected === cat.category_id 
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" 
              : "bg-[#1a1a1a] border-[#2a2a2a] text-gray-300 hover:border-gray-600"
            }
          `}
        >
          <span className="text-sm font-medium truncate block">{cat.category_name}</span>
        </button>
      ))}
    </div>
  );
}

function ItemSelector({ 
  items, 
  selected, 
  onSelect,
  loading 
}: { 
  items: Item[]; 
  selected: string | null;
  onSelect: (id: string, name: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // FIXED: Add empty state handling
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p>No items found in this category</p>
        <p className="text-sm mt-1">Try selecting a different category</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
      {items.map((item) => (
        <button
          key={item.item_id}
          onClick={() => onSelect(item.item_id, item.item_name || "")}
          className={`
            p-3 rounded-lg border text-left transition-all
            ${selected === item.item_id 
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" 
              : "bg-[#1a1a1a] border-[#2a2a2a] text-gray-300 hover:border-gray-600"
            }
          `}
        >
          <span className="text-sm font-medium truncate block">{item.item_name}</span>
          <span className="text-xs text-gray-500">{item.unit || "unit"}</span>
        </button>
      ))}
    </div>
  );
}

function MarketSelector({ 
  markets, 
  selected, 
  onToggle,
  maxMarkets,
  loading 
}: { 
  markets: Market[]; 
  selected: string[];
  onToggle: (id: string) => void;
  maxMarkets: number;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // FIXED: Add empty state handling
  if (!markets || markets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p>No markets available</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-gray-500 text-sm">
        Select up to {maxMarkets} markets ({selected.length}/{maxMarkets} selected)
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
        {markets.map((market) => {
          const isSelected = selected.includes(market.market_id);
          const isDisabled = !isSelected && selected.length >= maxMarkets;
          
          return (
            <button
              key={market.market_id}
              onClick={() => !isDisabled && onToggle(market.market_id)}
              disabled={isDisabled}
              className={`
                p-3 rounded-lg border text-left transition-all relative
                ${isSelected 
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" 
                  : isDisabled
                    ? "bg-[#1a1a1a] border-[#2a2a2a] text-gray-600 cursor-not-allowed opacity-50"
                    : "bg-[#1a1a1a] border-[#2a2a2a] text-gray-300 hover:border-gray-600"
                }
              `}
            >
              {isSelected && (
                <CheckCircle2 className="w-4 h-4 absolute top-2 right-2 text-emerald-400" />
              )}
              <span className="text-sm font-medium truncate block pr-6">{market.market_name}</span>
              <span className="text-xs text-gray-500">{market.state}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// RESULTS COMPONENT
// ============================================================================

function ComparisonResults({ result, onReset }: { result: ComparisonResult; onReset: () => void }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{result.item.name}</h2>
          <p className="text-gray-500 text-sm">
            {result.item.category} • {result.item.unit}
          </p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
          New Comparison
        </button>
      </div>

      {/* Savings Highlight */}
      <div className="bg-gradient-to-r from-emerald-500/20 to-amber-500/20 border border-emerald-500/30 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-emerald-500/30 rounded-full flex items-center justify-center">
            <PiggyBank className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Maximum Savings</p>
            <p className="text-3xl font-bold text-emerald-400 font-mono">
              ₦{result.maxSavings.amount.toLocaleString()}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-emerald-400 font-bold text-xl">
              {result.maxSavings.percentage}% off
            </p>
            <p className="text-gray-500 text-xs">
              vs {result.maxSavings.fromMarket}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>
            Buy from <span className="text-emerald-400 font-semibold">{result.lowestPrice.marketName}</span>
            {" "}instead of{" "}
            <span className="text-red-400">{result.highestPrice.marketName}</span>
          </span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-center">
          <p className="text-gray-500 text-xs mb-1">Lowest Price</p>
          <p className="text-emerald-400 font-bold font-mono text-lg">
            ₦{result.lowestPrice.price.toLocaleString()}
          </p>
          <p className="text-gray-500 text-xs truncate">{result.lowestPrice.marketName}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-center">
          <p className="text-gray-500 text-xs mb-1">Average Price</p>
          <p className="text-white font-bold font-mono text-lg">
            ₦{result.averagePrice.toLocaleString()}
          </p>
          <p className="text-gray-500 text-xs">Across {result.markets.length} markets</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-center">
          <p className="text-gray-500 text-xs mb-1">Highest Price</p>
          <p className="text-red-400 font-bold font-mono text-lg">
            ₦{result.highestPrice.price.toLocaleString()}
          </p>
          <p className="text-gray-500 text-xs truncate">{result.highestPrice.marketName}</p>
        </div>
      </div>

      {/* Market Comparison Table */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2a2a2a]">
          <h3 className="text-white font-semibold">Price Comparison</h3>
        </div>
        <div className="divide-y divide-[#2a2a2a]">
          {result.markets.map((market, index) => (
            <div 
              key={market.marketId}
              className={`
                p-4 flex items-center justify-between gap-4
                ${index === 0 ? "bg-emerald-500/5" : ""}
              `}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 font-mono text-sm flex-shrink-0">
                  {market.rank}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium truncate">{market.marketName}</span>
                    <RankBadge rank={market.rank} />
                  </div>
                  <span className="text-gray-500 text-sm">{market.state}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <TrendIcon trend={market.trend} />
                  {market.trendPercentage !== 0 && (
                    <span className={`text-xs ${market.trend === "UP" ? "text-red-400" : "text-emerald-400"}`}>
                      {market.trendPercentage}%
                    </span>
                  )}
                </div>
                
                <div className="text-right">
                  <p className={`font-bold font-mono ${index === 0 ? "text-emerald-400 text-lg" : "text-white"}`}>
                    ₦{market.price.toLocaleString()}
                  </p>
                  {market.savings > 0 && (
                    <p className="text-emerald-400 text-xs">
                      Save ₦{market.savings.toLocaleString()} ({market.savingsPercentage}%)
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function ComparePage() {
  const { data: session } = useSession();
  
  // Step tracking
  const [step, setStep] = useState<"category" | "item" | "markets" | "results">("category");
  
  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  
  // Selections
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ id: string; name: string } | null>(null);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  
  // Results
  const [result, setResult] = useState<ComparisonResult | null>(null);
  
  // Loading states
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  
  // Tier info
  const tier = (session?.user as { tier?: string })?.tier || "FREE";
  const maxMarkets = tier === "FREE" ? 2 : tier === "SILVER" ? 3 : 5;

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/categories");
        const data = await response.json();
        console.log("Categories API response:", data); // DEBUG
        if (data.success && data.data) {
          setCategories(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      } finally {
        setLoadingCategories(false);
      }
    };
    
    fetchCategories();
  }, []);

  // Fetch items when category selected
  useEffect(() => {
    if (!selectedCategory) return;
    
    const fetchItems = async () => {
      setLoadingItems(true);
      setItems([]); // Clear previous items
      try {
        const response = await fetch(`/api/items?category=${selectedCategory}`);
        const data = await response.json();
        console.log("Items API response:", data); // DEBUG
        console.log("Items count:", data.data?.length || 0); // DEBUG
        if (data.success && data.data) {
          setItems(data.data);
          setStep("item");
        } else {
          console.error("Items API failed or empty:", data);
          setStep("item"); // Still move to item step to show empty state
        }
      } catch (err) {
        console.error("Failed to fetch items:", err);
        setStep("item"); // Still move to item step to show error
      } finally {
        setLoadingItems(false);
      }
    };
    
    fetchItems();
  }, [selectedCategory]);

  // Fetch markets when item selected
  useEffect(() => {
    if (!selectedItem) return;
    
    const fetchMarkets = async () => {
      setLoadingMarkets(true);
      try {
        const response = await fetch("/api/markets");
        const data = await response.json();
        console.log("Markets API response:", data); // DEBUG
        if (data.success && data.data) {
          setMarkets(data.data);
          setStep("markets");
        }
      } catch (err) {
        console.error("Failed to fetch markets:", err);
      } finally {
        setLoadingMarkets(false);
      }
    };
    
    fetchMarkets();
  }, [selectedItem]);

  // Handle market toggle
  const handleMarketToggle = (marketId: string) => {
    setSelectedMarkets(prev => {
      if (prev.includes(marketId)) {
        return prev.filter(id => id !== marketId);
      }
      if (prev.length < maxMarkets) {
        return [...prev, marketId];
      }
      return prev;
    });
  };

  // Compare prices
  const handleCompare = async () => {
    if (!selectedItem || selectedMarkets.length < 2) return;
    
    setLoadingResults(true);
    try {
      const params = new URLSearchParams({
        item: selectedItem.name,
        markets: selectedMarkets.join(","),
        tier,
      });
      
      const response = await fetch(`/api/compare?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setResult(data.data);
        setStep("results");
      }
    } catch (err) {
      console.error("Failed to compare:", err);
    } finally {
      setLoadingResults(false);
    }
  };

  // Reset
  const handleReset = () => {
    setStep("category");
    setSelectedCategory(null);
    setSelectedItem(null);
    setSelectedMarkets([]);
    setResult(null);
    setItems([]);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-[#2a2a2a] bg-[#0f0f0f]">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Compare Markets</h1>
              <p className="text-gray-500 text-sm font-mono">COMP &lt;GO&gt;</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      {step !== "results" && (
        <div className="border-b border-[#2a2a2a]">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-2">
              {["category", "item", "markets"].map((s, index) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-mono
                    ${step === s 
                      ? "bg-emerald-500 text-black" 
                      : ["category", "item", "markets"].indexOf(step) > index
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-gray-800 text-gray-500"
                    }
                  `}>
                    {index + 1}
                  </div>
                  <span className={`text-sm ${step === s ? "text-white" : "text-gray-500"}`}>
                    {s === "category" ? "Category" : s === "item" ? "Item" : "Markets"}
                  </span>
                  {index < 2 && (
                    <ArrowRight className="w-4 h-4 text-gray-600 mx-2" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {step === "category" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Select Category</h2>
              {loadingCategories && <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />}
            </div>
            <CategorySelector
              categories={categories}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />
          </div>
        )}

        {step === "item" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <button 
                  onClick={() => { setStep("category"); setSelectedCategory(null); setItems([]); }}
                  className="text-gray-500 text-sm hover:text-white mb-1"
                >
                  ← Back to categories
                </button>
                <h2 className="text-lg font-semibold">Select Item</h2>
                <p className="text-gray-500 text-sm">
                  {items.length} items in this category
                </p>
              </div>
            </div>
            <ItemSelector
              items={items}
              selected={selectedItem?.id || null}
              onSelect={(id, name) => setSelectedItem({ id, name })}
              loading={loadingItems}
            />
          </div>
        )}

        {step === "markets" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <button 
                  onClick={() => { setStep("item"); setSelectedItem(null); setSelectedMarkets([]); }}
                  className="text-gray-500 text-sm hover:text-white mb-1"
                >
                  ← Back to items
                </button>
                <h2 className="text-lg font-semibold">
                  Select Markets to Compare
                </h2>
                <p className="text-gray-500 text-sm">
                  Comparing: <span className="text-emerald-400">{selectedItem?.name}</span>
                </p>
              </div>
            </div>
            
            <MarketSelector
              markets={markets}
              selected={selectedMarkets}
              onToggle={handleMarketToggle}
              maxMarkets={maxMarkets}
              loading={loadingMarkets}
            />
            
            {selectedMarkets.length >= 2 && (
              <div className="pt-4">
                <button
                  onClick={handleCompare}
                  disabled={loadingResults}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loadingResults ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Comparing...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Compare {selectedMarkets.length} Markets
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {step === "results" && result && (
          <ComparisonResults result={result} onReset={handleReset} />
        )}
      </div>
    </div>
  );
}
