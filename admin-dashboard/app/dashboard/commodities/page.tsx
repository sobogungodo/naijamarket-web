'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { PageWrapper } from '@/components/dashboard/layout';
import {
  Package, Plus, Search, RefreshCw, Download, Edit, Eye, EyeOff,
  ChevronLeft, ChevronRight, X, Save, Loader2, AlertTriangle,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react';

const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });

interface CommodityItem {
  item_id: string;
  item_name: string;
  category_id: string;
  category_name: string;
  Unit: string;
  measurement: string;
  whole_sale_Price: number;
  status: string;
  min_price: number;
  max_price: number;
  current_avg_price: number;
  current_min: number;
  current_max: number;
  markets_with_data: number;
  price_change_pct: number;
  recent_price_points: number;
}

interface Summary {
  total_items: number;
  total_categories: number;
  active_items: number;
  total_markets: number;
}

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#14b8a6'];

const formatPrice = (n: number) => {
  if (!n || n === 0) return '—';
  return '₦' + Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export default function CommoditiesPage() {
  const [items, setItems] = useState<CommodityItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [byCategory, setByCategory] = useState<{ category_id: string; category_name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 25;
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<CommodityItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    item_name: '', category_id: 'CAT001', Unit: 'bag', measurement: 'kg',
    whole_sale_Price: '', min_price: '', max_price: '',
  });

  const [pricesLoading, setPricesLoading] = useState(false);

  // Stage 1: Fast load (Items_Catalog only)
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/commodities');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load');
      setItems(json.data.items || []);
      setSummary(json.data.summary || null);
      setByCategory(json.data.by_category || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Stage 2: Load live prices from Daily_Prices (heavy)
  const fetchPrices = useCallback(async () => {
    setPricesLoading(true);
    try {
      const res = await fetch('/api/commodities?prices=1');
      const json = await res.json();
      if (json.success) {
        setItems(json.data.items || []);
        setSummary(json.data.summary || null);
      }
    } catch { /* silent */ }
    finally { setPricesLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    let list = items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => i.item_name.toLowerCase().includes(q) || i.item_id.toLowerCase().includes(q));
    }
    if (catFilter) list = list.filter(i => i.category_id === catFilter);
    if (statusFilter) list = list.filter(i => i.status === statusFilter);
    return list;
  }, [items, search, catFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const uniqueCats = [...new Set(items.map(i => i.category_id))].sort();

  const openAdd = () => {
    setEditItem(null);
    setForm({ item_name: '', category_id: 'CAT001', Unit: 'bag', measurement: 'kg', whole_sale_Price: '', min_price: '', max_price: '' });
    setShowModal(true);
  };

  const openEdit = (item: CommodityItem) => {
    setEditItem(item);
    setForm({
      item_name: item.item_name,
      category_id: item.category_id,
      Unit: item.Unit || 'bag',
      measurement: item.measurement || 'kg',
      whole_sale_Price: String(item.whole_sale_Price || ''),
      min_price: String(item.min_price || ''),
      max_price: String(item.max_price || ''),
    });
    setShowModal(true);
  };

  const saveItem = async () => {
    setSaving(true);
    try {
      const method = editItem ? 'PUT' : 'POST';
      const payload = editItem ? { ...form, item_id: editItem.item_id } : form;
      const res = await fetch('/api/commodities', {
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

  const toggleStatus = async (item: CommodityItem) => {
    const newStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await fetch('/api/commodities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.item_id, status: newStatus }),
      });
      fetchData();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const exportCSV = () => {
    const headers = ['item_id', 'item_name', 'category_id', 'unit', 'wholesale_price', 'min_price', 'max_price', 'current_avg', 'markets', 'change_%', 'status'];
    const rows = filtered.map(i => [i.item_id, `"${i.item_name}"`, i.category_id, i.Unit, i.whole_sale_Price, i.min_price, i.max_price, i.current_avg_price, i.markets_with_data, i.price_change_pct, i.status].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `food_commodities_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const avgVolatility = items.length > 0
    ? (items.reduce((s, i) => s + Math.abs(i.price_change_pct || 0), 0) / items.length).toFixed(1)
    : '0';

  return (
    <PageWrapper
      title="Food Commodities"
      subtitle={`${summary?.total_items || 0} food items across ${summary?.total_categories || 0} categories — Live from database`}
      actions={
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 rounded-lg bg-dash-bg border border-dash-border text-dash-muted hover:text-dash-text transition-colors" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={fetchPrices} disabled={pricesLoading} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dash-bg border border-dash-border text-dash-muted hover:text-dash-text transition-colors text-sm">
            {pricesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />} {pricesLoading ? 'Loading...' : 'Load Prices'}
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dash-bg border border-dash-border text-dash-muted hover:text-dash-text transition-colors text-sm">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-naija-green-500 hover:bg-naija-green-600 text-white transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Item
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
          { label: 'Food Items', value: summary?.total_items || 0, sub: `${summary?.active_items || 0} active`, icon: Package, color: 'text-naija-green-400' },
          { label: 'Categories', value: summary?.total_categories || 0, sub: 'Food categories', icon: Package, color: 'text-blue-400' },
          { label: 'With Price Data', value: items.filter(i => i.markets_with_data > 0).length, sub: 'Items with recent prices', icon: TrendingUp, color: 'text-amber-400' },
          { label: 'Avg Price Change', value: `${avgVolatility}%`, sub: 'Last 7 days', icon: TrendingUp, color: 'text-purple-400' },
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

      {/* Category Pie */}
      {byCategory.length > 0 && (
        <div className="dash-card p-4 mb-6">
          <h3 className="font-semibold text-dash-text mb-3">Items by Category</h3>
          <div className="flex items-center gap-6">
            <div style={{ width: 180, height: 180 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byCategory} dataKey="count" nameKey="category_name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3">
              {byCategory.map((c, i) => (
                <span key={c.category_id} className="flex items-center gap-1.5 text-sm text-dash-muted">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {c.category_name} ({c.count})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-muted" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by item name or ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-dash-card border border-dash-border rounded-lg text-dash-text text-sm focus:border-naija-green-500 focus:outline-none" />
        </div>
        <select value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 bg-dash-card border border-dash-border rounded-lg text-dash-text text-sm focus:outline-none">
          <option value="">All Categories</option>
          {uniqueCats.map(c => <option key={c} value={c}>{byCategory.find(bc => bc.category_id === c)?.category_name || c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 bg-dash-card border border-dash-border rounded-lg text-dash-text text-sm focus:outline-none">
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <span className="text-xs text-dash-muted">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="dash-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-dash-muted">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading food items from database...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dash-border">
                  {['ITEM', 'CATEGORY', 'UNIT', 'WHOLESALE PRICE', 'CURRENT AVG', 'PRICE RANGE', 'MARKETS', 'CHANGE', 'STATUS', 'ACTIONS'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-dash-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(item => {
                  const changePct = Number(item.price_change_pct) || 0;
                  return (
                    <tr key={item.item_id} className="border-b border-dash-border hover:bg-dash-hover transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-naija-green-500/10 flex items-center justify-center">
                            <Package className="w-4 h-4 text-naija-green-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-dash-text">{item.item_name}</p>
                            <p className="text-xs text-dash-muted font-mono">{item.item_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-500/10 text-blue-400">
                          {item.category_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-dash-muted">{item.Unit}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-dash-text">{formatPrice(item.whole_sale_Price)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-dash-text">
                          {item.current_avg_price > 0 ? formatPrice(item.current_avg_price) : '—'}
                        </span>
                        {item.recent_price_points > 0 && (
                          <p className="text-xs text-dash-muted">{item.recent_price_points} data points</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-dash-muted">
                          {formatPrice(item.current_min || item.min_price)} – {formatPrice(item.current_max || item.max_price)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-dash-text">{item.markets_with_data || 0}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-sm font-semibold ${changePct > 0 ? 'text-red-400' : changePct < 0 ? 'text-green-400' : 'text-dash-muted'}`}>
                          {changePct > 0 ? <TrendingUp className="w-3 h-3" /> : changePct < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {changePct > 0 ? '+' : ''}{changePct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${item.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-dash-hover text-dash-muted hover:text-dash-text transition-colors" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => toggleStatus(item)} className="p-1.5 rounded hover:bg-dash-hover text-dash-muted hover:text-dash-text transition-colors" title={item.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}>
                            {item.status === 'ACTIVE' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dash-border">
            <span className="text-xs text-dash-muted">Page {page} of {totalPages} ({filtered.length} items)</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded hover:bg-dash-hover text-dash-muted disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded hover:bg-dash-hover text-dash-muted disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-dash-card border border-dash-border rounded-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-dash-text">{editItem ? 'Edit Food Item' : 'Add New Food Item'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-dash-muted hover:text-dash-text"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-dash-muted mb-1">Item Name *</label>
                <input type="text" value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
                  className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text text-sm focus:border-naija-green-500 focus:outline-none" placeholder="e.g. Yam Flour (Elubo)" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-dash-muted mb-1">Category ID</label>
                  <input type="text" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                    className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text text-sm focus:outline-none" placeholder="CAT001" />
                </div>
                <div>
                  <label className="block text-xs text-dash-muted mb-1">Unit</label>
                  <select value={form.Unit} onChange={e => setForm(f => ({ ...f, Unit: e.target.value }))}
                    className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text text-sm focus:outline-none">
                    {['bag', 'basket', 'kg', 'litre', 'bunch', 'tuber', 'piece', 'dozen', 'tin', 'bottle', 'mudu', 'derica'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-dash-muted mb-1">Measurement</label>
                  <input type="text" value={form.measurement} onChange={e => setForm(f => ({ ...f, measurement: e.target.value }))}
                    className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text text-sm focus:outline-none" placeholder="kg" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-dash-muted mb-1">Wholesale Price (₦)</label>
                  <input type="number" value={form.whole_sale_Price} onChange={e => setForm(f => ({ ...f, whole_sale_Price: e.target.value }))}
                    className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text text-sm focus:outline-none" placeholder="50000" />
                </div>
                <div>
                  <label className="block text-xs text-dash-muted mb-1">Min Price (₦)</label>
                  <input type="number" value={form.min_price} onChange={e => setForm(f => ({ ...f, min_price: e.target.value }))}
                    className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text text-sm focus:outline-none" placeholder="1000" />
                </div>
                <div>
                  <label className="block text-xs text-dash-muted mb-1">Max Price (₦)</label>
                  <input type="number" value={form.max_price} onChange={e => setForm(f => ({ ...f, max_price: e.target.value }))}
                    className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text text-sm focus:outline-none" placeholder="5000" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveItem} disabled={saving || !form.item_name}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-naija-green-500 hover:bg-naija-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : editItem ? 'Update Item' : 'Add Item'}
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
