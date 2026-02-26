'use client';

// ============================================================
// app/dashboard/analytics/page.tsx
// GA4 Analytics Page — NaijaMarket Intel Admin
// Bloomberg-style dark intelligence dashboard
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────
interface SessionData {
  date: string;
  sessions: number;
  pageviews: number;
  avgSessionDuration: number;
}

interface GeographyData {
  city: string;
  country: string;
  sessions: number;
  users: number;
}

interface UserTypeData {
  newUsers: number;
  returningUsers: number;
  totalUsers: number;
}

interface TopPage {
  page: string;
  pageviews: number;
  avgTimeOnPage: number;
}

interface AnalyticsData {
  realtime: {
    activeUsers: number;
    activeUsersByPage: Array<{ page: string; users: number }>;
  };
  sessions: SessionData[];
  geography: GeographyData[];
  userTypes: UserTypeData;
  topPages: TopPage[];
  summary: {
    totalSessions28d: number;
    totalPageviews28d: number;
    totalUsers28d: number;
  };
  configured?: boolean;
  error?: string;
}

// ─── Colour Palette ──────────────────────────────────────────
const COLORS = {
  green: '#00ff88',
  greenDim: '#00cc6a',
  greenFaint: 'rgba(0,255,136,0.12)',
  amber: '#f59e0b',
  blue: '#3b82f6',
  purple: '#a855f7',
  red: '#ef4444',
  bgCard: 'rgba(255,255,255,0.04)',
  bgCardHover: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.08)',
  textPrimary: '#f0f0f0',
  textSecondary: '#8a8a8a',
  bgPage: '#0a0f0d',
};

const PIE_COLORS = [COLORS.green, COLORS.blue];

// ─── Helpers ─────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ─── Sub-components ───────────────────────────────────────────

// KPI Card
function KpiCard({
  label, value, sub, accent = COLORS.green, pulse = false,
}: {
  label: string; value: string | number; sub?: string;
  accent?: string; pulse?: boolean;
}) {
  return (
    <div style={{
      background: COLORS.bgCard,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex', flexDirection: 'column', gap: 6,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Accent glow top-left */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: 48, height: 3,
        background: accent, borderRadius: '0 0 4px 0',
      }} />

      <span style={{ fontSize: 11, color: COLORS.textSecondary, letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: 'monospace' }}>
        {label}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {pulse && (
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: accent,
            boxShadow: `0 0 8px ${accent}`,
            animation: 'pulse 1.5s ease-in-out infinite',
            display: 'inline-block', flexShrink: 0,
          }} />
        )}
        <span style={{ fontSize: 32, fontWeight: 700, color: accent, fontFamily: 'monospace', letterSpacing: -1 }}>
          {value}
        </span>
      </div>

      {sub && (
        <span style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: 'monospace' }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// Section Header
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{
        margin: 0, fontSize: 13, fontWeight: 600,
        color: COLORS.textPrimary, letterSpacing: 1.5,
        textTransform: 'uppercase', fontFamily: 'monospace',
      }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: COLORS.textSecondary, fontFamily: 'monospace' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// Custom Tooltip for charts
const ChartTooltip = ({ active, payload, label }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#111', border: `1px solid ${COLORS.border}`,
      borderRadius: 8, padding: '10px 14px',
      fontFamily: 'monospace', fontSize: 12,
    }}>
      <p style={{ margin: '0 0 6px', color: COLORS.textSecondary }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: '2px 0', color: p.color }}>
          {p.name}: <strong>{formatNumber(p.value)}</strong>
        </p>
      ))}
    </div>
  );
};

// Not Configured Banner
function NotConfiguredBanner() {
  return (
    <div style={{
      background: 'rgba(245,158,11,0.08)',
      border: `1px solid rgba(245,158,11,0.3)`,
      borderRadius: 12, padding: 24, margin: '0 0 24px',
      fontFamily: 'monospace',
    }}>
      <h3 style={{ margin: '0 0 8px', color: COLORS.amber, fontSize: 14 }}>
        ⚠️ GA4 Not Yet Configured
      </h3>
      <p style={{ margin: '0 0 12px', color: COLORS.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
        To enable analytics, add these environment variables in Vercel:
      </p>
      <div style={{
        background: '#111', borderRadius: 8, padding: 16,
        fontSize: 12, color: COLORS.green, lineHeight: 2,
      }}>
        <div><span style={{ color: COLORS.textSecondary }}># In Vercel → Settings → Environment Variables</span></div>
        <div>GOOGLE_SERVICE_ACCOUNT_KEY=<span style={{ color: COLORS.amber }}>{'{"type":"service_account",...}'}</span></div>
        <div>GA4_PROPERTY_ID=<span style={{ color: COLORS.amber }}>123456789</span></div>
        <div>NEXT_PUBLIC_GA_MEASUREMENT_ID=<span style={{ color: COLORS.amber }}>G-XXXXXXXXXX</span></div>
      </div>
      <p style={{ margin: '12px 0 0', color: COLORS.textSecondary, fontSize: 12 }}>
        📋 See setup guide: <a href="#setup-guide" style={{ color: COLORS.green }}>How to get service account credentials →</a>
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'geography' | 'pages'>('overview');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/analytics', { cache: 'no-store' });
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setData({ configured: false } as AnalyticsData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Prepared chart data ──────────────────────────────────
  const sessionChartData = (data?.sessions || []).map((s) => ({
    date: formatDate(s.date),
    Sessions: s.sessions,
    Pageviews: s.pageviews,
  }));

  const userTypePieData = data?.userTypes
    ? [
        { name: 'New Users', value: data.userTypes.newUsers },
        { name: 'Returning', value: data.userTypes.returningUsers },
      ]
    : [];

  const geoBarData = (data?.geography || [])
    .filter((g) => g.country === 'Nigeria' || g.sessions > 5)
    .slice(0, 12)
    .map((g) => ({
      city: g.city === '(not set)' ? 'Unknown' : g.city,
      Sessions: g.sessions,
      Users: g.users,
    }));

  const isNotConfigured = data?.configured === false || (!loading && data?.error?.includes('not configured'));

  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.bgPage,
      color: COLORS.textPrimary,
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      padding: '24px 32px',
    }}>
      {/* Pulse animation */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap');
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .analytics-card { animation: fadeIn 0.4s ease forwards; }
        .tab-btn {
          background: transparent;
          border: 1px solid transparent;
          border-radius: 6px;
          padding: 6px 16px;
          font-family: monospace;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }
        .tab-btn:hover { border-color: rgba(0,255,136,0.3); }
        .tab-btn.active {
          background: rgba(0,255,136,0.1);
          border-color: rgba(0,255,136,0.5);
          color: #00ff88;
        }
        .tab-btn.inactive { color: #8a8a8a; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
      `}</style>

      {/* ── Page Header ─────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 20, fontWeight: 700,
            color: COLORS.textPrimary, letterSpacing: 1,
          }}>
            ANALYTICS INTELLIGENCE
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: COLORS.textSecondary }}>
            NaijaMarket Intel · naijamarketintel.ng · Last 28 days
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: 'monospace' }}>
              Updated {lastUpdated.toLocaleTimeString('en-NG')}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              background: COLORS.greenFaint,
              border: `1px solid rgba(0,255,136,0.3)`,
              color: COLORS.green, borderRadius: 8,
              padding: '8px 16px', fontSize: 12,
              fontFamily: 'monospace', cursor: 'pointer',
              letterSpacing: 0.8, textTransform: 'uppercase',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? '↻ Loading...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* ── Not Configured Warning ───────────────────────── */}
      {isNotConfigured && <NotConfiguredBanner />}

      {/* ── Realtime Active Users Banner ─────────────────── */}
      {!isNotConfigured && (
        <div className="analytics-card" style={{
          background: 'linear-gradient(135deg, rgba(0,255,136,0.08) 0%, rgba(0,0,0,0) 60%)',
          border: `1px solid rgba(0,255,136,0.2)`,
          borderRadius: 12, padding: '16px 24px',
          display: 'flex', alignItems: 'center', gap: 16,
          marginBottom: 24,
        }}>
          <span style={{
            width: 12, height: 12, borderRadius: '50%',
            background: COLORS.green,
            boxShadow: `0 0 12px ${COLORS.green}`,
            animation: 'pulse 1.5s ease-in-out infinite',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 13, color: COLORS.textSecondary }}>REALTIME</span>
          <span style={{
            fontSize: 36, fontWeight: 700, color: COLORS.green, letterSpacing: -2, fontFamily: 'monospace',
          }}>
            {loading ? '—' : (data?.realtime?.activeUsers ?? 0)}
          </span>
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>
            active users on naijamarketintel.ng right now
          </span>

          {/* Active pages */}
          {(data?.realtime?.activeUsersByPage?.length ?? 0) > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {data!.realtime.activeUsersByPage.slice(0, 3).map((p, i) => (
                <span key={i} style={{
                  background: COLORS.bgCard, border: `1px solid ${COLORS.border}`,
                  borderRadius: 6, padding: '3px 10px',
                  fontSize: 11, color: COLORS.textSecondary, fontFamily: 'monospace',
                }}>
                  {p.page.length > 20 ? p.page.slice(0, 20) + '…' : p.page} · {p.users}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── KPI Summary Cards ─────────────────────────────── */}
      <div className="analytics-card" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16, marginBottom: 28,
      }}>
        <KpiCard
          label="Total Sessions (28d)"
          value={loading ? '—' : formatNumber(data?.summary?.totalSessions28d ?? 0)}
          sub="Website visits"
          accent={COLORS.green}
        />
        <KpiCard
          label="Pageviews (28d)"
          value={loading ? '—' : formatNumber(data?.summary?.totalPageviews28d ?? 0)}
          sub="Pages loaded"
          accent={COLORS.blue}
        />
        <KpiCard
          label="Total Users (28d)"
          value={loading ? '—' : formatNumber(data?.summary?.totalUsers28d ?? 0)}
          sub="Unique visitors"
          accent={COLORS.amber}
        />
        <KpiCard
          label="New User Rate"
          value={loading || !data?.userTypes?.totalUsers ? '—' :
            `${Math.round((data.userTypes.newUsers / data.userTypes.totalUsers) * 100)}%`}
          sub={`${formatNumber(data?.userTypes?.newUsers ?? 0)} new this period`}
          accent={COLORS.purple}
        />
      </div>

      {/* ── Tab Navigation ───────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['overview', 'geography', 'pages'] as const).map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : 'inactive'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' ? '📊 Traffic Overview'
              : tab === 'geography' ? '🇳🇬 Geography'
              : '📄 Top Pages'}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB: OVERVIEW                                     */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="analytics-card" style={{ display: 'grid', gap: 20 }}>

          {/* Sessions + Pageviews Line Chart */}
          <div style={{
            background: COLORS.bgCard, border: `1px solid ${COLORS.border}`,
            borderRadius: 12, padding: 24,
          }}>
            <SectionHeader
              title="Sessions & Pageviews"
              subtitle="Daily traffic for the last 28 days"
            />
            {loading ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textSecondary }}>
                Loading chart data...
              </div>
            ) : sessionChartData.length === 0 ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textSecondary, fontSize: 13 }}>
                No data yet — GA4 tag may not be installed on the consumer site
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={sessionChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                  <XAxis
                    dataKey="date" tick={{ fill: COLORS.textSecondary, fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={{ stroke: COLORS.border }}
                    tickLine={false}
                    interval={3}
                  />
                  <YAxis
                    tick={{ fill: COLORS.textSecondary, fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={formatNumber}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, fontFamily: 'monospace', paddingTop: 12 }}
                  />
                  <Line
                    type="monotone" dataKey="Sessions"
                    stroke={COLORS.green} strokeWidth={2}
                    dot={false} activeDot={{ r: 4, fill: COLORS.green }}
                  />
                  <Line
                    type="monotone" dataKey="Pageviews"
                    stroke={COLORS.blue} strokeWidth={2}
                    dot={false} activeDot={{ r: 4, fill: COLORS.blue }}
                    strokeDasharray="4 2"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* New vs Returning — Donut */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{
              background: COLORS.bgCard, border: `1px solid ${COLORS.border}`,
              borderRadius: 12, padding: 24,
            }}>
              <SectionHeader title="New vs. Returning" subtitle="User acquisition breakdown" />
              {loading ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textSecondary }}>
                  Loading...
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={userTypePieData} cx="50%" cy="50%"
                        innerRadius={45} outerRadius={70}
                        dataKey="value" strokeWidth={0}
                      >
                        {userTypePieData.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS.green, display: 'inline-block' }} />
                        <span style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>New Users</span>
                      </div>
                      <span style={{ fontSize: 24, fontWeight: 700, color: COLORS.green, fontFamily: 'monospace' }}>
                        {formatNumber(data?.userTypes?.newUsers ?? 0)}
                      </span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS.blue, display: 'inline-block' }} />
                        <span style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>Returning</span>
                      </div>
                      <span style={{ fontSize: 24, fontWeight: 700, color: COLORS.blue, fontFamily: 'monospace' }}>
                        {formatNumber(data?.userTypes?.returningUsers ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Avg Session Duration Gauge */}
            <div style={{
              background: COLORS.bgCard, border: `1px solid ${COLORS.border}`,
              borderRadius: 12, padding: 24,
            }}>
              <SectionHeader title="Engagement Quality" subtitle="Session behaviour metrics" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                {[
                  {
                    label: 'Avg Session Duration',
                    value: loading ? '—' : formatDuration(
                      (data?.sessions || []).reduce((sum, s) => sum + s.avgSessionDuration, 0) /
                      Math.max((data?.sessions?.length ?? 1), 1)
                    ),
                    accent: COLORS.green,
                  },
                  {
                    label: 'Pages Per Session',
                    value: loading ? '—' :
                      ((data?.summary?.totalPageviews28d ?? 0) / Math.max(data?.summary?.totalSessions28d ?? 1, 1)).toFixed(1),
                    accent: COLORS.blue,
                  },
                  {
                    label: 'Total Active Days',
                    value: (data?.sessions || []).filter((s) => s.sessions > 0).length || '—',
                    accent: COLORS.amber,
                  },
                ].map((metric, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: i < 2 ? `1px solid ${COLORS.border}` : 'none',
                  }}>
                    <span style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: 'monospace' }}>{metric.label}</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: metric.accent, fontFamily: 'monospace' }}>
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB: GEOGRAPHY                                     */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'geography' && (
        <div className="analytics-card" style={{
          background: COLORS.bgCard, border: `1px solid ${COLORS.border}`,
          borderRadius: 12, padding: 24,
        }}>
          <SectionHeader
            title="🇳🇬 Nigerian Market Geography"
            subtitle="Sessions by city — last 28 days"
          />
          {loading ? (
            <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textSecondary }}>
              Loading geography data...
            </div>
          ) : geoBarData.length === 0 ? (
            <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textSecondary, flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 32 }}>🇳🇬</span>
              <span>No geography data yet — GA4 tag needed on consumer site</span>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={geoBarData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} horizontal={false} />
                  <XAxis type="number" tick={{ fill: COLORS.textSecondary, fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={false} tickLine={false} tickFormatter={formatNumber} />
                  <YAxis type="category" dataKey="city"
                    tick={{ fill: COLORS.textSecondary, fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Sessions" fill={COLORS.green} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Users" fill={COLORS.blue} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Raw table */}
              <div style={{ marginTop: 24 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
                  <thead>
                    <tr>
                      {['#', 'City', 'Country', 'Sessions', 'Users'].map((h) => (
                        <th key={h} style={{
                          textAlign: h === '#' || h === 'Sessions' || h === 'Users' ? 'right' : 'left',
                          padding: '8px 12px',
                          color: COLORS.textSecondary, fontSize: 11,
                          borderBottom: `1px solid ${COLORS.border}`,
                          textTransform: 'uppercase', letterSpacing: 0.8,
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.geography || []).slice(0, 15).map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ textAlign: 'right', padding: '10px 12px', color: COLORS.textSecondary }}>{i + 1}</td>
                        <td style={{ padding: '10px 12px', color: COLORS.textPrimary }}>
                          {row.city === '(not set)' ? 'Unknown' : row.city}
                        </td>
                        <td style={{ padding: '10px 12px', color: COLORS.textSecondary }}>
                          {row.country === 'Nigeria' ? '🇳🇬 Nigeria' : row.country}
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', color: COLORS.green, fontWeight: 600 }}>
                          {formatNumber(row.sessions)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', color: COLORS.blue }}>
                          {formatNumber(row.users)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB: TOP PAGES                                    */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'pages' && (
        <div className="analytics-card" style={{
          background: COLORS.bgCard, border: `1px solid ${COLORS.border}`,
          borderRadius: 12, padding: 24,
        }}>
          <SectionHeader title="Top Pages" subtitle="Most visited pages on naijamarketintel.ng — last 28 days" />

          {loading ? (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textSecondary }}>
              Loading page data...
            </div>
          ) : (data?.topPages?.length ?? 0) === 0 ? (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textSecondary }}>
              No page data yet
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'monospace' }}>
              <thead>
                <tr>
                  {['#', 'Page Path', 'Pageviews', 'Avg Time'].map((h) => (
                    <th key={h} style={{
                      textAlign: h === '#' || h === 'Pageviews' || h === 'Avg Time' ? 'right' : 'left',
                      padding: '10px 16px',
                      color: COLORS.textSecondary, fontSize: 11,
                      borderBottom: `1px solid ${COLORS.border}`,
                      textTransform: 'uppercase', letterSpacing: 0.8,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.topPages || []).map((page, i) => {
                  const maxViews = data!.topPages[0].pageviews;
                  const pct = Math.round((page.pageviews / maxViews) * 100);
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={{ textAlign: 'right', padding: '12px 16px', color: COLORS.textSecondary, width: 30 }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ color: COLORS.textPrimary, marginBottom: 4 }}>
                          {page.page}
                        </div>
                        {/* Visual bar */}
                        <div style={{
                          height: 3, background: COLORS.border, borderRadius: 2, width: '100%', maxWidth: 300,
                        }}>
                          <div style={{
                            height: '100%', background: COLORS.green,
                            borderRadius: 2, width: `${pct}%`,
                          }} />
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px 16px', color: COLORS.green, fontWeight: 600, fontSize: 15 }}>
                        {formatNumber(page.pageviews)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px 16px', color: COLORS.textSecondary }}>
                        {formatDuration(page.avgTimeOnPage)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────── */}
      <div style={{
        marginTop: 32, paddingTop: 16,
        borderTop: `1px solid ${COLORS.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 11, color: COLORS.textSecondary, fontFamily: 'monospace',
      }}>
        <span>DATA SOURCE: Google Analytics 4 · Property: NaijaMarket Intel</span>
        <span>Auto-refreshes every 5 minutes · Powered by GA4 Data API</span>
      </div>
    </div>
  );
}
