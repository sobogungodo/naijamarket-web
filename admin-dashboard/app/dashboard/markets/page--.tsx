'use client';

import React, { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPin,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  FileText,
  Navigation,
  X,
  Save,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Building,
  Globe,
  Phone,
} from 'lucide-react';

// ============================================
// DYNAMIC RECHARTS IMPORTS (SSR-SAFE)
// ============================================
const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false });

// ============================================
// TYPES
// ============================================
interface Market {
  id: string;
  name: string;
  state: string;
  city: string;
  latitude: number;
  longitude: number;
  gpsRadius: number;
  operatingHours: string;
  isActive: boolean;
  tradersCount: number;
  validatorsCount: number;
  submissionsToday: number;
  submissionsWeek: number;
  avgPriceAccuracy: number;
  contactPhone: string;
  createdAt: string;
  lastActivityAt: string;
}

interface MarketFormData {
  name: string;
  state: string;
  city: string;
  latitude: string;
  longitude: string;
  gpsRadius: string;
  operatingHours: string;
  contactPhone: string;
}

// ============================================
// MOCK DATA
// ============================================
const nigerianStates = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

const initialMarketsData: Market[] = [
  {
    id: 'MKT-001',
    name: 'Mile 12 Market',
    state: 'Lagos',
    city: 'Kosofe',
    latitude: 6.5833,
    longitude: 3.3833,
    gpsRadius: 500,
    operatingHours: '6:00 AM - 8:00 PM',
    isActive: true,
    tradersCount: 245,
    validatorsCount: 48,
    submissionsToday: 156,
    submissionsWeek: 1245,
    avgPriceAccuracy: 94.5,
    contactPhone: '08012345678',
    createdAt: '2024-01-15',
    lastActivityAt: '2 min ago',
  },
  {
    id: 'MKT-002',
    name: 'Onitsha Main Market',
    state: 'Anambra',
    city: 'Onitsha',
    latitude: 6.1319,
    longitude: 6.7857,
    gpsRadius: 750,
    operatingHours: '7:00 AM - 7:00 PM',
    isActive: true,
    tradersCount: 312,
    validatorsCount: 65,
    submissionsToday: 189,
    submissionsWeek: 1567,
    avgPriceAccuracy: 92.3,
    contactPhone: '08023456789',
    createdAt: '2024-01-20',
    lastActivityAt: '5 min ago',
  },
  {
    id: 'MKT-003',
    name: 'Wuse Market',
    state: 'FCT',
    city: 'Abuja',
    latitude: 9.0579,
    longitude: 7.4951,
    gpsRadius: 400,
    operatingHours: '8:00 AM - 6:00 PM',
    isActive: true,
    tradersCount: 178,
    validatorsCount: 35,
    submissionsToday: 98,
    submissionsWeek: 845,
    avgPriceAccuracy: 96.1,
    contactPhone: '08034567890',
    createdAt: '2024-02-01',
    lastActivityAt: '8 min ago',
  },
  {
    id: 'MKT-004',
    name: 'Alaba International Market',
    state: 'Lagos',
    city: 'Ojo',
    latitude: 6.4698,
    longitude: 3.1963,
    gpsRadius: 600,
    operatingHours: '7:00 AM - 8:00 PM',
    isActive: true,
    tradersCount: 425,
    validatorsCount: 82,
    submissionsToday: 234,
    submissionsWeek: 1892,
    avgPriceAccuracy: 91.8,
    contactPhone: '08045678901',
    createdAt: '2024-01-10',
    lastActivityAt: '1 min ago',
  },
  {
    id: 'MKT-005',
    name: 'Kano Main Market',
    state: 'Kano',
    city: 'Kano',
    latitude: 12.0022,
    longitude: 8.5920,
    gpsRadius: 800,
    operatingHours: '6:00 AM - 7:00 PM',
    isActive: true,
    tradersCount: 289,
    validatorsCount: 58,
    submissionsToday: 145,
    submissionsWeek: 1123,
    avgPriceAccuracy: 93.7,
    contactPhone: '08056789012',
    createdAt: '2024-02-15',
    lastActivityAt: '12 min ago',
  },
  {
    id: 'MKT-006',
    name: 'Ariaria Market',
    state: 'Abia',
    city: 'Aba',
    latitude: 5.1066,
    longitude: 7.3667,
    gpsRadius: 550,
    operatingHours: '6:30 AM - 7:30 PM',
    isActive: true,
    tradersCount: 356,
    validatorsCount: 72,
    submissionsToday: 178,
    submissionsWeek: 1456,
    avgPriceAccuracy: 90.2,
    contactPhone: '08067890123',
    createdAt: '2024-01-25',
    lastActivityAt: '3 min ago',
  },
  {
    id: 'MKT-007',
    name: 'Iddo Market',
    state: 'Lagos',
    city: 'Lagos Island',
    latitude: 6.4631,
    longitude: 3.3869,
    gpsRadius: 350,
    operatingHours: '6:00 AM - 6:00 PM',
    isActive: false,
    tradersCount: 98,
    validatorsCount: 18,
    submissionsToday: 0,
    submissionsWeek: 234,
    avgPriceAccuracy: 88.5,
    contactPhone: '08078901234',
    createdAt: '2024-03-01',
    lastActivityAt: '2 days ago',
  },
  {
    id: 'MKT-008',
    name: 'Jos Main Market',
    state: 'Plateau',
    city: 'Jos',
    latitude: 9.8965,
    longitude: 8.8583,
    gpsRadius: 450,
    operatingHours: '7:00 AM - 6:00 PM',
    isActive: true,
    tradersCount: 145,
    validatorsCount: 28,
    submissionsToday: 67,
    submissionsWeek: 534,
    avgPriceAccuracy: 95.2,
    contactPhone: '08089012345',
    createdAt: '2024-02-20',
    lastActivityAt: '15 min ago',
  },
];

const marketActivityData = [
  { name: 'Mile 12', submissions: 156, traders: 245 },
  { name: 'Onitsha', submissions: 189, traders: 312 },
  { name: 'Wuse', submissions: 98, traders: 178 },
  { name: 'Alaba', submissions: 234, traders: 425 },
  { name: 'Kano', submissions: 145, traders: 289 },
  { name: 'Ariaria', submissions: 178, traders: 356 },
  { name: 'Jos', submissions: 67, traders: 145 },
];

const stateDistribution = [
  { name: 'Lagos', value: 3, color: '#10b981' },
  { name: 'Others', value: 5, color: '#3b82f6' },
];

// ============================================
// HELPER FUNCTIONS
// ============================================
const formatCoordinate = (coord: number, type: 'lat' | 'lng') => {
  const direction = type === 'lat' 
    ? (coord >= 0 ? 'N' : 'S')
    : (coord >= 0 ? 'E' : 'W');
  return `${Math.abs(coord).toFixed(4)}° ${direction}`;
};

// ============================================
// CSV EXPORT FUNCTION
// ============================================
const exportToCSV = (data: Market[], filename: string) => {
  const headers = [
    'ID', 'Name', 'State', 'City', 'Latitude', 'Longitude', 'GPS Radius (m)',
    'Operating Hours', 'Status', 'Traders', 'Validators', 'Submissions Today',
    'Submissions Week', 'Accuracy (%)', 'Contact', 'Created'
  ];

  const csvRows = data.map(market => [
    market.id,
    market.name,
    market.state,
    market.city,
    market.latitude,
    market.longitude,
    market.gpsRadius,
    market.operatingHours,
    market.isActive ? 'Active' : 'Inactive',
    market.tradersCount,
    market.validatorsCount,
    market.submissionsToday,
    market.submissionsWeek,
    market.avgPriceAccuracy,
    market.contactPhone,
    market.createdAt
  ]);

  const csvContent = [
    headers.join(','),
    ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function MarketsPage() {
  const [marketsData, setMarketsData] = useState<Market[]>(initialMarketsData);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('All States');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<MarketFormData>({
    name: '',
    state: '',
    city: '',
    latitude: '',
    longitude: '',
    gpsRadius: '500',
    operatingHours: '6:00 AM - 6:00 PM',
    contactPhone: '',
  });
  const itemsPerPage = 5;

  // Filter markets
  const filteredMarkets = useMemo(() => {
    return marketsData.filter(market => {
      const matchesSearch = 
        market.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        market.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        market.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesState = selectedState === 'All States' || market.state === selectedState;
      const matchesStatus = selectedStatus === 'All' || 
        (selectedStatus === 'Active' && market.isActive) ||
        (selectedStatus === 'Inactive' && !market.isActive);
      return matchesSearch && matchesState && matchesStatus;
    });
  }, [marketsData, searchTerm, selectedState, selectedStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredMarkets.length / itemsPerPage);
  const paginatedMarkets = filteredMarkets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats calculations
  const stats = useMemo(() => ({
    totalMarkets: marketsData.length,
    activeMarkets: marketsData.filter(m => m.isActive).length,
    totalTraders: marketsData.reduce((sum, m) => sum + m.tradersCount, 0),
    totalSubmissionsToday: marketsData.reduce((sum, m) => sum + m.submissionsToday, 0),
    avgAccuracy: (marketsData.reduce((sum, m) => sum + m.avgPriceAccuracy, 0) / marketsData.length).toFixed(1),
  }), [marketsData]);

  // Unique states for filter
  const uniqueStates = useMemo(() => {
    const states = [...new Set(marketsData.map(m => m.state))];
    return ['All States', ...states.sort()];
  }, [marketsData]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  }, []);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    exportToCSV(filteredMarkets, 'markets');
    setIsExporting(false);
  }, [filteredMarkets]);

  const handleToggleStatus = useCallback((id: string) => {
    setMarketsData(prev => 
      prev.map(market => 
        market.id === id 
          ? { ...market, isActive: !market.isActive }
          : market
      )
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (!confirm('Are you sure you want to delete this market? This action cannot be undone.')) {
      return;
    }
    setMarketsData(prev => prev.filter(market => market.id !== id));
  }, []);

  const handleOpenModal = useCallback((market?: Market) => {
    if (market) {
      setEditingMarket(market);
      setFormData({
        name: market.name,
        state: market.state,
        city: market.city,
        latitude: market.latitude.toString(),
        longitude: market.longitude.toString(),
        gpsRadius: market.gpsRadius.toString(),
        operatingHours: market.operatingHours,
        contactPhone: market.contactPhone,
      });
    } else {
      setEditingMarket(null);
      setFormData({
        name: '',
        state: '',
        city: '',
        latitude: '',
        longitude: '',
        gpsRadius: '500',
        operatingHours: '6:00 AM - 6:00 PM',
        contactPhone: '',
      });
    }
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setEditingMarket(null);
  }, []);

  const handleSaveMarket = useCallback(async () => {
    // Validation
    if (!formData.name || !formData.state || !formData.city || !formData.latitude || !formData.longitude) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 800));

    if (editingMarket) {
      // Update existing
      setMarketsData(prev => 
        prev.map(market => 
          market.id === editingMarket.id
            ? {
                ...market,
                name: formData.name,
                state: formData.state,
                city: formData.city,
                latitude: parseFloat(formData.latitude),
                longitude: parseFloat(formData.longitude),
                gpsRadius: parseInt(formData.gpsRadius),
                operatingHours: formData.operatingHours,
                contactPhone: formData.contactPhone,
              }
            : market
        )
      );
    } else {
      // Add new
      const newMarket: Market = {
        id: `MKT-${String(marketsData.length + 1).padStart(3, '0')}`,
        name: formData.name,
        state: formData.state,
        city: formData.city,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        gpsRadius: parseInt(formData.gpsRadius),
        operatingHours: formData.operatingHours,
        isActive: true,
        tradersCount: 0,
        validatorsCount: 0,
        submissionsToday: 0,
        submissionsWeek: 0,
        avgPriceAccuracy: 0,
        contactPhone: formData.contactPhone,
        createdAt: new Date().toISOString().split('T')[0],
        lastActivityAt: 'Never',
      };
      setMarketsData(prev => [...prev, newMarket]);
    }

    setIsSaving(false);
    handleCloseModal();
  }, [formData, editingMarket, marketsData.length, handleCloseModal]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="h-16 bg-dash-card border-b border-dash-border px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-dash-text">Markets Management</h1>
          <p className="text-sm text-dash-muted">Manage market locations and GPS coordinates</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-dash-bg border border-dash-border hover:bg-dash-hover transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 text-dash-muted animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 text-dash-muted" />
            )}
          </button>
          
          <button 
            onClick={handleExport}
            disabled={isExporting || filteredMarkets.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dash-bg border border-dash-border hover:bg-dash-hover transition-colors disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 text-dash-muted animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-dash-muted" />
            )}
            <span className="text-sm text-dash-muted hidden sm:block">Export</span>
          </button>

          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-naija-green-500 text-white hover:bg-naija-green-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Add Market</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-6">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Markets */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dash-muted mb-1">Total Markets</p>
                  <p className="text-3xl font-bold text-dash-text">{stats.totalMarkets}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-green-500">{stats.activeMarkets} active</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <MapPin className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </div>

            {/* Total Traders */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dash-muted mb-1">Registered Traders</p>
                  <p className="text-3xl font-bold text-dash-text">{stats.totalTraders.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-green-500">+8.2%</span>
                    <span className="text-xs text-dash-muted">this week</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10">
                  <Users className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </div>

            {/* Submissions Today */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dash-muted mb-1">Submissions Today</p>
                  <p className="text-3xl font-bold text-dash-text">{stats.totalSubmissionsToday.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-green-500">+15.3%</span>
                    <span className="text-xs text-dash-muted">vs yesterday</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10">
                  <FileText className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </div>

            {/* Average Accuracy */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dash-muted mb-1">Avg Price Accuracy</p>
                  <p className="text-3xl font-bold text-dash-text">{stats.avgAccuracy}%</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Navigation className="w-3 h-3 text-dash-muted" />
                    <span className="text-xs text-dash-muted">GPS verified</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-yellow-500/10">
                  <Navigation className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Market Activity Chart */}
            <div className="lg:col-span-2 rounded-xl border border-dash-border bg-dash-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-dash-text">Market Activity (Today)</h3>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-dash-muted">Submissions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-dash-muted">Traders</span>
                  </div>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marketActivityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1f2e',
                        border: '1px solid #2a2f3a',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="submissions" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="traders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* State Distribution Pie */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-5">
              <h3 className="font-semibold text-dash-text mb-4">Markets by State</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stateDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stateDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1f2e',
                        border: '1px solid #2a2f3a',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {stateDistribution.map((item) => (
                  <div key={item.name} className="flex items-center gap-1 text-xs">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-dash-muted">{item.name}</span>
                    <span className="text-dash-text font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-muted" />
              <input
                type="text"
                placeholder="Search by market name, city, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-dash-bg border border-dash-border text-dash-text placeholder-dash-muted focus:outline-none focus:border-naija-green-500 transition-colors"
              />
            </div>

            {/* State Filter */}
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-muted" />
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="pl-10 pr-8 py-2.5 rounded-lg bg-dash-bg border border-dash-border text-dash-text focus:outline-none focus:border-naija-green-500 transition-colors appearance-none cursor-pointer min-w-[160px]"
              >
                {uniqueStates.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-muted pointer-events-none" />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="pl-4 pr-8 py-2.5 rounded-lg bg-dash-bg border border-dash-border text-dash-text focus:outline-none focus:border-naija-green-500 transition-colors appearance-none cursor-pointer min-w-[120px]"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-muted pointer-events-none" />
            </div>
          </div>

          {/* Markets Table */}
          <div className="rounded-xl border border-dash-border bg-dash-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dash-bg border-b border-dash-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Market</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">GPS Coordinates</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Traders</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Today</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Accuracy</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-dash-muted uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border">
                  {paginatedMarkets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-dash-muted">
                        <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No markets found matching your filters</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedMarkets.map((market) => (
                      <tr key={market.id} className={`hover:bg-dash-hover transition-colors ${!market.isActive ? 'opacity-60' : ''}`}>
                        {/* Market Name */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${market.isActive ? 'bg-naija-green-500/10' : 'bg-gray-500/10'}`}>
                              <Building className={`w-5 h-5 ${market.isActive ? 'text-naija-green-500' : 'text-gray-500'}`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-dash-text">{market.name}</p>
                              <p className="text-xs text-dash-muted">{market.id}</p>
                            </div>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="px-4 py-4">
                          <div>
                            <p className="text-sm text-dash-text">{market.city}</p>
                            <p className="text-xs text-dash-muted">{market.state}</p>
                          </div>
                        </td>

                        {/* GPS */}
                        <td className="px-4 py-4">
                          <div className="text-xs font-mono">
                            <p className="text-dash-text">{formatCoordinate(market.latitude, 'lat')}</p>
                            <p className="text-dash-muted">{formatCoordinate(market.longitude, 'lng')}</p>
                          </div>
                        </td>

                        {/* Traders */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-dash-muted" />
                            <span className="text-sm text-dash-text">{market.tradersCount}</span>
                          </div>
                        </td>

                        {/* Submissions Today */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <FileText className="w-3 h-3 text-dash-muted" />
                            <span className="text-sm text-dash-text">{market.submissionsToday}</span>
                          </div>
                        </td>

                        {/* Accuracy */}
                        <td className="px-4 py-4">
                          <div className={`flex items-center gap-1 ${market.avgPriceAccuracy >= 90 ? 'text-green-500' : market.avgPriceAccuracy >= 80 ? 'text-yellow-500' : 'text-red-500'}`}>
                            <span className="text-sm font-medium">{market.avgPriceAccuracy}%</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${
                            market.isActive 
                              ? 'bg-green-500/10 text-green-500 border-green-500/30'
                              : 'bg-gray-500/10 text-gray-500 border-gray-500/30'
                          }`}>
                            {market.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenModal(market)}
                              className="p-1.5 rounded-lg hover:bg-dash-bg text-dash-muted hover:text-dash-text transition-colors"
                              title="Edit Market"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(market.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                market.isActive 
                                  ? 'hover:bg-yellow-500/10 text-dash-muted hover:text-yellow-500'
                                  : 'hover:bg-green-500/10 text-dash-muted hover:text-green-500'
                              }`}
                              title={market.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {market.isActive ? (
                                <ToggleRight className="w-4 h-4" />
                              ) : (
                                <ToggleLeft className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(market.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-dash-muted hover:text-red-500 transition-colors"
                              title="Delete Market"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-dash-border flex items-center justify-between">
              <p className="text-sm text-dash-muted">
                Showing {filteredMarkets.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredMarkets.length)} of {filteredMarkets.length} markets
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-dash-border hover:bg-dash-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-dash-muted" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-naija-green-500 text-white'
                        : 'border border-dash-border hover:bg-dash-hover text-dash-muted'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-2 rounded-lg border border-dash-border hover:bg-dash-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-dash-muted" />
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCloseModal}
          />
          
          {/* Modal */}
          <div className="relative w-full max-w-lg mx-4 bg-dash-card rounded-xl border border-dash-border shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-dash-border">
              <h2 className="text-lg font-semibold text-dash-text">
                {editingMarket ? 'Edit Market' : 'Add New Market'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1 rounded-lg hover:bg-dash-hover text-dash-muted hover:text-dash-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Market Name */}
              <div>
                <label className="block text-sm font-medium text-dash-text mb-1">
                  Market Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Mile 12 Market"
                  className="w-full px-3 py-2 rounded-lg bg-dash-bg border border-dash-border text-dash-text placeholder-dash-muted focus:outline-none focus:border-naija-green-500 transition-colors"
                />
              </div>

              {/* State & City */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dash-text mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-dash-bg border border-dash-border text-dash-text focus:outline-none focus:border-naija-green-500 transition-colors"
                  >
                    <option value="">Select State</option>
                    {nigerianStates.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dash-text mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="e.g., Kosofe"
                    className="w-full px-3 py-2 rounded-lg bg-dash-bg border border-dash-border text-dash-text placeholder-dash-muted focus:outline-none focus:border-naija-green-500 transition-colors"
                  />
                </div>
              </div>

              {/* GPS Coordinates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dash-text mb-1">
                    Latitude <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.latitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                    placeholder="e.g., 6.5833"
                    className="w-full px-3 py-2 rounded-lg bg-dash-bg border border-dash-border text-dash-text placeholder-dash-muted focus:outline-none focus:border-naija-green-500 transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dash-text mb-1">
                    Longitude <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.longitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                    placeholder="e.g., 3.3833"
                    className="w-full px-3 py-2 rounded-lg bg-dash-bg border border-dash-border text-dash-text placeholder-dash-muted focus:outline-none focus:border-naija-green-500 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* GPS Radius & Operating Hours */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dash-text mb-1">
                    GPS Radius (meters)
                  </label>
                  <input
                    type="number"
                    value={formData.gpsRadius}
                    onChange={(e) => setFormData(prev => ({ ...prev, gpsRadius: e.target.value }))}
                    placeholder="500"
                    className="w-full px-3 py-2 rounded-lg bg-dash-bg border border-dash-border text-dash-text placeholder-dash-muted focus:outline-none focus:border-naija-green-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dash-text mb-1">
                    Operating Hours
                  </label>
                  <input
                    type="text"
                    value={formData.operatingHours}
                    onChange={(e) => setFormData(prev => ({ ...prev, operatingHours: e.target.value }))}
                    placeholder="6:00 AM - 6:00 PM"
                    className="w-full px-3 py-2 rounded-lg bg-dash-bg border border-dash-border text-dash-text placeholder-dash-muted focus:outline-none focus:border-naija-green-500 transition-colors"
                  />
                </div>
              </div>

              {/* Contact Phone */}
              <div>
                <label className="block text-sm font-medium text-dash-text mb-1">
                  Contact Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-muted" />
                  <input
                    type="text"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                    placeholder="08012345678"
                    className="w-full pl-10 pr-3 py-2 rounded-lg bg-dash-bg border border-dash-border text-dash-text placeholder-dash-muted focus:outline-none focus:border-naija-green-500 transition-colors"
                  />
                </div>
              </div>

              {/* Info Box */}
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-blue-500 mt-0.5" />
                  <div className="text-xs text-dash-muted">
                    <p className="font-medium text-blue-400 mb-1">GPS Validation</p>
                    <p>Traders must be within the GPS radius to submit prices. A typical market radius is 300-800 meters.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-dash-border">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-lg border border-dash-border text-dash-muted hover:bg-dash-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMarket}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-naija-green-500 text-white hover:bg-naija-green-600 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{editingMarket ? 'Update Market' : 'Add Market'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
