'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { PageWrapper } from '@/components/dashboard/layout';
import { StatCard, Badge, Button, Skeleton } from '@/components/ui';
import { 
  AreaChartComponent, 
  PieChartComponent, 
  BarChartComponent,
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
  Bot,
  CheckCircle2,
  XCircle,
  BarChart3,
  Play,
} from 'lucide-react';
import type { FraudAlert, ActivityItem, AdreMetrics } from '@/types';

// ============================================
// TYPES
// ============================================

interface SyntheticStats {
  syntheticTraders:        number;
  syntheticValidators:     number;
  submissionsToday:        number;
  submissionsApproved:     number;
  submissionsRejected:     number;
  votesToday:              number;
  marketsWithActivity:     number;
  totalMarkets:            number;
  approvalRate:            number;
  marketCoverage:          number;
  avgVotesPerSubmission:   number;
  lastRunAt:               string | null;
}

// ============================================
// MOCK DATA (existing — unchanged)
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
// SYNTHETIC ENGINE SECTION COMPONENT
// ============================================

function SyntheticEngineSection() {
  const [stats, setStats]         = useState<SyntheticStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [running, setRunning]     = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/synthetic/stats', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setStats(json.data as SyntheticStats);
      } else {
        setError(json.error ?? 'Failed to load');
      }
    } catch (e) {
      setError('Network error');
      console.error('[SyntheticEngineSection]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleTestRun = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/synthetic/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market_id: 'MKT0001' }),
      });
      const json = await res.json();
      setRunResult(json.success
        ? '✓ Test run complete for MKT0001 (Mile 12)'
        : `Error: ${json.error ?? 'Unknown'}`
      );
      // Refresh stats after run
      await fetchStats();
    } catch {
      setRunResult('Error: Network failure');
    } finally {
      setRunning(false);
    }
  };

  const engineRunToday = (stats?.submissionsToday ?? 0) > 0;

  return (
    <div className="dash-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-dash-text">Synthetic Activity Engine</h3>
            <p className="text-xs text-dash-muted">
              Pre-launch simulation — keeps validation pipeline active before real traders join
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Engine status pill */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
            engineRunToday
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${engineRunToday ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
            {engineRunToday ? 'ACTIVE TODAY' : 'NOT RUN TODAY'}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchStats}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error} — Check that sp_Seed_Synthetic_Traders and sp_Seed_Synthetic_Validators have been run.
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">

            {/* Synthetic Traders */}
            <div className="bg-[#0f1320] rounded-lg p-3 border border-gray-800/60">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs text-dash-muted">Syn Traders</span>
              </div>
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <p className="text-xl font-bold font-mono text-dash-text">
                  {stats?.syntheticTraders.toLocaleString() ?? '—'}
                </p>
              )}
              <p className="text-xs text-dash-muted mt-0.5">4 per market</p>
            </div>

            {/* Synthetic Validators */}
            <div className="bg-[#0f1320] rounded-lg p-3 border border-gray-800/60">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-dash-muted">Syn Validators</span>
              </div>
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <p className="text-xl font-bold font-mono text-dash-text">
                  {stats?.syntheticValidators.toLocaleString() ?? '—'}
                </p>
              )}
              <p className="text-xs text-dash-muted mt-0.5">10 per market</p>
            </div>

            {/* Submissions today */}
            <div className="bg-[#0f1320] rounded-lg p-3 border border-gray-800/60">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs text-dash-muted">Submissions</span>
              </div>
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <p className="text-xl font-bold font-mono text-dash-text">
                  {stats?.submissionsToday.toLocaleString() ?? '—'}
                </p>
              )}
              <p className="text-xs text-dash-muted mt-0.5">today</p>
            </div>

            {/* Votes today */}
            <div className="bg-[#0f1320] rounded-lg p-3 border border-gray-800/60">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs text-dash-muted">Votes Cast</span>
              </div>
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <p className="text-xl font-bold font-mono text-dash-text">
                  {stats?.votesToday.toLocaleString() ?? '—'}
                </p>
              )}
              <p className="text-xs text-dash-muted mt-0.5">
                avg {stats?.avgVotesPerSubmission ?? '—'}/sub
              </p>
            </div>

            {/* Market coverage */}
            <div className="bg-[#0f1320] rounded-lg p-3 border border-gray-800/60">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-3.5 h-3.5 text-naija-green-500" />
                <span className="text-xs text-dash-muted">Markets Covered</span>
              </div>
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <p className="text-xl font-bold font-mono text-dash-text">
                  {stats?.marketsWithActivity ?? '—'}
                  <span className="text-sm text-dash-muted font-normal">/{stats?.totalMarkets ?? '—'}</span>
                </p>
              )}
              <p className="text-xs text-dash-muted mt-0.5">{stats?.marketCoverage ?? 0}% coverage</p>
            </div>

            {/* Approval rate */}
            <div className="bg-[#0f1320] rounded-lg p-3 border border-gray-800/60">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-3.5 h-3.5 text-naija-gold-400" />
                <span className="text-xs text-dash-muted">Approval Rate</span>
              </div>
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <p className={`text-xl font-bold font-mono ${
                  (stats?.approvalRate ?? 0) >= 85 ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {stats?.approvalRate ?? '—'}%
                </p>
              )}
              <p className="text-xs text-dash-muted mt-0.5">
                {stats?.submissionsApproved ?? 0}✓ {stats?.submissionsRejected ?? 0}✗
              </p>
            </div>
          </div>

          {/* Approved / Rejected bar */}
          {!loading && (stats?.submissionsToday ?? 0) > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between text-xs text-dash-muted mb-1.5">
                <span>Today's consensus breakdown</span>
                <span>{stats!.submissionsApproved} approved · {stats!.submissionsRejected} rejected</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${stats!.approvalRate}%` }}
                />
                <div
                  className="h-full bg-red-500/60 transition-all duration-500"
                  style={{ width: `${100 - stats!.approvalRate}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer row — last run info + test trigger */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-800/60">
            <div className="text-xs text-dash-muted">
              {stats?.lastRunAt
                ? <>Last synthetic submission: <span className="text-dash-text">{stats.lastRunAt}</span></>
                : 'No synthetic activity yet — seed SPs not run'
              }
            </div>
            <div className="flex items-center gap-3">
              {runResult && (
                <span className={`text-xs ${runResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                  {runResult}
                </span>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTestRun}
                disabled={running}
              >
                <Play className={`w-3.5 h-3.5 mr-1.5 ${running ? 'animate-pulse' : ''}`} />
                {running ? 'Running...' : 'Test Run (MKT0001)'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// ADRE SECTION COMPONENT (W5)
// Average Daily Reporter Earnings — live from /api/rewards/adre
// ============================================

function AdreSection() {
  const [adreData, setAdreData] = useState<AdreMetrics | null>(null);
  const [adreLoading, setAdreLoading] = useState(true);
  const [adreError, setAdreError] = useState<string | null>(null);

  const fetchAdre = useCallback(async () => {
    try {
      setAdreError(null);
      const res = await fetch('/api/rewards/adre', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setAdreData(json as AdreMetrics);
      } else {
        setAdreError(json.error ?? 'Failed to load');
      }
    } catch (e) {
      setAdreError('Network error');
      console.error('[AdreSection]', e);
    } finally {
      setAdreLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdre();
    const interval = setInterval(fetchAdre, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAdre]);

  const today = adreData?.today;
  const thresholds = adreData?.thresholds;
  const floor = thresholds?.floor ?? 700;
  const ceiling = thresholds?.ceiling ?? 1500;

  const chartData = (adreData?.sparkline ?? []).map((d) => ({
    name: d.cache_date,
    adre: d.adre_value,
    floor,
    ceiling,
  }));

  return (
    <div className="dash-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-naija-gold-400/10 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-naija-gold-400" />
          </div>
          <div>
            <h3 className="font-semibold text-dash-text">Reporter Earnings (ADRE)</h3>
            <p className="text-xs text-dash-muted">
              Average Daily Reporter Earnings — qualified reporters (≥5 approved/day)
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchAdre} disabled={adreLoading}>
          <RefreshCw className={`w-3.5 h-3.5 ${adreLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {adreError ? (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {adreError}
        </div>
      ) : (
        <>
          {/* Top row: big ADRE + side stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="bg-[#0f1320] rounded-lg p-4 border border-gray-800/60">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-naija-gold-400" />
                <span className="text-xs text-dash-muted">Today&apos;s ADRE</span>
              </div>
              {adreLoading ? (
                <Skeleton className="h-9 w-28" />
              ) : (
                <p className="text-3xl font-bold font-mono text-dash-text">
                  {formatNaira(today?.adre ?? 0)}
                </p>
              )}
              <p className="text-xs text-dash-muted mt-1">
                floor {formatNaira(floor)} · ceiling {formatNaira(ceiling)}
              </p>
            </div>

            <div className="bg-[#0f1320] rounded-lg p-4 border border-gray-800/60">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-3.5 h-3.5 text-status-info" />
                <span className="text-xs text-dash-muted">Qualified Reporters</span>
              </div>
              {adreLoading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <p className="text-3xl font-bold font-mono text-dash-text">
                  {(today?.qualified_reporters ?? 0).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-dash-muted mt-1">≥5 approved submissions today</p>
            </div>

            <div className="bg-[#0f1320] rounded-lg p-4 border border-gray-800/60">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-3.5 h-3.5 text-naija-green-500" />
                <span className="text-xs text-dash-muted">Total Credits</span>
              </div>
              {adreLoading ? (
                <Skeleton className="h-9 w-28" />
              ) : (
                <p className="text-3xl font-bold font-mono text-dash-text">
                  {formatNaira(today?.total_credits ?? 0)}
                </p>
              )}
              <p className="text-xs text-dash-muted mt-1">distributed to qualified reporters</p>
            </div>
          </div>

          {/* Alert banner */}
          {!adreLoading && today?.alert_ceiling && (
            <div className="p-4 mb-5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                ADRE above {formatNaira(ceiling)} for {today.consecutive_ceiling_breaches} consecutive
                days — investigate submission inflation and validator collusion
              </span>
            </div>
          )}
          {!adreLoading && today?.alert_floor && !today?.alert_ceiling && (
            <div className="p-4 mb-5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                ADRE below {formatNaira(floor)} for {today.consecutive_floor_breaches} consecutive
                days — investigate assignment volumes and bonus job health
              </span>
            </div>
          )}

          {/* 7-day sparkline */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-dash-muted mb-2">
              <span>7-day ADRE trend</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-naija-gold-400" /> ADRE
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500" /> Floor / Ceiling
                </span>
              </div>
            </div>
            {adreLoading ? (
              <Skeleton className="w-full h-[220px]" variant="rectangular" />
            ) : chartData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-dash-muted">
                No cached history yet — trend builds up daily.
              </div>
            ) : (
              <AreaChartComponent
                data={chartData}
                dataKeys={[
                  { key: 'adre', name: 'ADRE', color: CHART_COLORS.secondary },
                  { key: 'floor', name: 'Floor', color: CHART_COLORS.gray },
                  { key: 'ceiling', name: 'Ceiling', color: CHART_COLORS.red },
                ]}
                height={220}
                gradient={false}
                formatter={(value) => formatNaira(value)}
              />
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-gray-800/60 text-xs text-dash-muted">
            {adreData?.computed_at
              ? <>Last computed: <span className="text-dash-text">{formatRelativeTime(new Date(adreData.computed_at))}</span></>
              : '—'}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// DASHBOARD PAGE COMPONENT
// ============================================

export default function DashboardPage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
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
            value={formatNaira(mockStats.totalPendingPayout)}
            subtitle={`${mockStats.pendingPayoutCount} transactions`}
            trend={mockStats.payoutsChange}
            trendLabel="vs last week"
            icon={Wallet}
            iconColor="text-naija-gold-400"
          />
          <StatCard
            title="Fraud Alerts"
            value={3}
            subtitle="2 under investigation"
            icon={AlertTriangle}
            iconColor="text-status-danger"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weekly Activity Trend */}
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
          <FraudAlertsList
            alerts={mockFraudAlerts}
            title="Active Fraud Alerts"
            maxItems={3}
            onViewAll={() => console.log('View all fraud alerts')}
            onAlertView={(alert) => console.log('View alert:', alert.id)}
            onAlertResolve={(alert) => console.log('Resolve alert:', alert.id)}
          />
          <ActivityFeed
            activities={mockActivities}
            title="Recent Activity"
            maxItems={7}
          />
        </div>

        {/* ── SYNTHETIC ENGINE ─────────────────────────────────────────── */}
        <SyntheticEngineSection />

        {/* ── ADRE — REPORTER EARNINGS (W5) ────────────────────────────── */}
        <AdreSection />

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
              <StatusIndicator status="operational" label="API"       showPulse />
              <StatusIndicator status="operational" label="Database"  showPulse />
              <StatusIndicator status="operational" label="WhatsApp"  showPulse />
              <StatusIndicator status="operational" label="Payments"  showPulse />
              <StatusIndicator status="operational" label="Sync"      showPulse />
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
