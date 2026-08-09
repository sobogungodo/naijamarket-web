'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/layout';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Desktop: collapse to an icon rail. Mobile: off-canvas drawer.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-dash-bg">
      {/* Sidebar (fixed rail on desktop, drawer on mobile) */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main content — full width on mobile, offset by the sidebar on md+ */}
      <div
        className={cn(
          'flex flex-col min-h-screen transition-all duration-300 ml-0',
          sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
        )}
      >
        {/* Mobile top bar with hamburger (hidden on desktop) */}
        <div className="md:hidden sticky top-0 z-30 h-14 flex items-center gap-3 px-4 bg-dash-card border-b border-dash-border">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="p-2 -ml-2 rounded-lg text-dash-muted hover:text-dash-text hover:bg-dash-hover transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="NaijaMarket Intel"
              width={30}
              height={30}
              className="rounded-full flex-shrink-0"
            />
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-dash-text text-sm">NaijaMarket</span>
              <span className="text-[9px] text-naija-green-500 font-medium tracking-wider">
                ADMIN
              </span>
            </div>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
