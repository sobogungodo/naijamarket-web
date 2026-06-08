import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [t, s, active, cohort, ct, ca, cc, fb] = await Promise.all([

      // Trader totals
      query<any>(`SELECT COUNT(*) AS n FROM dbo.Traders_register
                  WHERE registration_status='APPROVED' AND is_suspended=0`),

      // Submission counts — windowed, uses new index
      query<any>(`
        SELECT
          SUM(CASE WHEN submitted_at >= DATEADD(DAY,-1, GETUTCDATE()) THEN 1 ELSE 0 END) AS s24h,
          SUM(CASE WHEN submitted_at >= DATEADD(DAY,-7, GETUTCDATE()) THEN 1 ELSE 0 END) AS s7d,
          SUM(CASE WHEN submitted_at >= DATEADD(DAY,-30,GETUTCDATE()) THEN 1 ELSE 0 END) AS s30d,
          COUNT(*) AS s90d
        FROM dbo.Submissions
        WHERE submitted_at >= DATEADD(DAY,-90,GETUTCDATE())
          AND trader_id NOT LIKE 'SYN-%'`),

      // Active traders (7d)
      query<any>(`
        SELECT COUNT(DISTINCT trader_phone) AS n
        FROM dbo.Submissions
        WHERE submitted_at >= DATEADD(DAY,-7,GETUTCDATE())
          AND trader_id NOT LIKE 'SYN-%'`),

      // D1/D7 cohort — traders from last 60d with index support
      query<any>(`
        WITH trader_days AS (
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
        FROM trader_days`),

      // Consumer totals
      query<any>(`SELECT COUNT(*) AS n FROM dbo.Consumers
                  WHERE account_status='ACTIVE'`),

      // Consumer active (7d)
      query<any>(`
        SELECT COUNT(DISTINCT phone_number) AS active_7d,
               COUNT(*) AS queries_7d
        FROM dbo.Consumer_Query_Sessions
        WHERE last_updated >= DATEADD(DAY,-7,GETUTCDATE())`),

      // Consumer D1 cohort (30d window)
      query<any>(`
        WITH consumer_days AS (
          SELECT phone_number,
                 COUNT(DISTINCT CAST(last_updated AS DATE)) AS active_days
          FROM   dbo.Consumer_Query_Sessions
          WHERE  last_updated >= DATEADD(DAY,-30,GETUTCDATE())
          GROUP BY phone_number
        )
        SELECT
          COUNT(*)                                           AS cohort_size,
          SUM(CASE WHEN active_days >= 2 THEN 1 ELSE 0 END) AS d1_retained
        FROM consumer_days`),

      // Feedback
      query<any>(`SELECT COUNT(*) AS n FROM dbo.Feedback
                  WHERE created_at >= DATEADD(DAY,-30,GETUTCDATE())`)
        .catch(() => [{ n: 0 }]),
    ])

    const tc = cohort[0] || {}
    const cc = cc_row => cc_row || {}
    const ccr = cc(cc[0])

    const d1Rate  = tc.cohort_size > 0 ? Math.round((tc.d1_retained / tc.cohort_size) * 100) : 0
    const d7Rate  = tc.cohort_size > 0 ? Math.round((tc.d7_retained / tc.cohort_size) * 100) : 0
    const cd1Rate = ccr.cohort_size > 0 ? Math.round((ccr.d1_retained / ccr.cohort_size) * 100) : 0

    return NextResponse.json({
      trader: {
        total:      Number(t[0]?.n      || 0),
        active7d:   Number(active[0]?.n || 0),
        subs24h:    Number(s[0]?.s24h   || 0),
        subs7d:     Number(s[0]?.s7d    || 0),
        subs30d:    Number(s[0]?.s30d   || 0),
        subs90d:    Number(s[0]?.s90d   || 0),
        d1Rate,
        d7Rate,
        cohortSize: Number(tc.cohort_size || 0),
      },
      consumer: {
        total:      Number(ct[0]?.n        || 0),
        active7d:   Number(ca[0]?.active_7d || 0),
        queries7d:  Number(ca[0]?.queries_7d || 0),
        d1Rate:     cd1Rate,
        cohortSize: Number(ccr.cohort_size  || 0),
      },
      feedback30d: Number(fb[0]?.n || 0),
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[retention]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
