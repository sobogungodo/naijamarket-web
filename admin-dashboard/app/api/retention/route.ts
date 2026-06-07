import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [t, s30, s7, s1, active, ct, ca, fb] = await Promise.all([
      query<any>(`SELECT COUNT(*) AS n FROM dbo.Traders_register
                  WHERE registration_status='APPROVED' AND is_suspended=0`),
      query<any>(`SELECT COUNT(*) AS n FROM dbo.Submissions
                  WHERE submitted_at >= DATEADD(DAY,-30,GETUTCDATE())
                    AND trader_id NOT LIKE 'SYN-%'`),
      query<any>(`SELECT COUNT(*) AS n FROM dbo.Submissions
                  WHERE submitted_at >= DATEADD(DAY,-7,GETUTCDATE())
                    AND trader_id NOT LIKE 'SYN-%'`),
      query<any>(`SELECT COUNT(*) AS n FROM dbo.Submissions
                  WHERE submitted_at >= DATEADD(DAY,-1,GETUTCDATE())
                    AND trader_id NOT LIKE 'SYN-%'`),
      query<any>(`SELECT COUNT(DISTINCT trader_phone) AS n FROM dbo.Submissions
                  WHERE submitted_at >= DATEADD(DAY,-7,GETUTCDATE())
                    AND trader_id NOT LIKE 'SYN-%'`),
      query<any>(`SELECT COUNT(*) AS n FROM dbo.Consumers
                  WHERE account_status='ACTIVE'`),
      query<any>(`SELECT COUNT(DISTINCT phone_number) AS n
                  FROM dbo.Consumer_Query_Sessions
                  WHERE last_updated >= DATEADD(DAY,-7,GETUTCDATE())`),
      query<any>(`SELECT COUNT(*) AS n FROM dbo.Feedback
                  WHERE created_at >= DATEADD(DAY,-30,GETUTCDATE())`
      ).catch(() => [{ n: 0 }]),
    ])

    return NextResponse.json({
      trader: {
        total:    Number(t[0]?.n      || 0),
        active7d: Number(active[0]?.n || 0),
        subs24h:  Number(s1[0]?.n     || 0),
        subs7d:   Number(s7[0]?.n     || 0),
        subs30d:  Number(s30[0]?.n    || 0),
        d1Rate:   0,
        d7Rate:   0,
        cohortSize: 0,
        note: 'Cohort rates available after index build'
      },
      consumer: {
        total:     Number(ct[0]?.n || 0),
        active7d:  Number(ca[0]?.n || 0),
        queries7d: 0,
        d1Rate:    0,
        cohortSize: 0,
      },
      feedback30d: Number(fb[0]?.n || 0),
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[retention]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
