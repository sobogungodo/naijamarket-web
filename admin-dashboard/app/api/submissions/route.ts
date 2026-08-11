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
    const dateRange = searchParams.get('date')    || 'week';
    const source    = searchParams.get('source')  || 'all';
    const offset    = (page - 1) * pageSize;

    // Sargable date bounds. created_at is an nvarchar ISO-ish string in two
    // shapes ('YYYY-MM-DDTHH:MM:SS.sssZ' from the app, 'YYYY-MM-DD HH:MM:SS'
    // from the synthetic engine); both sort correctly by their 'YYYY-MM-DD'
    // prefix, so lexical range bounds select the right rows AND let an index on
    // created_at seek instead of forcing a full-table scan (the old
    // CAST(created_at AS DATE)=... predicate was non-sargable and timed out on S1).
    const pad = (n: number) => String(n).padStart(2, '0');
    const dayStr = (d: Date) =>
      `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const nowUtc = new Date();
    const dfEnd   = dayStr(new Date(nowUtc.getTime() + 86400000)); // exclusive upper bound = tomorrow (UTC)
    let   dfStart = dayStr(nowUtc);                                // today (UTC)
    if (dateRange === 'week')    dfStart = dayStr(new Date(nowUtc.getTime() -   7 * 86400000));
    if (dateRange === 'month')   dfStart = dayStr(new Date(nowUtc.getTime() -  30 * 86400000));
    if (dateRange === 'quarter') dfStart = dayStr(new Date(nowUtc.getTime() -  90 * 86400000));
    if (dateRange === 'year')    dfStart = dayStr(new Date(nowUtc.getTime() - 365 * 86400000));
    if (dateRange === 'all')     dfStart = '0001-01-01';          // historical: no lower bound

    // A real-status filter (not 'PRACTICE') means practice rows can't match — exclude them.
    const statusFiltersOutPractice = !!(status && status !== 'All' && status !== 'PRACTICE');
    const includeSubs     = source !== 'practice';
    const includePractice = (source === 'all' || source === 'practice') && !statusFiltersOutPractice;

    // Submissions (real + synthetic) branch
    let subsWhere = `WHERE 1=1 AND s.created_at >= @dfStart AND s.created_at < @dfEnd`;
    if (search)   subsWhere += ` AND (s.trader_name LIKE '%' + @search + '%' OR tr.full_name LIKE '%' + @search + '%' OR s.item LIKE '%' + @search + '%' OR s.submission_id LIKE '%' + @search + '%')`;
    if (status && status !== 'All' && status !== 'PRACTICE') subsWhere += ` AND s.validation_status = @status`;
    if (marketId && marketId !== 'all') subsWhere += ` AND s.market_id = @marketId`;
    if (source === 'synthetic') subsWhere += ` AND s.trader_id LIKE 'SYN-TR-%'`;
    if (source === 'real')      subsWhere += ` AND s.trader_id NOT LIKE 'SYN-TR-%'`;

    // Practice_Submissions branch (dbo.Practice_Submissions) — mapped to the same column shape
    let pracWhere = `WHERE 1=1 AND p.created_at >= @dfStart AND p.created_at < @dfEnd`;
    if (search)   pracWhere += ` AND (p.item LIKE '%' + @search + '%' OR p.practice_id LIKE '%' + @search + '%' OR p.trader_phone LIKE '%' + @search + '%')`;
    if (marketId && marketId !== 'all') pracWhere += ` AND p.market_id = @marketId`;

    const subsSelect = `
      SELECT
        s.submission_id, s.trader_id,
        COALESCE(NULLIF(tr.full_name, ''), NULLIF(NULLIF(s.trader_name, '0'), ''),
                 CASE WHEN s.trader_id LIKE 'SYN-TR-%' THEN 'Synthetic' ELSE 'Unknown' END) AS trader_name,
        s.trader_phone,
        CAST(ISNULL(s.reputation_at_submission, 50) AS INT) AS reputation,
        s.market_id, s.market, s.state,
        s.item_id, s.item, s.category, s.unit,
        s.price, s.baseline_price, s.variance_from_baseline,
        s.gps_latitude, s.gps_longitude, s.gps_verified,
        s.distance_from_market,
        s.validation_status, s.status,
        s.fraud_flag, s.fraud_flag_reason,
        s.submitted_at, s.created_at, s.approved_at, s.rejected_at,
        CASE WHEN s.trader_id LIKE 'SYN-TR-%' THEN 1 ELSE 0 END AS isSynthetic,
        CAST(0 AS bit) AS isPractice
      FROM dbo.Submissions s
      LEFT JOIN dbo.Traders_register tr ON tr.trader_id = s.trader_id
      ${subsWhere}`;

    const pracSelect = `
      SELECT
        p.practice_id AS submission_id, p.trader_id,
        COALESCE(NULLIF(tr2.full_name, ''), 'Practice') AS trader_name,
        p.trader_phone,
        CAST(NULL AS INT) AS reputation,
        p.market_id, p.market, p.state,
        p.item_id, p.item, p.category, p.unit,
        p.price, CAST(NULL AS decimal(18,2)) AS baseline_price, CAST(NULL AS decimal(18,2)) AS variance_from_baseline,
        p.gps_latitude, p.gps_longitude, CAST(NULL AS bit) AS gps_verified,
        p.distance_from_market,
        'PRACTICE' AS validation_status, 'PRACTICE' AS status,
        CAST(0 AS bit) AS fraud_flag, p.practice_reason AS fraud_flag_reason,
        p.submitted_at, p.created_at, CAST(NULL AS datetime2) AS approved_at, CAST(NULL AS datetime2) AS rejected_at,
        CAST(0 AS bit) AS isSynthetic,
        CAST(1 AS bit) AS isPractice
      FROM dbo.Practice_Submissions p
      LEFT JOIN dbo.Traders_register tr2 ON tr2.trader_id = p.trader_id
      ${pracWhere}`;

    const branches: string[] = [];
    if (includeSubs)     branches.push(subsSelect);
    if (includePractice) branches.push(pracSelect);
    const combinedSql = branches.length ? branches.join('\n      UNION ALL\n') : `${subsSelect} AND 1=0`;
    const cte = `WITH combined AS (${combinedSql})`;

    const sql = `
      ${cte}
      SELECT * FROM combined ORDER BY created_at DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;

      ${cte}
      SELECT COUNT(*) AS total FROM combined;
    `;

    const params: Record<string, unknown> = { offset, pageSize, dfStart, dfEnd };
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

    const { action, dateRange = 'today' } = await request.json();

    // Sargable UTC day bounds (created_at is an ISO-ish nvarchar; range bounds on
    // the 'YYYY-MM-DD' prefix are index-seekable and correct for both stored formats).
    const pad = (n: number) => String(n).padStart(2, '0');
    const dayStr = (d: Date) =>
      `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const nowUtc = new Date();
    const todayStart     = dayStr(nowUtc);
    const tomorrowStart  = dayStr(new Date(nowUtc.getTime() + 86400000));
    const yesterdayStart = dayStr(new Date(nowUtc.getTime() - 86400000));
    const monthStart     = dayStr(new Date(nowUtc.getTime() - 30 * 86400000));

    // Selected-range lower bound (mirrors GET) so the stat cards track the dropdown.
    let rangeStart = todayStart;
    if (dateRange === 'week')    rangeStart = dayStr(new Date(nowUtc.getTime() -   7 * 86400000));
    if (dateRange === 'month')   rangeStart = dayStr(new Date(nowUtc.getTime() -  30 * 86400000));
    if (dateRange === 'quarter') rangeStart = dayStr(new Date(nowUtc.getTime() -  90 * 86400000));
    if (dateRange === 'year')    rangeStart = dayStr(new Date(nowUtc.getTime() - 365 * 86400000));
    if (dateRange === 'all')     rangeStart = '0001-01-01';

    if (action === 'stats') {
      // Single pass over [cteStart, tomorrow) with conditional aggregation (one
      // index seek, not 11 full scans). cteStart spans the selected range AND
      // yesterday, so the range cards and the "vs yesterday" delta come from one query.
      const cteStart = rangeStart < yesterdayStart ? rangeStart : yesterdayStart;
      const rows = await query<Record<string, unknown>>(`
        WITH ranged AS (
          SELECT created_at, validation_status, trader_id, fraud_flag
          FROM dbo.Submissions
          WHERE created_at >= @cteStart AND created_at < @tomorrowStart
        )
        SELECT
          SUM(CASE WHEN created_at >= @rangeStart THEN 1 ELSE 0 END)                                   AS totalToday,
          SUM(CASE WHEN created_at >= @rangeStart AND validation_status = 'PENDING'  THEN 1 ELSE 0 END) AS pendingReview,
          SUM(CASE WHEN created_at >= @rangeStart AND validation_status = 'APPROVED' THEN 1 ELSE 0 END) AS approvedToday,
          SUM(CASE WHEN created_at >= @rangeStart AND validation_status = 'REJECTED' THEN 1 ELSE 0 END) AS rejectedToday,
          SUM(CASE WHEN created_at >= @rangeStart AND fraud_flag = 1 THEN 1 ELSE 0 END)                 AS fraudFlagged,
          SUM(CASE WHEN created_at >= @rangeStart AND trader_id NOT LIKE 'SYN-TR-%' THEN 1 ELSE 0 END)  AS realToday,
          SUM(CASE WHEN created_at >= @rangeStart AND trader_id LIKE 'SYN-TR-%' THEN 1 ELSE 0 END)      AS syntheticToday,
          SUM(CASE WHEN created_at >= @yesterdayStart AND created_at < @todayStart THEN 1 ELSE 0 END)   AS totalYesterday,
          SUM(CASE WHEN created_at >= @rangeStart AND validation_status = 'APPROVED' THEN 1 ELSE 0 END) AS approvedMonth,
          SUM(CASE WHEN created_at >= @rangeStart AND validation_status = 'PENDING'  THEN 1 ELSE 0 END) AS pendingMonth,
          SUM(CASE WHEN created_at >= @rangeStart AND validation_status = 'REJECTED' THEN 1 ELSE 0 END) AS rejectedMonth
        FROM ranged;
      `, { cteStart, rangeStart, tomorrowStart, yesterdayStart, todayStart });
      const s = rows[0] ?? {};
      const totalToday     = (s.totalToday     as number) ?? 0;
      const totalYesterday = (s.totalYesterday as number) ?? 1;
      const approvalRate   = totalToday > 0 ? Math.round(((s.approvedToday as number ?? 0) / totalToday) * 1000) / 10 : 0;
      const vsYesterday    = totalYesterday > 0 ? Math.round(((totalToday - totalYesterday) / totalYesterday) * 1000) / 10 : 0;
      return NextResponse.json({ success: true, data: { ...s, approvalRate, vsYesterday, dateRange }, timestamp: new Date().toISOString() });
    }

    if (action === 'approve_pending') {
      const affected = await execute(`
        UPDATE dbo.Submissions
        SET validation_status = 'APPROVED', status = 'APPROVED', consensus_result = 'APPROVED',
            approved_at = GETUTCDATE(), updated_at = GETUTCDATE()
        WHERE validation_status = 'PENDING'
          AND created_at >= @todayStart AND created_at < @tomorrowStart
          AND trader_id NOT LIKE 'SYN-TR-%'
      `, { todayStart, tomorrowStart });
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
          ${timestampCol} = GETUTCDATE(),
          updated_at      = GETUTCDATE()
      WHERE submission_id = @submissionId
    `, { status: newStatus, submissionId });

    return NextResponse.json({ success: true, message: `Submission ${newStatus.toLowerCase()}` });

  } catch (error) {
    console.error('[submissions PATCH]', error);
    return NextResponse.json({ success: false, error: 'Failed to update submission' }, { status: 500 });
  }
}
