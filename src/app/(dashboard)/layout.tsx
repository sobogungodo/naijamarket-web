import Link from "next/link";
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
  Command,
  HelpCircle,
  Download
} from "lucide-react";

// ============================================================================
// DASHBOARD LAYOUT
// ============================================================================

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-terminal-bg">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-naija-green to-naija-gold rounded-lg flex items-center justify-center">
              <span className="text-terminal-bg font-bold text-sm">NM</span>
            </div>
            <span className="font-display font-bold text-white">
              NaijaMarket<span className="text-naija-green">Intel</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav custom-scrollbar">
          <div className="space-y-1">
            <NavLink href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavLink href="/dashboard/prices" icon={TrendingUp} label="Prices" />
            <NavLink href="/dashboard/markets" icon={MapPin} label="Markets" />
            <NavLink href="/dashboard/watchlists" icon={Star} label="Watchlists" />
            <NavLink href="/dashboard/alerts" icon={Bell} label="Price Alerts" />
            <NavLink href="/dashboard/analytics" icon={BarChart3} label="Analytics" />
          </div>

          <div className="mt-8 pt-8 border-t border-terminal-border">
            <div className="px-4 mb-2 text-2xs font-medium text-gray-500 uppercase tracking-wider">
              Tools
            </div>
            <NavLink href="/dashboard/export" icon={Download} label="Export Data" />
            <NavLink href="/dashboard/api" icon={Command} label="API Keys" badge="PRO" />
          </div>
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-naija-green/20 flex items-center justify-center text-naija-green text-sm font-medium">
                OS
              </div>
              <div>
                <div className="text-sm text-white">Olawale S.</div>
                <div className="text-2xs text-gray-500">CORPORATE</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/settings"
              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-white bg-terminal-surface rounded hover:bg-terminal-elevated transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </Link>
            <button className="flex items-center justify-center gap-2 py-2 px-3 text-xs text-gray-400 hover:text-price-down bg-terminal-surface rounded hover:bg-terminal-elevated transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-64">
        {/* Command Bar */}
        <header className="sticky top-0 z-30 bg-terminal-bg/95 backdrop-blur-xl border-b border-terminal-border">
          <div className="flex items-center gap-4 px-6 py-3">
            {/* Command Input */}
            <div className="flex-1 flex items-center gap-2 bg-terminal-surface border border-terminal-border rounded-lg px-4 py-2">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Type a command (e.g., NM:PRICES RICE LAGOS) or search..."
                className="flex-1 bg-transparent font-mono text-sm text-white placeholder:text-gray-500 outline-none"
              />
              <div className="flex items-center gap-1 text-2xs text-gray-500">
                <kbd className="px-1.5 py-0.5 bg-terminal-muted rounded text-gray-400">⌘</kbd>
                <kbd className="px-1.5 py-0.5 bg-terminal-muted rounded text-gray-400">K</kbd>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-400 hover:text-white hover:bg-terminal-surface rounded-lg transition-colors">
                <Bell className="w-4 h-4" />
              </button>
              <button className="p-2 text-gray-400 hover:text-white hover:bg-terminal-surface rounded-lg transition-colors">
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Price Ticker */}
          <div className="price-ticker overflow-hidden">
            <div className="flex items-center gap-8 animate-ticker">
              {tickerData.map((item, index) => (
                <div key={index} className="ticker-item">
                  <span className="ticker-symbol">{item.symbol}</span>
                  <span className="ticker-price">{item.price}</span>
                  <span className={`ticker-change ${item.change >= 0 ? "up" : "down"}`}>
                    {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%
                  </span>
                </div>
              ))}
              {/* Duplicate for seamless loop */}
              {tickerData.map((item, index) => (
                <div key={`dup-${index}`} className="ticker-item">
                  <span className="ticker-symbol">{item.symbol}</span>
                  <span className="ticker-price">{item.price}</span>
                  <span className={`ticker-change ${item.change >= 0 ? "up" : "down"}`}>
                    {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface NavLinkProps {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: string;
}

function NavLink({ href, icon: Icon, label, badge }: NavLinkProps) {
  // In a real app, you'd use usePathname() to determine active state
  const isActive = false;

  return (
    <Link
      href={href}
      className={`sidebar-link ${isActive ? "active" : ""}`}
    >
      <Icon className="w-4 h-4" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="px-1.5 py-0.5 text-2xs font-medium bg-naija-gold/20 text-naija-gold rounded">
          {badge}
        </span>
      )}
    </Link>
  );
}

// ============================================================================
// DATA
// ============================================================================

const tickerData = [
  { symbol: "RICE.NGN", price: "₦78,500", change: 2.3 },
  { symbol: "BEANS.NGN", price: "₦62,000", change: -1.2 },
  { symbol: "TOMATO.NGN", price: "₦45,000", change: -5.2 },
  { symbol: "ONION.NGN", price: "₦38,500", change: 3.1 },
  { symbol: "GARRI.NGN", price: "₦28,000", change: 0.8 },
  { symbol: "PALM.NGN", price: "₦52,000", change: 1.5 },
  { symbol: "CEMENT.NGN", price: "₦6,500", change: -0.3 },
  { symbol: "NFPI.IDX", price: "127.4", change: 2.1 },
];
