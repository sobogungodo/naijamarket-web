"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Code2, Key, BarChart3, BookOpen, Play, Copy, Check, ChevronRight,
  Shield, Zap, Globe, Clock, ArrowRight, AlertTriangle, Lock,
  Terminal, FileJson, ExternalLink, RefreshCw, TrendingUp, Crown,
  Star, Building2,
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

// === NEW: API access levels tied to Consumer subscription tiers ===
const API_TIER_ACCESS = {
  CORPORATE: {
    tier_name: "Corporate",
    price_monthly: 50000,
    daily_limit: 500,
    monthly_limit: 15000,
    rate_per_min: 30,
    max_keys: 2,
    features: [
      "Price data (current)",
      "Market directory",
      "Items catalog",
      "5 items per request",
      "Category filtering",
      "CSV/JSON export",
      "Email support",
    ],
    icon: Building2,
    color: "blue",
    description: "Programmatic access to current price data for integration into your business systems.",
  },
  ENTERPRISE: {
    tier_name: "Enterprise",
    price_monthly: 150000,
    daily_limit: 2000,
    monthly_limit: 60000,
    rate_per_min: 60,
    max_keys: 5,
    features: [
      "Everything in Corporate",
      "Historical price data",
      "Bulk queries (50 items)",
      "Price change webhooks",
      "Real-time price streaming",
      "Regional analytics",
      "NFPI index data",
      "Priority support (4hr SLA)",
      "Custom endpoints",
      "Dedicated account manager",
    ],
    icon: Crown,
    color: "amber",
    description: "Full API access with webhooks, streaming, and dedicated support for enterprise integrations.",
  },
} as const;

// Non-API tiers for comparison display
const NON_API_TIERS = [
  { tier_code: "FREE", tier_name: "Free", price: "₦0", period: "" },
  { tier_code: "SILVER", tier_name: "Silver", price: "₦500", period: "/week" },
  { tier_code: "GOLD", tier_name: "Gold", price: "₦2,000", period: "/month" },
  { tier_code: "BUSINESS", tier_name: "Business", price: "₦15,000", period: "/month" },
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

  // API access requires CORPORATE or ENTERPRISE
  const hasAPIAccess = TIER_HIERARCHY.indexOf(userTier) >= TIER_HIERARCHY.indexOf("CORPORATE");
  const isEnterprise = userTier === "ENTERPRISE" || userTier === "OGA_BOSS" || userTier === "GOVERNMENT";

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

  // Get current user's API limits based on tier
  const getCurrentLimits = () => {
    if (isEnterprise) return API_TIER_ACCESS.ENTERPRISE;
    if (hasAPIAccess) return API_TIER_ACCESS.CORPORATE;
    return null;
  };

  const currentLimits = getCurrentLimits();

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
        {/* Show current tier badge */}
        <div className="mt-3 flex items-center gap-2">
          {hasAPIAccess ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/20 border border-green-500/40 rounded-full text-xs text-green-300">
              <Check className="w-3.5 h-3.5" />
              API Access Active — {userTier} tier
              {isEnterprise ? " (Full Access)" : " (Standard Access)"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-xs text-amber-300">
              <Lock className="w-3.5 h-3.5" />
              API requires Corporate or Enterprise subscription
            </span>
          )}
        </div>
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
                <div>
                  <p className="font-medium">Subscribe to Corporate or Enterprise</p>
                  <p className="text-sm text-gray-500">
                    API access is included with{" "}
                    <a href="/subscribe" className="text-blue-500 underline">Corporate (₦50,000/mo)</a> and{" "}
                    <a href="/subscribe" className="text-blue-500 underline">Enterprise (₦150,000/mo)</a> plans.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold shrink-0">2</span>
                <div><p className="font-medium">Generate your API key</p><p className="text-sm text-gray-500">Go to the <button onClick={() => setActiveTab("keys")} className="text-blue-500 underline">API Keys</button> tab to create your key.</p></div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold shrink-0">3</span>
                <div><p className="font-medium">Make your first request</p><p className="text-sm text-gray-500">Include your key in the <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">Authorization: Bearer</code> header.</p></div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold shrink-0">4</span>
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
                      <div className="overflow-x-auto rounded-lg">
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

          {/* Rate Limits & Errors — UPDATED to show tier-based limits */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-bold mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-yellow-500" /> Rate Limits by Subscription</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Free – Business</span><span className="text-gray-400 italic">No API access</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Corporate</span><span>30 req/min • 500/day</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Enterprise</span><span>60 req/min • 2,000/day</span></div>
              </div>
              <p className="text-xs text-gray-500 mt-3">Rate limit headers: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">X-RateLimit-Remaining</code></p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-bold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Error Codes</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span><code className="text-red-500">401</code></span><span className="text-gray-500">Missing/invalid API key</span></div>
                <div className="flex justify-between"><span><code className="text-red-500">403</code></span><span className="text-gray-500">Tier lacks API access or key suspended</span></div>
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
      {/* TAB: API KEYS — Now requires CORPORATE+ */}
      {/* ================================================================ */}
      {activeTab === "keys" && (
        <div className="space-y-4">
          {!hasAPIAccess ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <Lock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-2">API Access Requires Corporate or Enterprise</h3>
              <p className="text-sm text-gray-500 mb-2">
                Your current plan: <span className="font-semibold text-white bg-gray-600 px-2 py-0.5 rounded text-xs">{userTier}</span>
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Upgrade to <strong>Corporate</strong> (₦50,000/mo) for standard API access, or <strong>Enterprise</strong> (₦150,000/mo) for full access with webhooks and streaming.
              </p>
              <a href="/subscribe" className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                View Subscription Plans <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Current tier limits summary */}
              {currentLimits && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <strong>{userTier}</strong> tier — {fmt(currentLimits.daily_limit)} calls/day • {currentLimits.rate_per_min} req/min • {currentLimits.max_keys} API keys max
                    {!isEnterprise && (
                      <a href="/subscribe" className="ml-auto text-xs underline hover:no-underline">Upgrade for more →</a>
                    )}
                  </p>
                </div>
              )}

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
                    <a href="/dashboard/api" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                      <Key className="w-4 h-4" /> Create API Key
                    </a>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {keys.map(k => (
                      <div key={k.key_id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div>
                          <p className="font-mono text-sm">{k.key_prefix}...&nbsp;
                            <span className={`text-xs px-2 py-0.5 rounded ${k.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{k.status}</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{k.key_name} • Created {new Date(k.created_at).toLocaleDateString()}</p>
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
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: PRICING — REDESIGNED: Tier-based API access, not standalone plans */}
      {/* ================================================================ */}
      {activeTab === "pricing" && (
        <div className="space-y-6">
          {/* Explainer banner */}
          <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-700/40 rounded-xl p-5">
            <h2 className="text-lg font-bold text-white mb-1">API Access is Included with Your Subscription</h2>
            <p className="text-sm text-blue-200">
              API access is available on <strong>Corporate</strong> and <strong>Enterprise</strong> plans. No separate API subscription needed — upgrade your account to unlock programmatic access to Nigeria&apos;s commodity data.
            </p>
          </div>

          {/* Non-API tiers: compact row */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Consumer Plans (No API Access)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {NON_API_TIERS.map(t => {
                const isCurrent = userTier === t.tier_code;
                return (
                  <div key={t.tier_code} className={`rounded-lg p-3 text-center border ${
                    isCurrent 
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                      : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                  }`}>
                    <p className="font-semibold text-sm">{t.tier_name}</p>
                    <p className="text-xs text-gray-500">{t.price}{t.period}</p>
                    {isCurrent && <span className="text-[10px] text-blue-600 font-bold uppercase">Current Plan</span>}
                    <p className="text-[10px] text-gray-400 mt-1">Dashboard only</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* API-enabled tiers: detailed cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {(["CORPORATE", "ENTERPRISE"] as const).map(tierKey => {
              const tier = API_TIER_ACCESS[tierKey];
              const TierIcon = tier.icon;
              const isCurrent = userTier === tierKey;
              const isUpgrade = TIER_HIERARCHY.indexOf(tierKey) > TIER_HIERARCHY.indexOf(userTier);
              const isHigher = isEnterprise && tierKey === "CORPORATE"; // user is above this tier

              return (
                <div key={tierKey} className={`bg-white dark:bg-gray-800 rounded-xl border-2 p-6 relative ${
                  tierKey === "ENTERPRISE" 
                    ? "border-amber-500 ring-2 ring-amber-200 dark:ring-amber-800" 
                    : isCurrent 
                      ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800" 
                      : "border-gray-200 dark:border-gray-700"
                }`}>
                  {/* Current / Recommended badge */}
                  {isCurrent && (
                    <span className="absolute -top-3 left-4 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      Your Plan
                    </span>
                  )}
                  {tierKey === "ENTERPRISE" && !isCurrent && (
                    <span className="absolute -top-3 left-4 bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                      Full Access
                    </span>
                  )}

                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      tierKey === "ENTERPRISE" ? "bg-amber-100 dark:bg-amber-900" : "bg-blue-100 dark:bg-blue-900"
                    }`}>
                      <TierIcon className={`w-5 h-5 ${tierKey === "ENTERPRISE" ? "text-amber-600" : "text-blue-600"}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{tier.tier_name}</h3>
                      <p className="text-xs text-gray-500">{tier.description}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <span className="text-3xl font-bold">₦{tier.price_monthly.toLocaleString()}</span>
                    <span className="text-sm text-gray-500">/month</span>
                    <p className="text-xs text-gray-400 mt-0.5">Includes full dashboard + API access</p>
                  </div>

                  {/* API Limits */}
                  <div className="space-y-2 text-sm mb-5 pb-5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between text-gray-500">
                      <span>Daily API calls</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{fmt(tier.daily_limit)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Monthly API calls</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{fmt(tier.monthly_limit)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Rate limit</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{tier.rate_per_min}/min</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>API keys</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{tier.max_keys}</span>
                    </div>
                  </div>

                  {/* Features list */}
                  <ul className="space-y-2 mb-6">
                    {tier.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA button */}
                  {isCurrent ? (
                    <button onClick={() => setActiveTab("keys")} className="block w-full text-center py-2.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors">
                      Manage API Keys <Key className="w-4 h-4 inline ml-1" />
                    </button>
                  ) : isUpgrade ? (
                    <a href="/subscribe" className={`block text-center py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      tierKey === "ENTERPRISE"
                        ? "bg-amber-500 text-black hover:bg-amber-600"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}>
                      Upgrade to {tier.tier_name} <ChevronRight className="w-4 h-4 inline" />
                    </a>
                  ) : isHigher ? (
                    <div className="text-center py-2.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-500">
                      Included in your Enterprise plan
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Need more? Custom enterprise */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" /> Need Higher API Limits?
                </h3>
                <p className="text-sm text-gray-500">
                  For white-label data, on-premise deployment, or custom rate limits beyond Enterprise,
                  contact our sales team for a tailored solution.
                </p>
              </div>
              <a href="mailto:sales@naijamarketintel.ng" className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Contact Sales <ExternalLink className="w-4 h-4" />
              </a>
            </div>
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
            {!hasAPIAccess ? (
              <div className="text-center py-8">
                <Lock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-3">API access requires Corporate or Enterprise subscription.</p>
                <a href="/subscribe" className="text-blue-500 text-sm underline">View plans →</a>
              </div>
            ) : keys.length === 0 ? (
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
              <TrendingUp className="w-4 h-4" /> Detailed usage analytics with hourly breakdown coming soon. Contact <a href="mailto:support@naijamarketintel.ng" className="underline">support@naijamarketintel.ng</a> for usage reports.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
