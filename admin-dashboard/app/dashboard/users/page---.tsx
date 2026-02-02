'use client';

import React, { useState } from 'react';
import { PageWrapper } from '@/components/dashboard/layout';
import { StatCard, Badge, Button, Input, Avatar } from '@/components/ui';
import { DataTable, Column } from '@/components/dashboard/data-table';
import { BarChartComponent, CHART_COLORS } from '@/components/charts';
import { formatNaira, formatRelativeTime, formatPhoneNumber } from '@/lib/utils';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Shield,
  Star,
  TrendingUp,
  Search,
  Filter,
  Download,
  Eye,
  Ban,
  CheckCircle,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import type { Trader, Validator, UserStatus } from '@/types';

// ============================================
// MOCK DATA
// ============================================

const mockUserStats = {
  totalTraders: 8432,
  activeTraders: 6218,
  newTradersToday: 23,
  suspendedTraders: 45,
  
  totalValidators: 2156,
  activeValidators: 1847,
  goldValidators: 234,
  newValidatorsToday: 8,
  
  avgTraderReputation: 72.4,
  avgValidatorAccuracy: 91.2,
};

const mockRegistrationTrend = [
  { name: 'Mon', traders: 45, validators: 12 },
  { name: 'Tue', traders: 52, validators: 15 },
  { name: 'Wed', traders: 38, validators: 8 },
  { name: 'Thu', traders: 67, validators: 18 },
  { name: 'Fri', traders: 58, validators: 14 },
  { name: 'Sat', traders: 34, validators: 6 },
  { name: 'Sun', traders: 21, validators: 4 },
];

const mockTraders: Trader[] = [
  {
    id: 'T-1001',
    phoneNumber: '08031234567',
    name: 'Chidi Okonkwo',
    marketId: 'M-001',
    marketName: 'Mile 12 Market',
    reputation: 85,
    totalSubmissions: 234,
    approvedSubmissions: 218,
    rejectedSubmissions: 16,
    pendingBalance: 4500,
    totalEarned: 45800,
    totalPaid: 41300,
    registeredAt: new Date('2024-03-15'),
    lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: 'active',
    fraudFlags: [],
    bankVerified: true,
    gpsVerified: true,
  },
  {
    id: 'T-1002',
    phoneNumber: '08051234567',
    name: 'Ngozi Adeyemi',
    marketId: 'M-002',
    marketName: 'Onitsha Main Market',
    reputation: 92,
    totalSubmissions: 456,
    approvedSubmissions: 442,
    rejectedSubmissions: 14,
    pendingBalance: 2500,
    totalEarned: 89200,
    totalPaid: 86700,
    registeredAt: new Date('2024-01-10'),
    lastActive: new Date(Date.now() - 30 * 60 * 1000),
    status: 'active',
    fraudFlags: [],
    bankVerified: true,
    gpsVerified: true,
  },
  {
    id: 'T-1003',
    phoneNumber: '08061234567',
    name: 'Emeka Nwosu',
    marketId: 'M-003',
    marketName: 'Alaba International',
    reputation: 45,
    totalSubmissions: 89,
    approvedSubmissions: 52,
    rejectedSubmissions: 37,
    pendingBalance: 0,
    totalEarned: 10400,
    totalPaid: 10400,
    registeredAt: new Date('2024-06-20'),
    lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: 'suspended',
    fraudFlags: [{ id: 'F-1', type: 'price_manipulation', severity: 'high', description: 'Multiple price manipulation attempts', detectedAt: new Date(), resolved: false }],
    bankVerified: true,
    gpsVerified: false,
  },
  {
    id: 'T-1004',
    phoneNumber: '08091234567',
    name: 'Kunle Bakare',
    marketId: 'M-004',
    marketName: 'Wuse Market',
    reputation: 78,
    totalSubmissions: 167,
    approvedSubmissions: 145,
    rejectedSubmissions: 22,
    pendingBalance: 3500,
    totalEarned: 29000,
    totalPaid: 25500,
    registeredAt: new Date('2024-04-08'),
    lastActive: new Date(Date.now() - 4 * 60 * 60 * 1000),
    status: 'active',
    fraudFlags: [],
    bankVerified: true,
    gpsVerified: true,
  },
  {
    id: 'T-1005',
    phoneNumber: '08131234567',
    name: 'Fatima Bello',
    marketId: 'M-001',
    marketName: 'Mile 12 Market',
    reputation: 88,
    totalSubmissions: 312,
    approvedSubmissions: 298,
    rejectedSubmissions: 14,
    pendingBalance: 1500,
    totalEarned: 59600,
    totalPaid: 58100,
    registeredAt: new Date('2024-02-22'),
    lastActive: new Date(Date.now() - 15 * 60 * 1000),
    status: 'active',
    fraudFlags: [],
    bankVerified: true,
    gpsVerified: true,
  },
];

const mockValidators: Validator[] = [
  {
    id: 'V-001',
    phoneNumber: '08032222222',
    name: 'Oluwaseun Ade',
    marketIds: ['M-001', 'M-002'],
    marketNames: ['Mile 12 Market', 'Onitsha Main Market'],
    accuracyRate: 96.5,
    totalValidations: 1234,
    correctVotes: 1191,
    incorrectVotes: 43,
    pendingBalance: 12500,
    totalEarned: 617000,
    totalPaid: 604500,
    tier: 'gold',
    registeredAt: new Date('2024-01-05'),
    lastActive: new Date(Date.now() - 1 * 60 * 60 * 1000),
    status: 'active',
    collusionScore: 2,
  },
  {
    id: 'V-002',
    phoneNumber: '08053333333',
    name: 'Aisha Mohammed',
    marketIds: ['M-003'],
    marketNames: ['Alaba International'],
    accuracyRate: 89.2,
    totalValidations: 567,
    correctVotes: 506,
    incorrectVotes: 61,
    pendingBalance: 5000,
    totalEarned: 283500,
    totalPaid: 278500,
    tier: 'silver',
    registeredAt: new Date('2024-03-12'),
    lastActive: new Date(Date.now() - 3 * 60 * 60 * 1000),
    status: 'active',
    collusionScore: 5,
  },
];

// ============================================
// USER MANAGEMENT PAGE
// ============================================

export default function UserManagementPage() {
  const [selectedTab, setSelectedTab] = useState<'traders' | 'validators'>('traders');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'suspended':
        return <Badge variant="warning">Suspended</Badge>;
      case 'banned':
        return <Badge variant="danger">Banned</Badge>;
      case 'pending_review':
        return <Badge variant="info">Pending Review</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getReputationBadge = (reputation: number) => {
    if (reputation >= 80) {
      return <Badge variant="success">{reputation} ⭐</Badge>;
    } else if (reputation >= 60) {
      return <Badge variant="info">{reputation}</Badge>;
    } else if (reputation >= 40) {
      return <Badge variant="warning">{reputation}</Badge>;
    } else {
      return <Badge variant="danger">{reputation}</Badge>;
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'gold':
        return <Badge className="bg-yellow-500/20 text-yellow-500">🥇 Gold</Badge>;
      case 'silver':
        return <Badge className="bg-gray-400/20 text-gray-400">🥈 Silver</Badge>;
      case 'bronze':
        return <Badge className="bg-orange-600/20 text-orange-600">🥉 Bronze</Badge>;
      default:
        return <Badge variant="warning">Probation</Badge>;
    }
  };

  const traderColumns: Column<Trader>[] = [
    { 
      key: 'name', 
      label: 'Trader',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name} size="sm" />
          <div>
            <p className="font-medium text-dash-text">{row.name}</p>
            <p className="text-xs text-dash-muted font-mono">{formatPhoneNumber(row.phoneNumber)}</p>
          </div>
        </div>
      )
    },
    { 
      key: 'marketName', 
      label: 'Market',
      render: (value) => (
        <div className="flex items-center gap-1 text-sm text-dash-muted">
          <MapPin className="w-3 h-3" />
          {value as string}
        </div>
      )
    },
    { 
      key: 'reputation', 
      label: 'Reputation',
      sortable: true,
      render: (value) => getReputationBadge(value as number)
    },
    { 
      key: 'approvedSubmissions', 
      label: 'Submissions',
      sortable: true,
      render: (_, row) => (
        <div className="text-sm">
          <span className="text-dash-text">{row.approvedSubmissions}</span>
          <span className="text-dash-muted"> / {row.totalSubmissions}</span>
        </div>
      )
    },
    { 
      key: 'pendingBalance', 
      label: 'Balance',
      align: 'right',
      sortable: true,
      render: (value) => (
        <span className="font-mono text-sm text-dash-text">
          {formatNaira(value as number)}
        </span>
      )
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (value) => getStatusBadge(value as UserStatus)
    },
    { 
      key: 'lastActive', 
      label: 'Last Active',
      render: (value) => (
        <span className="text-sm text-dash-muted">
          {formatRelativeTime(value as Date)}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm">
            <Eye className="w-4 h-4" />
          </Button>
          {row.status === 'active' ? (
            <Button variant="ghost" size="sm" className="text-status-warning">
              <Ban className="w-4 h-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="text-status-success">
              <CheckCircle className="w-4 h-4" />
            </Button>
          )}
        </div>
      )
    },
  ];

  const validatorColumns: Column<Validator>[] = [
    { 
      key: 'name', 
      label: 'Validator',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name} size="sm" />
          <div>
            <p className="font-medium text-dash-text">{row.name}</p>
            <p className="text-xs text-dash-muted font-mono">{formatPhoneNumber(row.phoneNumber)}</p>
          </div>
        </div>
      )
    },
    { 
      key: 'tier', 
      label: 'Tier',
      render: (value) => getTierBadge(value as string)
    },
    { 
      key: 'accuracyRate', 
      label: 'Accuracy',
      sortable: true,
      render: (value) => (
        <span className={`font-mono text-sm ${
          (value as number) >= 90 ? 'text-status-success' : 
          (value as number) >= 80 ? 'text-status-info' : 
          (value as number) >= 70 ? 'text-status-warning' : 'text-status-danger'
        }`}>
          {(value as number).toFixed(1)}%
        </span>
      )
    },
    { 
      key: 'totalValidations', 
      label: 'Validations',
      sortable: true,
      render: (value) => (
        <span className="text-sm text-dash-text">{(value as number).toLocaleString()}</span>
      )
    },
    { 
      key: 'marketNames', 
      label: 'Markets',
      render: (value) => (
        <div className="text-sm text-dash-muted max-w-[150px] truncate">
          {(value as string[]).join(', ')}
        </div>
      )
    },
    { 
      key: 'pendingBalance', 
      label: 'Balance',
      align: 'right',
      sortable: true,
      render: (value) => (
        <span className="font-mono text-sm text-dash-text">
          {formatNaira(value as number)}
        </span>
      )
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (value) => getStatusBadge(value as UserStatus)
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm">
            <Eye className="w-4 h-4" />
          </Button>
          {row.collusionScore > 5 && (
            <Button variant="ghost" size="sm" className="text-status-danger">
              <AlertTriangle className="w-4 h-4" />
            </Button>
          )}
        </div>
      )
    },
  ];

  return (
    <PageWrapper
      title="User Management"
      subtitle="Manage traders, validators, and user permissions"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" leftIcon={Download}>
            Export
          </Button>
          <Button variant="primary" size="sm" leftIcon={UserPlus}>
            Add User
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Traders"
            value={mockUserStats.totalTraders}
            subtitle={`${mockUserStats.activeTraders} active`}
            trend={12.4}
            trendLabel="+23 today"
            icon={Users}
            iconColor="text-naija-green-500"
            format="compact"
          />
          <StatCard
            title="Total Validators"
            value={mockUserStats.totalValidators}
            subtitle={`${mockUserStats.goldValidators} gold tier`}
            trend={5.2}
            trendLabel="+8 today"
            icon={Shield}
            iconColor="text-naija-gold-400"
            format="compact"
          />
          <StatCard
            title="Avg Trader Reputation"
            value={mockUserStats.avgTraderReputation}
            subtitle="out of 100"
            icon={Star}
            iconColor="text-status-info"
          />
          <StatCard
            title="Avg Validator Accuracy"
            value={mockUserStats.avgValidatorAccuracy}
            subtitle="vote accuracy"
            icon={TrendingUp}
            iconColor="text-status-success"
            format="percentage"
          />
        </div>

        {/* Registration Trend */}
        <div className="dash-card">
          <h3 className="font-semibold text-dash-text mb-4">Weekly Registration Trend</h3>
          <BarChartComponent
            data={mockRegistrationTrend}
            dataKeys={[
              { key: 'traders', name: 'Traders', color: CHART_COLORS.primary },
              { key: 'validators', name: 'Validators', color: CHART_COLORS.secondary },
            ]}
            height={200}
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-4 border-b border-dash-border pb-4">
          <div className="flex items-center gap-2">
            <Button
              variant={selectedTab === 'traders' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSelectedTab('traders')}
              leftIcon={Users}
            >
              Traders ({mockUserStats.totalTraders.toLocaleString()})
            </Button>
            <Button
              variant={selectedTab === 'validators' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSelectedTab('validators')}
              leftIcon={Shield}
            >
              Validators ({mockUserStats.totalValidators.toLocaleString()})
            </Button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-dash-muted">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-dash-bg border border-dash-border rounded-lg px-3 py-1.5 text-sm text-dash-text"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        {selectedTab === 'traders' ? (
          <DataTable
            data={statusFilter === 'all' ? mockTraders : mockTraders.filter(t => t.status === statusFilter)}
            columns={traderColumns}
            keyField="id"
            searchable
            searchPlaceholder="Search by name or phone..."
            searchFields={['name', 'phoneNumber', 'marketName']}
            pagination
            pageSize={10}
            onRowClick={(row) => console.log('View trader:', row.id)}
          />
        ) : (
          <DataTable
            data={statusFilter === 'all' ? mockValidators : mockValidators.filter(v => v.status === statusFilter)}
            columns={validatorColumns}
            keyField="id"
            searchable
            searchPlaceholder="Search by name or phone..."
            searchFields={['name', 'phoneNumber']}
            pagination
            pageSize={10}
            onRowClick={(row) => console.log('View validator:', row.id)}
          />
        )}
      </div>
    </PageWrapper>
  );
}
