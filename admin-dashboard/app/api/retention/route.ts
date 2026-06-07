import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// All Submissions queries scoped to last 90 days max
// Submissions table has 4.35M+ rows — full scan always times out
const WINDOW = 90

export async function GET() {
  try {
    // ── Trader totals (Traders_register is small — fast) ──────────
    const traderTotals = await query<any>(`
      SELECT COUNT(*) AS total_approved
      FROM dbo.Traders_register
      WHERE registration_status = 'APPROVED'
        AND is_suspended = 0
    `)

    // ── Submission activity — last 90 days only ───────────────────
    const subActivity = await query<any>(`
      SELECT
        COUNT(DISTINCT trader_phone) AS active_7d_traders,
        SUM(CASE WHEN submitted_at >= DATEADD(DAY,-1, GETUTCDATE()) THEN 1 ELSE 0 END) AS subs_24h,
        SUM(CASE WHEN submitted_at >= DATEADD(DAY,-7, GETUTCDATE()) THEN 1 ELSE 0 END) AS subs_7d,
        SUM(CASE WHEN submitted_at >= DATEADD(DAY,-30,GETUTCDATE()) THEN 1 ELSE 0 END) AS subs_30d,
        COUNT(*) AS subs_90d
      FROM dbo.Submissions
      WHERE submitted_at >= DATEADD(DAY,-${WINDOW},GETUTCDATE())
        AND trader_id NOT LIKE 'SYN-%'
    `)

    // ── D1/D7 cohort — traders from last 60 days only ─────────────
    const traderCohort = await query<any>(`
      WITH recent_traders AS (
          SELECT trader_phone,
                 COUNT(DISTINCT CAST(submitted_at AS DATE)) AS active_days
          FROM   dbo.Submissions
          WHERE  submitted_at >= DATEADD(DAY,-60,GETUTCDATE())
            AND  trader_id NOT LIKE 'SYN-%'
          GROUP BY trader_phone
      )
      SELECT
          COUNT(*)                                           AS cohort_size,
          SUM(CASE WHEN active_days >= 2 THEN 1 ELSE 0 END) AS d1_retained,
          SUM(CASE WHEN active_days >= 5 THEN 1 ELSE 0 END) AS d7_retained
      FROM recent_traders
    `)

    // ── Consumer totals (Consumers is small — fast) ───────────────
    const consumerTotals = await query<any>(`
      SELECT COUNT(*) AS total
      FROM dbo.Consumers
      WHERE account_status = 'ACTIVE'
    `)

    // ── Consumer sessions — last 30 days ──────────────────────────
    const consumerActivity = await query<any>(`
      SELECT
        COUNT(DISTINCT phone_number) AS active_7d,
        COUNT(*)                     AS queries_7d
      FROM dbo.Consumer_Query_Sessions
      WHERE last_updated >= DATEADD(DAY,-7,GETUTCDATE())
    `)

    // ── Consumer D1 — last 30 days ────────────────────────────────
    const consumerCohort = await query<any>(`
      WITH recent_consumers AS (
          SELECT phone_number,
                 COUNT(DISTINCT CAST(last_updated AS DATE)) AS active_days
          FROM   dbo.Consumer_Query_Sessions
          WHERE  last_updated >= DATEADD(DAY,-30,GETUTCDATE())
          GROUP BY phone_number
      )
      SELECT
          COUNT(*)                                           AS cohort_size,
          SUM(CASE WHEN active_days >= 2 THEN 1 ELSE 0 END) AS d1_retained
      FROM recent_consumers
    `)

    // ── Feedback ──────────────────────────────────────────────────
    let feedback30d = 0
    try {
      const fb = await query<any>(
        `SELECT COUNT(*) AS total FROM dbo.Feedback
         WHERE created_at >= DATEADD(DAY,-30,GETUTCDATE())`
      )
      feedback30d = Number(fb[0]?.total || 0)
    } catch { /* ignore */ }

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
        active7d:   Number(sa.active_7d_traders || 0),
        subs24h:    Number(sa.subs_24h  || 0),
        subs7d:     Number(sa.subs_7d   || 0),
        subs30d:    Number(sa.subs_30d  || 0),
        subs90d:    Number(sa.subs_90d  || 0),
        d1Rate,
        d7Rate,
        cohortSize: Number(tc.cohort_size || 0),
      },
      consumer: {
        total:      Number(ct.total      || 0),
        active7d:   Number(ca.active_7d  || 0),
        queries7d:  Number(ca.queries_7d || 0),
        d1Rate:     cd1Rate,
        cohortSize: Number(cc.cohort_size|| 0),
      },
      feedback30d,
      window_days: WINDOW,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[retention]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
