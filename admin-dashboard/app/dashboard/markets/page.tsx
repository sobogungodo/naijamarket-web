'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { PageWrapper } from '@/components/dashboard/layout';
import {
  MapPin, Plus, Search, RefreshCw, Download, Edit, Eye, EyeOff,
  ChevronLeft, ChevronRight, X, Save, Loader2, AlertTriangle,
  Users, FileText, Navigation,
} from 'lucide-react';

const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });

interface Market {
  market_id: string;
  market_name: string;
  state: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  opening_hours: string;
  status: string;
  region_id: string | null;
  coordinate_source: string | null;
  created_at: string;
  trader_count: number;
  submissions_today: number;
  total_submissions: number;
  accuracy_pct: number;
  latest_submission: string | null;
  items_tracked: number;
}

interface Summary {
  total_markets: number;
  active_markets: number;
  states_covered: number;
  total_traders: number;
  submissions_today: number;
  active_markets_today: number;
}

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#14b8a6', '#84cc16', '#e11d48', '#0ea5e9', '#a855f7', '#f43f5e', '#22d3ee'];

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [byState, setByState] = useState<{ state: string; count: number }[]>([]);
  const [activity, setActivity] = useState<{ date: string; submissions: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [showModal, setShowModal] = useState(false);
  const [editMarket, setEditMarket] = useState<Market | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    market_name: '', state: 'Lagos', latitude: '', longitude: '',
    radius_meters: '500', opening_hours: '6:00 AM - 6:00 PM',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/markets');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load');
      setMarkets(json.data.markets || []);
      setSummary(json.data.summary || null);
      setByState(json.data.by_state || []);
      setActivity(json.data.activity_7d || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    let list = markets;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.market_name.toLowerCase().includes(q) ||
        m.market_id.toLowerCase().includes(q) ||
        m.state.toLowerCase().includes(q)
      );
    }
    if (stateFilter) list = list.filter(m => m.state === stateFilter);
    if (statusFilter) list = list.filter(m => m.status === statusFilter);
    return list;
  }, [markets, search, stateFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const uniqueStates = [...new Set(markets.map(m => m.state))].sort();

  const openAdd = () => {
    setEditMarket(null);
    setForm({ market_name: '', state: 'Lagos', latitude: '', longitude: '', radius_meters: '500', opening_hours: '6:00 AM - 6:00 PM' });
    setShowModal(true);
  };

  const openEdit = (m: Market) => {
    setEditMarket(m);
    setForm({
      market_name: m.market_name,
      state: m.state,
      latitude: String(m.latitude),
      longitude: String(m.longitude),
      radius_meters: String(m.radius_meters || 500),
      opening_hours: m.opening_hours || '',
    });
    setShowModal(true);
  };

  const saveMarket = async () => {
    setSaving(true);
    try {
      const method = editMarket ? 'PUT' : 'POST';
      const payload = editMarket ? { ...form, market_id: editMarket.market_id } : form;
      const res = await fetch('/api/markets', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (m: Market) => {
    const newStatus = m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await fetch('/api/markets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market_id: m.market_id, status: newStatus }),
      });
      fetchData();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const exportCSV = () => {
    const headers = ['market_id', 'market_name', 'state', 'latitude', 'longitude', 'radius_m', 'traders', 'submissions_today', 'total_submissions', 'accuracy_%', 'items', 'status'];
    const rows = filtered.map(m => [m.market_id, `"${m.market_name}"`, m.state, m.latitude, m.longitude, m.radius_meters, m.trader_count, m.submissions_today, m.total_submissions, m.accuracy_pct, m.items_tracked, m.status].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `markets_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <PageWrapper
      title="Markets Management"
      subtitle={`${summary?.total_markets || 0} markets across ${summary?.states_covered || 0} states — Live from database`}
      actions={
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 rounded-lg bg-dash-bg border border-dash-border text-dash-muted hover:text-dash-text transition-colors" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dash-bg border border-dash-border text-dash-muted hover:text-dash-text transition-colors text-sm">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-naija-green-500 hover:bg-naija-green-600 text-white transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Market
          </button>
        </div>
      }
    >
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-400 text-sm">{error}</span>
          <button onClick={fetchData} className="ml-auto text-red-400 hover:text-red-300 text-sm underline">Retry</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Markets', value: summary?.total_markets || 0, sub: `${summary?.active_markets || 0} active`, icon: MapPin, color: 'text-naija-green-400' },
          { label: 'Registered Traders', value: (summary?.total_traders || 0).toLocaleString(), sub: `across ${summary?.states_covered || 0} states`, icon: Users, color: 'text-blue-400' },
          { label: 'Submissions Today', value: (summary?.submissions_today || 0).toLocaleString(), sub: `${summary?.active_markets_today || 0} markets active`, icon: FileText, color: 'text-amber-400' },
          { label: 'States Covered', value: summary?.states_covered || 0, sub: 'of 37 states', icon: Navigation, color: 'text-purple-400' },
        ].map(stat => (
          <div key={stat.label} className="dash-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-dash-muted">{stat.label}</span>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-dash-text">{loading ? '...' : stat.value}</p>
            <p className="text-xs text-dash-muted mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="dash-card p-4 lg:col-span-2">
          <h3 className="font-semibold text-dash-text mb-3">Submission Activity (7 days)</h3>
          {activity.length > 0 ? (
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={activity.map(a => ({ ...a, day: new Date(a.date).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric' }) }))}>
                  <XAxis dataKey="day" tick={{ fill: '#666', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#666', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }} labelStyle={{ color: '#fff' }} />
                  <Bar dataKey="submissions" fill="#10b981" radius={[4, 4, 0, 0]} name="Submissions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-dash-muted text-sm">No activity data</div>
          )}
        </div>

        <div className="dash-card p-4">
          <h3 className="font-semibold text-dash-text mb-3">Markets by State</h3>
          {byState.length > 0 ? (
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byState} dataKey="count" nameKey="state" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                    {byState.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-dash-muted text-sm">No data</div>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {byState.slice(0, 8).map((s, i) => (
              <span key={s.state} className="flex items-center gap-1 text-xs text-dash-muted">
                <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {s.state} ({s.count})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-muted" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by market name, ID, state..."
            className="w-full pl-10 pr-4 py-2.5 bg-dash-card border border-dash-border rounded-lg text-dash-text text-sm focus:border-naija-green-500 focus:outline-none" />
        </div>
        <select value={stateFilter} onChange={e => { setStateFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 bg-dash-card border border-dash-border rounded-lg text-dash-text text-sm focus:outline-none">
          <option value="">All States</option>
          {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 bg-dash-card border border-dash-border rounded-lg text-dash-text text-sm focus:outline-none">
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <span className="text-xs text-dash-muted">{filtered.length} market{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="dash-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-dash-muted">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading markets from database...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dash-border">
                  {['MARKET', 'STATE', 'GPS', 'RADIUS', 'TRADERS', 'TODAY', 'TOTAL', 'CONFIDENCE', 'ITEMS', 'STATUS', 'ACTIONS'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-dash-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(m => (
                  <tr key={m.market_id} className="border-b border-dash-border hover:bg-dash-hover transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-naija-green-500/10 flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-naija-green-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-dash-text">{m.market_name}</p>
                          <p className="text-xs text-dash-muted font-mono">{m.market_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-dash-text">{m.state}</p>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-dash-muted font-mono">
                        {Number(m.latitude).toFixed(4)}°N<br />
                        {Number(m.longitude).toFixed(4)}°E
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-dash-muted">{m.radius_meters}m</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-sm text-dash-text">
                        <Users className="w-3 h-3 text-blue-400" /> {m.trader_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-dash-text">{m.submissions_today}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-dash-muted">{m.total_submissions.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold ${Number(m.accuracy_pct) >= 80 ? 'text-green-400' : Number(m.accuracy_pct) >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {Number(m.accuracy_pct).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-dash-muted">{m.items_tracked}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${m.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-dash-hover text-dash-muted hover:text-dash-text transition-colors" title="Edit">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggleStatus(m)} className="p-1.5 rounded hover:bg-dash-hover text-dash-muted hover:text-dash-text transition-colors" title={m.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}>
                          {m.status === 'ACTIVE' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dash-border">
            <span className="text-xs text-dash-muted">Page {page} of {totalPages} ({filtered.length} markets)</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded hover:bg-dash-hover text-dash-muted disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded hover:bg-dash-hover text-dash-muted disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-dash-card border border-dash-border rounded-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-dash-text">{editMarket ? 'Edit Market' : 'Add New Market'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-dash-muted hover:text-dash-text"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-dash-muted mb-1">Market Name *</label>
                <input type="text" value={form.market_name} onChange={e => setForm(f => ({ ...f, market_name: e.target.value }))}
                  className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text text-sm focus:border-naija-green-500 focus:outline-none" placeholder="e.g. Balogun Market" />
              </div>
              <div>
                <label className="block text-xs text-dash-muted mb-1">State *</label>
                <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                  className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text text-sm focus:outline-none">
                  {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-dash-muted mb-1">Latitude *</label>
                  <input type="number" step="0.0001" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                    className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text text-sm focus:outline-none" placeholder="6.6018" />
                </div>
                <div>
                  <label className="block text-xs text-dash-muted mb-1">Longitude *</label>
                  <input type="number" step="0.0001" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                    className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text text-sm focus:outline-none" placeholder="3.3792" />
                </div>
                <div>
                  <label className="block text-xs text-dash-muted mb-1">Radius (m)</label>
                  <input type="number" value={form.radius_meters} onChange={e => setForm(f => ({ ...f, radius_meters: e.target.value }))}
                    className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text text-sm focus:outline-none" placeholder="500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-dash-muted mb-1">Opening Hours</label>
                <input type="text" value={form.opening_hours} onChange={e => setForm(f => ({ ...f, opening_hours: e.target.value }))}
                  className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text text-sm focus:outline-none" placeholder="6:00 AM - 6:00 PM" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveMarket} disabled={saving || !form.market_name || !form.state || !form.latitude || !form.longitude}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-naija-green-500 hover:bg-naija-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : editMarket ? 'Update Market' : 'Add Market'}
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 bg-dash-bg border border-dash-border text-dash-muted rounded-lg text-sm hover:text-dash-text transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
