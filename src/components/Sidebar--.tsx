"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  DollarSign,
  MapPin,
  Star,
  Bell,
  BarChart3,
  Download,
  Key,
  Settings,
  LogOut,
  TrendingUp,
  GitCompare,
  Menu,
  X,
} from "lucide-react";

// ============================================================================
// NAVIGATION CONFIGURATION
// ============================================================================

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children?: NavItem[];
  minTier?: string[];
}

const TIER_HIERARCHY = ["FREE", "SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"];

function hasTierAccess(userTier: string, requiredTiers?: string[]): boolean {
  if (!requiredTiers || requiredTiers.length === 0) return true;
  const userTierIndex = TIER_HIERARCHY.indexOf(userTier.toUpperCase());
  return requiredTiers.some(tier => {
    const requiredIndex = TIER_HIERARCHY.indexOf(tier.toUpperCase());
    return userTierIndex >= requiredIndex;
  });
}

const mainNavItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Prices",
    href: "/prices",
    icon: DollarSign,
  },
  {
    name: "Markets",
    href: "/markets",
    icon: MapPin,
  },
  {
    name: "Compare",
    href: "/compare",
    icon: GitCompare,
    minTier: ["FREE"], // Available to all tiers
  },
  {
    name: "Arbitrage",
    href: "/arbitrage",
    icon: TrendingUp,
    badge: "PRO",
    minTier: ["GOLD"], // Gold and above
  },
  {
    name: "Watchlist",
    href: "/watchlist",
    icon: Star,
    minTier: ["SILVER"], // Silver and above
  },
  {
    name: "Price Alerts",
    href: "/alerts",
    icon: Bell,
  },
  {
    name: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    minTier: ["BUSINESS"], // Business and above
  },
];

const toolsNavItems: NavItem[] = [
  {
    name: "Export Data",
    href: "/export",
    icon: Download,
    minTier: ["GOLD"],
  },
  {
    name: "API Keys",
    href: "/api-keys",
    icon: Key,
    badge: "PRO",
    minTier: ["ENTERPRISE"],
  },
];

// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Get user info from session
  const user = session?.user as { name?: string; phone?: string; tier?: string } | undefined;
  const userName = user?.name || "User";
  const userTier = user?.tier || "FREE";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Handle logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut({ 
        callbackUrl: "/",
        redirect: true 
      });
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  // Check if nav item is active
  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/";
    }
    return pathname?.startsWith(href);
  };

  // Render nav item
  const renderNavItem = (item: NavItem) => {
    const hasAccess = hasTierAccess(userTier, item.minTier);
    const active = isActive(item.href);
    const Icon = item.icon;

    if (!hasAccess) {
      return (
        <div
          key={item.name}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 cursor-not-allowed opacity-50"
          title={`Requires ${item.minTier?.join(" or ")} tier`}
        >
          <Icon className="w-5 h-5" />
          <span className="flex-1">{item.name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">
            🔒
          </span>
        </div>
      );
    }

    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={() => setIsMobileOpen(false)}
        className={`
          flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
          ${active 
            ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400" 
            : "text-gray-400 hover:bg-gray-800/50 hover:text-white"
          }
        `}
      >
        <Icon className={`w-5 h-5 ${active ? "text-emerald-400" : ""}`} />
        <span className="flex-1">{item.name}</span>
        {item.badge && (
          <span className={`
            text-xs px-1.5 py-0.5 rounded font-medium
            ${item.badge === "PRO" 
              ? "bg-amber-500/20 text-amber-400" 
              : "bg-blue-500/20 text-blue-400"
            }
          `}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  // Sidebar content (shared between mobile and desktop)
  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
          <span className="text-white font-bold text-sm">NM</span>
        </div>
        <span className="text-lg font-semibold text-white">
          NaijaMarket<span className="text-emerald-400">Intel</span>
        </span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {mainNavItems.map(renderNavItem)}

        {/* Tools Section */}
        <div className="pt-6">
          <div className="px-3 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Tools
          </div>
          {toolsNavItems.map(renderNavItem)}
        </div>
      </nav>

      {/* User Section */}
      <div className="border-t border-gray-800 p-4">
        {/* User Info */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <span className="text-emerald-400 font-semibold text-sm">
              {userInitials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {userName}
            </div>
            <div className="text-xs text-gray-500 uppercase">
              {userTier}
            </div>
          </div>
        </div>

        {/* User Actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">Settings</span>
          </Link>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
            title="Sign out"
          >
            {isLoggingOut ? (
              <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-gray-800 text-white"
      >
        {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar - Mobile */}
      <aside
        className={`
          lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[#0f0f0f] border-r border-gray-800
          transform transition-transform duration-300
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          flex flex-col
        `}
      >
        {sidebarContent}
      </aside>

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#0f0f0f] border-r border-gray-800">
        {sidebarContent}
      </aside>
    </>
  );
}
