'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, ShoppingBag, Shield, AlertTriangle, Activity,
  Search, Filter, Download, RefreshCw, ChevronLeft,
  ChevronRight, CheckCircle, XCircle, Clock, Eye,
  MapPin, Smartphone, TrendingUp, Bug
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface AuditStats {
  consumer_sessions_24h: number;
  submissions_24h: number;
  votes_24h: number;
  fraud_flags_24h: number;
  honeypot_catches_24h: number;
}

interface ConsumerLog {
  session_id: string;
  phone_number: string;
  consumer_name: string;
  subscription_tier: string;
  session_status: string;
  current_step: string;
  selected_item: string;
  selected_market: string;
  selected_state: string;
  query_completed: string;
  preferred_language: string;
  created_at: string;
  last_updated: string;
}

interface TraderLog {
  submission_id: string;
  trader_id: string;
  trader_name: string;
  trader_phone: string;
  reputation_score: number;
  market: string;
  state: string;
  item: string;
  category: string;
  unit: string;
  price: number;
  validation_status: string;
  submission_status: string;
  fraud_flag: boolean;
  fraud_flag_reason: string;
  variance_from_baseline: number;
  gps_verified: boolean;
  distance_from_market: number;
  submitted_at: string;
}

interface ValidatorLog {
  vote_id: string;
  submission_id: string;
  validator_id: string;
  validator_name: string;
  validator_phone: string;
  accuracy_score: number;
  market: string;
  item: string;
  vote: string;
  vote_reason: string;
  vote_confidence: string;
  trader_submitted_price: string;
  variance_percent: string;
  consensus_result: string;
  agreed_with_consensus: string;
  reward_earned: string;
  is_honeypot: string;
  honeypot_result: string;
  gps_verified: string;
  vote_status: string;
  voted_at: string;
  created_at: string;
}

type TabType = 'consumers' | 'traders' | 'validators';

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const fmtPrice = (p: number | string) => {
  const n = Number(p);
  if (!n) return '—';
  return `₦${n.toLocaleString()}`;
};

const tierColor: Record<string, string> = {
  FREE: 'bg-gray-500/20 text-gray-400',
  SILVER: 'bg-gray-300/20 text-gray-300',
  GOLD: 'bg-yellow-500/20 text-yellow-400',
  BUSINESS: 'bg-blue-500/20 text-blue-400',
  CORPORATE: 'bg-purple-500/20 text-purple-400',
  ENTERPRISE: 'bg-green-500/20 text-green-400',
};

const statusDot = (s: string) => {
  const map: Record<string, string> = {
    APPROVED: 'text-green-400', PENDING: 'text-yellow-400',
    REJECTED: 'text-red-400', EXPIRED: 'text-gray-400',
    APPROVE: 'text-green-400', REJECT: 'text-red-400',
    active: 'text-green-400', inactive: 'text-gray-400',
  };
  return map[s] || 'text-gray-400';
};

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: number | string; color: string;
}) {
  return (
    <div className="bg-[#0f1623] border border-gray-800 rounded-lg p-4 flex items-center gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-gray-400 text-xs">{label}</p>
        <p className="text-white font-bold text-xl">{value?.toLocaleString() ?? '—'}</p>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [tab, setTab]             = useState<TabType>('traders');
  const [stats, setStats]         = useState<AuditStats | null>(null);
  const [consumerLogs, setConsumerLogs] = useState<ConsumerLog[]>([]);
  const [traderLogs, setTraderLogs]     = useState<TraderLog[]>([]);
  const [validatorLogs, setValidatorLogs] = useState<ValidatorLog[]>([]);
  const [totals, setTotals]       = useState({ consumers: 0, traders: 0, validators: 0 });
  const [page, setPage]           = useState(1);
  const [pages, setPages]         = useState(1);
  const [search, setSearch]       = useState('');
  const [from, setFrom]           = useState('');
  const [to, setTo]               = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const fetchData = useCallback(async (resetPage = false) => {
    setLoading(true);
    setError('');
    const p = resetPage ? 1 : page;
    if (resetPage) setPage(1);

    try {
      const params = new URLSearchParams({
        type: tab, page: String(p), limit: '50',
        search, from, to,
      });
      const res = await fetch(`/api/audit?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setStats(json.data.stats);
      setConsumerLogs(json.data.consumers.logs);
      setTraderLogs(json.data.traders.logs);
      setValidatorLogs(json.data.validators.logs);
      setTotals({
        consumers: json.data.consumers.total,
        traders:   json.data.traders.total,
        validators: json.data.validators.total,
      });
      setPages(json.data[tab].pages || 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tab, page, search, from, to]);

  useEffect(() => { fetchData(true); }, [tab, search, from, to]);
  useEffect(() => { fetchData(); }, [page]);

  const exportCSV = () => {
    const rows = tab === 'consumers' ? consumerLogs
      : tab === 'traders' ? traderLogs : validatorLogs;
    if (!rows.length) return;
    const headers = Object.keys(rows[0]).join(',');
    const body = rows.map(r => Object.values(r).map(v =>
      typeof v === 'string' && v.includes(',') ? `"${v}"` : v
    ).join(',')).join('\n');
    const blob = new Blob([headers + '\n' + body], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit_${tab}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const tabs: { id: TabType; label: string; icon: any; count: number }[] = [
    { id: 'traders',    label: 'Traders',    icon: ShoppingBag, count: totals.traders },
    { id: 'validators', label: 'Validators', icon: Shield,      count: totals.validators },
    { id: 'consumers',  label: 'Consumers',  icon: Users,       count: totals.consumers },
  ];

  return (
    <div className="p-6 space-y-6 bg-[#080d14] min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-gray-400 text-sm mt-1">
            Full activity trail — Consumers, Traders, Validators
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fetchData(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm transition-colors">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={Users}         label="Consumer Sessions (24h)" value={stats?.consumer_sessions_24h ?? '—'} color="bg-blue-500/10 text-blue-400" />
        <StatCard icon={ShoppingBag}   label="Submissions (24h)"       value={stats?.submissions_24h ?? '—'}       color="bg-green-500/10 text-green-400" />
        <StatCard icon={Shield}        label="Validator Votes (24h)"   value={stats?.votes_24h ?? '—'}             color="bg-purple-500/10 text-purple-400" />
        <StatCard icon={AlertTriangle} label="Fraud Flags (24h)"       value={stats?.fraud_flags_24h ?? '—'}       color="bg-red-500/10 text-red-400" />
        <StatCard icon={Bug}           label="Honeypot Catches (24h)"  value={stats?.honeypot_catches_24h ?? '—'}  color="bg-orange-500/10 text-orange-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text" placeholder="Search name, phone, item..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#0f1623] border border-gray-700 rounded-lg text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-green-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 bg-[#0f1623] border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-green-500" />
          <span className="text-gray-600">to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 bg-[#0f1623] border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-green-500" />
        </div>
        {(search || from || to) && (
          <button onClick={() => { setSearch(''); setFrom(''); setTo(''); }}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm">
            Clear
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0f1623] p-1 rounded-lg border border-gray-800 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${tab === t.id
                ? 'bg-green-600 text-white'
                : 'text-gray-400 hover:text-gray-200'}`}>
            <t.icon className="w-4 h-4" />
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full
              ${tab === t.id ? 'bg-green-700 text-green-100' : 'bg-gray-700 text-gray-400'}`}>
              {t.count.toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Tables */}
      <div className="bg-[#0f1623] border border-gray-800 rounded-lg overflow-hidden">

        {/* TRADERS TABLE */}
        {tab === 'traders' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 text-left">Trader</th>
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-left">Market / State</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Variance</th>
                  <th className="px-4 py-3 text-center">GPS</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Fraud</th>
                  <th className="px-4 py-3 text-left">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-600">Loading...</td></tr>
                ) : traderLogs.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-600">No records found</td></tr>
                ) : traderLogs.map(r => (
                  <tr key={r.submission_id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-200">{r.trader_name}</div>
                      <div className="text-gray-500 text-xs">{r.trader_phone}</div>
                      <div className="text-gray-600 text-xs">Rep: {r.reputation_score}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-200">{r.item}</div>
                      <div className="text-gray-500 text-xs">{r.category} · {r.unit}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-200">{r.market}</div>
                      <div className="text-gray-500 text-xs">{r.state}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-200">{fmtPrice(r.price)}</td>
                    <td className="px-4 py-3 text-right">
                      {r.variance_from_baseline != null ? (
                        <span className={Number(r.variance_from_baseline) > 15 ? 'text-red-400' : 'text-gray-400'}>
                          {Number(r.variance_from_baseline).toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.gps_verified
                        ? <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                        : <XCircle className="w-4 h-4 text-gray-600 mx-auto" />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${statusDot(r.validation_status)}`}>
                        {r.validation_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.fraud_flag
                        ? <span title={r.fraud_flag_reason}><AlertTriangle className="w-4 h-4 text-red-400 mx-auto" /></span>
                        : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmt(r.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VALIDATORS TABLE */}
        {tab === 'validators' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 text-left">Validator</th>
                  <th className="px-4 py-3 text-left">Item / Market</th>
                  <th className="px-4 py-3 text-center">Vote</th>
                  <th className="px-4 py-3 text-right">Submitted Price</th>
                  <th className="px-4 py-3 text-right">Variance</th>
                  <th className="px-4 py-3 text-center">Consensus</th>
                  <th className="px-4 py-3 text-center">Honeypot</th>
                  <th className="px-4 py-3 text-center">Reward</th>
                  <th className="px-4 py-3 text-left">Voted At</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-600">Loading...</td></tr>
                ) : validatorLogs.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-600">No records found</td></tr>
                ) : validatorLogs.map(r => (
                  <tr key={r.vote_id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-200">{r.validator_name}</div>
                      <div className="text-gray-500 text-xs">{r.validator_phone}</div>
                      <div className="text-gray-600 text-xs">Accuracy: {r.accuracy_score}%</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-200">{r.item}</div>
                      <div className="text-gray-500 text-xs">{r.market}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${r.vote === 'APPROVE' ? 'text-green-400' : r.vote === 'REJECT' ? 'text-red-400' : 'text-gray-400'}`}>
                        {r.vote || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-200">{fmtPrice(r.trader_submitted_price)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{r.variance_percent ? `${r.variance_percent}%` : '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {r.agreed_with_consensus === '1' || r.agreed_with_consensus === 'true'
                        ? <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                        : r.agreed_with_consensus === '0' || r.agreed_with_consensus === 'false'
                          ? <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                          : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.is_honeypot === '1'
                        ? <span className={`text-xs font-medium ${r.honeypot_result === 'PASS' ? 'text-green-400' : 'text-red-400'}`}>
                            {r.honeypot_result || 'TRAP'}
                          </span>
                        : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-green-400 text-xs font-mono">
                      {r.reward_earned ? `₦${r.reward_earned}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmt(r.voted_at || r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CONSUMERS TABLE */}
        {tab === 'consumers' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="px-4 py-3 text-left">Consumer</th>
                  <th className="px-4 py-3 text-left">Tier</th>
                  <th className="px-4 py-3 text-left">Query</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-center">Step</th>
                  <th className="px-4 py-3 text-center">Completed</th>
                  <th className="px-4 py-3 text-center">Lang</th>
                  <th className="px-4 py-3 text-left">Session Start</th>
                  <th className="px-4 py-3 text-left">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-600">Loading...</td></tr>
                ) : consumerLogs.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-600">No records found</td></tr>
                ) : consumerLogs.map(r => (
                  <tr key={r.session_id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-200">{r.consumer_name}</div>
                      <div className="text-gray-500 text-xs">{r.phone_number}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tierColor[r.subscription_tier] || 'bg-gray-700 text-gray-400'}`}>
                        {r.subscription_tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-200">{r.selected_item || '—'}</div>
                      <div className="text-gray-500 text-xs">{r.session_status}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-200">{r.selected_market || '—'}</div>
                      <div className="text-gray-500 text-xs">{r.selected_state || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400 text-xs">{r.current_step || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {r.query_completed === '1' || r.query_completed === 'true'
                        ? <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                        : <Clock className="w-4 h-4 text-yellow-500 mx-auto" />}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400 text-xs uppercase">
                      {r.preferred_language || 'en'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmt(r.created_at)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmt(r.last_updated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
          <span className="text-gray-500 text-xs">
            Page {page} of {pages} · {
              tab === 'traders' ? totals.traders
              : tab === 'validators' ? totals.validators
              : totals.consumers
            } total records
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}
              className="p-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded text-gray-300 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages || loading}
              className="p-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded text-gray-300 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
