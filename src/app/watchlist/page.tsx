"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Star, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  MapPin, 
  Package,
  RefreshCw,
  Search,
  X,
  Lock,
  Eye,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface WatchlistItem {
  id: string;
  type: "market" | "item";
  targetId: string;
  targetName: string;
  category?: string;
  state?: string;
  currentPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  trend?: string;
  lastUpdated?: string;
  addedAt: string;
}

interface WatchlistSummary {
  markets: WatchlistItem[];
  items: WatchlistItem[];
  totalMarkets: number;
  totalItems: number;
  limits: {
    markets: number;
    items: number;
  };
  canAddMarket: boolean;
  canAddItem: boolean;
}

interface Market {
  market_id: string;
  market_name: string;
  state: string;
}

interface Item {
  item_id: string;
  item_name: string;
  unit: string;
  Categories?: {
    category_name: string;
  };
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function TrendIcon({ trend }: { trend?: string }) {
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

function EmptyState({ 
  type, 
  canAdd, 
  onAdd 
}: { 
  type: "market" | "item"; 
  canAdd: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
        {type === "market" ? (
          <MapPin className="w-8 h-8 text-gray-600" />
        ) : (
          <Package className="w-8 h-8 text-gray-600" />
        )}
      </div>
      <h3 className="text-gray-400 font-medium mb-2">
        No Favorite {type === "market" ? "Markets" : "Items"} Yet
      </h3>
      <p className="text-gray-500 text-sm mb-4 max-w-xs mx-auto">
        {type === "market" 
          ? "Save your frequently visited markets for quick access"
          : "Track your most-watched items to monitor prices"
        }
      </p>
      {canAdd && (
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add {type === "market" ? "Market" : "Item"}
        </button>
      )}
    </div>
  );
}

function WatchlistCard({ 
  item, 
  onRemove,
  onView
}: { 
  item: WatchlistItem; 
  onRemove: () => void;
  onView: () => void;
}) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    setRemoving(true);
    await onRemove();
    setRemoving(false);
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 hover:border-gray-600 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
            ${item.type === "market" ? "bg-blue-500/20" : "bg-amber-500/20"}
          `}>
            {item.type === "market" ? (
              <MapPin className="w-5 h-5 text-blue-400" />
            ) : (
              <Package className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-white font-medium truncate">{item.targetName}</h3>
            <p className="text-gray-500 text-sm">
              {item.type === "market" ? item.state : item.category}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {item.currentPrice && (
            <div className="text-right">
              <p className="text-white font-mono">
                ₦{item.currentPrice.toLocaleString()}
              </p>
              <div className="flex items-center gap-1 justify-end">
                <TrendIcon trend={item.trend} />
                {item.priceChangePercent !== undefined && item.priceChangePercent !== 0 && (
                  <span className={`text-xs ${item.trend === "UP" ? "text-red-400" : "text-emerald-400"}`}>
                    {item.priceChangePercent > 0 ? "+" : ""}{item.priceChangePercent}%
                  </span>
                )}
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onView}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="View details"
            >
              <Eye className="w-4 h-4 text-gray-400 hover:text-white" />
            </button>
            <button
              onClick={handleRemove}
              disabled={removing}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
              title="Remove from watchlist"
            >
              {removing ? (
                <RefreshCw className="w-4 h-4 text-red-400 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ADD MODAL COMPONENT
// ============================================================================

function AddModal({ 
  type, 
  onClose, 
  onAdd,
  markets,
  items,
  loading 
}: { 
  type: "market" | "item";
  onClose: () => void;
  onAdd: (name: string) => Promise<void>;
  markets: Market[];
  items: Item[];
  loading: boolean;
}) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const filteredMarkets = markets.filter(m => 
    m.market_name.toLowerCase().includes(search.toLowerCase()) ||
    m.state?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredItems = items.filter(i => 
    i.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.Categories?.category_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (name: string) => {
    setAdding(name);
    await onAdd(name);
    setAdding(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Add {type === "market" ? "Market" : "Item"} to Watchlist
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2 bg-[#0f0f0f] rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder={`Search ${type === "market" ? "markets" : "items"}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-white flex-1"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
            </div>
          ) : type === "market" ? (
            <div className="space-y-2">
              {filteredMarkets.slice(0, 20).map((market) => (
                <button
                  key={market.market_id}
                  onClick={() => handleAdd(market.market_name)}
                  disabled={adding === market.market_name}
                  className="w-full p-3 bg-[#0f0f0f] hover:bg-[#2a2a2a] rounded-lg text-left transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="text-white font-medium">{market.market_name}</p>
                    <p className="text-gray-500 text-sm">{market.state}</p>
                  </div>
                  {adding === market.market_name ? (
                    <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 text-gray-500 hover:text-emerald-400" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.slice(0, 20).map((item) => (
                <button
                  key={item.item_id}
                  onClick={() => handleAdd(item.item_name || "")}
                  disabled={adding === item.item_name}
                  className="w-full p-3 bg-[#0f0f0f] hover:bg-[#2a2a2a] rounded-lg text-left transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="text-white font-medium">{item.item_name}</p>
                    <p className="text-gray-500 text-sm">
                      {item.Categories?.category_name} • {item.unit}
                    </p>
                  </div>
                  {adding === item.item_name ? (
                    <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 text-gray-500 hover:text-emerald-400" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function WatchlistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [watchlist, setWatchlist] = useState<WatchlistSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState<"market" | "item" | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"markets" | "items">("markets");
  
  // Success message
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get user info
  const phone = (session?.user as { phone?: string })?.phone || "";
  const tier = (session?.user as { tier?: string })?.tier || "FREE";
  const isUpgradeNeeded = tier === "FREE";

  // Fetch watchlist
  const fetchWatchlist = async () => {
    if (!phone && status === "authenticated") {
      setError("Phone number not found");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({ phone, tier });
      const response = await fetch(`/api/watchlist?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setWatchlist(data.data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  };

  // Fetch markets/items for add modal
  const fetchOptions = async () => {
    setLoadingOptions(true);
    try {
      const [marketsRes, itemsRes] = await Promise.all([
        fetch("/api/markets"),
        fetch("/api/items"),
      ]);
      
      const marketsData = await marketsRes.json();
      const itemsData = await itemsRes.json();
      
      if (marketsData.success) setMarkets(marketsData.data);
      if (itemsData.success) setItems(itemsData.data);
    } catch (err) {
      console.error("Failed to fetch options:", err);
    } finally {
      setLoadingOptions(false);
    }
  };

  // Add to watchlist
  const handleAdd = async (targetName: string) => {
    if (!showAddModal) return;
    
    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          type: showAddModal,
          targetName,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccessMessage(`${targetName} added to favorites!`);
        setTimeout(() => setSuccessMessage(null), 3000);
        setShowAddModal(null);
        fetchWatchlist();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to add to watchlist");
    }
  };

  // Remove from watchlist
  const handleRemove = async (type: "market" | "item", targetName: string) => {
    try {
      const response = await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          type,
          targetName,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccessMessage(`${targetName} removed from favorites`);
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchWatchlist();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to remove from watchlist");
    }
  };

  // View details
  const handleView = (type: "market" | "item", name: string) => {
    if (type === "market") {
      router.push(`/snapshot?market=${encodeURIComponent(name)}`);
    } else {
      router.push(`/compare?item=${encodeURIComponent(name)}`);
    }
  };

  // Effects
  useEffect(() => {
    if (status === "authenticated" && phone) {
      fetchWatchlist();
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, phone]);

  useEffect(() => {
    if (showAddModal) {
      fetchOptions();
    }
  }, [showAddModal]);

  // ============================================================================
  // RENDER
  // ============================================================================

  // Not logged in
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="max-w-4xl mx-auto px-4 py-20">
          <div className="text-center">
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Star className="w-10 h-10 text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold mb-4">My Watchlist</h1>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Save your favorite markets and items for quick access. Sign in to get started.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Upgrade needed (FREE tier)
  if (isUpgradeNeeded) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="max-w-4xl mx-auto px-4 py-20">
          <div className="text-center">
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Watchlist</h1>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Track your favorite markets and items. This feature requires a SILVER subscription or higher.
            </p>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6 max-w-md mx-auto">
              <h3 className="text-amber-400 font-semibold mb-4">Watchlist Limits by Tier:</h3>
              <ul className="text-left space-y-2 text-gray-300 text-sm">
                <li className="flex justify-between">
                  <span className="text-gray-500">FREE</span>
                  <span>No watchlist</span>
                </li>
                <li className="flex justify-between">
                  <span>SILVER</span>
                  <span>1 market, 3 items</span>
                </li>
                <li className="flex justify-between">
                  <span>GOLD</span>
                  <span>3 markets, 10 items</span>
                </li>
                <li className="flex justify-between">
                  <span>BUSINESS</span>
                  <span>5 markets, 20 items</span>
                </li>
                <li className="flex justify-between text-amber-400">
                  <span>ENTERPRISE</span>
                  <span>Unlimited</span>
                </li>
              </ul>
              <button
                onClick={() => router.push("/subscribe")}
                className="w-full mt-6 bg-amber-500 hover:bg-amber-600 text-black font-semibold py-3 rounded-lg transition-colors"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Success Message */}
      {successMessage && (
        <div className="fixed top-4 right-4 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-2 z-50 animate-fade-in">
          <CheckCircle2 className="w-5 h-5" />
          {successMessage}
        </div>
      )}

      {/* Header */}
      <div className="border-b border-[#2a2a2a] bg-[#0f0f0f]">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">My Watchlist</h1>
                <p className="text-gray-500 text-sm font-mono">MOST &lt;GO&gt;</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {watchlist && (
                <span className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full">
                  {watchlist.totalMarkets} markets • {watchlist.totalItems} items
                </span>
              )}
              <button
                onClick={fetchWatchlist}
                disabled={loading}
                className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] px-4 py-2 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#2a2a2a]">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("markets")}
              className={`
                py-4 px-2 border-b-2 transition-colors flex items-center gap-2
                ${activeTab === "markets" 
                  ? "border-emerald-500 text-emerald-400" 
                  : "border-transparent text-gray-500 hover:text-white"
                }
              `}
            >
              <MapPin className="w-4 h-4" />
              Markets ({watchlist?.totalMarkets || 0})
            </button>
            <button
              onClick={() => setActiveTab("items")}
              className={`
                py-4 px-2 border-b-2 transition-colors flex items-center gap-2
                ${activeTab === "items" 
                  ? "border-emerald-500 text-emerald-400" 
                  : "border-transparent text-gray-500 hover:text-white"
                }
              `}
            >
              <Package className="w-4 h-4" />
              Items ({watchlist?.totalItems || 0})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-4" />
              <p className="text-gray-400">{error}</p>
              <button
                onClick={fetchWatchlist}
                className="mt-4 text-emerald-400 hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Add Button */}
            {watchlist && (
              <div className="flex justify-end">
                {activeTab === "markets" && watchlist.canAddMarket && (
                  <button
                    onClick={() => setShowAddModal("market")}
                    className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-4 py-2 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Market
                  </button>
                )}
                {activeTab === "items" && watchlist.canAddItem && (
                  <button
                    onClick={() => setShowAddModal("item")}
                    className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-4 py-2 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                )}
              </div>
            )}

            {/* Markets Tab */}
            {activeTab === "markets" && (
              watchlist?.markets.length === 0 ? (
                <EmptyState 
                  type="market" 
                  canAdd={watchlist?.canAddMarket || false}
                  onAdd={() => setShowAddModal("market")}
                />
              ) : (
                <div className="space-y-2">
                  {watchlist?.markets.map((item) => (
                    <WatchlistCard
                      key={item.id}
                      item={item}
                      onRemove={() => handleRemove("market", item.targetName)}
                      onView={() => handleView("market", item.targetName)}
                    />
                  ))}
                </div>
              )
            )}

            {/* Items Tab */}
            {activeTab === "items" && (
              watchlist?.items.length === 0 ? (
                <EmptyState 
                  type="item" 
                  canAdd={watchlist?.canAddItem || false}
                  onAdd={() => setShowAddModal("item")}
                />
              ) : (
                <div className="space-y-2">
                  {watchlist?.items.map((item) => (
                    <WatchlistCard
                      key={item.id}
                      item={item}
                      onRemove={() => handleRemove("item", item.targetName)}
                      onView={() => handleView("item", item.targetName)}
                    />
                  ))}
                </div>
              )
            )}

            {/* Limits Info */}
            {watchlist && (
              <div className="mt-8 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
                <p className="text-gray-500 text-sm">
                  <span className="text-gray-400">Your {tier} tier limits:</span>{" "}
                  {watchlist.limits.markets < 0 ? "Unlimited" : watchlist.limits.markets} markets,{" "}
                  {watchlist.limits.items < 0 ? "Unlimited" : watchlist.limits.items} items
                  {(watchlist.limits.markets > 0 || watchlist.limits.items > 0) && (
                    <> • <button onClick={() => router.push("/subscribe")} className="text-emerald-400 hover:underline">Upgrade for more</button></>
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddModal
          type={showAddModal}
          onClose={() => setShowAddModal(null)}
          onAdd={handleAdd}
          markets={markets}
          items={items}
          loading={loadingOptions}
        />
      )}
    </div>
  );
}
