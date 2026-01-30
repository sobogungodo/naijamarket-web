'use client';

import React, { useState } from 'react';
import { PageWrapper } from '@/components/dashboard/layout';
import { StatCard, Badge, Button, Input, Alert } from '@/components/ui';
import { DataTable, Column } from '@/components/dashboard/data-table';
import { 
  PieChartComponent, 
  BarChartComponent, 
  LineChartComponent,
  CHART_COLORS 
} from '@/components/charts';
import { FraudAlertCard } from '@/components/dashboard/widgets';
import { formatRelativeTime, formatNaira, getSeverityColor } from '@/lib/utils';
import {
  AlertTriangle,
  Shield,
  MapPin,
  DollarSign,
  Users,
  Eye,
  CheckCircle,
  XCircle,
  Filter,
  Download,
  RefreshCw,
  Clock,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { FraudAlert, FraudType } from '@/types';

// ============================================
// MOCK DATA
// ============================================

const mockFraudStats = {
  totalAlerts: 156,
  openAlerts: 23,
  criticalAlerts: 3,
  highAlerts: 8,
  resolvedToday: 12,
  falsePositiveRate: 8.5,
  avgResolutionTime: '2.4 hrs',
  blockedPayouts: 4850000,
};

const mockAlertsByType = [
  { name: 'GPS Spoofing', value: 45, color: CHART_COLORS.red },
  { name: 'Price Manipulation', value: 38, color: CHART_COLORS.orange },
  { name: 'Collusion', value: 28, color: CHART_COLORS.purple },
  { name: 'Rapid Submission', value: 25, color: CHART_COLORS.blue },
  { name: 'Fake Account', value: 20, color: CHART_COLORS.gray },
];

const mockAlertTrend = [
  { name: 'Week 1', gps: 12, price: 8, collusion: 5, other: 4 },
  { name: 'Week 2', gps: 15, price: 10, collusion: 7, other: 6 },
  { name: 'Week 3', gps: 18, price: 12, collusion: 6, other: 5 },
  { name: 'Week 4', gps: 14, price: 9, collusion: 8, other: 7 },
];

const mockFraudAlerts: FraudAlert[] = [
  {
    id: 'FA-001',
    type: 'gps_spoofing',
    severity: 'critical',
    title: 'Multiple users at identical GPS coordinates',
    description: '5 different traders submitted prices from exact same location (6.5244° N, 3.3792° E) within 10 minutes. This is physically impossible and indicates GPS spoofing.',
    detectedAt: new Date(Date.now() - 15 * 60 * 1000),
    status: 'open',
    traderId: 'T-1234',
    marketId: 'M-001',
    evidence: [
      { type: 'GPS Coordinates', description: 'Exact match', value: '6.5244, 3.3792', timestamp: new Date() },
      { type: 'Time Window', description: 'Submissions within', value: '10 minutes', timestamp: new Date() },
      { type: 'User Count', description: 'Unique users', value: 5, timestamp: new Date() },
    ],
  },
  {
    id: 'FA-002',
    type: 'price_manipulation',
    severity: 'high',
    title: 'Price 47% above market baseline',
    description: 'Rice 50kg submitted at ₦78,500 when baseline is ₦53,400. Pattern detected: same trader has 3 rejected submissions this week.',
    detectedAt: new Date(Date.now() - 45 * 60 * 1000),
    status: 'open',
    submissionId: 'S-5678',
    traderId: 'T-2345',
    evidence: [
      { type: 'Submitted Price', description: 'Trader submission', value: '₦78,500', timestamp: new Date() },
      { type: 'Baseline Price', description: 'Market average', value: '₦53,400', threshold: '±30%', timestamp: new Date() },
      { type: 'Deviation', description: 'Above baseline', value: '47%', timestamp: new Date() },
    ],
  },
  {
    id: 'FA-003',
    type: 'collusion_suspected',
    severity: 'medium',
    title: 'Validator-Trader collusion pattern',
    description: 'Validator V-789 has approved 100% (28/28) of submissions from Trader T-456 over the past 7 days. Statistical probability: 0.001%',
    detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: 'investigating',
    validatorId: 'V-789',
    traderId: 'T-456',
    evidence: [],
    assignedTo: 'Admin',
  },
  {
    id: 'FA-004',
    type: 'rapid_submission',
    severity: 'medium',
    title: 'Rate limit exceeded - 12 submissions in 1 hour',
    description: 'Trader T-789 submitted 12 prices in 60 minutes from Alaba market. Normal rate limit is 8/day. Account flagged for review.',
    detectedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    status: 'open',
    traderId: 'T-789',
    marketId: 'M-005',
    evidence: [],
  },
  {
    id: 'FA-005',
    type: 'gps_spoofing',
    severity: 'high',
    title: 'Impossible travel pattern detected',
    description: 'Trader T-321 submitted from Mile 12 (Lagos) and Onitsha (Anambra) within 15 minutes. Distance: 540km. Physically impossible.',
    detectedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    status: 'open',
    traderId: 'T-321',
    evidence: [],
  },
];

const mockTopOffenders = [
  { id: 'T-456', name: 'Trader Kunle', phone: '0803****567', alerts: 8, severity: 'high', status: 'active' },
  { id: 'T-789', name: 'Trader Emeka', phone: '0805****234', alerts: 6, severity: 'medium', status: 'suspended' },
  { id: 'V-789', name: 'Validator Chidi', phone: '0806****890', alerts: 5, severity: 'medium', status: 'active' },
  { id: 'T-321', name: 'Trader Ada', phone: '0813****456', alerts: 4, severity: 'low', status: 'active' },
  { id: 'T-654', name: 'Trader Bola', phone: '0816****123', alerts: 3, severity: 'low', status: 'active' },
];

// ============================================
// FRAUD DETECTION PAGE
// ============================================

export default function FraudDetectionPage() {
  const [selectedTab, setSelectedTab] = useState<'alerts' | 'patterns' | 'offenders'>('alerts');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('open');

  const filteredAlerts = mockFraudAlerts.filter(alert => {
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    return true;
  });

  const offenderColumns: Column<typeof mockTopOffenders[0]>[] = [
    { key: 'id', label: 'ID', width: '100px' },
    { key: 'name', label: 'Name' },
    { 
      key: 'phone', 
      label: 'Phone',
      render: (value) => <span className="font-mono text-dash-muted">{value as string}</span>
    },
    { 
      key: 'alerts', 
      label: 'Alerts',
      sortable: true,
      render: (value) => <Badge variant="danger">{value as number}</Badge>
    },
    { 
      key: 'severity', 
      label: 'Severity',
      render: (value) => (
        <Badge variant={
          value === 'high' ? 'danger' : 
          value === 'medium' ? 'warning' : 'info'
        }>
          {(value as string).toUpperCase()}
        </Badge>
      )
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (value) => (
        <Badge variant={value === 'active' ? 'success' : 'danger'}>
          {value as string}
        </Badge>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-status-danger">
            <XCircle className="w-4 h-4" />
          </Button>
        </div>
      )
    },
  ];

  return (
    <PageWrapper
      title="Fraud Detection Center"
      subtitle="Monitor, investigate, and resolve suspicious activities"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" leftIcon={RefreshCw}>
            Refresh
          </Button>
          <Button variant="secondary" size="sm" leftIcon={Download}>
            Export Report
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Critical Alert Banner */}
        {mockFraudStats.criticalAlerts > 0 && (
          <Alert variant="danger" icon={AlertTriangle} title="Critical Alerts Require Immediate Attention">
            There are {mockFraudStats.criticalAlerts} critical fraud alerts that need immediate review. 
            These may involve significant financial risk or systematic abuse.
          </Alert>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Open Alerts"
            value={mockFraudStats.openAlerts}
            subtitle={`${mockFraudStats.criticalAlerts} critical`}
            icon={AlertTriangle}
            iconColor="text-status-danger"
            pulse={mockFraudStats.criticalAlerts > 0}
          />
          <StatCard
            title="Resolved Today"
            value={mockFraudStats.resolvedToday}
            subtitle={`${mockFraudStats.avgResolutionTime} avg time`}
            icon={CheckCircle}
            iconColor="text-status-success"
          />
          <StatCard
            title="Blocked Payouts"
            value={mockFraudStats.blockedPayouts}
            subtitle="fraud prevented"
            icon={Shield}
            iconColor="text-naija-gold-400"
            format="currency"
          />
          <StatCard
            title="False Positive Rate"
            value={mockFraudStats.falsePositiveRate}
            subtitle="last 30 days"
            icon={TrendingUp}
            iconColor="text-status-info"
            format="percentage"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Alerts by Type */}
          <div className="dash-card">
            <h3 className="font-semibold text-dash-text mb-4">Alerts by Type</h3>
            <PieChartComponent
              data={mockAlertsByType}
              height={250}
              innerRadius={50}
              outerRadius={80}
              centerLabel="Total"
              centerValue={mockFraudStats.totalAlerts}
            />
          </div>

          {/* Trend Chart */}
          <div className="lg:col-span-2 dash-card">
            <h3 className="font-semibold text-dash-text mb-4">Alert Trend (Last 4 Weeks)</h3>
            <LineChartComponent
              data={mockAlertTrend}
              dataKeys={[
                { key: 'gps', name: 'GPS Spoofing', color: CHART_COLORS.red },
                { key: 'price', name: 'Price Manipulation', color: CHART_COLORS.orange },
                { key: 'collusion', name: 'Collusion', color: CHART_COLORS.purple },
                { key: 'other', name: 'Other', color: CHART_COLORS.gray },
              ]}
              height={250}
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-dash-border pb-4">
          <Button
            variant={selectedTab === 'alerts' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedTab('alerts')}
          >
            Active Alerts ({mockFraudStats.openAlerts})
          </Button>
          <Button
            variant={selectedTab === 'patterns' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedTab('patterns')}
          >
            Fraud Patterns
          </Button>
          <Button
            variant={selectedTab === 'offenders' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedTab('offenders')}
          >
            Top Offenders
          </Button>
        </div>

        {/* Tab Content */}
        {selectedTab === 'alerts' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-dash-muted">Severity:</span>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="bg-dash-bg border border-dash-border rounded-lg px-3 py-1.5 text-sm text-dash-text"
                >
                  <option value="all">All</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-dash-muted">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-dash-bg border border-dash-border rounded-lg px-3 py-1.5 text-sm text-dash-text"
                >
                  <option value="all">All</option>
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div className="flex-1" />
              <span className="text-sm text-dash-muted">
                Showing {filteredAlerts.length} of {mockFraudAlerts.length} alerts
              </span>
            </div>

            {/* Alerts List */}
            <div className="space-y-4">
              {filteredAlerts.map((alert) => (
                <FraudAlertCard
                  key={alert.id}
                  alert={alert}
                  onView={(a) => console.log('View:', a.id)}
                  onResolve={(a) => console.log('Resolve:', a.id)}
                  onDismiss={(a) => console.log('Dismiss:', a.id)}
                />
              ))}
              {filteredAlerts.length === 0 && (
                <div className="text-center py-12 text-dash-muted">
                  <Shield className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No alerts match your filters</p>
                  <p className="text-sm">Try adjusting your filter criteria</p>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTab === 'patterns' && (
          <div className="dash-card">
            <h3 className="font-semibold text-dash-text mb-4">Detected Fraud Patterns</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-dash-bg border border-dash-border">
                <div className="flex items-center gap-3 mb-3">
                  <MapPin className="w-5 h-5 text-status-danger" />
                  <h4 className="font-medium text-dash-text">GPS Spoofing Clusters</h4>
                </div>
                <p className="text-sm text-dash-muted mb-2">
                  45 instances detected this month. Primary hotspots:
                </p>
                <ul className="text-sm text-dash-text space-y-1">
                  <li>• Mile 12 Market (18 instances)</li>
                  <li>• Onitsha Main Market (12 instances)</li>
                  <li>• Alaba International (9 instances)</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-dash-bg border border-dash-border">
                <div className="flex items-center gap-3 mb-3">
                  <DollarSign className="w-5 h-5 text-status-warning" />
                  <h4 className="font-medium text-dash-text">Price Manipulation Trends</h4>
                </div>
                <p className="text-sm text-dash-muted mb-2">
                  38 instances this month. Most targeted commodities:
                </p>
                <ul className="text-sm text-dash-text space-y-1">
                  <li>• Rice 50kg (14 instances, +35% avg deviation)</li>
                  <li>• Cement bag (8 instances, +28% avg deviation)</li>
                  <li>• Palm Oil 25L (6 instances, +22% avg deviation)</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-dash-bg border border-dash-border">
                <div className="flex items-center gap-3 mb-3">
                  <Users className="w-5 h-5 text-status-pending" />
                  <h4 className="font-medium text-dash-text">Collusion Networks</h4>
                </div>
                <p className="text-sm text-dash-muted mb-2">
                  3 suspected collusion rings identified:
                </p>
                <ul className="text-sm text-dash-text space-y-1">
                  <li>• Network A: 2 traders + 1 validator (Mile 12)</li>
                  <li>• Network B: 3 traders + 2 validators (Onitsha)</li>
                  <li>• Network C: 1 trader + 1 validator (Alaba)</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-dash-bg border border-dash-border">
                <div className="flex items-center gap-3 mb-3">
                  <Zap className="w-5 h-5 text-status-info" />
                  <h4 className="font-medium text-dash-text">Rate Limit Violations</h4>
                </div>
                <p className="text-sm text-dash-muted mb-2">
                  25 rate limit violations this month:
                </p>
                <ul className="text-sm text-dash-text space-y-1">
                  <li>• 18 traders exceeded daily limit (8/day)</li>
                  <li>• 7 traders exceeded hourly limit (2/hour)</li>
                  <li>• Most violations: Weekday mornings 8-10 AM</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'offenders' && (
          <DataTable
            data={mockTopOffenders}
            columns={offenderColumns}
            keyField="id"
            searchable
            searchPlaceholder="Search by name or phone..."
            pagination
            pageSize={10}
            emptyTitle="No offenders found"
            emptyDescription="No users with fraud alerts match your search"
          />
        )}
      </div>
    </PageWrapper>
  );
}
