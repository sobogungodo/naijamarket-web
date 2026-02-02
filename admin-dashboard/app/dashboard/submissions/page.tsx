'use client';

import { useState, useCallback } from 'react';
import {
  FileText, Search, Filter, RefreshCw, Download, Eye, CheckCircle,
  XCircle, Clock, AlertTriangle, MapPin, User, Calendar, TrendingUp,
  TrendingDown, ChevronDown, ChevronRight, MoreVertical, History,
  ThumbsUp, ThumbsDown, MessageSquare, X, Loader2
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { exportPayouts } from '@/lib/export-utils';

// Types
interface Submission {
  id: string;
  traderId: string;
  traderName: string;
  traderPhone: string;
  traderReputation: number;
  market: string;
  marketId: string;
  item: string;
  itemCategory: string;
  price: number;
  unit: string;
  baselinePrice: number;
  priceVariance: number;
  gpsValid: boolean;
  gpsDistance: number;
  status: 'pending' | 'validating' | 'approved' | 'rejected' | 'disputed';
  validatorVotes: { approve: number; reject: number };
  submittedAt: Date;
  notes?: string;
  fraudFlags: string[];
}

// Mock data generator
const generateMockSubmissions = (): Submission[] => [
  {
    id: 'SUB001',
    traderId: 'TR001',
    traderName: 'Chidi Okonkwo',
    traderPhone: '08031234567',
    traderReputation: 85,
    market: 'Mile 12 Market',
    marketId: 'mile12',
    item: 'Rice (50kg)',
    itemCategory: 'Grains',
    price: 78000,
    unit: 'bag',
    baselinePrice: 75000,
    priceVariance: 4.0,
    gpsValid: true,
    gpsDistance: 45,
    status: 'pending',
    validatorVotes: { approve: 0, reject: 0 },
    submittedAt: new Date(Date.now() - 15 * 60 * 1000),
    fraudFlags: [],
  },
  {
    id: 'SUB002',
    traderId: 'TR002',
    traderName: 'Ngozi Adeyemi',
    traderPhone: '08051234567',
    traderReputation: 92,
    market: 'Onitsha Main Market',
    marketId: 'onitsha',
    item: 'Tomatoes (basket)',
    itemCategory: 'Vegetables',
    price: 45000,
    unit: 'basket',
    baselinePrice: 42000,
    priceVariance: 7.1,
    gpsValid: true,
    gpsDistance: 120,
    status: 'validating',
    validatorVotes: { approve: 2, reject: 0 },
    submittedAt: new Date(Date.now() - 25 * 60 * 1000),
    fraudFlags: [],
  },
  {
    id: 'SUB003',
    traderId: 'TR003',
    traderName: 'Emeka Nwosu',
    traderPhone: '08062345678',
    traderReputation: 45,
    market: 'Ariaria Market',
    marketId: 'ariaria',
    item: 'Palm Oil (25L)',
    itemCategory: 'Oils',
    price: 95000,
    unit: 'jerry can',
    baselinePrice: 72000,
    priceVariance: 31.9,
    gpsValid: false,
    gpsDistance: 2500,
    status: 'disputed',
    validatorVotes: { approve: 1, reject: 2 },
    submittedAt: new Date(Date.now() - 45 * 60 * 1000),
    fraudFlags: ['Price outside range', 'GPS validation failed'],
    notes: 'Trader claims market relocation',
  },
  {
    id: 'SUB004',
    traderId: 'TR004',
    traderName: 'Funke Ibrahim',
    traderPhone: '08073456789',
    traderReputation: 78,
    market: 'Wuse Market',
    marketId: 'wuse',
    item: 'Beans (bag)',
    itemCategory: 'Grains',
    price: 125000,
    unit: 'bag',
    baselinePrice: 120000,
    priceVariance: 4.2,
    gpsValid: true,
    gpsDistance: 85,
    status: 'pending',
    validatorVotes: { approve: 0, reject: 0 },
    submittedAt: new Date(Date.now() - 10 * 60 * 1000),
    fraudFlags: [],
  },
  {
    id: 'SUB005',
    traderId: 'TR005',
    traderName: 'Yusuf Abubakar',
    traderPhone: '08084567890',
    traderReputation: 88,
    market: 'Kano Main Market',
    marketId: 'kano',
    item: 'Groundnut Oil (25L)',
    itemCategory: 'Oils',
    price: 68000,
    unit: 'jerry can',
    baselinePrice: 65000,
    priceVariance: 4.6,
    gpsValid: true,
    gpsDistance: 200,
    status: 'approved',
    validatorVotes: { approve: 3, reject: 0 },
    submittedAt: new Date(Date.now() - 60 * 60 * 1000),
    fraudFlags: [],
  },
  {
    id: 'SUB006',
    traderId: 'TR006',
    traderName: 'Aisha Mohammed',
    traderPhone: '08095678901',
    traderReputation: 32,
    market: 'Mile 12 Market',
    marketId: 'mile12',
    item: 'Garri (bag)',
    itemCategory: 'Grains',
    price: 28000,
    unit: 'bag',
    baselinePrice: 35000,
    priceVariance: -20.0,
    gpsValid: true,
    gpsDistance: 75,
    status: 'rejected',
    validatorVotes: { approve: 0, reject: 3 },
    submittedAt: new Date(Date.now() - 90 * 60 * 1000),
    fraudFlags: ['Price suspiciously low', 'Low reputation trader'],
  },
];

const statusDistribution = [
  { name: 'Approved', value: 2847, color: '#22c55e' },
  { name: 'Pending', value: 234, color: '#eab308' },
  { name: 'Validating', value: 156, color: '#3b82f6' },
  { name: 'Rejected', value: 89, color: '#ef4444' },
  { name: 'Disputed', value: 12, color: '#f97316' },
];

const hourlySubmissions = [
  { hour: '6AM', count: 45 },
  { hour: '8AM', count: 120 },
  { hour: '10AM', count: 280 },
  { hour: '12PM', count: 350 },
  { hour: '2PM', count: 320 },
  { hour: '4PM', count: 250 },
  { hour: '6PM', count: 150 },
  { hour: '8PM', count: 60 },
];

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>(generateMockSubmissions());
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [marketFilter, setMarketFilter] = useState('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Stats
  const stats = {
    totalToday: 3842,
    pending: 234,
    validating: 156,
    approved: 2847,
    rejected: 89,
    disputed: 12,
    approvalRate: 94.7,
    avgValidationTime: 4.2,
  };

  // Refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSubmissions(generateMockSubmissions());
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Export
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      // Export submissions data
      const exportData = submissions.map(s => ({
        id: s.id,
        userName: s.traderName,
        userType: 'trader',
        phone: s.traderPhone,
        amount: s.price,
        bankName: s.market,
        accountNumber: s.item,
        accountName: s.status,
        status: s.status,
        reference: s.id,
        createdAt: s.submittedAt,
        processedAt: s.submittedAt,
      }));
      exportPayouts(exportData);
    } catch (error) {
      console.error('Error exporting:', error);
    } finally {
      setIsExporting(false);
    }
  }, [submissions]);

  // Approve submission
  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSubmissions(prev => prev.map(s =>
        s.id === id ? { ...s, status: 'approved' as const } : s
      ));
      setShowDetailModal(false);
    } finally {
      setProcessingId(null);
    }
  };

  // Reject submission
  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSubmissions(prev => prev.map(s =>
        s.id === id ? { ...s, status: 'rejected' as const } : s
      ));
      setShowDetailModal(false);
    } finally {
      setProcessingId(null);
    }
  };

  // Filter submissions
  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch =
      sub.traderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    const matchesMarket = marketFilter === 'all' || sub.marketId === marketFilter;
    return matchesSearch && matchesStatus && matchesMarket;
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500/20 text-green-500';
      case 'pending': return 'bg-yellow-500/20 text-yellow-500';
      case 'validating': return 'bg-blue-500/20 text-blue-500';
      case 'rejected': return 'bg-red-500/20 text-red-500';
      case 'disputed': return 'bg-orange-500/20 text-orange-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  const getVarianceColor = (variance: number) => {
    if (Math.abs(variance) <= 10) return 'text-green-500';
    if (Math.abs(variance) <= 20) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Submissions Review</h1>
          <p className="text-gray-400 text-sm">Review, approve, or reject price submissions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live Data
            <span className="text-gray-500">Updated {formatTimeAgo(lastUpdated)}</span>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1f2e] border border-gray-700 rounded-lg hover:bg-[#252b3b] transition-colors disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
            {isExporting ? 'Exporting...' : 'Export'}
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
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">TODAY'S SUBMISSIONS</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{stats.totalToday.toLocaleString()}</p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">PENDING REVIEW</span>
            <Clock className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">IN VALIDATION</span>
            <History className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-500">{stats.validating}</p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">DISPUTED</span>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-orange-500">{stats.disputed}</p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs">APPROVAL RATE</span>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-500">{stats.approvalRate}%</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">Submissions by Hour (Today)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlySubmissions}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="hour" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #374151' }} />
                <Area type="monotone" dataKey="count" stroke="#22c55e" fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">Status Distribution</h3>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #374151' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {statusDistribution.map((s) => (
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
            placeholder="Search by trader, item, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-green-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#1a1f2e] border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="validating">Validating</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="disputed">Disputed</option>
        </select>

        <select
          value={marketFilter}
          onChange={(e) => setMarketFilter(e.target.value)}
          className="bg-[#1a1f2e] border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500"
        >
          <option value="all">All Markets</option>
          <option value="mile12">Mile 12 Market</option>
          <option value="onitsha">Onitsha Main Market</option>
          <option value="ariaria">Ariaria Market</option>
          <option value="wuse">Wuse Market</option>
          <option value="kano">Kano Main Market</option>
        </select>
      </div>

      {/* Submissions Table */}
      <div className="bg-[#1a1f2e] rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-gray-400 text-sm font-medium p-4">TRADER</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">ITEM</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">MARKET</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">PRICE</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">VARIANCE</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">GPS</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">VOTES</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">STATUS</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredSubmissions.map((sub) => (
              <tr key={sub.id} className="border-b border-gray-800/50 hover:bg-[#252b3b]/50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${sub.traderReputation >= 70 ? 'bg-green-500/20 text-green-500' : sub.traderReputation >= 40 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500'}`}>
                      {sub.traderName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-medium">{sub.traderName}</p>
                      <p className="text-xs text-gray-400">Rep: {sub.traderReputation}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <p className="font-medium">{sub.item}</p>
                  <p className="text-xs text-gray-500">{sub.itemCategory}</p>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1 text-gray-300">
                    <MapPin className="w-3 h-3 text-gray-500" />
                    {sub.market}
                  </div>
                </td>
                <td className="p-4">
                  <p className="font-medium text-green-500">{formatCurrency(sub.price)}</p>
                  <p className="text-xs text-gray-500">Base: {formatCurrency(sub.baselinePrice)}</p>
                </td>
                <td className="p-4">
                  <div className={`flex items-center gap-1 ${getVarianceColor(sub.priceVariance)}`}>
                    {sub.priceVariance > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {sub.priceVariance > 0 ? '+' : ''}{sub.priceVariance.toFixed(1)}%
                  </div>
                </td>
                <td className="p-4">
                  {sub.gpsValid ? (
                    <span className="text-green-500 text-sm flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> {sub.gpsDistance}m
                    </span>
                  ) : (
                    <span className="text-red-500 text-sm flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> {sub.gpsDistance}m
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 flex items-center gap-0.5">
                      <ThumbsUp className="w-3 h-3" /> {sub.validatorVotes.approve}
                    </span>
                    <span className="text-red-500 flex items-center gap-0.5">
                      <ThumbsDown className="w-3 h-3" /> {sub.validatorVotes.reject}
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(sub.status)}`}>
                    {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                  </span>
                  {sub.fraudFlags.length > 0 && (
                    <div className="mt-1">
                      <AlertTriangle className="w-3 h-3 text-orange-500 inline" />
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedSubmission(sub);
                        setShowDetailModal(true);
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4 text-gray-400" />
                    </button>
                    {(sub.status === 'pending' || sub.status === 'disputed') && (
                      <>
                        <button
                          onClick={() => handleApprove(sub.id)}
                          disabled={processingId === sub.id}
                          className="p-1.5 hover:bg-green-500/20 rounded-lg transition-colors disabled:opacity-50"
                          title="Approve"
                        >
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </button>
                        <button
                          onClick={() => handleReject(sub.id)}
                          disabled={processingId === sub.id}
                          className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4 text-red-500" />
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

      {/* Detail Modal */}
      {showDetailModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1f2e] rounded-2xl w-full max-w-2xl border border-gray-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-[#1a1f2e]">
              <div>
                <h2 className="text-xl font-bold">Submission Details</h2>
                <p className="text-sm text-gray-400">{selectedSubmission.id}</p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Fraud Flags */}
              {selectedSubmission.fraudFlags.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <span className="font-medium text-red-500">Fraud Flags Detected</span>
                  </div>
                  <ul className="space-y-1">
                    {selectedSubmission.fraudFlags.map((flag, i) => (
                      <li key={i} className="text-sm text-red-400">• {flag}</li>
                    ))}
                  </ul>
                  {selectedSubmission.notes && (
                    <div className="mt-3 pt-3 border-t border-red-500/20">
                      <p className="text-sm text-gray-400">
                        <span className="text-gray-500">Trader Note:</span> {selectedSubmission.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Trader Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0d1117] rounded-xl p-4">
                  <p className="text-gray-500 text-xs mb-1">TRADER</p>
                  <p className="font-medium">{selectedSubmission.traderName}</p>
                  <p className="text-sm text-gray-400">{selectedSubmission.traderPhone}</p>
                  <div className={`mt-2 text-sm ${selectedSubmission.traderReputation >= 70 ? 'text-green-500' : selectedSubmission.traderReputation >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                    Reputation: {selectedSubmission.traderReputation}/100
                  </div>
                </div>
                <div className="bg-[#0d1117] rounded-xl p-4">
                  <p className="text-gray-500 text-xs mb-1">MARKET</p>
                  <p className="font-medium">{selectedSubmission.market}</p>
                  <div className={`mt-2 text-sm flex items-center gap-1 ${selectedSubmission.gpsValid ? 'text-green-500' : 'text-red-500'}`}>
                    <MapPin className="w-3 h-3" />
                    {selectedSubmission.gpsValid ? 'GPS Valid' : 'GPS Invalid'} ({selectedSubmission.gpsDistance}m)
                  </div>
                </div>
              </div>

              {/* Price Info */}
              <div className="bg-[#0d1117] rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-2">PRICE SUBMISSION</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Item</p>
                    <p className="font-medium">{selectedSubmission.item}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Submitted Price</p>
                    <p className="font-medium text-green-500">{formatCurrency(selectedSubmission.price)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Baseline Price</p>
                    <p className="font-medium">{formatCurrency(selectedSubmission.baselinePrice)}</p>
                  </div>
                </div>
                <div className={`mt-3 text-sm ${getVarianceColor(selectedSubmission.priceVariance)}`}>
                  Variance: {selectedSubmission.priceVariance > 0 ? '+' : ''}{selectedSubmission.priceVariance.toFixed(1)}%
                  {Math.abs(selectedSubmission.priceVariance) > 30 && (
                    <span className="text-red-500 ml-2">(Outside acceptable range)</span>
                  )}
                </div>
              </div>

              {/* Validator Votes */}
              <div className="bg-[#0d1117] rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-2">VALIDATOR VOTES</p>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="w-5 h-5 text-green-500" />
                    <span className="text-xl font-bold text-green-500">{selectedSubmission.validatorVotes.approve}</span>
                    <span className="text-gray-400">Approve</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ThumbsDown className="w-5 h-5 text-red-500" />
                    <span className="text-xl font-bold text-red-500">{selectedSubmission.validatorVotes.reject}</span>
                    <span className="text-gray-400">Reject</span>
                  </div>
                </div>
              </div>

              {/* Timestamp */}
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Calendar className="w-4 h-4" />
                Submitted {formatTimeAgo(selectedSubmission.submittedAt)}
              </div>
            </div>

            {/* Modal Footer */}
            {(selectedSubmission.status === 'pending' || selectedSubmission.status === 'disputed') && (
              <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
                <button
                  onClick={() => handleReject(selectedSubmission.id)}
                  disabled={processingId === selectedSubmission.id}
                  className="px-6 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {processingId === selectedSubmission.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(selectedSubmission.id)}
                  disabled={processingId === selectedSubmission.id}
                  className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {processingId === selectedSubmission.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
