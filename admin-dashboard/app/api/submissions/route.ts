import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query, execute } from '@/lib/db';

// ============================================================================
// SUBMISSIONS API — NaijaMarket Intel Admin
// GET   /api/submissions — list with filters
// POST  /api/submissions — stats / bulk actions / market list
// PATCH /api/submissions — approve or reject single submission
// ============================================================================

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page      = parseInt(searchParams.get('page')     || '1');
    const pageSize  = parseInt(searchParams.get('pageSize') || '20');
    const search    = searchParams.get('search')  || '';
    const status    = searchParams.get('status')  || '';
    const marketId  = searchParams.get('market')  || '';
    const dateRange = searchParams.get('date')    || 'today';
    const source    = searchParams.get('source')  || 'all';
    const offset    = (page - 1) * pageSize;

    let dateFilter = `AND CAST(s.created_at AS DATE) = CAST(GETDATE() AS DATE)`;
    if (dateRange === 'week')  dateFilter = `AND s.created_at >= DATEADD(day, -7, GETDATE())`;
    if (dateRange === 'month') dateFilter = `AND s.created_at >= DATEADD(day, -30, GETDATE())`;

    let where = `WHERE 1=1 ${dateFilter}`;
    if (search)   where += ` AND (s.trader_name LIKE '%' + @search + '%' OR s.item LIKE '%' + @search + '%' OR s.submission_id LIKE '%' + @search + '%')`;
    if (status && status !== 'All') where += ` AND s.validation_status = @status`;
    if (marketId && marketId !== 'all') where += ` AND s.market_id = @marketId`;
    if (source === 'synthetic') where += ` AND s.trader_id LIKE 'SYN-TR-%'`;
    if (source === 'real')      where += ` AND s.trader_id NOT LIKE 'SYN-TR-%'`;

    const sql = `
      SELECT
        s.submission_id, s.trader_id, s.trader_name, s.trader_phone,
        CAST(ISNULL(s.reputation_at_submission, 50) AS INT) AS reputation,
        s.market_id, s.market, s.state,
        s.item_id, s.item, s.category, s.unit,
        s.price, s.baseline_price, s.variance_from_baseline,
        s.gps_latitude, s.gps_longitude, s.gps_verified,
        s.distance_from_market,
        s.validation_status, s.status,
        s.fraud_flag, s.fraud_flag_reason,
        s.submitted_at, s.created_at, s.approved_at, s.rejected_at,
        CASE WHEN s.trader_id LIKE 'SYN-TR-%' THEN 1 ELSE 0 END AS isSynthetic
      FROM dbo.Submissions s
      ${where}
      ORDER BY s.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;

      SELECT COUNT(*) AS total FROM dbo.Submissions s ${where};
    `;

    const params: Record<string, unknown> = { offset, pageSize };
    if (search)   params.search   = search;
    if (status && status !== 'All') params.status = status;
    if (marketId && marketId !== 'all') params.marketId = marketId;

    const rows     = await query<Record<string, unknown>>(sql, params);
    const items    = rows.filter(r => 'submission_id' in r);
    const countRow = rows.find(r => 'total' in r);
    const total    = (countRow?.total as number) ?? items.length;

    return NextResponse.json({
      success: true,
      data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[submissions GET]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch submissions', message: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { action } = await request.json();
    const today = new Date().toISOString().split('T')[0];

    if (action === 'stats') {
      const rows = await query<Record<string, unknown>>(`
        SELECT
          (SELECT COUNT(*) FROM dbo.Submissions WHERE CAST(created_at AS DATE) = '${today}') AS totalToday,
          (SELECT COUNT(*) FROM dbo.Submissions WHERE CAST(created_at AS DATE) = '${today}' AND validation_status = 'PENDING')  AS pendingReview,
          (SELECT COUNT(*) FROM dbo.Submissions WHERE CAST(created_at AS DATE) = '${today}' AND validation_status = 'APPROVED') AS approvedToday,
          (SELECT COUNT(*) FROM dbo.Submissions WHERE CAST(created_at AS DATE) = '${today}' AND validation_status = 'REJECTED') AS rejectedToday,
          (SELECT COUNT(*) FROM dbo.Submissions WHERE CAST(created_at AS DATE) = '${today}' AND fraud_flag = 1)                 AS fraudFlagged,
          (SELECT COUNT(*) FROM dbo.Submissions WHERE CAST(created_at AS DATE) = '${today}' AND trader_id NOT LIKE 'SYN-TR-%')  AS realToday,
          (SELECT COUNT(*) FROM dbo.Submissions WHERE CAST(created_at AS DATE) = '${today}' AND trader_id LIKE 'SYN-TR-%')      AS syntheticToday,
          (SELECT COUNT(*) FROM dbo.Submissions WHERE CAST(created_at AS DATE) = CAST(DATEADD(day,-1,GETDATE()) AS DATE))        AS totalYesterday,
          (SELECT COUNT(*) FROM dbo.Submissions WHERE created_at >= DATEADD(day,-30,GETDATE()) AND validation_status = 'APPROVED') AS approvedMonth,
          (SELECT COUNT(*) FROM dbo.Submissions WHERE created_at >= DATEADD(day,-30,GETDATE()) AND validation_status = 'PENDING')  AS pendingMonth,
          (SELECT COUNT(*) FROM dbo.Submissions WHERE created_at >= DATEADD(day,-30,GETDATE()) AND validation_status = 'REJECTED') AS rejectedMonth
      `);
      const s = rows[0] ?? {};
      const totalToday     = (s.totalToday     as number) ?? 0;
      const totalYesterday = (s.totalYesterday as number) ?? 1;
      const approvalRate   = totalToday > 0 ? Math.round(((s.approvedToday as number ?? 0) / totalToday) * 1000) / 10 : 0;
      const vsYesterday    = totalYesterday > 0 ? Math.round(((totalToday - totalYesterday) / totalYesterday) * 1000) / 10 : 0;
      return NextResponse.json({ success: true, data: { ...s, approvalRate, vsYesterday }, timestamp: new Date().toISOString() });
    }

    if (action === 'approve_pending') {
      const affected = await execute(`
        UPDATE dbo.Submissions
        SET validation_status = 'APPROVED', status = 'APPROVED', consensus_result = 'APPROVED',
            approved_at = CAST(GETDATE() AS NVARCHAR(30)), updated_at = CAST(GETDATE() AS NVARCHAR(30))
        WHERE validation_status = 'PENDING'
          AND CAST(created_at AS DATE) = '${today}'
          AND trader_id NOT LIKE 'SYN-TR-%'
      `);
      return NextResponse.json({ success: true, message: `${affected} submissions approved`, affected });
    }

    if (action === 'markets') {
      const rows = await query<{ market_id: string; market_name: string }>(
        `SELECT DISTINCT market_id, market_name FROM dbo.Markets ORDER BY market_name`
      );
      return NextResponse.json({ success: true, data: rows });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[submissions POST]', error);
    return NextResponse.json({ success: false, error: 'Failed', message: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { submissionId, action } = await request.json();
    if (!submissionId || !action)
      return NextResponse.json({ success: false, error: 'submissionId and action required' }, { status: 400 });

    const newStatus    = action === 'approve' ? 'APPROVED' : 'REJECTED';
    const timestampCol = action === 'approve' ? 'approved_at' : 'rejected_at';

    await execute(`
      UPDATE dbo.Submissions
      SET validation_status = @status, status = @status, consensus_result = @status,
          ${timestampCol} = CAST(GETDATE() AS NVARCHAR(30)),
          updated_at      = CAST(GETDATE() AS NVARCHAR(30))
      WHERE submission_id = @submissionId
    `, { status: newStatus, submissionId });

    return NextResponse.json({ success: true, message: `Submission ${newStatus.toLowerCase()}` });

  } catch (error) {
    console.error('[submissions PATCH]', error);
    return NextResponse.json({ success: false, error: 'Failed to update submission' }, { status: 500 });
  }
}
