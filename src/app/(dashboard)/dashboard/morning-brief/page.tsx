// ============================================================================
// src/app/(dashboard)/dashboard/morning-brief/page.tsx
// NaijaMarket Intel - Morning Brief Management Page
// Version: 2.0.0 | Date: 2026-02-20
// Searchable dropdown selects for markets & items, food only
// ============================================================================

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Sun, Clock, MapPin, ShoppingBasket, Bell,
  Check, Pause, Play, Trash2, ChevronRight, Sparkles,
  Eye, AlertCircle, Loader2, TrendingUp, Settings,
  ChevronDown, X,
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

interface Market { market_id: string; market_name: string; state: string; }
interface Item { item_id: string; item_name: string; category: string; unit: string; }

// ============================================================================
// SEARCHABLE MULTI-SELECT DROPDOWN
// ============================================================================

function MultiSelectDropdown({
  label, icon: Icon, options, selected, onToggle, maxItems, groupBy, placeholder,
}: {
  label: string; icon: React.ElementType;
  options: { id: string; name: string; group: string }[];
  selected: string[]; onToggle: (id: string) => void;
  maxItems: number; groupBy: boolean; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = search
    ? options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()) || o.group.toLowerCase().includes(search.toLowerCase()))
    : options;

  const grouped: Record<string, typeof options> = {};
  for (const o of filtered) {
    const g = groupBy ? o.group : "All";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(o);
  }

  const selectedNames = selected.map((id) => options.find((o) => o.id === id)?.name || id);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} type="button"
        className="w-full flex items-center justify-between bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-left hover:border-[#3a3a3a] transition-colors">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon className="w-4 h-4 text-gray-500 shrink-0" />
          {selected.length === 0
            ? <span className="text-gray-500">{placeholder}</span>
            : <span className="text-white truncate">{selected.length} selected</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-600">{selected.length}/{maxItems}</span>
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedNames.map((name, i) => (
            <span key={selected[i]} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/15 text-emerald-400 rounded-md text-xs">
              {name}
              <button onClick={() => onToggle(selected[i])} className="hover:text-emerald-200"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[#141414] border border-[#2a2a2a] rounded-lg shadow-xl max-h-72 overflow-hidden">
          <div className="p-2 border-b border-[#2a2a2a]">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2.5 py-1.5 text-sm text-white outline-none focus:border-emerald-500 placeholder-gray-600"
              autoFocus />
          </div>
          <div className="overflow-y-auto max-h-56 custom-scrollbar">
            {Object.entries(grouped).map(([group, groupItems]) => (
              <div key={group}>
                {groupBy && <div className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider bg-[#0e0e0e] sticky top-0">{group}</div>}
                {groupItems.map((opt) => {
                  const isSel = selected.includes(opt.id);
                  const dis = !isSel && selected.length >= maxItems;
                  return (
                    <button key={opt.id} type="button" onClick={() => { if (!dis) onToggle(opt.id); }} disabled={dis}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${isSel ? "bg-emerald-500/10 text-emerald-400" : dis ? "text-gray-600 cursor-not-allowed" : "text-gray-300 hover:bg-[#1a1a1a]"}`}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSel ? "bg-emerald-500 border-emerald-500" : "border-[#3a3a3a]"}`}>
                        {isSel && <Check className="w-3 h-3 text-black" />}
                      </div>
                      {opt.name}
                    </button>
                  );
                })}
              </div>
            ))}
            {filtered.length === 0 && <div className="p-4 text-center text-gray-500 text-sm">No results for &ldquo;{search}&rdquo;</div>}
          </div>
        </div>
      )}
    </div>
  );
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
  const [phoneMissing, setPhoneMissing] = useState(false);

  const [planType, setPlanType] = useState<"DEFAULT" | "PERSONALIZED">("DEFAULT");
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [deliveryTime, setDeliveryTime] = useState("05:30");
  const [deliveryChannel, setDeliveryChannel] = useState("WHATSAPP");
  const [showPreview, setShowPreview] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/morning-brief");
      const data = await res.json();
      if (data.success) {
        setMarkets(data.markets || []);
        setItems(data.items || []);
        if (data.phone_missing) { setPhoneMissing(true); return; }
        setPhoneMissing(false);
        if (data.subscription) {
          const sub = data.subscription;
          setSubscription(sub);
          setPlanType(sub.plan_type || "DEFAULT");
          setDeliveryTime(sub.delivery_time || "05:30");
          setDeliveryChannel(sub.delivery_channel || "WHATSAPP");
          try { setSelectedMarkets(JSON.parse(sub.selected_markets || "[]")); } catch { setSelectedMarkets([]); }
          try { setSelectedItems(JSON.parse(sub.selected_items || "[]")); } catch { setSelectedItems([]); }
        }
      }
    } catch { setError("Failed to load data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubscribe = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/morning-brief", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_type: planType, selected_markets: selectedMarkets, selected_items: selectedItems, delivery_time: deliveryTime, delivery_channel: deliveryChannel, action: subscription ? "update" : "subscribe" }),
      });
      const data = await res.json();
      if (data.success) { setSuccess(subscription ? "Preferences updated!" : "Subscribed to Morning Brief!"); fetchData(); }
      else setError(data.error || "Failed to save");
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  const handleAction = async (action: "pause" | "resume" | "cancel") => {
    setSaving(true); setError(""); setSuccess("");
    try {
      if (action === "cancel") {
        const res = await fetch("/api/morning-brief", { method: "DELETE" });
        if ((await res.json()).success) { setSuccess("Morning Brief cancelled"); setSubscription(null); }
      } else {
        const res = await fetch("/api/morning-brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
        if ((await res.json()).success) { setSuccess(action === "pause" ? "Paused" : "Resumed!"); fetchData(); }
      }
    } catch { setError("Action failed"); }
    finally { setSaving(false); }
  };

  const toggleMarket = (id: string) => setSelectedMarkets((p) => p.includes(id) ? p.filter((m) => m !== id) : p.length < 8 ? [...p, id] : p);
  const toggleItem = (id: string) => setSelectedItems((p) => p.includes(id) ? p.filter((i) => i !== id) : p.length < 15 ? [...p, id] : p);

  const marketOptions = markets.map((m) => ({ id: m.market_id, name: m.market_name, group: m.state || "Other" }));
  const itemOptions = items.map((i) => ({ id: i.item_id, name: i.item_name, group: i.category || "Other" }));

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 text-emerald-400 animate-spin" /></div>;

  const isSubscribed = subscription && subscription.status !== "CANCELLED";
  const isPaused = subscription?.status === "PAUSED";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center"><Sun className="w-5 h-5 text-white" /></div>
            Morning Brief
          </h1>
          <p className="text-gray-400 mt-1">Daily price intelligence delivered to your WhatsApp at sunrise</p>
        </div>
        {isSubscribed && (
          <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${isPaused ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}>
            {isPaused ? "⏸ Paused" : "✅ Active"}
          </div>
        )}
      </div>

      {phoneMissing && (
        <Link href="/dashboard/settings" className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 hover:bg-amber-500/15 transition-colors">
          <Settings className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-amber-400 font-medium text-sm">Phone number required</p>
            <p className="text-amber-400/70 text-xs mt-0.5">Add your WhatsApp number in Settings to receive Morning Briefs</p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-400/50" />
        </Link>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-2 text-emerald-400 text-sm"><Check className="w-4 h-4 shrink-0" /> {success}</div>}

      {isSubscribed && subscription.total_sent > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-4"><div className="text-[10px] text-gray-500 uppercase">Briefs Sent</div><div className="text-xl font-bold text-white mt-1">{subscription.total_sent}</div></div>
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-4"><div className="text-[10px] text-gray-500 uppercase">Last Sent</div><div className="text-sm text-white mt-1">{subscription.last_sent_at ? new Date(subscription.last_sent_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "Never"}</div></div>
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-4"><div className="text-[10px] text-gray-500 uppercase">Plan</div><div className="text-sm text-white mt-1">{subscription.plan_type === "PERSONALIZED" ? "Personalized" : "Default"}{subscription.price_weekly > 0 && <span className="text-emerald-400 ml-1">₦{subscription.price_weekly}/wk</span>}</div></div>
        </div>
      )}

      {/* Plan Selection */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">Choose Your Brief</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={() => setPlanType("DEFAULT")} className={`text-left p-5 rounded-xl border-2 transition-all ${planType === "DEFAULT" ? "border-emerald-500 bg-emerald-500/5" : "border-[#2a2a2a] hover:border-[#3a3a3a]"}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-400" /></div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">FREE</span>
            </div>
            <h3 className="font-semibold text-white mb-1">Market Overview</h3>
            <p className="text-sm text-gray-400">Top 10 biggest price movers across all Nigerian markets. Plus a daily buying tip.</p>
            <ul className="mt-3 space-y-1 text-xs text-gray-500">
              <li className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> Top 10 commodities by price change</li>
              <li className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> All markets covered</li>
              <li className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> Daily buying tip</li>
            </ul>
          </button>
          <button onClick={() => setPlanType("PERSONALIZED")} className={`text-left p-5 rounded-xl border-2 transition-all ${planType === "PERSONALIZED" ? "border-amber-500 bg-amber-500/5" : "border-[#2a2a2a] hover:border-[#3a3a3a]"}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center"><Sparkles className="w-5 h-5 text-amber-400" /></div>
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded">₦100/week</span>
            </div>
            <h3 className="font-semibold text-white mb-1">Personalized Brief</h3>
            <p className="text-sm text-gray-400">Pick your markets & food items. Get prices for exactly what you trade.</p>
            <ul className="mt-3 space-y-1 text-xs text-gray-500">
              <li className="flex items-center gap-1"><Check className="w-3 h-3 text-amber-400" /> Up to 8 markets of your choice</li>
              <li className="flex items-center gap-1"><Check className="w-3 h-3 text-amber-400" /> Up to 15 food items you track</li>
              <li className="flex items-center gap-1"><Check className="w-3 h-3 text-amber-400" /> Cross-market price comparison</li>
              <li className="flex items-center gap-1"><Check className="w-3 h-3 text-amber-400" /> Best deal alerts</li>
            </ul>
          </button>
        </div>
      </div>

      {/* Personalization — Searchable Dropdowns */}
      {planType === "PERSONALIZED" && (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 space-y-5">
          <h3 className="font-semibold text-white">Customize Your Brief</h3>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Markets (up to 8)</label>
            <MultiSelectDropdown label="Markets" icon={MapPin} options={marketOptions} selected={selectedMarkets} onToggle={toggleMarket} maxItems={8} groupBy={true} placeholder="Select markets you trade in..." />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Food Items (up to 15, optional — leave empty for all)</label>
            <MultiSelectDropdown label="Items" icon={ShoppingBasket} options={itemOptions} selected={selectedItems} onToggle={toggleItem} maxItems={15} groupBy={true} placeholder="Select food items to track..." />
          </div>
        </div>
      )}

      {/* Delivery Settings */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6">
        <h3 className="font-semibold text-white flex items-center gap-2 mb-4"><Clock className="w-4 h-4 text-blue-400" /> Delivery Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Delivery Time (WAT)</label>
            <select value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500">
              <option value="04:30">4:30 AM — Early Bird</option>
              <option value="05:30">5:30 AM — Market Opener ⭐</option>
              <option value="06:00">6:00 AM — Standard</option>
              <option value="06:30">6:30 AM — Late Riser</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Delivery Channel</label>
            <select value={deliveryChannel} onChange={(e) => setDeliveryChannel(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500">
              <option value="WHATSAPP">WhatsApp</option>
              <option value="PUSH">Push Notification</option>
              <option value="BOTH">WhatsApp + Push</option>
            </select>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <button onClick={() => setShowPreview(!showPreview)} className="w-full flex items-center justify-between p-4 hover:bg-[#1a1a1a] transition-colors">
          <span className="flex items-center gap-2 text-sm text-gray-300"><Eye className="w-4 h-4" /> Preview Brief</span>
          <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${showPreview ? "rotate-90" : ""}`} />
        </button>
        {showPreview && (
          <div className="border-t border-[#2a2a2a] p-4">
            <div className="bg-[#0a0a0a] rounded-lg p-4 font-mono text-xs text-gray-300 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto custom-scrollbar">
              {planType === "DEFAULT" ? `🌅 *NaijaMarket Morning Brief*\n📅 ${new Date().toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })} | ${deliveryTime} WAT\n━━━━━━━━━━━━━━━━━━━━━━\n\n📊 *Top Movers Today:*\n\n🔴⬆ *Tomatoes (basket)*\n   Mile 12: ₦45,000 (+12.1%)\n\n📈 *Rice (50kg)*\n   Onitsha: ₦85,000 (+2.3%)\n\n📉 *Garri (50kg)*\n   Kano: ₦28,000 (-3.1%)\n\n🟢⬇ *Onions (bag)*\n   Wuse: ₦35,000 (-5.2%)\n\n...and 6 more items\n\n━━━━━━━━━━━━━━━━━━━━━━\n💡 *Tip:* Garri dropped ₦1,200 at Kano!\n\nType *price* to check any item\nType *STOP BRIEF* to unsubscribe` : `🌅 *Your Morning Brief*\n📅 ${new Date().toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })} | ${deliveryTime} WAT\n━━━━━━━━━━━━━━━━━━━━━━\n${selectedMarkets.length > 0 ? selectedMarkets.map(id => { const m = markets.find(mk => mk.market_id === id); return `\n🏪 *${m?.market_name || id}*\n  📈 Rice (50kg): ₦82,000 (+2.3%)\n  📉 Beans (100kg): ₦62,000 (-1.2%)\n  ➡️ Garri (50kg): ₦28,000 (0.0%)`; }).join("\n") : "\nSelect markets above to see preview"}\n\n━━━━━━━━━━━━━━━━━━━━━━\n🔍 *Best Deals:*\n💡 *Rice*: ₦3,000 cheaper at Mile 12 vs Onitsha\n\nType *price* to check any item\nType *STOP BRIEF* to unsubscribe`}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={handleSubscribe} disabled={saving || phoneMissing || (planType === "PERSONALIZED" && selectedMarkets.length === 0)} className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isSubscribed ? <><Check className="w-4 h-4" /> Update Preferences</> : <><Bell className="w-4 h-4" /> Subscribe to Morning Brief{planType === "PERSONALIZED" && <span className="text-xs bg-black/20 px-2 py-0.5 rounded ml-1">₦100/wk</span>}</>}
        </button>
        {isSubscribed && (
          <>
            <button onClick={() => handleAction(isPaused ? "resume" : "pause")} disabled={saving} className="px-4 py-3 rounded-xl border border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-colors flex items-center justify-center gap-2">
              {isPaused ? <><Play className="w-4 h-4" /> Resume</> : <><Pause className="w-4 h-4" /> Pause</>}
            </button>
            <button onClick={() => { if (confirm("Cancel Morning Brief?")) handleAction("cancel"); }} disabled={saving} className="px-4 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" /> Cancel
            </button>
          </>
        )}
      </div>

      {!isSubscribed && (
        <div className="bg-gradient-to-r from-amber-500/5 to-emerald-500/5 border border-[#2a2a2a] rounded-xl p-6 text-center">
          <p className="text-sm text-gray-400"><span className="text-white font-medium">50,000 traders</span> wake up wondering the same thing every morning.</p>
          <p className="text-sm text-gray-500 mt-1">Get your prices before you leave for the market. ₦100/week = less than sachet water.</p>
        </div>
      )}
    </div>
  );
}
