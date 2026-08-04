'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Shield, Search, Download, RefreshCw, UserPlus, Eye, Ban,
  Star, MapPin, Bot, Trash2, AlertTriangle, CheckCircle2, Undo2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import AddUserModal from '@/components/modals/AddUserModal';
import { exportTraders, exportValidators } from '@/lib/export-utils';

// ============================================================================
// TYPES
// ============================================================================

interface Trader {
  id: string;
  name: string;
  phone: string;
  market: string;
  market_id: string;
  state: string;
  reputation: number;
  submissions: number;
  approved: number;
  rejected: number;
  balance: number;
  status: string;
  createdAt: string;
  lastActive: string;
  isSynthetic: boolean;
}

interface Validator {
  id: string;
  name: string;
  phone: string;
  market: string;
  market_id: string;
  state: string;
  tier: string;
  accuracy: number;
  totalValidations: number;
  correctVotes: number;
  balance: number;
  status: string;
  createdAt: string;
  lastActive: string;
  isSynthetic: boolean;
}

interface UserStats {
  totalTraders:        number;
  activeTraders:       number;
  newTradersToday:     number;
  suspendedTraders:    number;
  syntheticTraders:    number;
  totalValidators:     number;
  activeValidators:    number;
  goldValidators:      number;
  newValidatorsToday:  number;
  syntheticValidators: number;
  avgTraderReputation: number;
  avgValidatorAccuracy: number;
}

const weeklyData = [
  { day: 'Mon', traders: 45, validators: 12 },
  { day: 'Tue', traders: 52, validators: 18 },
  { day: 'Wed', traders: 38, validators: 15 },
  { day: 'Thu', traders: 65, validators: 22 },
  { day: 'Fri', traders: 48, validators: 14 },
  { day: 'Sat', traders: 32, validators: 8  },
  { day: 'Sun', traders: 28, validators: 6  },
];

// ============================================================================
// HELPERS
// ============================================================================

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60)  return 'just now';
  const m = Math.floor(seconds / 60);
  if (m < 60)        return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)        return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Pill indicating this is a synthetic (simulated) account
function SynBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold
                     bg-purple-500/15 text-purple-400 border border-purple-500/30 ml-2">
      <Bot className="w-2.5 h-2.5" />
      SYN
    </span>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

type UserTab   = 'traders' | 'validators';
type SourceTab = 'all' | 'real' | 'synthetic';

export default function UserManagementPage() {
  const [activeTab,      setActiveTab]      = useState<UserTab>('traders');
  const [sourceFilter,   setSourceFilter]   = useState<SourceTab>('all');
  const [searchQuery,    setSearchQuery]     = useState('');
  const [statusFilter,   setStatusFilter]    = useState('All');

  const [traders,        setTraders]         = useState<Trader[]>([]);
  const [validators,     setValidators]      = useState<Validator[]>([]);
  const [stats,          setStats]           = useState<UserStats | null>(null);

  const [isLoading,      setIsLoading]       = useState(true);
  const [isRefreshing,   setIsRefreshing]    = useState(false);
  const [isExporting,    setIsExporting]     = useState(false);
  const [showAddModal,   setShowAddModal]    = useState(false);
  const [lastUpdated,    setLastUpdated]     = useState(new Date());

  // Delete synthetic confirm dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget,      setDeleteTarget]       = useState<'traders' | 'validators' | 'both'>('both');
  const [isDeleting,        setIsDeleting]          = useState(false);
  const [deleteResult,      setDeleteResult]        = useState<string | null>(null);

  // Approve / unapprove confirm dialog state
  const [statusConfirm,     setStatusConfirm]       = useState<{ id: string; name: string; action: 'approve' | 'unapprove' } | null>(null);
  const [isStatusUpdating,  setIsStatusUpdating]    = useState(false);

  // ── Fetch users ────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (tab: UserTab, source: SourceTab, search: string, status: string) => {
    try {
      const params = new URLSearchParams({
        type:     tab,
        source:   source,
        pageSize: '100',
        page:     '1',
      });
      if (search) params.set('search', search);
      if (status && status !== 'All') params.set('status', status);

      const res = await fetch(`/api/users?${params}`, { cache: 'no-store' });
      const json = await res.json();

      if (json.success) {
        if (tab === 'traders') setTraders(json.data.items as Trader[]);
        else                    setValidators(json.data.items as Validator[]);
      }
    } catch (err) {
      console.error('[fetchUsers]', err);
    }
  }, []);

  // ── Fetch stats ────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res  = await fetch('/api/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'stats' }),
      });
      const json = await res.json();
      if (json.success) setStats(json.data as UserStats);
    } catch (err) {
      console.error('[fetchStats]', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      fetchUsers(activeTab, sourceFilter, searchQuery, statusFilter),
      fetchStats(),
    ]).finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch on filter change
  useEffect(() => {
    fetchUsers(activeTab, sourceFilter, searchQuery, statusFilter);
  }, [activeTab, sourceFilter, searchQuery, statusFilter, fetchUsers]);

  // ── Refresh ────────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchUsers(activeTab, sourceFilter, searchQuery, statusFilter),
      fetchStats(),
    ]);
    setLastUpdated(new Date());
    setIsRefreshing(false);
  }, [activeTab, sourceFilter, searchQuery, statusFilter, fetchUsers, fetchStats]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 300));
    if (activeTab === 'traders')
      exportTraders(traders.map(t => ({ ...t, rejected: t.submissions - t.approved })));
    else
      exportValidators(validators);
    setIsExporting(false);
  }, [activeTab, traders, validators]);

  // ── Bulk delete synthetic ─────────────────────────────────────────────────
  const handleBulkDelete = useCallback(async () => {
    setIsDeleting(true);
    setDeleteResult(null);
    try {
      const userType = deleteTarget === 'both' ? undefined : deleteTarget;
      const res  = await fetch('/api/users', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userType, confirm: 'DELETE_SYNTHETIC' }),
      });
      const json = await res.json();
      if (json.success) {
        setDeleteResult(json.message);
        await Promise.all([
          fetchUsers(activeTab, sourceFilter, searchQuery, statusFilter),
          fetchStats(),
        ]);
      } else {
        setDeleteResult(`Error: ${json.error}`);
      }
    } catch {
      setDeleteResult('Network error');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [deleteTarget, activeTab, sourceFilter, searchQuery, statusFilter, fetchUsers, fetchStats]);

  // ── Approve / unapprove a trader (PATCH /api/users) ─────────────────────────
  const submitStatusAction = useCallback(async () => {
    if (!statusConfirm) return;
    setIsStatusUpdating(true);
    try {
      const res = await fetch('/api/users', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          userId:   statusConfirm.id,
          userType: 'trader',
          action:   statusConfirm.action,
          reason:   statusConfirm.action === 'unapprove' ? 'Admin unapprove' : '',
        }),
      });
      const json = await res.json();
      if (json.success) {
        await Promise.all([
          fetchUsers(activeTab, sourceFilter, searchQuery, statusFilter),
          fetchStats(),
        ]);
      }
    } catch (err) {
      console.error('[submitStatusAction]', err);
    } finally {
      setIsStatusUpdating(false);
      setStatusConfirm(null);
    }
  }, [statusConfirm, activeTab, sourceFilter, searchQuery, statusFilter, fetchUsers, fetchStats]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const traderStats = {
    total:         stats?.totalTraders        ?? 0,
    active:        stats?.activeTraders       ?? 0,
    avgReputation: stats?.avgTraderReputation  ? stats.avgTraderReputation.toFixed(1) : '—',
    newToday:      stats?.newTradersToday     ?? 0,
    synthetic:     stats?.syntheticTraders    ?? 0,
  };
  const validatorStats = {
    total:       stats?.totalValidators       ?? 0,
    gold:        stats?.goldValidators        ?? 0,
    avgAccuracy: stats?.avgValidatorAccuracy   ? stats.avgValidatorAccuracy.toFixed(1) : '—',
    newToday:    stats?.newValidatorsToday    ?? 0,
    synthetic:   stats?.syntheticValidators   ?? 0,
  };

  const syntheticCount = activeTab === 'traders'
    ? traders.filter(t => t.isSynthetic).length
    : validators.filter(v => v.isSynthetic).length;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-gray-400 text-sm">Manage traders, validators, and user permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live Data
            <span className="text-gray-500">Last updated {timeAgo(lastUpdated.toISOString())}</span>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1f2e] border border-gray-700
                       rounded-lg text-sm hover:border-gray-500 transition-colors disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
            Export
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500
                       rounded-lg text-sm font-medium transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-[#1a1f2e] border border-gray-700 rounded-lg hover:border-gray-500
                       transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <div className="px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg
                          text-green-500 text-sm font-medium">
            SUPER ADMIN
          </div>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">TOTAL TRADERS</span>
            <Users className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold">{isLoading ? '…' : traderStats.total.toLocaleString()}</p>
          <p className="text-xs text-gray-500">
            {traderStats.active.toLocaleString()} active
            {traderStats.synthetic > 0 &&
              <span className="ml-2 text-purple-400">· {traderStats.synthetic.toLocaleString()} synthetic</span>
            }
          </p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">TOTAL VALIDATORS</span>
            <Shield className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold">{isLoading ? '…' : validatorStats.total.toLocaleString()}</p>
          <p className="text-xs text-gray-500">
            {validatorStats.gold} gold tier
            {validatorStats.synthetic > 0 &&
              <span className="ml-2 text-purple-400">· {validatorStats.synthetic.toLocaleString()} synthetic</span>
            }
          </p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">AVG TRADER REPUTATION</span>
            <Star className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold">{isLoading ? '…' : traderStats.avgReputation}</p>
          <p className="text-xs text-gray-500">out of 100 (real traders)</p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">AVG VALIDATOR ACCURACY</span>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold">{isLoading ? '…' : `${validatorStats.avgAccuracy}%`}</p>
          <p className="text-xs text-gray-500">vote accuracy (real validators)</p>
        </div>
      </div>

      {/* ── Weekly trend chart ─────────────────────────────────────────────── */}
      <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800 mb-6">
        <h3 className="font-semibold mb-4">Weekly Registration Trend</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="day"  stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend />
            <Bar dataKey="traders"    name="Traders"    fill="#22c55e" radius={[4,4,0,0]} />
            <Bar dataKey="validators" name="Validators" fill="#eab308" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Tab bar: Traders / Validators ─────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('traders'); setSourceFilter('all'); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                        transition-colors ${activeTab === 'traders'
                          ? 'bg-green-600 text-white'
                          : 'bg-[#1a1f2e] text-gray-400 hover:text-white border border-gray-700'}`}
          >
            <Users className="w-4 h-4" />
            Traders ({isLoading ? '…' : traderStats.total.toLocaleString()})
          </button>
          <button
            onClick={() => { setActiveTab('validators'); setSourceFilter('all'); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                        transition-colors ${activeTab === 'validators'
                          ? 'bg-yellow-600 text-white'
                          : 'bg-[#1a1f2e] text-gray-400 hover:text-white border border-gray-700'}`}
          >
            <Shield className="w-4 h-4" />
            Validators ({isLoading ? '…' : validatorStats.total.toLocaleString()})
          </button>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Status:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#1a1f2e] border border-gray-700 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:border-green-500"
          >
            <option>All</option>
            <option>APPROVED</option>
            <option>SYNTHETIC</option>
            <option>SUSPENDED</option>
            <option>PENDING</option>
          </select>
        </div>
      </div>

      {/* ── Source filter: All / Real / Synthetic ─────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 bg-[#1a1f2e] border border-gray-800 rounded-lg p-1">
          {(['all', 'real', 'synthetic'] as SourceTab[]).map(s => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                          transition-colors ${sourceFilter === s
                            ? s === 'synthetic'
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-700 text-white'
                            : 'text-gray-400 hover:text-white'}`}
            >
              {s === 'synthetic' && <Bot className="w-3.5 h-3.5" />}
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {s === 'synthetic' && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-800/60">
                  {activeTab === 'traders' ? traderStats.synthetic : validatorStats.synthetic}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Bulk delete — only visible on synthetic filter */}
          {sourceFilter === 'synthetic' && syntheticCount > 0 && (
            <button
              onClick={() => { setDeleteTarget(activeTab); setShowDeleteConfirm(true); }}
              className="flex items-center gap-2 px-3 py-2 bg-red-600/20 border border-red-600/40
                         text-red-400 rounded-lg text-sm hover:bg-red-600/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete All Synthetic ({syntheticCount.toLocaleString()})
            </button>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-64 bg-[#1a1f2e] border border-gray-700 rounded-lg pl-10 pr-4 py-2
                         text-sm focus:outline-none focus:border-green-500"
            />
          </div>
        </div>
      </div>

      {/* ── Delete result banner ───────────────────────────────────────────── */}
      {deleteResult && (
        <div className={`mb-4 p-3 rounded-lg border text-sm flex items-center gap-2 ${
          deleteResult.startsWith('Error')
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-green-500/10 border-green-500/30 text-green-400'
        }`}>
          {deleteResult.startsWith('Error') ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {deleteResult}
          <button onClick={() => setDeleteResult(null)} className="ml-auto text-gray-500 hover:text-white">✕</button>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="bg-[#1a1f2e] rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-gray-400 text-sm font-medium p-4">
                {activeTab === 'traders' ? 'TRADER' : 'VALIDATOR'}
              </th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">MARKET</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">
                {activeTab === 'traders' ? 'Reputation' : 'Accuracy'}
              </th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">
                {activeTab === 'traders' ? 'Submissions' : 'Validations'}
              </th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">Balance</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">STATUS</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">LAST ACTIVE</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500">Loading…</td>
              </tr>
            ) : activeTab === 'traders' ? (
              traders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">No traders found</td>
                </tr>
              ) : (
                traders.map(trader => (
                  <tr
                    key={trader.id}
                    className={`border-b border-gray-800/50 hover:bg-[#252b3b]/50 transition-colors
                                ${trader.isSynthetic ? 'bg-purple-950/10' : ''}`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium
                                        ${trader.isSynthetic
                                          ? 'bg-purple-500/20 text-purple-400'
                                          : 'bg-green-500/20 text-green-500'}`}>
                          {trader.isSynthetic
                            ? <Bot className="w-4 h-4" />
                            : trader.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center">
                            <p className="font-medium">{trader.name}</p>
                            {trader.isSynthetic && <SynBadge />}
                          </div>
                          <p className="text-sm text-gray-400">{trader.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-gray-300">
                        <MapPin className="w-3 h-3 text-gray-500" />
                        {trader.market || '—'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${
                          trader.reputation >= 80 ? 'text-green-500' :
                          trader.reputation >= 50 ? 'text-yellow-500' : 'text-red-500'
                        }`}>
                          {trader.reputation}
                        </span>
                        <Star className="w-4 h-4 text-yellow-500" />
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-300">{trader.approved}</span>
                      <span className="text-gray-500"> / {trader.submissions}</span>
                    </td>
                    <td className="p-4 font-medium text-green-500">
                      ₦{(trader.balance ?? 0).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        trader.status === 'APPROVED' || trader.status === 'active'
                          ? 'bg-green-500/20 text-green-500'
                          : trader.status === 'SYNTHETIC'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-red-500/20 text-red-500'
                      }`}>
                        {trader.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400">{timeAgo(trader.lastActive)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors" title="View">
                          <Eye className="w-4 h-4 text-gray-400" />
                        </button>
                        {!trader.isSynthetic && (
                          <button className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors" title="Suspend">
                            <Ban className="w-4 h-4 text-gray-400" />
                          </button>
                        )}
                        <button
                          onClick={() => setStatusConfirm({ id: trader.id, name: trader.name, action: 'approve' })}
                          className="p-1.5 hover:bg-green-600/20 rounded-lg transition-colors"
                          title="Approve"
                        >
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        </button>
                        <button
                          onClick={() => setStatusConfirm({ id: trader.id, name: trader.name, action: 'unapprove' })}
                          className="p-1.5 hover:bg-yellow-600/20 rounded-lg transition-colors"
                          title="Unapprove"
                        >
                          <Undo2 className="w-4 h-4 text-yellow-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )
            ) : (
              // ── Validators table rows ───────────────────────────────────────
              validators.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">No validators found</td>
                </tr>
              ) : (
                validators.map(validator => (
                  <tr
                    key={validator.id}
                    className={`border-b border-gray-800/50 hover:bg-[#252b3b]/50 transition-colors
                                ${validator.isSynthetic ? 'bg-purple-950/10' : ''}`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium
                                        ${validator.isSynthetic
                                          ? 'bg-purple-500/20 text-purple-400'
                                          : 'bg-yellow-500/20 text-yellow-500'}`}>
                          {validator.isSynthetic
                            ? <Bot className="w-4 h-4" />
                            : validator.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center">
                            <p className="font-medium">{validator.name}</p>
                            {validator.isSynthetic && <SynBadge />}
                          </div>
                          <p className="text-sm text-gray-400">{validator.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-gray-300">
                        <MapPin className="w-3 h-3 text-gray-500" />
                        {validator.market || '—'}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`font-medium ${
                        validator.accuracy >= 90 ? 'text-green-500' :
                        validator.accuracy >= 70 ? 'text-yellow-500' : 'text-red-500'
                      }`}>
                        {validator.accuracy ?? 0}%
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-300">{(validator.correctVotes ?? 0).toLocaleString()}</span>
                      <span className="text-gray-500"> / {(validator.totalValidations ?? 0).toLocaleString()}</span>
                    </td>
                    <td className="p-4 font-medium text-green-500">
                      ₦{(validator.balance ?? 0).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        validator.status === 'ACTIVE' || validator.status === 'active'
                          ? 'bg-green-500/20 text-green-500'
                          : validator.status === 'SYNTHETIC'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-red-500/20 text-red-500'
                      }`}>
                        {validator.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400">{timeAgo(validator.lastActive)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors" title="View">
                          <Eye className="w-4 h-4 text-gray-400" />
                        </button>
                        {!validator.isSynthetic && (
                          <button className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors" title="Suspend">
                            <Ban className="w-4 h-4 text-gray-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )
            )}
          </tbody>
        </table>
      </div>

      {/* ── Bulk delete confirm dialog ─────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1f2e] border border-red-500/30 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Delete All Synthetic {deleteTarget === 'both' ? 'Users' : deleteTarget}</h3>
                <p className="text-xs text-gray-400">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-gray-300 mb-2">
              This will permanently delete all synthetic {deleteTarget === 'both' ? 'traders and validators' : deleteTarget},
              along with all their associated submissions and votes.
            </p>
            <p className="text-sm text-yellow-400 mb-5">
              ⚠ Only run this if you are replacing synthetic data or launching with real users.
              Re-run <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">sp_Seed_Synthetic_Traders</code> and{' '}
              <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">sp_Seed_Synthetic_Validators</code> to restore.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm
                           font-medium transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approve / unapprove confirm dialog ─────────────────────────────── */}
      {statusConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`bg-[#1a1f2e] border rounded-xl p-6 max-w-md w-full ${
            statusConfirm.action === 'approve' ? 'border-green-500/30' : 'border-yellow-500/30'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                statusConfirm.action === 'approve' ? 'bg-green-500/20' : 'bg-yellow-500/20'
              }`}>
                {statusConfirm.action === 'approve'
                  ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                  : <Undo2 className="w-5 h-5 text-yellow-400" />}
              </div>
              <div>
                <h3 className="font-semibold text-white">
                  {statusConfirm.action === 'approve' ? 'Approve trader' : 'Unapprove trader'}
                </h3>
                <p className="text-xs text-gray-400">{statusConfirm.name}</p>
              </div>
            </div>

            <p className="text-sm text-gray-300 mb-5">
              {statusConfirm.action === 'approve'
                ? 'Sets this trader to APPROVED — their submissions enter the live pipeline and become payable.'
                : 'Sets this trader to SUSPENDED — a withdrawn approval (distinct from never-approved). They can no longer submit live prices.'}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setStatusConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitStatusAction}
                disabled={isStatusUpdating}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  statusConfirm.action === 'approve'
                    ? 'bg-green-600 hover:bg-green-500'
                    : 'bg-yellow-600 hover:bg-yellow-500'
                }`}
              >
                {isStatusUpdating
                  ? 'Working…'
                  : (statusConfirm.action === 'approve' ? 'Confirm Approve' : 'Confirm Unapprove')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add user modal ─────────────────────────────────────────────────── */}
      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        userType={activeTab === 'traders' ? 'trader' : 'validator'}
        onSuccess={(newUser) => {
          if (activeTab === 'traders') setTraders(prev => [newUser as Trader, ...prev]);
          else setValidators(prev => [newUser as Validator, ...prev]);
        }}
      />
    </div>
  );
}
