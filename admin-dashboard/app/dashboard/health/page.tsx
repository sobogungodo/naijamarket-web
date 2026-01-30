'use client';

import React, { useState, useEffect } from 'react';
import { PageWrapper } from '@/components/dashboard/layout';
import { StatCard, Badge, Button, Alert } from '@/components/ui';
import { 
  LineChartComponent, 
  AreaChartComponent,
  CHART_COLORS 
} from '@/components/charts';
import { StatusIndicator } from '@/components/dashboard/widgets';
import { formatRelativeTime } from '@/lib/utils';
import {
  Activity,
  Server,
  Database,
  MessageSquare,
  CreditCard,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Zap,
  Cpu,
  HardDrive,
  Wifi,
  Globe,
} from 'lucide-react';
import type { ServiceStatus, SystemError } from '@/types';

// ============================================
// MOCK DATA
// ============================================

const mockHealthStats = {
  overallStatus: 'healthy' as const,
  uptime: 99.97,
  avgResponseTime: 145,
  errorRate: 0.12,
  activeConnections: 1247,
  queueDepth: 23,
  lastIncident: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
};

const mockServices: ServiceStatus[] = [
  { name: 'WhatsApp API', status: 'operational', responseTime: 89, lastChecked: new Date() },
  { name: 'Azure SQL Database', status: 'operational', responseTime: 23, lastChecked: new Date() },
  { name: 'VTPass Payment', status: 'operational', responseTime: 234, lastChecked: new Date() },
  { name: 'Google Sheets Sync', status: 'operational', responseTime: 156, lastChecked: new Date() },
  { name: 'Make.com Workflows', status: 'operational', responseTime: 178, lastChecked: new Date() },
  { name: 'Azure Functions', status: 'operational', responseTime: 67, lastChecked: new Date() },
  { name: 'Application Insights', status: 'operational', responseTime: 45, lastChecked: new Date() },
  { name: 'Azure Blob Storage', status: 'operational', responseTime: 34, lastChecked: new Date() },
];

const mockResponseTimeTrend = [
  { name: '00:00', api: 120, db: 25, whatsapp: 85 },
  { name: '04:00', api: 115, db: 22, whatsapp: 78 },
  { name: '08:00', api: 185, db: 35, whatsapp: 125 },
  { name: '12:00', api: 210, db: 42, whatsapp: 145 },
  { name: '16:00', api: 195, db: 38, whatsapp: 132 },
  { name: '20:00', api: 165, db: 30, whatsapp: 98 },
  { name: '23:59', api: 125, db: 24, whatsapp: 82 },
];

const mockThroughputTrend = [
  { name: '00:00', requests: 1200, errors: 2 },
  { name: '04:00', requests: 800, errors: 1 },
  { name: '08:00', requests: 4500, errors: 5 },
  { name: '12:00', requests: 6200, errors: 8 },
  { name: '16:00', requests: 5800, errors: 6 },
  { name: '20:00', requests: 3500, errors: 4 },
  { name: '23:59', requests: 1500, errors: 2 },
];

const mockRecentErrors: SystemError[] = [
  {
    id: 'E-001',
    service: 'VTPass Payment',
    message: 'Timeout waiting for response from VTPass API',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    count: 3,
    resolved: true,
  },
  {
    id: 'E-002',
    service: 'WhatsApp API',
    message: 'Rate limit exceeded for message sending',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    count: 1,
    resolved: true,
  },
  {
    id: 'E-003',
    service: 'Google Sheets Sync',
    message: 'Authentication token expired, auto-renewed',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
    count: 1,
    resolved: true,
  },
];

const mockUptimeHistory = [
  { name: 'Today', uptime: 100 },
  { name: 'Yesterday', uptime: 99.98 },
  { name: '2 days ago', uptime: 100 },
  { name: '3 days ago', uptime: 99.95 },
  { name: '4 days ago', uptime: 100 },
  { name: '5 days ago', uptime: 100 },
  { name: '6 days ago', uptime: 99.92 },
];

// ============================================
// SYSTEM HEALTH PAGE
// ============================================

export default function SystemHealthPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefresh(new Date());
    }, 2000);
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="w-4 h-4 text-status-success" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-status-warning" />;
      case 'down':
        return <XCircle className="w-4 h-4 text-status-danger" />;
      default:
        return <Clock className="w-4 h-4 text-dash-muted" />;
    }
  };

  const getResponseTimeColor = (ms: number) => {
    if (ms < 100) return 'text-status-success';
    if (ms < 300) return 'text-status-info';
    if (ms < 500) return 'text-status-warning';
    return 'text-status-danger';
  };

  return (
    <PageWrapper
      title="System Health"
      subtitle="Monitor platform performance and service status"
      actions={
        <div className="flex items-center gap-3">
          <span className="text-xs text-dash-muted">
            Last updated {formatRelativeTime(lastRefresh)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            leftIcon={RefreshCw}
          >
            Refresh
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Overall Status Banner */}
        <div className={`p-4 rounded-xl border ${
          mockHealthStats.overallStatus === 'healthy' 
            ? 'bg-status-success/10 border-status-success/30' 
            : mockHealthStats.overallStatus === 'degraded'
            ? 'bg-status-warning/10 border-status-warning/30'
            : 'bg-status-danger/10 border-status-danger/30'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                mockHealthStats.overallStatus === 'healthy' ? 'bg-status-success/20' : 'bg-status-warning/20'
              }`}>
                {mockHealthStats.overallStatus === 'healthy' 
                  ? <CheckCircle className="w-6 h-6 text-status-success" />
                  : <AlertTriangle className="w-6 h-6 text-status-warning" />
                }
              </div>
              <div>
                <h2 className={`text-xl font-bold ${
                  mockHealthStats.overallStatus === 'healthy' ? 'text-status-success' : 'text-status-warning'
                }`}>
                  All Systems Operational
                </h2>
                <p className="text-sm text-dash-muted">
                  Last incident: {formatRelativeTime(mockHealthStats.lastIncident)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-2xl font-bold font-mono text-dash-text">{mockHealthStats.uptime}%</p>
                <p className="text-xs text-dash-muted">30-day uptime</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Avg Response Time"
            value={`${mockHealthStats.avgResponseTime}ms`}
            subtitle="last hour"
            icon={Zap}
            iconColor="text-status-success"
          />
          <StatCard
            title="Error Rate"
            value={mockHealthStats.errorRate}
            subtitle="last 24 hours"
            icon={AlertTriangle}
            iconColor="text-status-warning"
            format="percentage"
          />
          <StatCard
            title="Active Connections"
            value={mockHealthStats.activeConnections}
            subtitle="current"
            icon={Wifi}
            iconColor="text-status-info"
            format="compact"
          />
          <StatCard
            title="Queue Depth"
            value={mockHealthStats.queueDepth}
            subtitle="messages pending"
            icon={Clock}
            iconColor="text-naija-gold-400"
          />
        </div>

        {/* Service Status Grid */}
        <div className="dash-card">
          <h3 className="font-semibold text-dash-text mb-4">Service Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {mockServices.map((service) => (
              <div
                key={service.name}
                className="p-4 rounded-lg bg-dash-bg border border-dash-border hover:border-dash-hover transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-dash-text">{service.name}</span>
                  {getStatusIcon(service.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-lg font-mono ${getResponseTimeColor(service.responseTime || 0)}`}>
                    {service.responseTime}ms
                  </span>
                  <Badge variant={service.status === 'operational' ? 'success' : 'warning'} size="sm">
                    {service.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Response Time Trend */}
          <div className="dash-card">
            <h3 className="font-semibold text-dash-text mb-4">Response Time (24h)</h3>
            <LineChartComponent
              data={mockResponseTimeTrend}
              dataKeys={[
                { key: 'api', name: 'API', color: CHART_COLORS.primary },
                { key: 'db', name: 'Database', color: CHART_COLORS.blue },
                { key: 'whatsapp', name: 'WhatsApp', color: CHART_COLORS.secondary },
              ]}
              height={250}
              formatter={(value) => `${value}ms`}
            />
          </div>

          {/* Throughput Trend */}
          <div className="dash-card">
            <h3 className="font-semibold text-dash-text mb-4">Request Throughput (24h)</h3>
            <AreaChartComponent
              data={mockThroughputTrend}
              dataKeys={[
                { key: 'requests', name: 'Requests', color: CHART_COLORS.primary },
                { key: 'errors', name: 'Errors', color: CHART_COLORS.red },
              ]}
              height={250}
            />
          </div>
        </div>

        {/* Uptime History */}
        <div className="dash-card">
          <h3 className="font-semibold text-dash-text mb-4">7-Day Uptime History</h3>
          <div className="grid grid-cols-7 gap-2">
            {mockUptimeHistory.map((day) => (
              <div key={day.name} className="text-center">
                <div
                  className={`h-16 rounded-lg mb-2 flex items-center justify-center ${
                    day.uptime === 100
                      ? 'bg-status-success/20'
                      : day.uptime >= 99.9
                      ? 'bg-status-success/10'
                      : day.uptime >= 99
                      ? 'bg-status-warning/20'
                      : 'bg-status-danger/20'
                  }`}
                >
                  <span className={`font-mono text-sm ${
                    day.uptime === 100 ? 'text-status-success' : 
                    day.uptime >= 99.9 ? 'text-status-success' :
                    day.uptime >= 99 ? 'text-status-warning' : 'text-status-danger'
                  }`}>
                    {day.uptime}%
                  </span>
                </div>
                <span className="text-xs text-dash-muted">{day.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Errors */}
        <div className="dash-card">
          <h3 className="font-semibold text-dash-text mb-4">Recent Errors</h3>
          {mockRecentErrors.length > 0 ? (
            <div className="space-y-3">
              {mockRecentErrors.map((error) => (
                <div
                  key={error.id}
                  className="flex items-start gap-4 p-3 rounded-lg bg-dash-bg border border-dash-border"
                >
                  <div className={`p-2 rounded-lg ${error.resolved ? 'bg-status-success/10' : 'bg-status-danger/10'}`}>
                    {error.resolved 
                      ? <CheckCircle className="w-4 h-4 text-status-success" />
                      : <XCircle className="w-4 h-4 text-status-danger" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-dash-text">{error.service}</span>
                      <Badge variant={error.resolved ? 'success' : 'danger'} size="sm">
                        {error.resolved ? 'Resolved' : 'Active'}
                      </Badge>
                      {error.count > 1 && (
                        <Badge variant="default" size="sm">
                          ×{error.count}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-dash-muted">{error.message}</p>
                  </div>
                  <span className="text-xs text-dash-muted whitespace-nowrap">
                    {formatRelativeTime(error.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-dash-muted">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-status-success opacity-50" />
              <p>No recent errors</p>
            </div>
          )}
        </div>

        {/* Resource Usage */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="dash-card">
            <div className="flex items-center gap-3 mb-4">
              <Cpu className="w-5 h-5 text-naija-green-500" />
              <h4 className="font-medium text-dash-text">Azure Functions</h4>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-dash-muted">Executions Today</span>
                  <span className="text-dash-text font-mono">24,567</span>
                </div>
                <div className="h-2 bg-dash-bg rounded-full overflow-hidden">
                  <div className="h-full bg-naija-green-500 rounded-full" style={{ width: '32%' }} />
                </div>
                <p className="text-xs text-dash-muted mt-1">32% of daily limit</p>
              </div>
            </div>
          </div>

          <div className="dash-card">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-5 h-5 text-status-info" />
              <h4 className="font-medium text-dash-text">Azure SQL</h4>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-dash-muted">Storage Used</span>
                  <span className="text-dash-text font-mono">2.4 GB</span>
                </div>
                <div className="h-2 bg-dash-bg rounded-full overflow-hidden">
                  <div className="h-full bg-status-info rounded-full" style={{ width: '12%' }} />
                </div>
                <p className="text-xs text-dash-muted mt-1">12% of 20 GB limit</p>
              </div>
            </div>
          </div>

          <div className="dash-card">
            <div className="flex items-center gap-3 mb-4">
              <HardDrive className="w-5 h-5 text-naija-gold-400" />
              <h4 className="font-medium text-dash-text">Blob Storage</h4>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-dash-muted">Storage Used</span>
                  <span className="text-dash-text font-mono">156 MB</span>
                </div>
                <div className="h-2 bg-dash-bg rounded-full overflow-hidden">
                  <div className="h-full bg-naija-gold-400 rounded-full" style={{ width: '3%' }} />
                </div>
                <p className="text-xs text-dash-muted mt-1">3% of 5 GB allocation</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
