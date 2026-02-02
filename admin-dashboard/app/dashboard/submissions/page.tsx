'use client';

import React from 'react';
import { FileText, CheckCircle, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

export default function SubmissionsPage() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="h-16 bg-dash-card border-b border-dash-border px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-dash-text">Submissions Review</h1>
          <p className="text-sm text-dash-muted">Review and approve price submissions</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="live-indicator text-sm text-dash-muted">Live Data</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-6">
          {/* Success Card */}
          <div className="rounded-xl border border-dash-border bg-dash-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <h2 className="text-lg font-semibold text-dash-text">Page Loading Successfully!</h2>
            </div>
            <p className="text-dash-muted">
              If you can see this page, the routing is working correctly.
              The full submissions review page with charts will be added next.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total Today */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-dash-text">247</p>
                  <p className="text-sm text-dash-muted">Total Today</p>
                </div>
              </div>
            </div>

            {/* Pending */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Clock className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-dash-text">18</p>
                  <p className="text-sm text-dash-muted">Pending Review</p>
                </div>
              </div>
            </div>

            {/* Approved */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-dash-text">215</p>
                  <p className="text-sm text-dash-muted">Approved</p>
                </div>
              </div>
            </div>

            {/* Flagged */}
            <div className="rounded-xl border border-dash-border bg-dash-card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-dash-text">14</p>
                  <p className="text-sm text-dash-muted">Fraud Flagged</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sample Table */}
          <div className="rounded-xl border border-dash-border bg-dash-card overflow-hidden">
            <div className="p-4 border-b border-dash-border">
              <h3 className="font-semibold text-dash-text">Recent Submissions</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dash-bg">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dash-muted uppercase">Trader</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dash-muted uppercase">Market</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dash-muted uppercase">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dash-muted uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dash-muted uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dash-muted uppercase">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border">
                  <tr className="hover:bg-dash-hover">
                    <td className="px-4 py-3 text-sm text-dash-text">Chidi Okonkwo</td>
                    <td className="px-4 py-3 text-sm text-dash-muted">Mile 12</td>
                    <td className="px-4 py-3 text-sm text-dash-text">Rice (50kg)</td>
                    <td className="px-4 py-3 text-sm text-dash-text">₦85,000</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-500">Pending</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-dash-muted">2 min ago</td>
                  </tr>
                  <tr className="hover:bg-dash-hover">
                    <td className="px-4 py-3 text-sm text-dash-text">Amina Bello</td>
                    <td className="px-4 py-3 text-sm text-dash-muted">Wuse Market</td>
                    <td className="px-4 py-3 text-sm text-dash-text">Tomatoes (basket)</td>
                    <td className="px-4 py-3 text-sm text-dash-text">₦45,000</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-500">Approved</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-dash-muted">5 min ago</td>
                  </tr>
                  <tr className="hover:bg-dash-hover">
                    <td className="px-4 py-3 text-sm text-dash-text">Emeka Eze</td>
                    <td className="px-4 py-3 text-sm text-dash-muted">Onitsha Main</td>
                    <td className="px-4 py-3 text-sm text-dash-text">Cement (bag)</td>
                    <td className="px-4 py-3 text-sm text-dash-text">₦8,500</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-red-500/10 text-red-500">Flagged</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-dash-muted">8 min ago</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Info Box */}
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-dash-text">Next Steps</h4>
                <p className="text-sm text-dash-muted mt-1">
                  This is a test page to verify routing works. The full page will include:
                  interactive charts, real-time data from API, approve/reject buttons, and fraud detection indicators.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
