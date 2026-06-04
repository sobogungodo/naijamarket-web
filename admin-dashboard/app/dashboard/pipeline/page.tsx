'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity, CheckCircle, XCircle, AlertTriangle,
  RefreshCw, Clock, Database, Zap, BarChart2,
  GitBranch, Archive, Bell, ChevronDown, ChevronUp
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface Component {
  name: string;
  description: string;
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  detail: string;
  last_run: string | null;
  expected_rows?: number;
  actual_rows?: number;
}

interface GenHistory {
  price_date: string;
  slots_generated: number;
  rows: number;
  first_generated: string;
  last_generated: string;
  avg_confidence: number;
  real_rows: number;
  sim_rows: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const statusConfig: Record<string, { icon: any; color: string; bg: string; border: string; label: string }> = {
  healthy:  { icon: CheckCircle,    color: 'text-emerald-400', bg: 'bg-emerald-900/10', border: 'border-emerald-800/30', label: 'HEALTHY' },
  degraded: { icon: AlertTriangle,  color: 'text-amber-400',   bg: 'bg-amber-900/10',   border: 'border-amber-800/30',   label: 'DEGRADED' },
  critical: { icon: XCircle,        color: 'text-red-400',     bg: 'bg-red-900/10',     border: 'border-red-800/30',     label: 'CRITICAL' },
  unknown:  { icon: Clock,          color: 'text-gray-400',    bg: 'bg-gray-900/10',    border: 'border-gray-800/30',    label: 'UNKNOWN' },
};

const componentIcons: Record<string, any> = {
  'Price Generation':    Zap,
  'Latest Prices Cache': Database,
  'Price Scraper':       BarChart2,
  'Fuel Prices':         Activity,
  'NFPI Computation':    GitBranch,
  'Synthetic Engine':    Archive,
  'Notification Queue':  Bell,
};

const fmt = (iso: string | null) => {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function ComponentCard({ comp }: { comp: Component }) {
  const cfg = statusConfig[comp.status] || statusConfig.unknown;
  const Icon = componentIcons[comp.name] || Activity;
  const StatusIcon = cfg.icon;
  const [expanded, setExpanded] = useState(false);
  const rowPct = comp.expected_rows && comp.actual_rows
    ? Math.min(100, Math.round((comp.actual_rows / comp.expected_rows) * 100))
    : null;

  return (
    <div className={`rounded-xl border ${cfg.bg} ${cfg.border} overflow-hidden transition-all`}>
      <div
        className="p-4 flex items-start gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`p-2 rounded-lg bg-black/20 ${cfg.color} flex-shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white font-semibold text-sm">{comp.name}</span>
            <span className={`text-xs font-bold tracking-widest ${cfg.color}`}>{cfg.label}</span>
          </div>
          <div className="text-gray-500 text-xs truncate">{comp.detail}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusIcon className={`w-5 h-5 ${cfg.color} ${comp.status === 'healthy' ? 'opacity-80' : 'animate-pulse'}`} />
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/5 px-4 py-3 space-y-3">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Schedule</span>
            <span className="text-gray-300">{comp.description}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Last Run</span>
            <span className={`font-mono ${!comp.last_run ? 'text-red-400' : 'text-gray-300'}`}>{fmt(comp.last_run)}</span>
          </div>
          {rowPct !== null && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Row Count</span>
                <span className="font-mono text-gray-300">{comp.actual_rows?.toLocaleString()} / {comp.expected_rows?.toLocaleString()}</span>
              </div>
              <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${rowPct >= 90 ? 'bg-emerald-500' : rowPct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${rowPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function PipelinePage() {
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pipeline');
      const json = await res.json();
      if (json.success) { setData(json.data); setLastFetch(new Date()); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const t = setInterval(fetchData, 120000); return () => clearInterval(t); }, [fetchData]);

  const components: Component[] = data?.components || [];
  const health = data?.overall_health || 'unknown';
  const healthCfg = statusConfig[health] || statusConfig.unknown;
  const HealthIcon = healthCfg.icon;

  const criticalCount  = components.filter(c => c.status === 'critical').length;
  const degradedCount  = components.filter(c => c.status === 'degraded').length;
  const healthyCount   = components.filter(c => c.status === 'healthy').length;
  const genHistory: GenHistory[] = data?.generation_history || [];
  const synthetic = data?.synthetic || {};
  const dbStats   = data?.db_stats || {};

  return (
    <div className="p-6 space-y-6 bg-[#080d14] min-h-screen">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-green-600/20 border border-green-600/30 flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Data Pipeline Monitor</h1>
          </div>
          <p className="text-gray-500 text-sm ml-11">
            Full-stack pipeline visibility · auto-refreshes every 2 minutes
            {lastFetch && <span className="ml-2 text-gray-600">· Last: {lastFetch.toLocaleTimeString('en-GB')}</span>}
          </p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Overall health banner */}
      <div className={`rounded-xl border ${healthCfg.bg} ${healthCfg.border} p-5 flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <HealthIcon className={`w-8 h-8 ${healthCfg.color} ${health !== 'healthy' ? 'animate-pulse' : ''}`} />
          <div>
            <div className={`text-xl font-bold ${healthCfg.color}`}>
              Pipeline: {health.toUpperCase().replace('_', ' ')}
            </div>
            <div className="text-gray-400 text-sm">
              {healthyCount} healthy · {degradedCount} degraded · {criticalCount} critical
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold font-mono text-white">
            {Math.round((healthyCount / Math.max(components.length, 1)) * 100)}%
          </div>
          <div className="text-gray-500 text-xs">Components operational</div>
        </div>
      </div>

      {/* DB stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total DB Rows', val: dbStats.total_rows ? `${(dbStats.total_rows / 1_000_000).toFixed(1)}M` : '—', color: 'text-blue-400' },
          { label: 'DB Tables', val: dbStats.table_count || '—', color: 'text-purple-400' },
          { label: 'Synthetic Submissions (24h)', val: synthetic.synthetic_submissions_24h?.toLocaleString() || '0', color: 'text-amber-400' },
          { label: 'Synthetic Votes (24h)', val: synthetic.synthetic_votes_24h?.toLocaleString() || '0', color: 'text-amber-400' },
        ].map((s, i) => (
          <div key={i} className="bg-[#0f1623] border border-gray-800 rounded-lg p-4">
            <div className="text-gray-500 text-xs mb-1">{s.label}</div>
            <div className={`text-xl font-bold font-mono ${s.color}`}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Component grid */}
      <div>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Pipeline Components</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {loading && !data ? (
            Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="bg-[#0f1623] border border-gray-800 rounded-xl h-20 animate-pulse" />
            ))
          ) : components.map((c, i) => <ComponentCard key={i} comp={c} />)}
        </div>
      </div>

      {/* Generation timeline */}
      <div className="bg-[#0f1623] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Generation Timeline (Last 7 Days)</h2>
          <span className="text-xs text-gray-500">3 slots expected per day · 172,020 rows/slot</span>
        </div>

        {/* Visual timeline */}
        <div className="p-5">
          <div className="flex gap-2">
            {genHistory.slice(0, 7).reverse().map((g, i) => {
              const pct = Math.min(100, (g.rows / (172020 * 3)) * 100);
              const allSlots = g.slots_generated === 3;
              return (
                <div key={i} className="flex-1 text-center" title={`${g.price_date}: ${g.slots_generated}/3 slots · ${g.rows.toLocaleString()} rows`}>
                  <div className="h-24 bg-gray-900 rounded-lg overflow-hidden flex flex-col justify-end mb-1">
                    <div
                      className={`w-full rounded-lg transition-all ${allSlots ? 'bg-emerald-600' : 'bg-amber-600'}`}
                      style={{ height: `${Math.max(8, pct)}%` }}
                    />
                  </div>
                  <div className={`text-xs font-mono ${allSlots ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {g.slots_generated}/3
                  </div>
                  <div className="text-[10px] text-gray-600">
                    {new Date(g.price_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto border-t border-gray-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 uppercase">
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-center">Slots</th>
                <th className="px-4 py-2 text-right">Rows</th>
                <th className="px-4 py-2 text-right">Real</th>
                <th className="px-4 py-2 text-right">Sim</th>
                <th className="px-4 py-2 text-right">Confidence</th>
                <th className="px-4 py-2 text-left">First Slot</th>
                <th className="px-4 py-2 text-left">Last Slot</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600">Loading…</td></tr>
              ) : genHistory.map((g, i) => (
                <tr key={i} className={`border-b border-gray-800/40 hover:bg-gray-800/20 ${g.slots_generated < 3 ? 'bg-amber-900/5' : ''}`}>
                  <td className="px-4 py-2 font-mono text-gray-300">{new Date(g.price_date).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`font-mono font-bold ${g.slots_generated === 3 ? 'text-emerald-400' : 'text-amber-400'}`}>{g.slots_generated}/3</span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-gray-200">{g.rows?.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono text-emerald-400">{g.real_rows?.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono text-blue-400">{g.sim_rows?.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono text-blue-300">{g.avg_confidence?.toFixed(1)}%</td>
                  <td className="px-4 py-2 text-gray-500">{fmt(g.first_generated)}</td>
                  <td className="px-4 py-2 text-gray-500">{fmt(g.last_generated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
