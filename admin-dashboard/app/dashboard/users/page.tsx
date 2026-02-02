'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Users, Shield, Search, Download, RefreshCw, UserPlus, Eye, Ban,
  Star, TrendingUp, TrendingDown, Filter, MoreVertical, Phone, MapPin
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import AddUserModal from '@/components/modals/AddUserModal';
import { exportTraders, exportValidators } from '@/lib/export-utils';

// Mock data - replace with API calls
const generateMockTraders = () => [
  { id: 1, name: 'Chidi Okonkwo', phone: '0803 123 4567', market: 'Mile 12 Market', reputation: 85, submissions: 234, approved: 218, balance: 4500, bankName: 'GTBank', accountNumber: '0123456789', status: 'active', lastActive: new Date(Date.now() - 6 * 60 * 60 * 1000), createdAt: new Date('2024-06-15') },
  { id: 2, name: 'Ngozi Adeyemi', phone: '0805 123 4567', market: 'Onitsha Main Market', reputation: 92, submissions: 456, approved: 442, balance: 2500, bankName: 'Access Bank', accountNumber: '0987654321', status: 'active', lastActive: new Date(Date.now() - 4 * 60 * 60 * 1000), createdAt: new Date('2024-05-20') },
  { id: 3, name: 'Emeka Nwosu', phone: '0806 234 5678', market: 'Ariaria Market', reputation: 78, submissions: 189, approved: 165, balance: 3200, bankName: 'First Bank', accountNumber: '1234567890', status: 'active', lastActive: new Date(Date.now() - 12 * 60 * 60 * 1000), createdAt: new Date('2024-07-01') },
  { id: 4, name: 'Funke Ibrahim', phone: '0807 345 6789', market: 'Wuse Market', reputation: 65, submissions: 98, approved: 72, balance: 1800, bankName: 'Zenith Bank', accountNumber: '2345678901', status: 'suspended', lastActive: new Date(Date.now() - 48 * 60 * 60 * 1000), createdAt: new Date('2024-08-10') },
  { id: 5, name: 'Yusuf Abubakar', phone: '0808 456 7890', market: 'Kano Main Market', reputation: 88, submissions: 312, approved: 298, balance: 5100, bankName: 'UBA', accountNumber: '3456789012', status: 'active', lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000), createdAt: new Date('2024-04-05') },
];

const generateMockValidators = () => [
  { id: 1, name: 'Dr. Amaka Eze', phone: '0809 111 2222', type: 'Expert', accuracy: 94.5, totalValidations: 1245, correctVotes: 1177, balance: 8500, bankName: 'GTBank', accountNumber: '5678901234', status: 'active', lastActive: new Date(Date.now() - 1 * 60 * 60 * 1000), createdAt: new Date('2024-03-15') },
  { id: 2, name: 'Mallam Sani', phone: '0810 222 3333', type: 'Community', accuracy: 89.2, totalValidations: 876, correctVotes: 781, balance: 4200, bankName: 'First Bank', accountNumber: '6789012345', status: 'active', lastActive: new Date(Date.now() - 3 * 60 * 60 * 1000), createdAt: new Date('2024-04-20') },
  { id: 3, name: 'Chief Obi Nnamdi', phone: '0811 333 4444', type: 'Official', accuracy: 97.1, totalValidations: 2034, correctVotes: 1975, balance: 12300, bankName: 'Zenith Bank', accountNumber: '7890123456', status: 'active', lastActive: new Date(Date.now() - 30 * 60 * 1000), createdAt: new Date('2024-02-10') },
  { id: 4, name: 'Mrs. Blessing Okoro', phone: '0812 444 5555', type: 'Community', accuracy: 82.4, totalValidations: 543, correctVotes: 447, balance: 2100, bankName: 'Access Bank', accountNumber: '8901234567', status: 'active', lastActive: new Date(Date.now() - 8 * 60 * 60 * 1000), createdAt: new Date('2024-06-25') },
];

const weeklyData = [
  { day: 'Mon', traders: 45, validators: 12 },
  { day: 'Tue', traders: 52, validators: 18 },
  { day: 'Wed', traders: 38, validators: 15 },
  { day: 'Thu', traders: 65, validators: 22 },
  { day: 'Fri', traders: 48, validators: 14 },
  { day: 'Sat', traders: 32, validators: 8 },
  { day: 'Sun', traders: 28, validators: 6 },
];

export default function UserManagementPage() {
  const [activeTab, setActiveTab] = useState<'traders' | 'validators'>('traders');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  const [traders, setTraders] = useState(generateMockTraders());
  const [validators, setValidators] = useState(generateMockValidators());

  // Calculate stats
  const traderStats = {
    total: 8432,
    active: 6218,
    avgReputation: 72.4,
    newToday: 23,
  };

  const validatorStats = {
    total: 2156,
    gold: 234,
    avgAccuracy: 91.2,
    newToday: 8,
  };

  // Refresh data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      setTraders(generateMockTraders());
      setValidators(generateMockValidators());
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Export data
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (activeTab === 'traders') {
        const exportData = traders.map(t => ({
          ...t,
          rejected: t.submissions - t.approved,
        }));
        exportTraders(exportData);
      } else {
        exportValidators(validators);
      }
    } catch (error) {
      console.error('Error exporting:', error);
    } finally {
      setIsExporting(false);
    }
  }, [activeTab, traders, validators]);

  // Add user success
  const handleAddUserSuccess = (newUser: any) => {
    if (activeTab === 'traders') {
      setTraders(prev => [newUser, ...prev]);
    } else {
      setValidators(prev => [newUser, ...prev]);
    }
  };

  // Filter data
  const filteredTraders = traders.filter(trader => {
    const matchesSearch = trader.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         trader.phone.includes(searchQuery);
    const matchesStatus = statusFilter === 'All' || trader.status === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const filteredValidators = validators.filter(validator => {
    const matchesSearch = validator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         validator.phone.includes(searchQuery);
    const matchesStatus = statusFilter === 'All' || validator.status === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-gray-400 text-sm">Manage traders, validators, and user permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live Data
            <span className="text-gray-500">Last updated {formatTimeAgo(lastUpdated)}</span>
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
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg font-medium transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add User
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

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <div className="flex justify-between items-start mb-3">
            <span className="text-gray-400 text-sm">TOTAL TRADERS</span>
            <Users className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold">{traderStats.total.toLocaleString()}</p>
          <p className="text-sm text-gray-400">{traderStats.active.toLocaleString()} active</p>
          <div className="flex items-center gap-1 mt-2 text-green-500 text-sm">
            <TrendingUp className="w-4 h-4" />
            +12.4%
            <span className="text-gray-500">+{traderStats.newToday} today</span>
          </div>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <div className="flex justify-between items-start mb-3">
            <span className="text-gray-400 text-sm">TOTAL VALIDATORS</span>
            <Shield className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold">{validatorStats.total.toLocaleString()}</p>
          <p className="text-sm text-gray-400">{validatorStats.gold} gold tier</p>
          <div className="flex items-center gap-1 mt-2 text-green-500 text-sm">
            <TrendingUp className="w-4 h-4" />
            +5.2%
            <span className="text-gray-500">+{validatorStats.newToday} today</span>
          </div>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <div className="flex justify-between items-start mb-3">
            <span className="text-gray-400 text-sm">AVG TRADER REPUTATION</span>
            <Star className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-3xl font-bold">{traderStats.avgReputation}</p>
          <p className="text-sm text-gray-400">out of 100</p>
        </div>

        <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800">
          <div className="flex justify-between items-start mb-3">
            <span className="text-gray-400 text-sm">AVG VALIDATOR ACCURACY</span>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold">{validatorStats.avgAccuracy}%</p>
          <p className="text-sm text-gray-400">vote accuracy</p>
        </div>
      </div>

      {/* Weekly Chart */}
      <div className="bg-[#1a1f2e] rounded-xl p-5 border border-gray-800 mb-6">
        <h3 className="text-lg font-semibold mb-4">Weekly Registration Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="day" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #374151' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Bar dataKey="traders" name="Traders" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="validators" name="Validators" fill="#eab308" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => setActiveTab('traders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'traders'
              ? 'bg-green-500 text-white'
              : 'bg-[#1a1f2e] text-gray-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Traders ({traderStats.total.toLocaleString()})
        </button>
        <button
          onClick={() => setActiveTab('validators')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'validators'
              ? 'bg-green-500 text-white'
              : 'bg-[#1a1f2e] text-gray-400 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          Validators ({validatorStats.total.toLocaleString()})
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#1a1f2e] border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-500"
          >
            <option>All</option>
            <option>Active</option>
            <option>Suspended</option>
            <option>Pending</option>
          </select>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md bg-[#1a1f2e] border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-green-500"
        />
      </div>

      {/* Table */}
      <div className="bg-[#1a1f2e] rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-gray-400 text-sm font-medium p-4">
                {activeTab === 'traders' ? 'TRADER' : 'VALIDATOR'}
              </th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">
                {activeTab === 'traders' ? 'MARKET' : 'TYPE'}
              </th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">
                {activeTab === 'traders' ? 'Reputation' : 'Accuracy'}
              </th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">
                {activeTab === 'traders' ? 'Submissions' : 'Validations'}
              </th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">Balance</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">STATUS</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">LAST ACTIVE</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {activeTab === 'traders' ? (
              filteredTraders.map((trader) => (
                <tr key={trader.id} className="border-b border-gray-800/50 hover:bg-[#252b3b]/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 font-medium">
                        {trader.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium">{trader.name}</p>
                        <p className="text-sm text-gray-400">{trader.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 text-gray-300">
                      <MapPin className="w-3 h-3 text-gray-500" />
                      {trader.market}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${trader.reputation >= 80 ? 'text-green-500' : trader.reputation >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {trader.reputation}
                      </span>
                      <Star className="w-4 h-4 text-yellow-500" />
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-gray-300">{trader.approved}</span>
                    <span className="text-gray-500"> / {trader.submissions}</span>
                  </td>
                  <td className="p-4 font-medium text-green-500">₦{trader.balance.toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      trader.status === 'active' 
                        ? 'bg-green-500/20 text-green-500' 
                        : 'bg-red-500/20 text-red-500'
                    }`}>
                      {trader.status.charAt(0).toUpperCase() + trader.status.slice(1)}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400">{formatTimeAgo(trader.lastActive)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors" title="View Profile">
                        <Eye className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors" title="Suspend User">
                        <Ban className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              filteredValidators.map((validator) => (
                <tr key={validator.id} className="border-b border-gray-800/50 hover:bg-[#252b3b]/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-500 font-medium">
                        {validator.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium">{validator.name}</p>
                        <p className="text-sm text-gray-400">{validator.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      validator.type === 'Expert' ? 'bg-purple-500/20 text-purple-400' :
                      validator.type === 'Official' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {validator.type}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`font-medium ${validator.accuracy >= 90 ? 'text-green-500' : validator.accuracy >= 70 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {validator.accuracy}%
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-gray-300">{validator.correctVotes.toLocaleString()}</span>
                    <span className="text-gray-500"> / {validator.totalValidations.toLocaleString()}</span>
                  </td>
                  <td className="p-4 font-medium text-green-500">₦{validator.balance.toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      validator.status === 'active' 
                        ? 'bg-green-500/20 text-green-500' 
                        : 'bg-red-500/20 text-red-500'
                    }`}>
                      {validator.status.charAt(0).toUpperCase() + validator.status.slice(1)}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400">{formatTimeAgo(validator.lastActive)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors" title="View Profile">
                        <Eye className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors" title="Suspend User">
                        <Ban className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        userType={activeTab === 'traders' ? 'trader' : 'validator'}
        onSuccess={handleAddUserSuccess}
      />
    </div>
  );
}
