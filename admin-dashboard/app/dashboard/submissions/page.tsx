'use client';

import React, { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  MapPin,
  Eye,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Navigation,
  Calendar,
  User,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';

// ============================================
// DYNAMIC RECHARTS IMPORTS (SSR-SAFE)
// ============================================
const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(mod => mod.Area), { ssr: false });
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
interface Submission {
  id: string;
  trader: string;
  phone: string;
  market: string;
  item: string;
  price: number;
  baseline: number;
  variance: number;
  gpsValid: boolean;
  gpsDistance: number;
  status: string;
  fraudFlags: string[];
  submittedAt: string;
  reputation: number;
}

// ============================================
// MOCK DATA
// ============================================
const trendData = [
  { time: '6AM', submissions: 12, approved: 10, rejected: 2 },
  { time: '8AM', submissions: 45, approved: 38, rejected: 5 },
  { time: '10AM', submissions: 78, approved: 65, rejected: 8 },
  { time: '12PM', submissions: 95, approved: 82, rejected: 10 },
  { time: '2PM', submissions: 67, approved: 58, rejected: 6 },
  { time: '4PM', submissions: 54, approved: 48, rejected: 4 },
  { time: '6PM', submissions: 38, approved: 32, rejected: 3 },
  { time: '8PM', submissions: 22, approved: 19, rejected: 2 },
];

const statusData = [
  { name: 'Approved', value: 215, color: '#10b981' },
  { name: 'Pending', value: 18, color: '#f59e0b' },
  { name: 'Rejected', value: 14, color: '#ef4444' },
];

const initialSubmissionsData: Submission[] = [
  {
    id: 'SUB-001',
    trader: 'Chidi Okonkwo',
    phone: '08031234567',
    market: 'Mile 12',
    item: 'Rice (50kg)',
    price: 85000,
    baseline: 82000,
    variance: 3.66,
    gpsValid: true,
    gpsDistance: 125,
    status: 'pending',
    fraudFlags: [],
    submittedAt: '2 min ago',
    reputation: 72,
  },
  {
    id: 'SUB-002',
    trader: 'Amina Bello',
    phone: '08051234567',
    market: 'Wuse Market',
    item: 'Tomatoes (basket)',
    price: 45000,
    baseline: 44000,
    variance: 2.27,
    gpsValid: true,
    gpsDistance: 89,
    status: 'approved',
    fraudFlags: [],
    submittedAt: '5 min ago',
    reputation: 85,
  },
  {
    id: 'SUB-003',
    trader: 'Emeka Eze',
    phone: '08061234567',
    market: 'Onitsha Main',
    item: 'Cement (bag)',
    price: 8500,
    baseline: 5800,
    variance: 46.55,
    gpsValid: false,
    gpsDistance: 2500,
    status: 'flagged',
    fraudFlags: ['price_anomaly', 'gps_mismatch'],
    submittedAt: '8 min ago',
    reputation: 45,
  },
  {
    id: 'SUB-004',
    trader: 'Fatima Yusuf',
    phone: '08071234567',
    market: 'Kano Main',
    item: 'Beans (bag)',
    price: 95000,
    baseline: 92000,
    variance: 3.26,
    gpsValid: true,
    gpsDistance: 210,
    status: 'pending',
    fraudFlags: [],
    submittedAt: '12 min ago',
    reputation: 68,
  },
  {
    id: 'SUB-005',
    trader: 'Oluwaseun Adeyemi',
    phone: '08081234567',
    market: 'Alaba International',
    item: 'Iron Rods 12mm',
    price: 450000,
    baseline: 445000,
    variance: 1.12,
    gpsValid: true,
    gpsDistance: 45,
    status: 'approved',
    fraudFlags: [],
    submittedAt: '15 min ago',
    reputation: 91,
  },
  {
    id: 'SUB-006',
    trader: 'Ibrahim Musa',
    phone: '08091234567',
    market: 'Jos Main',
    item: 'Yam (tuber)',
    price: 2500,
    baseline: 2200,
    variance: 13.64,
    gpsValid: true,
    gpsDistance: 180,
    status: 'pending',
    fraudFlags: [],
    submittedAt: '18 min ago',
    reputation: 55,
  },
  {
    id: 'SUB-007',
    trader: 'Grace Okoro',
    phone: '08101234567',
    market: 'Mile 12',
    item: 'Palm Oil (25L)',
    price: 65000,
    baseline: 48000,
    variance: 35.42,
    gpsValid: true,
    gpsDistance: 95,
    status: 'flagged',
    fraudFlags: ['price_anomaly'],
    submittedAt: '22 min ago',
    reputation: 62,
  },
  {
    id: 'SUB-008',
    trader: 'Ahmed Sani',
    phone: '08111234567',
    market: 'Wuse Market',
    item: 'Onions (bag)',
    price: 85000,
    baseline: 82500,
    variance: 3.03,
    gpsValid: true,
    gpsDistance: 78,
    status: 'approved',
    fraudFlags: [],
    submittedAt: '25 min ago',
    reputation: 88,
  },
  {
    id: 'SUB-009',
    trader: 'Ngozi Ibe',
    phone: '08121234567',
    market: 'Ariaria Market',
    item: 'Fabric (yard)',
    price: 3500,
    baseline: 3200,
    variance: 9.38,
    gpsValid: true,
    gpsDistance: 156,
    status: 'pending',
    fraudFlags: [],
    submittedAt: '28 min ago',
    reputation: 74,
  },
  {
    id: 'SUB-010',
    trader: 'Bello Abdullahi',
    phone: '08131234567',
    market: 'Iddo Market',
    item: 'Plywood (sheet)',
    price: 18500,
    baseline: 17000,
    variance: 8.82,
    gpsValid: true,
    gpsDistance: 112,
    status: 'approved',
    fraudFlags: [],
    submittedAt: '32 min ago',
    reputation: 79,
  },
];

const markets = ['All Markets', 'Mile 12', 'Wuse Market', 'Onitsha Main', 'Kano Main', 'Alaba International', 'Jos Main', 'Ariaria Market', 'Iddo Market'];
const statuses = ['All Status', 'pending', 'approved', 'rejected', 'flagged'];

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

const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    approved: 'bg-green-500/10 text-green-500 border-green-500/30',
    rejected: 'bg-red-500/10 text-red-500 border-red-500/30',
    flagged: 'bg-red-500/10 text-red-500 border-red-500/30',
  };
  return styles[status] || styles.pending;
};

const getVarianceColor = (variance: number) => {
  if (variance > 30) return 'text-red-500';
  if (variance > 15) return 'text-yellow-500';
  return 'text-green-500';
};

const getFraudFlagLabel = (flag: string) => {
  const labels: Record<string, string> = {
    price_anomaly: 'Price >30% variance',
    gps_mismatch: 'GPS outside market',
    rapid_submission: 'Rapid submissions',
    collusion: 'Validator collusion',
  };
  return labels[flag] || flag;
};

// ============================================
// CSV EXPORT FUNCTION
// ============================================
const exportToCSV = (data: Submission[], filename: string) => {
  // Define CSV headers
  const headers = [
    'ID',
    'Trader',
    'Phone',
    'Market',
    'Item',
    'Price (₦)',
    'Baseline (₦)',
    'Variance (%)',
    'GPS Valid',
    'GPS Distance (m)',
    'Status',
    'Fraud Flags',
    'Submitted',
    'Reputation'
  ];

  // Convert data to CSV rows
  const csvRows = data.map(sub => [
    sub.id,
    sub.trader,
    sub.phone,
    sub.market,
    sub.item,
    sub.price,
    sub.baseline,
    sub.variance.toFixed(2),
    sub.gpsValid ? 'Yes' : 'No',
    sub.gpsDistance,
    sub.status.charAt(0).toUpperCase() + sub.status.slice(1),
    sub.fraudFlags.length > 0 ? sub.fraudFlags.join('; ') : 'None',
    sub.submittedAt,
    sub.reputation
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Create blob and download
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
export default function SubmissionsPage() {
  const [submissionsData, setSubmissionsData] = useState<Submission[]>(initialSubmissionsData);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('All Markets');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const itemsPerPage = 5;

  // Filter submissions
  const filteredSubmissions = useMemo(() => {
    return submissionsData.filter(sub => {
      const matchesSearch = 
        sub.trader.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMarket = selectedMarket === 'All Markets' || sub.market === selectedMarket;
      const matchesStatus = selectedStatus === 'All Status' || sub.status === selectedStatus;
      return matchesSearch && matchesMarket && matchesStatus;
    });
  }, [submissionsData, searchTerm, selectedMarket, selectedStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);
  const paginatedSubmissions = filteredSubmissions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats calculations
  const stats = useMemo(() => ({
    totalToday: submissionsData.length,
    pending: submissionsData.filter(s => s.status === 'pending').length,
    approved: submissionsData.filter(s => s.status === 'approved').length,
    flagged: submissionsData.filter(s => s.status === 'flagged').length,
  }), [submissionsData]);

  // ============================================
  // REFRESH FUNCTION
  // ============================================
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    
    try {
      // Simulate API call - replace with actual API call
      // const response = await fetch('/api/submissions');
      // const data = await response.json();
      // setSubmissionsData(data);
      
      // For now, simulate refresh with slight data modification
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate new data coming in
      setSubmissionsData(prev => {
        const updated = [...prev];
        // Update timestamps to show refresh happened
        return updated.map(sub => ({
          ...sub,
          // In real app, this would be fresh data from API
        }));
      });
      
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Failed to refresh:', error);
      // Show error toast in production
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // ============================================
  // EXPORT FUNCTIONS
  // ============================================
  const handleExportFiltered = useCallback(async () => {
    setIsExporting(true);
    
    try {
      // Small delay for UX feedback
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const filename = selectedMarket !== 'All Markets' 
        ? `submissions_${selectedMarket.replace(/\s+/g, '_').toLowerCase()}`
        : selectedStatus !== 'All Status'
          ? `submissions_${selectedStatus}`
          : 'submissions_filtered';
      
      exportToCSV(filteredSubmissions, filename);
    } catch (error) {
      console.error('Export failed:', error);
      // Show error toast in production
    } finally {
      setIsExporting(false);
    }
  }, [filteredSubmissions, selectedMarket, selectedStatus]);

  const handleExportAll = useCallback(async () => {
    setIsExporting(true);
    
    try {
      // Small delay for UX feedback
      await new Promise(resolve => setTimeout(resolve, 500));
      exportToCSV(submissionsData, 'submissions_all_today');
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [submissionsData]);

  // ============================================
  // ACTION HANDLERS
  // ============================================
  const handleApprove = useCallback((id: string) => {
    setSubmissionsData(prev => 
      prev.map(sub => 
        sub.id === id 
          ? { ...sub, status: 'approved', fraudFlags: [] }
          : sub
      )
    );
    // In production: API call to approve
    // await fetch(`/api/submissions/${id}/approve`, { method: 'POST' });
  }, []);

  const handleReject = useCallback((id: string) => {
    setSubmissionsData(prev => 
      prev.map(sub => 
        sub.id === id 
          ? { ...sub, status: 'rejected' }
          : sub
      )
    );
    // In production: API call to reject
    // await fetch(`/api/submissions/${id}/reject`, { method: 'POST' });
  }, []);

  const handleApproveAllPending = useCallback(async () => {
    const pendingIds = submissionsData.filter(s => s.status === 'pending').map(s => s.id);
    
    if (pendingIds.length === 0) return;
    
    // Confirm action
    if (!confirm(`Are you sure you want to approve ${pendingIds.length} pending submissions?`)) {
      return;
    }
    
    setSubmissionsData(prev => 
      prev.map(sub => 
        sub.status === 'pending' 
          ? { ...sub, status: 'approved' }
          : sub
      )
    );
    
    // In production: Bulk API call
    // await fetch('/api/submissions/bulk-approve', { 
    //   method: 'POST', 
    //   body: JSON.stringify({ ids: pendingIds }) 
    // });
  }, [submissionsData]);

  // Format last refreshed time
  const formatLastRefreshed = () => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastRefreshed.getTime()) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    return lastRefreshed.toLocaleTimeString();
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="h-16 bg-dash-card border-b border-dash-border px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-dash-text">Submissions Review</h1>
          <p className="text-sm text-dash-muted">Review and approve price submissions from traders</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Last Refreshed */}
          <span className="text-xs text-dash-muted hidden sm:block">
            Updated {formatLastRefreshed()}
          </span>
          
          {/* Refresh Button */}
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
          
          {/* Export Button */}
          <button 
            onClick={handleExportFiltered}
            disabled={isExporting || filteredSubmissions.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dash-bg border border-dash-border hover:bg-dash-hover transition-colors disabled:opacity-50"
            title={`Export ${filteredSubmissions.length} filtered submissions`}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 text-dash-muted animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-dash-muted" />
            )}
            <span className="text-sm text-dash-muted hidden sm:block">
              Export ({filteredSubmissions.length})
            </span>
          </button>
          
          {/* Live Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-400">Live</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-6">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Today */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dash-muted mb-1">Total Today</p>
                  <p className="text-3xl font-bold text-dash-text">{stats.totalToday}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-green-500">+12.4%</span>
                    <span className="text-xs text-dash-muted">vs yesterday</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <FileText className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </div>

            {/* Pending Review */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dash-muted mb-1">Pending Review</p>
                  <p className="text-3xl font-bold text-yellow-500">{stats.pending}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Clock className="w-3 h-3 text-dash-muted" />
                    <span className="text-xs text-dash-muted">Avg 8 min wait</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-yellow-500/10">
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </div>

            {/* Approved */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dash-muted mb-1">Approved Today</p>
                  <p className="text-3xl font-bold text-green-500">{stats.approved}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-green-500">94.7%</span>
                    <span className="text-xs text-dash-muted">approval rate</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </div>

            {/* Fraud Flagged */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dash-muted mb-1">Fraud Flagged</p>
                  <p className="text-3xl font-bold text-red-500">{stats.flagged}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                    <span className="text-xs text-red-500">Requires review</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-red-500/10">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Submission Trends Chart */}
            <div className="lg:col-span-2 rounded-xl border border-dash-border bg-dash-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-dash-text">Today&apos;s Submission Trend</h3>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-dash-muted">Submissions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-dash-muted">Approved</span>
                  </div>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="submissionsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="approvedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
                    <XAxis dataKey="time" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1f2e',
                        border: '1px solid #2a2f3a',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="submissions"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#submissionsGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="approved"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#approvedGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status Breakdown Pie */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-5">
              <h3 className="font-semibold text-dash-text mb-4">Status Breakdown</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
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
                {statusData.map((item) => (
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
                placeholder="Search by trader, item, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-dash-bg border border-dash-border text-dash-text placeholder-dash-muted focus:outline-none focus:border-naija-green-500 transition-colors"
              />
            </div>

            {/* Market Filter */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-muted" />
              <select
                value={selectedMarket}
                onChange={(e) => setSelectedMarket(e.target.value)}
                className="pl-10 pr-8 py-2.5 rounded-lg bg-dash-bg border border-dash-border text-dash-text focus:outline-none focus:border-naija-green-500 transition-colors appearance-none cursor-pointer min-w-[180px]"
              >
                {markets.map(market => (
                  <option key={market} value={market}>{market}</option>
                ))}
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-muted pointer-events-none" />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="pl-4 pr-8 py-2.5 rounded-lg bg-dash-bg border border-dash-border text-dash-text focus:outline-none focus:border-naija-green-500 transition-colors appearance-none cursor-pointer min-w-[140px] capitalize"
              >
                {statuses.map(status => (
                  <option key={status} value={status} className="capitalize">
                    {status === 'All Status' ? status : status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-muted pointer-events-none" />
            </div>
          </div>

          {/* Submissions Table */}
          <div className="rounded-xl border border-dash-border bg-dash-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dash-bg border-b border-dash-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Trader</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Market</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Variance</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">GPS</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-dash-muted uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-dash-muted uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border">
                  {paginatedSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-dash-muted">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No submissions found matching your filters</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedSubmissions.map((sub) => (
                      <tr 
                        key={sub.id} 
                        className={`hover:bg-dash-hover transition-colors ${sub.fraudFlags.length > 0 ? 'bg-red-500/5' : ''}`}
                      >
                        {/* Trader */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-naija-green-500/10 flex items-center justify-center">
                              <User className="w-4 h-4 text-naija-green-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-dash-text">{sub.trader}</p>
                              <p className="text-xs text-dash-muted">Rep: {sub.reputation}</p>
                            </div>
                          </div>
                        </td>

                        {/* Market */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-dash-muted" />
                            <span className="text-sm text-dash-muted">{sub.market}</span>
                          </div>
                        </td>

                        {/* Item */}
                        <td className="px-4 py-4">
                          <span className="text-sm text-dash-text">{sub.item}</span>
                        </td>

                        {/* Price */}
                        <td className="px-4 py-4">
                          <div>
                            <p className="text-sm font-medium text-dash-text">{formatCurrency(sub.price)}</p>
                            <p className="text-xs text-dash-muted">Base: {formatCurrency(sub.baseline)}</p>
                          </div>
                        </td>

                        {/* Variance */}
                        <td className="px-4 py-4">
                          <div className={`flex items-center gap-1 ${getVarianceColor(sub.variance)}`}>
                            {sub.variance > 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            <span className="text-sm font-medium">{sub.variance.toFixed(1)}%</span>
                          </div>
                        </td>

                        {/* GPS */}
                        <td className="px-4 py-4">
                          <div className={`flex items-center gap-1 ${sub.gpsValid ? 'text-green-500' : 'text-red-500'}`}>
                            <Navigation className="w-3 h-3" />
                            <span className="text-xs">
                              {sub.gpsValid ? `${sub.gpsDistance}m` : 'Invalid'}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadge(sub.status)}`}>
                              {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                            </span>
                            {sub.fraudFlags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {sub.fraudFlags.map(flag => (
                                  <span key={flag} className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                                    {getFraudFlagLabel(flag)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Time */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1 text-dash-muted">
                            <Calendar className="w-3 h-3" />
                            <span className="text-xs">{sub.submittedAt}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedSubmission(sub.id)}
                              className="p-1.5 rounded-lg hover:bg-dash-bg text-dash-muted hover:text-dash-text transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {sub.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(sub.id)}
                                  className="p-1.5 rounded-lg hover:bg-green-500/10 text-dash-muted hover:text-green-500 transition-colors"
                                  title="Approve"
                                >
                                  <ThumbsUp className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleReject(sub.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-dash-muted hover:text-red-500 transition-colors"
                                  title="Reject"
                                >
                                  <ThumbsDown className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {sub.status === 'flagged' && (
                              <>
                                <button
                                  onClick={() => handleApprove(sub.id)}
                                  className="p-1.5 rounded-lg hover:bg-green-500/10 text-dash-muted hover:text-green-500 transition-colors"
                                  title="Approve (Override)"
                                >
                                  <ThumbsUp className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleReject(sub.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-dash-muted hover:text-red-500 transition-colors"
                                  title="Reject"
                                >
                                  <ThumbsDown className="w-4 h-4" />
                                </button>
                              </>
                            )}
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
                Showing {filteredSubmissions.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredSubmissions.length)} of {filteredSubmissions.length} submissions
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

          {/* Bulk Actions Card */}
          <div className="rounded-xl border border-dash-border bg-dash-card p-5">
            <h3 className="font-semibold text-dash-text mb-4">Bulk Actions</h3>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={handleApproveAllPending}
                disabled={stats.pending === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Approve All Pending ({stats.pending})</span>
              </button>
              <button 
                onClick={() => {
                  setSelectedStatus('flagged');
                  setCurrentPage(1);
                }}
                disabled={stats.flagged === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Review Flagged ({stats.flagged})</span>
              </button>
              <button 
                onClick={handleExportAll}
                disabled={isExporting || submissionsData.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-500 hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">Export Today&apos;s Data ({submissionsData.length})</span>
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
