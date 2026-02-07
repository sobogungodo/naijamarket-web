'use client';

import { useTraderAuth } from './layout';
import Link from 'next/link';

export default function TraderDashboard() {
  const { profile, isLoading } = useTraderAuth();

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-800 rounded-2xl mb-6"></div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="h-24 bg-gray-800 rounded-xl"></div>
            <div className="h-24 bg-gray-800 rounded-xl"></div>
            <div className="h-24 bg-gray-800 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-2xl p-6 mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">
          👋 Welcome, {profile?.firstName || 'Trader'}!
        </h2>
        <p className="text-gray-400">
          {profile?.market || 'Your Market'} • {profile?.tier || 'New'} Tier
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

      {/* Pending Balance Alert */}
      {(profile?.pendingBalance || 0) > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

      {/* Reputation Progress */}
      <div className="bg-[#1a1f2e] border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">Reputation Progress</span>
          <span className="text-white font-medium">{profile?.reputation || 50}/100</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all ${
              (profile?.reputation || 50) >= 80 ? 'bg-emerald-500' : 
              (profile?.reputation || 50) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${profile?.reputation || 50}%` }}
          ></div>
        </div>
        <p className="text-gray-500 text-xs mt-2">
          {(profile?.reputation || 50) >= 80 
            ? '🌟 Gold status - Instant approvals enabled!' 
            : `${80 - (profile?.reputation || 50)} more points to unlock instant approvals`
          }
        </p>
      </div>
    </div>
  );
}
