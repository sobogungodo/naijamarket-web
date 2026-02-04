'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Payout {
  id: string;
  amount: number;
  status: 'PAID' | 'PENDING' | 'FAILED';
  method: string;
  paidAt: string;
}

interface PayoutSummary {
  totalEarned: number;
  totalPaid: number;
  pendingPayout: number;
  availableBalance: number;
  nextPayoutDate: string;
  minimumPayout: number;
}

export default function PayoutsPage() {
  const router = useRouter();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayouts();
  }, []);

  const loadPayouts = async () => {
    const token = localStorage.getItem('trader_token');
    const phone = localStorage.getItem('trader_phone');
    
    if (!token || !phone) {
      router.push('/trader/login');
      return;
    }

    try {
      const res = await fetch(`/api/trader/payouts?phone=${phone}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('trader_token');
          router.push('/trader/login');
          return;
        }
        throw new Error('Failed to load payouts');
      }
      
      const data = await res.json();
      setPayouts(data.payouts || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error(err);
      setSummary({
        totalEarned: 0, totalPaid: 0, pendingPayout: 0, availableBalance: 0,
        nextPayoutDate: getNextFriday(), minimumPayout: 500
      });
    } finally {
      setLoading(false);
    }
  };

  const getNextFriday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysUntilFriday);
    return nextFriday.toISOString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-green-500';
      case 'PENDING': return 'bg-yellow-500';
      case 'FAILED': return 'bg-red-500';
      default: return 'bg-gray-500';
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-gray-900">
      <header className="bg-green-950/80 backdrop-blur-sm border-b border-green-700/50 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/trader" className="text-green-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-white font-bold">Payouts</h1>
            <p className="text-green-400 text-xs">Your earnings & payment history</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="bg-gradient-to-br from-yellow-600/30 to-yellow-700/10 border border-yellow-500/30 rounded-3xl p-6">
          <p className="text-yellow-300/70 text-sm font-medium mb-1">Available Balance</p>
          <p className="text-yellow-300 text-4xl font-bold mb-4">₦{(summary?.availableBalance || 0).toLocaleString()}</p>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-yellow-500/20">
            <div>
              <p className="text-yellow-300/60 text-xs">Total Earned</p>
              <p className="text-yellow-200 font-bold">₦{(summary?.totalEarned || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-yellow-300/60 text-xs">Total Paid Out</p>
              <p className="text-yellow-200 font-bold">₦{(summary?.totalPaid || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-900/30 border border-blue-600/30 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-800/50 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-blue-200 font-medium">Next Payout</p>
              <p className="text-blue-300 text-sm">
                {summary?.nextPayoutDate ? new Date(summary.nextPayoutDate).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Every Friday'}
              </p>
            </div>
          </div>
          {(summary?.availableBalance || 0) < (summary?.minimumPayout || 500) && (
            <div className="mt-3 pt-3 border-t border-blue-600/30">
              <p className="text-blue-400/80 text-xs">
                ⚠️ Minimum payout is ₦{summary?.minimumPayout || 500}. You need ₦{(summary?.minimumPayout || 500) - (summary?.availableBalance || 0)} more.
              </p>
            </div>
          )}
        </div>

        <div className="bg-green-900/30 border border-green-700/30 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-800/50 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">Airtime Top-up</p>
                <p className="text-green-400/60 text-xs">Sent to your registered phone</p>
              </div>
            </div>
            <span className="text-green-400 text-xs bg-green-900/50 px-2 py-1 rounded-full">Active</span>
          </div>
        </div>

        <div>
          <h3 className="text-white font-bold mb-3">Payout History</h3>
          {payouts.length === 0 ? (
            <div className="bg-green-900/30 border border-green-700/30 rounded-2xl p-6 text-center">
              <p className="text-green-300 font-medium">No payouts yet</p>
              <p className="text-green-400/60 text-sm mt-1">Keep submitting prices to earn rewards!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {payouts.map((payout) => (
                <div key={payout.id} className="bg-green-900/30 border border-green-700/30 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">₦{payout.amount.toLocaleString()}</p>
                    <p className="text-green-400/60 text-xs">
                      {new Date(payout.paidAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`${getStatusColor(payout.status)} text-white text-xs px-2 py-1 rounded-full font-medium`}>
                      {payout.status}
                    </span>
                    <p className="text-green-500/50 text-xs mt-1">{payout.method}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-purple-900/30 border border-purple-600/30 rounded-2xl p-4">
          <h4 className="text-purple-200 font-medium mb-2">💡 How Payouts Work</h4>
          <ul className="text-purple-300/80 text-sm space-y-1">
            <li>• Earn ₦200 for each approved price submission</li>
            <li>• Payouts are processed every Friday at 6 PM</li>
            <li>• Minimum balance of ₦500 required for payout</li>
            <li>• Airtime sent directly to your registered phone</li>
          </ul>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-green-950/95 backdrop-blur border-t border-green-700/50">
        <div className="max-w-lg mx-auto px-4 py-2 flex items-center justify-around">
          <Link href="/trader" className="flex flex-col items-center py-2 px-4 text-green-600 hover:text-green-400">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            <span className="text-xs mt-1 font-medium">Home</span>
          </Link>
          <Link href="/trader/submit" className="flex flex-col items-center py-2 px-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center -mt-6 shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-xs mt-1 font-medium text-green-400">Submit</span>
          </Link>
          <Link href="/trader/history" className="flex flex-col items-center py-2 px-4 text-green-600 hover:text-green-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs mt-1 font-medium">History</span>
          </Link>
        </div>
      </nav>
      <div className="h-20"></div>
    </div>
  );
}
