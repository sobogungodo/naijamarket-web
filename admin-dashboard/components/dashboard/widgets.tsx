'use client';

import React from 'react';
import { cn, formatRelativeTime, getSeverityColor, getStatusColor } from '@/lib/utils';
import { Badge, Button } from '@/components/ui';
import {
  AlertTriangle,
  MapPin,
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  User,
  ArrowRight,
  MoreVertical,
} from 'lucide-react';
import type { FraudAlert, ActivityItem } from '@/types';

// ============================================
// FRAUD ALERT CARD
// ============================================

interface FraudAlertCardProps {
  alert: FraudAlert;
  onView?: (alert: FraudAlert) => void;
  onResolve?: (alert: FraudAlert) => void;
  onDismiss?: (alert: FraudAlert) => void;
}

export function FraudAlertCard({ alert, onView, onResolve, onDismiss }: FraudAlertCardProps) {
  const severityColors = {
    critical: 'border-l-red-500 bg-red-500/5',
    high: 'border-l-orange-500 bg-orange-500/5',
    medium: 'border-l-yellow-500 bg-yellow-500/5',
    low: 'border-l-blue-500 bg-blue-500/5',
  };

  const severityIcons = {
    critical: '🚨',
    high: '⚠️',
    medium: '⚡',
    low: 'ℹ️',
  };

  return (
    <div
      className={cn(
        'border-l-4 rounded-lg p-4 transition-all duration-200 hover:shadow-lg',
        'bg-dash-card border border-dash-border',
        severityColors[alert.severity]
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{severityIcons[alert.severity]}</span>
            <Badge
              variant={
                alert.severity === 'critical' ? 'danger' :
                alert.severity === 'high' ? 'warning' :
                alert.severity === 'medium' ? 'info' : 'default'
              }
              size="sm"
            >
              {alert.severity.toUpperCase()}
            </Badge>
            <Badge variant="default" size="sm">
              {alert.type.replace(/_/g, ' ')}
            </Badge>
          </div>

          {/* Title */}
          <h4 className="font-semibold text-dash-text mb-1">{alert.title}</h4>
          
          {/* Description */}
          <p className="text-sm text-dash-muted line-clamp-2 mb-3">
            {alert.description}
          </p>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-dash-muted">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(alert.detectedAt)}
            </span>
            {alert.traderId && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                Trader involved
              </span>
            )}
            {alert.marketId && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Market linked
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onView?.(alert)}
            className="text-dash-muted hover:text-dash-text"
          >
            <Eye className="w-4 h-4" />
          </Button>
          {alert.status === 'open' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResolve?.(alert)}
                className="text-status-success hover:bg-status-success/10"
              >
                <CheckCircle className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDismiss?.(alert)}
                className="text-status-danger hover:bg-status-danger/10"
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// FRAUD ALERTS LIST
// ============================================

interface FraudAlertsListProps {
  alerts: FraudAlert[];
  title?: string;
  maxItems?: number;
  onViewAll?: () => void;
  onAlertView?: (alert: FraudAlert) => void;
  onAlertResolve?: (alert: FraudAlert) => void;
}

export function FraudAlertsList({
  alerts,
  title = 'Fraud Alerts',
  maxItems = 5,
  onViewAll,
  onAlertView,
  onAlertResolve,
}: FraudAlertsListProps) {
  const displayAlerts = alerts.slice(0, maxItems);
  const hasMore = alerts.length > maxItems;

  return (
    <div className="dash-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-status-danger" />
          <h3 className="font-semibold text-dash-text">{title}</h3>
          {alerts.length > 0 && (
            <Badge variant="danger" pulse>
              {alerts.length}
            </Badge>
          )}
        </div>
        {hasMore && onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View All
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {displayAlerts.length > 0 ? (
          displayAlerts.map((alert) => (
            <FraudAlertCard
              key={alert.id}
              alert={alert}
              onView={onAlertView}
              onResolve={onAlertResolve}
            />
          ))
        ) : (
          <div className="text-center py-8 text-dash-muted">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No fraud alerts</p>
            <p className="text-sm">System is monitoring for suspicious activity</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// ACTIVITY FEED
// ============================================

interface ActivityFeedProps {
  activities: ActivityItem[];
  title?: string;
  maxItems?: number;
  showTimestamp?: boolean;
}

export function ActivityFeed({
  activities,
  title = 'Recent Activity',
  maxItems = 10,
  showTimestamp = true,
}: ActivityFeedProps) {
  const displayActivities = activities.slice(0, maxItems);

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'submission':
        return { icon: '📤', color: 'text-blue-500' };
      case 'validation':
        return { icon: '✅', color: 'text-green-500' };
      case 'payout':
        return { icon: '💰', color: 'text-yellow-500' };
      case 'fraud_alert':
        return { icon: '🚨', color: 'text-red-500' };
      case 'user_action':
        return { icon: '👤', color: 'text-purple-500' };
      default:
        return { icon: '•', color: 'text-gray-500' };
    }
  };

  return (
    <div className="dash-card">
      <h3 className="font-semibold text-dash-text mb-4">{title}</h3>

      <div className="space-y-0">
        {displayActivities.map((activity, index) => {
          const { icon, color } = getActivityIcon(activity.type);
          return (
            <div
              key={activity.id}
              className={cn(
                'flex items-start gap-3 py-3',
                index !== displayActivities.length - 1 && 'border-b border-dash-border'
              )}
            >
              <span className={cn('text-lg', color)}>{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-dash-text">{activity.description}</p>
                {activity.user && (
                  <p className="text-xs text-dash-muted mt-0.5">by {activity.user}</p>
                )}
              </div>
              {showTimestamp && (
                <span className="text-xs text-dash-muted whitespace-nowrap">
                  {formatRelativeTime(activity.timestamp)}
                </span>
              )}
            </div>
          );
        })}

        {displayActivities.length === 0 && (
          <div className="text-center py-8 text-dash-muted">
            <p>No recent activity</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// STATUS INDICATOR
// ============================================

interface StatusIndicatorProps {
  status: string;
  label?: string;
  showPulse?: boolean;
}

export function StatusIndicator({ status, label, showPulse = false }: StatusIndicatorProps) {
  const statusConfig = {
    operational: { color: 'bg-status-success', text: 'Operational' },
    healthy: { color: 'bg-status-success', text: 'Healthy' },
    active: { color: 'bg-status-success', text: 'Active' },
    degraded: { color: 'bg-status-warning', text: 'Degraded' },
    warning: { color: 'bg-status-warning', text: 'Warning' },
    down: { color: 'bg-status-danger', text: 'Down' },
    critical: { color: 'bg-status-danger', text: 'Critical' },
    inactive: { color: 'bg-dash-muted', text: 'Inactive' },
  };

  const config = statusConfig[status.toLowerCase() as keyof typeof statusConfig] || {
    color: 'bg-dash-muted',
    text: status,
  };

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {showPulse && (
          <span
            className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              config.color
            )}
          />
        )}
        <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', config.color)} />
      </span>
      <span className="text-sm text-dash-muted">{label || config.text}</span>
    </div>
  );
}

// ============================================
// QUICK ACTION BUTTON
// ============================================

interface QuickActionProps {
  icon: React.ElementType;
  label: string;
  description?: string;
  onClick?: () => void;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
}

export function QuickAction({
  icon: Icon,
  label,
  description,
  onClick,
  variant = 'default',
  disabled = false,
}: QuickActionProps) {
  const variants = {
    default: 'hover:border-naija-green-500/50 hover:bg-naija-green-500/5',
    success: 'hover:border-status-success/50 hover:bg-status-success/5',
    warning: 'hover:border-status-warning/50 hover:bg-status-warning/5',
    danger: 'hover:border-status-danger/50 hover:bg-status-danger/5',
  };

  const iconVariants = {
    default: 'text-naija-green-500',
    success: 'text-status-success',
    warning: 'text-status-warning',
    danger: 'text-status-danger',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full p-4 rounded-lg border border-dash-border bg-dash-card',
        'transition-all duration-200 text-left',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        !disabled && variants[variant]
      )}
    >
      <Icon className={cn('w-6 h-6 mb-2', iconVariants[variant])} />
      <h4 className="font-medium text-dash-text">{label}</h4>
      {description && (
        <p className="text-sm text-dash-muted mt-1">{description}</p>
      )}
    </button>
  );
}
