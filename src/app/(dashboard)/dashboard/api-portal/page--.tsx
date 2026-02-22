"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Code2, Key, BarChart3, BookOpen, Play, Copy, Check, ChevronRight,
  Shield, Zap, Globe, Clock, ArrowRight, AlertTriangle, Lock,
  Terminal, FileJson, ExternalLink, RefreshCw, TrendingUp,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface APIKey {
  key_id: number;
  key_prefix: string;
  key_name: string;
  plan_type: string;
  daily_limit: number;
  monthly_limit: number;
  calls_today: number;
  calls_this_month: number;
  total_calls: number;
  status: string;
  rate_limit_per_min: number;
  created_at: string;
  last_used_at: string | null;
}

interface APIPlan {
  plan_id: string;
  plan_name: string;
  price_monthly: number;
  daily_limit: number;
  monthly_limit: number;
  rate_per_min: number;
  max_keys: number;
  features: string[];
}

interface PlaygroundResult {
  status: number;
  data: unknown;
  time: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const API_BASE = "/api";
const DOCS_BASE = "https://www.naijamarketintel.ng";

const TIER_HIERARCHY = ["FREE", "SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"];

const API_PLANS: APIPlan[] = [
  { plan_id: "STARTER", plan_name: "Starter", price_monthly: 25000, daily_limit: 500, monthly_limit: 10000, rate_per_min: 30, max_keys: 2, features: ["Price data (current)", "Market directory", "Items catalog", "5 items per request", "Email support"] },
  { plan_id: "STANDARD", plan_name: "Standard", price_monthly: 75000, daily_limit: 2000, monthly_limit: 50000, rate_per_min: 60, max_keys: 5, features: ["Everything in Starter", "Historical price data", "Bulk queries (50 items)", "Price change webhooks", "Category filtering", "CSV/JSON export"] },
  { plan_id: "PREMIUM", plan_name: "Premium", price_monthly: 150000, daily_limit: 5000, monthly_limit: 150000, rate_per_min: 120, max_keys: 10, features: ["Everything in Standard", "Real-time price streaming", "Regional analytics", "NFPI index data", "Priority support (4hr SLA)", "Custom endpoints"] },
  { plan_id: "ENTERPRISE", plan_name: "Enterprise", price_monthly: 500000, daily_limit: -1, monthly_limit: -1, rate_per_min: 300, max_keys: 25, features: ["Unlimited access", "Dedicated account manager", "99.9% SLA", "White-label data", "Custom integration", "On-premise option"] },
];

const ENDPOINTS = [
  { method: "GET", path: "/api/v1/prices", desc: "Get commodity prices", params: [
    { name: "item", type: "string", desc: "Commodity name (e.g. 'Rice')", required: false },
    { name: "market", type: "string", desc: "Market name (e.g. 'Mile 12')", required: false },
    { name: "state", type: "string", desc: "State name (e.g. 'Lagos')", required: false },
    { name: "category", type: "string", desc: "Category name (e.g. 'Grains & Cereals')", required: false },
    { name: "limit", type: "integer", desc: "Max results (default: 50, max: 500)", required: false },
    { name: "offset", type: "integer", desc: "Pagination offset", required: false },
  ]},
  { method: "GET", path: "/api/v1/markets", desc: "List all tracked markets", params: [
    { name: "state", type: "string", desc: "Filter by state", required: false },
    { name: "zone", type: "string", desc: "Filter by geopolitical zone", required: false },
  ]},
  { method: "GET", path: "/api/v1/items", desc: "List all tracked commodities", params: [
    { name: "category", type: "string", desc: "Filter by category", required: false },
  ]},
  { method: "GET", path: "/api/v1/categories", desc: "List commodity categories", params: [] },
  { method: "GET", path: "/api/v1/nfpi", desc: "NaijaFood Price Index (weekly)", params: [
    { name: "weeks", type: "integer", desc: "Number of weeks (default: 12)", required: false },
    { name: "zone", type: "string", desc: "Regional index filter", required: false },
  ]},
  { method: "GET", path: "/api/v1/compare", desc: "Compare prices across markets", params: [
    { name: "item", type: "string", desc: "Commodity to compare", required: true },
    { name: "markets", type: "string", desc: "Comma-separated market names", required: false },
  ]},
];

const CODE_EXAMPLES = {
  curl: `curl -X GET "${DOCS_BASE}/api/v1/prices?item=Rice&market=Mile%2012&limit=10" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
  python: `import requests

API_KEY = "nm_live_your_key_here"
BASE_URL = "${DOCS_BASE}/api/v1"

response = requests.get(
    f"{BASE_URL}/prices",
    params={"item": "Rice", "market": "Mile 12", "limit": 10},
    headers={"Authorization": f"Bearer {API_KEY}"}
)

data = response.json()
for price in data["prices"]:
    print(f"{price['item_name']} @ {price['market_name']}: ₦{price['price']:,.0f}")`,
  javascript: `const API_KEY = "nm_live_your_key_here";
const BASE_URL = "${DOCS_BASE}/api/v1";

const response = await fetch(
  \`\${BASE_URL}/prices?item=Rice&market=Mile%2012&limit=10\`,
  { headers: { "Authorization": \`Bearer \${API_KEY}\` } }
);

const data = await response.json();
data.prices.forEach(p => 
  console.log(\`\${p.item_name} @ \${p.market_name}: ₦\${p.price.toLocaleString()}\`)
);`,
  php: `<?php
$apiKey = "nm_live_your_key_here";
$baseUrl = "${DOCS_BASE}/api/v1";

$ch = curl_init("$baseUrl/prices?item=Rice&market=Mile%2012&limit=10");
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer $apiKey"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = json_decode(curl_exec($ch), true);
foreach ($response["prices"] as $price) {
    echo "{$price['item_name']} @ {$price['market_name']}: ₦" . 
         number_format($price['price']) . "\\n";
}`,
};

type CodeLang = keyof typeof CODE_EXAMPLES;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function APIPortalPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"docs" | "playground" | "keys" | "pricing" | "usage">("docs");
  const [copied, setCopied] = useState(false);
  const [codeLang, setCodeLang] = useState<CodeLang>("curl");
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [userTier, setUserTier] = useState("FREE");

  // Playground state
  const [pgEndpoint, setPgEndpoint] = useState(0);
  const [pgParams, setPgParams] = useState<Record<string, string>>({});
  const [pgResult, setPgResult] = useState<PlaygroundResult | null>(null);
  const [pgRunning, setPgRunning] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setUserTier((session.user as { tier?: string }).tier || "FREE");
    }
  }, [session]);

  const hasTierAccess = TIER_HIERARCHY.indexOf(userTier) >= TIER_HIERARCHY.indexOf("BUSINESS");

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const loadKeys = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const phone = (session.user as { phone?: string }).phone || "";
      const res = await fetch(`${API_BASE}/keys?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (data.success) setKeys(data.keys || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [session]);

  useEffect(() => { if (activeTab === "keys") loadKeys(); }, [activeTab, loadKeys]);

  const runPlayground = async () => {
    const ep = ENDPOINTS[pgEndpoint];
    setPgRunning(true);
    const start = Date.now();
    try {
      const params = new URLSearchParams();
      Object.entries(pgParams).forEach(([k, v]) => { if (v) params.set(k, v); });
      params.set("limit", pgParams.limit || "5");
      const res = await fetch(`${ep.path}?${params.toString()}`);
      const data = await res.json();
      setPgResult({ status: res.status, data, time: Date.now() - start });
    } catch (err) {
      setPgResult({ status: 500, data: { error: String(err) }, time: Date.now() - start });
    }
    setPgRunning(false);
  };

  const fmt = (n: number) => n === -1 ? "Unlimited" : n.toLocaleString();

  // ---- RENDER ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Code2 className="w-8 h-8 text-blue-400" />
          <h1 className="text-2xl font-bold">API Developer Portal</h1>
        </div>
        <p className="text-blue-200 text-sm">
          Access Nigeria&apos;s most comprehensive commodity price data programmatically.
          263 commodities • 219 markets • 31 states • Real-time pricing.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg overflow-x-auto">
        {[
          { id: "docs", label: "Documentation", icon: BookOpen },
          { id: "playground", label: "API Playground", icon: Play },
          { id: "keys", label: "API Keys", icon: Key },
          { id: "pricing", label: "Plans & Pricing", icon: Zap },
          { id: "usage", label: "Usage Stats", icon: BarChart3 },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id ? "bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* ================================================================ */}
      {/* TAB: DOCUMENTATION */}
      {/* ================================================================ */}
      {activeTab === "docs" && (
        <div className="space-y-6">
          {/* Quick Start */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" /> Quick Start
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold shrink-0">1</span>
                <div><p className="font-medium">Get your API key</p><p className="text-sm text-gray-500">Go to the <button onClick={() => setActiveTab("keys")} className="text-blue-500 underline">API Keys</button> tab to generate your key.</p></div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold shrink-0">2</span>
                <div><p className="font-medium">Make your first request</p><p className="text-sm text-gray-500">Include your key in the <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">Authorization: Bearer</code> header.</p></div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold shrink-0">3</span>
                <div><p className="font-medium">Integrate into your app</p><p className="text-sm text-gray-500">Use the response data in your dashboards, reports, or applications.</p></div>
              </div>
            </div>
          </div>

          {/* Authentication */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" /> Authentication
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              All API requests must include your API key. There are two ways to authenticate:
            </p>
            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <p className="text-xs font-mono text-gray-500 mb-1">Option 1: Authorization Header (recommended)</p>
                <code className="text-sm text-green-600 dark:text-green-400">Authorization: Bearer nm_live_your_key_here</code>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <p className="text-xs font-mono text-gray-500 mb-1">Option 2: X-API-Key Header</p>
                <code className="text-sm text-green-600 dark:text-green-400">X-API-Key: nm_live_your_key_here</code>
              </div>
            </div>
          </div>

          {/* Endpoints Reference */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-purple-500" /> API Endpoints
            </h2>
            <p className="text-xs text-gray-500 mb-4">Base URL: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{DOCS_BASE}</code></p>
            <div className="space-y-4">
              {ENDPOINTS.map((ep, i) => (
                <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">{ep.method}</span>
                    <code className="text-sm font-mono">{ep.path}</code>
                    <span className="text-sm text-gray-500 ml-auto">{ep.desc}</span>
                  </div>
                  {ep.params.length > 0 && (
                    <div className="p-4">
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-gray-500 text-xs uppercase">
                          <th className="pb-2 pr-4">Parameter</th><th className="pb-2 pr-4">Type</th><th className="pb-2 pr-4">Required</th><th className="pb-2">Description</th>
                        </tr></thead>
                        <tbody>
                          {ep.params.map((p, j) => (
                            <tr key={j} className="border-t border-gray-100 dark:border-gray-800">
                              <td className="py-2 pr-4"><code className="text-blue-600 dark:text-blue-400 text-xs">{p.name}</code></td>
                              <td className="py-2 pr-4 text-gray-500 text-xs">{p.type}</td>
                              <td className="py-2 pr-4">{p.required ? <span className="text-red-500 text-xs">Yes</span> : <span className="text-gray-400 text-xs">No</span>}</td>
                              <td className="py-2 text-gray-600 dark:text-gray-400 text-xs">{p.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Code Examples */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-orange-500" /> Code Examples
            </h2>
            <div className="flex gap-1 mb-4">
              {(["curl", "python", "javascript", "php"] as CodeLang[]).map(lang => (
                <button key={lang} onClick={() => setCodeLang(lang)}
                  className={`px-3 py-1 rounded text-xs font-medium capitalize ${codeLang === lang ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}>{lang}</button>
              ))}
            </div>
            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap">{CODE_EXAMPLES[codeLang]}</pre>
              <button onClick={() => copyToClipboard(CODE_EXAMPLES[codeLang])}
                className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300">
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Response Format */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <FileJson className="w-5 h-5 text-cyan-500" /> Response Format
            </h2>
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto">{`{
  "success": true,
  "count": 10,
  "total": 789,
  "prices": [
    {
      "item_name": "Rice - Foreign (50kg)",
      "category": "Grains & Cereals",
      "market_name": "Mile 12 Market",
      "state": "Lagos",
      "zone": "South-West",
      "price": 85000.00,
      "unit": "bag",
      "prev_price": 83200.00,
      "change_pct": 2.16,
      "updated_at": "2026-02-22T09:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "has_more": true,
    "rate_limit_remaining": 1985
  }
}`}</pre>
          </div>

          {/* Rate Limits & Errors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-bold mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-yellow-500" /> Rate Limits</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Starter</span><span>30 req/min</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Standard</span><span>60 req/min</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Premium</span><span>120 req/min</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Enterprise</span><span>300 req/min</span></div>
              </div>
              <p className="text-xs text-gray-500 mt-3">Rate limit headers: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">X-RateLimit-Remaining</code></p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-bold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Error Codes</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span><code className="text-red-500">401</code></span><span className="text-gray-500">Missing/invalid API key</span></div>
                <div className="flex justify-between"><span><code className="text-red-500">403</code></span><span className="text-gray-500">Key suspended or expired</span></div>
                <div className="flex justify-between"><span><code className="text-red-500">429</code></span><span className="text-gray-500">Rate limit exceeded</span></div>
                <div className="flex justify-between"><span><code className="text-red-500">500</code></span><span className="text-gray-500">Server error</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: API PLAYGROUND */}
      {/* ================================================================ */}
      {activeTab === "playground" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Play className="w-5 h-5 text-green-500" /> API Playground
            </h2>
            <p className="text-sm text-gray-500 mb-4">Test API endpoints live. No API key needed for playground.</p>

            {/* Endpoint selector */}
            <div className="mb-4">
              <label className="text-sm font-medium mb-1 block">Endpoint</label>
              <select value={pgEndpoint} onChange={e => { setPgEndpoint(Number(e.target.value)); setPgParams({}); setPgResult(null); }}
                className="w-full border rounded-lg p-2.5 text-sm bg-white dark:bg-gray-900 dark:border-gray-700">
                {ENDPOINTS.map((ep, i) => (
                  <option key={i} value={i}>{ep.method} {ep.path} — {ep.desc}</option>
                ))}
              </select>
            </div>

            {/* Parameters */}
            {ENDPOINTS[pgEndpoint].params.length > 0 && (
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ENDPOINTS[pgEndpoint].params.map(p => (
                  <div key={p.name}>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">
                      {p.name} {p.required && <span className="text-red-500">*</span>}
                    </label>
                    <input type="text" placeholder={p.desc} value={pgParams[p.name] || ""}
                      onChange={e => setPgParams(prev => ({ ...prev, [p.name]: e.target.value }))}
                      className="w-full border rounded-lg p-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700" />
                  </div>
                ))}
              </div>
            )}

            {/* Run button */}
            <button onClick={runPlayground} disabled={pgRunning}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors">
              {pgRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {pgRunning ? "Running..." : "Send Request"}
            </button>

            {/* Result */}
            {pgResult && (
              <div className="mt-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${pgResult.status === 200 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {pgResult.status}
                  </span>
                  <span className="text-xs text-gray-500">{pgResult.time}ms</span>
                </div>
                <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto max-h-96">
                  {JSON.stringify(pgResult.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: API KEYS */}
      {/* ================================================================ */}
      {activeTab === "keys" && (
        <div className="space-y-4">
          {!hasTierAccess ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <Lock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-2">API Access requires BUSINESS+ tier</h3>
              <p className="text-sm text-gray-500 mb-4">Upgrade your subscription to generate API keys and access the data API.</p>
              <a href="/subscribe" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                Upgrade Now <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-500" /> Your API Keys
                </h2>
                <button onClick={loadKeys} className="text-sm text-blue-500 flex items-center gap-1">
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>

              {keys.length === 0 ? (
                <div className="text-center py-8">
                  <Key className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-3">No API keys yet. Create one to get started.</p>
                  <p className="text-xs text-gray-400">Go to <a href="/dashboard/api" className="text-blue-500 underline">/dashboard/api</a> to manage your keys.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {keys.map(k => (
                    <div key={k.key_id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div>
                        <p className="font-mono text-sm">{k.key_prefix}...&nbsp;
                          <span className={`text-xs px-2 py-0.5 rounded ${k.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{k.status}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{k.key_name} • {k.plan_type} • Created {new Date(k.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <p>Today: {fmt(k.calls_today)} / {fmt(k.daily_limit)}</p>
                        <p>Month: {fmt(k.calls_this_month)} / {fmt(k.monthly_limit)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-4">Manage keys at <a href="/dashboard/api" className="text-blue-500 underline">/dashboard/api</a></p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: PRICING */}
      {/* ================================================================ */}
      {activeTab === "pricing" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {API_PLANS.map((plan, i) => (
              <div key={plan.plan_id} className={`bg-white dark:bg-gray-800 rounded-xl border-2 p-6 ${i === 1 ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800" : "border-gray-200 dark:border-gray-700"}`}>
                {i === 1 && <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Most Popular</span>}
                <h3 className="text-lg font-bold mt-1">{plan.plan_name}</h3>
                <div className="mt-2 mb-4">
                  <span className="text-2xl font-bold">₦{plan.price_monthly.toLocaleString()}</span>
                  <span className="text-sm text-gray-500">/month</span>
                </div>
                <div className="space-y-2 text-sm mb-6">
                  <div className="flex justify-between text-gray-500"><span>Daily calls</span><span className="font-medium text-gray-900 dark:text-gray-100">{fmt(plan.daily_limit)}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Monthly calls</span><span className="font-medium text-gray-900 dark:text-gray-100">{fmt(plan.monthly_limit)}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Rate limit</span><span className="font-medium text-gray-900 dark:text-gray-100">{plan.rate_per_min}/min</span></div>
                  <div className="flex justify-between text-gray-500"><span>API keys</span><span className="font-medium text-gray-900 dark:text-gray-100">{plan.max_keys}</span></div>
                </div>
                <ul className="space-y-1.5 mb-6">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <a href="/subscribe" className={`block text-center py-2 rounded-lg text-sm font-medium transition-colors ${
                  i === 1 ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                }`}>
                  {i === 3 ? "Contact Sales" : "Get Started"} <ChevronRight className="w-4 h-4 inline" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: USAGE */}
      {/* ================================================================ */}
      {activeTab === "usage" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" /> API Usage Overview
            </h2>
            {keys.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No API keys found. Create a key to start tracking usage.</p>
            ) : (
              <div className="space-y-4">
                {keys.map(k => (
                  <div key={k.key_id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium">{k.key_name}</p>
                        <p className="text-xs text-gray-500 font-mono">{k.key_prefix}...</p>
                      </div>
                      <span className="text-sm font-bold">{k.total_calls.toLocaleString()} total calls</span>
                    </div>
                    {/* Daily usage bar */}
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Today</span><span>{fmt(k.calls_today)} / {fmt(k.daily_limit)}</span></div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${k.daily_limit === -1 ? 5 : Math.min(100, (k.calls_today / k.daily_limit) * 100)}%` }} />
                      </div>
                    </div>
                    {/* Monthly usage bar */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1"><span>This month</span><span>{fmt(k.calls_this_month)} / {fmt(k.monthly_limit)}</span></div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${k.monthly_limit === -1 ? 5 : Math.min(100, (k.calls_this_month / k.monthly_limit) * 100)}%` }} />
                      </div>
                    </div>
                    {k.last_used_at && <p className="text-xs text-gray-400 mt-2">Last used: {new Date(k.last_used_at).toLocaleString()}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Detailed usage analytics with hourly breakdown coming soon. Contact <a href="mailto:support@naijafood.ng" className="underline">support@naijafood.ng</a> for usage reports.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
