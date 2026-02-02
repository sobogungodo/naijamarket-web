'use client';

import { useState, useCallback } from 'react';
import {
  MapPin, Search, RefreshCw, Download, Plus, Edit2, Trash2,
  Eye, ToggleLeft, ToggleRight, Users, Clock,
  X, Loader2, CheckCircle, Building2, Map
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// Types
interface Market {
  id: string;
  name: string;
  state: string;
  lga: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  operatingHours: {
    open: string;
    close: string;
    days: string[];
  };
  tradersCount: number;
  validatorsCount: number;
  submissionsToday: number;
  isActive: boolean;
  createdAt: Date;
}

// Nigerian States
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Mock data
const generateMockMarkets = (): Market[] => [
  {
    id: 'mile12',
    name: 'Mile 12 Market',
    state: 'Lagos',
    lga: 'Kosofe',
    address: 'Mile 12, Lagos-Ibadan Expressway',
    latitude: 6.5833,
    longitude: 3.3958,
    radiusMeters: 500,
    operatingHours: { open: '06:00', close: '18:00', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
    tradersCount: 1245,
    validatorsCount: 89,
    submissionsToday: 456,
    isActive: true,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'onitsha',
    name: 'Onitsha Main Market',
    state: 'Anambra',
    lga: 'Onitsha North',
    address: 'Main Market Road, Onitsha',
    latitude: 6.1453,
    longitude: 6.7867,
    radiusMeters: 600,
    operatingHours: { open: '07:00', close: '19:00', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
    tradersCount: 987,
    validatorsCount: 67,
    submissionsToday: 312,
    isActive: true,
    createdAt: new Date('2024-01-20'),
  },
  {
    id: 'ariaria',
    name: 'Ariaria International Market',
    state: 'Abia',
    lga: 'Aba South',
    address: 'Ariaria, Aba',
    latitude: 5.1067,
    longitude: 7.3667,
    radiusMeters: 700,
    operatingHours: { open: '06:30', close: '18:30', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    tradersCount: 756,
    validatorsCount: 45,
    submissionsToday: 234,
    isActive: true,
    createdAt: new Date('2024-02-01'),
  },
  {
    id: 'wuse',
    name: 'Wuse Market',
    state: 'FCT',
    lga: 'Abuja Municipal',
    address: 'Wuse Zone 5, Abuja',
    latitude: 9.0765,
    longitude: 7.4985,
    radiusMeters: 400,
    operatingHours: { open: '07:00', close: '20:00', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    tradersCount: 543,
    validatorsCount: 38,
    submissionsToday: 189,
    isActive: true,
    createdAt: new Date('2024-02-10'),
  },
  {
    id: 'kano',
    name: 'Kano Main Market (Kurmi)',
    state: 'Kano',
    lga: 'Kano Municipal',
    address: 'Kurmi Market, Kano City',
    latitude: 12.0022,
    longitude: 8.5127,
    radiusMeters: 550,
    operatingHours: { open: '06:00', close: '18:00', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
    tradersCount: 678,
    validatorsCount: 52,
    submissionsToday: 267,
    isActive: true,
    createdAt: new Date('2024-02-15'),
  },
  {
    id: 'alaba',
    name: 'Alaba International Market',
    state: 'Lagos',
    lga: 'Ojo',
    address: 'Alaba, Ojo, Lagos',
    latitude: 6.4698,
    longitude: 3.1963,
    radiusMeters: 600,
    operatingHours: { open: '08:00', close: '18:00', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
    tradersCount: 432,
    validatorsCount: 31,
    submissionsToday: 145,
    isActive: false,
    createdAt: new Date('2024-03-01'),
  },
];

const stateDistribution = [
  { name: 'Lagos', value: 45, color: '#22c55e' },
  { name: 'Anambra', value: 18, color: '#eab308' },
  { name: 'Kano', value: 15, color: '#3b82f6' },
  { name: 'FCT', value: 12, color: '#a855f7' },
  { name: 'Others', value: 10, color: '#6b7280' },
];

// Inline export function
function exportMarketsToCSV(markets: Market[]) {
  const headers = ['ID', 'Name', 'State', 'LGA', 'Address', 'Latitude', 'Longitude', 'Radius (m)', 'Traders', 'Validators', 'Active'];
  const rows = markets.map(m => [
    m.id,
    m.name,
    m.state,
    m.lga,
    m.address,
    m.latitude,
    m.longitude,
    m.radiusMeters,
    m.tradersCount,
    m.validatorsCount,
    m.isActive ? 'Yes' : 'No'
  ]);
  
  const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `markets_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>(generateMockMarkets());
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    state: '',
    lga: '',
    address: '',
    latitude: '',
    longitude: '',
    radiusMeters: '500',
    openTime: '06:00',
    closeTime: '18:00',
    operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as string[],
  });

  // Stats
  const stats = {
    totalMarkets: 226,
    activeMarkets: 218,
    totalTraders: 8432,
    totalSubmissionsToday: 3842,
  };

  // Refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setMarkets(generateMockMarkets());
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
      state: '',
      lga: '',
      address: '',
      latitude: '',
      longitude: '',
      radiusMeters: '500',
      openTime: '06:00',
      closeTime: '18:00',
      operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    });
    setModalMode('add');
    setShowModal(true);
  };

  // Open edit modal
  const openEditModal = (market: Market) => {
    setSelectedMarket(market);
    setFormData({
      name: market.name,
      state: market.state,
      lga: market.lga,
      address: market.address,
      latitude: market.latitude.toString(),
      longitude: market.longitude.toString(),
      radiusMeters: market.radiusMeters.toString(),
      openTime: market.operatingHours.open,
      closeTime: market.operatingHours.close,
      operatingDays: market.operatingHours.days,
    });
    setModalMode('edit');
    setShowModal(true);
  };

  // Open view modal
  const openViewModal = (market: Market) => {
    setSelectedMarket(market);
    setModalMode('view');
    setShowModal(true);
  };

  // Handle form submit
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (modalMode === 'add') {
        const newMarket: Market = {
          id: `market_${Date.now()}`,
          name: formData.name,
          state: formData.state,
          lga: formData.lga,
          address: formData.address,
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          radiusMeters: parseInt(formData.radiusMeters),
          operatingHours: {
            open: formData.openTime,
            close: formData.closeTime,
            days: formData.operatingDays,
          },
          tradersCount: 0,
          validatorsCount: 0,
          submissionsToday: 0,
          isActive: true,
          createdAt: new Date(),
        };
        setMarkets(prev => [newMarket, ...prev]);
      } else if (modalMode === 'edit' && selectedMarket) {
        setMarkets(prev => prev.map(m =>
          m.id === selectedMarket.id
            ? {
                ...m,
                name: formData.name,
                state: formData.state,
                lga: formData.lga,
                address: formData.address,
                latitude: parseFloat(formData.latitude),
                longitude: parseFloat(formData.longitude),
                radiusMeters: parseInt(formData.radiusMeters),
                operatingHours: {
                  open: formData.openTime,
                  close: formData.closeTime,
                  days: formData.operatingDays,
                },
              }
            : m
        ));
      }

      setShowModal(false);
    } catch (error) {
      console.error('Error saving market:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle market status
  const toggleMarketStatus = async (id: string) => {
    setMarkets(prev => prev.map(m =>
      m.id === id ? { ...m, isActive: !m.isActive } : m
    ));
  };

  // Delete market
  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this market? This action cannot be undone.')) {
      setMarkets(prev => prev.filter(m => m.id !== id));
    }
  };

  // Toggle operating day
  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      operatingDays: prev.operatingDays.includes(day)
        ? prev.operatingDays.filter(d => d !== day)
        : [...prev.operatingDays, day],
    }));
  };

  // Filter markets
  const filteredMarkets = markets.filter(market => {
    const matchesSearch =
      market.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      market.state.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesState = stateFilter === 'all' || market.state === stateFilter;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && market.isActive) ||
      (statusFilter === 'inactive' && !market.isActive);
    return matchesSearch && matchesState && matchesStatus;
  });

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Markets Management</h1>
          <p className="text-gray-400 text-sm">Add, edit, and manage market locations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live Data
            <span className="text-gray-500">Updated {formatTimeAgo(lastUpdated)}</span>
          </div>

          <button
            onClick={() => exportMarketsToCSV(markets)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1f2e] border border-gray-700 rounded-lg hover:bg-[#252b3b] transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Market
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
            <span className="text-gray-400 text-xs">TOTAL MARKETS</span>
            <MapPin className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold">{stats.totalMarkets}</p>
          <p className="text-xs text-gray-500">{stats.activeMarkets} active</p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">TOTAL TRADERS</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{stats.totalTraders.toLocaleString()}</p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">SUBMISSIONS TODAY</span>
            <Building2 className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold">{stats.totalSubmissionsToday.toLocaleString()}</p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">STATES COVERED</span>
            <Map className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold">37</p>
        </div>
      </div>

      {/* Chart */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">Market Locations</h3>
          <div className="h-64 bg-[#0d1117] rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Map className="w-12 h-12 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500">Interactive map coming soon</p>
              <p className="text-xs text-gray-600">Google Maps integration</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">Markets by State</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stateDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {stateDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #374151' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {stateDistribution.map((s) => (
              <div key={s.name} className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-gray-400">{s.name}</span>
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
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-green-500"
          />
        </div>

        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="bg-[#1a1f2e] border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500"
        >
          <option value="all">All States</option>
          {NIGERIAN_STATES.map(state => (
            <option key={state} value={state}>{state}</option>
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

      {/* Markets Table */}
      <div className="bg-[#1a1f2e] rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-gray-400 text-sm font-medium p-4">MARKET</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">LOCATION</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">GPS</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">HOURS</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">TRADERS</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">TODAY</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">STATUS</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredMarkets.map((market) => (
              <tr key={market.id} className="border-b border-gray-800/50 hover:bg-[#252b3b]/50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">{market.name}</p>
                      <p className="text-xs text-gray-500">{market.id}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <p className="text-sm">{market.state}</p>
                  <p className="text-xs text-gray-500">{market.lga}</p>
                </td>
                <td className="p-4">
                  <p className="text-xs text-gray-400">{market.latitude.toFixed(4)}, {market.longitude.toFixed(4)}</p>
                  <p className="text-xs text-gray-500">Radius: {market.radiusMeters}m</p>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1 text-sm">
                    <Clock className="w-3 h-3 text-gray-500" />
                    {market.operatingHours.open} - {market.operatingHours.close}
                  </div>
                </td>
                <td className="p-4">
                  <p className="font-medium">{market.tradersCount.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{market.validatorsCount} validators</p>
                </td>
                <td className="p-4">
                  <p className="font-medium text-green-500">{market.submissionsToday}</p>
                  <p className="text-xs text-gray-500">submissions</p>
                </td>
                <td className="p-4">
                  <button
                    onClick={() => toggleMarketStatus(market.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      market.isActive
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-red-500/20 text-red-500'
                    }`}
                  >
                    {market.isActive ? (
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
                      onClick={() => openViewModal(market)}
                      className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                      title="View"
                    >
                      <Eye className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => openEditModal(market)}
                      className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(market.id)}
                      className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (modalMode === 'add' || modalMode === 'edit') && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1f2e] rounded-2xl w-full max-w-2xl border border-gray-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-[#1a1f2e]">
              <div>
                <h2 className="text-xl font-bold">
                  {modalMode === 'add' ? 'Add New Market' : 'Edit Market'}
                </h2>
                <p className="text-sm text-gray-400">
                  {modalMode === 'add' ? 'Add a new market location' : 'Update market details'}
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
              {/* Market Name */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Market Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                  placeholder="e.g., Mile 12 Market"
                />
              </div>

              {/* State & LGA */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">State</label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                  >
                    <option value="">Select State</option>
                    {NIGERIAN_STATES.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">LGA</label>
                  <input
                    type="text"
                    value={formData.lga}
                    onChange={(e) => setFormData(prev => ({ ...prev, lga: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                    placeholder="Local Government Area"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                  placeholder="Full address"
                />
              </div>

              {/* GPS Coordinates */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Latitude</label>
                  <input
                    type="text"
                    value={formData.latitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                    placeholder="6.5833"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Longitude</label>
                  <input
                    type="text"
                    value={formData.longitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                    placeholder="3.3958"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Radius (meters)</label>
                  <input
                    type="text"
                    value={formData.radiusMeters}
                    onChange={(e) => setFormData(prev => ({ ...prev, radiusMeters: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                    placeholder="500"
                  />
                </div>
              </div>

              {/* Operating Hours */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Opening Time</label>
                  <input
                    type="time"
                    value={formData.openTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, openTime: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Closing Time</label>
                  <input
                    type="time"
                    value={formData.closeTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, closeTime: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>

              {/* Operating Days */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Operating Days</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        formData.operatingDays.includes(day)
                          ? 'bg-green-500 text-white'
                          : 'bg-[#0d1117] text-gray-400 border border-gray-700'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
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
                    {modalMode === 'add' ? 'Add Market' : 'Save Changes'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showModal && modalMode === 'view' && selectedMarket && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1f2e] rounded-2xl w-full max-w-lg border border-gray-800 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div>
                <h2 className="text-xl font-bold">{selectedMarket.name}</h2>
                <p className="text-sm text-gray-400">{selectedMarket.id}</p>
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
                  <p className="text-gray-500 text-xs">STATE</p>
                  <p className="font-medium">{selectedMarket.state}</p>
                </div>
                <div className="bg-[#0d1117] rounded-lg p-3">
                  <p className="text-gray-500 text-xs">LGA</p>
                  <p className="font-medium">{selectedMarket.lga}</p>
                </div>
              </div>

              <div className="bg-[#0d1117] rounded-lg p-3">
                <p className="text-gray-500 text-xs">ADDRESS</p>
                <p className="font-medium">{selectedMarket.address}</p>
              </div>

              <div className="bg-[#0d1117] rounded-lg p-3">
                <p className="text-gray-500 text-xs">GPS COORDINATES</p>
                <p className="font-medium">{selectedMarket.latitude}, {selectedMarket.longitude}</p>
                <p className="text-xs text-gray-500">Radius: {selectedMarket.radiusMeters}m</p>
              </div>

              <div className="bg-[#0d1117] rounded-lg p-3">
                <p className="text-gray-500 text-xs">OPERATING HOURS</p>
                <p className="font-medium">{selectedMarket.operatingHours.open} - {selectedMarket.operatingHours.close}</p>
                <p className="text-xs text-gray-500">{selectedMarket.operatingHours.days.join(', ')}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#0d1117] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-500">{selectedMarket.tradersCount}</p>
                  <p className="text-xs text-gray-500">Traders</p>
                </div>
                <div className="bg-[#0d1117] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-500">{selectedMarket.validatorsCount}</p>
                  <p className="text-xs text-gray-500">Validators</p>
                </div>
                <div className="bg-[#0d1117] rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-500">{selectedMarket.submissionsToday}</p>
                  <p className="text-xs text-gray-500">Today</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
              <button
                onClick={() => {
                  setShowModal(false);
                  openEditModal(selectedMarket);
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
