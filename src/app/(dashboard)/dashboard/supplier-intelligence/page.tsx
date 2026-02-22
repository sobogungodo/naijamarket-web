// ============================================================================
// SUPPLIER INTELLIGENCE "WHISPER" DASHBOARD
// Location: src/app/(dashboard)/dashboard/supplier-intelligence/page.tsx
// Tier Gate: CORPORATE and ENTERPRISE only. Others see upsell.
// ============================================================================

"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  Search,
  BarChart3,
  Zap,
  ArrowUp,
  ArrowDown,
  Minus,
  Clock,
  MapPin,
  ShoppingCart,
  Lock,
  Mail,
  Phone,
  CheckCircle,
} from "lucide-react";

const API_BASE = "https://func-naijamarket-api.azurewebsites.net/api";
const ALLOWED_TIERS = ["CORPORATE", "ENTERPRISE"];

interface DemandItem {
  item: string;
  market: string;
  category: string;
  searches_current: number;
  unique_buyers: number;
  searches_previous: number;
  demand_change_pct: number;
  demand_signal: string;
  avg_price: number | null;
}

interface TrendingItem {
  item: string;
  searches_this_week: number;
  searches_last_week: number;
  markets_with_demand: number;
  unique_buyers: number;
  demand_change_pct: number;
  signal: string;
}

interface MarketPulse {
  market: string;
  searches: number;
  buyers: number;
  items: number;
  active_days: number;
  top_item: string;
}

interface HourlyData { hour_wat: number; searches: number; buyers: number; }
interface DailyData { day: string; searches: number; buyers: number; }
interface BuyerStats { total_buyers: number; repeat_buyers: number; repeat_rate_pct: number; avg_queries_per_buyer: number; }

function SignalBadge({ signal }: { signal: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    SURGE: { bg: "bg-red-500/20", text: "text-red-400", icon: <Zap className="w-3 h-3" /> },
    UP: { bg: "bg-emerald-500/20", text: "text-emerald-400", icon: <ArrowUp className="w-3 h-3" /> },
    STABLE: { bg: "bg-gray-500/20", text: "text-gray-400", icon: <Minus className="w-3 h-3" /> },
    DOWN: { bg: "bg-amber-500/20", text: "text-amber-400", icon: <ArrowDown className="w-3 h-3" /> },
    DROP: { bg: "bg-red-500/20", text: "text-red-300", icon: <TrendingDown className="w-3 h-3" /> },
    NEW: { bg: "bg-blue-500/20", text: "text-blue-400", icon: <Zap className="w-3 h-3" /> },
  };
  const c = config[signal] || config.STABLE;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.icon} {signal}
    </span>
  );
}

// ============================================================================
// UPSELL PAGE (shown to FREE / SILVER / GOLD / BUSINESS users)
// ============================================================================

function WhisperUpsell() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Activity className="w-8 h-8 text-green-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Supplier Intelligence</h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Know what buyers want before they show up at your market.
          Real-time demand signals powered by NaijaMarket search data.
        </p>
      </div>

      <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-green-400" />
          What &quot;Whisper&quot; Tells You
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { icon: TrendingUp, title: "Demand Surges", desc: "Know which items are trending before your competitors" },
            { icon: Users, title: "Buyer Patterns", desc: "Peak hours, repeat buyers, search frequency" },
            { icon: MapPin, title: "Market Pulse", desc: "Which markets have the most buyer activity" },
            { icon: BarChart3, title: "Weekly Reports", desc: "Delivered to your inbox every Monday" },
            { icon: ShoppingCart, title: "Stock Recommendations", desc: "What to buy more of, what to reduce" },
            { icon: Clock, title: "Timing Insights", desc: "When buyers search, when to have stock ready" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-[#0d1117] rounded-lg">
              <item.icon className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium text-white">{item.title}</div>
                <div className="text-xs text-gray-500">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-6 mb-8">
        <div className="text-xs text-green-400 font-medium uppercase tracking-wider mb-3">
          Example Whisper Alert
        </div>
        <div className="bg-[#0d1117] rounded-lg p-4 font-mono text-sm">
          <div className="text-red-400 mb-1">🔥 SURGE ALERT — Mile 12 Market</div>
          <div className="text-white">Rice (50kg) searches up <span className="text-emerald-400">+68%</span> this week</div>
          <div className="text-gray-400">47 unique buyers searching • Peak: 6-8 AM WAT</div>
          <div className="text-green-400 mt-2">→ Recommendation: Increase Rice stock by 30%</div>
        </div>
      </div>

      <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-white font-semibold mb-4 text-center">Pricing</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#0d1117] border border-green-500/30 rounded-xl p-5">
            <div className="text-green-400 font-semibold text-sm mb-1">CORPORATE</div>
            <div className="text-2xl font-bold text-white mb-1">₦50,000<span className="text-sm text-gray-500 font-normal">/month</span></div>
            <ul className="space-y-2 mt-4 text-sm text-gray-400">
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Weekly demand reports</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Up to 3 markets</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Email delivery</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Surge alerts</li>
            </ul>
          </div>
          <div className="bg-[#0d1117] border border-amber-500/30 rounded-xl p-5">
            <div className="text-amber-400 font-semibold text-sm mb-1">ENTERPRISE</div>
            <div className="text-2xl font-bold text-white mb-1">₦150,000<span className="text-sm text-gray-500 font-normal">/month</span></div>
            <ul className="space-y-2 mt-4 text-sm text-gray-400">
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-amber-400" /> Daily demand reports</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-amber-400" /> All 226 markets</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-amber-400" /> Email + WhatsApp</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-amber-400" /> API access included</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-amber-400" /> Custom category tracking</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="text-center space-y-4">
        <a
          href="mailto:enterprise@naijamarketintel.com?subject=Whisper%20Intelligence%20Subscription"
          className="inline-flex items-center gap-2 px-8 py-3 bg-green-500 text-black font-semibold rounded-xl hover:bg-green-400 transition-colors text-lg"
        >
          <Mail className="w-5 h-5" />
          Contact Sales
        </a>
        <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> enterprise@naijamarketintel.com</span>
          <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> +234 801 234 5678</span>
        </div>
        <p className="text-xs text-gray-600">
          Already a CORPORATE or ENTERPRISE subscriber? Your dashboard loads automatically.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function SupplierIntelligencePage() {
  const { data: session } = useSession();
  const userTier = (session?.user as { tier?: string } | undefined)?.tier || "FREE";
  const hasAccess = ALLOWED_TIERS.includes(userTier.toUpperCase());

  const [demand, setDemand] = useState<DemandItem[]>([]);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [marketPulse, setMarketPulse] = useState<MarketPulse[]>([]);
  const [hourly, setHourly] = useState<HourlyData[]>([]);
  const [daily, setDaily] = useState<DailyData[]>([]);
  const [buyerStats, setBuyerStats] = useState<BuyerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketFilter, setMarketFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"demand" | "trending" | "markets" | "patterns">("demand");

  const fetchData = async () => {
    if (!hasAccess) return;
    setLoading(true);
    const mq = marketFilter ? `&market=${encodeURIComponent(marketFilter)}` : "";
    try {
      const [demandRes, trendRes, pulseRes, patternRes] = await Promise.all([
        fetch(`${API_BASE}/whisper/demand?days=7&limit=20${mq}`),
        fetch(`${API_BASE}/whisper/trending?limit=15`),
        fetch(`${API_BASE}/whisper/market-pulse?days=7`),
        fetch(`${API_BASE}/whisper/buyer-patterns?${mq.replace("&", "")}`),
      ]);
      const [demandData, trendData, pulseData, patternData] = await Promise.all([
        demandRes.json(), trendRes.json(), pulseRes.json(), patternRes.json(),
      ]);
      if (demandData.data) setDemand(demandData.data);
      if (trendData.data) setTrending(trendData.data);
      if (pulseData.data) setMarketPulse(pulseData.data);
      if (patternData.hourly_pattern) setHourly(patternData.hourly_pattern);
      if (patternData.daily_pattern) setDaily(patternData.daily_pattern);
      if (patternData.buyer_stats) setBuyerStats(patternData.buyer_stats);
    } catch (err) {
      console.error("Whisper fetch error:", err);
    }
    setLoading(false);
  };

  useEffect(() => { if (hasAccess) fetchData(); }, [hasAccess]);

  // TIER GATE
  if (!hasAccess) return <WhisperUpsell />;

  const handleFilterApply = () => fetchData();
  const totalSearches = demand.reduce((s, d) => s + d.searches_current, 0);
  const totalBuyers = buyerStats?.total_buyers || 0;
  const surgeCount = demand.filter((d) => d.demand_signal === "SURGE").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-green-400" /> Supplier Intelligence
          </h1>
          <p className="text-sm text-gray-400 mt-1">&quot;Whisper&quot; — Real-time demand signals from buyer searches</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="text" value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)}
            placeholder="Filter by market..."
            className="bg-[#0d1117] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none w-48" />
          <button onClick={handleFilterApply} disabled={loading}
            className="px-4 py-2 bg-green-500 text-black font-medium rounded-lg text-sm hover:bg-green-400 disabled:opacity-50">
            {loading ? "Loading..." : "Apply"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Search className="w-3.5 h-3.5" /> Total Searches (7d)</div>
          <div className="text-2xl font-bold text-white">{totalSearches.toLocaleString()}</div>
        </div>
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Users className="w-3.5 h-3.5" /> Unique Buyers</div>
          <div className="text-2xl font-bold text-white">{totalBuyers.toLocaleString()}</div>
        </div>
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Zap className="w-3.5 h-3.5" /> Demand Surges</div>
          <div className="text-2xl font-bold text-red-400">{surgeCount}</div>
        </div>
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><ShoppingCart className="w-3.5 h-3.5" /> Repeat Rate</div>
          <div className="text-2xl font-bold text-green-400">{buyerStats?.repeat_rate_pct || 0}%</div>
        </div>
      </div>

      <div className="flex gap-1 bg-[#161b22] border border-gray-800 rounded-lg p-1">
        {(["demand", "trending", "markets", "patterns"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? "bg-green-500 text-black" : "text-gray-400 hover:text-white"}`}>
            {tab === "demand" && "🔥 Top Demand"}{tab === "trending" && "📈 Trending"}{tab === "markets" && "🏪 Markets"}{tab === "patterns" && "🕐 Patterns"}
          </button>
        ))}
      </div>

      {activeTab === "demand" && (
        <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-sm font-medium text-white">Top Demand — What Buyers Are Searching For</h3>
            <p className="text-xs text-gray-500 mt-1">Ranked by total searches in the last 7 days</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-800/50">
                <th className="p-3">#</th><th className="p-3">Item</th><th className="p-3">Market</th>
                <th className="p-3 text-right">Searches</th><th className="p-3 text-right">Buyers</th>
                <th className="p-3 text-right">vs Last Week</th><th className="p-3">Signal</th>
              </tr></thead>
              <tbody>
                {demand.length > 0 ? demand.map((d, i) => (
                  <tr key={i} className="border-b border-gray-800/30 hover:bg-[#1c2128]">
                    <td className="p-3 text-gray-500">{i + 1}</td>
                    <td className="p-3 text-white font-medium">{d.item}</td>
                    <td className="p-3 text-gray-400">{d.market}</td>
                    <td className="p-3 text-right text-white">{d.searches_current}</td>
                    <td className="p-3 text-right text-gray-400">{d.unique_buyers}</td>
                    <td className={`p-3 text-right ${d.demand_change_pct > 0 ? "text-emerald-400" : d.demand_change_pct < 0 ? "text-red-400" : "text-gray-400"}`}>
                      {d.demand_change_pct > 0 ? "+" : ""}{d.demand_change_pct}%
                    </td>
                    <td className="p-3"><SignalBadge signal={d.demand_signal} /></td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-500">No demand data yet. As consumers search for prices, demand signals appear here.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "trending" && (
        <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-800"><h3 className="text-sm font-medium text-white">Trending Items — Biggest Demand Increase</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-800/50">
                <th className="p-3">Item</th><th className="p-3 text-right">This Week</th><th className="p-3 text-right">Last Week</th>
                <th className="p-3 text-right">Change</th><th className="p-3 text-right">Markets</th><th className="p-3">Signal</th>
              </tr></thead>
              <tbody>
                {trending.length > 0 ? trending.map((t, i) => (
                  <tr key={i} className="border-b border-gray-800/30 hover:bg-[#1c2128]">
                    <td className="p-3 text-white font-medium">{t.item}</td>
                    <td className="p-3 text-right text-white">{t.searches_this_week}</td>
                    <td className="p-3 text-right text-gray-500">{t.searches_last_week}</td>
                    <td className={`p-3 text-right font-medium ${t.demand_change_pct > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {t.demand_change_pct > 0 ? "+" : ""}{t.demand_change_pct}%
                    </td>
                    <td className="p-3 text-right text-gray-400">{t.markets_with_demand}</td>
                    <td className="p-3"><SignalBadge signal={t.signal} /></td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">No trending data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "markets" && (
        <div className="grid md:grid-cols-2 gap-4">
          {marketPulse.length > 0 ? marketPulse.map((m, i) => (
            <div key={i} className="bg-[#161b22] border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium flex items-center gap-2"><MapPin className="w-4 h-4 text-green-400" /> {m.market}</h3>
                <span className="text-xs text-gray-500">{m.active_days} active days</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div><div className="text-xs text-gray-500">Searches</div><div className="text-lg font-bold text-white">{m.searches}</div></div>
                <div><div className="text-xs text-gray-500">Buyers</div><div className="text-lg font-bold text-white">{m.buyers}</div></div>
                <div><div className="text-xs text-gray-500">Items</div><div className="text-lg font-bold text-white">{m.items}</div></div>
              </div>
              {m.top_item && (
                <div className="text-xs bg-[#0d1117] rounded-lg px-3 py-2">
                  <span className="text-gray-500">Most searched: </span><span className="text-green-400 font-medium">{m.top_item}</span>
                </div>
              )}
            </div>
          )) : (
            <div className="col-span-2 bg-[#161b22] border border-gray-800 rounded-xl p-8 text-center text-gray-500">No market activity data yet.</div>
          )}
        </div>
      )}

      {activeTab === "patterns" && (
        <div className="space-y-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2"><Clock className="w-4 h-4" /> Peak Search Hours (WAT)</h3>
            <div className="flex items-end gap-1 h-32">
              {Array.from({ length: 24 }, (_, h) => {
                const data = hourly.find((d) => d.hour_wat === h + 1) || { searches: 0 };
                const max = Math.max(...hourly.map((d) => d.searches), 1);
                const pct = (data.searches / max) * 100;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-green-500/60 hover:bg-green-500 rounded-t transition-colors"
                      style={{ height: `${Math.max(pct, 2)}%` }} title={`${h}:00 WAT — ${data.searches} searches`} />
                    {h % 3 === 0 && <span className="text-[10px] text-gray-600">{h}</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-gray-600"><span>12 AM</span><span>12 PM</span><span>11 PM</span></div>
          </div>

          <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Weekly Pattern</h3>
            <div className="space-y-2">
              {daily.length > 0 ? daily.map((d, i) => {
                const max = Math.max(...daily.map((x) => x.searches), 1);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-12">{d.day.slice(0, 3)}</span>
                    <div className="flex-1 bg-[#0d1117] rounded-full h-4 overflow-hidden">
                      <div className="h-full bg-green-500/60 rounded-full" style={{ width: `${(d.searches / max) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right">{d.searches}</span>
                  </div>
                );
              }) : <div className="text-center text-gray-500 text-sm py-4">No pattern data yet.</div>}
            </div>
          </div>

          {buyerStats && (
            <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2"><Users className="w-4 h-4" /> Buyer Behavior</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><div className="text-xs text-gray-500">Total Buyers</div><div className="text-xl font-bold text-white">{buyerStats.total_buyers}</div></div>
                <div><div className="text-xs text-gray-500">Repeat Buyers</div><div className="text-xl font-bold text-green-400">{buyerStats.repeat_buyers}</div></div>
                <div><div className="text-xs text-gray-500">Repeat Rate</div><div className="text-xl font-bold text-white">{buyerStats.repeat_rate_pct}%</div></div>
                <div><div className="text-xs text-gray-500">Avg Queries/Buyer</div><div className="text-xl font-bold text-white">{buyerStats.avg_queries_per_buyer}</div></div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-2">📊 Full Supplier Intelligence Package</h3>
        <p className="text-sm text-gray-400 mb-4">Weekly demand reports delivered to your inbox with actionable buying signals.</p>
        <div className="flex items-center gap-6">
          <div><span className="text-2xl font-bold text-white">₦50,000</span><span className="text-gray-500">/month</span></div>
          <a href="mailto:enterprise@naijamarketintel.com?subject=Whisper%20Subscription"
            className="px-6 py-2 bg-green-500 text-black font-semibold rounded-lg hover:bg-green-400 transition-colors">Contact Sales</a>
        </div>
      </div>
    </div>
  );
}
