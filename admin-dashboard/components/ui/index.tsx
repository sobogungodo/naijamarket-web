'use client';

import React from 'react';
import { cn, formatNaira, formatCompactNumber, formatPercentage } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  LucideIcon 
} from 'lucide-react';

// ============================================
// STAT CARD COMPONENT
// ============================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  trendLabel?: string;
  icon?: LucideIcon;
  iconColor?: string;
  format?: 'number' | 'currency' | 'percentage' | 'compact';
  className?: string;
  pulse?: boolean;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  icon: Icon,
  iconColor = 'text-naija-green-500',
  format = 'number',
  className,
  pulse = false,
}: StatCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;
    switch (format) {
      case 'currency':
        return formatNaira(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'compact':
        return formatCompactNumber(val);
      default:
        return val.toLocaleString();
    }
  };

  return (
    <div className={cn('stat-card relative overflow-hidden', className)}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5 grid-pattern" />
      
      <div className="relative z-10">
        {/* Header with icon */}
        <div className="flex items-start justify-between mb-3">
          <span className="stat-label">{title}</span>
          {Icon && (
            <div className={cn('p-2 rounded-lg bg-dash-bg', iconColor)}>
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Main value */}
        <div className="flex items-baseline gap-2">
          <span className={cn('stat-value', pulse && 'animate-pulse')}>
            {formatValue(value)}
          </span>
          {subtitle && (
            <span className="text-sm text-dash-muted">{subtitle}</span>
          )}
        </div>

        {/* Trend indicator */}
        {trend !== undefined && (
          <div className="mt-3 flex items-center gap-2">
            {trend > 0 ? (
              <div className="stat-trend-up">
                <TrendingUp className="w-4 h-4" />
                <span>{formatPercentage(trend)}</span>
              </div>
            ) : trend < 0 ? (
              <div className="stat-trend-down">
                <TrendingDown className="w-4 h-4" />
                <span>{formatPercentage(trend)}</span>
              </div>
            ) : (
              <div className="text-dash-muted text-sm flex items-center gap-1">
                <Minus className="w-4 h-4" />
                <span>No change</span>
              </div>
            )}
            {trendLabel && (
              <span className="text-xs text-dash-muted">{trendLabel}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// BADGE COMPONENT
// ============================================

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'pending';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}

export function Badge({
  variant = 'default',
  size = 'md',
  children,
  className,
  pulse = false,
}: BadgeProps) {
  const variants = {
    default: 'bg-dash-border text-dash-text',
    success: 'bg-status-success/20 text-status-success',
    warning: 'bg-status-warning/20 text-status-warning',
    danger: 'bg-status-danger/20 text-status-danger',
    info: 'bg-status-info/20 text-status-info',
    pending: 'bg-status-pending/20 text-status-pending',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className={cn(
            'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
            variant === 'success' && 'bg-status-success',
            variant === 'warning' && 'bg-status-warning',
            variant === 'danger' && 'bg-status-danger',
            variant === 'info' && 'bg-status-info',
            variant === 'pending' && 'bg-status-pending',
          )} />
          <span className={cn(
            'relative inline-flex rounded-full h-2 w-2',
            variant === 'success' && 'bg-status-success',
            variant === 'warning' && 'bg-status-warning',
            variant === 'danger' && 'bg-status-danger',
            variant === 'info' && 'bg-status-info',
            variant === 'pending' && 'bg-status-pending',
          )} />
        </span>
      )}
      {children}
    </span>
  );
}

// ============================================
// BUTTON COMPONENT
// ============================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-naija-green-500 hover:bg-naija-green-600 text-white focus:ring-naija-green-500/50',
    secondary: 'bg-dash-border hover:bg-dash-hover text-dash-text focus:ring-dash-border',
    danger: 'bg-status-danger hover:bg-red-600 text-white focus:ring-status-danger/50',
    ghost: 'hover:bg-dash-hover text-dash-text',
    outline: 'border border-dash-border hover:bg-dash-hover text-dash-text',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dash-bg',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : LeftIcon ? (
        <LeftIcon className="w-4 h-4" />
      ) : null}
      {children}
      {RightIcon && !isLoading && <RightIcon className="w-4 h-4" />}
    </button>
  );
}

// ============================================
// INPUT COMPONENT
// ============================================

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: LucideIcon;
}

export function Input({
  label,
  error,
  leftIcon: LeftIcon,
  className,
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-dash-text mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {LeftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dash-muted">
            <LeftIcon className="w-4 h-4" />
          </div>
        )}
        <input
          className={cn(
            'input-field',
            LeftIcon && 'pl-10',
            error && 'border-status-danger focus:border-status-danger focus:ring-status-danger/50',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-status-danger">{error}</p>
      )}
    </div>
  );
}

// ============================================
// ALERT COMPONENT
// ============================================

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
  onClose?: () => void;
}

export function Alert({
  variant = 'info',
  title,
  children,
  icon: Icon,
  className,
  onClose,
}: AlertProps) {
  const variants = {
    info: 'alert-info',
    success: 'alert-success',
    warning: 'alert-warning',
    danger: 'alert-danger',
  };

  return (
    <div className={cn(variants[variant], className)}>
      {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
      <div className="flex-1">
        {title && <h5 className="font-semibold mb-1">{title}</h5>}
        <p className="text-sm opacity-90">{children}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-current opacity-60 hover:opacity-100 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ============================================
// SKELETON LOADER COMPONENT
// ============================================

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
}: SkeletonProps) {
  const variants = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      className={cn('skeleton', variants[variant], className)}
      style={{ width, height }}
    />
  );
}

// ============================================
// EMPTY STATE COMPONENT
// ============================================

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-dash-border flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-dash-muted" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-dash-text mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-dash-muted max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}

// ============================================
// LOADING SPINNER COMPONENT
// ============================================

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <svg
      className={cn('animate-spin', sizes[size], className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ============================================
// AVATAR COMPONENT
// ============================================

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover', sizes[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-naija-green-500/20 text-naija-green-400 flex items-center justify-center font-semibold',
        sizes[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
