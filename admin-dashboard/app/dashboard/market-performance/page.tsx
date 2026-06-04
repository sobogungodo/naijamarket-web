'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MapPin, TrendingUp, TrendingDown, AlertTriangle,
  RefreshCw, Search, ChevronRight, Globe, Users,
  Package, BarChart2, CheckCircle, XCircle, ArrowLeft
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface MarketSummary {
  market_id: string; market_name: string; state: string;
  items_tracked: number; price_points: number;
  avg_price: number; avg_monthly_change: number;
  avg_confidence: number; rising_items: number; falling_items: number;
  latest_price_date: string; last_updated: string;
}

interface CoverageGap {
  market_id: string; market_name: string; state: string;
  days_with_data: number; days_missing: number; avg_confidence: number;
  real_anchor_pct: number;
}

interface SubmissionVol {
  market_id: string; market_name: string; state: string;
  total_submissions: number; unique_traders: number;
  approved: number; fraud_flags: number; approval_rate: number;
}

interface StateRollup {
  state: string; markets: number; items: number;
  avg_price: number; avg_monthly_change: number; avg_confidence: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtPrice = (n: number) => n ? `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0 })}` : '—';
const fmtPct = (n: number) => {
  if (n == null) return '—';
  return `${n > 0 ? '+' : ''}${Number(n).toFixed(1)}%`;
};
const pctColor = (n: number) => n > 0 ? 'text-red-400' : n < 0 ? 'text-emerald-400' : 'text-gray-400';

function ConfBar({ val }: { val: number }) {
  const pct = Math.min(100, val || 0);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-400 w-8">{pct.toFixed(0)}%</span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function MarketPerformancePage() {
  const [data, setData]         = useState<any>(null);
  const [detail, setDetail]     = useState<any>(null);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [days, setDays]         = useState(7);
  const [search, setSearch]     = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'markets' | 'gaps' | 'submissions' | 'states'>('markets');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/market-performance?days=${days}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } finally { setLoading(false); }
  }, [days]);

  const fetchDetail = useCallback(async (marketId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/market-performance?days=${days}&market_id=${marketId}`);
      const json = await res.json();
      if (json.success) setDetail(json.data);
    } finally { setDetailLoading(false); }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (selectedMarket) fetchDetail(selectedMarket);
  }, [selectedMarket, fetchDetail]);

  const filteredMarkets = (data?.markets || []).filter((m: MarketSummary) => {
    const s = search.toLowerCase();
    const matchSearch = !s || m.market_name.toLowerCase().includes(s) || m.state.toLowerCase().includes(s);
    const matchState = !stateFilter || m.state.toLowerCase().includes(stateFilter.toLowerCase());
    return matchSearch && matchState;
  });

  // If a market is selected, show detail view
  if (selectedMarket && detail) {
    const mkt = detail.market_info;
    const subs = detail.submissions;
    return (
      <div className="p-6 space-y-6 bg-[#080d14] min-h-screen">
        <button onClick={() => { setSelectedMarket(null); setDetail(null); }}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Markets
        </button>

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-600/20 border border-green-600/30 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{mkt?.market_name}</h1>
            <p className="text-gray-400">{mkt?.state} · {mkt?.latitude?.toFixed(4)}, {mkt?.longitude?.toFixed(4)}</p>
          </div>
        </div>

        {/* Submission stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Submissions', val: subs?.total_submissions?.toLocaleString() || '0', color: 'text-white' },
            { label: 'Approval Rate', val: `${subs?.approval_rate?.toFixed(1) || 0}%`, color: 'text-emerald-400' },
            { label: 'Active Traders', val: subs?.unique_traders || 0, color: 'text-blue-400' },
            { label: 'Fraud Flags', val: subs?.fraud_flags || 0, color: 'text-red-400' },
          ].map((s, i) => (
            <div key={i} className="bg-[#0f1623] border border-gray-800 rounded-lg p-4">
              <div className="text-gray-500 text-xs mb-1">{s.label}</div>
              <div className={`text-xl font-bold font-mono ${s.color}`}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Category breakdown */}
        <div className="bg-[#0f1623] border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-bold text-white">Price Profile by Category</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-right">Items</th>
                  <th className="px-4 py-2 text-right">Avg Price</th>
                  <th className="px-4 py-2 text-right">Monthly Δ</th>
                  <th className="px-4 py-2 text-right">Confidence</th>
                  <th className="px-4 py-2 text-center">Rising/Falling</th>
                </tr>
              </thead>
              <tbody>
                {detailLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600">Loading…</td></tr>
                ) : (detail?.price_profile || []).map((c: any, i: number) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="px-4 py-2.5 text-gray-200 font-medium">{c.category_name}</td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{c.items_tracked}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-200">{fmtPrice(c.avg_price)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${pctColor(c.avg_month_change)}`}>{fmtPct(c.avg_month_change)}</td>
                    <td className="px-4 py-2.5 text-right"><ConfBar val={c.avg_confidence} /></td>
                    <td className="px-4 py-2.5 text-center text-xs">
                      <span className="text-red-400">{c.rising}↑</span>
                      <span className="text-gray-600 mx-1">/</span>
                      <span className="text-emerald-400">{c.falling}↓</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily activity */}
        <div className="bg-[#0f1623] border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-bold text-white">Daily Generation Activity (Last {days} days)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-center">Slots</th>
                  <th className="px-4 py-2 text-right">Items</th>
                  <th className="px-4 py-2 text-right">Avg Price</th>
                  <th className="px-4 py-2 text-right">Confidence</th>
                  <th className="px-4 py-2 text-right">Real Rows</th>
                </tr>
              </thead>
              <tbody>
                {(detail?.daily_activity || []).map((d: any, i: number) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="px-4 py-2 font-mono text-gray-300">{new Date(d.price_date).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`font-mono ${d.slots === 3 ? 'text-emerald-400' : 'text-amber-400'}`}>{d.slots}/3</span>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-400">{d.items_priced}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-200">{fmtPrice(d.avg_price)}</td>
                    <td className="px-4 py-2 text-right font-mono text-blue-400">{d.avg_confidence?.toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-400">{d.real_rows?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-[#080d14] min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-600/30 flex items-center justify-center">
              <Globe className="w-4 h-4 text-purple-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Market Performance</h1>
          </div>
          <p className="text-gray-500 text-sm ml-11">
            {data?.kpis ? `${data.kpis.total_markets} markets · ${data.kpis.states_covered} states · ${data.kpis.submissions_24h?.toLocaleString()} submissions today` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            className="px-3 py-2 bg-[#0f1623] border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-purple-500">
            {[3, 7, 14, 30].map(d => <option key={d} value={d}>Last {d} days</option>)}
          </select>
          <button onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      {data?.kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Markets', val: data.kpis.total_markets, color: 'text-purple-400' },
            { label: 'States Covered', val: data.kpis.states_covered, color: 'text-blue-400' },
            { label: 'Platform Confidence', val: `${data.kpis.platform_confidence?.toFixed(1)}%`, color: 'text-green-400' },
            { label: 'Markets With Data Today', val: data.kpis.markets_with_data_today, color: data.kpis.markets_with_data_today === data.kpis.total_markets ? 'text-emerald-400' : 'text-amber-400' },
          ].map((s, i) => (
            <div key={i} className="bg-[#0f1623] border border-gray-800 rounded-lg p-4">
              <div className="text-gray-500 text-xs mb-1">{s.label}</div>
              <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0f1623] p-1 rounded-lg border border-gray-800 w-fit overflow-x-auto">
        {[
          { id: 'markets',     label: 'All Markets',       icon: MapPin },
          { id: 'gaps',        label: 'Coverage Gaps',     icon: AlertTriangle },
          { id: 'submissions', label: 'Submission Volume',  icon: Users },
          { id: 'states',      label: 'State Rollup',      icon: Globe },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap
              ${activeTab === t.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* MARKETS TAB */}
      {activeTab === 'markets' && (
        <>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="text" placeholder="Search market…"
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#0f1623] border border-gray-700 rounded-lg text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500" />
            </div>
            <input type="text" placeholder="Filter by state"
              value={stateFilter} onChange={e => setStateFilter(e.target.value)}
              className="px-3 py-2 bg-[#0f1623] border border-gray-700 rounded-lg text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500 w-36" />
          </div>

          <div className="bg-[#0f1623] border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                    <th className="px-4 py-3 text-left">Market</th>
                    <th className="px-4 py-3 text-right">Items</th>
                    <th className="px-4 py-3 text-right">Avg Price</th>
                    <th className="px-4 py-3 text-right">Monthly Δ</th>
                    <th className="px-4 py-3 text-right">Confidence</th>
                    <th className="px-4 py-3 text-center">Rising/Falling</th>
                    <th className="px-4 py-3 text-left">Last Updated</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-600">Loading…</td></tr>
                  ) : filteredMarkets.map((m: MarketSummary) => (
                    <tr key={m.market_id} className="border-b border-gray-800/50 hover:bg-gray-800/20 cursor-pointer transition-colors"
                      onClick={() => setSelectedMarket(m.market_id)}>
                      <td className="px-4 py-3">
                        <div className="text-gray-200 font-medium">{m.market_name}</div>
                        <div className="text-gray-500 text-xs">{m.state}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">{m.items_tracked}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-200">{fmtPrice(m.avg_price)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${pctColor(m.avg_monthly_change)}`}>{fmtPct(m.avg_monthly_change)}</td>
                      <td className="px-4 py-3 text-right w-32"><ConfBar val={m.avg_confidence} /></td>
                      <td className="px-4 py-3 text-center text-xs">
                        <span className="text-red-400">{m.rising_items}↑</span>
                        <span className="text-gray-600 mx-1">/</span>
                        <span className="text-emerald-400">{m.falling_items}↓</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {m.last_updated ? new Date(m.last_updated).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* GAPS TAB */}
      {activeTab === 'gaps' && (
        <div className="bg-[#0f1623] border border-amber-800/20 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-800/20 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-white">Markets with Coverage Gaps (last {days} days)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-800/20 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-2 text-left">Market</th>
                  <th className="px-4 py-2 text-center">Days With Data</th>
                  <th className="px-4 py-2 text-center">Days Missing</th>
                  <th className="px-4 py-2 text-right">Confidence</th>
                  <th className="px-4 py-2 text-right">Real Anchor %</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600">Loading…</td></tr>
                ) : (data?.coverage_gaps || []).length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-emerald-400">No coverage gaps detected ✓</td></tr>
                ) : (data?.coverage_gaps || []).map((g: CoverageGap, i: number) => (
                  <tr key={i} className="border-b border-amber-800/10 hover:bg-amber-900/5">
                    <td className="px-4 py-2.5">
                      <div className="text-gray-200">{g.market_name}</div>
                      <div className="text-gray-500 text-xs">{g.state}</div>
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono text-gray-300">{g.days_with_data}/{days}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="font-mono text-amber-400 font-bold">{g.days_missing}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-blue-400">{g.avg_confidence?.toFixed(1)}%</td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-400">{g.real_anchor_pct?.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBMISSIONS TAB */}
      {activeTab === 'submissions' && (
        <div className="bg-[#0f1623] border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 text-left">Market</th>
                  <th className="px-4 py-3 text-right">Submissions</th>
                  <th className="px-4 py-3 text-right">Traders</th>
                  <th className="px-4 py-3 text-right">Approved</th>
                  <th className="px-4 py-3 text-right">Fraud Flags</th>
                  <th className="px-4 py-3 text-right">Approval Rate</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-600">Loading…</td></tr>
                ) : (data?.submission_volume || []).map((s: SubmissionVol, i: number) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="px-4 py-2.5">
                      <div className="text-gray-200">{s.market_name}</div>
                      <div className="text-gray-500 text-xs">{s.state}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-white">{s.total_submissions?.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-blue-400">{s.unique_traders}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-400">{s.approved?.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-red-400">{s.fraud_flags}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${s.approval_rate}%` }} />
                        </div>
                        <span className="font-mono text-emerald-400 text-xs">{s.approval_rate?.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STATES TAB */}
      {activeTab === 'states' && (
        <div className="bg-[#0f1623] border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 text-left">State</th>
                  <th className="px-4 py-3 text-right">Markets</th>
                  <th className="px-4 py-3 text-right">Items</th>
                  <th className="px-4 py-3 text-right">Avg Price</th>
                  <th className="px-4 py-3 text-right">Monthly Δ</th>
                  <th className="px-4 py-3 text-right">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-600">Loading…</td></tr>
                ) : (data?.state_rollup || []).map((s: StateRollup, i: number) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="px-4 py-2.5 text-gray-200 font-medium">{s.state}</td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{s.markets}</td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{s.items?.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-200">{fmtPrice(s.avg_price)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${pctColor(s.avg_monthly_change)}`}>{fmtPct(s.avg_monthly_change)}</td>
                    <td className="px-4 py-2.5 text-right w-32"><ConfBar val={s.avg_confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
