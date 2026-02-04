'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

export default function TraderDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TraderProfile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuthAndLoadProfile();
  }, []);

  const checkAuthAndLoadProfile = async () => {
    // Check for token in localStorage
    const token = localStorage.getItem('traderToken');
    const phone = localStorage.getItem('traderPhone');

    console.log('Auth check:', { hasToken: !!token, hasPhone: !!phone });

    if (!token || !phone) {
      console.log('No token/phone found, redirecting to login');
      router.push('/trader/login');
      return;
    }

    // Fetch profile
    try {
      const response = await fetch('/api/trader/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Profile response status:', response.status);

      if (response.status === 401) {
        // Token invalid/expired
        console.log('Token invalid, clearing and redirecting');
        localStorage.removeItem('traderToken');
        localStorage.removeItem('traderPhone');
        router.push('/trader/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load profile');
      }

      const data = await response.json();
      console.log('Profile loaded:', data);

      if (data.success && data.trader) {
        setProfile(data.trader);
      } else {
        throw new Error(data.error || 'Profile load failed');
      }
    } catch (err: any) {
      console.error('Profile load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('traderToken');
    localStorage.removeItem('traderPhone');
    router.push('/trader/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
        <div className="bg-[#1a1f2e] border border-red-500/50 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-red-400 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/trader/login')}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <header className="bg-[#0f172a] border-b border-gray-800 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">NaijaMarket</h1>
              <p className="text-xs text-emerald-400">Trader Portal</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-2xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">
            👋 Welcome, {profile?.firstName || 'Trader'}!
          </h2>
          <p className="text-gray-400">
            {profile?.market || 'Your Market'} • {profile?.tier || 'Trader'} Tier
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#1a1f2e] border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">
              ₦{(profile?.balance || 0).toLocaleString()}
            </p>
            <p className="text-gray-500 text-sm">Balance</p>
          </div>
          <div className="bg-[#1a1f2e] border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {profile?.reputation || 50}/100
            </p>
            <p className="text-gray-500 text-sm">Reputation</p>
          </div>
          <div className="bg-[#1a1f2e] border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-cyan-400">
              {profile?.todaySubmissions || 0}/8
            </p>
            <p className="text-gray-500 text-sm">Today</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <Link
              href="/trader/submit"
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl p-6 text-center transition-colors"
            >
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-semibold">Submit Price</span>
            </Link>
            <Link
              href="/trader/history"
              className="bg-[#1a1f2e] hover:bg-[#252b3b] border border-gray-700 text-white rounded-xl p-6 text-center transition-colors"
            >
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="font-semibold">View History</span>
            </Link>
          </div>
        </div>

        {/* Pending Balance Info */}
        {(profile?.pendingBalance || 0) > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-amber-400 font-medium">
                  ₦{(profile?.pendingBalance || 0).toLocaleString()} pending
                </p>
                <p className="text-gray-400 text-sm">Awaiting validation approval</p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 bg-[#0f172a] border-t border-gray-800 px-4 py-3">
          <div className="max-w-4xl mx-auto flex justify-around">
            <Link href="/trader" className="flex flex-col items-center text-emerald-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs mt-1">Home</span>
            </Link>
            <Link href="/trader/submit" className="flex flex-col items-center text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs mt-1">Submit</span>
            </Link>
            <Link href="/trader/history" className="flex flex-col items-center text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-xs mt-1">History</span>
            </Link>
            <Link href="/trader/payouts" className="flex flex-col items-center text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-xs mt-1">Payouts</span>
            </Link>
          </div>
        </nav>
      </main>
    </div>
  );
}
