"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  TrendingUp,
  MapPin,
  Bell,
  Star,
  BarChart3,
  Settings,
  LogOut,
  Search,
  HelpCircle,
  Download,
  GitCompare,
  ArrowLeftRight,
  Sparkles,
  Activity,
  Globe2,
  ShoppingCart,
  Filter,
  Map,
  FileText,
  Sun,
  Key,
  Code2,
  Truck,
  DollarSign,
  Coins,
  Lock,
  ChevronUp,
  History,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLang } from "@/lib/lang";
import { navLabel } from "@/lib/i18n";

// ============================================================================
// TYPES
// ============================================================================

interface TickerItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  trend: "up" | "down" | "stable";
  unit: string;
}

// ============================================================================
// TIER ACCESS SYSTEM
// ============================================================================

const TIER_HIERARCHY = ["FREE", "SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"];

function getTierIndex(tier: string): number {
  const idx = TIER_HIERARCHY.indexOf(tier.toUpperCase());
  return idx === -1 ? 0 : idx;
}

function hasTierAccess(userTier: string, minTier: string): boolean {
  return getTierIndex(userTier) >= getTierIndex(minTier);
}

// Short display name for tier badges in sidebar
function tierBadgeLabel(minTier: string): string {
  const labels: Record<string, string> = {
    SILVER: "SILVER+",
    GOLD: "GOLD+",
    BUSINESS: "BIZ+",
    CORPORATE: "CORP+",
    ENTERPRISE: "ENT",
  };
  return labels[minTier] || minTier;
}

// ============================================================================
// DYNAMIC PRICE TICKER COMPONENT
// ============================================================================

function PriceTicker() {
  const [tickerData, setTickerData] = useState<TickerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickerData = async () => {
      try {
        const response = await fetch("/api/ticker");
        const data = await response.json();
        if (data.success && data.data) {
          setTickerData(data.data);
        } else {
          setTickerData(getStaticFallback());
        }
      } catch (error) {
        console.error("Failed to fetch ticker data:", error);
        setTickerData(getStaticFallback());
      } finally {
        setLoading(false);
      }
    };

    fetchTickerData();
    const interval = setInterval(fetchTickerData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number): string => {
    if (price >= 1000) return `₦${price.toLocaleString()}`;
    return `₦${price.toFixed(1)}`;
  };

  const formatChange = (change: number): string => {
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="price-ticker overflow-hidden">
        <div className="flex items-center gap-8 px-4 py-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center gap-2 animate-pulse">
              <div className="h-4 w-16 bg-gray-800 rounded"></div>
              <div className="h-4 w-14 bg-gray-800 rounded"></div>
              <div className="h-4 w-12 bg-gray-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const doubledData = [...tickerData, ...tickerData];

  return (
    <div className="price-ticker overflow-hidden">
      <div className="flex items-center gap-8 animate-ticker">
        {doubledData.map((item, index) => (
          <div key={`${item.symbol}-${index}`} className="ticker-item">
            <span className={`ticker-symbol ${
              item.trend === "up" || item.change > 0 ? "text-emerald-400" : 
              item.trend === "down" || item.change < 0 ? "text-red-400" : 
              "text-gray-400"
            }`}>
              {item.symbol}
            </span>
            <span className="ticker-price">
              {formatPrice(item.price)}
            </span>
            <span className={`ticker-change ${item.change >= 0 ? "up" : "down"}`}>
              {formatChange(item.change)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getStaticFallback(): TickerItem[] {
  return [
    { symbol: "RICE.NGN", name: "Rice (50kg)", price: 78500, change: 2.3, trend: "up", unit: "bag" },
    { symbol: "BEANS.NGN", name: "Beans (100kg)", price: 62000, change: -1.2, trend: "down", unit: "bag" },
    { symbol: "GARRI.NGN", name: "Garri (50kg)", price: 28000, change: 0.8, trend: "up", unit: "bag" },
    { symbol: "TOMATO.NGN", name: "Tomatoes", price: 45000, change: -5.2, trend: "down", unit: "basket" },
    { symbol: "ONION.NGN", name: "Onions", price: 38500, change: 3.1, trend: "up", unit: "bag" },
    { symbol: "CEMENT.NGN", name: "Cement", price: 6500, change: -0.3, trend: "down", unit: "bag" },
    { symbol: "PALM.NGN", name: "Palm Oil (25L)", price: 52000, change: 1.5, trend: "up", unit: "keg" },
    { symbol: "NFPI.IDX", name: "Food Price Index", price: 127.4, change: 2.1, trend: "up", unit: "index" },
  ];
}

// ============================================================================
// DASHBOARD LAYOUT
// ============================================================================

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [upgradeToast, setUpgradeToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const user = session?.user as { name?: string; tier?: string } | undefined;
  const userName = user?.name || "User";
  const userTier = user?.tier || "FREE";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut({ 
        callbackUrl: "/login",
        redirect: true 
      });
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  // Auto-dismiss upgrade toast
  useEffect(() => {
    if (upgradeToast) {
      const timer = setTimeout(() => setUpgradeToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [upgradeToast]);

  return (
    <div className="min-h-screen bg-terminal-bg" onClick={() => setSidebarOpen(false)}>
      {/* Sidebar */}
      <aside
        className={`sidebar transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Logo */}
        <div className="sidebar-logo">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="NaijaMarket Intel"
              width={40}
              height={40}
              className="rounded-full"
            />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav custom-scrollbar">
          {/* ---- CORE: Available to everyone ---- */}
          <div className="space-y-1">
            <NavLink href="/dashboard" icon={LayoutDashboard} label="Dashboard" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} />
            <NavLink href="/dashboard/snapshot" icon={Globe2} label="Snapshot" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} />
            <NavLink href="/dashboard/prices" icon={TrendingUp} label="Prices" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} />
            <NavLink href="/dashboard/markets" icon={MapPin} label="Markets" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} />
            <NavLink href="/dashboard/compare" icon={GitCompare} label="Compare" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} />
            <NavLink href="/dashboard/inflation" icon={Activity} label="Inflation" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} />

            {/* ---- SILVER+ ---- */}
            <NavLink href="/dashboard/watchlist" icon={Star} label="Watchlist" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} minTier="SILVER" onLocked={setUpgradeToast} />

            {/* ---- GOLD+ ---- */}
            <NavLink href="/dashboard/alerts" icon={Bell} label="Price Alerts" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} minTier="GOLD" onLocked={setUpgradeToast} />
            <NavLink href="/dashboard/arbitrage" icon={ArrowLeftRight} label="Arbitrage" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} minTier="GOLD" onLocked={setUpgradeToast} />
            <NavLink href="/dashboard/screener" icon={Filter} label="Screener" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} minTier="GOLD" onLocked={setUpgradeToast} />
            <NavLink href="/dashboard/heatmap" icon={Map} label="Heatmap" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} minTier="GOLD" onLocked={setUpgradeToast} />

            {/* ---- BUSINESS+ ---- */}
            <NavLink href="/dashboard/morning-brief" icon={Sun} label="Morning Brief" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} minTier="BUSINESS" onLocked={setUpgradeToast} />
            <NavLink href="/dashboard/bulk-buyer" icon={ShoppingCart} label="Basket" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} minTier="BUSINESS" onLocked={setUpgradeToast} />
            <NavLink href="/dashboard/analytics" icon={BarChart3} label="Analytics" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} minTier="BUSINESS" onLocked={setUpgradeToast} />
            <NavLink href="/dashboard/forecast" icon={Sparkles} label="Forecast" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} minTier="BUSINESS" onLocked={setUpgradeToast} />
            <NavLink href="/dashboard/reports" icon={FileText} label="Reports" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} minTier="BUSINESS" onLocked={setUpgradeToast} />
          </div>

          {/* Enterprise Section */}
          <div className="mt-8 pt-8 border-t border-terminal-border">
            <div className="px-4 mb-2 text-2xs font-medium text-gray-500 uppercase tracking-wider">
              Enterprise
            </div>
            <NavLink href="/dashboard/supplier" icon={Truck} label="Supplier Intel" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} minTier="CORPORATE" onLocked={setUpgradeToast} />
            <NavLink href="/dashboard/revenue" icon={DollarSign} label="Revenue" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} minTier="ENTERPRISE" onLocked={setUpgradeToast} />
            <NavLink href="/dashboard/api" icon={Key} label="API Keys" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} minTier="CORPORATE" onLocked={setUpgradeToast} />
            <NavLink href="/dashboard/api-portal" icon={Code2} label="API Portal" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} minTier="CORPORATE" onLocked={setUpgradeToast} />
          </div>

          {/* Tools Section */}
          <div className="mt-8 pt-8 border-t border-terminal-border">
            <div className="px-4 mb-2 text-2xs font-medium text-gray-500 uppercase tracking-wider">
              Tools
            </div>
            <NavLink href="/dashboard/tokens" icon={Coins} label="Token Wallet" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} />
            <NavLink href="/dashboard/history" icon={History} label="Query History" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} />
            <NavLink href="/dashboard/export" icon={Download} label="Export Data" currentPath={pathname} userTier={userTier} onClose={() => setSidebarOpen(false)} minTier="GOLD" onLocked={setUpgradeToast} />
          </div>
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-naija-green/20 flex items-center justify-center text-naija-green text-sm font-medium">
                {userInitials}
              </div>
              <div>
                <div className="text-sm" style={{ color: "var(--text-primary)" }}>{userName}</div>
                <div className="text-2xs" style={{ color: "var(--text-muted)" }}>{userTier}</div>
              </div>
            </div>
          </div>
          {/* Theme Toggle */}
          <div className="mb-3">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/settings"
              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-white bg-terminal-surface rounded hover:bg-terminal-elevated transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </Link>
            <button 
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center justify-center gap-2 py-2 px-3 text-xs text-gray-400 hover:text-price-down bg-terminal-surface rounded hover:bg-terminal-elevated transition-colors disabled:opacity-50"
              title="Sign out"
            >
              {isLoggingOut ? (
                <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <LogOut className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="ml-0 sm:ml-64">
        {/* Command Bar */}
        <header className="sticky top-0 z-50 bg-terminal-bg/95 backdrop-blur-xl border-b border-terminal-border">
          <div className="flex items-center gap-4 px-6 py-3">
            {/* Hamburger — mobile only */}
            <button
              className="sm:hidden p-2 text-gray-400 hover:text-white hover:bg-terminal-surface rounded-lg transition-colors shrink-0"
              onClick={(e) => { e.stopPropagation(); setSidebarOpen(!sidebarOpen); }}
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
            <div className="flex-1 flex items-center gap-2 bg-terminal-surface border border-terminal-border rounded-lg px-4 py-2">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Type a command (e.g., NM:PRICES RICE LAGOS) or search..."
                className="flex-1 bg-transparent font-mono text-sm placeholder:text-gray-500 outline-none"
                style={{ color: "var(--text-primary)" }}
              />
              <div className="flex items-center gap-1 text-2xs text-gray-500">
                <kbd className="px-1.5 py-0.5 bg-terminal-muted rounded text-gray-400">⌘</kbd>
                <kbd className="px-1.5 py-0.5 bg-terminal-muted rounded text-gray-400">K</kbd>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <LanguageToggle />
              <Link
                href="/dashboard/alerts"
                className="p-2 text-gray-400 hover:text-white hover:bg-terminal-surface rounded-lg transition-colors"
              >
                <Bell className="w-4 h-4" />
              </Link>
              <button className="p-2 text-gray-400 hover:text-white hover:bg-terminal-surface rounded-lg transition-colors">
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Dynamic Price Ticker */}
          <PriceTicker />
        </header>

        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>

      {/* ================================================================ */}
      {/* UPGRADE TOAST — appears when user clicks a locked item */}
      {/* ================================================================ */}
      {upgradeToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-xl px-5 py-3 shadow-2xl">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              <ChevronUp className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-white font-medium">
                Requires <span className="text-amber-400">{upgradeToast}</span> subscription
              </p>
              <p className="text-xs text-gray-400">Upgrade to unlock this feature</p>
            </div>
            <Link
              href="/subscribe"
              className="ml-3 shrink-0 px-4 py-1.5 bg-naija-green text-black text-xs font-bold rounded-lg hover:bg-naija-green/90 transition-colors"
            >
              Upgrade
            </Link>
            <button
              onClick={() => setUpgradeToast(null)}
              className="ml-1 text-gray-500 hover:text-gray-300 text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// NAV LINK COMPONENT — with tier gating
// ============================================================================

interface NavLinkProps {
  href: string;
  icon: React.ElementType;
  label: string;
  currentPath: string | null;
  userTier: string;
  minTier?: string;
  onLocked?: (tier: string) => void;
  onClose?: () => void;
}

function NavLink({ href, icon: Icon, label, currentPath, userTier, minTier, onLocked, onClose }: NavLinkProps) {
  const { lang } = useLang();
  const display = navLabel(href, lang, label);
  const isActive = currentPath === href ||
    (href !== "/dashboard" && currentPath?.startsWith(href));

  const isLocked = minTier ? !hasTierAccess(userTier, minTier) : false;

  if (isLocked) {
    return (
      <button
        onClick={() => onLocked?.(tierBadgeLabel(minTier!))}
        className="sidebar-link w-full opacity-50 hover:opacity-70 transition-opacity group"
        title={`Requires ${tierBadgeLabel(minTier!)} subscription`}
      >
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="flex-1 text-gray-500">{display}</span>
        <span className="flex items-center gap-1">
          <Lock className="w-3 h-3 text-gray-600" />
          <span className="px-1.5 py-0.5 text-2xs font-medium bg-gray-700/50 text-gray-500 rounded">
            {tierBadgeLabel(minTier!)}
          </span>
        </span>
      </button>
    );
  }

  return (
    <Link
      href={href}
      className={`sidebar-link ${isActive ? "active" : ""}`}
      onClick={() => onClose?.()}
    >
      <Icon className="w-4 h-4" />
      <span className="flex-1">{display}</span>
    </Link>
  );
}

