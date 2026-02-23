'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageWrapper } from '@/components/dashboard/layout';
import {
  Activity, RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock,
  Database, Globe, Server, Mail, MessageSquare, CreditCard, Loader2,
  Shield, HardDrive, Layers,
} from 'lucide-react';

interface ServiceCheck {
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'placeholder';
  responseTime: number;
  message: string;
  lastChecked: string;
}

interface HealthData {
  overall_status: string;
  uptime_pct: number;
  avg_response_time: number;
  total_check_time: number;
  services: ServiceCheck[];
  database: { size: string; tables: number; totalRows: number };
  recent_errors: any[];
}

const SERVICE_ICONS: Record<string, any> = {
  'Azure SQL Database': Database,
  'Consumer Website': Globe,
  'Admin Dashboard': Server,
  'Brevo Email': Mail,
  'WhatsApp API (Twilio)': MessageSquare,
  'VTPass Payment': CreditCard,
};

const STATUS_CONFIG = {
  operational: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', badge: 'bg-green-500/20 text-green-400', label: 'Operational' },
  degraded: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', badge: 'bg-yellow-500/20 text-yellow-400', label: 'Degraded' },
  down: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', badge: 'bg-red-500/20 text-red-400', label: 'Down' },
  placeholder: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/10', badge: 'bg-gray-500/20 text-gray-400', label: 'Not Configured' },
};

const OVERALL_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  operational: { label: 'All Systems Operational', color: 'text-green-400', icon: CheckCircle },
  degraded: { label: 'Performance Degraded', color: 'text-yellow-400', icon: AlertTriangle },
  partial_outage: { label: 'Partial Outage', color: 'text-orange-400', icon: AlertTriangle },
  major_outage: { label: 'Major Outage', color: 'text-red-400', icon: XCircle },
};

export default function SystemHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Health check failed');
      setData(json.data);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchHealth, 60000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const overall = data ? OVERALL_CONFIG[data.overall_status] || OVERALL_CONFIG.operational : null;

  const formatTime = (ms: number) => {
    if (ms === 0) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatRows = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <PageWrapper
      title="System Health"
      subtitle="Real-time platform health checks and service status"
      actions={
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="flex items-center gap-1.5 text-xs text-dash-muted">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live Data
              <span className="text-dash-muted/60">
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            </span>
          )}
          <button onClick={fetchHealth} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dash-bg border border-dash-border text-dash-muted hover:text-dash-text transition-colors text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {loading ? 'Checking...' : 'Refresh'}
          </button>
        </div>
      }
    >
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-400 text-sm">{error}</span>
          <button onClick={fetchHealth} className="ml-auto text-red-400 hover:text-red-300 text-sm underline">Retry</button>
        </div>
      )}

      {/* Overall Status Banner */}
      <div className={`dash-card p-5 mb-6 ${data?.overall_status === 'operational' ? 'border-green-500/30' : data?.overall_status === 'degraded' ? 'border-yellow-500/30' : 'border-red-500/30'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {loading ? (
              <Loader2 className="w-8 h-8 text-dash-muted animate-spin" />
            ) : overall ? (
              <overall.icon className={`w-8 h-8 ${overall.color}`} />
            ) : (
              <Activity className="w-8 h-8 text-dash-muted" />
            )}
            <div>
              <h2 className={`text-xl font-bold ${overall?.color || 'text-dash-text'}`}>
                {loading ? 'Running Health Checks...' : overall?.label || 'Unknown'}
              </h2>
              <p className="text-sm text-dash-muted">
                {data ? `Health check completed in ${formatTime(data.total_check_time)}` : 'Checking all services...'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-naija-green-400">{data?.uptime_pct?.toFixed(2) || '—'}%</p>
            <p className="text-xs text-dash-muted">Availability</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="dash-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-dash-muted">Avg Response Time</span>
            <Activity className="w-5 h-5 text-naija-green-400" />
          </div>
          <p className="text-2xl font-bold text-dash-text">{data ? formatTime(data.avg_response_time) : '...'}</p>
          <p className="text-xs text-dash-muted mt-1">across all services</p>
        </div>
        <div className="dash-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-dash-muted">Services Checked</span>
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-dash-text">{data?.services?.length || '...'}</p>
          <p className="text-xs text-dash-muted mt-1">
            {data ? `${data.services.filter(s => s.status === 'operational').length} operational` : '...'}
          </p>
        </div>
        <div className="dash-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-dash-muted">Database Size</span>
            <HardDrive className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-dash-text">{data?.database?.size || '...'}</p>
          <p className="text-xs text-dash-muted mt-1">{data ? `${data.database.tables} tables` : '...'}</p>
        </div>
        <div className="dash-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-dash-muted">Total Records</span>
            <Layers className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-dash-text">{data ? formatRows(data.database.totalRows) : '...'}</p>
          <p className="text-xs text-dash-muted mt-1">across all tables</p>
        </div>
      </div>

      {/* Service Status Grid */}
      <h3 className="font-semibold text-dash-text mb-3">Service Status</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="dash-card p-4 animate-pulse">
              <div className="h-4 bg-dash-border rounded w-2/3 mb-3" />
              <div className="h-6 bg-dash-border rounded w-1/3 mb-2" />
              <div className="h-3 bg-dash-border rounded w-full" />
            </div>
          ))
        ) : data?.services?.map(svc => {
          const cfg = STATUS_CONFIG[svc.status] || STATUS_CONFIG.placeholder;
          const Icon = SERVICE_ICONS[svc.name] || Server;
          return (
            <div key={svc.name} className={`dash-card p-4 border-l-2 ${svc.status === 'operational' ? 'border-l-green-500' : svc.status === 'degraded' ? 'border-l-yellow-500' : svc.status === 'down' ? 'border-l-red-500' : 'border-l-gray-500'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                  <span className="text-sm font-medium text-dash-text">{svc.name}</span>
                </div>
                <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xl font-bold ${cfg.color}`}>
                  {svc.status === 'placeholder' ? '—' : formatTime(svc.responseTime)}
                </span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-xs text-dash-muted truncate">{svc.message}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Errors */}
      <h3 className="font-semibold text-dash-text mb-3">Recent Errors</h3>
      <div className="dash-card overflow-hidden mb-6">
        {!data || data.recent_errors.length === 0 ? (
          <div className="p-8 text-center text-dash-muted text-sm">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            No recent errors logged
          </div>
        ) : (
          <div className="divide-y divide-dash-border">
            {data.recent_errors.map((err: any, i: number) => (
              <div key={err.error_id || i} className="px-4 py-3 flex items-center gap-3">
                {err.resolved_at ? (
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-dash-text">{err.error_source}</span>
                    <span className={`px-1.5 py-0.5 text-xs rounded-full ${err.resolved_at ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {err.status}
                    </span>
                    {err.severity && (
                      <span className="px-1.5 py-0.5 text-xs rounded-full bg-gray-500/10 text-gray-400">{err.severity}</span>
                    )}
                  </div>
                  <p className="text-xs text-dash-muted truncate mt-0.5">{err.error_message}</p>
                </div>
                <span className="text-xs text-dash-muted flex-shrink-0">
                  {new Date(err.created_at).toLocaleString('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Database Details */}
      {data?.database && (
        <>
          <h3 className="font-semibold text-dash-text mb-3">Database Details</h3>
          <div className="dash-card p-4">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-dash-muted mb-1">Database</p>
                <p className="text-sm font-medium text-dash-text">naijafoodmarket-live</p>
                <p className="text-xs text-dash-muted mt-0.5">naijafood.database.windows.net</p>
              </div>
              <div>
                <p className="text-xs text-dash-muted mb-1">Storage Used</p>
                <p className="text-sm font-medium text-dash-text">{data.database.size}</p>
                <div className="w-full bg-dash-border rounded-full h-1.5 mt-1.5">
                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(parseFloat(data.database.size) / 20 * 100, 100)}%` }} />
                </div>
              </div>
              <div>
                <p className="text-xs text-dash-muted mb-1">Total Records</p>
                <p className="text-sm font-medium text-dash-text">{data.database.totalRows.toLocaleString()}</p>
                <p className="text-xs text-dash-muted mt-0.5">{data.database.tables} tables</p>
              </div>
            </div>
          </div>
        </>
      )}
    </PageWrapper>
  );
}
