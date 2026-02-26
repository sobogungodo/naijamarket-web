// ============================================================
// app/api/analytics/route.ts — GA4 Data API Endpoint
// Admin Dashboard: naijamarket-admin.vercel.app
// ============================================================
// SETUP REQUIRED (one-time):
//   1. Go to console.cloud.google.com
//   2. Select your project (or create one: "naijamarket-admin")
//   3. Enable "Google Analytics Data API"
//   4. Go to IAM & Admin → Service Accounts
//   5. Create service account: "naijamarket-analytics-reader"
//   6. Create JSON key → download it
//   7. In GA4: Admin → Property Access Management
//      → Add service account email with "Viewer" role
//   8. In Vercel: Add environment variable:
//      GOOGLE_SERVICE_ACCOUNT_KEY = (paste entire JSON content)
//      GA4_PROPERTY_ID = (your numeric property ID, e.g. 123456789)
//      → Find property ID: GA4 Admin → Property Settings
// ============================================================

import { NextResponse } from 'next/server';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

// ─── Types ───────────────────────────────────────────────────
interface RealtimeData {
  activeUsers: number;
  activeUsersByPage: Array<{ page: string; users: number }>;
  activeUsersByCountry: Array<{ country: string; users: number }>;
}

interface SessionData {
  date: string;
  sessions: number;
  pageviews: number;
  avgSessionDuration: number;
}

interface GeographyData {
  city: string;
  country: string;
  sessions: number;
  users: number;
}

interface UserTypeData {
  newUsers: number;
  returningUsers: number;
  totalUsers: number;
}

interface TopPagesData {
  page: string;
  pageviews: number;
  avgTimeOnPage: number;
}

interface AnalyticsResponse {
  realtime: RealtimeData;
  sessions: SessionData[];
  geography: GeographyData[];
  userTypes: UserTypeData;
  topPages: TopPagesData[];
  summary: {
    totalSessions28d: number;
    totalPageviews28d: number;
    totalUsers28d: number;
    avgBounceRate: number;
  };
}

// ─── Initialize GA4 Client ────────────────────────────────────
function getAnalyticsClient(): BetaAnalyticsDataClient {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable not set');
  }

  let credentials;
  try {
    credentials = JSON.parse(serviceAccountKey);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
  }

  return new BetaAnalyticsDataClient({ credentials });
}

// ─── Main Handler ─────────────────────────────────────────────
export async function GET() {
  const propertyId = process.env.GA4_PROPERTY_ID;

  if (!propertyId) {
    return NextResponse.json(
      { error: 'GA4_PROPERTY_ID not configured', configured: false },
      { status: 503 }
    );
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json(
      { error: 'GOOGLE_SERVICE_ACCOUNT_KEY not configured', configured: false },
      { status: 503 }
    );
  }

  try {
    const analyticsDataClient = getAnalyticsClient();
    const property = `properties/${propertyId}`;

    // ── Run all queries in parallel for performance ──────────
    const [
      realtimeResponse,
      sessionsResponse,
      geographyResponse,
      userTypeResponse,
      topPagesResponse,
    ] = await Promise.all([

      // 1. Realtime: active users right now
      analyticsDataClient.runRealtimeReport({
        property,
        dimensions: [{ name: 'unifiedScreenName' }],
        metrics: [{ name: 'activeUsers' }],
        minuteRanges: [{ startMinutesAgo: 30, endMinutesAgo: 0, name: 'last30min' }],
      }),

      // 2. Sessions & pageviews — last 28 days by day
      analyticsDataClient.runReport({
        property,
        dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      }),

      // 3. Geography — Nigerian cities focus
      analyticsDataClient.runReport({
        property,
        dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'city' }, { name: 'country' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20,
      }),

      // 4. New vs Returning users
      analyticsDataClient.runReport({
        property,
        dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'newVsReturning' }],
        metrics: [{ name: 'activeUsers' }],
      }),

      // 5. Top pages
      analyticsDataClient.runReport({
        property,
        dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
      }),
    ]);

    // ── Parse Realtime ───────────────────────────────────────
    let totalActiveUsers = 0;
    const activeUsersByPage: Array<{ page: string; users: number }> = [];

    if (realtimeResponse[0]?.rows) {
      for (const row of realtimeResponse[0].rows) {
        const users = parseInt(row.metricValues?.[0]?.value || '0', 10);
        totalActiveUsers += users;
        activeUsersByPage.push({
          page: row.dimensionValues?.[0]?.value || '(unknown)',
          users,
        });
      }
    }

    // ── Parse Sessions ───────────────────────────────────────
    const sessions: SessionData[] = (sessionsResponse[0]?.rows || []).map((row) => {
      const rawDate = row.dimensionValues?.[0]?.value || '';
      // Format YYYYMMDD → YYYY-MM-DD
      const formattedDate = rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;

      return {
        date: formattedDate,
        sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
        pageviews: parseInt(row.metricValues?.[1]?.value || '0', 10),
        avgSessionDuration: parseFloat(row.metricValues?.[2]?.value || '0'),
      };
    });

    // ── Parse Geography ──────────────────────────────────────
    const geography: GeographyData[] = (geographyResponse[0]?.rows || []).map((row) => ({
      city: row.dimensionValues?.[0]?.value || 'Unknown',
      country: row.dimensionValues?.[1]?.value || 'Unknown',
      sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
      users: parseInt(row.metricValues?.[1]?.value || '0', 10),
    }));

    // ── Parse User Types ─────────────────────────────────────
    let newUsers = 0;
    let returningUsers = 0;

    for (const row of userTypeResponse[0]?.rows || []) {
      const type = row.dimensionValues?.[0]?.value;
      const count = parseInt(row.metricValues?.[0]?.value || '0', 10);
      if (type === 'new') newUsers = count;
      else if (type === 'returning') returningUsers = count;
    }

    // ── Parse Top Pages ──────────────────────────────────────
    const topPages: TopPagesData[] = (topPagesResponse[0]?.rows || []).map((row) => ({
      page: row.dimensionValues?.[0]?.value || '/',
      pageviews: parseInt(row.metricValues?.[0]?.value || '0', 10),
      avgTimeOnPage: parseFloat(row.metricValues?.[1]?.value || '0'),
    }));

    // ── Calculate Summary ────────────────────────────────────
    const totalSessions28d = sessions.reduce((sum, s) => sum + s.sessions, 0);
    const totalPageviews28d = sessions.reduce((sum, s) => sum + s.pageviews, 0);
    const totalUsers28d = newUsers + returningUsers;

    const response: AnalyticsResponse = {
      realtime: {
        activeUsers: totalActiveUsers,
        activeUsersByPage: activeUsersByPage.slice(0, 5),
        activeUsersByCountry: [],
      },
      sessions,
      geography,
      userTypes: {
        newUsers,
        returningUsers,
        totalUsers: totalUsers28d,
      },
      topPages,
      summary: {
        totalSessions28d,
        totalPageviews28d,
        totalUsers28d,
        avgBounceRate: 0, // GA4 deprecated bounce rate; use engagement rate instead
      },
    };

    return NextResponse.json(response, {
      headers: {
        // Cache for 5 minutes — GA4 realtime updates every ~30s anyway
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });

  } catch (error) {
    console.error('[GA4 API] Error fetching analytics:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to fetch analytics data',
        details: errorMessage,
        configured: true,
      },
      { status: 500 }
    );
  }
}
