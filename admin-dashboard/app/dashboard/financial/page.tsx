'use client';

import { useState, useCallback } from 'react';
import { 
  Wallet, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle,
  Download, RefreshCw, AlertTriangle, CreditCard, Building2, 
  Loader2, ChevronRight, Filter, Search, Eye
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, PieChart, Pie, Cell 
} from 'recharts';
import { exportPayouts, exportFinancialReport } from '@/lib/export-utils';

// Nigerian Banks with colors
const BANKS = [
  { code: 'gtb', name: 'GTBank', color: '#FF6600', amount: 18500000, txns: 4234, success: 99.2 },
  { code: 'access', name: 'Access Bank', color: '#F26522', amount: 12300000, txns: 2847, success: 98.8 },
  { code: 'firstbank', name: 'First Bank', color: '#002D62', amount: 8700000, txns: 1923, success: 97.5 },
  { code: 'zenith', name: 'Zenith Bank', color: '#ED1C24', amount: 6172300, txns: 1456, success: 96.1 },
  { code: 'uba', name: 'UBA', color: '#E31837', amount: 4500000, txns: 1102, success: 98.1 },
  { code: 'kuda', name: 'Kuda Bank', color: '#40196D', amount: 3200000, txns: 987, success: 99.5 },
  { code: 'opay', name: 'OPay', color: '#00B140', amount: 2800000, txns: 856, success: 99.8 },
];

const weeklyData = [
  { day: 'Mon', traders: 850000, validators: 420000 },
  { day: 'Tue', traders: 920000, validators: 380000 },
  { day: 'Wed', traders: 780000, validators: 450000 },
  { day: 'Thu', traders: 1250000, validators: 620000 },
  { day: 'Fri', traders: 1850000, validators: 920000 },
  { day: 'Sat', traders: 650000, validators: 280000 },
  { day: 'Sun', traders: 420000, validators: 180000 },
];

// Mock pending payouts
const generatePendingPayouts = () => [
  { id: 'PAY001', userName: 'Chidi Okonkwo', userType: 'trader', phone: '08031234567', amount: 4500, bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Chidi Okonkwo', status: 'pending', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  { id: 'PAY002', userName: 'Dr. Amaka Eze', userType: 'validator', phone: '08091112222', amount: 8500, bankName: 'Access Bank', accountNumber: '9876543210', accountName: 'Amaka Eze', status: 'pending', createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
  { id: 'PAY003', userName: 'Ngozi Adeyemi', userType: 'trader', phone: '08051234567', amount: 2500, bankName: 'First Bank', accountNumber: '1234567890', accountName: 'Ngozi Adeyemi', status: 'processing', createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000) },
  { id: 'PAY004', userName: 'Mallam Sani', userType: 'validator', phone: '08102223333', amount: 4200, bankName: 'Zenith Bank', accountNumber: '5678901234', accountName: 'Sani Ibrahim', status: 'pending', createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000) },
  { id: 'PAY005', userName: 'Emeka Nwosu', userType: 'trader', phone: '08062345678', amount: 3200, bankName: 'UBA', accountNumber: '6789012345', accountName: 'Emeka Nwosu', status: 'failed', createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), error: 'Invalid account number' },
];

export default function FinancialOpsPage() {
  const [payouts, setPayouts] = useState(generatePendingPayouts());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Stats
  const stats = {
    pendingPayouts: 2847500,
    pendingUsers: 847,
    paidToday: 1234500,
    paidTodayTxns: 234,
    thisMonth: 45672300,
    successRate: 98.5,
    avgTime: 3.2,
  };

  const tradersPending = 1847500;
  const validatorsPending = 1000000;

  // Refresh data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setPayouts(generatePendingPayouts());
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Export report
  const handleExportReport = useCallback(async () => {
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      exportFinancialReport({
        summary: {
          totalDisbursed: stats.thisMonth,
          pendingPayouts: stats.pendingPayouts,
          tradersPaid: 6234,
          validatorsPaid: 1847,
          successRate: stats.successRate,
        },
        transactions: payouts,
        period: 'February 2026',
      });
    } catch (error) {
      console.error('Error exporting:', error);
    } finally {
      setIsExporting(false);
    }
  }, [payouts, stats]);

  // Process single payout
  const handleProcessPayout = async (id: string) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setPayouts(prev => prev.map(p => 
        p.id === id ? { ...p, status: 'completed', processedAt: new Date() } : p
      ));
    } catch (error) {
      console.error('Error processing payout:', error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Process all pending
  const handleProcessAll = async () => {
    setIsProcessingAll(true);
    const pendingPayouts = payouts.filter(p => p.status === 'pending');
    
    for (const payout of pendingPayouts) {
      setProcessingIds(prev => new Set(prev).add(payout.id));
      await new Promise(resolve => setTimeout(resolve, 500));
      setPayouts(prev => prev.map(p => 
        p.id === payout.id ? { ...p, status: 'completed', processedAt: new Date() } : p
      ));
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(payout.id);
        return next;
      });
    }
    
    setIsProcessingAll(false);
  };

  // Retry failed
  const handleRetry = async (id: string) => {
    setPayouts(prev => prev.map(p => 
      p.id === id ? { ...p, status: 'pending', error: undefined } : p
    ));
    await handleProcessPayout(id);
  };

  // Filter payouts
  const filteredPayouts = payouts.filter(payout => {
    const matchesSearch = payout.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         payout.phone.includes(searchQuery) ||
                         payout.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || payout.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const failedCount = payouts.filter(p => p.status === 'failed').length;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Financial Operations</h1>
          <p className="text-gray-400 text-sm">Manage payouts, track transactions, and monitor financial health</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live Data
          </div>
          
          <button
            onClick={handleExportReport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1f2e] border border-gray-700 rounded-lg hover:bg-[#252b3b] transition-colors disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
            {isExporting ? 'Exporting...' : 'Export Report'}
          </button>
          
          <button
            onClick={handleProcessAll}
            disabled={isProcessingAll || payouts.filter(p => p.status === 'pending').length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessingAll ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4" />
                Process All Pending
              </>
            )}
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-[#1a1f2e] border border-gray-700 rounded-lg hover:bg-[#252b3b] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <div className="px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg text-green-500 text-sm font-medium">
            SUPER ADMIN
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {failedCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <div>
            <p className="text-red-500 font-medium">Failed Payouts Require Attention</p>
            <p className="text-red-400/70 text-sm">{failedCount} payouts have failed and need to be retried or manually resolved.</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <div className="flex justify-between items-start mb-3">
            <span className="text-gray-400 text-sm">PENDING PAYOUTS</span>
            <Clock className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold">₦{(stats.pendingPayouts / 1000000).toFixed(1)}M</p>
          <p className="text-sm text-gray-400">{stats.pendingUsers} users</p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <div className="flex justify-between items-start mb-3">
            <span className="text-gray-400 text-sm">PAID TODAY</span>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold">₦{(stats.paidToday / 1000000).toFixed(1)}M</p>
          <p className="text-sm text-gray-400">{stats.paidTodayTxns} transactions</p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <div className="flex justify-between items-start mb-3">
            <span className="text-gray-400 text-sm">THIS MONTH</span>
            <CreditCard className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold">₦{(stats.thisMonth / 1000000).toFixed(1)}M</p>
          <p className="text-sm text-gray-400">total disbursed</p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <div className="flex justify-between items-start mb-3">
            <span className="text-gray-400 text-sm">SUCCESS RATE</span>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold">{stats.successRate}%</p>
          <p className="text-sm text-gray-400">{stats.avgTime} mins avg time</p>
        </div>
      </div>

      {/* Pending Breakdown */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-gray-400">Traders Pending</span>
          </div>
          <p className="text-2xl font-bold">₦{(tradersPending / 1000000).toFixed(2)}M</p>
          <p className="text-sm text-gray-500">551 traders awaiting payout</p>
        </div>
        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span className="text-gray-400">Validators Pending</span>
          </div>
          <p className="text-2xl font-bold">₦{(validatorsPending / 1000000).toFixed(2)}M</p>
          <p className="text-sm text-gray-500">296 validators awaiting payout</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">Weekly Payout Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorTraders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorValidators" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="day" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" tickFormatter={(v) => `₦${(v/1000000).toFixed(1)}M`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #374151' }}
                  formatter={(value: number) => [`₦${value.toLocaleString()}`, '']}
                />
                <Legend />
                <Area type="monotone" dataKey="traders" name="Traders" stroke="#22c55e" fillOpacity={1} fill="url(#colorTraders)" />
                <Area type="monotone" dataKey="validators" name="Validators" stroke="#eab308" fillOpacity={1} fill="url(#colorValidators)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Bank */}
        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">By Bank</h3>
          <div className="space-y-3">
            {BANKS.slice(0, 5).map((bank) => (
              <div key={bank.code} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: bank.color }}
                  >
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{bank.name}</p>
                    <p className="text-xs text-gray-500">{bank.txns.toLocaleString()} txns</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">₦{(bank.amount / 1000000).toFixed(1)}M</p>
                  <p className="text-xs text-green-500">{bank.success}% success</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payout Queue */}
      <div className="bg-[#1a1f2e] rounded-xl border border-gray-800">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Payout Queue</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#0d1117] border border-gray-700 rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-green-500 w-48"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-gray-400 text-sm font-medium p-4">USER</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">TYPE</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">AMOUNT</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">BANK DETAILS</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">STATUS</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">CREATED</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayouts.map((payout) => (
              <tr key={payout.id} className="border-b border-gray-800/50 hover:bg-[#252b3b]/50">
                <td className="p-4">
                  <div>
                    <p className="font-medium">{payout.userName}</p>
                    <p className="text-sm text-gray-400">{payout.phone}</p>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    payout.userType === 'trader' 
                      ? 'bg-green-500/20 text-green-500' 
                      : 'bg-yellow-500/20 text-yellow-500'
                  }`}>
                    {payout.userType.charAt(0).toUpperCase() + payout.userType.slice(1)}
                  </span>
                </td>
                <td className="p-4">
                  <p className="font-medium text-green-500">₦{payout.amount.toLocaleString()}</p>
                </td>
                <td className="p-4">
                  <p className="text-sm">{payout.bankName}</p>
                  <p className="text-xs text-gray-400">{payout.accountNumber} • {payout.accountName}</p>
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                    payout.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                    payout.status === 'processing' ? 'bg-blue-500/20 text-blue-500' :
                    payout.status === 'failed' ? 'bg-red-500/20 text-red-500' :
                    'bg-yellow-500/20 text-yellow-500'
                  }`}>
                    {payout.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                  </span>
                  {payout.error && (
                    <p className="text-xs text-red-400 mt-1">{payout.error}</p>
                  )}
                </td>
                <td className="p-4 text-gray-400 text-sm">{formatTimeAgo(payout.createdAt)}</td>
                <td className="p-4">
                  {payout.status === 'pending' && (
                    <button
                      onClick={() => handleProcessPayout(payout.id)}
                      disabled={processingIds.has(payout.id)}
                      className="px-3 py-1.5 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {processingIds.has(payout.id) ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>Pay<ChevronRight className="w-3 h-3" /></>
                      )}
                    </button>
                  )}
                  {payout.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(payout.id)}
                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium transition-colors"
                    >
                      Retry
                    </button>
                  )}
                  {payout.status === 'completed' && (
                    <span className="text-green-500 text-sm flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Done
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
