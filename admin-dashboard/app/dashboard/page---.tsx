'use client';

import { useState, useCallback, useEffect } from 'react';
import { 
  Users, FileText, Wallet, TrendingUp, TrendingDown, AlertTriangle,
  RefreshCw, Download, Eye, ChevronRight, BarChart3, PieChart,
  Send, Shield, Clock, CheckCircle, Building2
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, PieChart as RePieChart, Pie, Cell, BarChart, Bar 
} from 'recharts';
import { exportDashboardStats } from '@/lib/export-utils';
import Link from 'next/link';

// Mock data
const weeklyActivityData = [
  { day: 'Mon', submissions: 3200, validations: 2800, approvals: 3000 },
  { day: 'Tue', submissions: 3800, validations: 3200, approvals: 3500 },
  { day: 'Wed', submissions: 3500, validations: 3000, approvals: 3200 },
  { day: 'Thu', submissions: 4500, validations: 4000, approvals: 4200 },
  { day: 'Fri', submissions: 5200, validations: 4800, approvals: 5000 },
  { day: 'Sat', submissions: 3000, validations: 2600, approvals: 2800 },
  { day: 'Sun', submissions: 2500, validations: 2200, approvals: 2300 },
];

const marketDistribution = [
  { name: 'Mile 12', value: 35, color: '#22c55e' },
  { name: 'Onitsha', value: 25, color: '#eab308' },
  { name: 'Alaba', value: 20, color: '#3b82f6' },
  { name: 'Wuse', value: 12, color: '#a855f7' },
  { name: 'Others', value: 8, color: '#6b7280' },
];

const payoutsByBank = [
  { bank: 'GTBank', amount: 18500000 },
  { bank: 'Access', amount: 12300000 },
  { bank: 'First Bank', amount: 8700000 },
  { bank: 'Zenith', amount: 6200000 },
];

const recentActivity = [
  { id: 1, type: 'submission', user: 'Chidi Okonkwo', action: 'submitted price for Rice (50kg)', market: 'Mile 12', time: '2 mins ago' },
  { id: 2, type: 'validation', user: 'Dr. Amaka Eze', action: 'validated 5 submissions', market: 'Onitsha', time: '5 mins ago' },
  { id: 3, type: 'payout', user: 'System', action: 'processed ₦45,000 to 12 traders', market: '', time: '10 mins ago' },
  { id: 4, type: 'fraud', user: 'System', action: 'flagged suspicious activity', market: 'Alaba', time: '15 mins ago' },
  { id: 5, type: 'submission', user: 'Ngozi Adeyemi', action: 'submitted price for Tomatoes', market: 'Wuse', time: '18 mins ago' },
];

const criticalAlerts = [
  { id: 1, type: 'fraud', severity: 'critical', message: 'Multiple GPS spoofing attempts detected', count: 3 },
  { id: 2, type: 'payout', severity: 'warning', message: 'Failed payouts need attention', count: 12 },
  { id: 3, type: 'validation', severity: 'info', message: 'Validation backlog building up', count: 45 },
];

export default function DashboardPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  // Stats that would come from API
  const [stats, setStats] = useState({
    activeTraders: 6200,
    totalTraders: 8432,
    traderGrowth: 12.4,
    newTradersToday: 23,
    
    submissionsToday: 3800,
    pendingSubmissions: 234,
    submissionGrowth: 8.7,
    
    pendingPayouts: 2847500,
    pendingPayoutUsers: 847,
    payoutChange: -2.3,
    
    approvalRate: 94.7,
    approvalChange: -0.5,
    
    totalMarkets: 226,
    totalValidators: 2156,
  });

  // Refresh data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update with slightly different random data to show refresh working
      setStats(prev => ({
        ...prev,
        activeTraders: prev.activeTraders + Math.floor(Math.random() * 10) - 5,
        submissionsToday: prev.submissionsToday + Math.floor(Math.random() * 50),
        pendingPayouts: prev.pendingPayouts + Math.floor(Math.random() * 10000) - 5000,
      }));
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Export dashboard data
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      exportDashboardStats(stats);
    } catch (error) {
      console.error('Error exporting:', error);
    } finally {
      setIsExporting(false);
    }
  }, [stats]);

  // Auto refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [handleRefresh]);

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return 'Updated just now';
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Executive Overview</h1>
          <p className="text-gray-400 text-sm">Welcome back, Olawale Sobogungodo</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live Data
            <span className="text-gray-500">{formatTimeAgo(lastUpdated)}</span>
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
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          <div className="px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg text-green-500 text-sm font-medium">
            SUPER ADMIN
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <div className="flex justify-between items-start mb-3">
            <span className="text-gray-400 text-sm">ACTIVE TRADERS</span>
            <Users className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold">{stats.activeTraders.toLocaleString()}</p>
          <p className="text-sm text-gray-400">of {stats.totalTraders.toLocaleString()}</p>
          <div className="flex items-center gap-1 mt-2 text-green-500 text-sm">
            <TrendingUp className="w-4 h-4" />
            +{stats.traderGrowth}%
            <span className="text-gray-500">+{stats.newTradersToday} today</span>
          </div>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <div className="flex justify-between items-start mb-3">
            <span className="text-gray-400 text-sm">SUBMISSIONS TODAY</span>
            <FileText className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold">{stats.submissionsToday.toLocaleString()}</p>
          <p className="text-sm text-gray-400">{stats.pendingSubmissions} pending</p>
          <div className="flex items-center gap-1 mt-2 text-green-500 text-sm">
            <TrendingUp className="w-4 h-4" />
            +{stats.submissionGrowth}%
            <span className="text-gray-500">vs yesterday</span>
          </div>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <div className="flex justify-between items-start mb-3">
            <span className="text-gray-400 text-sm">PENDING PAYOUTS</span>
            <Wallet className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold">₦{(stats.pendingPayouts / 1000000).toFixed(1)}M</p>
          <p className="text-sm text-gray-400">{stats.pendingPayoutUsers} users</p>
          <div className="flex items-center gap-1 mt-2 text-red-500 text-sm">
            <TrendingDown className="w-4 h-4" />
            {stats.payoutChange}%
            <span className="text-gray-500">vs last week</span>
          </div>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <div className="flex justify-between items-start mb-3">
            <span className="text-gray-400 text-sm">APPROVAL RATE</span>
            <TrendingUp className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-3xl font-bold">{stats.approvalRate}%</p>
          <p className="text-sm text-gray-400">last 7 days</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Weekly Activity */}
        <div className="col-span-2 bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">Weekly Activity Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyActivityData}>
                <defs>
                  <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorValidations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorApprovals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="day" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #374151' }} />
                <Legend />
                <Area type="monotone" dataKey="submissions" name="Submissions" stroke="#22c55e" fillOpacity={1} fill="url(#colorSubmissions)" />
                <Area type="monotone" dataKey="validations" name="Validations" stroke="#eab308" fillOpacity={1} fill="url(#colorValidations)" />
                <Area type="monotone" dataKey="approvals" name="Approvals" stroke="#3b82f6" fillOpacity={1} fill="url(#colorApprovals)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Market Distribution */}
        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">Market Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={marketDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {marketDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #374151' }} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.totalMarkets}</p>
            <p className="text-sm text-gray-400">MARKETS</p>
          </div>
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            {marketDistribution.map((m) => (
              <div key={m.name} className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                <span className="text-gray-400">{m.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Payouts by Bank */}
        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Payouts by Bank</h3>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">This Month</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payoutsByBank} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" tickFormatter={(v) => `₦${(v/1000000).toFixed(0)}M`} />
                <YAxis type="category" dataKey="bank" stroke="#9ca3af" width={70} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #374151' }}
                  formatter={(value: number) => [`₦${value.toLocaleString()}`, 'Amount']}
                />
                <Bar dataKey="amount" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link 
              href="/dashboard/financial"
              className="p-4 bg-[#0d1117] rounded-lg hover:bg-[#252b3b] transition-colors group"
            >
              <Send className="w-6 h-6 text-green-500 mb-2" />
              <p className="font-medium">Process Payouts</p>
              <p className="text-xs text-gray-500">{stats.pendingPayoutUsers} pending</p>
            </Link>
            <Link 
              href="/dashboard/fraud"
              className="p-4 bg-[#0d1117] rounded-lg hover:bg-[#252b3b] transition-colors group"
            >
              <AlertTriangle className="w-6 h-6 text-red-500 mb-2" />
              <p className="font-medium">Review Fraud</p>
              <p className="text-xs text-gray-500">3 critical</p>
            </Link>
            <Link 
              href="/dashboard/users"
              className="p-4 bg-[#0d1117] rounded-lg hover:bg-[#252b3b] transition-colors group"
            >
              <Users className="w-6 h-6 text-blue-500 mb-2" />
              <p className="font-medium">Manage Users</p>
              <p className="text-xs text-gray-500">{stats.totalTraders.toLocaleString()} traders</p>
            </Link>
            <Link 
              href="/dashboard/system"
              className="p-4 bg-[#0d1117] rounded-lg hover:bg-[#252b3b] transition-colors group"
            >
              <Shield className="w-6 h-6 text-purple-500 mb-2" />
              <p className="font-medium">System Health</p>
              <p className="text-xs text-gray-500">All operational</p>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Activity</h3>
            <button className="text-xs text-green-500 hover:underline">View All</button>
          </div>
          <div className="space-y-3">
            {recentActivity.slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#0d1117] transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  activity.type === 'submission' ? 'bg-green-500/20 text-green-500' :
                  activity.type === 'validation' ? 'bg-yellow-500/20 text-yellow-500' :
                  activity.type === 'payout' ? 'bg-blue-500/20 text-blue-500' :
                  'bg-red-500/20 text-red-500'
                }`}>
                  {activity.type === 'submission' && <FileText className="w-4 h-4" />}
                  {activity.type === 'validation' && <CheckCircle className="w-4 h-4" />}
                  {activity.type === 'payout' && <Wallet className="w-4 h-4" />}
                  {activity.type === 'fraud' && <AlertTriangle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{activity.user}</span>{' '}
                    <span className="text-gray-400">{activity.action}</span>
                  </p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
