'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Info } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface NFPILatest {
  yr: number; mth: number; period_label: string;
  index_value: number; prev_index_value: number;
  mom_change_pct: number; yoy_change_pct: number;
  nbs_yoy_inflation: number; divergence_pct: number;
  basket_value_naira: number; commodities_in_basket: number;
  markets_covered: number; computed_at: string;
}
interface NFPIRow {
  yr: number; mth: number; period_label: string;
  index_value: number; mom_change_pct: number;
  yoy_change_pct: number; nbs_yoy_inflation: number;
  divergence_pct: number; basket_value_naira: number;
}
interface DivergeAlert {
  period_label: string; yr: number; mth: number;
  yoy_change_pct: number; nbs_yoy_inflation: number; divergence_pct: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtPrice = (n: number) => n ? `₦${Number(n).toLocaleString('en-NG')}` : '—';
const fmtPct = (n: number | null | undefined) => {
  if (n == null) return '—';
  return `${n > 0 ? '+' : ''}${Number(n).toFixed(2)}%`;
};
const pctColor = (n: number) => n > 0 ? 'text-red-400' : n < 0 ? 'text-emerald-400' : 'text-gray-400';
const divColor = (n: number) => Math.abs(n) > 5 ? 'text-red-400' : Math.abs(n) > 2 ? 'text-amber-400' : 'text-emerald-400';

// Simple inline bar chart using divs
function MiniChart({ data, field, color }: { data: NFPIRow[]; field: keyof NFPIRow; color: string }) {
  const vals = data.map(d => Number(d[field]) || 0);
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  const range = max - min || 1;
  const last24 = data.slice(-24);

  return (
    <div className="flex items-end gap-px h-16 w-full">
      {last24.map((d, i) => {
        const pct = ((Number(d[field]) - min) / range) * 100;
        return (
          <div key={i} className="flex-1 flex items-end" title={`${d.period_label}: ${d[field]}`}>
            <div
              className={`w-full rounded-sm ${color} opacity-80 hover:opacity-100 transition-opacity`}
              style={{ height: `${Math.max(4, pct)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function NFPIPage() {
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'divergence'>('dashboard');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/nfpi?view=dashboard&months=24');
      const json = await res.json();
      if (json.success) setData(json.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const latest: NFPILatest | null = data?.latest || null;
  const ts: NFPIRow[] = data?.time_series || [];
  const yoy: NFPIRow[] = data?.yoy_comparison || [];
  const alerts: DivergeAlert[] = data?.divergence_alerts || [];
  const stats = data?.stats || {};
  const live = data?.live_inflation || {};

  return (
    <div className="p-6 space-y-6 bg-[#080d14] min-h-screen">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-600/20 border border-amber-600/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">NFPI & Inflation Monitor</h1>
          </div>
          <p className="text-gray-500 text-sm ml-11">
            NaijaMarket Food Price Index · Base Jan 2016 = 100 · {stats.months_of_data || '—'} months computed
          </p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Hero NFPI card */}
      {latest && (
        <div className="grid md:grid-cols-3 gap-4">
          {/* Index value — hero */}
          <div className="md:col-span-1 bg-gradient-to-br from-amber-900/20 to-[#0f1623] border border-amber-600/20 rounded-xl p-6">
            <div className="text-amber-400 text-xs font-bold tracking-widest mb-3">NFPI INDEX VALUE</div>
            <div className="text-5xl font-bold font-mono text-white mb-1">{latest.index_value?.toFixed(2)}</div>
            <div className="text-gray-400 text-sm mb-4">Period: {latest.period_label}</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">MoM</span>
                <span className={`font-mono font-bold ${pctColor(latest.mom_change_pct)}`}>{fmtPct(latest.mom_change_pct)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">YoY (NaijaMarket)</span>
                <span className={`font-mono font-bold ${pctColor(latest.yoy_change_pct)}`}>{fmtPct(latest.yoy_change_pct)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">NBS Official</span>
                <span className={`font-mono font-bold ${pctColor(latest.nbs_yoy_inflation)}`}>{fmtPct(latest.nbs_yoy_inflation)}</span>
              </div>
              <div className="border-t border-amber-800/30 pt-2 flex justify-between text-sm">
                <span className="text-gray-400">Divergence</span>
                <span className={`font-mono font-bold ${divColor(latest.divergence_pct)}`}>
                  {fmtPct(latest.divergence_pct)}
                </span>
              </div>
            </div>
          </div>

          {/* Basket info */}
          <div className="bg-[#0f1623] border border-gray-800 rounded-xl p-6 space-y-4">
            <div className="text-gray-400 text-xs font-bold tracking-widest">BASKET COMPOSITION</div>
            <div>
              <div className="text-3xl font-bold text-white font-mono">{fmtPrice(latest.basket_value_naira)}</div>
              <div className="text-gray-500 text-sm">Monthly basket value</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-black/20 rounded-lg p-3">
                <div className="text-gray-500 text-xs">Commodities</div>
                <div className="text-white font-bold text-lg">{latest.commodities_in_basket}</div>
              </div>
              <div className="bg-black/20 rounded-lg p-3">
                <div className="text-gray-500 text-xs">Markets</div>
                <div className="text-white font-bold text-lg">{latest.markets_covered}</div>
              </div>
            </div>
            <div className="text-xs text-gray-600">
              Last computed: {latest.computed_at ? new Date(latest.computed_at).toLocaleDateString('en-GB') : '—'}
            </div>
          </div>

          {/* Live proxy */}
          <div className="bg-[#0f1623] border border-gray-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-gray-400 text-xs font-bold tracking-widest">LIVE MARKET PROXY</span>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">% Items Rising (Current)</div>
              <div className="text-3xl font-bold text-red-400 font-mono">{live.pct_items_rising?.toFixed(1) || '—'}%</div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Daily Avg Change</span>
                <span className={`font-mono ${pctColor(live.avg_daily_change)}`}>{fmtPct(live.avg_daily_change)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Monthly Avg Change</span>
                <span className={`font-mono ${pctColor(live.avg_monthly_change)}`}>{fmtPct(live.avg_monthly_change)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Items Tracked</span>
                <span className="font-mono text-gray-300">{live.items_tracked?.toLocaleString() || '—'}</span>
              </div>
            </div>
            <div className="text-xs text-gray-600">As of {live.as_of_date ? new Date(live.as_of_date).toLocaleDateString('en-GB') : '—'}</div>
          </div>
        </div>
      )}

      {/* All-time stats */}
      {stats.months_of_data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Index Range', val: `${stats.index_min?.toFixed(0)} – ${stats.index_max?.toFixed(0)}`, color: 'text-white' },
            { label: 'Avg YoY (All Time)', val: fmtPct(stats.avg_yoy), color: pctColor(stats.avg_yoy) },
            { label: 'Max Divergence', val: fmtPct(stats.max_divergence), color: 'text-red-400' },
            { label: 'Min Divergence', val: fmtPct(stats.min_divergence), color: 'text-emerald-400' },
            { label: 'Data Coverage', val: `${stats.earliest_period} → ${stats.latest_period}`, color: 'text-gray-300' },
          ].map((s, i) => (
            <div key={i} className="bg-[#0f1623] border border-gray-800 rounded-lg p-3">
              <div className="text-gray-500 text-xs mb-1">{s.label}</div>
              <div className={`text-sm font-bold font-mono ${s.color}`}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0f1623] p-1 rounded-lg border border-gray-800 w-fit">
        {[
          { id: 'dashboard',  label: 'Index Charts' },
          { id: 'history',    label: 'Full History' },
          { id: 'divergence', label: 'Divergence Analysis' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${activeTab === t.id ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* CHARTS TAB */}
      {activeTab === 'dashboard' && ts.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { label: 'Index Value (Base 100)', field: 'index_value' as keyof NFPIRow, color: 'bg-amber-400' },
            { label: 'YoY Inflation (NaijaMarket)', field: 'yoy_change_pct' as keyof NFPIRow, color: 'bg-red-400' },
            { label: 'NBS Official YoY', field: 'nbs_yoy_inflation' as keyof NFPIRow, color: 'bg-blue-400' },
            { label: 'Divergence (NM – NBS)', field: 'divergence_pct' as keyof NFPIRow, color: 'bg-purple-400' },
          ].map(c => (
            <div key={c.field} className="bg-[#0f1623] border border-gray-800 rounded-xl p-5">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{c.label}</div>
              <MiniChart data={ts} field={c.field} color={c.color} />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>{ts[Math.max(0, ts.length - 24)]?.period_label}</span>
                <span>{ts[ts.length - 1]?.period_label}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* YoY comparison table */}
      {activeTab === 'dashboard' && (
        <div className="bg-[#0f1623] border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-bold text-white">Last 24 Months — YoY Comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-2 text-left">Period</th>
                  <th className="px-4 py-2 text-right">NFPI Index</th>
                  <th className="px-4 py-2 text-right">NaijaMarket YoY</th>
                  <th className="px-4 py-2 text-right">NBS YoY</th>
                  <th className="px-4 py-2 text-right">Divergence</th>
                  <th className="px-4 py-2 text-right">Basket Value</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600">Loading…</td></tr>
                ) : [...yoy].reverse().map((r, i) => (
                  <tr key={i} className={`border-b border-gray-800/40 hover:bg-gray-800/20 ${Math.abs(r.divergence_pct) > 5 ? 'bg-red-900/5' : ''}`}>
                    <td className="px-4 py-2 font-mono text-gray-300">{r.period_label}</td>
                    <td className="px-4 py-2 text-right font-mono text-amber-400 font-bold">{r.index_value?.toFixed(2)}</td>
                    <td className={`px-4 py-2 text-right font-mono ${pctColor(r.yoy_change_pct)}`}>{fmtPct(r.yoy_change_pct)}</td>
                    <td className={`px-4 py-2 text-right font-mono ${pctColor(r.nbs_yoy_inflation)}`}>{fmtPct(r.nbs_yoy_inflation)}</td>
                    <td className={`px-4 py-2 text-right font-mono font-bold ${divColor(r.divergence_pct)}`}>{fmtPct(r.divergence_pct)}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-400">{fmtPrice(r.basket_value_naira)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FULL HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="bg-[#0f1623] border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Full NFPI History (2016 – Present)</h2>
            <span className="text-xs text-gray-500">{ts.length} periods</span>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0f1623]">
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-2 text-left">Period</th>
                  <th className="px-4 py-2 text-right">Index</th>
                  <th className="px-4 py-2 text-right">MoM</th>
                  <th className="px-4 py-2 text-right">YoY (NM)</th>
                  <th className="px-4 py-2 text-right">YoY (NBS)</th>
                  <th className="px-4 py-2 text-right">Divergence</th>
                </tr>
              </thead>
              <tbody>
                {[...ts].reverse().map((r, i) => (
                  <tr key={i} className={`border-b border-gray-800/30 hover:bg-gray-800/20 ${Math.abs(r.divergence_pct) > 5 ? 'bg-red-900/5' : ''}`}>
                    <td className="px-4 py-2 font-mono text-gray-400">{r.period_label}</td>
                    <td className="px-4 py-2 text-right font-mono text-amber-400">{r.index_value?.toFixed(2)}</td>
                    <td className={`px-4 py-2 text-right font-mono text-xs ${pctColor(r.mom_change_pct)}`}>{fmtPct(r.mom_change_pct)}</td>
                    <td className={`px-4 py-2 text-right font-mono ${pctColor(r.yoy_change_pct)}`}>{fmtPct(r.yoy_change_pct)}</td>
                    <td className={`px-4 py-2 text-right font-mono ${pctColor(r.nbs_yoy_inflation)}`}>{fmtPct(r.nbs_yoy_inflation)}</td>
                    <td className={`px-4 py-2 text-right font-mono font-bold ${divColor(r.divergence_pct)}`}>{fmtPct(r.divergence_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DIVERGENCE ANALYSIS TAB */}
      {activeTab === 'divergence' && (
        <div className="space-y-4">
          <div className="bg-blue-900/10 border border-blue-800/20 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-300">
              <span className="text-blue-400 font-bold">Divergence</span> measures the gap between NaijaMarket Intel's real-market NFPI and the official NBS inflation figure.
              Positive divergence means real markets experienced <span className="text-red-400">more inflation</span> than NBS surveys captured.
              Negative divergence means markets were <span className="text-emerald-400">cooling faster</span> than NBS data showed.
              The Dec 2024 −10pp divergence demonstrated NaijaMarket's accuracy ahead of the NBS CPI rebasing exercise.
            </div>
          </div>

          <div className="bg-[#0f1623] border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-bold text-white">Significant Divergence Events (&gt;3pp)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                    <th className="px-4 py-2 text-left">Period</th>
                    <th className="px-4 py-2 text-right">NaijaMarket YoY</th>
                    <th className="px-4 py-2 text-right">NBS YoY</th>
                    <th className="px-4 py-2 text-right">Divergence</th>
                    <th className="px-4 py-2 text-left">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-emerald-400">No significant divergences recorded</td></tr>
                  ) : alerts.map((a, i) => (
                    <tr key={i} className={`border-b border-gray-800/40 hover:bg-gray-800/20`}>
                      <td className="px-4 py-2.5 font-mono text-gray-300">{a.period_label}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${pctColor(a.yoy_change_pct)}`}>{fmtPct(a.yoy_change_pct)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${pctColor(a.nbs_yoy_inflation)}`}>{fmtPct(a.nbs_yoy_inflation)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-bold text-lg ${divColor(a.divergence_pct)}`}>{fmtPct(a.divergence_pct)}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">
                        {a.divergence_pct > 0
                          ? 'Real markets ahead of NBS surveys'
                          : 'Real markets cooling faster than NBS data showed'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
