'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Types
interface TraderProfile {
  phone: string;
  fullName: string;
  marketName: string;
  marketId: string;
  reputation: number;
  balance: number;
  pendingBalance: number;
  todaySubmissions: number;
  dailyLimit: number;
  totalApproved: number;
  totalRejected: number;
  tier: string;
}

interface RecentSubmission {
  id: string;
  itemName: string;
  price: number;
  unit: string;
  status: 'APPROVED' | 'PENDING_VALIDATION' | 'REJECTED' | 'FLAGGED';
  submittedAt: string;
  reward: number;
}

export default function TraderDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<TraderProfile | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const token = localStorage.getItem('trader_token');
    const phone = localStorage.getItem('trader_phone');
    
    if (!token || !phone) {
      router.push('/trader/login');
      return;
    }

    try {
      // Load trader profile
      const profileRes = await fetch(`/api/trader/profile?phone=${phone}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!profileRes.ok) {
        if (profileRes.status === 401) {
          localStorage.removeItem('trader_token');
          localStorage.removeItem('trader_phone');
          router.push('/trader/login');
          return;
        }
        throw new Error('Failed to load profile');
      }
      
      const profileData = await profileRes.json();
      setProfile(profileData);

      // Load recent submissions
      const submissionsRes = await fetch(`/api/trader/submissions?phone=${phone}&limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (submissionsRes.ok) {
        const submissionsData = await submissionsRes.json();
        setRecentSubmissions(submissionsData.submissions || []);
      }
    } catch (err) {
      setError('Failed to load data. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('trader_token');
    localStorage.removeItem('trader_phone');
    router.push('/trader/login');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-500';
      case 'PENDING_VALIDATION': return 'bg-yellow-500';
      case 'REJECTED': return 'bg-red-500';
      case 'FLAGGED': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Approved';
      case 'PENDING_VALIDATION': return 'Pending';
      case 'REJECTED': return 'Rejected';
      case 'FLAGGED': return 'Flagged';
      default: return status;
    }
  };

  const getReputationColor = (rep: number) => {
    if (rep >= 80) return 'text-green-400';
    if (rep >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'GOLD': return '🥇';
      case 'SILVER': return '🥈';
      case 'BRONZE': return '🥉';
      default: return '⭐';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-green-200 text-lg font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-900/50 border border-red-500 rounded-2xl p-6 text-center max-w-sm">
          <p className="text-red-200 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-gray-900">
      {/* Header */}
      <header className="bg-green-950/80 backdrop-blur-sm border-b border-green-700/50 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-sm">NaijaMarket</h1>
              <p className="text-green-400 text-xs">Trader Portal</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="text-green-400 hover:text-white text-sm font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Welcome Card */}
        <div className="bg-gradient-to-br from-green-800/50 to-green-900/50 backdrop-blur border border-green-600/30 rounded-3xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-green-300 text-sm">Welcome back,</p>
              <h2 className="text-white text-xl font-bold">{profile?.fullName?.split(' ')[0] || 'Trader'} 👋</h2>
            </div>
            <div className="text-right">
              <span className="text-2xl">{getTierBadge(profile?.tier || 'STARTER')}</span>
              <p className="text-green-400 text-xs mt-1">{profile?.tier || 'Starter'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-green-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm">{profile?.marketName || 'No market assigned'}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Balance Card */}
          <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-700/10 border border-yellow-500/30 rounded-2xl p-4">
            <p className="text-yellow-300/70 text-xs font-medium mb-1">Available Balance</p>
            <p className="text-yellow-300 text-2xl font-bold">₦{(profile?.balance || 0).toLocaleString()}</p>
            {(profile?.pendingBalance || 0) > 0 && (
              <p className="text-yellow-400/60 text-xs mt-1">+₦{profile?.pendingBalance.toLocaleString()} pending</p>
            )}
          </div>

          {/* Reputation Card */}
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/10 border border-purple-500/30 rounded-2xl p-4">
            <p className="text-purple-300/70 text-xs font-medium mb-1">Reputation</p>
            <p className={`text-2xl font-bold ${getReputationColor(profile?.reputation || 50)}`}>
              {profile?.reputation || 50}
              <span className="text-sm text-purple-300/50">/100</span>
            </p>
            {(profile?.reputation || 0) >= 80 && (
              <p className="text-green-400 text-xs mt-1">⚡ Instant approval</p>
            )}
          </div>

          {/* Today's Submissions */}
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/30 rounded-2xl p-4">
            <p className="text-blue-300/70 text-xs font-medium mb-1">Today&apos;s Submissions</p>
            <p className="text-blue-300 text-2xl font-bold">
              {profile?.todaySubmissions || 0}
              <span className="text-sm text-blue-300/50">/{profile?.dailyLimit || 8}</span>
            </p>
            <div className="w-full bg-blue-900/50 rounded-full h-1.5 mt-2">
              <div 
                className="bg-blue-400 h-1.5 rounded-full transition-all"
                style={{ width: `${((profile?.todaySubmissions || 0) / (profile?.dailyLimit || 8)) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Approval Rate */}
          <div className="bg-gradient-to-br from-green-600/20 to-green-700/10 border border-green-500/30 rounded-2xl p-4">
            <p className="text-green-300/70 text-xs font-medium mb-1">Approval Rate</p>
            <p className="text-green-300 text-2xl font-bold">
              {profile?.totalApproved && profile?.totalRejected 
                ? Math.round((profile.totalApproved / (profile.totalApproved + profile.totalRejected)) * 100)
                : 100}%
            </p>
            <p className="text-green-400/60 text-xs mt-1">
              {profile?.totalApproved || 0} approved
            </p>
          </div>
        </div>

        {/* Submit Price CTA */}
        <Link href="/trader/submit">
          <div className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 rounded-2xl p-5 shadow-lg shadow-green-900/50 transition-all active:scale-[0.98] cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white text-lg font-bold">Submit Price</h3>
                <p className="text-green-100/80 text-sm">Earn ₦200 per approved submission</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
          </div>
        </Link>

        {/* Recent Submissions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold">Recent Submissions</h3>
            <Link href="/trader/history" className="text-green-400 text-sm hover:text-green-300 transition-colors">
              View all →
            </Link>
          </div>

          {recentSubmissions.length === 0 ? (
            <div className="bg-green-900/30 border border-green-700/30 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-green-800/50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-green-300 font-medium">No submissions yet</p>
              <p className="text-green-400/60 text-sm mt-1">Start earning by submitting prices!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSubmissions.map((sub) => (
                <div 
                  key={sub.id}
                  className="bg-green-900/30 border border-green-700/30 rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <p className="text-white font-medium">{sub.itemName}</p>
                    <p className="text-green-300 text-sm">₦{sub.price.toLocaleString()} / {sub.unit}</p>
                    <p className="text-green-400/60 text-xs mt-1">
                      {new Date(sub.submittedAt).toLocaleDateString('en-NG', { 
                        day: 'numeric', 
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`${getStatusColor(sub.status)} text-white text-xs px-2 py-1 rounded-full font-medium`}>
                      {getStatusText(sub.status)}
                    </span>
                    {sub.status === 'APPROVED' && (
                      <p className="text-yellow-400 text-sm font-bold mt-1">+₦{sub.reward}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/trader/history">
            <div className="bg-green-900/30 border border-green-700/30 rounded-xl p-4 text-center hover:bg-green-800/30 transition-colors cursor-pointer">
              <div className="w-10 h-10 bg-green-800/50 rounded-xl flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-white text-sm font-medium">History</p>
            </div>
          </Link>

          <Link href="/trader/payouts">
            <div className="bg-green-900/30 border border-green-700/30 rounded-xl p-4 text-center hover:bg-green-800/30 transition-colors cursor-pointer">
              <div className="w-10 h-10 bg-green-800/50 rounded-xl flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-white text-sm font-medium">Payouts</p>
            </div>
          </Link>
        </div>

        {/* Help Banner */}
        <div className="bg-blue-900/30 border border-blue-700/30 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-800/50 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-blue-200 text-sm">Need help? Chat with us on WhatsApp</p>
            <a 
              href="https://wa.me/14155238886?text=help" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 text-sm font-medium hover:text-blue-300"
            >
              Send &quot;help&quot; →
            </a>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-green-950/95 backdrop-blur border-t border-green-700/50 safe-area-bottom">
        <div className="max-w-lg mx-auto px-4 py-2 flex items-center justify-around">
          <Link href="/trader" className="flex flex-col items-center py-2 px-4 text-green-400">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
            <span className="text-xs mt-1 font-medium">Home</span>
          </Link>
          
          <Link href="/trader/submit" className="flex flex-col items-center py-2 px-4 text-green-600 hover:text-green-400 transition-colors">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center -mt-6 shadow-lg shadow-green-900/50">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-xs mt-1 font-medium text-green-400">Submit</span>
          </Link>
          
          <Link href="/trader/history" className="flex flex-col items-center py-2 px-4 text-green-600 hover:text-green-400 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs mt-1 font-medium">History</span>
          </Link>
        </div>
      </nav>

      {/* Bottom padding for nav */}
      <div className="h-20"></div>
    </div>
  );
}
