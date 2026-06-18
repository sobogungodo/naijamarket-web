// src/app/(dashboard)/dashboard/nfpi/page.tsx
// NaijaMarket Intel - NFPI Dashboard
// Bloomberg-style Food Price Index visualization
// Created: 2026-01-18

"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from "recharts";
import { 
  TrendingUp, TrendingDown, Lock, Download, Info, AlertCircle, 
  RefreshCw, FileText, Calendar
} from "lucide-react";

// Theme colors
const COLORS = {
  primary: "#00A36C",
  secondary: "#FFB800", 
  up: "#ef4444",
  down: "#22c55e",
  neutral: "#6b7280",
  grains: "#f59e0b",
  proteins: "#ef4444",
  vegetables: "#22c55e",
  oils: "#8b5cf6"
};

interface NFPIData {
  success: boolean;
  tier: string;
  access_level: {
    headline: boolean;
    topMovers: boolean;
    regional: boolean;
    categories: boolean;
    trend: boolean;
    basket: boolean;
    export: boolean;
    maxHistory: number;
  };
  latest: {
    period: string;
    national_index: number;
    change_pct: number;
    direction: string;
    is_baseline: boolean;
    items_with_data: number;
    top_gainers?: string;
    top_losers?: string;
    insight?: string;
  };
  categories?: {
    grains: number;
    proteins: number;
    vegetables: number;
    oils: number;
  };
  trend?: Array<{
    period: string;
    national_index: number;
    change_pct: number;
    grains: number;
    proteins: number;
    vegetables: number;
    oils: number;
  }>;
  basket?: Array<{
    item_id: string;
    item_name: string;
    category: string;
    weight_pct: number;
    baseline_price: number;
  }>;
  basket_prices?: Array<{
    item_id: string;
    avg_price: number;
    change_pct: number;
  }>;
  basket_value?: number;
  baseline_value?: number;
  can_export?: boolean;
}

export default function NFPIDashboard() {
  const { data: session } = useSession();
  const [data, setData] = useState<NFPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState<"national" | "categories">("national");
  
  // Get tier from session
  const tier = (session?.user as any)?.subscription_tier || "FREE";

  const fetchNFPIData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/nfpi?tier=${tier}`);
      const json = await res.json();
      
      if (!json.success) {
        setError(json.error || "Failed to load NFPI data");
        return;
      }
      
      setData(json);
    } catch (err) {
      setError("Failed to fetch NFPI data. Please try again.");
      console.error("NFPI fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [tier]);

  useEffect(() => {
    fetchNFPIData();
  }, [fetchNFPIData]);

  // Download CSV
  async function downloadCSV() {
    try {
      const res = await fetch(`/api/nfpi?tier=${tier}&format=csv`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NFPI_Report_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to download CSV");
    }
  }

  // Download PDF
  async function downloadPDF() {
    try {
      const res = await fetch(`/api/nfpi/pdf?tier=${tier}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NFPI_Report_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download error:", err);
      alert("Failed to download PDF");
    }
  }

  // Determine inflation status
  const getInflationStatus = (index: number) => {
    if (index >= 140) return { emoji: "🔴", label: "VERY HIGH", color: "text-red-500", bg: "bg-red-500/20" };
    if (index >= 125) return { emoji: "🟠", label: "HIGH", color: "text-orange-500", bg: "bg-orange-500/20" };
    if (index >= 110) return { emoji: "🟡", label: "MODERATE", color: "text-yellow-500", bg: "bg-yellow-500/20" };
    if (index >= 100) return { emoji: "🟢", label: "LOW", color: "text-green-500", bg: "bg-green-500/20" };
    return { emoji: "🔵", label: "DEFLATION", color: "text-blue-500", bg: "bg-blue-500/20" };
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 text-green-500 mx-auto mb-4 animate-spin" />
          <p className="text-gray-400">Loading NFPI data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data?.success) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error || "Failed to load NFPI data"}</p>
          <button 
            onClick={fetchNFPIData}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { latest, categories, trend, basket, basket_prices, can_export, access_level } = data;
  const status = getInflationStatus(latest.national_index);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            📊 NaijaFood Price Index (NFPI)
          </h1>
          <p className="text-gray-400 mt-1 flex items-center gap-2">
            <Calendar size={14} />
            Nigeria's weekly food inflation tracker • {latest.period}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={fetchNFPIData}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          {can_export && (
            <>
              <button
                onClick={downloadCSV}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm transition-colors"
              >
                <Download size={16} />
                CSV
              </button>
              <button
                onClick={downloadPDF}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
              >
                <FileText size={16} />
                PDF
              </button>
            </>
          )}
          <span className="px-3 py-2 bg-gray-800 rounded-lg text-sm text-green-400 border border-gray-700">
            {tier}
          </span>
        </div>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* National Index Card */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-green-500/50 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm font-medium">National NFPI</span>
            <span className={`flex items-center gap-1 text-sm font-medium ${
              latest.direction === "UP" ? "text-red-400" : 
              latest.direction === "DOWN" ? "text-green-400" : "text-gray-400"
            }`}>
              {latest.direction === "UP" ? <TrendingUp size={16} /> : 
               latest.direction === "DOWN" ? <TrendingDown size={16} /> : null}
              {latest.change_pct > 0 ? "+" : ""}{latest.change_pct?.toFixed(1)}%
            </span>
          </div>
          <div className="text-5xl font-bold text-white mb-2">
            {latest.national_index?.toFixed(1)}
          </div>
          <div className="text-gray-500 text-sm">
            {latest.is_baseline ? "📌 Baseline Period" : 
              `+${(latest.national_index - 100).toFixed(1)}% since Jan 2024`}
          </div>
        </div>

        {/* Inflation Status Card */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <span className="text-gray-400 text-sm font-medium">Inflation Status</span>
          <div className={`mt-4 p-3 rounded-lg ${status.bg}`}>
            <div className={`text-2xl font-bold ${status.color}`}>
              {status.emoji} {status.label}
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-3">
            Food prices up <span className="text-white font-semibold">{(latest.national_index - 100).toFixed(1)}%</span> vs baseline
          </p>
        </div>

        {/* Top Movers Card */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <span className="text-gray-400 text-sm font-medium">Top Movers This Period</span>
          <div className="mt-4 space-y-3">
            {latest.top_gainers && (
              <div className="flex items-start gap-2">
                <TrendingUp className="text-red-400 mt-0.5 flex-shrink-0" size={16} />
                <span className="text-red-400 text-sm">{latest.top_gainers}</span>
              </div>
            )}
            {latest.top_losers && (
              <div className="flex items-start gap-2">
                <TrendingDown className="text-green-400 mt-0.5 flex-shrink-0" size={16} />
                <span className="text-green-400 text-sm">{latest.top_losers}</span>
              </div>
            )}
            {!latest.top_gainers && !latest.top_losers && (
              <p className="text-gray-500 text-sm">No significant movers this period</p>
            )}
          </div>
        </div>
      </div>

      {/* Trend Chart (GOLD+) */}
      {access_level.trend && trend && trend.length > 0 ? (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
            <h2 className="text-xl font-semibold text-white">
              📈 NFPI Trend ({trend.length} months)
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveChart("national")}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  activeChart === "national" 
                    ? "bg-green-600 text-white" 
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                National
              </button>
              <button
                onClick={() => setActiveChart("categories")}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  activeChart === "categories" 
                    ? "bg-green-600 text-white" 
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                By Category
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            {activeChart === "national" ? (
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="period" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                <YAxis stroke="#9ca3af" domain={[90, 160]} tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#fff" }}
                />
                <Area 
                  type="monotone" 
                  dataKey="national_index" 
                  stroke={COLORS.primary}
                  fill={COLORS.primary}
                  fillOpacity={0.3}
                  name="National NFPI"
                  strokeWidth={2}
                />
              </AreaChart>
            ) : (
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="period" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                <YAxis stroke="#9ca3af" domain={[90, 170]} tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#fff" }}
                />
                <Legend />
                <Line type="monotone" dataKey="grains" stroke={COLORS.grains} name="🌾 Grains" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="proteins" stroke={COLORS.proteins} name="🥩 Proteins" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="vegetables" stroke={COLORS.vegetables} name="🥬 Vegetables" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="oils" stroke={COLORS.oils} name="🛢️ Oils" strokeWidth={2} dot={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : !access_level.trend ? (
        <LockedFeature 
          title="NFPI Trend Chart" 
          description="View historical food price trends over time"
          requiredTier="GOLD"
          currentTier={tier}
        />
      ) : null}

      {/* Category Breakdown */}
      {categories ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: "grains", name: "Grains & Staples", value: categories.grains, icon: "🌾", color: COLORS.grains },
            { key: "proteins", name: "Proteins", value: categories.proteins, icon: "🥩", color: COLORS.proteins },
            { key: "vegetables", name: "Vegetables", value: categories.vegetables, icon: "🥬", color: COLORS.vegetables },
            { key: "oils", name: "Cooking Oils", value: categories.oils, icon: "🛢️", color: COLORS.oils }
          ].map((cat) => {
            const change = cat.value - 100;
            return (
              <div key={cat.key} className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-gray-400 text-sm">{cat.name}</span>
                </div>
                <div className="text-3xl font-bold mb-1" style={{ color: cat.color }}>
                  {cat.value?.toFixed(1)}
                </div>
                <div className={`text-sm ${change > 0 ? "text-red-400" : change < 0 ? "text-green-400" : "text-gray-400"}`}>
                  {change > 0 ? "+" : ""}{change.toFixed(1)}% vs baseline
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <LockedFeature 
          title="Category Breakdown" 
          description="See inflation by food category: Grains, Proteins, Vegetables, Oils"
          requiredTier="SILVER"
          currentTier={tier}
        />
      )}

      {/* Basket Details (BUSINESS+) */}
      {access_level.basket && basket && basket_prices ? (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
            <h2 className="text-xl font-semibold text-white">
              🧺 NFPI Basket ({basket.length} items)
            </h2>
            <div className="text-right">
              <div className="text-sm text-gray-400">Current Basket Value</div>
              <div className="text-2xl font-bold text-green-400">
                ₦{data.basket_value?.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">
                Baseline: ₦{data.baseline_value?.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="overflow-x-auto rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-3 pr-4">Item</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 pr-4 text-right">Weight</th>
                  <th className="pb-3 pr-4 text-right">Baseline</th>
                  <th className="pb-3 pr-4 text-right">Current</th>
                  <th className="pb-3 text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {basket.map((item) => {
                  const price = basket_prices.find(p => p.item_id === item.item_id);
                  const change = price?.change_pct || 0;
                  return (
                    <tr key={item.item_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                      <td className="py-3 pr-4 text-white font-medium">{item.item_name}</td>
                      <td className="py-3 pr-4 text-gray-400">{item.category}</td>
                      <td className="py-3 pr-4 text-right text-gray-400">{item.weight_pct}%</td>
                      <td className="py-3 pr-4 text-right text-gray-400">₦{item.baseline_price?.toLocaleString()}</td>
                      <td className="py-3 pr-4 text-right text-white font-medium">₦{price?.avg_price?.toLocaleString() || "N/A"}</td>
                      <td className={`py-3 text-right font-semibold ${
                        change > 0 ? "text-red-400" : change < 0 ? "text-green-400" : "text-gray-400"
                      }`}>
                        {change > 0 ? "+" : ""}{change?.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      ) : !access_level.basket ? (
        <LockedFeature 
          title="Full Basket Details" 
          description="See detailed pricing for all 14 items in the NFPI basket"
          requiredTier="BUSINESS"
          currentTier={tier}
        />
      ) : null}

      {/* Market Insight */}
      {latest.insight && (
        <div className="bg-green-900/20 border border-green-700 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Info className="text-green-400 mt-0.5 flex-shrink-0" size={20} />
            <div>
              <h3 className="text-green-400 font-semibold mb-1">Market Insight</h3>
              <p className="text-gray-300">{latest.insight}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tier Info Footer */}
      <div className="text-center text-gray-500 text-sm pt-4 border-t border-gray-700">
        <p>
          Your subscription: <span className="text-green-400 font-semibold">{tier}</span>
          {tier !== "ENTERPRISE" && (
            <span className="ml-2">
              <a href="/pricing" className="text-green-400 hover:text-green-300 hover:underline">
                Upgrade for more features →
              </a>
            </span>
          )}
        </p>
        <p className="text-gray-600 text-xs mt-2">
          Data quality: {latest.items_with_data}/14 items • Last updated: {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

// Locked Feature Component
function LockedFeature({ 
  title, 
  description,
  requiredTier, 
  currentTier 
}: { 
  title: string; 
  description: string;
  requiredTier: string; 
  currentTier: string;
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="text-gray-500" size={28} />
        </div>
        <h3 className="text-lg font-semibold text-gray-300 mb-2">{title}</h3>
        <p className="text-gray-500 mb-4 max-w-md mx-auto">{description}</p>
        <div className="flex items-center justify-center gap-2 text-sm mb-4">
          <span className="text-gray-500">Current:</span>
          <span className="text-gray-400">{currentTier}</span>
          <span className="text-gray-600">→</span>
          <span className="text-green-400 font-semibold">{requiredTier}+</span>
        </div>
        <a 
          href="/pricing"
          className="inline-block px-6 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium transition-colors"
        >
          Upgrade Now
        </a>
      </div>
    </div>
  );
}
