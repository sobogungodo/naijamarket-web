// ============================================================================
// src/app/(dashboard)/dashboard/morning-brief/page.tsx
// NaijaMarket Intel - Morning Brief Management Page
// Version: 1.0.0 | Date: 2026-02-20
// ============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sun, Clock, MapPin, ShoppingBasket, Bell, BellOff,
  Check, Pause, Play, Trash2, ChevronRight, Sparkles,
  Send, Eye, AlertCircle, Loader2, TrendingUp, TrendingDown,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface Subscription {
  brief_id: string;
  phone_number: string;
  plan_type: "DEFAULT" | "PERSONALIZED";
  price_weekly: number;
  billing_status: string;
  delivery_time: string;
  delivery_channel: string;
  status: string;
  last_sent_at: string | null;
  total_sent: number;
  selected_markets: string;
  selected_items: string;
  created_at: string;
}

interface Market {
  market_id: string;
  market_name: string;
  state: string;
}

interface Item {
  item_id: string;
  item_name: string;
  category: string;
  unit: string;
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function MorningBriefPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [planType, setPlanType] = useState<"DEFAULT" | "PERSONALIZED">("DEFAULT");
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [deliveryTime, setDeliveryTime] = useState("05:30");
  const [deliveryChannel, setDeliveryChannel] = useState("WHATSAPP");

  // Preview state
  const [showPreview, setShowPreview] = useState(false);

  // ========================================================================
  // LOAD DATA
  // ========================================================================

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/morning-brief");
      const data = await res.json();

      if (data.success) {
        setMarkets(data.markets || []);
        setItems(data.items || []);

        if (data.subscription) {
          const sub = data.subscription;
          setSubscription(sub);
          setPlanType(sub.plan_type || "DEFAULT");
          setDeliveryTime(sub.delivery_time || "05:30");
          setDeliveryChannel(sub.delivery_channel || "WHATSAPP");

          try {
            setSelectedMarkets(JSON.parse(sub.selected_markets || "[]"));
          } catch { setSelectedMarkets([]); }
          try {
            setSelectedItems(JSON.parse(sub.selected_items || "[]"));
          } catch { setSelectedItems([]); }
        }
      }
    } catch (err: any) {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ========================================================================
  // ACTIONS
  // ========================================================================

  const handleSubscribe = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/morning-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_type: planType,
          selected_markets: selectedMarkets,
          selected_items: selectedItems,
          delivery_time: deliveryTime,
          delivery_channel: deliveryChannel,
          action: subscription ? "update" : "subscribe",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(subscription ? "Preferences updated!" : "Subscribed to Morning Brief!");
        fetchData();
      } else {
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: "pause" | "resume" | "cancel") => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (action === "cancel") {
        const res = await fetch("/api/morning-brief", { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          setSuccess("Morning Brief cancelled");
          setSubscription(null);
        }
      } else {
        const res = await fetch("/api/morning-brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (data.success) {
          setSuccess(action === "pause" ? "Paused" : "Resumed!");
          fetchData();
        }
      }
    } catch {
      setError("Action failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleMarket = (id: string) => {
    setSelectedMarkets((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : prev.length < 8 ? [...prev, id] : prev
    );
  };

  const toggleItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : prev.length < 15 ? [...prev, id] : prev
    );
  };

  // Group markets by state
  const marketsByState: Record<string, Market[]> = {};
  for (const m of markets) {
    const state = m.state || "Other";
    if (!marketsByState[state]) marketsByState[state] = [];
    marketsByState[state].push(m);
  }

  // Group items by category
  const itemsByCategory: Record<string, Item[]> = {};
  for (const i of items) {
    const cat = i.category || "Other";
    if (!itemsByCategory[cat]) itemsByCategory[cat] = [];
    itemsByCategory[cat].push(i);
  }

  // ========================================================================
  // RENDER
  // ========================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  const isSubscribed = subscription && subscription.status !== "CANCELLED";
  const isPaused = subscription?.status === "PAUSED";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Sun className="w-5 h-5 text-white" />
            </div>
            Morning Brief
          </h1>
          <p className="text-gray-400 mt-1">
            Daily price intelligence delivered to your WhatsApp at sunrise
          </p>
        </div>

        {isSubscribed && (
          <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
            isPaused
              ? "bg-amber-500/20 text-amber-400"
              : "bg-emerald-500/20 text-emerald-400"
          }`}>
            {isPaused ? "⏸ Paused" : "✅ Active"}
          </div>
        )}
      </div>

      {/* Status messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-2 text-emerald-400 text-sm">
          <Check className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {/* Stats (if subscribed) */}
      {isSubscribed && subscription.total_sent > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-4">
            <div className="text-2xs text-gray-500 uppercase">Briefs Sent</div>
            <div className="text-xl font-bold text-white mt-1">{subscription.total_sent}</div>
          </div>
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-4">
            <div className="text-2xs text-gray-500 uppercase">Last Sent</div>
            <div className="text-sm text-white mt-1">
              {subscription.last_sent_at
                ? new Date(subscription.last_sent_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })
                : "Never"}
            </div>
          </div>
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-4">
            <div className="text-2xs text-gray-500 uppercase">Plan</div>
            <div className="text-sm text-white mt-1">
              {subscription.plan_type === "PERSONALIZED" ? "Personalized" : "Default"}
              {subscription.price_weekly > 0 && (
                <span className="text-emerald-400 ml-1">₦{subscription.price_weekly}/wk</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plan Selection */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">Choose Your Brief</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Default Plan */}
          <button
            onClick={() => setPlanType("DEFAULT")}
            className={`text-left p-5 rounded-xl border-2 transition-all ${
              planType === "DEFAULT"
                ? "border-emerald-500 bg-emerald-500/5"
                : "border-[#2a2a2a] hover:border-[#3a3a3a]"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                FREE
              </span>
            </div>
            <h3 className="font-semibold text-white mb-1">Market Overview</h3>
            <p className="text-sm text-gray-400">
              Top 10 biggest price movers across all Nigerian markets. Plus a daily buying tip.
            </p>
            <ul className="mt-3 space-y-1 text-xs text-gray-500">
              <li className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> Top 10 commodities by price change</li>
              <li className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> All markets covered</li>
              <li className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> Daily buying tip</li>
            </ul>
          </button>

          {/* Personalized Plan */}
          <button
            onClick={() => setPlanType("PERSONALIZED")}
            className={`text-left p-5 rounded-xl border-2 transition-all ${
              planType === "PERSONALIZED"
                ? "border-amber-500 bg-amber-500/5"
                : "border-[#2a2a2a] hover:border-[#3a3a3a]"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                ₦100/week
              </span>
            </div>
            <h3 className="font-semibold text-white mb-1">Personalized Brief</h3>
            <p className="text-sm text-gray-400">
              Pick your markets & commodities. Get prices for exactly what you trade.
            </p>
            <ul className="mt-3 space-y-1 text-xs text-gray-500">
              <li className="flex items-center gap-1"><Check className="w-3 h-3 text-amber-400" /> Up to 8 markets of your choice</li>
              <li className="flex items-center gap-1"><Check className="w-3 h-3 text-amber-400" /> Up to 15 items you track</li>
              <li className="flex items-center gap-1"><Check className="w-3 h-3 text-amber-400" /> Cross-market price comparison</li>
              <li className="flex items-center gap-1"><Check className="w-3 h-3 text-amber-400" /> Best deal alerts</li>
            </ul>
          </button>
        </div>
      </div>

      {/* Personalization Pickers (only for PERSONALIZED) */}
      {planType === "PERSONALIZED" && (
        <div className="space-y-6">
          {/* Market Picker */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                Select Markets
              </h3>
              <span className="text-xs text-gray-500">
                {selectedMarkets.length}/8 selected
              </span>
            </div>

            <div className="space-y-4">
              {Object.entries(marketsByState).map(([state, mkts]) => (
                <div key={state}>
                  <div className="text-2xs text-gray-500 uppercase tracking-wider mb-2">{state}</div>
                  <div className="flex flex-wrap gap-2">
                    {mkts.map((m) => {
                      const selected = selectedMarkets.includes(m.market_id);
                      return (
                        <button
                          key={m.market_id}
                          onClick={() => toggleMarket(m.market_id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            selected
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : "bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:border-[#3a3a3a]"
                          }`}
                        >
                          {selected && <Check className="w-3 h-3 inline mr-1" />}
                          {m.market_name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Item Picker */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <ShoppingBasket className="w-4 h-4 text-amber-400" />
                Select Items
                <span className="text-xs text-gray-500 font-normal">(optional — leave empty for all)</span>
              </h3>
              <span className="text-xs text-gray-500">
                {selectedItems.length}/15 selected
              </span>
            </div>

            <div className="space-y-4">
              {Object.entries(itemsByCategory).map(([cat, catItems]) => (
                <div key={cat}>
                  <div className="text-2xs text-gray-500 uppercase tracking-wider mb-2">{cat}</div>
                  <div className="flex flex-wrap gap-2">
                    {catItems.map((item) => {
                      const selected = selectedItems.includes(item.item_id);
                      return (
                        <button
                          key={item.item_id}
                          onClick={() => toggleItem(item.item_id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            selected
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                              : "bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:border-[#3a3a3a]"
                          }`}
                        >
                          {selected && <Check className="w-3 h-3 inline mr-1" />}
                          {item.item_name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delivery Settings */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6">
        <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-blue-400" />
          Delivery Settings
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Delivery Time (WAT)</label>
            <select
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
            >
              <option value="04:30">4:30 AM — Early Bird</option>
              <option value="05:30">5:30 AM — Market Opener ⭐</option>
              <option value="06:00">6:00 AM — Standard</option>
              <option value="06:30">6:30 AM — Late Riser</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Delivery Channel</label>
            <select
              value={deliveryChannel}
              onChange={(e) => setDeliveryChannel(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
            >
              <option value="WHATSAPP">WhatsApp</option>
              <option value="PUSH">Push Notification</option>
              <option value="BOTH">WhatsApp + Push</option>
            </select>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="w-full flex items-center justify-between p-4 hover:bg-[#1a1a1a] transition-colors"
        >
          <span className="flex items-center gap-2 text-sm text-gray-300">
            <Eye className="w-4 h-4" />
            Preview Brief
          </span>
          <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${showPreview ? "rotate-90" : ""}`} />
        </button>

        {showPreview && (
          <div className="border-t border-[#2a2a2a] p-4">
            <div className="bg-[#0a0a0a] rounded-lg p-4 font-mono text-xs text-gray-300 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto custom-scrollbar">
              {planType === "DEFAULT" ? (
                <>
{`🌅 *NaijaMarket Morning Brief*
📅 ${new Date().toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })} | ${deliveryTime} WAT
━━━━━━━━━━━━━━━━━━━━━━

📊 *Top Movers Today:*

📈 *Rice (50kg)*
   Mile 12: ₦82,000 (+2.3%)

🔴⬆ *Tomatoes (basket)*
   Onitsha: ₦45,000 (+12.1%)

📉 *Cement (bag)*
   Iddo: ₦6,300 (-3.1%)

🟢⬇ *Onions (bag)*
   Kano: ₦35,000 (-5.2%)

📈 *Palm Oil (25L)*
   Mile 12: ₦52,000 (+1.5%)

...and 5 more items

━━━━━━━━━━━━━━━━━━━━━━
💡 *Tip:* Cement dropped ₦200 at Iddo. Good day to buy!

━━━━━━━━━━━━━━━━━━━━━━
Type *price* to check any item
Type *STOP BRIEF* to unsubscribe`}
                </>
              ) : (
                <>
{`🌅 *Your Morning Brief*
📅 ${new Date().toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })} | ${deliveryTime} WAT
━━━━━━━━━━━━━━━━━━━━━━

${selectedMarkets.length > 0 ? selectedMarkets.map(id => {
  const m = markets.find(mk => mk.market_id === id);
  return `🏪 *${m?.market_name || id}*
  📈 Rice (50kg): ₦82,000 (+2.3%)
  📉 Beans (100kg): ₦62,000 (-1.2%)
  ➡️ Garri (50kg): ₦28,000 (0.0%)
`;}).join("\n") : "Select markets above to see preview"}
━━━━━━━━━━━━━━━━━━━━━━
🔍 *Best Deals:*
💡 *Rice*: ₦3,000 cheaper at Mile 12 vs Onitsha

━━━━━━━━━━━━━━━━━━━━━━
Type *price* to check any item
Type *STOP BRIEF* to unsubscribe`}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleSubscribe}
          disabled={saving || (planType === "PERSONALIZED" && selectedMarkets.length === 0)}
          className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isSubscribed ? (
            <>
              <Check className="w-4 h-4" />
              Update Preferences
            </>
          ) : (
            <>
              <Bell className="w-4 h-4" />
              Subscribe to Morning Brief
              {planType === "PERSONALIZED" && (
                <span className="text-xs bg-black/20 px-2 py-0.5 rounded ml-1">₦100/wk</span>
              )}
            </>
          )}
        </button>

        {isSubscribed && (
          <>
            <button
              onClick={() => handleAction(isPaused ? "resume" : "pause")}
              disabled={saving}
              className="px-4 py-3 rounded-xl border border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-colors flex items-center justify-center gap-2"
            >
              {isPaused ? (
                <><Play className="w-4 h-4" /> Resume</>
              ) : (
                <><Pause className="w-4 h-4" /> Pause</>
              )}
            </button>

            <button
              onClick={() => {
                if (confirm("Cancel Morning Brief? You can re-subscribe anytime.")) {
                  handleAction("cancel");
                }
              }}
              disabled={saving}
              className="px-4 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Cancel
            </button>
          </>
        )}
      </div>

      {/* Value Prop Footer */}
      {!isSubscribed && (
        <div className="bg-gradient-to-r from-amber-500/5 to-emerald-500/5 border border-[#2a2a2a] rounded-xl p-6 text-center">
          <p className="text-sm text-gray-400">
            <span className="text-white font-medium">50,000 traders</span> wake up wondering the same thing every morning.
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Get your prices before you leave for the market. ₦100/week = less than sachet water.
          </p>
          <p className="text-xs text-gray-600 mt-3">
            96.5% gross margin • WhatsApp delivery • Cancel anytime
          </p>
        </div>
      )}
    </div>
  );
}
