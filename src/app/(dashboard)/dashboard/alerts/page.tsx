"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/lib/lang";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  Lock,
  CheckCircle2,
  X,
  Search,
  Clock,
  MapPin,
  Package,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface PriceAlert {
  alert_id: string;
  item_id: string;
  item_name: string;
  market_id: string;
  market_name: string;
  category_id?: string;
  category_name?: string;
  target_price: number;
  current_price: number | null;
  alert_type: "ABOVE" | "BELOW";
  status: "ACTIVE" | "TRIGGERED" | "PAUSED" | "DELETED";
  price_diff?: number;
  price_diff_percent?: string;
  should_trigger?: boolean;
  triggered_at?: string;
  created_at: string;
  updated_at: string;
}

interface AlertLimits {
  maxAlerts: number;
  canCreate: boolean;
  currentCount: number;
  remaining: number | string;
}

interface Item {
  item_id: string;
  item_name: string;
  category_id?: string;
  category_name?: string;
}

interface Market {
  market_id: string;
  market_name: string;
  state?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================================
// CREATE ALERT MODAL
// ============================================================================

interface CreateAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    item_id: string;
    item_name: string;
    market_id: string;
    market_name: string;
    category_id?: string;
    category_name?: string;
    target_price: number;
    alert_type: "ABOVE" | "BELOW";
  }) => void;
  loading: boolean;
}

function CreateAlertModal({ isOpen, onClose, onSubmit, loading }: CreateAlertModalProps) {
  const [step, setStep] = useState<"item" | "market" | "price">("item");
  const [items, setItems] = useState<Item[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [searchItem, setSearchItem] = useState("");
  const [searchMarket, setSearchMarket] = useState("");
  
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [targetPrice, setTargetPrice] = useState("");
  const [alertType, setAlertType] = useState<"ABOVE" | "BELOW">("BELOW");

  // Load items
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchItems = async () => {
      setLoadingData(true);
      try {
        const response = await fetch("/api/items");
        const data = await response.json();
        if (data.success) {
          setItems(data.data || []);
        }
      } catch (err) {
        console.error("Failed to load items:", err);
      } finally {
        setLoadingData(false);
      }
    };
    
    fetchItems();
  }, [isOpen]);

  // Load markets when item selected
  useEffect(() => {
    if (!selectedItem) return;
    
    const fetchMarkets = async () => {
      setLoadingData(true);
      try {
        const response = await fetch("/api/markets");
        const data = await response.json();
        if (data.success) {
          setMarkets(data.data || []);
        }
      } catch (err) {
        console.error("Failed to load markets:", err);
      } finally {
        setLoadingData(false);
      }
    };
    
    fetchMarkets();
  }, [selectedItem]);

  // Filter items by search
  const filteredItems = items.filter(item =>
    item.item_name.toLowerCase().includes(searchItem.toLowerCase())
  );

  // Filter markets by search
  const filteredMarkets = markets.filter(market =>
    market.market_name.toLowerCase().includes(searchMarket.toLowerCase())
  );

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep("item");
      setSelectedItem(null);
      setSelectedMarket(null);
      setTargetPrice("");
      setAlertType("BELOW");
      setSearchItem("");
      setSearchMarket("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!selectedItem || !selectedMarket || !targetPrice) return;
    
    onSubmit({
      item_id: selectedItem.item_id,
      item_name: selectedItem.item_name,
      market_id: selectedMarket.market_id,
      market_name: selectedMarket.market_name,
      category_id: selectedItem.category_id,
      category_name: selectedItem.category_name,
      target_price: parseFloat(targetPrice),
      alert_type: alertType,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Create Price Alert</h2>
            <p className="text-sm text-gray-500">
              {step === "item" && "Step 1: Select an item"}
              {step === "market" && "Step 2: Select a market"}
              {step === "price" && "Step 3: Set target price"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-800 text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Step 1: Select Item */}
          {step === "item" && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchItem}
                  onChange={(e) => setSearchItem(e.target.value)}
                  placeholder="Search items..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Items List */}
              {loadingData ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredItems.map((item) => (
                    <button
                      key={item.item_id}
                      onClick={() => {
                        setSelectedItem(item);
                        setStep("market");
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors text-left"
                    >
                      <Package className="w-5 h-5 text-amber-400" />
                      <div>
                        <div className="text-white font-medium">{item.item_name}</div>
                        {item.category_name && (
                          <div className="text-xs text-gray-500">{item.category_name}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Market */}
          {step === "market" && (
            <div className="space-y-4">
              {/* Selected Item */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-3">
                <Package className="w-5 h-5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">{selectedItem?.item_name}</span>
                <button
                  onClick={() => setStep("item")}
                  className="ml-auto text-xs text-gray-400 hover:text-white"
                >
                  Change
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchMarket}
                  onChange={(e) => setSearchMarket(e.target.value)}
                  placeholder="Search markets..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Markets List */}
              {loadingData ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredMarkets.map((market) => (
                    <button
                      key={market.market_id}
                      onClick={() => {
                        setSelectedMarket(market);
                        setStep("price");
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors text-left"
                    >
                      <MapPin className="w-5 h-5 text-blue-400" />
                      <div>
                        <div className="text-white font-medium">{market.market_name}</div>
                        {market.state && (
                          <div className="text-xs text-gray-500">{market.state}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Set Price */}
          {step === "price" && (
            <div className="space-y-4">
              {/* Selections Summary */}
              <div className="space-y-2">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-3">
                  <Package className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">{selectedItem?.item_name}</span>
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-blue-400" />
                  <span className="text-blue-400 font-medium">{selectedMarket?.market_name}</span>
                  <button
                    onClick={() => setStep("market")}
                    className="ml-auto text-xs text-gray-400 hover:text-white"
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Alert Type */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Alert when price goes:</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAlertType("BELOW")}
                    className={`
                      px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2
                      ${alertType === "BELOW"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500"
                        : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
                      }
                    `}
                  >
                    <TrendingDown className="w-5 h-5" />
                    Below
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlertType("ABOVE")}
                    className={`
                      px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2
                      ${alertType === "ABOVE"
                        ? "bg-red-500/20 text-red-400 border border-red-500"
                        : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
                      }
                    `}
                  >
                    <TrendingUp className="w-5 h-5" />
                    Above
                  </button>
                </div>
              </div>

              {/* Target Price */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Target Price (₦)</label>
                <input
                  type="number"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="e.g., 50000"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-lg placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "price" && (
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={handleSubmit}
              disabled={loading || !targetPrice}
              className="w-full py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Bell className="w-5 h-5" />
                  Create Alert
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function AlertsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useLang();

  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [limits, setLimits] = useState<AlertLimits>({ maxAlerts: 0, canCreate: false, currentCount: 0, remaining: 0 });
  const [triggeredToday, setTriggeredToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get user info
  const user = session?.user as { phone?: string; tier?: string } | undefined;
  const phone = user?.phone || "";
  const tier = user?.tier || "FREE";

  // Fetch alerts
  const fetchAlerts = async () => {
    if (!phone) return;
    
    try {
      const params = new URLSearchParams({ phone, tier });
      const response = await fetch(`/api/alerts?${params}`);
      const data = await response.json();

      if (data.success) {
        setAlerts(data.data.alerts || []);
        setLimits(data.data.limits || { maxAlerts: 0, canCreate: false, currentCount: 0, remaining: 0 });
        setTriggeredToday(data.data.triggeredToday || 0);
      } else {
        setError(data.error || "Failed to load alerts");
      }
    } catch (err) {
      setError("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && phone) {
      fetchAlerts();
    } else if (status === "authenticated" && !phone) {
      setLoading(false);
    }
  }, [phone, tier, status, router]);

  // Create alert
  const handleCreateAlert = async (data: {
    item_id: string;
    item_name: string;
    market_id: string;
    market_name: string;
    category_id?: string;
    category_name?: string;
    target_price: number;
    alert_type: "ABOVE" | "BELOW";
  }) => {
    setCreating(true);
    setError(null);
    
    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          subscription_tier: tier,
          ...data,
        }),
      });
      const result = await response.json();

      if (result.success) {
        setShowCreateModal(false);
        setSuccess("Price alert created successfully!");
        setTimeout(() => setSuccess(null), 3000);
        // Refresh alerts list
        await fetchAlerts();
      } else {
        setError(result.error || "Failed to create alert");
      }
    } catch (err) {
      setError("Failed to create alert");
    } finally {
      setCreating(false);
    }
  };

  // Delete alert
  const handleDeleteAlert = async (alertId: string) => {
    setDeleting(alertId);
    setError(null);
    
    try {
      const params = new URLSearchParams({ alert_id: alertId, phone });
      const response = await fetch(`/api/alerts?${params}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (result.success) {
        setAlerts(alerts.filter(a => a.alert_id !== alertId));
        setSuccess("Alert deleted");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "Failed to delete alert");
      }
    } catch (err) {
      setError("Failed to delete alert");
    } finally {
      setDeleting(null);
    }
  };

  // Loading state
  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // Unauthenticated
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl text-white mb-2">Sign In Required</h2>
          <p className="text-gray-400">Please sign in to manage your price alerts.</p>
        </div>
      </div>
    );
  }

  // Tier restriction (for FREE and SILVER users)
  if (limits.maxAlerts === 0 && alerts.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-8 text-center">
            <Lock className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">
              Upgrade to Create Price Alerts
            </h2>
            <p className="text-gray-400 mb-6">
              Price alerts are available for GOLD tier and above. Get notified when
              prices reach your target levels.
            </p>
            <div className="space-y-3">
              <div className="text-sm text-gray-500">
                <span className="text-amber-400">GOLD:</span> 5 alerts • 
                <span className="text-amber-400 ml-2">BUSINESS:</span> 10 alerts • 
                <span className="text-amber-400 ml-2">ENTERPRISE:</span> Unlimited
              </div>
              <button
                onClick={() => router.push("/settings")}
                className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600"
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
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Bell className="w-7 h-7 text-amber-400" />
              {t("alerts_title")}
            </h1>
            <p className="text-gray-400 mt-1">
              {t("alerts_subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {triggeredToday > 0 && (
              <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-sm rounded-full">
                {triggeredToday} triggered today
              </span>
            )}
            <span className="text-sm text-gray-500">
              {limits.currentCount} / {limits.maxAlerts === -1 ? "∞" : limits.maxAlerts} alerts
            </span>
            {limits.canCreate && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
              >
                <Plus className="w-5 h-5" />
                New Alert
              </button>
            )}
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-12 text-center">
            <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl text-white mb-2">{t("alerts_none")}</h3>
            <p className="text-gray-400 mb-6">
              Create your first alert to get notified when prices change.
            </p>
            {limits.canCreate && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create First Alert
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.alert_id}
                className={`
                  bg-[#1a1a1a] border rounded-xl p-4 transition-colors
                  ${alert.status === "TRIGGERED" || alert.should_trigger
                    ? "border-amber-500/50 bg-amber-500/5"
                    : "border-gray-800 hover:border-gray-700"
                  }
                `}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`
                      w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                      ${alert.status === "TRIGGERED" || alert.should_trigger ? "bg-amber-500/20" : "bg-gray-800"}
                    `}>
                      {alert.alert_type === "ABOVE" ? (
                        <TrendingUp className={`w-6 h-6 ${alert.status === "TRIGGERED" || alert.should_trigger ? "text-amber-400" : "text-red-400"}`} />
                      ) : (
                        <TrendingDown className={`w-6 h-6 ${alert.status === "TRIGGERED" || alert.should_trigger ? "text-amber-400" : "text-emerald-400"}`} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium">{alert.item_name}</span>
                        {(alert.status === "TRIGGERED" || alert.should_trigger) && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                            Triggered!
                          </span>
                        )}
                        {alert.status === "PAUSED" && (
                          <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded-full">
                            Paused
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {alert.market_name}
                      </div>
                      <div className="text-sm text-gray-400 mt-2">
                        {alert.alert_type === "ABOVE" ? (
                          <>Alert when price goes <span className="text-red-400">above</span> {formatPrice(alert.target_price)}</>
                        ) : (
                          <>Alert when price drops <span className="text-emerald-400">below</span> {formatPrice(alert.target_price)}</>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Current Price</div>
                      <div className="text-white font-medium">
                        {alert.current_price ? formatPrice(alert.current_price) : "—"}
                      </div>
                      {alert.price_diff_percent && (
                        <div className={`text-xs ${Number(alert.price_diff_percent) > 0 ? "text-red-400" : "text-emerald-400"}`}>
                          {Number(alert.price_diff_percent) > 0 ? "+" : ""}{alert.price_diff_percent}% from target
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(alert.triggered_at || alert.created_at)}
                      </div>
                      <button
                        onClick={() => handleDeleteAlert(alert.alert_id)}
                        disabled={deleting === alert.alert_id}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        {deleting === alert.alert_id ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <Trash2 className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Alert Modal */}
        <CreateAlertModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateAlert}
          loading={creating}
        />
      </div>
    </div>
  );
}
