import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ADRE floor and ceiling thresholds (per CEO approval memo)
const ADRE_FLOOR = 700
const ADRE_CEILING = 1500
const BREACH_DAYS = 3  // consecutive days required to trigger alert

interface AdreDay {
  cache_date: string
  adre_value: number
  qualified_count: number
  total_credits: number
  floor_breach: boolean
  ceiling_breach: boolean
}

interface AdreToday {
  adre: number
  qualified_reporters: number
  total_credits: number
  floor_breach: boolean
  ceiling_breach: boolean
  consecutive_floor_breaches: number
  consecutive_ceiling_breaches: number
  alert_floor: boolean    // true if 3+ consecutive floor breaches
  alert_ceiling: boolean  // true if 3+ consecutive ceiling breaches
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const rawDate = searchParams.get('date')  // optional: view historical date
    // Validate date format strictly — never interpolate unvalidated user input into SQL
    const dateParam = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : null

    // --- TODAY'S ADRE (always computed live) ---
    // Qualified reporter = >= 5 approved submissions on target WAT date
    // ADRE = SUM(Rewards_Ledger credits for qualified reporters) / COUNT(qualified reporters)
    // submitted_at is NVARCHAR — must TRY_CAST before DATEADD
    // Rewards_Ledger.timestamp is datetime2

    const dateFilter = dateParam
      ? `CAST(DATEADD(HOUR, 1, rl.timestamp) AS DATE) = '${dateParam}'`
      : `CAST(DATEADD(HOUR, 1, rl.timestamp) AS DATE) = CAST(DATEADD(HOUR, 1, GETUTCDATE()) AS DATE)`

    const submissionDateFilter = dateParam
      ? `CAST(DATEADD(HOUR, 1, TRY_CAST(submitted_at AS DATETIME2)) AS DATE) = '${dateParam}'`
      : `CAST(DATEADD(HOUR, 1, TRY_CAST(submitted_at AS DATETIME2)) AS DATE) = CAST(DATEADD(HOUR, 1, GETUTCDATE()) AS DATE)`

    const todayRows = await query<{
      adre: number
      qualified_count: number
      total_credits: number
    }>(`
      WITH qualified AS (
        SELECT trader_phone
        FROM dbo.Submissions
        WHERE validation_status = 'APPROVED'
          AND ${submissionDateFilter}
          AND trader_id NOT LIKE 'SYN-%'
        GROUP BY trader_phone
        HAVING COUNT(*) >= 5
      ),
      credits AS (
        SELECT rl.phone_number, SUM(rl.net_amount) AS reporter_credits
        FROM dbo.Rewards_Ledger rl
        INNER JOIN qualified q ON rl.phone_number = q.trader_phone
        WHERE ${dateFilter}
          AND rl.net_amount > 0
        GROUP BY rl.phone_number
      )
      SELECT
        ISNULL(AVG(reporter_credits), 0)   AS adre,
        COUNT(*)                            AS qualified_count,
        ISNULL(SUM(reporter_credits), 0)   AS total_credits
      FROM credits
    `)

    const todayAdre = todayRows[0]?.adre ?? 0
    const qualifiedCount = todayRows[0]?.qualified_count ?? 0
    const totalCredits = todayRows[0]?.total_credits ?? 0

    const floorBreach = todayAdre < ADRE_FLOOR && qualifiedCount > 0
    const ceilingBreach = todayAdre > ADRE_CEILING

    // Upsert today's value into ADRE_Daily_Cache for sparkline history
    // Only upsert if there are qualified reporters (don't write zero-data days)
    if (qualifiedCount > 0) {
      try {
        await query(`
          MERGE dbo.ADRE_Daily_Cache AS target
          USING (SELECT
            CAST(DATEADD(HOUR, 1, GETUTCDATE()) AS DATE) AS cache_date,
            ${todayAdre} AS adre_value,
            ${qualifiedCount} AS qualified_count,
            ${totalCredits} AS total_credits,
            ${floorBreach ? 1 : 0} AS floor_breach,
            ${ceilingBreach ? 1 : 0} AS ceiling_breach
          ) AS source ON target.cache_date = source.cache_date
          WHEN MATCHED THEN UPDATE SET
            adre_value = source.adre_value,
            qualified_count = source.qualified_count,
            total_credits = source.total_credits,
            floor_breach = source.floor_breach,
            ceiling_breach = source.ceiling_breach,
            computed_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT
            (cache_date, adre_value, qualified_count, total_credits,
             floor_breach, ceiling_breach, source_system)
          VALUES
            (source.cache_date, source.adre_value, source.qualified_count,
             source.total_credits, source.floor_breach, source.ceiling_breach,
             'adre_api');
        `)
      } catch (cacheErr) {
        // Non-fatal — log but never fail the API response over cache write
        console.warn('[/api/rewards/adre] Cache upsert failed (non-fatal):', cacheErr)
      }
    }

    // --- 7-DAY SPARKLINE from cache ---
    const sparklineRows = await query<AdreDay>(`
      SELECT TOP 7
        CAST(cache_date AS NVARCHAR(10)) AS cache_date,
        adre_value,
        qualified_count,
        total_credits,
        floor_breach,
        ceiling_breach
      FROM dbo.ADRE_Daily_Cache
      ORDER BY cache_date DESC
    `)
    // --- CONSECUTIVE BREACH COUNT ---
    // sparklineRows is already DESC (most recent first) from the SQL ORDER BY DESC
    // Do NOT call .reverse() before the breach walk — keep DESC order for lookback
    // Walk from most recent cache day backward, counting unbroken streaks

    let consecutiveFloor = 0
    let consecutiveCeiling = 0

    // sparklineRows is DESC: index 0 = yesterday, index 1 = day before, etc.
    if (floorBreach) {
      for (const day of sparklineRows) {
        if (day.floor_breach) consecutiveFloor++
        else break
      }
    }
    if (ceilingBreach) {
      for (const day of sparklineRows) {
        if (day.ceiling_breach) consecutiveCeiling++
        else break
      }
    }

    // sparkline for chart should be chronological (oldest first)
    const sparkline = [...sparklineRows].reverse()

    const today: AdreToday = {
      adre: Number(todayAdre.toFixed(2)),
      qualified_reporters: qualifiedCount,
      total_credits: Number(totalCredits.toFixed(2)),
      floor_breach: floorBreach,
      ceiling_breach: ceilingBreach,
      consecutive_floor_breaches: consecutiveFloor,
      consecutive_ceiling_breaches: consecutiveCeiling,
      alert_floor: consecutiveFloor >= BREACH_DAYS,
      alert_ceiling: consecutiveCeiling >= BREACH_DAYS,
    }

    return NextResponse.json({
      success: true,
      today,
      sparkline,
      thresholds: { floor: ADRE_FLOOR, ceiling: ADRE_CEILING, breach_days: BREACH_DAYS },
      computed_at: new Date().toISOString(),
    })

  } catch (error) {
    console.error('[/api/rewards/adre] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to compute ADRE' },
      { status: 500 }
    )
  }
}
