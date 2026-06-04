'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Search, Filter,
  RefreshCw, Download, ArrowUpDown, ChevronLeft,
  ChevronRight, BarChart2, Globe, Package, Star
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface KPIs {
  total_items: number;
  total_markets: number;
  total_states: number;
  total_price_points: number;
  trending_up: number;
  trending_down: number;
  stable: number;
  avg_confidence: number;
  avg_daily_change: number;
  avg_monthly_change: number;
  latest_price_date: string;
  last_refreshed: string;
}

interface PriceRow {
  summary_id: number;
  item_name: string; item_id: string;
  market_name: string; market_id: string;
  state: string; category_name: string; unit: string;
  price_naira: number; previous_price: number;
  price_change_pct: number; trend: string;
  week_high: number; week_low: number; week_avg: number;
  month_high: number; month_low: number; month_avg: number;
  month_change_pct: number; quarter_avg: number;
  confidence_score: number; data_source: string; price_date: string;
}

interface Category {
  category_name: string; items: number; markets: number;
  avg_price: number; avg_daily_change: number;
  avg_monthly_change: number; pct_rising: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtPrice = (n: number) => n ? `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0 })}` : '—';
const fmtPct = (n: number) => {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${Number(n).toFixed(2)}%`;
};
const pctColor = (n: number) => n > 0 ? 'text-red-400' : n < 0 ? 'text-emerald-400' : 'text-gray-400';
const TrendIcon = ({ trend }: { trend: string }) =>
  trend === 'UP' ? <TrendingUp className="w-3.5 h-3.5 text-red-400" />
  : trend === 'DOWN' ? <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
  : <Minus className="w-3.5 h-3.5 text-gray-500" />;

const sourceTag = (src: string) => {
  if (src === 'REAL_ANCHORED') return <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-800/40 font-bold">REAL</span>;
  if (src === 'SIM_TRACKED')   return <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400 border border-blue-800/40 font-bold">SIM</span>;
  return <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-900/40 text-gray-500 border border-gray-700/40 font-bold">BASE</span>;
};

function MoverCard({ item, type }: { item: PriceRow; type: 'gainer' | 'loser' }) {
  const pct = item.price_change_pct;
  const isGainer = type === 'gainer';
  return (
    <div className={`p-3 rounded-lg border transition-all hover:scale-[1.01] ${
      isGainer ? 'bg-red-900/10 border-red-800/20' : 'bg-emerald-900/10 border-emerald-800/20'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium truncate">{item.item_name}</div>
          <div className="text-gray-500 text-xs truncate">{item.market_name} · {item.state}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`text-sm font-bold font-mono ${isGainer ? 'text-red-400' : 'text-emerald-400'}`}>
            {fmtPct(pct)}
          </div>
          <div className="text-gray-400 text-xs font-mono">{fmtPrice(item.price_naira)}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function PriceIntelligencePage() {
  const [kpis, setKpis]           = useState<KPIs | null>(null);
  const [gainers, setGainers]     = useState<PriceRow[]>([]);
  const [losers, setLosers]       = useState<PriceRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [prices, setPrices]       = useState<PriceRow[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [pages, setPages]         = useState(1);
  const [search, setSearch]       = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [trendFilter, setTrendFilter] = useState('');
  const [sortBy, setSortBy]       = useState('price_change_pct');
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading]     = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'prices'>('overview');

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/price-intelligence?view=overview');
      const json = await res.json();
      if (json.success) {
        setKpis(json.data.kpis);
        setGainers(json.data.gainers);
        setLosers(json.data.losers);
        setCategories(json.data.categories);
      }
    } finally { setLoading(false); }
  }, []);

  const fetchPrices = useCallback(async (resetPage = false) => {
    setTableLoading(true);
    const p = resetPage ? 1 : page;
    if (resetPage) setPage(1);
    try {
      const params = new URLSearchParams({
        view: 'prices', page: String(p), limit: '50',
        search, state: stateFilter, category: catFilter,
        trend: trendFilter, sort: sortBy, dir: sortDir,
      });
      const res = await fetch(`/api/price-intelligence?${params}`);
      const json = await res.json();
      if (json.success) {
        setPrices(json.data.prices);
        setTotal(json.data.total);
        setPages(json.data.pages);
      }
    } finally { setTableLoading(false); }
  }, [page, search, stateFilter, catFilter, trendFilter, sortBy, sortDir]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { if (activeTab === 'prices') fetchPrices(true); }, [activeTab, search, stateFilter, catFilter, trendFilter, sortBy, sortDir]);
  useEffect(() => { if (activeTab === 'prices') fetchPrices(); }, [page]);

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const exportCSV = () => {
    if (!prices.length) return;
    const h = Object.keys(prices[0]).join(',');
    const b = prices.map(r => Object.values(r).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([h + '\n' + b], { type: 'text/csv' }));
    a.download = `prices_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const upPct = kpis ? Math.round((kpis.trending_up / kpis.total_price_points) * 100) : 0;
  const downPct = kpis ? Math.round((kpis.trending_down / kpis.total_price_points) * 100) : 0;

  return (
    <div className="p-6 space-y-6 bg-[#080d14] min-h-screen">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-600/30 flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Price Intelligence</h1>
          </div>
          <p className="text-gray-500 text-sm ml-11">
            {kpis ? `${kpis.total_price_points.toLocaleString()} live price points · last updated ${new Date(kpis.last_refreshed).toLocaleString('en-GB')}` : 'Loading…'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchOverview}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {activeTab === 'prices' && (
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
          )}
        </div>
      </div>

      {/* KPI row */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#0f1623] border border-gray-800 rounded-lg p-4">
            <div className="text-gray-500 text-xs mb-2">Items Tracked</div>
            <div className="text-2xl font-bold text-white font-mono">{kpis.total_items.toLocaleString()}</div>
            <div className="text-gray-600 text-xs mt-1">{kpis.total_markets} markets · {kpis.total_states} states</div>
          </div>
          <div className="bg-[#0f1623] border border-gray-800 rounded-lg p-4">
            <div className="text-gray-500 text-xs mb-2">Market Sentiment</div>
            <div className="flex items-end gap-3">
              <div>
                <div className="text-red-400 font-bold font-mono">{upPct}%</div>
                <div className="text-gray-600 text-xs">Rising</div>
              </div>
              <div>
                <div className="text-emerald-400 font-bold font-mono">{downPct}%</div>
                <div className="text-gray-600 text-xs">Falling</div>
              </div>
            </div>
            <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden flex">
              <div className="bg-red-500 h-full" style={{ width: `${upPct}%` }} />
              <div className="bg-emerald-500 h-full" style={{ width: `${downPct}%` }} />
            </div>
          </div>
          <div className="bg-[#0f1623] border border-gray-800 rounded-lg p-4">
            <div className="text-gray-500 text-xs mb-2">Avg Daily Change</div>
            <div className={`text-2xl font-bold font-mono ${pctColor(kpis.avg_daily_change)}`}>
              {fmtPct(kpis.avg_daily_change)}
            </div>
            <div className="text-gray-600 text-xs mt-1">Monthly: {fmtPct(kpis.avg_monthly_change)}</div>
          </div>
          <div className="bg-[#0f1623] border border-gray-800 rounded-lg p-4">
            <div className="text-gray-500 text-xs mb-2">Data Quality</div>
            <div className="text-2xl font-bold text-blue-400 font-mono">{kpis.avg_confidence?.toFixed(1)}%</div>
            <div className="text-gray-600 text-xs mt-1">Avg confidence score</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0f1623] p-1 rounded-lg border border-gray-800 w-fit">
        {[
          { id: 'overview', label: 'Overview & Movers', icon: Star },
          { id: 'prices',   label: 'Live Price Table',  icon: BarChart2 },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${activeTab === t.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Gainers */}
          <div className="bg-[#0f1623] border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-red-400" />
              <span className="text-sm font-bold text-white">Top Gainers (Daily)</span>
            </div>
            <div className="p-3 space-y-2">
              {gainers.map((g, i) => <MoverCard key={i} item={g} type="gainer" />)}
            </div>
          </div>

          {/* Losers */}
          <div className="bg-[#0f1623] border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-white">Top Fallers (Daily)</span>
            </div>
            <div className="p-3 space-y-2">
              {losers.map((l, i) => <MoverCard key={i} item={l} type="loser" />)}
            </div>
          </div>

          {/* Category breakdown */}
          <div className="lg:col-span-2 bg-[#0f1623] border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-bold text-white">Category Performance</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-right">Items</th>
                    <th className="px-4 py-2 text-right">Markets</th>
                    <th className="px-4 py-2 text-right">Avg Price</th>
                    <th className="px-4 py-2 text-right">Daily Δ</th>
                    <th className="px-4 py-2 text-right">Monthly Δ</th>
                    <th className="px-4 py-2 text-right">% Rising</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                      <td className="px-4 py-2.5 text-gray-200 font-medium">{c.category_name}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400">{c.items}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400">{c.markets}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-200">{fmtPrice(c.avg_price)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${pctColor(c.avg_daily_change)}`}>{fmtPct(c.avg_daily_change)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${pctColor(c.avg_monthly_change)}`}>{fmtPct(c.avg_monthly_change)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${c.pct_rising}%` }} />
                          </div>
                          <span className="text-xs font-mono text-red-400">{c.pct_rising?.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PRICES TAB */}
      {activeTab === 'prices' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="text" placeholder="Search item or market…"
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#0f1623] border border-gray-700 rounded-lg text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500" />
            </div>
            {[
              { val: stateFilter, set: setStateFilter, placeholder: 'All States' },
              { val: catFilter, set: setCatFilter, placeholder: 'All Categories' },
            ].map((f, i) => (
              <div key={i} className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" placeholder={f.placeholder}
                  value={f.val} onChange={e => f.set(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-[#0f1623] border border-gray-700 rounded-lg text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 w-40" />
              </div>
            ))}
            <select value={trendFilter} onChange={e => setTrendFilter(e.target.value)}
              className="px-3 py-2 bg-[#0f1623] border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500">
              <option value="">All Trends</option>
              <option value="UP">↑ Rising</option>
              <option value="DOWN">↓ Falling</option>
              <option value="STABLE">→ Stable</option>
            </select>
          </div>

          {/* Price table */}
          <div className="bg-[#0f1623] border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                    {[
                      { label: 'Item', col: 'item_name' },
                      { label: 'Market', col: null },
                      { label: 'Price', col: 'price_naira' },
                      { label: 'Daily Δ', col: 'price_change_pct' },
                      { label: 'Monthly Δ', col: 'month_change_pct' },
                      { label: 'Wk Range', col: null },
                      { label: 'Trend', col: null },
                      { label: 'Conf.', col: 'confidence_score' },
                      { label: 'Source', col: null },
                    ].map((h, i) => (
                      <th key={i} className={`px-3 py-3 ${i > 1 ? 'text-right' : 'text-left'} ${h.col ? 'cursor-pointer hover:text-gray-300 select-none' : ''}`}
                        onClick={() => h.col && handleSort(h.col)}>
                        <div className={`flex items-center gap-1 ${i > 1 ? 'justify-end' : ''}`}>
                          {h.label}
                          {h.col && sortBy === h.col && <ArrowUpDown className="w-3 h-3" />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableLoading ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-600">Loading…</td></tr>
                  ) : prices.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-600">No prices found</td></tr>
                  ) : prices.map(r => (
                    <tr key={r.summary_id} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="text-gray-200 font-medium">{r.item_name}</div>
                        <div className="text-gray-500 text-xs">{r.category_name} · {r.unit}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-gray-300">{r.market_name}</div>
                        <div className="text-gray-500 text-xs">{r.state}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-white font-bold">{fmtPrice(r.price_naira)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono font-bold ${pctColor(r.price_change_pct)}`}>{fmtPct(r.price_change_pct)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono ${pctColor(r.month_change_pct)}`}>{fmtPct(r.month_change_pct)}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-500 font-mono">
                        {fmtPrice(r.week_low)} – {fmtPrice(r.week_high)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <TrendIcon trend={r.trend} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-blue-400 text-xs">{r.confidence_score}</td>
                      <td className="px-3 py-2.5 text-right">{sourceTag(r.data_source)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
              <span className="text-gray-500 text-xs">Page {page} of {pages} · {total.toLocaleString()} results</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || tableLoading}
                  className="p-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded text-gray-300">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages || tableLoading}
                  className="p-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded text-gray-300">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
