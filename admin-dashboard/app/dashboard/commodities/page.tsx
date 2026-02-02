'use client';

import { useState, useCallback } from 'react';
import {
  Package, Search, RefreshCw, Download, Plus, Edit2, Trash2,
  Eye, ToggleLeft, ToggleRight, TrendingUp, TrendingDown,
  X, Loader2, CheckCircle, AlertTriangle, DollarSign, Scale,
  Wheat, Droplets, Hammer, Cpu, Shirt
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Types
interface Commodity {
  id: string;
  name: string;
  category: string;
  unit: string;
  baselinePrices: {
    marketId: string;
    marketName: string;
    price: number;
    lastUpdated: Date;
  }[];
  avgPrice: number;
  priceRangeMin: number;
  priceRangeMax: number;
  varianceThreshold: number;
  submissionsToday: number;
  priceChange7d: number;
  isActive: boolean;
  createdAt: Date;
}

// Categories
const CATEGORIES = [
  { id: 'grains', name: 'Grains & Cereals', icon: Wheat, color: '#eab308' },
  { id: 'oils', name: 'Oils & Fats', icon: Droplets, color: '#f97316' },
  { id: 'vegetables', name: 'Vegetables', icon: Package, color: '#22c55e' },
  { id: 'building', name: 'Building Materials', icon: Hammer, color: '#6b7280' },
  { id: 'electronics', name: 'Electronics', icon: Cpu, color: '#3b82f6' },
  { id: 'textiles', name: 'Textiles & Fabrics', icon: Shirt, color: '#a855f7' },
];

// Units
const UNITS = [
  'bag (50kg)', 'bag (25kg)', 'bag (100kg)',
  'basket', 'bunch', 'tuber',
  'jerry can (25L)', 'jerry can (10L)',
  'piece', 'sheet', 'ton',
  'yard', 'carton', 'gross'
];

// Mock data
const generateMockCommodities = (): Commodity[] => [
  {
    id: 'rice-50kg',
    name: 'Rice (50kg)',
    category: 'grains',
    unit: 'bag (50kg)',
    baselinePrices: [
      { marketId: 'mile12', marketName: 'Mile 12 Market', price: 75000, lastUpdated: new Date() },
      { marketId: 'onitsha', marketName: 'Onitsha Main Market', price: 73000, lastUpdated: new Date() },
      { marketId: 'kano', marketName: 'Kano Main Market', price: 70000, lastUpdated: new Date() },
    ],
    avgPrice: 72667,
    priceRangeMin: 50000,
    priceRangeMax: 95000,
    varianceThreshold: 30,
    submissionsToday: 234,
    priceChange7d: 5.2,
    isActive: true,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'tomatoes-basket',
    name: 'Tomatoes (Basket)',
    category: 'vegetables',
    unit: 'basket',
    baselinePrices: [
      { marketId: 'mile12', marketName: 'Mile 12 Market', price: 42000, lastUpdated: new Date() },
      { marketId: 'wuse', marketName: 'Wuse Market', price: 45000, lastUpdated: new Date() },
    ],
    avgPrice: 43500,
    priceRangeMin: 25000,
    priceRangeMax: 65000,
    varianceThreshold: 35,
    submissionsToday: 187,
    priceChange7d: -8.3,
    isActive: true,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'palm-oil-25l',
    name: 'Palm Oil (25L)',
    category: 'oils',
    unit: 'jerry can (25L)',
    baselinePrices: [
      { marketId: 'mile12', marketName: 'Mile 12 Market', price: 72000, lastUpdated: new Date() },
      { marketId: 'ariaria', marketName: 'Ariaria Market', price: 68000, lastUpdated: new Date() },
    ],
    avgPrice: 70000,
    priceRangeMin: 50000,
    priceRangeMax: 90000,
    varianceThreshold: 30,
    submissionsToday: 145,
    priceChange7d: 3.1,
    isActive: true,
    createdAt: new Date('2024-01-20'),
  },
  {
    id: 'beans-bag',
    name: 'Beans (Bag)',
    category: 'grains',
    unit: 'bag (50kg)',
    baselinePrices: [
      { marketId: 'mile12', marketName: 'Mile 12 Market', price: 120000, lastUpdated: new Date() },
      { marketId: 'kano', marketName: 'Kano Main Market', price: 115000, lastUpdated: new Date() },
    ],
    avgPrice: 117500,
    priceRangeMin: 90000,
    priceRangeMax: 150000,
    varianceThreshold: 25,
    submissionsToday: 98,
    priceChange7d: 2.5,
    isActive: true,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'cement-bag',
    name: 'Cement (Bag)',
    category: 'building',
    unit: 'bag (50kg)',
    baselinePrices: [
      { marketId: 'iddo', marketName: 'Iddo Market', price: 5500, lastUpdated: new Date() },
      { marketId: 'alaba', marketName: 'Alaba Market', price: 5200, lastUpdated: new Date() },
    ],
    avgPrice: 5350,
    priceRangeMin: 4500,
    priceRangeMax: 7000,
    varianceThreshold: 20,
    submissionsToday: 67,
    priceChange7d: 1.8,
    isActive: true,
    createdAt: new Date('2024-02-01'),
  },
  {
    id: 'garri-bag',
    name: 'Garri (Bag)',
    category: 'grains',
    unit: 'bag (50kg)',
    baselinePrices: [
      { marketId: 'mile12', marketName: 'Mile 12 Market', price: 35000, lastUpdated: new Date() },
    ],
    avgPrice: 35000,
    priceRangeMin: 25000,
    priceRangeMax: 50000,
    varianceThreshold: 30,
    submissionsToday: 112,
    priceChange7d: -2.1,
    isActive: true,
    createdAt: new Date('2024-01-15'),
  },
];

const categoryDistribution = [
  { name: 'Grains', value: 45, color: '#eab308' },
  { name: 'Vegetables', value: 20, color: '#22c55e' },
  { name: 'Oils', value: 15, color: '#f97316' },
  { name: 'Building', value: 12, color: '#6b7280' },
  { name: 'Others', value: 8, color: '#3b82f6' },
];

const priceChanges = [
  { item: 'Rice', change: 5.2 },
  { item: 'Tomatoes', change: -8.3 },
  { item: 'Palm Oil', change: 3.1 },
  { item: 'Beans', change: 2.5 },
  { item: 'Cement', change: 1.8 },
  { item: 'Garri', change: -2.1 },
];

export default function CommoditiesPage() {
  const [commodities, setCommodities] = useState<Commodity[]>(generateMockCommodities());
  const [selectedCommodity, setSelectedCommodity] = useState<Commodity | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | 'baseline'>('add');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: '',
    priceRangeMin: '',
    priceRangeMax: '',
    varianceThreshold: '30',
  });

  // Baseline form state
  const [baselineForm, setBaselineForm] = useState({
    marketId: '',
    price: '',
  });

  // Stats
  const stats = {
    totalItems: 524,
    activeItems: 498,
    categoriesCount: 12,
    avgPriceChange: 2.3,
  };

  // Refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setCommodities(generateMockCommodities());
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Open add modal
  const openAddModal = () => {
    setFormData({
      name: '',
      category: '',
      unit: '',
      priceRangeMin: '',
      priceRangeMax: '',
      varianceThreshold: '30',
    });
    setModalMode('add');
    setShowModal(true);
  };

  // Open edit modal
  const openEditModal = (commodity: Commodity) => {
    setSelectedCommodity(commodity);
    setFormData({
      name: commodity.name,
      category: commodity.category,
      unit: commodity.unit,
      priceRangeMin: commodity.priceRangeMin.toString(),
      priceRangeMax: commodity.priceRangeMax.toString(),
      varianceThreshold: commodity.varianceThreshold.toString(),
    });
    setModalMode('edit');
    setShowModal(true);
  };

  // Open view modal
  const openViewModal = (commodity: Commodity) => {
    setSelectedCommodity(commodity);
    setModalMode('view');
    setShowModal(true);
  };

  // Open baseline modal
  const openBaselineModal = (commodity: Commodity) => {
    setSelectedCommodity(commodity);
    setBaselineForm({ marketId: '', price: '' });
    setModalMode('baseline');
    setShowModal(true);
  };

  // Handle form submit
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (modalMode === 'add') {
        const newCommodity: Commodity = {
          id: `${formData.name.toLowerCase().replace(/\s+/g, '-')}_${Date.now()}`,
          name: formData.name,
          category: formData.category,
          unit: formData.unit,
          baselinePrices: [],
          avgPrice: 0,
          priceRangeMin: parseInt(formData.priceRangeMin),
          priceRangeMax: parseInt(formData.priceRangeMax),
          varianceThreshold: parseInt(formData.varianceThreshold),
          submissionsToday: 0,
          priceChange7d: 0,
          isActive: true,
          createdAt: new Date(),
        };
        setCommodities(prev => [newCommodity, ...prev]);
      } else if (modalMode === 'edit' && selectedCommodity) {
        setCommodities(prev => prev.map(c =>
          c.id === selectedCommodity.id
            ? {
                ...c,
                name: formData.name,
                category: formData.category,
                unit: formData.unit,
                priceRangeMin: parseInt(formData.priceRangeMin),
                priceRangeMax: parseInt(formData.priceRangeMax),
                varianceThreshold: parseInt(formData.varianceThreshold),
              }
            : c
        ));
      }

      setShowModal(false);
    } catch (error) {
      console.error('Error saving commodity:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle baseline submit
  const handleBaselineSubmit = async () => {
    if (!selectedCommodity || !baselineForm.marketId || !baselineForm.price) return;

    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const marketNames: Record<string, string> = {
        mile12: 'Mile 12 Market',
        onitsha: 'Onitsha Main Market',
        ariaria: 'Ariaria Market',
        wuse: 'Wuse Market',
        kano: 'Kano Main Market',
        alaba: 'Alaba Market',
      };

      setCommodities(prev => prev.map(c =>
        c.id === selectedCommodity.id
          ? {
              ...c,
              baselinePrices: [
                ...c.baselinePrices.filter(bp => bp.marketId !== baselineForm.marketId),
                {
                  marketId: baselineForm.marketId,
                  marketName: marketNames[baselineForm.marketId] || baselineForm.marketId,
                  price: parseInt(baselineForm.price),
                  lastUpdated: new Date(),
                }
              ]
            }
          : c
      ));

      setBaselineForm({ marketId: '', price: '' });
    } catch (error) {
      console.error('Error saving baseline:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle commodity status
  const toggleCommodityStatus = async (id: string) => {
    setCommodities(prev => prev.map(c =>
      c.id === id ? { ...c, isActive: !c.isActive } : c
    ));
  };

  // Delete commodity
  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this commodity? This action cannot be undone.')) {
      setCommodities(prev => prev.filter(c => c.id !== id));
    }
  };

  // Filter commodities
  const filteredCommodities = commodities.filter(commodity => {
    const matchesSearch = commodity.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || commodity.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && commodity.isActive) ||
      (statusFilter === 'inactive' && !commodity.isActive);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const formatCurrency = (amount: number) => `₦${amount.toLocaleString()}`;

  const getCategoryIcon = (categoryId: string) => {
    const category = CATEGORIES.find(c => c.id === categoryId);
    return category?.icon || Package;
  };

  const getCategoryColor = (categoryId: string) => {
    const category = CATEGORIES.find(c => c.id === categoryId);
    return category?.color || '#6b7280';
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Commodities Management</h1>
          <p className="text-gray-400 text-sm">Add items, set baseline prices, and configure fraud thresholds</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live Data
            <span className="text-gray-500">Updated {formatTimeAgo(lastUpdated)}</span>
          </div>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1f2e] border border-gray-700 rounded-lg hover:bg-[#252b3b] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <div className="px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg text-green-500 text-sm font-medium">
            SUPER ADMIN
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">TOTAL ITEMS</span>
            <Package className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold">{stats.totalItems}</p>
          <p className="text-xs text-gray-500">{stats.activeItems} active</p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">CATEGORIES</span>
            <Scale className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{stats.categoriesCount}</p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">AVG PRICE CHANGE (7D)</span>
            <TrendingUp className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-green-500">+{stats.avgPriceChange}%</p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">SUBMISSIONS TODAY</span>
            <DollarSign className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold">3,842</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">7-Day Price Changes</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priceChanges} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="item" stroke="#9ca3af" width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #374151' }}
                  formatter={(value: number) => [`${value > 0 ? '+' : ''}${value}%`, 'Change']}
                />
                <Bar
                  dataKey="change"
                  radius={[0, 4, 4, 0]}
                  fill="#22c55e"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">By Category</h3>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #374151' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {categoryDistribution.map((c) => (
              <div key={c.name} className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-gray-400">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-green-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-[#1a1f2e] border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#1a1f2e] border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Commodities Table */}
      <div className="bg-[#1a1f2e] rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-gray-400 text-sm font-medium p-4">ITEM</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">CATEGORY</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">AVG PRICE</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">RANGE</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">7D CHANGE</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">TODAY</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">STATUS</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredCommodities.map((commodity) => {
              const CategoryIcon = getCategoryIcon(commodity.category);
              return (
                <tr key={commodity.id} className="border-b border-gray-800/50 hover:bg-[#252b3b]/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${getCategoryColor(commodity.category)}20` }}
                      >
                        <CategoryIcon className="w-5 h-5" style={{ color: getCategoryColor(commodity.category) }} />
                      </div>
                      <div>
                        <p className="font-medium">{commodity.name}</p>
                        <p className="text-xs text-gray-500">{commodity.unit}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${getCategoryColor(commodity.category)}20`,
                        color: getCategoryColor(commodity.category)
                      }}
                    >
                      {CATEGORIES.find(c => c.id === commodity.category)?.name || commodity.category}
                    </span>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-green-500">{formatCurrency(commodity.avgPrice)}</p>
                    <p className="text-xs text-gray-500">{commodity.baselinePrices.length} markets</p>
                  </td>
                  <td className="p-4">
                    <p className="text-sm">{formatCurrency(commodity.priceRangeMin)} - {formatCurrency(commodity.priceRangeMax)}</p>
                    <p className="text-xs text-gray-500">±{commodity.varianceThreshold}% threshold</p>
                  </td>
                  <td className="p-4">
                    <div className={`flex items-center gap-1 ${commodity.priceChange7d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {commodity.priceChange7d >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {commodity.priceChange7d >= 0 ? '+' : ''}{commodity.priceChange7d}%
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="font-medium">{commodity.submissionsToday}</p>
                    <p className="text-xs text-gray-500">submissions</p>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleCommodityStatus(commodity.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        commodity.isActive
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-red-500/20 text-red-500'
                      }`}
                    >
                      {commodity.isActive ? (
                        <>
                          <ToggleRight className="w-4 h-4" /> Active
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4" /> Inactive
                        </>
                      )}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openViewModal(commodity)}
                        className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => openBaselineModal(commodity)}
                        className="p-1.5 hover:bg-green-500/20 rounded-lg transition-colors"
                        title="Set Baseline"
                      >
                        <DollarSign className="w-4 h-4 text-green-500" />
                      </button>
                      <button
                        onClick={() => openEditModal(commodity)}
                        className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(commodity.id)}
                        className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (modalMode === 'add' || modalMode === 'edit') && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1f2e] rounded-2xl w-full max-w-lg border border-gray-800 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div>
                <h2 className="text-xl font-bold">
                  {modalMode === 'add' ? 'Add New Item' : 'Edit Item'}
                </h2>
                <p className="text-sm text-gray-400">
                  {modalMode === 'add' ? 'Add a new commodity to track' : 'Update item details'}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Item Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                  placeholder="e.g., Rice (50kg)"
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                  >
                    <option value="">Select Category</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                  >
                    <option value="">Select Unit</option>
                    {UNITS.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Min Price (₦)</label>
                  <input
                    type="number"
                    value={formData.priceRangeMin}
                    onChange={(e) => setFormData(prev => ({ ...prev, priceRangeMin: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                    placeholder="50000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Max Price (₦)</label>
                  <input
                    type="number"
                    value={formData.priceRangeMax}
                    onChange={(e) => setFormData(prev => ({ ...prev, priceRangeMax: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                    placeholder="95000"
                  />
                </div>
              </div>

              {/* Variance Threshold */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Variance Threshold (%)</label>
                <input
                  type="number"
                  value={formData.varianceThreshold}
                  onChange={(e) => setFormData(prev => ({ ...prev, varianceThreshold: e.target.value }))}
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                  placeholder="30"
                />
                <p className="text-xs text-gray-500 mt-1">Prices outside this % from baseline will be flagged for fraud</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {modalMode === 'add' ? 'Add Item' : 'Save Changes'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Baseline Modal */}
      {showModal && modalMode === 'baseline' && selectedCommodity && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1f2e] rounded-2xl w-full max-w-lg border border-gray-800 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div>
                <h2 className="text-xl font-bold">Set Baseline Price</h2>
                <p className="text-sm text-gray-400">{selectedCommodity.name}</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Current Baselines */}
            {selectedCommodity.baselinePrices.length > 0 && (
              <div className="p-6 border-b border-gray-800">
                <p className="text-sm text-gray-400 mb-2">Current Baselines:</p>
                <div className="space-y-2">
                  {selectedCommodity.baselinePrices.map(bp => (
                    <div key={bp.marketId} className="flex justify-between items-center bg-[#0d1117] rounded-lg px-3 py-2">
                      <span className="text-sm">{bp.marketName}</span>
                      <span className="font-medium text-green-500">{formatCurrency(bp.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Select Market</label>
                <select
                  value={baselineForm.marketId}
                  onChange={(e) => setBaselineForm(prev => ({ ...prev, marketId: e.target.value }))}
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                >
                  <option value="">Select Market</option>
                  <option value="mile12">Mile 12 Market</option>
                  <option value="onitsha">Onitsha Main Market</option>
                  <option value="ariaria">Ariaria Market</option>
                  <option value="wuse">Wuse Market</option>
                  <option value="kano">Kano Main Market</option>
                  <option value="alaba">Alaba Market</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Baseline Price (₦)</label>
                <input
                  type="number"
                  value={baselineForm.price}
                  onChange={(e) => setBaselineForm(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                  placeholder="Enter baseline price"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 text-gray-400 hover:text-white transition-colors"
              >
                Done
              </button>
              <button
                onClick={handleBaselineSubmit}
                disabled={isSubmitting || !baselineForm.marketId || !baselineForm.price}
                className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add Baseline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showModal && modalMode === 'view' && selectedCommodity && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1f2e] rounded-2xl w-full max-w-lg border border-gray-800 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div>
                <h2 className="text-xl font-bold">{selectedCommodity.name}</h2>
                <p className="text-sm text-gray-400">{selectedCommodity.unit}</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0d1117] rounded-lg p-3">
                  <p className="text-gray-500 text-xs">AVERAGE PRICE</p>
                  <p className="font-medium text-green-500">{formatCurrency(selectedCommodity.avgPrice)}</p>
                </div>
                <div className="bg-[#0d1117] rounded-lg p-3">
                  <p className="text-gray-500 text-xs">7D CHANGE</p>
                  <p className={`font-medium ${selectedCommodity.priceChange7d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {selectedCommodity.priceChange7d >= 0 ? '+' : ''}{selectedCommodity.priceChange7d}%
                  </p>
                </div>
              </div>

              <div className="bg-[#0d1117] rounded-lg p-3">
                <p className="text-gray-500 text-xs">PRICE RANGE</p>
                <p className="font-medium">{formatCurrency(selectedCommodity.priceRangeMin)} - {formatCurrency(selectedCommodity.priceRangeMax)}</p>
                <p className="text-xs text-gray-500">Variance threshold: ±{selectedCommodity.varianceThreshold}%</p>
              </div>

              <div className="bg-[#0d1117] rounded-lg p-3">
                <p className="text-gray-500 text-xs mb-2">BASELINE PRICES BY MARKET</p>
                {selectedCommodity.baselinePrices.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCommodity.baselinePrices.map(bp => (
                      <div key={bp.marketId} className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">{bp.marketName}</span>
                        <span className="font-medium">{formatCurrency(bp.price)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No baseline prices set</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0d1117] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-500">{selectedCommodity.submissionsToday}</p>
                  <p className="text-xs text-gray-500">Submissions Today</p>
                </div>
                <div className="bg-[#0d1117] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-500">{selectedCommodity.baselinePrices.length}</p>
                  <p className="text-xs text-gray-500">Markets Tracked</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
              <button
                onClick={() => {
                  setShowModal(false);
                  openEditModal(selectedCommodity);
                }}
                className="px-6 py-2.5 bg-[#0d1117] border border-gray-700 text-white rounded-lg font-medium transition-colors hover:bg-[#252b3b] flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
