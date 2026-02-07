'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

// ============================================================================
// TRADER AUTH CONTEXT - Shares auth state across all trader pages
// ============================================================================

interface TraderProfile {
  traderId: string;
  fullName: string;
  firstName: string;
  phoneNumber: string;
  market: string;
  reputation: number;
  balance: number;
  pendingBalance: number;
  tier: string;
  todaySubmissions: number;
}

interface TraderAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  profile: TraderProfile | null;
  token: string | null;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const TraderAuthContext = createContext<TraderAuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  profile: null,
  token: null,
  logout: () => {},
  refreshProfile: async () => {},
});

export const useTraderAuth = () => useContext(TraderAuthContext);

// ============================================================================
// TRADER LAYOUT COMPONENT
// ============================================================================

export default function TraderLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfile] = useState<TraderProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Check auth on mount and when pathname changes
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // Skip auth check for login page
    if (pathname === '/trader/login') {
      setIsLoading(false);
      return;
    }

    const storedToken = localStorage.getItem('traderToken');
    const storedPhone = localStorage.getItem('traderPhone');

    console.log('TraderLayout: Checking auth', { 
      hasToken: !!storedToken, 
      hasPhone: !!storedPhone,
      pathname 
    });

    if (!storedToken || !storedPhone) {
      console.log('TraderLayout: No credentials, redirecting to login');
      setIsAuthenticated(false);
      setIsLoading(false);
      router.push('/trader/login');
      return;
    }

    setToken(storedToken);

    // Verify token by fetching profile
    try {
      const response = await fetch('/api/trader/profile', {
        headers: {
          'Authorization': `Bearer ${storedToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.trader) {
          console.log('TraderLayout: Auth valid, profile loaded');
          setProfile(data.trader);
          setIsAuthenticated(true);
        } else {
          throw new Error('Invalid profile response');
        }
      } else if (response.status === 401) {
        console.log('TraderLayout: Token expired, clearing');
        localStorage.removeItem('traderToken');
        localStorage.removeItem('traderPhone');
        router.push('/trader/login');
      } else {
        throw new Error('Profile fetch failed');
      }
    } catch (error) {
      console.error('TraderLayout: Auth check failed', error);
      // Don't redirect on network errors - might be temporary
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('traderToken');
    localStorage.removeItem('traderPhone');
    setIsAuthenticated(false);
    setProfile(null);
    setToken(null);
    router.push('/trader/login');
  };

  const refreshProfile = async () => {
    const storedToken = localStorage.getItem('traderToken');
    if (!storedToken) return;

    try {
      const response = await fetch('/api/trader/profile', {
        headers: { 'Authorization': `Bearer ${storedToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.trader) {
          setProfile(data.trader);
        }
      }
    } catch (error) {
      console.error('Profile refresh failed:', error);
    }
  };

  // Show loading state
  if (isLoading && pathname !== '/trader/login') {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Login page - no layout needed
  if (pathname === '/trader/login') {
    return <>{children}</>;
  }

  // Not authenticated - show nothing (will redirect)
  if (!isAuthenticated && pathname !== '/trader/login') {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Authenticated - render layout with navigation
  return (
    <TraderAuthContext.Provider value={{ 
      isAuthenticated, 
      isLoading, 
      profile, 
      token, 
      logout,
      refreshProfile 
    }}>
      <div className="min-h-screen bg-[#0a0f1a] pb-20">
        {/* Header */}
        <header className="bg-[#0f172a] border-b border-gray-800 px-4 py-4 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link href="/trader" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">NaijaMarket</h1>
                <p className="text-xs text-emerald-400">Trader Portal</p>
              </div>
            </Link>
            
            <div className="flex items-center gap-4">
              {profile && (
                <div className="hidden sm:block text-right">
                  <p className="text-sm text-white">{profile.firstName}</p>
                  <p className="text-xs text-gray-500">₦{profile.balance.toLocaleString()}</p>
                </div>
              )}
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Logout"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto">
          {children}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-[#0f172a] border-t border-gray-800 px-4 py-3 z-50">
          <div className="max-w-4xl mx-auto flex justify-around">
            <NavItem href="/trader" icon="home" label="Home" active={pathname === '/trader'} />
            <NavItem href="/trader/submit" icon="plus" label="Submit" active={pathname === '/trader/submit'} />
            <NavItem href="/trader/history" icon="list" label="History" active={pathname === '/trader/history'} />
            <NavItem href="/trader/payouts" icon="money" label="Payouts" active={pathname === '/trader/payouts'} />
          </div>
        </nav>
      </div>
    </TraderAuthContext.Provider>
  );
}

// Navigation Item Component
function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  const icons: Record<string, JSX.Element> = {
    home: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    plus: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    list: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    money: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  };

  return (
    <Link 
      href={href} 
      className={`flex flex-col items-center transition-colors ${
        active ? 'text-emerald-400' : 'text-gray-400 hover:text-white'
      }`}
    >
      {icons[icon]}
      <span className="text-xs mt-1">{label}</span>
    </Link>
  );
}
