import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// ============================================
// AUDIT LOG API
// GET /api/audit?type=all|consumers|traders|validators
//              &page=1&limit=50&search=&from=&to=
// Queries confirmed live tables:
//   Consumers, Consumer_Query_Sessions
//   Traders_register, Submissions
//   Validators, Validator_Votes
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type    = searchParams.get('type')   || 'all';
  const page    = Math.max(1, parseInt(searchParams.get('page')  || '1'));
  const limit   = Math.min(100, parseInt(searchParams.get('limit') || '50'));
  const search  = searchParams.get('search') || '';
  const from    = searchParams.get('from')   || '';
  const to      = searchParams.get('to')     || '';
  const offset  = (page - 1) * limit;

  const dateFilter = (col: string) => {
    let f = '';
    if (from) f += ` AND ${col} >= '${from}'`;
    if (to)   f += ` AND ${col} <= '${to} 23:59:59'`;
    return f;
  };

  try {
    let consumerLogs: any[] = [];
    let traderLogs:   any[] = [];
    let validatorLogs: any[] = [];
    let totalConsumers = 0, totalTraders = 0, totalValidators = 0;

    // ── CONSUMER AUDIT ─────────────────────────────────────────────────────
    if (type === 'all' || type === 'consumers') {
      const searchClause = search
        ? `AND (c.phone LIKE '%${search}%' OR c.name LIKE '%${search}%' OR s.current_step LIKE '%${search}%')`
        : '';

      const countResult = await query<any>(`
        SELECT COUNT(*) AS cnt
        FROM dbo.Consumer_Query_Sessions s
        LEFT JOIN dbo.Consumers c ON c.phone = s.phone_number
        WHERE 1=1 ${searchClause} ${dateFilter('s.created_at')}
      `);
      totalConsumers = countResult[0]?.cnt || 0;

      if (type === 'consumers' || type === 'all') {
        consumerLogs = await query<any>(`
          SELECT
            s.session_id,
            s.phone_number,
            ISNULL(c.full_name, ISNULL(c.first_name, 'Unknown')) AS consumer_name,
            ISNULL(c.subscription_tier, 'FREE') AS subscription_tier,
            s.session_status,
            s.current_step,
            s.selected_item,
            s.selected_market,
            s.selected_state,
            s.query_completed,
            s.preferred_language,
            s.created_at,
            s.last_updated,
            s.expires_at,
            'consumer_session' AS log_type
          FROM dbo.Consumer_Query_Sessions s
          LEFT JOIN dbo.Consumers c ON c.phone = s.phone_number
          WHERE 1=1 ${searchClause} ${dateFilter('s.created_at')}
          ORDER BY s.created_at DESC
          OFFSET ${offset} ROWS FETCH NEXT ${type === 'all' ? 20 : limit} ROWS ONLY
        `);
      }
    }

    // ── TRADER AUDIT ────────────────────────────────────────────────────────
    if (type === 'all' || type === 'traders') {
      const searchClause = search
        ? `AND (t.trader_name LIKE '%${search}%' OR t.trader_phone LIKE '%${search}%' OR s.item LIKE '%${search}%' OR s.market LIKE '%${search}%')`
        : '';

      const countResult = await query<any>(`
        SELECT COUNT(*) AS cnt
        FROM dbo.Submissions s
        JOIN dbo.Traders_register t ON t.trader_id = s.trader_id
        WHERE 1=1 ${searchClause} ${dateFilter('s.submitted_at')}
      `);
      totalTraders = countResult[0]?.cnt || 0;

      if (type === 'traders' || type === 'all') {
        traderLogs = await query<any>(`
          SELECT
            s.submission_id,
            s.trader_id,
            s.trader_name,
            s.trader_phone,
            t.reputation AS reputation_score,
            t.registration_status AS trader_status,
            s.market,
            s.market_id,
            s.state,
            s.item,
            s.category,
            s.unit,
            s.price,
            s.validation_status,
            NULL AS submission_status,
            s.fraud_flag,
            s.fraud_flag_reason,
            s.variance_from_baseline,
            s.gps_verified,
            s.distance_from_market,
            s.submitted_at,
            'trader_submission' AS log_type
          FROM dbo.Submissions s
          JOIN dbo.Traders_register t ON t.trader_id = s.trader_id
          WHERE 1=1 ${searchClause} ${dateFilter('s.submitted_at')}
          ORDER BY s.submitted_at DESC
          OFFSET ${offset} ROWS FETCH NEXT ${type === 'all' ? 20 : limit} ROWS ONLY
        `);
      }
    }

    // ── VALIDATOR AUDIT ─────────────────────────────────────────────────────
    if (type === 'all' || type === 'validators') {
      const searchClause = search
        ? `AND (v.validator_name LIKE '%${search}%' OR vv.validator_phone LIKE '%${search}%' OR vv.item LIKE '%${search}%')`
        : '';

      const countResult = await query<any>(`
        SELECT COUNT(*) AS cnt
        FROM dbo.Validator_Votes vv
        LEFT JOIN dbo.Validators v ON v.validator_id = vv.validator_id
        WHERE 1=1 ${searchClause} ${dateFilter('vv.created_at')}
      `);
      totalValidators = countResult[0]?.cnt || 0;

      if (type === 'validators' || type === 'all') {
        validatorLogs = await query<any>(`
          SELECT
            vv.vote_id,
            vv.submission_id,
            vv.validator_id,
            vv.validator_name,
            vv.validator_phone,
            ISNULL(v.accuracy_score, 0) AS accuracy_score,
            ISNULL(v.status, 'unknown') AS validator_status,
            vv.market,
            vv.item,
            vv.vote,
            vv.vote_reason,
            vv.vote_confidence,
            vv.trader_submitted_price,
            vv.variance_percent,
            vv.consensus_result,
            vv.agreed_with_consensus,
            vv.reward_earned,
            vv.is_honeypot,
            vv.honeypot_result,
            vv.gps_verified,
            vv.status AS vote_status,
            vv.voted_at,
            vv.created_at,
            'validator_vote' AS log_type
          FROM dbo.Validator_Votes vv
          LEFT JOIN dbo.Validators v ON v.validator_id = vv.validator_id
          WHERE 1=1 ${searchClause} ${dateFilter('vv.created_at')}
          ORDER BY vv.created_at DESC
          OFFSET ${offset} ROWS FETCH NEXT ${type === 'all' ? 20 : limit} ROWS ONLY
        `);
      }
    }

    // ── SUMMARY STATS ───────────────────────────────────────────────────────
    const stats = await query<any>(`
      SELECT
        (SELECT COUNT(*) FROM dbo.Consumer_Query_Sessions
         WHERE created_at >= DATEADD(day, -1, GETUTCDATE())) AS consumer_sessions_24h,
        (SELECT COUNT(*) FROM dbo.Submissions
         WHERE submitted_at >= DATEADD(day, -1, GETUTCDATE())) AS submissions_24h,
        (SELECT COUNT(*) FROM dbo.Validator_Votes
         WHERE created_at >= DATEADD(day, -1, GETUTCDATE())) AS votes_24h,
        (SELECT COUNT(*) FROM dbo.Submissions
         WHERE fraud_flag = 1
           AND submitted_at >= DATEADD(day, -1, GETUTCDATE())) AS fraud_flags_24h,
        (SELECT COUNT(*) FROM dbo.Validator_Votes
         WHERE is_honeypot = '1'
           AND created_at >= DATEADD(day, -1, GETUTCDATE())) AS honeypot_catches_24h
    `);

    return NextResponse.json({
      success: true,
      data: {
        stats: stats[0] || {},
        consumers: {
          logs: consumerLogs,
          total: totalConsumers,
          page,
          limit,
          pages: Math.ceil(totalConsumers / limit),
        },
        traders: {
          logs: traderLogs,
          total: totalTraders,
          page,
          limit,
          pages: Math.ceil(totalTraders / limit),
        },
        validators: {
          logs: validatorLogs,
          total: totalValidators,
          page,
          limit,
          pages: Math.ceil(totalValidators / limit),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Audit API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
