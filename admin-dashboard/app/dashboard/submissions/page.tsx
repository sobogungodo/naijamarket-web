'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Download, RefreshCw, Eye, CheckCircle, XCircle,
  AlertTriangle, MapPin, Navigation, Bot, Filter, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// ============================================================================
// TYPES
// ============================================================================

interface Submission {
  submission_id:        string;
  trader_id:            string;
  trader_name:          string;
  trader_phone:         string;
  reputation:           number;
  market_id:            string;
  market:               string;
  state:                string;
  item_id:              string;
  item:                 string;
  category:             string;
  unit:                 string;
  price:                number;
  baseline_price:       number;
  variance_from_baseline: number;
  gps_latitude:         number;
  gps_longitude:        number;
  gps_verified:         boolean;
  distance_from_market: number;
  validation_status:    string;
  status:               string;
  fraud_flag:           boolean;
  fraud_flag_reason:    string | null;
  submitted_at:         string;
  created_at:           string;
  isSynthetic:          boolean;
}

interface SubStats {
  totalToday:      number;
  pendingReview:   number;
  approvedToday:   number;
  rejectedToday:   number;
  fraudFlagged:    number;
  realToday:       number;
  syntheticToday:  number;
  approvalRate:    number;
  vsYesterday:     number;
  approvedMonth:   number;
  pendingMonth:    number;
  rejectedMonth:   number;
}

interface Market { market_id: string; market_name: string; }

// ============================================================================
// HELPERS
// ============================================================================

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtPrice(n: number | null | undefined): string {
  if (!n) return '—';
  return `₦${Number(n).toLocaleString()}`;
}

function varianceColor(v: number): string {
  const abs = Math.abs(v);
  if (abs > 30) return 'text-red-400';
  if (abs > 15) return 'text-yellow-400';
  return 'text-green-400';
}

function statusBadge(status: string, fraudFlag: boolean): JSX.Element {
  if (fraudFlag) return (
    <div className="flex flex-col gap-1">
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">Flagged</span>
    </div>
  );
  const map: Record<string, string> = {
    APPROVED: 'bg-green-500/20 text-green-400',
    PENDING:  'bg-yellow-500/20 text-yellow-400',
    REJECTED: 'bg-red-500/20 text-red-400',
  };
  const cls = map[status] ?? 'bg-gray-500/20 text-gray-400';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}

const PIE_COLORS = ['#22c55e', '#eab308', '#ef4444'];

// ============================================================================
// PAGE
// ============================================================================

type DateRange = 'today' | 'week' | 'month';
type SourceFilter = 'all' | 'real' | 'synthetic';

export default function SubmissionsPage() {
  const [submissions,   setSubmissions]   = useState<Submission[]>([]);
  const [stats,         setStats]         = useState<SubStats | null>(null);
  const [markets,       setMarkets]       = useState<Market[]>([]);

  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('All');
  const [marketFilter,  setMarketFilter]  = useState('all');
  const [dateRange,     setDateRange]     = useState<DateRange>('today');
  const [sourceFilter,  setSourceFilter]  = useState<SourceFilter>('all');

  const [page,          setPage]          = useState(1);
  const [totalPages,    setTotalPages]    = useState(1);
  const [total,         setTotal]         = useState(0);

  const [isLoading,     setIsLoading]     = useState(true);
  const [isRefreshing,  setIsRefreshing]  = useState(false);
  const [isExporting,   setIsExporting]   = useState(false);
  const [lastUpdated,   setLastUpdated]   = useState(new Date());
  const [actionResult,  setActionResult]  = useState<string | null>(null);

  const PAGE_SIZE = 20;

  // ── Fetch submissions ──────────────────────────────────────────────────────
  const fetchSubmissions = useCallback(async (p = 1) => {
    try {
      const params = new URLSearchParams({
        page:     String(p),
        pageSize: String(PAGE_SIZE),
        date:     dateRange,
        source:   sourceFilter,
      });
      if (search)  params.set('search', search);
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (marketFilter !== 'all') params.set('market', marketFilter);

      const res  = await fetch(`/api/submissions?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setSubmissions(json.data.items as Submission[]);
        setTotalPages(json.data.totalPages);
        setTotal(json.data.total);
      }
    } catch (err) {
      console.error('[fetchSubmissions]', err);
    }
  }, [search, statusFilter, marketFilter, dateRange, sourceFilter]);

  // ── Fetch stats ────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res  = await fetch('/api/submissions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'stats' }),
      });
      const json = await res.json();
      if (json.success) setStats(json.data as SubStats);
    } catch (err) {
      console.error('[fetchStats]', err);
    }
  }, []);

  // ── Fetch markets for filter ───────────────────────────────────────────────
  const fetchMarkets = useCallback(async () => {
    try {
      const res  = await fetch('/api/submissions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'markets' }),
      });
      const json = await res.json();
      if (json.success) setMarkets(json.data as Market[]);
    } catch (err) {
      console.error('[fetchMarkets]', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchSubmissions(1), fetchStats(), fetchMarkets()])
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch on filter change
  useEffect(() => {
    setPage(1);
    fetchSubmissions(1);
    fetchStats();
  }, [search, statusFilter, marketFilter, dateRange, sourceFilter, fetchSubmissions, fetchStats]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchSubmissions(page), fetchStats()]);
    setLastUpdated(new Date());
    setIsRefreshing(false);
  }, [page, fetchSubmissions, fetchStats]);

  const handleExport = useCallback(() => {
    setIsExporting(true);
    const csv = [
      ['ID','Trader','Market','Item','Price','Baseline','Variance%','GPS','Status','Fraud','Time'].join(','),
      ...submissions.map(s => [
        s.submission_id, s.trader_name, s.market, s.item,
        s.price, s.baseline_price,
        s.variance_from_baseline?.toFixed(2),
        s.gps_verified ? 'OK' : 'NO',
        s.validation_status, s.fraud_flag ? 'YES' : 'NO',
        s.created_at,
      ].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `submissions-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    setIsExporting(false);
  }, [submissions, dateRange]);

  // Single approve/reject
  const handleAction = useCallback(async (submissionId: string, action: 'approve' | 'reject') => {
    try {
      const res  = await fetch('/api/submissions', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ submissionId, action }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmissions(prev => prev.map(s =>
          s.submission_id === submissionId
            ? { ...s, validation_status: action === 'approve' ? 'APPROVED' : 'REJECTED' }
            : s
        ));
        fetchStats();
      }
    } catch (err) {
      console.error('[handleAction]', err);
    }
  }, [fetchStats]);

  // Bulk approve pending
  const handleApprovePending = useCallback(async () => {
    try {
      const res  = await fetch('/api/submissions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'approve_pending' }),
      });
      const json = await res.json();
      setActionResult(json.success ? json.message : `Error: ${json.error}`);
      if (json.success) { fetchSubmissions(page); fetchStats(); }
    } catch { setActionResult('Network error'); }
  }, [page, fetchSubmissions, fetchStats]);

  // Pie chart data
  const pieData = stats ? [
    { name: `Approved ${stats.approvedMonth}`, value: stats.approvedMonth },
    { name: `Pending ${stats.pendingMonth}`,   value: stats.pendingMonth  },
    { name: `Rejected ${stats.rejectedMonth}`, value: stats.rejectedMonth },
  ] : [];

  const pendingCount = stats?.pendingReview ?? 0;
  const fraudCount   = stats?.fraudFlagged  ?? 0;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Submissions Review</h1>
          <p className="text-gray-400 text-sm">Review and approve price submissions from traders</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Updated {timeAgo(lastUpdated.toISOString())}</span>
          <button
            onClick={handleRefresh} disabled={isRefreshing}
            className="p-2 bg-[#1a1f2e] border border-gray-700 rounded-lg hover:border-gray-500 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExport} disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1f2e] border border-gray-700
                       rounded-lg text-sm hover:border-gray-500 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export ({total})
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Live
          </div>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Total Today',
            value: isLoading ? '…' : String(stats?.totalToday ?? 0),
            sub:   stats ? `${stats.vsYesterday >= 0 ? '+' : ''}${stats.vsYesterday}% vs yesterday` : '',
            subCls: (stats?.vsYesterday ?? 0) >= 0 ? 'text-green-400' : 'text-red-400',
            icon:  '📋',
          },
          {
            label: 'Pending Review',
            value: isLoading ? '…' : String(stats?.pendingReview ?? 0),
            sub:   'Avg 8 min wait',
            subCls: 'text-gray-400',
            icon:  '🕐',
          },
          {
            label: 'Approved Today',
            value: isLoading ? '…' : String(stats?.approvedToday ?? 0),
            sub:   stats ? `${stats.approvalRate}% approval rate` : '',
            subCls: 'text-green-400',
            icon:  '✅',
          },
          {
            label: 'Fraud Flagged',
            value: isLoading ? '…' : String(stats?.fraudFlagged ?? 0),
            sub:   fraudCount > 0 ? 'Requires review' : 'All clear',
            subCls: fraudCount > 0 ? 'text-red-400' : 'text-green-400',
            icon:  '🚨',
          },
        ].map(card => (
          <div key={card.label} className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
            <div className="flex justify-between items-start mb-3">
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">{card.label}</span>
              <span className="text-xl">{card.icon}</span>
            </div>
            <p className="text-3xl font-bold mb-1">{card.value}</p>
            <p className={`text-xs ${card.subCls}`}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Synthetic vs Real today */}
        <div className="col-span-2 bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <h3 className="font-semibold mb-4">Today's Submission Mix</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0d1117] rounded-lg p-4 border border-gray-800">
              <p className="text-xs text-gray-400 mb-1">Real Traders</p>
              <p className="text-3xl font-bold text-green-400">{stats?.realToday ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">Submissions from registered traders</p>
            </div>
            <div className="bg-[#0d1117] rounded-lg p-4 border border-gray-800/60">
              <div className="flex items-center gap-2 mb-1">
                <Bot className="w-3.5 h-3.5 text-purple-400" />
                <p className="text-xs text-gray-400">Synthetic Engine</p>
              </div>
              <p className="text-3xl font-bold text-purple-400">{stats?.syntheticToday ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">Pre-launch simulation submissions</p>
            </div>
            <div className="col-span-2 bg-[#0d1117] rounded-lg p-3 border border-gray-800">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>Approval rate today</span>
                <span className="text-green-400 font-medium">{stats?.approvalRate ?? 0}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-green-500" style={{ width: `${stats?.approvalRate ?? 0}%` }} />
                <div className="h-full bg-yellow-500/60" style={{ width: `${stats ? (stats.pendingReview / (stats.totalToday || 1)) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Status breakdown pie */}
        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <h3 className="font-semibold mb-4">Status Breakdown (30d)</h3>
          {isLoading || pieData.every(d => d.value === 0) ? (
            <div className="h-40 flex items-center justify-center text-gray-500 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                />
                <Legend iconSize={10} formatter={v => <span className="text-xs text-gray-400">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by trader, item, or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg pl-10 pr-4 py-2.5
                       text-sm focus:outline-none focus:border-green-500"
          />
        </div>

        {/* Market filter */}
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-500" />
          <select
            value={marketFilter}
            onChange={e => setMarketFilter(e.target.value)}
            className="bg-[#1a1f2e] border border-gray-700 rounded-lg px-3 py-2.5 text-sm
                       focus:outline-none focus:border-green-500 min-w-36"
          >
            <option value="all">All Markets</option>
            {markets.map(m => <option key={m.market_id} value={m.market_id}>{m.market_name}</option>)}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#1a1f2e] border border-gray-700 rounded-lg px-3 py-2.5 text-sm
                       focus:outline-none focus:border-green-500"
          >
            {['All','APPROVED','PENDING','REJECTED'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* Date range */}
        <div className="flex bg-[#1a1f2e] border border-gray-800 rounded-lg p-1">
          {(['today','week','month'] as DateRange[]).map(d => (
            <button
              key={d}
              onClick={() => setDateRange(d)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                dateRange === d ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>

        {/* Source filter */}
        <div className="flex bg-[#1a1f2e] border border-gray-800 rounded-lg p-1">
          {(['all','real','synthetic'] as SourceFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                sourceFilter === s
                  ? s === 'synthetic' ? 'bg-purple-700 text-white' : 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {s === 'synthetic' && <Bot className="w-3 h-3" />}
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Action result banner ───────────────────────────────────────────── */}
      {actionResult && (
        <div className={`mb-4 p-3 rounded-lg border text-sm flex items-center gap-2 ${
          actionResult.startsWith('Error')
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-green-500/10 border-green-500/30 text-green-400'
        }`}>
          {actionResult}
          <button onClick={() => setActionResult(null)} className="ml-auto text-gray-500 hover:text-white">✕</button>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="bg-[#1a1f2e] rounded-xl border border-gray-800 overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['TRADER','MARKET','ITEM','PRICE','VARIANCE','GPS','STATUS','TIME','ACTIONS'].map(h => (
                <th key={h} className="text-left text-gray-400 text-xs font-medium p-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="p-8 text-center text-gray-500">Loading…</td></tr>
            ) : submissions.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center text-gray-500">No submissions found</td></tr>
            ) : submissions.map(s => (
              <tr
                key={s.submission_id}
                className={`border-b border-gray-800/50 hover:bg-[#252b3b]/50 transition-colors
                            ${s.fraud_flag ? 'bg-red-950/10' : ''}
                            ${s.isSynthetic ? 'bg-purple-950/5' : ''}`}
              >
                {/* Trader */}
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                                    ${s.isSynthetic ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-500'}`}>
                      {s.isSynthetic ? <Bot className="w-3.5 h-3.5" /> : s.trader_name?.split(' ').map(n => n[0]).join('').slice(0,2)}
                    </div>
                    <div>
                      <p className="font-medium text-xs">{s.trader_name}</p>
                      <p className="text-gray-500 text-xs">Rep: {s.reputation}</p>
                    </div>
                  </div>
                </td>

                {/* Market */}
                <td className="p-4">
                  <div className="flex items-center gap-1 text-gray-300 text-xs">
                    <MapPin className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    <span className="truncate max-w-28">{s.market}</span>
                  </div>
                </td>

                {/* Item */}
                <td className="p-4">
                  <p className="text-white text-xs font-medium">{s.item}</p>
                  <p className="text-gray-500 text-xs">{s.unit}</p>
                </td>

                {/* Price */}
                <td className="p-4">
                  <p className="font-medium text-white">{fmtPrice(s.price)}</p>
                  <p className="text-gray-500 text-xs">Base: {fmtPrice(s.baseline_price)}</p>
                </td>

                {/* Variance */}
                <td className="p-4">
                  <span className={`font-medium text-xs ${varianceColor(s.variance_from_baseline ?? 0)}`}>
                    {s.variance_from_baseline != null
                      ? `${s.variance_from_baseline >= 0 ? '+' : ''}${Number(s.variance_from_baseline).toFixed(1)}%`
                      : '—'}
                  </span>
                </td>

                {/* GPS */}
                <td className="p-4">
                  <div className="flex items-center gap-1">
                    <Navigation className={`w-3.5 h-3.5 ${s.gps_verified ? 'text-green-400' : 'text-red-400'}`} />
                    <span className={`text-xs ${s.gps_verified ? 'text-green-400' : 'text-red-400'}`}>
                      {s.gps_verified
                        ? `${Math.round(s.distance_from_market ?? 0)}m`
                        : 'Invalid'}
                    </span>
                  </div>
                </td>

                {/* Status */}
                <td className="p-4">
                  {statusBadge(s.validation_status, s.fraud_flag)}
                  {s.fraud_flag && s.fraud_flag_reason && (
                    <p className="text-red-400 text-xs mt-1">{s.fraud_flag_reason}</p>
                  )}
                </td>

                {/* Time */}
                <td className="p-4 text-gray-400 text-xs">{timeAgo(s.created_at)}</td>

                {/* Actions */}
                <td className="p-4">
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors" title="View">
                      <Eye className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    {s.validation_status === 'PENDING' && !s.isSynthetic && (
                      <>
                        <button
                          onClick={() => handleAction(s.submission_id, 'approve')}
                          className="p-1.5 hover:bg-green-900/50 rounded-lg transition-colors" title="Approve"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        </button>
                        <button
                          onClick={() => handleAction(s.submission_id, 'reject')}
                          className="p-1.5 hover:bg-red-900/50 rounded-lg transition-colors" title="Reject"
                        >
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 text-sm text-gray-400">
        <span>
          Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total} submissions
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { const p = Math.max(1, page-1); setPage(p); fetchSubmissions(p); }}
            disabled={page === 1}
            className="p-2 bg-[#1a1f2e] border border-gray-700 rounded-lg disabled:opacity-40 hover:border-gray-500"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm">{page}</span>
          {page < totalPages && (
            <span
              onClick={() => { const p = page+1; setPage(p); fetchSubmissions(p); }}
              className="px-3 py-2 bg-[#1a1f2e] border border-gray-700 rounded-lg cursor-pointer hover:border-gray-500"
            >
              {page + 1}
            </span>
          )}
          <button
            onClick={() => { const p = Math.min(totalPages, page+1); setPage(p); fetchSubmissions(p); }}
            disabled={page === totalPages}
            className="p-2 bg-[#1a1f2e] border border-gray-700 rounded-lg disabled:opacity-40 hover:border-gray-500"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Bulk Actions ───────────────────────────────────────────────────── */}
      <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
        <h3 className="font-semibold mb-3">Bulk Actions</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={handleApprovePending}
            disabled={pendingCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600/20 border border-green-600/40
                       text-green-400 rounded-lg text-sm hover:bg-green-600/30 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-4 h-4" />
            Approve All Pending ({pendingCount})
          </button>
          <button
            disabled={fraudCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600/20 border border-red-600/40
                       text-red-400 rounded-lg text-sm hover:bg-red-600/30 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <AlertTriangle className="w-4 h-4" />
            Review Flagged ({fraudCount})
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/20 border border-blue-600/40
                       text-blue-400 rounded-lg text-sm hover:bg-blue-600/30 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Today's Data ({stats?.totalToday ?? 0})
          </button>
        </div>
      </div>
    </div>
  );
}
