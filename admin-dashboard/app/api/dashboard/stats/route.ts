/**
 * Dashboard Stats API Route
 * GET /api/dashboard/stats
 * 
 * Returns aggregated statistics for the executive overview dashboard
 */

import { NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

export async function GET() {
  try {
    const stats = await getDashboardStats();
    
    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    
    // Return mock data if Google Sheets is not configured
    if (String(error).includes('GOOGLE_SERVICE_ACCOUNT_KEY')) {
      return NextResponse.json({
        success: true,
        data: getMockStats(),
        timestamp: new Date().toISOString(),
        mock: true,
      });
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch dashboard stats',
        details: String(error),
      },
      { status: 500 }
    );
  }
}

// Mock data for development when Google Sheets is not configured
function getMockStats() {
  return {
    totalTraders: 1247,
    activeTraders: 1089,
    totalValidators: 342,
    activeValidators: 298,
    totalSubmissions: 45678,
    submissionsToday: 234,
    pendingValidations: 47,
    approvalRate: 87.3,
    totalEarningsDistributed: 2456000,
    pendingPayouts: 89,
    pendingPayoutAmount: 156700,
    weeklyPayoutAmount: 234500,
    totalFraudAlerts: 156,
    criticalAlerts: 3,
    unresolvedAlerts: 12,
    resolutionRate: 92.3,
    activeMarkets: 8,
    topMarketBySubmissions: 'Mile 12 Market',
  };
}
