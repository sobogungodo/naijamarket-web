import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDashboardStats, query } from '@/lib/db';

// ============================================
// DASHBOARD STATS API
// GET /api/dashboard/stats
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get dashboard statistics
    const stats = await getDashboardStats();

    // Get recent activity
    const recentActivity = await query(`
      SELECT TOP 10
        'submission' as type,
        CONCAT('Price submission: ', c.Name, ' at ', FORMAT(s.Price, 'N0'), ' (', m.Name, ')') as description,
        s.TraderName as [user],
        s.SubmittedAt as timestamp
      FROM dbo.Submissions s
      LEFT JOIN dbo.Markets m ON s.MarketId = m.Id
      LEFT JOIN dbo.ItemsCatalog c ON s.CommodityId = c.Id
      ORDER BY s.SubmittedAt DESC
    `);

    // Get trend data (last 7 days)
    const trendData = await query(`
      SELECT 
        FORMAT(SubmittedAt, 'ddd') as name,
        COUNT(*) as submissions,
        SUM(CASE WHEN Status = 'approved' THEN 1 ELSE 0 END) as approvals,
        SUM(CASE WHEN Status = 'rejected' THEN 1 ELSE 0 END) as rejections
      FROM dbo.Submissions
      WHERE SubmittedAt >= DATEADD(day, -7, GETUTCDATE())
      GROUP BY FORMAT(SubmittedAt, 'ddd'), DATEPART(dw, SubmittedAt)
      ORDER BY DATEPART(dw, SubmittedAt)
    `);

    return NextResponse.json({
      success: true,
      data: {
        overview: stats,
        trends: trendData,
        recentActivity,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard stats API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch dashboard stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Refresh dashboard cache
// ============================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Force refresh stats
    const stats = await getDashboardStats();

    return NextResponse.json({
      success: true,
      data: stats,
      message: 'Dashboard cache refreshed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard refresh error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refresh dashboard' },
      { status: 500 }
    );
  }
}
