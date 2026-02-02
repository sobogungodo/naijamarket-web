'use client';

import React, { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Layers,
  MapPin,
  X,
  Save,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Tag,
  Scale,
  History,
  BarChart3,
  Settings,
} from 'lucide-react';

// ============================================
// DYNAMIC RECHARTS IMPORTS (SSR-SAFE)
// ============================================
const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false });
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
interface MarketPrice {
  marketId: string;
  marketName: string;
  baselinePrice: number;
  lastUpdated: string;
  priceChange: number;
}

interface Commodity {
  id: string;
  name: string;
  category: string;
  unit: string;
  description: string;
  isActive: boolean;
  marketPrices: MarketPrice[];
  avgPrice: number;
  submissionsThisWeek: number;
  priceVolatility: number;
  createdAt: string;
  lastUpdatedAt: string;
}

interface CommodityFormData {
  name: string;
  category: string;
  unit: string;
  description: string;
}

interface PriceFormData {
  [marketId: string]: string;
}

// ============================================
// CONSTANTS
// ============================================
const categories = [
  'Food Items',
  'Building Materials',
  'Manufacturing Materials',
  'Electronics',
  'Textiles',
  'Agricultural Products',
];

const units = [
  'bag (50kg)',
  'bag (25kg)',
  'basket',
  'tuber',
  'bunch',
  'piece',
  'sheet',
  'ton',
  'yard',
  'carton',
  'gross',
  'litre (25L)',
  'kg',
];

const markets = [
  { id: 'MKT-001', name: 'Mile 12 Market' },
  { id: 'MKT-002', name: 'Onitsha Main Market' },
  { id: 'MKT-003', name: 'Wuse Market' },
  { id: 'MKT-004', name: 'Alaba International' },
  { id: 'MKT-005', name: 'Kano Main Market' },
  { id: 'MKT-006', name: 'Ariaria Market' },
  { id: 'MKT-007', name: 'Iddo Market' },
  { id: 'MKT-008', name: 'Jos Main Market' },
];

// ============================================
// MOCK DATA
// ============================================
const initialCommoditiesData: Commodity[] = [
  {
    id: 'COM-001',
    name: 'Rice',
    category: 'Food Items',
    unit: 'bag (50kg)',
    description: 'Local and imported rice varieties',
    isActive: true,
    marketPrices: [
      { marketId: 'MKT-001', marketName: 'Mile 12 Market', baselinePrice: 82000, lastUpdated: '2 hours ago', priceChange: 2.5 },
      { marketId: 'MKT-002', marketName: 'Onitsha Main Market', baselinePrice: 80000, lastUpdated: '3 hours ago', priceChange: -1.2 },
      { marketId: 'MKT-003', marketName: 'Wuse Market', baselinePrice: 85000, lastUpdated: '1 hour ago', priceChange: 3.1 },
      { marketId: 'MKT-005', marketName: 'Kano Main Market', baselinePrice: 78000, lastUpdated: '4 hours ago', priceChange: 0.8 },
    ],
    avgPrice: 81250,
    submissionsThisWeek: 245,
    priceVolatility: 4.2,
    createdAt: '2024-01-15',
    lastUpdatedAt: '2 hours ago',
  },
  {
    id: 'COM-002',
    name: 'Tomatoes',
    category: 'Food Items',
    unit: 'basket',
    description: 'Fresh tomatoes for cooking',
    isActive: true,
    marketPrices: [
      { marketId: 'MKT-001', marketName: 'Mile 12 Market', baselinePrice: 45000, lastUpdated: '1 hour ago', priceChange: 5.2 },
      { marketId: 'MKT-002', marketName: 'Onitsha Main Market', baselinePrice: 42000, lastUpdated: '2 hours ago', priceChange: 3.8 },
      { marketId: 'MKT-003', marketName: 'Wuse Market', baselinePrice: 48000, lastUpdated: '30 min ago', priceChange: -2.1 },
    ],
    avgPrice: 45000,
    submissionsThisWeek: 189,
    priceVolatility: 8.5,
    createdAt: '2024-01-15',
    lastUpdatedAt: '30 min ago',
  },
  {
    id: 'COM-003',
    name: 'Cement',
    category: 'Building Materials',
    unit: 'bag (50kg)',
    description: 'Portland cement for construction',
    isActive: true,
    marketPrices: [
      { marketId: 'MKT-002', marketName: 'Onitsha Main Market', baselinePrice: 5800, lastUpdated: '5 hours ago', priceChange: 1.2 },
      { marketId: 'MKT-004', marketName: 'Alaba International', baselinePrice: 5500, lastUpdated: '3 hours ago', priceChange: 0.5 },
      { marketId: 'MKT-007', marketName: 'Iddo Market', baselinePrice: 5600, lastUpdated: '6 hours ago', priceChange: -0.8 },
    ],
    avgPrice: 5633,
    submissionsThisWeek: 156,
    priceVolatility: 2.1,
    createdAt: '2024-01-20',
    lastUpdatedAt: '3 hours ago',
  },
  {
    id: 'COM-004',
    name: 'Beans',
    category: 'Food Items',
    unit: 'bag (50kg)',
    description: 'Various bean varieties',
    isActive: true,
    marketPrices: [
      { marketId: 'MKT-001', marketName: 'Mile 12 Market', baselinePrice: 92000, lastUpdated: '2 hours ago', priceChange: 4.5 },
      { marketId: 'MKT-005', marketName: 'Kano Main Market', baselinePrice: 88000, lastUpdated: '4 hours ago', priceChange: 2.3 },
      { marketId: 'MKT-008', marketName: 'Jos Main Market', baselinePrice: 90000, lastUpdated: '3 hours ago', priceChange: 1.8 },
    ],
    avgPrice: 90000,
    submissionsThisWeek: 178,
    priceVolatility: 5.6,
    createdAt: '2024-01-15',
    lastUpdatedAt: '2 hours ago',
  },
  {
    id: 'COM-005',
    name: 'Iron Rods 12mm',
    category: 'Building Materials',
    unit: 'ton',
    description: 'Reinforcement steel rods',
    isActive: true,
    marketPrices: [
      { marketId: 'MKT-004', marketName: 'Alaba International', baselinePrice: 445000, lastUpdated: '6 hours ago', priceChange: 0.8 },
      { marketId: 'MKT-007', marketName: 'Iddo Market', baselinePrice: 450000, lastUpdated: '5 hours ago', priceChange: 1.2 },
    ],
    avgPrice: 447500,
    submissionsThisWeek: 89,
    priceVolatility: 1.5,
    createdAt: '2024-02-01',
    lastUpdatedAt: '5 hours ago',
  },
  {
    id: 'COM-006',
    name: 'Palm Oil',
    category: 'Food Items',
    unit: 'litre (25L)',
    description: 'Red palm oil for cooking',
    isActive: true,
    marketPrices: [
      { marketId: 'MKT-001', marketName: 'Mile 12 Market', baselinePrice: 48000, lastUpdated: '1 hour ago', priceChange: 6.2 },
      { marketId: 'MKT-002', marketName: 'Onitsha Main Market', baselinePrice: 45000, lastUpdated: '2 hours ago', priceChange: 4.8 },
      { marketId: 'MKT-006', marketName: 'Ariaria Market', baselinePrice: 44000, lastUpdated: '3 hours ago', priceChange: 5.1 },
    ],
    avgPrice: 45667,
    submissionsThisWeek: 134,
    priceVolatility: 7.8,
    createdAt: '2024-01-15',
    lastUpdatedAt: '1 hour ago',
  },
  {
    id: 'COM-007',
    name: 'Fabric',
    category: 'Textiles',
    unit: 'yard',
    description: 'Ankara and other fabric types',
    isActive: true,
    marketPrices: [
      { marketId: 'MKT-006', marketName: 'Ariaria Market', baselinePrice: 3200, lastUpdated: '4 hours ago', priceChange: 2.1 },
      { marketId: 'MKT-002', marketName: 'Onitsha Main Market', baselinePrice: 3500, lastUpdated: '5 hours ago', priceChange: 1.5 },
    ],
    avgPrice: 3350,
    submissionsThisWeek: 98,
    priceVolatility: 3.2,
    createdAt: '2024-02-10',
    lastUpdatedAt: '4 hours ago',
  },
  {
    id: 'COM-008',
    name: 'Yam',
    category: 'Food Items',
    unit: 'tuber',
    description: 'White and water yam varieties',
    isActive: true,
    marketPrices: [
      { marketId: 'MKT-001', marketName: 'Mile 12 Market', baselinePrice: 2200, lastUpdated: '2 hours ago', priceChange: 8.5 },
      { marketId: 'MKT-008', marketName: 'Jos Main Market', baselinePrice: 1800, lastUpdated: '3 hours ago', priceChange: 5.2 },
      { marketId: 'MKT-005', marketName: 'Kano Main Market', baselinePrice: 2000, lastUpdated: '4 hours ago', priceChange: 6.8 },
    ],
    avgPrice: 2000,
    submissionsThisWeek: 167,
    priceVolatility: 9.2,
    createdAt: '2024-01-15',
    lastUpdatedAt: '2 hours ago',
  },
  {
    id: 'COM-009',
    name: 'Onions',
    category: 'Food Items',
    unit: 'bag (50kg)',
    description: 'Red and white onions',
    isActive: false,
    marketPrices: [
      { marketId: 'MKT-001', marketName: 'Mile 12 Market', baselinePrice: 82500, lastUpdated: '1 day ago', priceChange: 0 },
    ],
    avgPrice: 82500,
    submissionsThisWeek: 0,
    priceVolatility: 0,
    createdAt: '2024-01-15',
    lastUpdatedAt: '1 day ago',
  },
  {
    id: 'COM-010',
    name: 'Plywood',
    category: 'Building Materials',
    unit: 'sheet',
    description: '4x8 plywood sheets',
    isActive: true,
    marketPrices: [
      { marketId: 'MKT-007', marketName: 'Iddo Market', baselinePrice: 17000, lastUpdated: '5 hours ago', priceChange: 1.8 },
      { marketId: 'MKT-004', marketName: 'Alaba International', baselinePrice: 16500, lastUpdated: '6 hours ago', priceChange: 2.1 },
    ],
    avgPrice: 16750,
    submissionsThisWeek: 78,
    priceVolatility: 2.8,
    createdAt: '2024-02-05',
    lastUpdatedAt: '5 hours ago',
  },
];

const categoryDistribution = [
  { name: 'Food Items', value: 6, color: '#10b981' },
  { name: 'Building', value: 3, color: '#3b82f6' },
  { name: 'Textiles', value: 1, color: '#f59e0b' },
];

const priceHistoryData = [
  { date: 'Jan', rice: 75000, beans: 82000, cement: 5200 },
  { date: 'Feb', rice: 78000, beans: 85000, cement: 5400 },
  { date: 'Mar', rice: 80000, beans: 88000, cement: 5500 },
  { date: 'Apr', rice: 79000, beans: 86000, cement: 5600 },
  { date: 'May', rice: 82000, beans: 90000, cement: 5800 },
  { date: 'Jun', rice: 81000, beans: 92000, cement: 5700 },
];

// ============================================
// HELPER FUNCTIONS
// ============================================
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('NGN', '₦');
};

const getVolatilityColor = (volatility: number) => {
  if (volatility > 7) return 'text-red-500';
  if (volatility > 4) return 'text-yellow-500';
  return 'text-green-500';
};

const getVolatilityLabel = (volatility: number) => {
  if (volatility > 7) return 'High';
  if (volatility > 4) return 'Medium';
  return 'Low';
};

// ============================================
// CSV EXPORT FUNCTION
// ============================================
const exportToCSV = (data: Commodity[], filename: string) => {
  const headers = [
    'ID', 'Name', 'Category', 'Unit', 'Average Price (₦)', 'Markets Coverage',
    'Submissions/Week', 'Volatility (%)', 'Status', 'Last Updated'
  ];

  const csvRows = data.map(commodity => [
    commodity.id,
    commodity.name,
    commodity.category,
    commodity.unit,
    commodity.avgPrice,
    commodity.marketPrices.length,
    commodity.submissionsThisWeek,
    commodity.priceVolatility,
    commodity.isActive ? 'Active' : 'Inactive',
    commodity.lastUpdatedAt
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
export default function CommoditiesPage() {
  const [commoditiesData, setCommoditiesData] = useState<Commodity[]>(initialCommoditiesData);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editingCommodity, setEditingCommodity] = useState<Commodity | null>(null);
  const [selectedCommodityForPricing, setSelectedCommodityForPricing] = useState<Commodity | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState<CommodityFormData>({
    name: '',
    category: '',
    unit: '',
    description: '',
  });
  
  const [priceFormData, setPriceFormData] = useState<PriceFormData>({});
  
  const itemsPerPage = 5;

  // Filter commodities
  const filteredCommodities = useMemo(() => {
    return commoditiesData.filter(commodity => {
      const matchesSearch = 
        commodity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        commodity.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        commodity.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All Categories' || commodity.category === selectedCategory;
      const matchesStatus = selectedStatus === 'All' || 
        (selectedStatus === 'Active' && commodity.isActive) ||
        (selectedStatus === 'Inactive' && !commodity.isActive);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [commoditiesData, searchTerm, selectedCategory, selectedStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredCommodities.length / itemsPerPage);
  const paginatedCommodities = filteredCommodities.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats calculations
  const stats = useMemo(() => {
    const activeCommodities = commoditiesData.filter(c => c.isActive);
    const totalMarketPrices = commoditiesData.reduce((sum, c) => sum + c.marketPrices.length, 0);
    const uniqueCategories = [...new Set(commoditiesData.map(c => c.category))].length;
    
    return {
      totalCommodities: commoditiesData.length,
      activeCommodities: activeCommodities.length,
      totalCategories: uniqueCategories,
      totalPricesSet: totalMarketPrices,
      avgVolatility: (commoditiesData.reduce((sum, c) => sum + c.priceVolatility, 0) / commoditiesData.length).toFixed(1),
    };
  }, [commoditiesData]);

  // Unique categories for filter
  const uniqueCategories = useMemo(() => {
    const cats = [...new Set(commoditiesData.map(c => c.category))];
    return ['All Categories', ...cats.sort()];
  }, [commoditiesData]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  }, []);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    exportToCSV(filteredCommodities, 'commodities');
    setIsExporting(false);
  }, [filteredCommodities]);

  const handleToggleStatus = useCallback((id: string) => {
    setCommoditiesData(prev => 
      prev.map(commodity => 
        commodity.id === id 
          ? { ...commodity, isActive: !commodity.isActive }
          : commodity
      )
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (!confirm('Are you sure you want to delete this commodity? This action cannot be undone.')) {
      return;
    }
    setCommoditiesData(prev => prev.filter(commodity => commodity.id !== id));
  }, []);

  const handleOpenModal = useCallback((commodity?: Commodity) => {
    if (commodity) {
      setEditingCommodity(commodity);
      setFormData({
        name: commodity.name,
        category: commodity.category,
        unit: commodity.unit,
        description: commodity.description,
      });
    } else {
      setEditingCommodity(null);
      setFormData({
        name: '',
        category: '',
        unit: '',
        description: '',
      });
    }
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setEditingCommodity(null);
  }, []);

  const handleOpenPriceModal = useCallback((commodity: Commodity) => {
    setSelectedCommodityForPricing(commodity);
    const initialPrices: PriceFormData = {};
    markets.forEach(market => {
      const existingPrice = commodity.marketPrices.find(p => p.marketId === market.id);
      initialPrices[market.id] = existingPrice ? existingPrice.baselinePrice.toString() : '';
    });
    setPriceFormData(initialPrices);
    setShowPriceModal(true);
  }, []);

  const handleClosePriceModal = useCallback(() => {
    setShowPriceModal(false);
    setSelectedCommodityForPricing(null);
  }, []);

  const handleSaveCommodity = useCallback(async () => {
    if (!formData.name || !formData.category || !formData.unit) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 800));

    if (editingCommodity) {
      setCommoditiesData(prev => 
        prev.map(commodity => 
          commodity.id === editingCommodity.id
            ? {
                ...commodity,
                name: formData.name,
                category: formData.category,
                unit: formData.unit,
                description: formData.description,
                lastUpdatedAt: 'Just now',
              }
            : commodity
        )
      );
    } else {
      const newCommodity: Commodity = {
        id: `COM-${String(commoditiesData.length + 1).padStart(3, '0')}`,
        name: formData.name,
        category: formData.category,
        unit: formData.unit,
        description: formData.description,
        isActive: true,
        marketPrices: [],
        avgPrice: 0,
        submissionsThisWeek: 0,
        priceVolatility: 0,
        createdAt: new Date().toISOString().split('T')[0],
        lastUpdatedAt: 'Just now',
      };
      setCommoditiesData(prev => [...prev, newCommodity]);
    }

    setIsSaving(false);
    handleCloseModal();
  }, [formData, editingCommodity, commoditiesData.length, handleCloseModal]);

  const handleSavePrices = useCallback(async () => {
    if (!selectedCommodityForPricing) return;

    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 800));

    setCommoditiesData(prev => 
      prev.map(commodity => {
        if (commodity.id !== selectedCommodityForPricing.id) return commodity;

        const newMarketPrices: MarketPrice[] = [];
        let totalPrice = 0;
        let count = 0;

        markets.forEach(market => {
          const priceStr = priceFormData[market.id];
          if (priceStr && parseFloat(priceStr) > 0) {
            const price = parseFloat(priceStr);
            const existingPrice = commodity.marketPrices.find(p => p.marketId === market.id);
            const oldPrice = existingPrice?.baselinePrice || price;
            const priceChange = ((price - oldPrice) / oldPrice) * 100;

            newMarketPrices.push({
              marketId: market.id,
              marketName: market.name,
              baselinePrice: price,
              lastUpdated: 'Just now',
              priceChange: existingPrice ? priceChange : 0,
            });
            totalPrice += price;
            count++;
          }
        });

        return {
          ...commodity,
          marketPrices: newMarketPrices,
          avgPrice: count > 0 ? Math.round(totalPrice / count) : 0,
          lastUpdatedAt: 'Just now',
        };
      })
    );

    setIsSaving(false);
    handleClosePriceModal();
  }, [selectedCommodityForPricing, priceFormData, handleClosePriceModal]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="h-16 bg-dash-card border-b border-dash-border px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-dash-text">Commodities Management</h1>
          <p className="text-sm text-dash-muted">Manage items and baseline prices per market</p>
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
            disabled={isExporting || filteredCommodities.length === 0}
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
            <span className="text-sm font-medium">Add Commodity</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-6">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Commodities */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dash-muted mb-1">Total Commodities</p>
                  <p className="text-3xl font-bold text-dash-text">{stats.totalCommodities}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-green-500">{stats.activeCommodities} active</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Package className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dash-muted mb-1">Categories</p>
                  <p className="text-3xl font-bold text-dash-text">{stats.totalCategories}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Layers className="w-3 h-3 text-dash-muted" />
                    <span className="text-xs text-dash-muted">Product types</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10">
                  <Layers className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </div>

            {/* Prices Set */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dash-muted mb-1">Baseline Prices Set</p>
                  <p className="text-3xl font-bold text-dash-text">{stats.totalPricesSet}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <MapPin className="w-3 h-3 text-dash-muted" />
                    <span className="text-xs text-dash-muted">Across {markets.length} markets</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10">
                  <DollarSign className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </div>

            {/* Average Volatility */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dash-muted mb-1">Avg Price Volatility</p>
                  <p className={`text-3xl font-bold ${getVolatilityColor(parseFloat(stats.avgVolatility))}`}>
                    {stats.avgVolatility}%
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <BarChart3 className="w-3 h-3 text-dash-muted" />
                    <span className="text-xs text-dash-muted">{getVolatilityLabel(parseFloat(stats.avgVolatility))} volatility</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-yellow-500/10">
                  <TrendingUp className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Price History Chart */}
            <div className="lg:col-span-2 rounded-xl border border-dash-border bg-dash-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-dash-text">Price Trends (6 Months)</h3>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-dash-muted">Rice</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-dash-muted">Beans</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-dash-muted">Cement</span>
                  </div>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceHistoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(value) => `₦${(value/1000)}k`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1f2e',
                        border: '1px solid #2a2f3a',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                    <Line type="monotone" dataKey="rice" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="beans" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="cement" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Distribution Pie */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-5">
              <h3 className="font-semibold text-dash-text mb-4">By Category</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryDistribution.map((entry, index) => (
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
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {categoryDistribution.map((item) => (
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
                placeholder="Search by name, ID, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-dash-bg border border-dash-border text-dash-text placeholder-dash-muted focus:outline-none focus:border-naija-green-500 transition-colors"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-muted" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="pl-10 pr-8 py-2.5 rounded-lg bg-dash-bg border border-dash-border text-dash-text focus:outline-none focus:border-naija-green-500 transition-colors appearance-none cursor-pointer min-w-[180px]"
              >
                {uniqueCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
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

          {/* Commodities Table */}
          <div className="rounded-xl border border-dash-border bg-dash-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dash-bg border-b border-dash-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Commodity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Unit</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Avg Price</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Markets</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Volatility</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-dash-muted uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border">
                  {paginatedCommodities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-dash-muted">
                        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No commodities found matching your filters</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedCommodities.map((commodity) => (
                      <tr key={commodity.id} className={`hover:bg-dash-hover transition-colors ${!commodity.isActive ? 'opacity-60' : ''}`}>
                        {/* Commodity Name */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${commodity.isActive ? 'bg-naija-green-500/10' : 'bg-gray-500/10'}`}>
                              <Package className={`w-5 h-5 ${commodity.isActive ? 'text-naija-green-500' : 'text-gray-500'}`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-dash-text">{commodity.name}</p>
                              <p className="text-xs text-dash-muted">{commodity.id}</p>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="px-4 py-4">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-lg bg-dash-bg text-dash-text">
                            {commodity.category}
                          </span>
                        </td>

                        {/* Unit */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <Scale className="w-3 h-3 text-dash-muted" />
                            <span className="text-sm text-dash-muted">{commodity.unit}</span>
                          </div>
                        </td>

                        {/* Average Price */}
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-dash-text">{formatCurrency(commodity.avgPrice)}</p>
                          <p className="text-xs text-dash-muted">{commodity.submissionsThisWeek} submissions/week</p>
                        </td>

                        {/* Markets Coverage */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-dash-muted" />
                            <span className="text-sm text-dash-text">{commodity.marketPrices.length}</span>
                            <span className="text-xs text-dash-muted">/ {markets.length}</span>
                          </div>
                        </td>

                        {/* Volatility */}
                        <td className="px-4 py-4">
                          <div className={`flex items-center gap-1 ${getVolatilityColor(commodity.priceVolatility)}`}>
                            {commodity.priceVolatility > 5 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            <span className="text-sm font-medium">{commodity.priceVolatility}%</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${
                            commodity.isActive 
                              ? 'bg-green-500/10 text-green-500 border-green-500/30'
                              : 'bg-gray-500/10 text-gray-500 border-gray-500/30'
                          }`}>
                            {commodity.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenPriceModal(commodity)}
                              className="p-1.5 rounded-lg hover:bg-blue-500/10 text-dash-muted hover:text-blue-500 transition-colors"
                              title="Manage Prices"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenModal(commodity)}
                              className="p-1.5 rounded-lg hover:bg-dash-bg text-dash-muted hover:text-dash-text transition-colors"
                              title="Edit Commodity"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(commodity.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                commodity.isActive 
                                  ? 'hover:bg-yellow-500/10 text-dash-muted hover:text-yellow-500'
                                  : 'hover:bg-green-500/10 text-dash-muted hover:text-green-500'
                              }`}
                              title={commodity.isActive ? 'Deactivate' : 'Activate'}
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(commodity.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-dash-muted hover:text-red-500 transition-colors"
                              title="Delete Commodity"
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
                Showing {filteredCommodities.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredCommodities.length)} of {filteredCommodities.length} commodities
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

      {/* Add/Edit Commodity Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCloseModal}
          />
          
          <div className="relative w-full max-w-lg mx-4 bg-dash-card rounded-xl border border-dash-border shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-dash-border">
              <h2 className="text-lg font-semibold text-dash-text">
                {editingCommodity ? 'Edit Commodity' : 'Add New Commodity'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1 rounded-lg hover:bg-dash-hover text-dash-muted hover:text-dash-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-dash-text mb-1">
                  Commodity Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Rice"
                  className="w-full px-3 py-2 rounded-lg bg-dash-bg border border-dash-border text-dash-text placeholder-dash-muted focus:outline-none focus:border-naija-green-500 transition-colors"
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dash-text mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-dash-bg border border-dash-border text-dash-text focus:outline-none focus:border-naija-green-500 transition-colors"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dash-text mb-1">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-dash-bg border border-dash-border text-dash-text focus:outline-none focus:border-naija-green-500 transition-colors"
                  >
                    <option value="">Select Unit</option>
                    {units.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-dash-text mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the commodity..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-dash-bg border border-dash-border text-dash-text placeholder-dash-muted focus:outline-none focus:border-naija-green-500 transition-colors resize-none"
                />
              </div>

              {/* Info */}
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-blue-500 mt-0.5" />
                  <div className="text-xs text-dash-muted">
                    <p className="font-medium text-blue-400 mb-1">Setting Baseline Prices</p>
                    <p>After adding a commodity, use the price management button (₦) to set baseline prices for each market.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-dash-border">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-lg border border-dash-border text-dash-muted hover:bg-dash-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCommodity}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-naija-green-500 text-white hover:bg-naija-green-600 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{editingCommodity ? 'Update' : 'Add Commodity'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price Management Modal */}
      {showPriceModal && selectedCommodityForPricing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClosePriceModal}
          />
          
          <div className="relative w-full max-w-2xl mx-4 bg-dash-card rounded-xl border border-dash-border shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-dash-border">
              <div>
                <h2 className="text-lg font-semibold text-dash-text">
                  Manage Baseline Prices
                </h2>
                <p className="text-sm text-dash-muted">
                  {selectedCommodityForPricing.name} ({selectedCommodityForPricing.unit})
                </p>
              </div>
              <button
                onClick={handleClosePriceModal}
                className="p-1 rounded-lg hover:bg-dash-hover text-dash-muted hover:text-dash-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {markets.map(market => {
                  const existingPrice = selectedCommodityForPricing.marketPrices.find(
                    p => p.marketId === market.id
                  );
                  
                  return (
                    <div key={market.id} className="p-3 rounded-lg bg-dash-bg border border-dash-border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-dash-muted" />
                          <span className="text-sm font-medium text-dash-text">{market.name}</span>
                        </div>
                        {existingPrice && (
                          <span className={`text-xs ${existingPrice.priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {existingPrice.priceChange >= 0 ? '+' : ''}{existingPrice.priceChange.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dash-muted">₦</span>
                        <input
                          type="number"
                          value={priceFormData[market.id] || ''}
                          onChange={(e) => setPriceFormData(prev => ({
                            ...prev,
                            [market.id]: e.target.value
                          }))}
                          placeholder="0"
                          className="w-full pl-8 pr-3 py-2 rounded-lg bg-dash-card border border-dash-border text-dash-text placeholder-dash-muted focus:outline-none focus:border-naija-green-500 transition-colors"
                        />
                      </div>
                      {existingPrice && (
                        <p className="text-xs text-dash-muted mt-1">
                          Last updated: {existingPrice.lastUpdated}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Info */}
              <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                  <div className="text-xs text-dash-muted">
                    <p className="font-medium text-yellow-400 mb-1">Price Variance Validation</p>
                    <p>Submitted prices that deviate more than ±30% from baseline will be flagged for fraud review.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-dash-border">
              <button
                onClick={handleClosePriceModal}
                className="px-4 py-2 rounded-lg border border-dash-border text-dash-muted hover:bg-dash-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePrices}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-naija-green-500 text-white hover:bg-naija-green-600 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Save Prices</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
