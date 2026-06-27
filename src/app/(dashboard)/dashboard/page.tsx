"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  MapPin,
  Clock,
  Zap
} from "lucide-react";
import Link from "next/link";
import { useLang } from "@/lib/lang";

// ============================================================================
// DASHBOARD PAGE
// ============================================================================

interface Mover {
  name: string;
  market: string;
  price: number;
  change: number;
}

interface DashboardStats {
  marketCount: number;
  itemCount: number;
  latestPriceDate: string | null;
  todayRowCount: number;
  topGainers: Mover[];
  topLosers: Mover[];
}

const numberFmt = new Intl.NumberFormat("en-NG");

function formatNaira(value: number): string {
  return "₦" + numberFmt.format(Math.round(value));
}

function formatStatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const { t } = useLang();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.success) {
          setStats({
            marketCount: data.marketCount,
            itemCount: data.itemCount,
            latestPriceDate: data.latestPriceDate,
            todayRowCount: data.todayRowCount,
            topGainers: Array.isArray(data.topGainers) ? data.topGainers : [],
            topLosers: Array.isArray(data.topLosers) ? data.topLosers : [],
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const statCards = [
    {
      label: "Markets Tracked",
      value: stats ? numberFmt.format(stats.marketCount) : "…",
      subtext: "Across Nigeria",
      icon: MapPin,
      color: "text-naija-green",
    },
    {
      label: "Commodities Tracked",
      value: stats ? numberFmt.format(stats.itemCount) : "…",
      subtext: "Active in catalog",
      icon: TrendingUp,
      color: "text-naija-gold",
    },
    {
      label: "Price Updates",
      value: stats ? numberFmt.format(stats.todayRowCount) : "…",
      subtext: "Latest collection day",
      icon: Zap,
      color: "text-naija-blue",
    },
    {
      label: "Latest Price Date",
      value: stats ? formatStatDate(stats.latestPriceDate) : "…",
      subtext: "Most recent prices",
      icon: Clock,
      color: "text-naija-red",
    },
  ];

  // Real movers from the DB when available; fall back to placeholder rows
  // until the stats request resolves.
  const gainers = stats && stats.topGainers.length ? stats.topGainers : topGainers;
  const losers = stats && stats.topLosers.length ? stats.topLosers : topLosers;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">{t("dash_title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("dash_last_updated")} {new Date().toLocaleString("en-NG", {
              dateStyle: "medium", 
              timeStyle: "short" 
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2 py-1 bg-price-up/20 text-price-up text-xs rounded">
            <span className="w-1.5 h-1.5 bg-price-up rounded-full animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* NFPI Index Card */}
      <div className="bg-gradient-to-br from-naija-green/10 to-naija-gold/10 border border-naija-green/30 rounded-xl p-4 md:p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-gray-400 mb-1">NaijaFood Price Index (NFPI)</div>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-mono font-bold text-white">127.4</span>
              <div className="flex items-center gap-1 text-price-up">
                <TrendingUp className="w-5 h-5" />
                <span className="text-lg font-semibold">+2.3%</span>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Week-over-week change. Baseline: 100 (Jan 2026)
            </p>
          </div>
          <Link 
            href="/dashboard/analytics" 
            className="flex items-center gap-1 text-sm text-naija-green hover:text-naija-green-300 transition-colors"
          >
            View Analytics
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        {/* Regional Breakdown */}
        <div className="grid grid-cols-6 gap-4 mt-6 pt-6 border-t border-terminal-border/50">
          {[
            { region: "NW", index: 96.5, change: -1.2 },
            { region: "NE", index: 96.1, change: -0.8 },
            { region: "NC", index: 104.2, change: 2.1 },
            { region: "SW", index: 106.8, change: 3.5 },
            { region: "SE", index: 100.6, change: 1.4 },
            { region: "SS", index: 108.1, change: 4.2 },
          ].map((item) => (
            <div key={item.region} className="text-center">
              <div className="text-2xs text-gray-500 mb-1">{item.region}</div>
              <div className="text-lg font-mono font-semibold text-white">{item.index}</div>
              <div className={`text-xs ${item.change >= 0 ? "text-price-up" : "text-price-down"}`}>
                {item.change >= 0 ? "+" : ""}{item.change}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="price-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{stat.label}</span>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div className="text-2xl font-mono font-bold text-white">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.subtext}</div>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Top Movers */}
        <div className="bg-terminal-surface border border-terminal-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-terminal-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Top Movers (24h)</h2>
            <Link href="/dashboard/prices" className="text-xs text-naija-green hover:underline">
              {t("common_view_all")}
            </Link>
          </div>
          <div className="divide-y divide-terminal-border/50">
            {/* Gainers */}
            <div className="p-4">
              <div className="text-2xs text-gray-500 mb-3 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-price-up" />
                TOP GAINERS
              </div>
              <div className="space-y-2">
                {gainers.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 flex items-center justify-center text-2xs text-gray-500 bg-terminal-muted rounded">
                        {index + 1}
                      </span>
                      <div>
                        <div className="text-sm text-white">{item.name}</div>
                        <div className="text-2xs text-gray-500">{item.market}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-white">{typeof item.price === "number" ? formatNaira(item.price) : item.price}</div>
                      <div className="text-xs text-price-up">+{Number(item.change).toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Losers */}
            <div className="p-4">
              <div className="text-2xs text-gray-500 mb-3 flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-price-down" />
                TOP LOSERS
              </div>
              <div className="space-y-2">
                {losers.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 flex items-center justify-center text-2xs text-gray-500 bg-terminal-muted rounded">
                        {index + 1}
                      </span>
                      <div>
                        <div className="text-sm text-white">{item.name}</div>
                        <div className="text-2xs text-gray-500">{item.market}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-white">{typeof item.price === "number" ? formatNaira(item.price) : item.price}</div>
                      <div className="text-xs text-price-down">{Number(item.change).toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-terminal-surface border border-terminal-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-terminal-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">{t("dash_your_activity")}</h2>
            <Link href="/dashboard/watchlists" className="text-xs text-naija-green hover:underline">
              {t("dash_manage_watchlist")}
            </Link>
          </div>
          <div className="p-4">
            {/* Watchlist Preview */}
            <div className="mb-4">
              <div className="text-2xs text-gray-500 mb-2">DEFAULT WATCHLIST</div>
              <div className="space-y-2">
                {watchlistItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-terminal-bg/50 rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-naija-gold text-xs font-mono">{item.symbol}</span>
                      <span className="text-xs text-gray-400">{item.market}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-white">{item.price}</span>
                      <span className={`text-xs ${item.change >= 0 ? "text-price-up" : "text-price-down"}`}>
                        {item.change >= 0 ? "+" : ""}{item.change}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Queries */}
            <div>
              <div className="text-2xs text-gray-500 mb-2">{t("dash_recent_queries")}</div>
              <div className="space-y-1.5">
                {recentQueries.map((query, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-naija-gold">{query.command}</span>
                    <span className="text-gray-500">{query.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Price Table */}
      <div className="bg-terminal-surface border border-terminal-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-terminal-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{t("dash_live_prices")}</h2>
          <div className="flex items-center gap-2">
            <select className="bg-terminal-bg border border-terminal-border text-xs text-gray-400 rounded px-2 py-1 outline-none focus:border-naija-green">
              <option>Lagos</option>
              <option>Abuja</option>
              <option>Kano</option>
              <option>Port Harcourt</option>
            </select>
            <Link href="/dashboard/prices" className="text-xs text-naija-green hover:underline">
              {t("common_view_all")}
            </Link>
          </div>
        </div>
        <div className="table-wrapper">
          <div className="overflow-x-auto rounded-lg">
            <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Market</th>
                <th className="numeric">Price (₦)</th>
                <th className="numeric">Change</th>
                <th className="numeric">24h Range</th>
                <th>Confidence</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {priceData.map((item, index) => (
                <tr key={index}>
                  <td>
                    <div className="font-medium text-white">{item.name}</div>
                    <div className="text-2xs text-gray-500">{item.unit}</div>
                  </td>
                  <td className="text-gray-400">{item.market}</td>
                  <td className="numeric font-mono text-white">{item.price.toLocaleString()}</td>
                  <td className={`numeric ${item.change >= 0 ? "positive" : "negative"}`}>
                    {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%
                  </td>
                  <td className="numeric text-gray-400 font-mono text-xs">
                    {item.low.toLocaleString()} - {item.high.toLocaleString()}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <div className="w-16 h-1.5 bg-terminal-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            item.confidence >= 80 ? "bg-price-up" : 
                            item.confidence >= 60 ? "bg-naija-gold" : "bg-price-down"
                          }`}
                          style={{ width: `${item.confidence}%` }}
                        />
                      </div>
                      <span className="text-2xs text-gray-500">{item.confidence}%</span>
                    </div>
                  </td>
                  <td className="text-gray-500 text-xs">{item.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
            </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MOCK DATA
// ============================================================================

const topGainers = [
  { name: "Onions (bag)", market: "Mile 12", price: "₦38,500", change: 8.2 },
  { name: "Pepper (basket)", market: "Onitsha", price: "₦32,000", change: 6.5 },
  { name: "Yam (tuber)", market: "Wuse", price: "₦2,800", change: 5.1 },
];

const topLosers = [
  { name: "Tomatoes (basket)", market: "Mile 12", price: "₦45,000", change: -5.2 },
  { name: "Plantain (bunch)", market: "Ariaria", price: "₦4,500", change: -3.8 },
  { name: "Beans (bag)", market: "Kano", price: "₦62,000", change: -2.1 },
];

const watchlistItems = [
  { symbol: "RICE.M12", market: "Mile 12", price: "₦78,500", change: 2.3 },
  { symbol: "PALM.ONI", market: "Onitsha", price: "₦52,000", change: 1.5 },
  { symbol: "TOMATO.WUS", market: "Wuse", price: "₦48,000", change: -3.2 },
];

const recentQueries = [
  { command: "NM:PRICES RICE LAGOS", time: "2 min ago" },
  { command: "NM:TRENDS TOMATO 30D", time: "15 min ago" },
  { command: "NM:SNAPSHOT", time: "1 hour ago" },
];

const priceData = [
  { name: "Rice (50kg)", unit: "bag", market: "Mile 12", price: 78500, change: 2.3, low: 75000, high: 82000, confidence: 92, updated: "2 min ago" },
  { name: "Beans (bag)", unit: "bag", market: "Mile 12", price: 62000, change: -1.2, low: 58000, high: 65000, confidence: 88, updated: "5 min ago" },
  { name: "Garri (bag)", unit: "bag", market: "Iddo", price: 28000, change: 0.8, low: 26000, high: 30000, confidence: 85, updated: "3 min ago" },
  { name: "Palm Oil", unit: "25L", market: "Mile 12", price: 52000, change: 1.5, low: 48000, high: 55000, confidence: 90, updated: "8 min ago" },
  { name: "Tomatoes", unit: "basket", market: "Mile 12", price: 45000, change: -5.2, low: 42000, high: 52000, confidence: 78, updated: "1 min ago" },
  { name: "Onions", unit: "bag", market: "Kano", price: 38500, change: 8.2, low: 35000, high: 42000, confidence: 82, updated: "6 min ago" },
  { name: "Cement", unit: "bag", market: "Alaba", price: 6500, change: -0.3, low: 6200, high: 6800, confidence: 95, updated: "12 min ago" },
  { name: "Sugar", unit: "50kg", market: "Mile 12", price: 85000, change: 0.5, low: 82000, high: 88000, confidence: 91, updated: "4 min ago" },
];
