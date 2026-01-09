"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Star,
  Bell,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  Package,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  Clock,
  Plus,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface WatchlistItem {
  id: string;
  type: "market" | "item";
  targetName: string;
  state?: string;
  category?: string;
  currentPrice?: number;
  priceChangePercent?: number;
  trend?: string;
  lastUpdated?: string;
}

interface PriceAlert {
  alert_id: string;
  item_name: string;
  market_name: string;
  alert_type: "ABOVE" | "BELOW";
  target_price: number;
  current_price: number | null;
  status: "ACTIVE" | "TRIGGERED" | "PAUSED" | "DELETED";
  should_trigger?: boolean;
  triggered_at?: string;
  created_at: string;
}

interface WidgetProps {
  phone?: string;
  tier?: string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function TrendIcon({ trend }: { trend?: string | null }) {
  if (!trend) return <Minus className="w-4 h-4 text-gray-500" />;
  
  switch (trend.toUpperCase()) {
    case "UP":
      return <TrendingUp className="w-4 h-4 text-red-400" />;
    case "DOWN":
      return <TrendingDown className="w-4 h-4 text-emerald-400" />;
    default:
      return <Minus className="w-4 h-4 text-gray-500" />;
  }
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

// ============================================================================
// WATCHLIST WIDGET
// ============================================================================

export function WatchlistWidget({ phone, tier = "FREE" }: WidgetProps) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!phone) {
      setLoading(false);
      return;
    }

    const fetchWatchlist = async () => {
      try {
        const params = new URLSearchParams({ phone, tier, type: "all" });
        const response = await fetch(`/api/watchlist?${params}`);
        const data = await response.json();

        if (data.success) {
          // Combine markets and items, take first 5
          const combined = [
            ...data.data.markets.map((m: WatchlistItem) => ({ ...m, type: "market" as const })),
            ...data.data.items.map((i: WatchlistItem) => ({ ...i, type: "item" as const })),
          ].slice(0, 5);
          setItems(combined);
        } else {
          setError(data.message || "Failed to load watchlist");
        }
      } catch (err) {
        setError("Failed to load watchlist");
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlist();
  }, [phone, tier]);

  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-400" />
          <h3 className="text-white font-semibold">Your Watchlist</h3>
        </div>
        <Link
          href="/watchlist"
          className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
        >
          Manage <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-6">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-6">
          <Star className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400 text-sm mb-3">No items in watchlist</p>
          <Link
            href="/watchlist"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/20"
          >
            <Plus className="w-4 h-4" /> Add Items
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center
                  ${item.type === "market" ? "bg-blue-500/10" : "bg-amber-500/10"}
                `}>
                  {item.type === "market" ? (
                    <MapPin className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Package className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <div>
                  <div className="text-sm text-white font-medium">
                    {item.targetName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {item.type === "market" ? item.state : item.category}
                  </div>
                </div>
              </div>
              
              {item.currentPrice && (
                <div className="text-right">
                  <div className="text-sm text-white font-medium">
                    {formatPrice(item.currentPrice)}
                  </div>
                  <div className={`
                    text-xs flex items-center gap-1 justify-end
                    ${(item.priceChangePercent || 0) > 0 ? "text-red-400" : 
                      (item.priceChangePercent || 0) < 0 ? "text-emerald-400" : "text-gray-500"}
                  `}>
                    <TrendIcon trend={item.trend} />
                    {item.priceChangePercent ? `${Math.abs(item.priceChangePercent)}%` : "-"}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PRICE ALERTS WIDGET
// ============================================================================

export function PriceAlertsWidget({ phone, tier = "FREE" }: WidgetProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeredCount, setTriggeredCount] = useState(0);

  useEffect(() => {
    if (!phone) {
      setLoading(false);
      return;
    }

    const fetchAlerts = async () => {
      try {
        const params = new URLSearchParams({ phone, tier });
        const response = await fetch(`/api/alerts?${params}`);
        const data = await response.json();

        if (data.success) {
          setAlerts(data.data.alerts.slice(0, 5));
          setTriggeredCount(data.data.triggeredToday || 0);
        } else {
          // If API doesn't exist yet, show empty state
          setAlerts([]);
        }
      } catch (err) {
        // API might not exist yet
        setAlerts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [phone, tier]);

  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-400" />
          <h3 className="text-white font-semibold">Price Alerts</h3>
          {triggeredCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
              {triggeredCount} triggered
            </span>
          )}
        </div>
        <Link
          href="/alerts"
          className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
        >
          View All <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-6">
          <Bell className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400 text-sm mb-3">No price alerts set</p>
          <Link
            href="/alerts"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/20"
          >
            <Plus className="w-4 h-4" /> Create Alert
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.alert_id}
              className={`
                flex items-center justify-between p-2 rounded-lg transition-colors
                ${alert.status === "TRIGGERED" || alert.should_trigger
                  ? "bg-amber-500/10 border border-amber-500/30" 
                  : "hover:bg-gray-800/50"
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center
                  ${alert.status === "TRIGGERED" || alert.should_trigger ? "bg-amber-500/20" : "bg-gray-800"}
                `}>
                  <Bell className={`w-4 h-4 ${alert.status === "TRIGGERED" || alert.should_trigger ? "text-amber-400" : "text-gray-500"}`} />
                </div>
                <div>
                  <div className="text-sm text-white font-medium">
                    {alert.item_name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {alert.alert_type === "ABOVE" && `Above ${formatPrice(alert.target_price)}`}
                    {alert.alert_type === "BELOW" && `Below ${formatPrice(alert.target_price)}`}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm text-white font-medium">
                  {alert.current_price ? formatPrice(alert.current_price) : "—"}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                  <Clock className="w-3 h-3" />
                  {alert.status === "TRIGGERED" || alert.should_trigger
                    ? formatTimeAgo(alert.triggered_at || alert.created_at)
                    : "Watching"
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RECENT QUERIES WIDGET
// ============================================================================

interface RecentQuery {
  command: string;
  timestamp: string;
}

export function RecentQueriesWidget() {
  // This would typically come from local storage or API
  const [queries] = useState<RecentQuery[]>([
    { command: "NM:PRICES RICE LAGOS", timestamp: "2 min ago" },
    { command: "NM:TRENDS TOMATO 30D", timestamp: "15 min ago" },
    { command: "NM:SNAPSHOT", timestamp: "1 hour ago" },
  ]);

  return (
    <div className="mt-4">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Recent Queries
      </div>
      <div className="space-y-2">
        {queries.map((query, index) => (
          <div
            key={index}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-emerald-400 font-mono">{query.command}</span>
            <span className="text-gray-600 text-xs">{query.timestamp}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// YOUR ACTIVITY WIDGET (Combined)
// ============================================================================

export function YourActivityWidget({ phone, tier = "FREE" }: WidgetProps) {
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!phone) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const params = new URLSearchParams({ phone, tier, type: "all" });
        const response = await fetch(`/api/watchlist?${params}`);
        const data = await response.json();

        if (data.success) {
          const combined = [
            ...data.data.items.slice(0, 3).map((i: WatchlistItem) => ({ ...i, type: "item" as const })),
          ];
          setWatchlistItems(combined);
        }
      } catch (err) {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [phone, tier]);

  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Your Activity</h3>
        <Link
          href="/watchlist"
          className="text-sm text-emerald-400 hover:text-emerald-300"
        >
          Manage Watchlist
        </Link>
      </div>

      {/* Default Watchlist */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Default Watchlist
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
          </div>
        ) : watchlistItems.length === 0 ? (
          <p className="text-gray-500 text-sm">No items tracked</p>
        ) : (
          <div className="space-y-2">
            {watchlistItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-mono text-sm">
                    {item.targetName.split(" ")[0].toUpperCase().slice(0, 4)}
                    .
                    {item.state?.slice(0, 3).toUpperCase() || "NGN"}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {item.state || item.category}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium">
                    {item.currentPrice ? formatPrice(item.currentPrice) : "-"}
                  </span>
                  <span className={`
                    text-xs
                    ${(item.priceChangePercent || 0) > 0 ? "text-red-400" : 
                      (item.priceChangePercent || 0) < 0 ? "text-emerald-400" : "text-gray-500"}
                  `}>
                    {item.priceChangePercent 
                      ? `${item.priceChangePercent > 0 ? "+" : ""}${item.priceChangePercent}%`
                      : "-"
                    }
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Queries */}
      <RecentQueriesWidget />
    </div>
  );
}
