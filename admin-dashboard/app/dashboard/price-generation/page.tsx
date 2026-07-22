'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity, CheckCircle, XCircle, AlertTriangle, Clock,
  RefreshCw, Play, Database, TrendingUp, Zap,
  BarChart2, Globe, ChevronDown, ChevronUp
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface SlotStatus {
  time_slot: string;
  time_slot_name: string;
  rows_generated: number;
  started_at: string;
  completed_at: string;
  duration_sec: number;
  real_anchored: number;
  sim_tracked: number;
  sim_baseline: number;
  avg_confidence: number;
}

interface DayHistory {
  price_date: string;
  slots_generated: number;
  total_rows: number;
  real_rows: number;
  sim_rows: number;
  first_slot_at: string;
  last_slot_at: string;
  markets_covered: number;
  items_covered: number;
}

interface MissingSlot {
  price_date: string;
  slots_present: number;
  slots_missing: number;
  present_slots: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
};

// Percentages arrive from cached JSON / SQL and may be null, undefined or a
// numeric string. Render an em-dash rather than a bare "%" when there's no value.
const fmtPct = (v: unknown, digits = 1) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : '—';
};

const fmtDuration = (sec: number) => {
  if (!sec) return '—';
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
};

const SLOTS = [
  { slot: '08:30', label: 'MORNING',   utc: '07:30 UTC', wat: '08:30 WAT' },
  { slot: '11:30', label: 'MIDDAY',    utc: '10:30 UTC', wat: '11:30 WAT' },
  { slot: '14:30', label: 'AFTERNOON', utc: '13:30 UTC', wat: '14:30 WAT' },
];

const EXPECTED_ROWS = 172020;

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    healthy:  { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', label: 'HEALTHY' },
    degraded: { bg: 'bg-amber-500/15 border-amber-500/30',    text: 'text-amber-400',   label: 'DEGRADED' },
    critical: { bg: 'bg-red-500/15 border-red-500/30',        text: 'text-red-400',     label: 'CRITICAL' },
    unknown:  { bg: 'bg-gray-500/15 border-gray-500/30',      text: 'text-gray-400',    label: 'UNKNOWN' },
  };
  const c = cfg[status] || cfg.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold tracking-widest ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'healthy' ? 'bg-emerald-400 animate-pulse' : status === 'critical' ? 'bg-red-400 animate-pulse' : 'bg-amber-400'}`} />
      {c.label}
    </span>
  );
}

function SlotCard({ slot, data, onTrigger, triggering }: {
  slot: typeof SLOTS[0];
  data: SlotStatus | null;
  onTrigger: (slot: string) => void;
  triggering: boolean;
}) {
  const pct = data ? Math.round((data.rows_generated / EXPECTED_ROWS) * 100) : 0;
  // A slot row can exist with 0 rows_generated — guard the division so the card
  // shows 0% rather than NaN%.
  const realPct = data && data.rows_generated > 0
    ? Math.round((data.real_anchored / data.rows_generated) * 100)
    : 0;
  const isComplete = data && data.rows_generated >= EXPECTED_ROWS * 0.9;

  return (
    <div className={`relative overflow-hidden rounded-xl border transition-all duration-300 ${
      isComplete
        ? 'bg-emerald-900/10 border-emerald-500/20'
        : data
          ? 'bg-amber-900/10 border-amber-500/20'
          : 'bg-[#0f1623] border-gray-800'
    }`}>
      {/* Top bar */}
      <div className={`h-1 w-full ${isComplete ? 'bg-emerald-500' : data ? 'bg-amber-500' : 'bg-gray-700'}`} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs font-bold tracking-widest text-gray-500 mb-1">{slot.label}</div>
            <div className="text-2xl font-mono font-bold text-white">{slot.slot}</div>
            <div className="text-xs text-gray-500 mt-0.5">{slot.utc}</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {isComplete
              ? <CheckCircle className="w-6 h-6 text-emerald-400" />
              : data
                ? <AlertTriangle className="w-6 h-6 text-amber-400" />
                : <Clock className="w-6 h-6 text-gray-600" />}
            <button
              onClick={() => onTrigger(slot.slot)}
              disabled={triggering}
              className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-green-700 disabled:opacity-40 text-gray-300 hover:text-white rounded text-xs transition-colors"
            >
              <Play className="w-3 h-3" />
              {triggering ? 'Triggering…' : 'Trigger'}
            </button>
          </div>
        </div>

        {data ? (
          <>
            {/* Row count progress */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Rows</span>
                <span className="font-mono text-white">{data.rows_generated.toLocaleString()} / {EXPECTED_ROWS.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isComplete ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <div className="text-right text-xs text-gray-500 mt-0.5">{pct}%</div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-black/20 rounded p-2">
                <div className="text-gray-500">Duration</div>
                <div className="font-mono text-white">{fmtDuration(data.duration_sec)}</div>
              </div>
              <div className="bg-black/20 rounded p-2">
                <div className="text-gray-500">Confidence</div>
                <div className="font-mono text-white">{fmtPct(data.avg_confidence)}</div>
              </div>
              <div className="bg-black/20 rounded p-2">
                <div className="text-gray-500">Real anchored</div>
                <div className="font-mono text-emerald-400">{realPct}%</div>
              </div>
              <div className="bg-black/20 rounded p-2">
                <div className="text-gray-500">Completed</div>
                <div className="font-mono text-gray-300 text-[10px]">{fmt(data.completed_at)}</div>
              </div>
            </div>

            {/* Source breakdown mini bars */}
            <div className="mt-3 space-y-1">
              {[
                { label: 'REAL', val: data.real_anchored, color: 'bg-emerald-500' },
                { label: 'SIM_T', val: data.sim_tracked, color: 'bg-blue-500' },
                { label: 'SIM_B', val: data.sim_baseline, color: 'bg-gray-500' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 w-10">{s.label}</span>
                  <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.color}`}
                      style={{ width: `${data.rows_generated > 0 ? ((s.val || 0) / data.rows_generated * 100).toFixed(1) : '0'}%` }}
                    />
                  </div>
                  <span className="font-mono text-gray-400 w-14 text-right">{(s.val ?? 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-4 text-gray-600 text-sm">
            Not yet generated
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function PriceGenerationPage() {
  const [data, setData]           = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [days, setDays]           = useState(7);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');
  const [triggerOk, setTriggerOk] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/price-generation?days=${days}`);

      // Don't call res.json() blind. When the platform kills the function
      // (the DB runs at 20 DTU outside its scale-up windows and these queries
      // can outlive the 30s function budget) the body is an HTML error page,
      // and res.json() then reports "JSON.parse: unexpected character at line 1
      // column 1" — which tells nobody anything. Read the text and say what
      // actually happened.
      const raw = await res.text();
      let json: any;
      try {
        json = JSON.parse(raw);
      } catch {
        const looksLikeHtml = raw.trimStart().startsWith('<');
        throw new Error(
          looksLikeHtml || !raw
            ? `Server returned ${res.status} ${res.statusText || ''} instead of data. `
              + `This usually means the request timed out — the database is scaled down `
              + `outside 07:10-11:10 and 13:10-17:10 UTC. Try again shortly.`
            : `Unreadable response (${res.status}): ${raw.slice(0, 200)}`
        );
      }

      if (!json.success) {
        throw new Error(json.error || `Request failed (${res.status})`);
      }
      setData(json.data);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const t = setInterval(fetchData, 60000); return () => clearInterval(t); }, [fetchData]);

  const triggerSlot = async (slot: string) => {
    setTriggering(slot);
    setTriggerMsg('');
    try {
      const res = await fetch('/api/price-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot }),
      });
      const json = await res.json();
      setTriggerOk(!!json.success);
      setTriggerMsg(json.success ? (json.message || 'Triggered') : (json.error || 'Trigger failed'));
      if (json.success) setTimeout(fetchData, 5000);
    } catch (e: any) {
      setTriggerOk(false);
      setTriggerMsg(e.message);
    } finally {
      setTriggering(null);
    }
  };

  const getSlotData = (slot: string): SlotStatus | null =>
    data?.today_slots?.find((s: SlotStatus) => s.time_slot === slot) || null;

  const status = data?.pipeline_status || 'unknown';

  return (
    <div className="p-6 space-y-6 bg-[#080d14] min-h-screen">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-green-600/20 border border-green-600/30 flex items-center justify-center">
              <Activity className="w-4 h-4 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Price Generation Monitor</h1>
          </div>
          <p className="text-gray-500 text-sm ml-11">
            {EXPECTED_ROWS.toLocaleString()} rows × 3 daily slots
            {data?.stats?.unique_markets ? ` × ${data.stats.unique_markets.toLocaleString()} markets` : ''}
            {data?.stats?.unique_items ? ` × ${data.stats.unique_items.toLocaleString()} items` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="px-3 py-2 bg-[#0f1623] border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-green-500"
          >
            {[3, 7, 14, 30].map(d => <option key={d} value={d}>Last {d} days</option>)}
          </select>
          <button onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {triggerMsg && (
        <div className={`p-3 rounded-lg text-sm border ${
          triggerOk
            ? 'bg-green-900/20 border-green-700/30 text-green-400'
            : 'bg-red-900/20 border-red-700/30 text-red-400'
        }`}>
          {triggerMsg}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* Parts the API couldn't read this time. Without this the page renders
          zeroes and reads as a dead pipeline when it's really a slow query. */}
      {(data?.degraded?.length || 0) > 0 && (
        <div className="p-3 bg-amber-900/20 border border-amber-700/30 rounded-lg text-amber-400 text-sm">
          <div className="flex items-center gap-2 font-bold mb-1">
            <AlertTriangle className="w-4 h-4" />
            Partial data — some values could not be read
          </div>
          <ul className="list-disc ml-6 space-y-0.5">
            {data.degraded.map((d: string, i: number) => <li key={i}>{d}</li>)}
          </ul>
        </div>
      )}

      {/* Status bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Today's Rows", value: data?.today_slots?.reduce((a: number, s: SlotStatus) => a + s.rows_generated, 0)?.toLocaleString() || '0', icon: Database, color: 'text-blue-400' },
          { label: 'Slots Today', value: `${data?.today_slots?.length || 0}/3`, icon: Zap, color: data?.today_slots?.length === 3 ? 'text-emerald-400' : 'text-amber-400' },
          { label: 'Summary Fresh', value: Number.isFinite(data?.summary_freshness?.minutes_stale) ? `${data.summary_freshness.minutes_stale}m ago` : '—', icon: Clock, color: (data?.summary_freshness?.minutes_stale ?? 999) > 180 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'Markets', value: data?.stats?.unique_markets?.toLocaleString() || '—', icon: Globe, color: 'text-purple-400' },
          { label: 'Avg Confidence', value: fmtPct(data?.stats?.avg_confidence_overall), icon: TrendingUp, color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#0f1623] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-xs">{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Today's slots */}
      <div>
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Today's Generation Slots</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {SLOTS.map(s => (
            <SlotCard
              key={s.slot}
              slot={s}
              data={getSlotData(s.slot)}
              onTrigger={triggerSlot}
              triggering={triggering === s.slot}
            />
          ))}
        </div>
      </div>

      {/* History table */}
      <div className="bg-[#0f1623] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Generation History</h2>
          <BarChart2 className="w-4 h-4 text-gray-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-center">Slots</th>
                <th className="px-4 py-3 text-right">Total Rows</th>
                <th className="px-4 py-3 text-right">Real Rows</th>
                <th className="px-4 py-3 text-right">Sim Rows</th>
                <th className="px-4 py-3 text-center">Markets</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-left">First Slot</th>
                <th className="px-4 py-3 text-left">Last Slot</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-600">Loading…</td></tr>
              ) : (data?.history || []).map((row: DayHistory) => (
                <tr key={row.price_date} className={`border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${row.slots_generated < 3 ? 'bg-amber-900/5' : ''}`}>
                  <td className="px-4 py-2.5 font-mono text-gray-200 text-sm">
                    {new Date(row.price_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`font-mono text-sm ${row.slots_generated === 3 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {row.slots_generated}/3
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-200">{row.total_rows?.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-400">{row.real_rows?.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-blue-400">{row.sim_rows?.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-center text-gray-400">{row.markets_covered}</td>
                  <td className="px-4 py-2.5 text-center text-gray-400">{row.items_covered}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{fmt(row.first_slot_at)}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{fmt(row.last_slot_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Missing slots */}
      {(data?.missing_slots?.length || 0) > 0 && (
        <div className="bg-amber-900/10 border border-amber-500/20 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowMissing(!showMissing)}
            className="w-full px-5 py-4 flex items-center justify-between text-amber-400 hover:bg-amber-900/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-bold">{data.missing_slots.length} day(s) with missing slots</span>
            </div>
            {showMissing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showMissing && (
            <div className="border-t border-amber-500/20">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase border-b border-amber-500/10">
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-center">Present</th>
                    <th className="px-4 py-2 text-center">Missing</th>
                    <th className="px-4 py-2 text-left">Present Slots</th>
                  </tr>
                </thead>
                <tbody>
                  {data.missing_slots.map((ms: MissingSlot) => (
                    <tr key={ms.price_date} className="border-b border-amber-500/10">
                      <td className="px-4 py-2 font-mono text-amber-300">{new Date(ms.price_date).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-2 text-center text-amber-400">{ms.slots_present}</td>
                      <td className="px-4 py-2 text-center text-red-400">{ms.slots_missing}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{ms.present_slots}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Top markets */}
      <div className="bg-[#0f1623] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-bold text-white">Top Markets by Coverage</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                <th className="px-4 py-2 text-left">Market</th>
                <th className="px-4 py-2 text-left">State</th>
                <th className="px-4 py-2 text-center">Active Days</th>
                <th className="px-4 py-2 text-center">Items</th>
                <th className="px-4 py-2 text-right">Confidence</th>
                <th className="px-4 py-2 text-right">Real %</th>
              </tr>
            </thead>
            <tbody>
              {(data?.top_markets || []).map((m: any, i: number) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-4 py-2 text-gray-200 font-medium">{m.market_name}</td>
                  <td className="px-4 py-2 text-gray-400">{m.state}</td>
                  <td className="px-4 py-2 text-center text-gray-300">{m.active_days}</td>
                  <td className="px-4 py-2 text-center text-gray-300">{m.items_tracked}</td>
                  <td className="px-4 py-2 text-right font-mono text-blue-400">{fmtPct(m.avg_confidence)}</td>
                  <td className="px-4 py-2 text-right font-mono text-emerald-400">{fmtPct(m.real_anchor_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
