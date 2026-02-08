'use client';

import { useState, useEffect } from 'react';
import { useTraderAuth } from '../layout';

interface Payout {
  id: string;
  amount: number;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  network: string;
  phone: string;
  processedAt: string;
}

export default function TraderPayoutsPage() {
  const { profile, token } = useTraderAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);

  useEffect(() => {
    loadPayouts();
  }, []);

  const loadPayouts = async () => {
    try {
      const response = await fetch('/api/trader/payouts', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.payouts) {
        setPayouts(data.payouts);
        setTotalEarned(data.totalEarned || 0);
        setTotalPaid(data.totalPaid || 0);
      }
    } catch (err) {
      console.error('Failed to load payouts:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Pending';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-2 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-400">✓ Sent</span>;
      case 'PENDING':
        return <span className="px-2 py-1 text-xs rounded-full bg-amber-500/20 text-amber-400">⏳ Processing</span>;
      case 'FAILED':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">✗ Failed</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-800 rounded-xl"></div>
          <div className="h-24 bg-gray-800 rounded-xl"></div>
          <div className="h-24 bg-gray-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-white mb-4">Payouts</h1>

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-2xl p-6 mb-6">
        <p className="text-gray-400 text-sm mb-1">Available Balance</p>
        <p className="text-4xl font-bold text-white mb-4">
          ₦{(profile?.balance || 0).toLocaleString()}
        </p>
        
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
          <div>
            <p className="text-gray-400 text-xs">Pending</p>
            <p className="text-amber-400 font-semibold">
              ₦{(profile?.pendingBalance || 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Total Earned</p>
            <p className="text-emerald-400 font-semibold">
              ₦{totalEarned.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Payout Info */}
      <div className="bg-[#1a1f2e] border border-gray-800 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-white font-medium">How Payouts Work</p>
            <ul className="text-gray-400 text-sm mt-2 space-y-1">
              <li>• Minimum balance: ₦500</li>
              <li>• Automatic payouts every Friday at 6 PM</li>
              <li>• Sent as airtime to your registered phone</li>
              <li>• Network auto-detected from phone number</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Payout History */}
      <h2 className="text-lg font-semibold text-white mb-4">Payout History</h2>
      
      {payouts.length === 0 ? (
        <div className="text-center py-12 bg-[#1a1f2e] border border-gray-800 rounded-xl">
          <div className="text-4xl mb-4">💰</div>
          <p className="text-gray-400">No payouts yet</p>
          <p className="text-gray-500 text-sm mt-2">
            Keep submitting prices to earn rewards!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map((payout) => (
            <div
              key={payout.id}
              className="bg-[#1a1f2e] border border-gray-800 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    payout.status === 'COMPLETED' ? 'bg-emerald-500/20' :
                    payout.status === 'PENDING' ? 'bg-amber-500/20' : 'bg-red-500/20'
                  }`}>
                    {payout.status === 'COMPLETED' ? '✓' :
                     payout.status === 'PENDING' ? '⏳' : '✗'}
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      ₦{payout.amount.toLocaleString()}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {payout.network} • {payout.phone}
                    </p>
                  </div>
                </div>
                {getStatusBadge(payout.status)}
              </div>
              <p className="text-gray-500 text-xs text-right">
                {formatDate(payout.processedAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Stats Summary */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="bg-[#1a1f2e] border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">
            ₦{totalPaid.toLocaleString()}
          </p>
          <p className="text-gray-500 text-sm">Total Received</p>
        </div>
        <div className="bg-[#1a1f2e] border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">
            {payouts.filter(p => p.status === 'COMPLETED').length}
          </p>
          <p className="text-gray-500 text-sm">Payouts Made</p>
        </div>
      </div>
    </div>
  );
}
