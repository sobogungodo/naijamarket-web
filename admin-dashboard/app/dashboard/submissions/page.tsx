'use client';

import React from 'react';
import { PageWrapper } from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { FileText, CheckCircle } from 'lucide-react';

export default function SubmissionsPage() {
  return (
    <PageWrapper
      title="Submissions Review"
      subtitle="Review and approve price submissions"
    >
      <div className="grid gap-6">
        {/* Test Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Page Loading Successfully
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-dash-muted">
              If you can see this page, the routing is working correctly.
              The full submissions review page with charts will be added next.
            </p>
          </CardContent>
        </Card>

        {/* Stats Preview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-dash-text">--</p>
                  <p className="text-sm text-dash-muted">Total Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <FileText className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-dash-text">--</p>
                  <p className="text-sm text-dash-muted">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <FileText className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-dash-text">--</p>
                  <p className="text-sm text-dash-muted">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <FileText className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-dash-text">--</p>
                  <p className="text-sm text-dash-muted">Flagged</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
