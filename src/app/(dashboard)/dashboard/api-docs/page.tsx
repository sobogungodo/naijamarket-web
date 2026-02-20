// ============================================================================
// src/app/(dashboard)/dashboard/api-docs/page.tsx
// NaijaMarket Intel - Interactive API Documentation
// Version: 1.0.0 | Date: 2026-02-20
// ============================================================================

"use client";

import { useState } from "react";
import {
  Code2, Copy, Check, Play, ChevronDown, ChevronRight,
  Zap, Lock, Globe, BarChart3, TrendingUp, Database,
  MapPin, ShoppingBasket, Clock, AlertCircle, Loader2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

// ============================================================================
// ENDPOINT DEFINITIONS
// ============================================================================

const ENDPOINTS = [
  {
    id: "prices",
    method: "GET",
    path: "/api/v1/prices",
    title: "Get Current Prices",
    description: "Latest commodity prices across Nigerian markets with filtering and sorting.",
    tier: "FREE",
    params: [
      { name: "item", type: "string", required: false, desc: "Filter by item name (partial match)", example: "rice" },
      { name: "market", type: "string", required: false, desc: "Filter by market name (partial match)", example: "mile 12" },
      { name: "state", type: "string", required: false, desc: "Filter by state", example: "lagos" },
      { name: "category", type: "string", required: false, desc: "Filter by category", example: "grains" },
      { name: "sort", type: "string", required: false, desc: "Sort: date_desc, price_asc, price_desc, change_desc", example: "change_desc" },
      { name: "limit", type: "integer", required: false, desc: "Results per page (max 200)", example: "50" },
      { name: "offset", type: "integer", required: false, desc: "Pagination offset", example: "0" },
    ],
    sampleResponse: `{
  "success": true,
  "data": [
    {
      "item": "Rice (50kg) - Local",
      "market": "Mile 12 Market",
      "state": "Lagos",
      "category": "Rice",
      "price": 82500.00,
      "unit": "bag",
      "previous_price": 81200.00,
      "change_pct": 1.60,
      "trend": "↑",
      "confidence": 94.2,
      "date": "2026-02-20",
      "time_slot": "11:30"
    }
  ],
  "pagination": { "total": 2847, "limit": 50, "offset": 0, "has_more": true },
  "meta": { "api_version": "v1", "timestamp": "2026-02-20T10:30:00Z", "response_ms": 42 }
}`,
  },
  {
    id: "markets",
    method: "GET",
    path: "/api/v1/markets",
    title: "List Markets",
    description: "All tracked Nigerian markets with GPS coordinates and optional activity stats.",
    tier: "FREE",
    params: [
      { name: "state", type: "string", required: false, desc: "Filter by state", example: "lagos" },
      { name: "include_stats", type: "boolean", required: false, desc: "Include 30-day activity stats", example: "true" },
    ],
    sampleResponse: `{
  "success": true,
  "data": [
    {
      "id": "MKT001",
      "name": "Mile 12 Market",
      "state": "Lagos",
      "location": { "lat": 6.5833, "lng": 3.3833 },
      "radius_meters": 500,
      "hours": "6:00 AM - 8:00 PM",
      "stats": { "items_tracked": 142, "prices_30d": 12840, "latest_date": "2026-02-20" }
    }
  ],
  "count": 226
}`,
  },
  {
    id: "items",
    method: "GET",
    path: "/api/v1/items",
    title: "Items Catalog",
    description: "Browse all tracked commodities with categories and optional latest price.",
    tier: "FREE",
    params: [
      { name: "category", type: "string", required: false, desc: "Filter by category", example: "rice" },
      { name: "search", type: "string", required: false, desc: "Search by name", example: "tomato" },
      { name: "include_prices", type: "boolean", required: false, desc: "Include latest price data", example: "true" },
    ],
    sampleResponse: `{
  "success": true,
  "data": [
    {
      "id": "ITM001",
      "name": "Rice (50kg) - Local",
      "category": "Rice",
      "unit": "bag",
      "price_range": { "min": 45000, "max": 95000, "avg": 72500 },
      "latest": { "price": 82500, "market": "Mile 12 Market", "date": "2026-02-20", "change_pct": 1.6 }
    }
  ],
  "count": 524
}`,
  },
  {
    id: "trends",
    method: "GET",
    path: "/api/v1/trends",
    title: "Price Trends",
    description: "Daily price trends for a specific commodity. Perfect for charts and analysis.",
    tier: "STARTER",
    params: [
      { name: "item", type: "string", required: true, desc: "Item name (required)", example: "rice" },
      { name: "market", type: "string", required: false, desc: "Specific market", example: "mile 12" },
      { name: "state", type: "string", required: false, desc: "Filter by state", example: "lagos" },
      { name: "days", type: "integer", required: false, desc: "Lookback period (max 90)", example: "30" },
    ],
    sampleResponse: `{
  "success": true,
  "data": [
    { "item": "Rice (50kg)", "market": "All Markets", "date": "2026-01-21", "avg_price": 79800, "min_price": 72000, "max_price": 88500, "data_points": 45 },
    { "item": "Rice (50kg)", "market": "All Markets", "date": "2026-01-22", "avg_price": 80100, "min_price": 72500, "max_price": 89000, "data_points": 48 }
  ],
  "summary": {
    "item": "rice", "period_days": 30, "start_price": 78200, "end_price": 82500,
    "change_pct": 5.50, "avg_price": 80350, "min_price": 72000, "max_price": 89000, "direction": "UP"
  }
}`,
  },
  {
    id: "historical",
    method: "GET",
    path: "/api/v1/historical",
    title: "Historical Data",
    description: "Bulk historical price data with daily/weekly/monthly granularity. Supports CSV export.",
    tier: "BUSINESS",
    params: [
      { name: "item", type: "string", required: true, desc: "Item name (required)", example: "rice" },
      { name: "market", type: "string", required: false, desc: "Specific market", example: "mile 12" },
      { name: "from", type: "date", required: false, desc: "Start date (YYYY-MM-DD)", example: "2026-01-01" },
      { name: "to", type: "date", required: false, desc: "End date (YYYY-MM-DD)", example: "2026-02-20" },
      { name: "granularity", type: "string", required: false, desc: "daily, weekly, monthly", example: "weekly" },
      { name: "format", type: "string", required: false, desc: "json or csv", example: "json" },
      { name: "limit", type: "integer", required: false, desc: "Max results (max 2000)", example: "500" },
    ],
    sampleResponse: `{
  "success": true,
  "data": [
    { "item": "Rice (50kg)", "market": "Mile 12", "state": "Lagos", "date": "2026-02-17", "avg_price": 82100, "min_price": 79500, "max_price": 84200, "data_points": 12 }
  ],
  "query": { "item": "rice", "market": "mile 12", "from": "2026-01-01", "to": "2026-02-20", "granularity": "weekly" },
  "pagination": { "limit": 500, "offset": 0, "has_more": false }
}`,
  },
  {
    id: "stats",
    method: "GET",
    path: "/api/v1/stats",
    title: "Platform Statistics",
    description: "Real-time platform stats including top gainers/losers and data coverage.",
    tier: "BUSINESS",
    params: [],
    sampleResponse: `{
  "success": true,
  "platform": {
    "markets": 226, "items": 524, "categories": 128, "states": 37,
    "total_price_records": 15200000,
    "data_range": { "from": "2025-01-01", "to": "2026-02-20" }
  },
  "today": {
    "prices_generated": 137860,
    "top_gainers": [{ "item": "Tomatoes", "market": "Mile 12", "price": 45000, "change_pct": 12.1 }],
    "top_losers": [{ "item": "Cement", "market": "Iddo", "price": 6300, "change_pct": -3.1 }]
  }
}`,
  },
];

const TIERS = [
  { name: "FREE", price: "₦0", daily: "100", rate: "10/min", keys: 1, endpoints: "prices, markets, items", color: "gray" },
  { name: "STARTER", price: "₦25,000/mo", daily: "1,000", rate: "30/min", keys: 2, endpoints: "+ trends", color: "blue" },
  { name: "BUSINESS", price: "₦100,000/mo", daily: "10,000", rate: "60/min", keys: 5, endpoints: "+ historical, stats", color: "emerald" },
  { name: "CORPORATE", price: "₦250,000/mo", daily: "50,000", rate: "120/min", keys: 10, endpoints: "All endpoints", color: "amber" },
  { name: "ENTERPRISE", price: "₦500,000/mo", daily: "500,000", rate: "300/min", keys: 25, endpoints: "All + priority support", color: "purple" },
];

// ============================================================================
// COMPONENTS
// ============================================================================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 text-gray-500 hover:text-white transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    FREE: "bg-gray-500/20 text-gray-400",
    STARTER: "bg-blue-500/20 text-blue-400",
    BUSINESS: "bg-emerald-500/20 text-emerald-400",
    CORPORATE: "bg-amber-500/20 text-amber-400",
    ENTERPRISE: "bg-purple-500/20 text-purple-400",
  };
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors[tier] || colors.FREE}`}>{tier}+</span>;
}

function EndpointCard({ ep }: { ep: typeof ENDPOINTS[0] }) {
  const [open, setOpen] = useState(false);
  const [tryOpen, setTryOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [params, setParams] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");

  const buildUrl = () => {
    const base = `https://www.naijamarketintel.com${ep.path}`;
    const qp = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    return qp ? `${base}?${qp}` : base;
  };

  const tryIt = async () => {
    if (!apiKey) { setResponse('{"error": "Enter your API key above"}'); return; }
    setLoading(true);
    try {
      const res = await fetch(buildUrl(), { headers: { "X-API-Key": apiKey } });
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setResponse(`{"error": "${e.message}"}`);
    } finally { setLoading(false); }
  };

  const curlCmd = `curl -H "X-API-Key: YOUR_API_KEY" \\\n  "${buildUrl()}"`;

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
      {/* Header */}
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-4 hover:bg-[#1a1a1a] transition-colors text-left">
        <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">{ep.method}</span>
        <code className="text-sm text-white font-mono flex-1">{ep.path}</code>
        <TierBadge tier={ep.tier} />
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-[#2a2a2a] p-4 space-y-4">
          <p className="text-sm text-gray-400">{ep.description}</p>

          {/* Parameters */}
          {ep.params.length > 0 && (
            <div>
              <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Parameters</h4>
              <div className="space-y-1">
                {ep.params.map((p) => (
                  <div key={p.name} className="flex items-start gap-3 text-sm py-1.5 border-b border-[#1a1a1a] last:border-0">
                    <code className="text-emerald-400 font-mono text-xs shrink-0 w-28">{p.name}{p.required && <span className="text-red-400">*</span>}</code>
                    <span className="text-gray-600 text-xs w-16 shrink-0">{p.type}</span>
                    <span className="text-gray-400 text-xs flex-1">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* cURL example */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs text-gray-500 uppercase tracking-wider">Example Request</h4>
              <CopyButton text={curlCmd} />
            </div>
            <pre className="bg-[#0a0a0a] rounded-lg p-3 text-xs text-gray-300 font-mono overflow-x-auto">{curlCmd}</pre>
          </div>

          {/* Sample Response */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs text-gray-500 uppercase tracking-wider">Sample Response</h4>
              <CopyButton text={ep.sampleResponse} />
            </div>
            <pre className="bg-[#0a0a0a] rounded-lg p-3 text-xs text-emerald-300/80 font-mono overflow-x-auto max-h-48 custom-scrollbar">{ep.sampleResponse}</pre>
          </div>

          {/* Try It */}
          <div>
            <button onClick={() => setTryOpen(!tryOpen)}
              className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors">
              <Play className="w-4 h-4" /> Try it live
              <ChevronRight className={`w-3 h-3 transition-transform ${tryOpen ? "rotate-90" : ""}`} />
            </button>

            {tryOpen && (
              <div className="mt-3 space-y-3 bg-[#0e0e0e] rounded-lg p-4 border border-[#2a2a2a]">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">API Key</label>
                  <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                    placeholder="nm_live_..." className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white font-mono outline-none focus:border-emerald-500" />
                </div>
                {ep.params.map((p) => (
                  <div key={p.name}>
                    <label className="text-xs text-gray-500 block mb-1">{p.name} {p.required && <span className="text-red-400">*</span>}</label>
                    <input type="text" value={params[p.name] || ""} onChange={(e) => setParams({ ...params, [p.name]: e.target.value })}
                      placeholder={p.example} className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
                  </div>
                ))}
                <button onClick={tryIt} disabled={loading}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Send Request
                </button>
                {response && (
                  <pre className="bg-[#0a0a0a] rounded-lg p-3 text-xs text-gray-300 font-mono overflow-x-auto max-h-60 custom-scrollbar">{response}</pre>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function APIDocsPage() {
  const baseUrl = "https://www.naijamarketintel.com";

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          API Documentation
        </h1>
        <p className="text-gray-400 mt-1">Real-time Nigerian commodity price data for your applications</p>
      </div>

      {/* Quick Start */}
      <div className="bg-gradient-to-r from-emerald-500/5 to-blue-500/5 border border-[#2a2a2a] rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Zap className="w-5 h-5 text-amber-400" /> Quick Start</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
            <div>
              <p className="text-sm text-white">Get your API key</p>
              <p className="text-xs text-gray-500">Go to <Link href="/dashboard/api" className="text-emerald-400 hover:underline">API Keys</Link> to generate a key</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
            <div>
              <p className="text-sm text-white">Make your first request</p>
              <div className="flex items-center gap-2 mt-1">
                <pre className="bg-[#0a0a0a] rounded px-3 py-1.5 text-xs text-gray-300 font-mono flex-1">curl -H &quot;X-API-Key: nm_live_...&quot; {baseUrl}/api/v1/prices?item=rice</pre>
                <CopyButton text={`curl -H "X-API-Key: YOUR_KEY" ${baseUrl}/api/v1/prices?item=rice`} />
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
            <p className="text-sm text-white">Build something amazing 🚀</p>
          </div>
        </div>
      </div>

      {/* Auth */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Lock className="w-5 h-5 text-amber-400" /> Authentication</h2>
        <p className="text-sm text-gray-400">All requests require an API key. Pass it in one of these ways:</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="bg-[#0a0a0a] px-2 py-1 rounded text-xs text-emerald-400 font-mono">X-API-Key: nm_live_...</code>
            <span className="text-xs text-gray-500">Header (recommended)</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-[#0a0a0a] px-2 py-1 rounded text-xs text-emerald-400 font-mono">Authorization: Bearer nm_live_...</code>
            <span className="text-xs text-gray-500">Bearer token</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-[#0a0a0a] px-2 py-1 rounded text-xs text-emerald-400 font-mono">?api_key=nm_live_...</code>
            <span className="text-xs text-gray-500">Query param (testing only)</span>
          </div>
        </div>
      </div>

      {/* Rate Limits / Pricing */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-400" /> Plans & Rate Limits</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a]">
                <th className="pb-2 pr-4">Tier</th>
                <th className="pb-2 pr-4">Price</th>
                <th className="pb-2 pr-4">Daily Limit</th>
                <th className="pb-2 pr-4">Rate</th>
                <th className="pb-2 pr-4">Keys</th>
                <th className="pb-2">Endpoints</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map((t) => (
                <tr key={t.name} className="border-b border-[#1a1a1a]">
                  <td className="py-2.5 pr-4"><TierBadge tier={t.name} /></td>
                  <td className="py-2.5 pr-4 text-white font-medium">{t.price}</td>
                  <td className="py-2.5 pr-4 text-gray-400">{t.daily}</td>
                  <td className="py-2.5 pr-4 text-gray-400">{t.rate}</td>
                  <td className="py-2.5 pr-4 text-gray-400">{t.keys}</td>
                  <td className="py-2.5 text-gray-400">{t.endpoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-600">Rate limit headers included in every response: X-RateLimit-Limit, X-RateLimit-Daily-Remaining</p>
      </div>

      {/* Endpoints */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Globe className="w-5 h-5 text-emerald-400" /> Endpoints</h2>
        {ENDPOINTS.map((ep) => (
          <EndpointCard key={ep.id} ep={ep} />
        ))}
      </div>

      {/* Error Codes */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-400" /> Error Codes</h2>
        <div className="space-y-1 text-sm">
          {[
            { code: 401, error: "authentication_required", desc: "No API key provided" },
            { code: 401, error: "invalid_api_key", desc: "API key not found or invalid" },
            { code: 403, error: "key_revoked", desc: "API key has been revoked" },
            { code: 403, error: "endpoint_not_available", desc: "Your tier doesn't include this endpoint" },
            { code: 429, error: "rate_limit_exceeded", desc: "Too many requests per minute" },
            { code: 429, error: "daily_limit_exceeded", desc: "Daily request limit reached" },
            { code: 400, error: "missing_parameter", desc: "Required parameter not provided" },
            { code: 500, error: "server_error", desc: "Internal server error" },
          ].map((e, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-[#1a1a1a] last:border-0">
              <span className={`text-xs font-mono font-bold w-8 ${e.code < 500 ? "text-amber-400" : "text-red-400"}`}>{e.code}</span>
              <code className="text-xs text-gray-400 font-mono w-48">{e.error}</code>
              <span className="text-xs text-gray-500">{e.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SDKs / Support */}
      <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-[#2a2a2a] rounded-xl p-6 text-center">
        <p className="text-sm text-gray-400">Need help integrating? Contact us at <span className="text-white">api@naijamarketintel.com</span></p>
        <p className="text-xs text-gray-600 mt-2">Python & JavaScript SDKs coming soon</p>
      </div>
    </div>
  );
}
