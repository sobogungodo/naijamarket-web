import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // ── Trader totals ─────────────────────────────────────────────
    const traderTotals = await query<any>(`
      SELECT COUNT(*) AS total_approved
      FROM dbo.Traders_register
      WHERE registration_status = 'APPROVED'
        AND is_suspended = 0
    `)

    // ── Submission activity (simple counts — fast) ────────────────
    const subActivity = await query<any>(`
      SELECT
        COUNT(DISTINCT trader_phone) AS active_7d,
        SUM(CASE WHEN submitted_at >= DATEADD(DAY,-1, GETUTCDATE()) THEN 1 ELSE 0 END) AS subs_24h,
        SUM(CASE WHEN submitted_at >= DATEADD(DAY,-7, GETUTCDATE()) THEN 1 ELSE 0 END) AS subs_7d,
        SUM(CASE WHEN submitted_at >= DATEADD(DAY,-30,GETUTCDATE()) THEN 1 ELSE 0 END) AS subs_30d,
        COUNT(*) AS subs_all
      FROM dbo.Submissions
      WHERE trader_id NOT LIKE 'SYN-%'
    `)

    // ── D1/D7 retention via GROUP BY (no correlated subqueries) ───
    // Counts traders who submitted across 2+ distinct days (D1)
    // and 4+ distinct days (D7 proxy for sustained engagement)
    const traderCohort = await query<any>(`
      WITH trader_days AS (
          SELECT trader_phone,
                 COUNT(DISTINCT CAST(submitted_at AS DATE)) AS active_days,
                 CAST(MIN(submitted_at) AS DATE)            AS first_day
          FROM   dbo.Submissions
          WHERE  trader_id NOT LIKE 'SYN-%'
          GROUP BY trader_phone
      )
      SELECT
          COUNT(*)                                                    AS cohort_size,
          SUM(CASE WHEN active_days >= 2 THEN 1 ELSE 0 END)          AS d1_retained,
          SUM(CASE WHEN active_days >= 4 THEN 1 ELSE 0 END)          AS d7_retained
      FROM trader_days
      WHERE first_day <= DATEADD(DAY,-7,CAST(GETUTCDATE() AS DATE))
    `)

    // ── Consumer totals ───────────────────────────────────────────
    const consumerTotals = await query<any>(`
      SELECT COUNT(*) AS total
      FROM dbo.Consumers
      WHERE account_status = 'ACTIVE'
    `)

    // ── Consumer session activity ─────────────────────────────────
    const consumerActivity = await query<any>(`
      SELECT
        COUNT(DISTINCT phone_number) AS active_7d,
        COUNT(*)                     AS queries_7d
      FROM dbo.Consumer_Query_Sessions
      WHERE last_updated >= DATEADD(DAY,-7,GETUTCDATE())
    `)

    // ── Consumer D1 retention via GROUP BY ────────────────────────
    const consumerCohort = await query<any>(`
      WITH consumer_sessions AS (
          SELECT phone_number,
                 COUNT(DISTINCT CAST(last_updated AS DATE)) AS active_days,
                 MIN(last_updated) AS first_session
          FROM   dbo.Consumer_Query_Sessions
          GROUP BY phone_number
      )
      SELECT
          COUNT(*)                                           AS cohort_size,
          SUM(CASE WHEN active_days >= 2 THEN 1 ELSE 0 END) AS d1_retained
      FROM consumer_sessions
      WHERE first_session <= DATEADD(DAY,-2,GETUTCDATE())
    `)

    // ── Feedback ──────────────────────────────────────────────────
    let feedback30d = 0
    try {
      const fb = await query<any>(
        `SELECT COUNT(*) AS total FROM dbo.Feedback
         WHERE created_at >= DATEADD(DAY,-30,GETUTCDATE())`
      )
      feedback30d = Number(fb[0]?.total || 0)
    } catch { /* table not visible yet */ }

    const tt = traderTotals[0]    || {}
    const sa = subActivity[0]     || {}
    const tc = traderCohort[0]    || {}
    const ct = consumerTotals[0]  || {}
    const ca = consumerActivity[0]|| {}
    const cc = consumerCohort[0]  || {}

    const d1Rate  = tc.cohort_size > 0 ? Math.round((tc.d1_retained / tc.cohort_size) * 100) : 0
    const d7Rate  = tc.cohort_size > 0 ? Math.round((tc.d7_retained / tc.cohort_size) * 100) : 0
    const cd1Rate = cc.cohort_size > 0 ? Math.round((cc.d1_retained / cc.cohort_size) * 100) : 0

    return NextResponse.json({
      trader: {
        total:      Number(tt.total_approved || 0),
        new7d:      0,
        new30d:     0,
        active7d:   Number(sa.active_7d  || 0),
        subs24h:    Number(sa.subs_24h   || 0),
        subs7d:     Number(sa.subs_7d    || 0),
        subs30d:    Number(sa.subs_30d   || 0),
        subsAll:    Number(sa.subs_all   || 0),
        d1Rate,
        d7Rate,
        cohortSize: Number(tc.cohort_size || 0),
      },
      consumer: {
        total:     Number(ct.total      || 0),
        active7d:  Number(ca.active_7d  || 0),
        queries7d: Number(ca.queries_7d || 0),
        d1Rate:    cd1Rate,
        cohortSize:Number(cc.cohort_size|| 0),
      },
      feedback30d,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[retention]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
