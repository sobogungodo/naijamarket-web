'use client';

import { useState, useEffect } from 'react';
import { useTraderAuth } from './layout';

interface Submission {
  id: string;
  itemName: string;
  price: number;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  submittedAt: string;
  market: string;
  reward: number;
}

export default function TraderHistoryPage() {
  const { token } = useTraderAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    try {
      const response = await fetch('/api/trader/submissions', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.submissions) {
        setSubmissions(data.submissions);
      }
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubmissions = submissions.filter(s => {
    if (filter === 'all') return true;
    return s.status.toLowerCase() === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="px-2 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-400">✓ Approved</span>;
      case 'PENDING':
        return <span className="px-2 py-1 text-xs rounded-full bg-amber-500/20 text-amber-400">⏳ Pending</span>;
      case 'REJECTED':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">✗ Rejected</span>;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-24 bg-gray-800 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-white mb-4">Submission History</h1>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(['all', 'approved', 'pending', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-1 opacity-70">
                ({submissions.filter(s => s.status.toLowerCase() === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Submissions List */}
      {filteredSubmissions.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-gray-400">No submissions found</p>
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="mt-2 text-emerald-400 hover:underline"
            >
              Show all submissions
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSubmissions.map((submission) => (
            <div
              key={submission.id}
              className="bg-[#1a1f2e] border border-gray-800 rounded-xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-white font-medium">{submission.itemName}</h3>
                  <p className="text-gray-500 text-sm">{submission.market}</p>
                </div>
                {getStatusBadge(submission.status)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-bold">
                  ₦{submission.price.toLocaleString()}
                </span>
                <span className="text-gray-500 text-sm">
                  {formatDate(submission.submittedAt)}
                </span>
              </div>
              {submission.status === 'APPROVED' && submission.reward > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-800">
                  <span className="text-emerald-400 text-sm">
                    +₦{submission.reward} earned
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-emerald-400">
            {submissions.filter(s => s.status === 'APPROVED').length}
          </p>
          <p className="text-gray-500 text-xs">Approved</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-amber-400">
            {submissions.filter(s => s.status === 'PENDING').length}
          </p>
          <p className="text-gray-500 text-xs">Pending</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-red-400">
            {submissions.filter(s => s.status === 'REJECTED').length}
          </p>
          <p className="text-gray-500 text-xs">Rejected</p>
        </div>
      </div>
    </div>
  );
}
