// ============================================================================
// src/app/(dashboard)/dashboard/api/page.tsx
// NaijaMarket Intel - API Key Management + Usage Dashboard
// Version: 2.0.0 | Date: 2026-02-20
// ============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Key, Plus, Copy, Check, Eye, EyeOff, Trash2,
  BarChart3, Clock, Zap, AlertCircle, Loader2,
  Code2, ExternalLink, TrendingUp, Shield,
  ChevronRight,
} from "lucide-react";

interface APIKey {
  key_id: string;
  name: string;
  prefix: string;
  status: string;
  tier: string;
  total_requests: number;
  daily_limit: number;
  rate_limit: number;
  last_used: string | null;
  created: string;
}

interface UsageDay {
  date: string;
  calls: number;
  success: number;
  rate_limited: number;
  avg_ms: number;
}

interface EndpointUsage {
  endpoint: string;
  calls: number;
  avg_ms: number;
}

export default function APIPage() {
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [dailyUsage, setDailyUsage] = useState<UsageDay[]>([]);
  const [endpointUsage, setEndpointUsage] = useState<EndpointUsage[]>([]);
  const [summary, setSummary] = useState({ total_calls: 0, success_rate: 100, avg_response_ms: 0 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState(""); // Full key shown once
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copiedText, setCopiedText] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [keysRes, usageRes] = await Promise.all([
        fetch("/api/keys"),
        fetch("/api/keys/usage?days=30"),
      ]);
      const keysData = await keysRes.json();
      const usageData = await usageRes.json();

      if (keysData.success) setKeys(keysData.keys || []);
      if (usageData.success) {
        setKeys(usageData.keys || keysData.keys || []);
        setDailyUsage(usageData.usage?.daily || []);
        setEndpointUsage(usageData.usage?.by_endpoint || []);
        setSummary({
          total_calls: usageData.usage?.total_calls || 0,
          success_rate: usageData.usage?.success_rate || 100,
          avg_response_ms: usageData.usage?.avg_response_ms || 0,
        });
      }
    } catch { setError("Failed to load API data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json();
      if (data.success) {
        setNewKey(data.key?.full_key || data.key?.key || "");
        setSuccess("API key created! Copy it now — it won't be shown again.");
        setNewKeyName("");
        setShowCreate(false);
        fetchData();
      } else setError(data.error || "Failed to create key");
    } catch { setError("Network error"); }
    finally { setCreating(false); }
  };

  const revokeKey = async (keyId: string) => {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/keys?keyId=${keyId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) { setSuccess("Key revoked"); fetchData(); }
      else setError(data.error || "Failed to revoke");
    } catch { setError("Failed to revoke key"); }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(""), 2000);
  };

  const maxCalls = Math.max(...dailyUsage.map(d => d.calls), 1);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 text-emerald-400 animate-spin" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
              <Key className="w-5 h-5 text-white" />
            </div>
            API Access
          </h1>
          <p className="text-gray-400 mt-1">Manage API keys and monitor usage</p>
        </div>
        <Link href="/dashboard/api-portal" className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
          <Code2 className="w-4 h-4" /> API Docs <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Messages */}
      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4" /> {error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-2 text-emerald-400 text-sm"><Check className="w-4 h-4" /> {success}</div>}

      {/* New key banner */}
      {newKey && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
          <p className="text-amber-400 text-sm font-medium">🔑 Your new API key (copy now — shown once only):</p>
          <div className="flex items-center gap-2">
            <code className="bg-[#0a0a0a] rounded px-3 py-2 text-sm font-mono text-white flex-1 break-all">{newKey}</code>
            <button onClick={() => copyText(newKey)} className="px-3 py-2 bg-amber-500 text-black rounded-lg text-sm font-medium hover:bg-amber-600 flex items-center gap-1">
              {copiedText === newKey ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
            </button>
          </div>
          <button onClick={() => setNewKey("")} className="text-xs text-gray-500 hover:text-gray-400">Dismiss</button>
        </div>
      )}

      {/* Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><Key className="w-3 h-3" /> Active Keys</div>
          <div className="text-2xl font-bold text-white mt-1">{keys.filter(k => k.status === "active").length}</div>
        </div>
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Calls (30d)</div>
          <div className="text-2xl font-bold text-white mt-1">{summary.total_calls.toLocaleString()}</div>
        </div>
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><Shield className="w-3 h-3" /> Success Rate</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{summary.success_rate}%</div>
        </div>
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><Zap className="w-3 h-3" /> Avg Response</div>
          <div className="text-2xl font-bold text-white mt-1">{summary.avg_response_ms}ms</div>
        </div>
      </div>

      {/* Usage Chart */}
      {dailyUsage.length > 0 && (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 md:p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Daily API Calls (30 days)</h3>
          <div className="flex items-end gap-[2px] h-32">
            {dailyUsage.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                <div className="w-full bg-emerald-500/80 rounded-t transition-all hover:bg-emerald-400"
                  style={{ height: `${(d.calls / maxCalls) * 100}%`, minHeight: d.calls > 0 ? "2px" : "0" }} />
                {d.rate_limited > 0 && (
                  <div className="w-full bg-red-500/60 rounded-t" style={{ height: `${(d.rate_limited / maxCalls) * 100}%` }} />
                )}
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-[#0a0a0a] border border-[#2a2a2a] rounded p-2 text-xs text-white whitespace-nowrap z-10">
                  <div>{new Date(d.date).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}</div>
                  <div className="text-emerald-400">{d.calls} calls</div>
                  {d.rate_limited > 0 && <div className="text-red-400">{d.rate_limited} rate limited</div>}
                  <div className="text-gray-500">{d.avg_ms}ms avg</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-gray-600 mt-1">
            <span>{dailyUsage[0] ? new Date(dailyUsage[0].date).toLocaleDateString("en-NG", { month: "short", day: "numeric" }) : ""}</span>
            <span>Today</span>
          </div>
        </div>
      )}

      {/* Endpoint Breakdown */}
      {endpointUsage.length > 0 && (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 md:p-6">
          <h3 className="text-sm font-semibold text-white mb-3">Endpoint Usage</h3>
          <div className="space-y-2">
            {endpointUsage.map((e, i) => {
              const maxEp = Math.max(...endpointUsage.map(x => x.calls));
              return (
                <div key={i} className="flex items-center gap-3">
                  <code className="text-xs text-gray-400 font-mono w-36 shrink-0 truncate">{e.endpoint}</code>
                  <div className="flex-1 bg-[#0a0a0a] rounded-full h-4 overflow-hidden">
                    <div className="h-full bg-blue-500/50 rounded-full" style={{ width: `${(e.calls / maxEp) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-20 text-right">{e.calls.toLocaleString()} calls</span>
                  <span className="text-xs text-gray-600 w-14 text-right">{e.avg_ms}ms</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* API Keys */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="font-semibold text-white">API Keys</h3>
          <button onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
            <Plus className="w-4 h-4" /> Create Key
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="p-4 border-b border-[#2a2a2a] bg-[#0e0e0e]">
            <div className="flex items-center gap-3">
              <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. Production, Testing)"
                className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                onKeyDown={(e) => e.key === "Enter" && createKey()} />
              <button onClick={createKey} disabled={creating || !newKeyName.trim()}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-1">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
              </button>
            </div>
          </div>
        )}

        {/* Key list */}
        {keys.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No API keys yet</p>
            <p className="text-xs mt-1">Create your first key to start using the API</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1a1a1a]">
            {keys.map((k) => (
              <div key={k.key_id} className="p-4 hover:bg-[#1a1a1a]/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">{k.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${k.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{k.status}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">{k.tier || "FREE"}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <code className="text-xs font-mono text-gray-400">{visibleKeys.has(k.key_id) ? k.prefix + "..." : k.prefix + "••••••••"}</code>
                      <button onClick={() => setVisibleKeys(prev => { const n = new Set(prev); n.has(k.key_id) ? n.delete(k.key_id) : n.add(k.key_id); return n; })}
                        className="text-gray-600 hover:text-gray-400">{visibleKeys.has(k.key_id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                      <span>{k.total_requests.toLocaleString()} requests</span>
                      <span>Limit: {k.daily_limit.toLocaleString()}/day</span>
                      <span>Last used: {k.last_used ? new Date(k.last_used).toLocaleDateString("en-NG", { month: "short", day: "numeric" }) : "Never"}</span>
                    </div>
                  </div>
                  {k.status === "active" && (
                    <button onClick={() => revokeKey(k.key_id)}
                      className="p-2 text-gray-600 hover:text-red-400 transition-colors" title="Revoke">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/dashboard/api-portal" className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 hover:bg-[#1a1a1a] transition-colors flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0"><Code2 className="w-5 h-5 text-blue-400" /></div>
          <div className="flex-1">
            <p className="text-white font-medium text-sm">API Documentation</p>
            <p className="text-gray-500 text-xs mt-0.5">Endpoints, parameters, try-it-live</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </Link>
        <a href="mailto:api@naijamarketintel.com" className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 hover:bg-[#1a1a1a] transition-colors flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center shrink-0"><Zap className="w-5 h-5 text-amber-400" /></div>
          <div className="flex-1">
            <p className="text-white font-medium text-sm">Enterprise / Custom Limits</p>
            <p className="text-gray-500 text-xs mt-0.5">Contact us for volume pricing</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </a>
      </div>
    </div>
  );
}
