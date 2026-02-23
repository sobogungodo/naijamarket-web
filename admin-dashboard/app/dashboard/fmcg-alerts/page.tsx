"use client";

// ============================================================================
// /dashboard/fmcg-alerts — FMCG Competitor Alert Management
// NaijaMarket Intel | Version 1.0.0 | 2026-02-23
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import {
  Megaphone, Plus, RefreshCw, Building2, Mail, Phone, Bell,
  Calendar, TrendingUp, CheckCircle, XCircle, Clock,
} from "lucide-react";

interface FMCGSub {
  fmcg_id: number;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  tracked_items: string;
  tracked_markets: string | null;
  alert_type: string;
  delivery_method: string;
  whatsapp_number: string | null;
  plan: string;
  monthly_fee: number;
  price_change_threshold: number;
  total_alerts_sent: number;
  last_alert_at: string | null;
  status: string;
  created_at: string;
}

const PLAN_COLORS: Record<string, string> = {
  TRIAL: "bg-gray-500/20 text-gray-400",
  BASIC: "bg-emerald-500/20 text-emerald-400",
  PRO: "bg-purple-500/20 text-purple-400",
  ENTERPRISE: "bg-amber-500/20 text-amber-400",
};

const PLAN_PRICES: Record<string, string> = {
  TRIAL: "Free Trial",
  BASIC: "₦100K/mo",
  PRO: "₦250K/mo",
  ENTERPRISE: "₦500K/mo",
};

const DELIVERY_ICONS: Record<string, string> = {
  EMAIL: "📧",
  WHATSAPP: "💬",
  BOTH: "📧💬",
  API: "🔌",
};

const COMMODITY_OPTIONS = [
  "Rice", "Tomatoes", "Onions", "Beans", "Garri", "Palm Oil", "Groundnut Oil",
  "Yam", "Plantain", "Pepper", "Cement", "Iron Rods", "Zinc", "Plywood",
  "Leather", "Foam", "Fabric", "Sugar", "Flour", "Salt",
];

export default function FMCGAlertsPage() {
  const [subs, setSubs] = useState<FMCGSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    tracked_items: [] as string[],
    tracked_markets: [] as string[],
    alert_type: "DAILY",
    delivery_method: "EMAIL",
    whatsapp_number: "",
    plan: "TRIAL",
    price_change_threshold: 5,
  });

  const fetchSubs = useCallback(async () => {
    try {
      const res = await fetch("/api/fmcg-alerts");
      const data = await res.json();
      if (data.success) setSubs(data.subscriptions || []);
    } catch (e) {
      console.error("Failed to fetch:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const createSub = async () => {
    if (!form.company_name || !form.contact_name || !form.contact_email || form.tracked_items.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch("/api/fmcg-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tracked_items: JSON.stringify(form.tracked_items),
          tracked_markets: form.tracked_markets.length > 0 ? JSON.stringify(form.tracked_markets) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setForm({ company_name: "", contact_name: "", contact_email: "", contact_phone: "", tracked_items: [], tracked_markets: [], alert_type: "DAILY", delivery_method: "EMAIL", whatsapp_number: "", plan: "TRIAL", price_change_threshold: 5 });
        fetchSubs();
      }
    } catch (e) {
      console.error("Create failed:", e);
    } finally {
      setCreating(false);
    }
  };

  const runTestSend = async () => {
    setTestResult("Sending...");
    try {
      const res = await fetch("/api/fmcg-alerts/send?test=1");
      const data = await res.json();
      setTestResult(`✅ Sent: ${data.stats?.sent || 0}, Failed: ${data.stats?.failed || 0}`);
      setTimeout(() => setTestResult(null), 5000);
    } catch {
      setTestResult("❌ Failed to send");
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const toggleItem = (item: string) => {
    setForm(f => ({
      ...f,
      tracked_items: f.tracked_items.includes(item)
        ? f.tracked_items.filter(i => i !== item)
        : [...f.tracked_items, item],
    }));
  };

  const activeSubs = subs.filter(s => s.status === "ACTIVE").length;
  const totalAlerts = subs.reduce((s, sub) => s + (sub.total_alerts_sent || 0), 0);
  const monthlyRevenue = subs.reduce((s, sub) => s + (sub.status === "ACTIVE" ? Number(sub.monthly_fee) : 0), 0);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-900/40 to-orange-800/20 border border-orange-500/20 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Megaphone className="w-6 h-6 text-orange-400" />
              <h1 className="text-xl font-bold text-white">FMCG Competitor Alerts</h1>
            </div>
            <p className="text-gray-400 text-sm">Daily/weekly price intelligence for FMCG companies tracking competitor pricing</p>
          </div>
          <div className="flex gap-3">
            <button onClick={runTestSend} className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300 rounded-lg hover:bg-[#222] transition-colors flex items-center gap-2 text-sm">
              <Bell className="w-4 h-4" /> {testResult || "Test Send"}
            </button>
            <button onClick={() => fetchSubs()} className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300 rounded-lg hover:bg-[#222] transition-colors flex items-center gap-2 text-sm">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium">
              <Plus className="w-4 h-4" /> Add Company
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Active Subscribers", value: activeSubs, color: "text-emerald-400" },
          { label: "Total Alerts Sent", value: totalAlerts.toLocaleString(), color: "text-orange-400" },
          { label: "Monthly Revenue", value: `₦${monthlyRevenue.toLocaleString()}`, color: "text-amber-400" },
          { label: "Total Companies", value: subs.length, color: "text-blue-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-[#111] border border-orange-500/30 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Add FMCG Company</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Company Name *</label>
              <input type="text" value={form.company_name} onChange={e => setForm(f => ({...f, company_name: e.target.value}))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none" placeholder="e.g. Dangote Foods" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Contact Name *</label>
              <input type="text" value={form.contact_name} onChange={e => setForm(f => ({...f, contact_name: e.target.value}))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none" placeholder="e.g. Ade Johnson" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Contact Email *</label>
              <input type="email" value={form.contact_email} onChange={e => setForm(f => ({...f, contact_email: e.target.value}))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none" placeholder="procurement@dangote.com" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Plan</label>
              <select value={form.plan} onChange={e => setForm(f => ({...f, plan: e.target.value}))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none">
                <option value="TRIAL">Trial (Free)</option>
                <option value="BASIC">Basic (₦100K/mo)</option>
                <option value="PRO">Pro (₦250K/mo)</option>
                <option value="ENTERPRISE">Enterprise (₦500K/mo)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Alert Frequency</label>
              <select value={form.alert_type} onChange={e => setForm(f => ({...f, alert_type: e.target.value}))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none">
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly (Mondays)</option>
                <option value="REALTIME">Real-time</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Delivery Method</label>
              <select value={form.delivery_method} onChange={e => setForm(f => ({...f, delivery_method: e.target.value}))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none">
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="BOTH">Both (Email + WhatsApp)</option>
                <option value="API">API Webhook</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Price Change Threshold (%)</label>
              <input type="number" value={form.price_change_threshold} onChange={e => setForm(f => ({...f, price_change_threshold: Number(e.target.value)}))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none" min="1" max="50" />
            </div>
            {(form.delivery_method === "WHATSAPP" || form.delivery_method === "BOTH") && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">WhatsApp Number</label>
                <input type="text" value={form.whatsapp_number} onChange={e => setForm(f => ({...f, whatsapp_number: e.target.value}))}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none" placeholder="08031234567" />
              </div>
            )}
          </div>

          {/* Commodity Selection */}
          <div className="mt-4">
            <label className="block text-xs text-gray-500 mb-2">Tracked Commodities * (select at least 1)</label>
            <div className="flex flex-wrap gap-2">
              {COMMODITY_OPTIONS.map(item => (
                <button key={item} onClick={() => toggleItem(item)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    form.tracked_items.includes(item)
                      ? "bg-orange-600/30 text-orange-300 border border-orange-500/50"
                      : "bg-[#0a0a0a] text-gray-400 border border-[#2a2a2a] hover:border-[#3a3a3a]"
                  }`}>
                  {form.tracked_items.includes(item) ? "✓ " : ""}{item}
                </button>
              ))}
            </div>
            {form.tracked_items.length > 0 && (
              <p className="text-xs text-orange-400 mt-2">{form.tracked_items.length} items selected</p>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={createSub} disabled={creating || !form.company_name || !form.contact_name || !form.contact_email || form.tracked_items.length === 0}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
              {creating ? "Creating..." : "Add Company"}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300 rounded-lg text-sm hover:bg-[#222] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Subscriber List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading subscriptions...</div>
      ) : subs.length === 0 ? (
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-12 text-center">
          <Megaphone className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">No FMCG subscribers yet</h3>
          <p className="text-gray-500 text-sm mb-4">Add your first FMCG company to start sending competitor price intelligence.</p>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm">
            <Plus className="w-4 h-4 inline mr-1" /> Add First Company
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {subs.map((sub) => {
            let items: string[] = [];
            try { items = JSON.parse(sub.tracked_items); } catch { items = []; }

            return (
              <div key={sub.fmcg_id} className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5 hover:border-[#2a2a2a] transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-orange-400" />
                      <h3 className="text-white font-semibold">{sub.company_name}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${PLAN_COLORS[sub.plan] || PLAN_COLORS.TRIAL}`}>{sub.plan}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${sub.status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{sub.status}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {sub.contact_email}</span>
                      <span>{sub.contact_name}</span>
                      <span>{DELIVERY_ICONS[sub.delivery_method] || "📧"} {sub.delivery_method}</span>
                      <span>{sub.alert_type}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-lg">{sub.total_alerts_sent}</p>
                    <p className="text-gray-500 text-xs">alerts sent</p>
                  </div>
                </div>

                {/* Tracked Items */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {items.map(item => (
                    <span key={item} className="px-2 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[10px] text-gray-300">{item}</span>
                  ))}
                </div>

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Threshold: ±{sub.price_change_threshold}%</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Since {new Date(sub.created_at).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}</span>
                  {sub.last_alert_at && (
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Last alert: {new Date(sub.last_alert_at).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}</span>
                  )}
                  <span>{PLAN_PRICES[sub.plan] || "Free"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
