'use client';

import React, { useState } from 'react';
import { PageWrapper } from '@/components/dashboard/layout';
import { StatCard, Badge, Button, Alert } from '@/components/ui';
import { DataTable, Column } from '@/components/dashboard/data-table';
import { 
  AreaChartComponent, 
  BarChartComponent, 
  PieChartComponent,
  CHART_COLORS 
} from '@/components/charts';
import { formatNaira, formatRelativeTime, formatPhoneNumber, getMobileNetwork } from '@/lib/utils';
import {
  Wallet,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Download,
  RefreshCw,
  Play,
  Pause,
  Users,
  Building,
} from 'lucide-react';
import type { PayoutRecord, PayoutStatus, MobileNetwork } from '@/types';

// ============================================
// MOCK DATA
// ============================================

const mockFinancialStats = {
  totalPending: 2847500,
  totalProcessing: 450000,
  totalPaidToday: 1234500,
  totalPaidWeek: 8945000,
  totalPaidMonth: 45672300,
  
  pendingCount: 847,
  processingCount: 45,
  paidTodayCount: 234,
  failedCount: 12,
  
  tradersPending: 1847500,
  validatorsPending: 1000000,
  
  successRate: 98.5,
  avgProcessingTime: '3.2 mins',
};

const mockPayoutTrend = [
  { name: 'Mon', traders: 450000, validators: 280000 },
  { name: 'Tue', traders: 520000, validators: 310000 },
  { name: 'Wed', traders: 680000, validators: 420000 },
  { name: 'Thu', traders: 590000, validators: 350000 },
  { name: 'Fri', traders: 1250000, validators: 780000 },
  { name: 'Sat', traders: 320000, validators: 190000 },
  { name: 'Sun', traders: 180000, validators: 110000 },
];

const mockPayoutByNetwork = [
  { name: 'MTN', value: 18500000, count: 4234, successRate: 99.2 },
  { name: 'Airtel', value: 12300000, count: 2847, successRate: 98.8 },
  { name: 'Glo', value: 8700000, count: 1923, successRate: 97.5 },
  { name: '9mobile', value: 6172300, count: 1456, successRate: 96.1 },
];

const mockPendingPayouts: PayoutRecord[] = [
  {
    id: 'P-001',
    recipientId: 'T-1234',
    recipientType: 'trader',
    recipientPhone: '08031234567',
    recipientName: 'Chidi Okonkwo',
    amount: 2500,
    network: 'MTN',
    status: 'pending',
    reference: 'REF-2024-001234',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    retryCount: 0,
  },
  {
    id: 'P-002',
    recipientId: 'V-567',
    recipientType: 'validator',
    recipientPhone: '08051234567',
    recipientName: 'Ngozi Adeyemi',
    amount: 5000,
    network: 'Glo',
    status: 'pending',
    reference: 'REF-2024-001235',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    retryCount: 0,
  },
  {
    id: 'P-003',
    recipientId: 'T-890',
    recipientType: 'trader',
    recipientPhone: '08061234567',
    recipientName: 'Emeka Nwosu',
    amount: 1500,
    network: 'Airtel',
    status: 'processing',
    reference: 'REF-2024-001236',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    retryCount: 0,
  },
  {
    id: 'P-004',
    recipientId: 'T-456',
    recipientType: 'trader',
    recipientPhone: '08091234567',
    recipientName: 'Kunle Bakare',
    amount: 3500,
    network: '9mobile',
    status: 'failed',
    reference: 'REF-2024-001237',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    failureReason: 'Invalid phone number',
    retryCount: 2,
  },
  {
    id: 'P-005',
    recipientId: 'V-234',
    recipientType: 'validator',
    recipientPhone: '08131234567',
    recipientName: 'Fatima Bello',
    amount: 7500,
    network: 'MTN',
    status: 'pending',
    reference: 'REF-2024-001238',
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
    retryCount: 0,
  },
];

const mockRecentPayouts: PayoutRecord[] = [
  {
    id: 'P-100',
    recipientId: 'T-111',
    recipientType: 'trader',
    recipientPhone: '08031111111',
    recipientName: 'Aisha Mohammed',
    amount: 2000,
    network: 'MTN',
    status: 'completed',
    reference: 'REF-2024-001100',
    createdAt: new Date(Date.now() - 10 * 60 * 1000),
    processedAt: new Date(Date.now() - 8 * 60 * 1000),
    retryCount: 0,
  },
  {
    id: 'P-101',
    recipientId: 'V-222',
    recipientType: 'validator',
    recipientPhone: '08052222222',
    recipientName: 'Oluwaseun Ade',
    amount: 5000,
    network: 'Glo',
    status: 'completed',
    reference: 'REF-2024-001101',
    createdAt: new Date(Date.now() - 15 * 60 * 1000),
    processedAt: new Date(Date.now() - 12 * 60 * 1000),
    retryCount: 0,
  },
];

// ============================================
// FINANCIAL OPERATIONS PAGE
// ============================================

export default function FinancialOpsPage() {
  const [selectedTab, setSelectedTab] = useState<'pending' | 'completed' | 'failed'>('pending');
  const [isProcessing, setIsProcessing] = useState(false);

  const getStatusBadge = (status: PayoutStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'processing':
        return <Badge variant="info" pulse>Processing</Badge>;
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'failed':
        return <Badge variant="danger">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getNetworkBadge = (network: MobileNetwork) => {
    const colors: Record<MobileNetwork, string> = {
      'MTN': 'bg-yellow-500/20 text-yellow-500',
      'Airtel': 'bg-red-500/20 text-red-500',
      'Glo': 'bg-green-500/20 text-green-500',
      '9mobile': 'bg-teal-500/20 text-teal-500',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[network]}`}>
        {network}
      </span>
    );
  };

  const payoutColumns: Column<PayoutRecord>[] = [
    { key: 'reference', label: 'Reference', width: '140px' },
    { 
      key: 'recipientName', 
      label: 'Recipient',
      render: (_, row) => (
        <div>
          <p className="font-medium text-dash-text">{row.recipientName}</p>
          <p className="text-xs text-dash-muted font-mono">{formatPhoneNumber(row.recipientPhone)}</p>
        </div>
      )
    },
    { 
      key: 'recipientType', 
      label: 'Type',
      render: (value) => (
        <Badge variant={value === 'trader' ? 'info' : 'pending'}>
          {(value as string).charAt(0).toUpperCase() + (value as string).slice(1)}
        </Badge>
      )
    },
    { 
      key: 'network', 
      label: 'Network',
      render: (value) => getNetworkBadge(value as MobileNetwork)
    },
    { 
      key: 'amount', 
      label: 'Amount',
      align: 'right',
      sortable: true,
      render: (value) => (
        <span className="font-mono font-medium text-dash-text">
          {formatNaira(value as number)}
        </span>
      )
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (value) => getStatusBadge(value as PayoutStatus)
    },
    { 
      key: 'createdAt', 
      label: 'Created',
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
          {row.status === 'pending' && (
            <Button variant="ghost" size="sm" className="text-status-success">
              <Play className="w-4 h-4" />
            </Button>
          )}
          {row.status === 'failed' && (
            <Button variant="ghost" size="sm" className="text-status-warning">
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm">
            <XCircle className="w-4 h-4" />
          </Button>
        </div>
      )
    },
  ];

  const handleProcessAll = () => {
    setIsProcessing(true);
    // Simulate processing
    setTimeout(() => setIsProcessing(false), 3000);
  };

  return (
    <PageWrapper
      title="Financial Operations"
      subtitle="Manage payouts, track transactions, and monitor financial health"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" leftIcon={Download}>
            Export Report
          </Button>
          <Button 
            variant="primary" 
            size="sm" 
            leftIcon={isProcessing ? Pause : Send}
            onClick={handleProcessAll}
            isLoading={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Process All Pending'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Failed Payouts Alert */}
        {mockFinancialStats.failedCount > 0 && (
          <Alert variant="warning" icon={AlertTriangle} title="Failed Payouts Require Attention">
            {mockFinancialStats.failedCount} payouts have failed and need to be retried or manually resolved.
          </Alert>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Pending Payouts"
            value={mockFinancialStats.totalPending}
            subtitle={`${mockFinancialStats.pendingCount} users`}
            icon={Clock}
            iconColor="text-status-warning"
            format="currency"
          />
          <StatCard
            title="Paid Today"
            value={mockFinancialStats.totalPaidToday}
            subtitle={`${mockFinancialStats.paidTodayCount} transactions`}
            icon={CheckCircle}
            iconColor="text-status-success"
            format="currency"
          />
          <StatCard
            title="This Month"
            value={mockFinancialStats.totalPaidMonth}
            subtitle="total disbursed"
            icon={Wallet}
            iconColor="text-naija-green-500"
            format="currency"
          />
          <StatCard
            title="Success Rate"
            value={mockFinancialStats.successRate}
            subtitle={mockFinancialStats.avgProcessingTime + ' avg time'}
            icon={TrendingUp}
            iconColor="text-status-info"
            format="percentage"
          />
        </div>

        {/* Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="dash-card">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-5 h-5 text-naija-green-500" />
              <h3 className="font-semibold text-dash-text">Traders Pending</h3>
            </div>
            <p className="text-3xl font-bold font-mono text-dash-text mb-1">
              {formatNaira(mockFinancialStats.tradersPending)}
            </p>
            <p className="text-sm text-dash-muted">
              {Math.round(mockFinancialStats.pendingCount * 0.65)} traders awaiting payout
            </p>
          </div>
          <div className="dash-card">
            <div className="flex items-center gap-3 mb-4">
              <Building className="w-5 h-5 text-naija-gold-400" />
              <h3 className="font-semibold text-dash-text">Validators Pending</h3>
            </div>
            <p className="text-3xl font-bold font-mono text-dash-text mb-1">
              {formatNaira(mockFinancialStats.validatorsPending)}
            </p>
            <p className="text-sm text-dash-muted">
              {Math.round(mockFinancialStats.pendingCount * 0.35)} validators awaiting payout
            </p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payout Trend */}
          <div className="lg:col-span-2 dash-card">
            <h3 className="font-semibold text-dash-text mb-4">Weekly Payout Trend</h3>
            <AreaChartComponent
              data={mockPayoutTrend}
              dataKeys={[
                { key: 'traders', name: 'Traders', color: CHART_COLORS.primary },
                { key: 'validators', name: 'Validators', color: CHART_COLORS.secondary },
              ]}
              height={280}
              stacked
              formatter={(value) => formatNaira(value)}
            />
          </div>

          {/* Network Distribution */}
          <div className="dash-card">
            <h3 className="font-semibold text-dash-text mb-4">By Network</h3>
            <div className="space-y-4">
              {mockPayoutByNetwork.map((network) => (
                <div key={network.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getNetworkBadge(network.name as MobileNetwork)}
                    <div>
                      <p className="text-sm text-dash-text">{formatNaira(network.value)}</p>
                      <p className="text-xs text-dash-muted">{network.count.toLocaleString()} txns</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-status-success">{network.successRate}%</p>
                    <p className="text-xs text-dash-muted">success</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-dash-border pb-4">
          <Button
            variant={selectedTab === 'pending' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedTab('pending')}
          >
            Pending ({mockFinancialStats.pendingCount})
          </Button>
          <Button
            variant={selectedTab === 'completed' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedTab('completed')}
          >
            Completed Today
          </Button>
          <Button
            variant={selectedTab === 'failed' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedTab('failed')}
          >
            Failed ({mockFinancialStats.failedCount})
          </Button>
        </div>

        {/* Payouts Table */}
        <DataTable
          data={
            selectedTab === 'pending' 
              ? mockPendingPayouts.filter(p => p.status === 'pending' || p.status === 'processing')
              : selectedTab === 'completed'
              ? mockRecentPayouts
              : mockPendingPayouts.filter(p => p.status === 'failed')
          }
          columns={payoutColumns}
          keyField="id"
          searchable
          searchPlaceholder="Search by name, phone, or reference..."
          pagination
          pageSize={10}
          selectable
          onRefresh={() => console.log('Refresh')}
          onExport={() => console.log('Export')}
        />

        {/* VTPass Integration Status */}
        <div className="dash-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-naija-green-500/20 flex items-center justify-center">
                <Send className="w-5 h-5 text-naija-green-500" />
              </div>
              <div>
                <h4 className="font-medium text-dash-text">VTPass Integration</h4>
                <p className="text-sm text-dash-muted">Airtime distribution service</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-dash-muted">API Balance</p>
                <p className="font-mono font-medium text-dash-text">{formatNaira(5450000)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                <span className="text-sm text-status-success">Connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
