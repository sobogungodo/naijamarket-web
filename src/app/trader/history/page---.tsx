'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Submission {
  id: string;
  itemName: string;
  marketName: string;
  price: number;
  unit: string;
  status: 'APPROVED' | 'PENDING_VALIDATION' | 'REJECTED' | 'FLAGGED';
  submittedAt: string;
  source: string;
  reward: number;
}

export default function SubmissionHistory() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<'all' | 'APPROVED' | 'PENDING_VALIDATION' | 'REJECTED'>('all');

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async (offset = 0, append = false) => {
    const token = localStorage.getItem('trader_token');
    const phone = localStorage.getItem('trader_phone');
    
    if (!token || !phone) {
      router.push('/trader/login');
      return;
    }

    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/trader/submissions?phone=${phone}&limit=20&offset=${offset}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('trader_token');
          router.push('/trader/login');
          return;
        }
        throw new Error('Failed to load submissions');
      }
      
      const data = await res.json();
      
      if (append) setSubmissions(prev => [...prev, ...(data.submissions || [])]);
      else setSubmissions(data.submissions || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
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

  const filteredSubmissions = filter === 'all' ? submissions : submissions.filter(s => s.status === filter);

  const stats = {
    total: submissions.length,
    approved: submissions.filter(s => s.status === 'APPROVED').length,
    pending: submissions.filter(s => s.status === 'PENDING_VALIDATION').length,
    rejected: submissions.filter(s => s.status === 'REJECTED').length,
    totalEarned: submissions.filter(s => s.status === 'APPROVED').reduce((sum, s) => sum + s.reward, 0)
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
            <h1 className="text-white font-bold">Submission History</h1>
            <p className="text-green-400 text-xs">{total} total submissions</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-green-900/40 border border-green-600/30 rounded-xl p-3 text-center">
            <p className="text-green-300 text-xl font-bold">{stats.total}</p>
            <p className="text-green-400/60 text-xs">Total</p>
          </div>
          <div className="bg-green-900/40 border border-green-600/30 rounded-xl p-3 text-center">
            <p className="text-green-400 text-xl font-bold">{stats.approved}</p>
            <p className="text-green-400/60 text-xs">Approved</p>
          </div>
          <div className="bg-green-900/40 border border-green-600/30 rounded-xl p-3 text-center">
            <p className="text-yellow-400 text-xl font-bold">{stats.pending}</p>
            <p className="text-green-400/60 text-xs">Pending</p>
          </div>
          <div className="bg-green-900/40 border border-green-600/30 rounded-xl p-3 text-center">
            <p className="text-yellow-300 text-xl font-bold">₦{stats.totalEarned.toLocaleString()}</p>
            <p className="text-green-400/60 text-xs">Earned</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'APPROVED', label: 'Approved' },
            { key: 'PENDING_VALIDATION', label: 'Pending' },
            { key: 'REJECTED', label: 'Rejected' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                filter === key ? 'bg-green-500 text-white' : 'bg-green-900/40 border border-green-600/30 text-green-300 hover:bg-green-800/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filteredSubmissions.length === 0 ? (
          <div className="bg-green-900/30 border border-green-700/30 rounded-2xl p-8 text-center">
            <p className="text-green-300 font-medium">No submissions found</p>
            <p className="text-green-400/60 text-sm mt-1">
              {filter === 'all' ? 'Start submitting prices to see them here' : `No ${filter.toLowerCase().replace('_', ' ')} submissions`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSubmissions.map((sub) => (
              <div key={sub.id} className="bg-green-900/30 border border-green-700/30 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-white font-medium">{sub.itemName}</h3>
                    <p className="text-green-400/60 text-xs">{sub.marketName}</p>
                  </div>
                  <span className={`${getStatusColor(sub.status)} text-white text-xs px-2 py-1 rounded-full font-medium`}>
                    {getStatusText(sub.status)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-300 text-lg font-bold">₦{sub.price.toLocaleString()}</p>
                    <p className="text-green-400/60 text-xs">per {sub.unit}</p>
                  </div>
                  <div className="text-right">
                    {sub.status === 'APPROVED' && <p className="text-yellow-400 text-sm font-bold">+₦{sub.reward}</p>}
                    <p className="text-green-400/60 text-xs">
                      {new Date(sub.submittedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-green-700/30 flex items-center justify-between">
                  <span className={`text-xs ${sub.source === 'WEB' ? 'text-blue-400' : 'text-green-400'}`}>
                    via {sub.source === 'WEB' ? '🌐 Web' : '💬 WhatsApp'}
                  </span>
                  <span className="text-green-500/50 text-xs font-mono">{sub.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {submissions.length < total && (
          <button
            onClick={() => loadSubmissions(submissions.length, true)}
            disabled={loadingMore}
            className="w-full bg-green-900/40 border border-green-600/30 text-green-300 font-medium py-3 rounded-xl hover:bg-green-800/40 transition-all disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : `Load More (${submissions.length}/${total})`}
          </button>
        )}
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
          <Link href="/trader/history" className="flex flex-col items-center py-2 px-4 text-green-400">
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
