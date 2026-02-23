"use client";

// ============================================================================
// /dashboard/widgets — White-Label Widget Management
// NaijaMarket Intel | Version 1.0.0 | 2026-02-23
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import {
  Code2, Copy, Eye, EyeOff, Plus, Trash2, RefreshCw,
  Globe, Palette, LayoutGrid, ChevronDown, Check, ExternalLink,
} from "lucide-react";

interface WidgetKey {
  widget_id: number;
  widget_key: string;
  widget_key_masked: string;
  organization: string;
  contact_email: string;
  allowed_domains: string;
  layout: string;
  theme: string;
  plan: string;
  monthly_fee: number;
  total_loads: number;
  today_loads: number;
  last_loaded_at: string | null;
  status: string;
  created_at: string;
  expires_at: string | null;
}

const PLAN_COLORS: Record<string, string> = {
  TRIAL: "bg-gray-500/20 text-gray-400",
  BASIC: "bg-blue-500/20 text-blue-400",
  PRO: "bg-purple-500/20 text-purple-400",
  ENTERPRISE: "bg-amber-500/20 text-amber-400",
};

const PLAN_PRICES: Record<string, string> = {
  TRIAL: "Free",
  BASIC: "₦200K/mo",
  PRO: "₦500K/mo",
  ENTERPRISE: "₦1M/mo",
};

export default function WidgetsPage() {
  const [widgets, setWidgets] = useState<WidgetKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  // Form state
  const [form, setForm] = useState({
    organization: "",
    contact_email: "",
    contact_phone: "",
    allowed_domains: "*",
    layout: "table",
    theme: "dark",
    plan: "TRIAL",
    default_items: "",
    default_market: "",
  });

  const fetchWidgets = useCallback(async () => {
    try {
      const res = await fetch("/api/widget/manage");
      const data = await res.json();
      if (data.success) setWidgets(data.widgets || []);
    } catch (e) {
      console.error("Failed to fetch widgets:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWidgets(); }, [fetchWidgets]);

  const createWidget = async () => {
    if (!form.organization || !form.contact_email) return;
    setCreating(true);
    try {
      const res = await fetch("/api/widget/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setForm({ organization: "", contact_email: "", contact_phone: "", allowed_domains: "*", layout: "table", theme: "dark", plan: "TRIAL", default_items: "", default_market: "" });
        fetchWidgets();
      }
    } catch (e) {
      console.error("Create failed:", e);
    } finally {
      setCreating(false);
    }
  };

  const copyEmbed = (w: WidgetKey) => {
    const code = `<!-- NaijaMarket Intel Price Widget -->\n<div id="naijamarket-widget"></div>\n<script src="https://www.naijamarketintel.com/api/widget?key=${w.widget_key}&layout=${w.layout}&theme=${w.theme}"></script>`;
    navigator.clipboard.writeText(code);
    setCopiedId(w.widget_id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleKey = (id: number) => {
    setVisibleKeys(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const totalLoads = widgets.reduce((s, w) => s + (w.total_loads || 0), 0);
  const activeWidgets = widgets.filter(w => w.status === "ACTIVE").length;
  const monthlyRevenue = widgets.reduce((s, w) => s + (w.status === "ACTIVE" ? Number(w.monthly_fee) : 0), 0);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/40 to-blue-800/20 border border-blue-500/20 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Code2 className="w-6 h-6 text-blue-400" />
              <h1 className="text-xl font-bold text-white">White-Label Price Widgets</h1>
            </div>
            <p className="text-gray-400 text-sm">Embeddable price widgets for news sites, blogs & portals</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => fetchWidgets()} className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300 rounded-lg hover:bg-[#222] transition-colors flex items-center gap-2 text-sm">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium">
              <Plus className="w-4 h-4" /> New Widget Key
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Active Widgets", value: activeWidgets, color: "text-emerald-400" },
          { label: "Total Page Loads", value: totalLoads.toLocaleString(), color: "text-blue-400" },
          { label: "Monthly Revenue", value: `₦${monthlyRevenue.toLocaleString()}`, color: "text-amber-400" },
          { label: "Avg Loads/Widget", value: activeWidgets > 0 ? Math.round(totalLoads / activeWidgets).toLocaleString() : "0", color: "text-purple-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-[#111] border border-blue-500/30 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Create New Widget Key</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Organization *</label>
              <input type="text" value={form.organization} onChange={e => setForm(f => ({...f, organization: e.target.value}))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none" placeholder="e.g. Punch Newspapers" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Contact Email *</label>
              <input type="email" value={form.contact_email} onChange={e => setForm(f => ({...f, contact_email: e.target.value}))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none" placeholder="tech@punch.com" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Allowed Domains</label>
              <input type="text" value={form.allowed_domains} onChange={e => setForm(f => ({...f, allowed_domains: e.target.value}))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none" placeholder="punch.ng, guardian.ng or * for any" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Plan</label>
              <select value={form.plan} onChange={e => setForm(f => ({...f, plan: e.target.value}))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none">
                <option value="TRIAL">Trial (Free)</option>
                <option value="BASIC">Basic (₦200K/mo)</option>
                <option value="PRO">Pro (₦500K/mo)</option>
                <option value="ENTERPRISE">Enterprise (₦1M/mo)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Layout</label>
              <select value={form.layout} onChange={e => setForm(f => ({...f, layout: e.target.value}))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none">
                <option value="table">Table</option>
                <option value="ticker">Ticker (scrolling)</option>
                <option value="card">Card Grid</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Theme</label>
              <select value={form.theme} onChange={e => setForm(f => ({...f, theme: e.target.value}))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={createWidget} disabled={creating || !form.organization || !form.contact_email}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
              {creating ? "Creating..." : "Create Widget Key"}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300 rounded-lg text-sm hover:bg-[#222] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Widget List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading widgets...</div>
      ) : widgets.length === 0 ? (
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-12 text-center">
          <Code2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">No widget keys yet</h3>
          <p className="text-gray-500 text-sm mb-4">Create your first widget key to embed live prices on any website.</p>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
            <Plus className="w-4 h-4 inline mr-1" /> Create First Widget
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {widgets.map((w) => (
            <div key={w.widget_id} className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5 hover:border-[#2a2a2a] transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <h3 className="text-white font-semibold">{w.organization}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${PLAN_COLORS[w.plan] || PLAN_COLORS.TRIAL}`}>{w.plan}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${w.status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{w.status}</span>
                  </div>
                  <p className="text-gray-500 text-xs">{w.contact_email} • {PLAN_PRICES[w.plan] || "Free"}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-lg">{(w.total_loads || 0).toLocaleString()}</p>
                  <p className="text-gray-500 text-xs">total loads</p>
                </div>
              </div>

              {/* Key */}
              <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Key:</span>
                    <code className="text-sm text-emerald-400 font-mono">
                      {visibleKeys.has(w.widget_id) ? w.widget_key : w.widget_key_masked}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleKey(w.widget_id)} className="text-gray-500 hover:text-gray-300 transition-colors">
                      {visibleKeys.has(w.widget_id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => copyEmbed(w)} className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs hover:bg-blue-600/30 transition-colors">
                      {copiedId === w.widget_id ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Embed Code</>}
                    </button>
                  </div>
                </div>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Palette className="w-3 h-3" /> {w.theme}</span>
                <span className="flex items-center gap-1"><LayoutGrid className="w-3 h-3" /> {w.layout}</span>
                <span>Domains: {w.allowed_domains || "*"}</span>
                <span>Created: {new Date(w.created_at).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}</span>
                {w.last_loaded_at && <span>Last load: {new Date(w.last_loaded_at).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Embed Preview */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6">
        <h3 className="text-white font-semibold mb-3">Widget Preview</h3>
        <p className="text-gray-500 text-xs mb-4">Example of how the widget looks when embedded on a website:</p>
        <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg p-4">
          <div className="bg-[#00a36c] rounded-t-lg px-4 py-2 flex justify-between items-center">
            <span className="text-white font-bold text-sm">🇳🇬 Nigerian Commodity Prices</span>
            <span className="text-white/70 text-xs">by NaijaMarket Intel</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e1e]">
                <th className="text-left px-4 py-2 text-gray-500 text-xs font-medium">ITEM</th>
                <th className="text-left px-3 py-2 text-gray-500 text-xs font-medium">MARKET</th>
                <th className="text-right px-3 py-2 text-gray-500 text-xs font-medium">PRICE</th>
                <th className="text-right px-4 py-2 text-gray-500 text-xs font-medium">CHANGE</th>
              </tr>
            </thead>
            <tbody>
              {[
                { item: "Rice (50kg)", market: "Mile 12", price: "₦78,500", change: "+2.3%", up: true },
                { item: "Tomatoes", market: "Wuse", price: "₦52,000", change: "-5.2%", up: false },
                { item: "Cement", market: "Iddo", price: "₦8,300", change: "+0.8%", up: true },
              ].map((r, i) => (
                <tr key={i} className="border-b border-[#1e1e1e]/50">
                  <td className="px-4 py-2 text-white font-medium">{r.item}</td>
                  <td className="px-3 py-2 text-gray-500">{r.market}</td>
                  <td className="px-3 py-2 text-white font-bold text-right">{r.price}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${r.up ? "text-emerald-400" : "text-red-400"}`}>{r.up ? "▲" : "▼"} {r.change}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-center py-2">
            <span className="text-[#00a36c] text-xs">Explore all markets on NaijaMarket Intel →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
