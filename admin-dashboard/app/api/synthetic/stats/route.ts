/**
 * Synthetic Activity Stats API
 * GET /api/synthetic/stats
 *
 * Returns real-time stats for the synthetic trader/validator engine.
 * Queries Azure SQL directly — no mock fallback intentional,
 * as this section should only appear once the seed SPs have run.
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const rows = await query<{
      synthetic_traders:       number;
      synthetic_validators:    number;
      submissions_today:       number;
      submissions_approved:    number;
      submissions_rejected:    number;
      votes_today:             number;
      markets_with_activity:   number;
      total_markets:           number;
      avg_votes_per_submission: number;
      last_run_at:             string | null;
    }>(`
      SELECT
        -- Synthetic roster counts
        (SELECT COUNT(*) FROM dbo.Traders_register  WHERE trader_id    LIKE 'SYN-TR-%' AND registration_status = 'SYNTHETIC') AS synthetic_traders,
        (SELECT COUNT(*) FROM dbo.Validators         WHERE validator_id LIKE 'SYN-VL-%' AND status = 'ACTIVE')                 AS synthetic_validators,

        -- Today's submission activity
        (SELECT COUNT(*)
         FROM dbo.Submissions
         WHERE trader_id LIKE 'SYN-TR-%'
           AND CAST(created_at AS DATE) = '${today}') AS submissions_today,

        (SELECT COUNT(*)
         FROM dbo.Submissions
         WHERE trader_id LIKE 'SYN-TR-%'
           AND CAST(created_at AS DATE) = '${today}'
           AND validation_status = 'APPROVED') AS submissions_approved,

        (SELECT COUNT(*)
         FROM dbo.Submissions
         WHERE trader_id LIKE 'SYN-TR-%'
           AND CAST(created_at AS DATE) = '${today}'
           AND validation_status = 'REJECTED') AS submissions_rejected,

        -- Today's vote activity
        (SELECT COUNT(*)
         FROM dbo.Validator_Votes
         WHERE validator_id LIKE 'SYN-VL-%'
           AND CAST(created_at AS DATE) = '${today}') AS votes_today,

        -- Market coverage today
        (SELECT COUNT(DISTINCT market_id)
         FROM dbo.Submissions
         WHERE trader_id LIKE 'SYN-TR-%'
           AND CAST(created_at AS DATE) = '${today}') AS markets_with_activity,

        -- Total markets in system
        (SELECT COUNT(*) FROM dbo.Markets) AS total_markets,

        -- Average votes per submission today
        (SELECT ISNULL(
          CAST(
            (SELECT COUNT(*) FROM dbo.Validator_Votes
             WHERE validator_id LIKE 'SYN-VL-%'
               AND CAST(created_at AS DATE) = '${today}')
            AS FLOAT)
          /
          NULLIF(
            (SELECT COUNT(*) FROM dbo.Submissions
             WHERE trader_id LIKE 'SYN-TR-%'
               AND CAST(created_at AS DATE) = '${today}'), 0
          ), 0)
        ) AS avg_votes_per_submission,

        -- Last time the SP ran (most recent synthetic submission)
        (SELECT TOP 1 CONVERT(NVARCHAR(30), created_at, 120)
         FROM dbo.Submissions
         WHERE trader_id LIKE 'SYN-TR-%'
         ORDER BY created_at DESC) AS last_run_at
    `);

    const stats = rows[0];

    // Calculate approval rate
    const approvalRate = stats.submissions_today > 0
      ? Math.round((stats.submissions_approved / stats.submissions_today) * 100 * 10) / 10
      : 0;

    // Market coverage percentage
    const marketCoverage = stats.total_markets > 0
      ? Math.round((stats.markets_with_activity / stats.total_markets) * 100 * 10) / 10
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        syntheticTraders:        stats.synthetic_traders,
        syntheticValidators:     stats.synthetic_validators,
        submissionsToday:        stats.submissions_today,
        submissionsApproved:     stats.submissions_approved,
        submissionsRejected:     stats.submissions_rejected,
        votesToday:              stats.votes_today,
        marketsWithActivity:     stats.markets_with_activity,
        totalMarkets:            stats.total_markets,
        approvalRate,
        marketCoverage,
        avgVotesPerSubmission:   Math.round(stats.avg_votes_per_submission * 10) / 10,
        lastRunAt:               stats.last_run_at,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[synthetic/stats] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch synthetic activity stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/synthetic/stats — trigger a single-market test run
// Body: { market_id: string }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const marketId = body.market_id as string | undefined;

    if (!marketId) {
      return NextResponse.json({ success: false, error: 'market_id required' }, { status: 400 });
    }

    // Execute the SP for a single market (safe test run)
    await query(`EXEC dbo.sp_Generate_Synthetic_Activity @MarketFilter = '${marketId}'`);

    return NextResponse.json({
      success: true,
      message: `Synthetic activity generated for market ${marketId}`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[synthetic/stats] POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
