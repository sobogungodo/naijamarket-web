'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { PageWrapper } from '@/components/dashboard/layout';
import { StatCard, Badge, Button, Skeleton } from '@/components/ui';
import { 
  AreaChartComponent, 
  PieChartComponent, 
  BarChartComponent,
  ComposedChartComponent,
  CHART_COLORS,
} from '@/components/charts';
import { FraudAlertsList, ActivityFeed, StatusIndicator, QuickAction } from '@/components/dashboard/widgets';
import { formatNaira, formatRelativeTime } from '@/lib/utils';
import {
  Users,
  TrendingUp,
  Wallet,
  AlertTriangle,
  Activity,
  MapPin,
  Package,
  Clock,
  RefreshCw,
  Download,
  Send,
  UserPlus,
  Shield,
  Zap,
} from 'lucide-react';
import type { FraudAlert, ActivityItem } from '@/types';

// ============================================
// MOCK DATA (Replace with API calls)
// ============================================

const mockStats = {
  totalTraders: 8432,
  activeTraders: 6218,
  totalValidators: 2156,
  activeValidators: 1847,
  newUsersToday: 47,
  
  totalSubmissions: 247891,
  submissionsToday: 3847,
  pendingValidations: 234,
  approvalRate: 94.7,
  
  totalPendingPayout: 2847500,
  totalPaidOut: 45672300,
  pendingPayoutCount: 847,
  
  marketsActive: 226,
  commoditiesTracked: 524,
  pricePointsToday: 12847,
  
  tradersChange: 12.4,
  submissionsChange: 8.7,
  payoutsChange: -2.3,
};

const mockTrendData = [
  { name: 'Mon', submissions: 4200, validations: 4000, approvals: 3800 },
  { name: 'Tue', submissions: 3800, validations: 3600, approvals: 3400 },
  { name: 'Wed', submissions: 5100, validations: 4900, approvals: 4600 },
  { name: 'Thu', submissions: 4700, validations: 4500, approvals: 4200 },
  { name: 'Fri', submissions: 5800, validations: 5500, approvals: 5200 },
  { name: 'Sat', submissions: 3200, validations: 3000, approvals: 2800 },
  { name: 'Sun', submissions: 2400, validations: 2200, approvals: 2100 },
];

const mockMarketDistribution = [
  { name: 'Mile 12', value: 2847, color: CHART_COLORS.primary },
  { name: 'Onitsha', value: 2134, color: CHART_COLORS.secondary },
  { name: 'Alaba', value: 1847, color: CHART_COLORS.blue },
  { name: 'Wuse', value: 1234, color: CHART_COLORS.purple },
  { name: 'Others', value: 3870, color: CHART_COLORS.gray },
];

const mockPayoutsByNetwork = [
  { name: 'MTN', amount: 18500000, count: 4234 },
  { name: 'Airtel', amount: 12300000, count: 2847 },
  { name: 'Glo', amount: 8700000, count: 1923 },
  { name: '9mobile', amount: 6172300, count: 1456 },
];

const mockFraudAlerts: FraudAlert[] = [
  {
    id: '1',
    type: 'gps_spoofing',
    severity: 'critical',
    title: 'GPS Spoofing Detected - Mile 12',
    description: 'Multiple submissions from identical GPS coordinates by different users within 5 minutes',
    detectedAt: new Date(Date.now() - 15 * 60 * 1000),
    status: 'open',
    traderId: 'T-1234',
    marketId: 'M-001',
    evidence: [],
  },
  {
    id: '2',
    type: 'price_manipulation',
    severity: 'high',
    title: 'Price Anomaly - Rice 50kg',
    description: 'Submitted price ₦78,000 is 45% above market baseline of ₦54,000',
    detectedAt: new Date(Date.now() - 45 * 60 * 1000),
    status: 'open',
    submissionId: 'S-5678',
    traderId: 'T-2345',
    evidence: [],
  },
  {
    id: '3',
    type: 'collusion_suspected',
    severity: 'medium',
    title: 'Validator Collusion Pattern',
    description: 'Validator V-789 has approved 100% of submissions from Trader T-456 over 7 days',
    detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: 'investigating',
    validatorId: 'V-789',
    traderId: 'T-456',
    evidence: [],
  },
];

const mockActivities: ActivityItem[] = [
  { id: '1', type: 'submission', description: 'New price submission: Rice 50kg at ₦52,500 (Mile 12)', timestamp: new Date(Date.now() - 2 * 60 * 1000), user: 'Trader Chidi' },
  { id: '2', type: 'validation', description: 'Submission approved: Tomatoes basket (Onitsha)', timestamp: new Date(Date.now() - 5 * 60 * 1000), user: '3 validators' },
  { id: '3', type: 'payout', description: 'Weekly payout batch completed: ₦2.4M to 487 users', timestamp: new Date(Date.now() - 15 * 60 * 1000) },
  { id: '4', type: 'fraud_alert', description: 'GPS spoofing alert triggered for Mile 12 market', timestamp: new Date(Date.now() - 25 * 60 * 1000) },
  { id: '5', type: 'user_action', description: 'New trader registered from Kano Main Market', timestamp: new Date(Date.now() - 35 * 60 * 1000), user: 'System' },
  { id: '6', type: 'submission', description: 'New price submission: Cement bag at ₦8,200 (Iddo)', timestamp: new Date(Date.now() - 42 * 60 * 1000), user: 'Trader Emeka' },
  { id: '7', type: 'validation', description: 'Submission rejected: Price outside acceptable range', timestamp: new Date(Date.now() - 55 * 60 * 1000), user: '2 validators' },
];

// ============================================
// DASHBOARD PAGE COMPONENT
// ============================================

export default function DashboardPage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setLastUpdated(new Date());
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <PageWrapper
      title="Executive Overview"
      subtitle={`Welcome back, ${session?.user?.name || 'Admin'}`}
      actions={
        <div className="flex items-center gap-2">
          <span className="text-xs text-dash-muted">
            Updated {formatRelativeTime(lastUpdated)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="secondary" size="sm" leftIcon={Download}>
            Export
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Active Traders"
            value={mockStats.activeTraders}
            subtitle={`of ${mockStats.totalTraders.toLocaleString()}`}
            trend={mockStats.tradersChange}
            trendLabel="vs last week"
            icon={Users}
            iconColor="text-naija-green-500"
            format="compact"
          />
          <StatCard
            title="Submissions Today"
            value={mockStats.submissionsToday}
            subtitle={`${mockStats.pendingValidations} pending`}
            trend={mockStats.submissionsChange}
            trendLabel="vs yesterday"
            icon={TrendingUp}
            iconColor="text-status-info"
            format="compact"
          />
          <StatCard
            title="Pending Payouts"
            value={mockStats.totalPendingPayout}
            subtitle={`${mockStats.pendingPayoutCount} users`}
            trend={mockStats.payoutsChange}
            trendLabel="vs last week"
            icon={Wallet}
            iconColor="text-naija-gold-400"
            format="currency"
          />
          <StatCard
            title="Approval Rate"
            value={mockStats.approvalRate}
            subtitle="last 7 days"
            icon={Activity}
            iconColor="text-status-success"
            format="percentage"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main trend chart */}
          <div className="lg:col-span-2 dash-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-dash-text">Weekly Activity Trend</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs text-dash-muted">
                  <span className="w-3 h-3 rounded-full bg-naija-green-500" />
                  Submissions
                </div>
                <div className="flex items-center gap-2 text-xs text-dash-muted">
                  <span className="w-3 h-3 rounded-full bg-naija-gold-400" />
                  Validations
                </div>
                <div className="flex items-center gap-2 text-xs text-dash-muted">
                  <span className="w-3 h-3 rounded-full bg-status-info" />
                  Approvals
                </div>
              </div>
            </div>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="w-full h-full" variant="rectangular" />
              </div>
            ) : (
              <AreaChartComponent
                data={mockTrendData}
                dataKeys={[
                  { key: 'submissions', name: 'Submissions', color: CHART_COLORS.primary },
                  { key: 'validations', name: 'Validations', color: CHART_COLORS.secondary },
                  { key: 'approvals', name: 'Approvals', color: CHART_COLORS.blue },
                ]}
                height={300}
                stacked={false}
              />
            )}
          </div>

          {/* Market distribution */}
          <div className="dash-card">
            <h3 className="font-semibold text-dash-text mb-4">Market Distribution</h3>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="w-48 h-48" variant="circular" />
              </div>
            ) : (
              <PieChartComponent
                data={mockMarketDistribution}
                height={300}
                innerRadius={60}
                outerRadius={90}
                centerLabel="Markets"
                centerValue={mockStats.marketsActive}
              />
            )}
          </div>
        </div>

        {/* Second Row - Payouts by Network & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payouts by Network */}
          <div className="lg:col-span-2 dash-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-dash-text">Payouts by Network</h3>
              <Badge variant="info">This Month</Badge>
            </div>
            {isLoading ? (
              <div className="h-[250px] flex items-center justify-center">
                <Skeleton className="w-full h-full" variant="rectangular" />
              </div>
            ) : (
              <BarChartComponent
                data={mockPayoutsByNetwork}
                dataKeys={[
                  { key: 'amount', name: 'Amount (₦)', color: CHART_COLORS.primary },
                ]}
                height={250}
                formatter={(value) => formatNaira(value)}
              />
            )}
          </div>

          {/* Quick Actions */}
          <div className="dash-card">
            <h3 className="font-semibold text-dash-text mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <QuickAction
                icon={Send}
                label="Process Payouts"
                description="847 pending"
                variant="success"
              />
              <QuickAction
                icon={AlertTriangle}
                label="Review Fraud"
                description="3 critical"
                variant="danger"
              />
              <QuickAction
                icon={UserPlus}
                label="Approve Users"
                description="12 pending"
                variant="default"
              />
              <QuickAction
                icon={Shield}
                label="System Check"
                description="All healthy"
                variant="success"
              />
            </div>
          </div>
        </div>

        {/* Third Row - Fraud Alerts & Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fraud Alerts */}
          <FraudAlertsList
            alerts={mockFraudAlerts}
            title="Active Fraud Alerts"
            maxItems={3}
            onViewAll={() => console.log('View all fraud alerts')}
            onAlertView={(alert) => console.log('View alert:', alert.id)}
            onAlertResolve={(alert) => console.log('Resolve alert:', alert.id)}
          />

          {/* Activity Feed */}
          <ActivityFeed
            activities={mockActivities}
            title="Recent Activity"
            maxItems={7}
          />
        </div>

        {/* Bottom Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="dash-card p-4">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-naija-green-500" />
              <div>
                <p className="text-2xl font-bold font-mono text-dash-text">{mockStats.marketsActive}</p>
                <p className="text-xs text-dash-muted">Markets Active</p>
              </div>
            </div>
          </div>
          <div className="dash-card p-4">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-naija-gold-400" />
              <div>
                <p className="text-2xl font-bold font-mono text-dash-text">{mockStats.commoditiesTracked}</p>
                <p className="text-xs text-dash-muted">Commodities</p>
              </div>
            </div>
          </div>
          <div className="dash-card p-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-status-info" />
              <div>
                <p className="text-2xl font-bold font-mono text-dash-text">{mockStats.activeValidators.toLocaleString()}</p>
                <p className="text-xs text-dash-muted">Validators</p>
              </div>
            </div>
          </div>
          <div className="dash-card p-4">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-status-success" />
              <div>
                <p className="text-2xl font-bold font-mono text-dash-text">{mockStats.pricePointsToday.toLocaleString()}</p>
                <p className="text-xs text-dash-muted">Price Points Today</p>
              </div>
            </div>
          </div>
          <div className="dash-card p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-status-warning" />
              <div>
                <p className="text-2xl font-bold font-mono text-dash-text">{mockStats.pendingValidations}</p>
                <p className="text-xs text-dash-muted">Pending Validations</p>
              </div>
            </div>
          </div>
          <div className="dash-card p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-status-success" />
              <div>
                <p className="text-2xl font-bold font-mono text-dash-text">+{mockStats.newUsersToday}</p>
                <p className="text-xs text-dash-muted">New Users Today</p>
              </div>
            </div>
          </div>
        </div>

        {/* System Status Bar */}
        <div className="dash-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-dash-text">System Status</h3>
            <div className="flex items-center gap-6">
              <StatusIndicator status="operational" label="API" showPulse />
              <StatusIndicator status="operational" label="Database" showPulse />
              <StatusIndicator status="operational" label="WhatsApp" showPulse />
              <StatusIndicator status="operational" label="Payments" showPulse />
              <StatusIndicator status="operational" label="Sync" showPulse />
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
