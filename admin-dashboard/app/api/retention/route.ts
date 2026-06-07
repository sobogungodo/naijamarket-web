import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const traderStats = await query<any>(`
      SELECT
        COUNT(*)                                                                    AS total_approved,
        SUM(CASE WHEN approved_at >= DATEADD(DAY,-7, GETUTCDATE()) THEN 1 ELSE 0 END) AS new_7d,
        SUM(CASE WHEN approved_at >= DATEADD(DAY,-30,GETUTCDATE()) THEN 1 ELSE 0 END) AS new_30d
      FROM dbo.Traders_register
      WHERE registration_status = 'APPROVED' AND is_suspended = 0
    `)

    const traderActive = await query<any>(`
      SELECT
        COUNT(DISTINCT trader_phone)                                                     AS active_7d,
        SUM(CASE WHEN submitted_at >= DATEADD(DAY,-1, GETUTCDATE()) THEN 1 ELSE 0 END)  AS subs_24h,
        SUM(CASE WHEN submitted_at >= DATEADD(DAY,-7, GETUTCDATE()) THEN 1 ELSE 0 END)  AS subs_7d,
        SUM(CASE WHEN submitted_at >= DATEADD(DAY,-30,GETUTCDATE()) THEN 1 ELSE 0 END)  AS subs_30d,
        COUNT(*)                                                                          AS subs_all
      FROM dbo.Submissions
      WHERE trader_id NOT LIKE 'SYN-%'
        AND submitted_at >= DATEADD(DAY,-7,GETUTCDATE())
    `)

    const traderCohort = await query<any>(`
      WITH first_day AS (
          SELECT trader_phone, CAST(MIN(submitted_at) AS DATE) AS day0
          FROM   dbo.Submissions
          WHERE  trader_id NOT LIKE 'SYN-%'
          GROUP BY trader_phone
      )
      SELECT
          COUNT(*) AS cohort_size,
          SUM(CASE WHEN EXISTS (
              SELECT 1 FROM dbo.Submissions s2
              WHERE  s2.trader_phone = fd.trader_phone
                AND  CAST(s2.submitted_at AS DATE) = DATEADD(DAY,1,fd.day0)
                AND  s2.trader_id NOT LIKE 'SYN-%'
          ) THEN 1 ELSE 0 END) AS d1_retained,
          SUM(CASE WHEN EXISTS (
              SELECT 1 FROM dbo.Submissions s7
              WHERE  s7.trader_phone = fd.trader_phone
                AND  CAST(s7.submitted_at AS DATE)
                         BETWEEN fd.day0 AND DATEADD(DAY,7,fd.day0)
                AND  s7.trader_id NOT LIKE 'SYN-%'
          ) THEN 1 ELSE 0 END) AS d7_retained
      FROM first_day fd
      WHERE fd.day0 <= DATEADD(DAY,-7,CAST(GETUTCDATE() AS DATE))
    `)

    const consumerStats = await query<any>(`
      SELECT COUNT(*) AS total
      FROM dbo.Consumers
      WHERE account_status = 'ACTIVE'
    `)

    const consumerActive = await query<any>(`
      SELECT
        COUNT(DISTINCT phone_number) AS active_7d,
        COUNT(*)                     AS queries_7d
      FROM dbo.Consumer_Query_Sessions
      WHERE last_updated >= DATEADD(DAY,-7,GETUTCDATE())
    `)

    const consumerCohort = await query<any>(`
      WITH first_q AS (
          SELECT phone_number, MIN(last_updated) AS first_query
          FROM   dbo.Consumer_Query_Sessions
          GROUP BY phone_number
      )
      SELECT
          COUNT(*) AS cohort_size,
          SUM(CASE WHEN EXISTS (
              SELECT 1 FROM dbo.Consumer_Query_Sessions s2
              WHERE  s2.phone_number = fq.phone_number
                AND  s2.last_updated >= DATEADD(HOUR,20,fq.first_query)
                AND  s2.last_updated <= DATEADD(DAY,2,fq.first_query)
          ) THEN 1 ELSE 0 END) AS d1_retained
      FROM first_q fq
      WHERE fq.first_query <= DATEADD(DAY,-2,GETUTCDATE())
    `)

    let feedback30d = 0
    try {
      const fb = await query<any>(
        `SELECT COUNT(*) AS total FROM dbo.Feedback
         WHERE created_at >= DATEADD(DAY,-30,GETUTCDATE())`
      )
      feedback30d = Number(fb[0]?.total || 0)
    } catch { /* table may not be visible in admin yet */ }

    const ts = traderStats[0]   || {}
    const ta = traderActive[0]  || {}
    const tc = traderCohort[0]  || {}
    const cs = consumerStats[0] || {}
    const ca = consumerActive[0]|| {}
    const cc = consumerCohort[0]|| {}

    const d1Rate  = tc.cohort_size > 0 ? Math.round((tc.d1_retained / tc.cohort_size) * 100) : 0
    const d7Rate  = tc.cohort_size > 0 ? Math.round((tc.d7_retained / tc.cohort_size) * 100) : 0
    const cd1Rate = cc.cohort_size > 0 ? Math.round((cc.d1_retained / cc.cohort_size) * 100) : 0

    return NextResponse.json({
      trader:      { total:Number(ts.total_approved||0), new7d:Number(ts.new_7d||0), new30d:Number(ts.new_30d||0), active7d:Number(ta.active_7d||0), subs24h:Number(ta.subs_24h||0), subs7d:Number(ta.subs_7d||0), subs30d:Number(ta.subs_30d||0), subsAll:Number(ta.subs_all||0), d1Rate, d7Rate, cohortSize:Number(tc.cohort_size||0) },
      consumer:    { total:Number(cs.total||0), active7d:Number(ca.active_7d||0), queries7d:Number(ca.queries_7d||0), d1Rate:cd1Rate, cohortSize:Number(cc.cohort_size||0) },
      feedback30d,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[retention]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
