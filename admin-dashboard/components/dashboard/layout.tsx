'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  AlertTriangle,
  Wallet,
  Users,
  Activity,
  Settings,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  TrendingUp,
  FileText,
  MapPin,
  Package,
  Code2,
  Megaphone,
  ClipboardList,
  Cpu,
  LineChart,
  Globe as GlobeIcon,
  TrendingUp as TrendingUpIcon,
  GitBranch,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { Avatar } from '@/components/ui';

// ============================================
// SIDEBAR NAVIGATION
// ============================================

const navItems = [
  {
    title: 'Overview',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Fraud Detection',
    href: '/dashboard/fraud',
    icon: AlertTriangle,
    badge: 'critical',
  },
  {
    title: 'Financial Ops',
    href: '/dashboard/financial',
    icon: Wallet,
  },
  {
    title: 'User Management',
    href: '/dashboard/users',
    icon: Users,
  },
  {
    title: 'Submissions',
    href: '/dashboard/submissions',
    icon: FileText,
  },
  {
    title: 'Markets',
    href: '/dashboard/markets',
    icon: MapPin,
  },
  {
    title: 'Commodities',
    href: '/dashboard/commodities',
    icon: Package,
  },
  {
    title: 'System Health',
    href: '/dashboard/health',
    icon: Activity,
  },
  {
    title: 'Audit Log',
    href: '/dashboard/audit',
    icon: ClipboardList,
  },
  {
    title: 'Price Generation',
    href: '/dashboard/price-generation',
    icon: Cpu,
  },
  {
    title: 'Price Intelligence',
    href: '/dashboard/price-intelligence',
    icon: LineChart,
  },
  {
    title: 'Market Performance',
    href: '/dashboard/market-performance',
    icon: GlobeIcon,
  },
  {
    title: 'NFPI & Inflation',
    href: '/dashboard/nfpi',
    icon: TrendingUpIcon,
  },
  {
    title: 'Data Pipeline',
    href: '/dashboard/pipeline',
    icon: GitBranch,
  },
];

const revenueItems = [
  {
    title: 'Widget Keys',
    href: '/dashboard/widgets',
    icon: Code2,
    badge: 'new',
  },
  {
    title: 'FMCG Alerts',
    href: '/dashboard/fmcg-alerts',
    icon: Megaphone,
    badge: 'new',
  },
];

const bottomNavItems = [
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
  {
    title: 'Help',
    href: '/dashboard/help',
    icon: HelpCircle,
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  const renderNavItem = (item: { title: string; href: string; icon: React.ElementType; badge?: string }) => {
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
          'hover:bg-dash-hover group',
          active
            ? 'bg-naija-green-500/10 text-naija-green-400 border-l-2 border-naija-green-500'
            : 'text-dash-muted hover:text-dash-text',
          collapsed && 'justify-center px-0'
        )}
        title={collapsed ? item.title : undefined}
      >
        <Icon className={cn('w-5 h-5 flex-shrink-0', active && 'text-naija-green-400')} />
        {!collapsed && (
          <>
            <span className="flex-1 font-medium">{item.title}</span>
            {item.badge === 'critical' && (
              <span className="w-2 h-2 rounded-full bg-status-danger animate-pulse" />
            )}
            {item.badge === 'new' && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-naija-green-500/20 text-naija-green-400 rounded">
                NEW
              </span>
            )}
          </>
        )}
        {collapsed && item.badge === 'critical' && (
          <span className="absolute right-3 w-2 h-2 rounded-full bg-status-danger animate-pulse" />
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-dash-card border-r border-dash-border',
        'transition-all duration-300 ease-in-out',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-dash-border">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-naija-green-500 to-naija-gold-500 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-dash-text text-sm">NaijaMarket</span>
                <span className="text-[10px] text-naija-green-500 font-medium tracking-wider">ADMIN</span>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-naija-green-500 to-naija-gold-500 flex items-center justify-center mx-auto">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(renderNavItem)}

          {/* Revenue / B2B Section */}
          <div className="pt-4 mt-4 border-t border-dash-border">
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold text-dash-muted uppercase tracking-wider">
                Revenue / B2B
              </p>
            )}
            {revenueItems.map(renderNavItem)}
          </div>
        </nav>

        {/* Bottom Navigation */}
        <div className="px-3 py-2 space-y-1 border-t border-dash-border">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
                  'hover:bg-dash-hover text-dash-muted hover:text-dash-text',
                  active && 'text-dash-text',
                  collapsed && 'justify-center px-0'
                )}
                title={collapsed ? item.title : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="font-medium">{item.title}</span>}
              </Link>
            );
          })}
        </div>

        {/* User Profile */}
        <div className="p-3 border-t border-dash-border">
          <div
            className={cn(
              'flex items-center gap-3 p-2 rounded-lg bg-dash-bg',
              collapsed && 'justify-center'
            )}
          >
            <Avatar
              name={session?.user?.name || 'Admin'}
              src={session?.user?.image}
              size="sm"
            />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dash-text truncate">
                  {session?.user?.name || 'Admin'}
                </p>
                <p className="text-xs text-dash-muted truncate">
                  {(session?.user as { role?: string })?.role || 'admin'}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="p-1.5 rounded hover:bg-dash-hover text-dash-muted hover:text-status-danger transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className={cn(
            'absolute -right-3 top-20 w-6 h-6 rounded-full',
            'bg-dash-card border border-dash-border',
            'flex items-center justify-center',
            'text-dash-muted hover:text-dash-text hover:bg-dash-hover',
            'transition-colors shadow-lg'
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}

// ============================================
// DASHBOARD HEADER
// ============================================

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header className="h-16 bg-dash-card border-b border-dash-border px-6 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-dash-text">{title}</h1>
        {subtitle && <p className="text-sm text-dash-muted">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Live indicator */}
        <div className="live-indicator text-sm text-dash-muted">
          Live Data
        </div>

        {/* Actions */}
        {actions}

        {/* Role badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-naija-green-500/10 border border-naija-green-500/30">
          <Shield className="w-4 h-4 text-naija-green-500" />
          <span className="text-xs font-medium text-naija-green-400 uppercase">
            {(session?.user as { role?: string })?.role?.replace('_', ' ') || 'Admin'}
          </span>
        </div>
      </div>
    </header>
  );
}

// ============================================
// PAGE WRAPPER
// ============================================

interface PageWrapperProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function PageWrapper({ title, subtitle, actions, children }: PageWrapperProps) {
  return (
    <>
      <Header title={title} subtitle={subtitle} actions={actions} />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </>
  );
}
