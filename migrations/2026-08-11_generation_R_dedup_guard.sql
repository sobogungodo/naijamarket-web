-- ============================================================================
-- ALTER: sp_Generate_Daily_Prices
-- CHANGE (2026-08-11): DEFENSE-IN-DEPTH — dedupe the #R build by (item_id,
--   market_id). Latest_Prices_Summary has NO unique constraint on
--   (item_id, market_id), so usp_Refresh_LatestPrices (which MERGEs on
--   item_name/market_name) can leave duplicate (item_id, market_id) rows after
--   a market/item RENAME. Those duplicates violated the #R PRIMARY KEY and,
--   with SET XACT_ABORT ON, aborted the ENTIRE generation instantly (~0.4s) ->
--   zero Daily_Prices rows. This happened 2026-08-09..08-11 (5 dup rows in
--   market MKT0227 / Gwagwalada Main Market). Picking the freshest row per
--   (item_id, market_id) makes generation robust to any future LPS dup.
--   NOTE: pair this with 2026-08-11_lps_refresh_dedup.sql, which stops LPS
--   from retaining the dupes in the first place.
--   Only the "-- 4. #R" INSERT changed; everything else is identical to live.
-- ============================================================================
ALTER PROCEDURE dbo.sp_Generate_Daily_Prices
    @TargetDate  DATE        = NULL,
    @TimeSlot    VARCHAR(5)  = NULL,
    @DataSource  VARCHAR(30) = 'SYSTEM_GEN',
    @IgnoreWindowGate BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- ------------------------------------------------------------------
    -- CAPACITY WINDOW GATE  (added 2026-07-20)
    -- The DB is on S3 (100 DTU) only during 07:10-11:10 and 13:10-17:10
    -- UTC, via the logic-naijamarket-scale-* Logic Apps. Outside those
    -- windows it sits on S1 (20 DTU), where a ~137k-row slot insert
    -- cannot finish: it times out and rolls back. Repeated watchdog
    -- retries doing exactly that pegged the DB for most of 2026-07-20.
    -- The 20-minute tail buffer avoids starting work the scale-down
    -- would kill mid-flight.
    -- KEEP THESE WINDOWS IN SYNC WITH THE SCALE LOGIC APPS.
    -- Pass @IgnoreWindowGate = 1 to override for a manual run.
    -- ------------------------------------------------------------------
    IF @IgnoreWindowGate = 0
    BEGIN
        DECLARE @NowMinUtc INT =
            DATEPART(HOUR, SYSUTCDATETIME()) * 60 + DATEPART(MINUTE, SYSUTCDATETIME());
        IF NOT ( (@NowMinUtc >= 430 AND @NowMinUtc < 650)      -- 07:10-10:50
              OR (@NowMinUtc >= 790 AND @NowMinUtc < 1010) )   -- 13:10-16:50
        BEGIN
            RAISERROR('SKIPPED by capacity window gate: %d UTC-minutes is outside 07:10-10:50 / 13:10-16:50. Refusing heavy generation on the low tier. Use @IgnoreWindowGate=1 to override.', 16, 1, @NowMinUtc);
            RETURN;
        END
    END

    DECLARE @StartTime DATETIME2(3) = SYSDATETIME();
    DECLARE @WATNow    DATETIME2(3) = DATEADD(HOUR, 1, GETUTCDATE());
    DECLARE @ElapsedMs INT          = 0;

    IF @TargetDate IS NULL
        SET @TargetDate = CAST(@WATNow AS DATE);

    IF @TimeSlot IS NULL
    BEGIN
        DECLARE @WATHour TINYINT = DATEPART(HOUR, @WATNow);
        SET @TimeSlot = CASE
            WHEN @WATHour < 10 THEN '08:30'
            WHEN @WATHour < 13 THEN '11:30'
            ELSE                    '14:30'
        END;
    END

    DECLARE @SlotName VARCHAR(20) = CASE @TimeSlot
        WHEN '08:30' THEN 'MORNING'
        WHEN '09:00' THEN 'MORNING'
        WHEN '11:30' THEN 'MIDDAY'
        WHEN '13:00' THEN 'MIDDAY'
        WHEN '14:30' THEN 'AFTERNOON'
        WHEN '16:00' THEN 'AFTERNOON'
        ELSE               'MORNING'
    END;

    DECLARE @RunLabel VARCHAR(50) = CONCAT('v2.9 | ', @TargetDate, ' | ', @TimeSlot);
    RAISERROR('sp_Generate_Daily_Prices %s -- START', 0, 1, @RunLabel) WITH NOWAIT;

    -- 1. GUARD
    IF EXISTS (
        SELECT 1 FROM dbo.Daily_Prices
        WHERE price_date  = @TargetDate
          AND time_slot   = @TimeSlot
          AND data_source <> 'REAL_ANCHORED'
    )
    BEGIN
        RAISERROR('Slot already generated -- refreshing LPS + submissions then aborting.', 0, 1) WITH NOWAIT;
        BEGIN TRY
            EXEC dbo.usp_Refresh_LatestPrices;
            RAISERROR('usp_Refresh_LatestPrices: complete (guard path)', 0, 1) WITH NOWAIT;
        END TRY
        BEGIN CATCH
            DECLARE @GRErr NVARCHAR(500) = ERROR_MESSAGE();
            RAISERROR('WARNING: usp_Refresh_LatestPrices failed (guard) -- %s', 0, 1, @GRErr) WITH NOWAIT;
        END CATCH
        BEGIN TRY
            EXEC dbo.sp_Generate_Synthetic_Submissions
                @TargetDate = @TargetDate,
                @SlotName   = @SlotName;
            RAISERROR('sp_Generate_Synthetic_Submissions: complete (guard path)', 0, 1) WITH NOWAIT;
        END TRY
        BEGIN CATCH
            DECLARE @GSErr NVARCHAR(500) = ERROR_MESSAGE();
            RAISERROR('WARNING: sp_Generate_Synthetic_Submissions failed (guard) -- %s', 0, 1, @GSErr) WITH NOWAIT;
        END CATCH
        RETURN;
    END

    -- 2. #MF
    CREATE TABLE #MF (
        market_id VARCHAR(10) NOT NULL PRIMARY KEY CLUSTERED,
        mf        DECIMAL(6,4) NOT NULL DEFAULT 1.0
    );
    INSERT INTO #MF (market_id, mf)
    SELECT market_id, 1.0 FROM dbo.Markets;

    -- 3. #SB
    CREATE TABLE #SB (
        cat  VARCHAR(20) NOT NULL PRIMARY KEY CLUSTERED,
        bias DECIMAL(6,4) NOT NULL DEFAULT 1.0
    );
    INSERT INTO #SB (cat, bias)
    SELECT DISTINCT category_id, 1.0
    FROM dbo.Items_Catalog
    WHERE category_id IS NOT NULL
      AND (status = 'ACTIVE' OR status IS NULL);

    -- 4. #R
    CREATE TABLE #R (
        item_id     VARCHAR(20)   NOT NULL,
        market_id   VARCHAR(10)   NOT NULL,
        price_naira DECIMAL(18,2) NOT NULL,
        PRIMARY KEY CLUSTERED (item_id, market_id)
    );
    -- DEFENSE-IN-DEPTH (2026-08-11): dedupe by (item_id, market_id). LPS has no
    -- unique constraint on this pair, so a market/item rename can leave duplicate
    -- rows; without this the duplicate would violate the #R PK and XACT_ABORT
    -- would kill the whole generation. Keep the freshest row per (item_id,
    -- market_id). With no dupes present this is behaviourally identical.
    INSERT INTO #R (item_id, market_id, price_naira)
    SELECT item_id, market_id, price_naira
    FROM (
        SELECT item_id, market_id, price_naira,
               ROW_NUMBER() OVER (
                   PARTITION BY item_id, market_id
                   ORDER BY last_updated DESC, price_date DESC
               ) AS rn
        FROM dbo.Latest_Prices_Summary
        WHERE price_naira IS NOT NULL AND price_naira > 0
    ) x
    WHERE rn = 1;

    DECLARE @RRows INT = @@ROWCOUNT;
    SET @ElapsedMs = DATEDIFF(MILLISECOND, @StartTime, SYSDATETIME());
    RAISERROR('#R built: %d rows  (%d ms)', 0, 1, @RRows, @ElapsedMs) WITH NOWAIT;

    -- 5. Simulation parameters
    DECLARE @MRStrength DECIMAL(4,3) = 0.03;
    DECLARE @NoiseRange DECIMAL(4,3) = 0.015;

    -- 6. VEP: most recent available date, not just today
    DECLARE @VEP_Date DATE;
    SET @VEP_Date = (
        SELECT MAX(price_date)
        FROM dbo.Verified_External_Prices
        WHERE price_date <= @TargetDate
    );
    DECLARE @VEP_Count INT;
    SET @VEP_Count = (
        SELECT COUNT(*)
        FROM dbo.Verified_External_Prices
        WHERE price_date = @VEP_Date
    );
    DECLARE @VEP_DateStr VARCHAR(20);
    SET @VEP_DateStr = ISNULL(CONVERT(VARCHAR(20), @VEP_Date, 120), 'NULL');
    RAISERROR('VEP: most recent date=%s, count=%d', 0, 1, @VEP_DateStr, @VEP_Count) WITH NOWAIT;

    -- 7. #Universe
    CREATE TABLE #Universe (
        item_id          VARCHAR(20)    NOT NULL,
        item_name        NVARCHAR(200)  NOT NULL,
        market_id        VARCHAR(10)    NOT NULL,
        market_name      NVARCHAR(200)  NOT NULL,
        state            NVARCHAR(100)  NOT NULL,
        category_id      VARCHAR(20)    NULL,
        unit             NVARCHAR(50)   NULL,
        whole_sale_price DECIMAL(18,2)  NULL,
        mf               DECIMAL(6,4)   NOT NULL DEFAULT 1.0,
        bias             DECIMAL(6,4)   NOT NULL DEFAULT 1.0,
        ref_price        DECIMAL(18,2)  NULL,
        vep_price        DECIMAL(18,2)  NULL,
        path             CHAR(1)        NULL,
        PRIMARY KEY CLUSTERED (item_id, market_id)
    );

    INSERT INTO #Universe (
        item_id, item_name, market_id, market_name, state,
        category_id, unit, whole_sale_price, mf, bias, ref_price, vep_price
    )
    SELECT
        i.item_id, i.item_name, m.market_id, m.market_name,
        ISNULL(m.state, 'Unknown'),
        i.category_id, i.Unit, i.whole_sale_Price,
        ISNULL(mf.mf,   1.0),
        ISNULL(sb.bias, 1.0),
        r.price_naira,
        vep.price_naira
    FROM      dbo.Items_Catalog  i
    CROSS JOIN dbo.Markets        m
    LEFT JOIN  #MF                mf  ON mf.market_id  = m.market_id
    LEFT JOIN  #SB                sb  ON sb.cat         = i.category_id
    LEFT JOIN  #R                 r   ON r.item_id      = i.item_id
                                     AND r.market_id    = m.market_id
    LEFT JOIN  dbo.Verified_External_Prices vep
                                       ON vep.item_id    = i.item_id
                                      AND vep.state      = m.state
                                      AND vep.market_id  IS NULL
                                      AND vep.price_date = @VEP_Date
    WHERE (i.status = 'ACTIVE' OR i.status IS NULL);

    DECLARE @UniverseRows INT = @@ROWCOUNT;
    SET @ElapsedMs = DATEDIFF(MILLISECOND, @StartTime, SYSDATETIME());
    RAISERROR('#Universe built: %d rows  (%d ms)', 0, 1, @UniverseRows, @ElapsedMs) WITH NOWAIT;

    IF @VEP_Count > 0
        UPDATE #Universe SET path = 'R' WHERE vep_price IS NOT NULL;

    UPDATE #Universe SET path = 'A'
    WHERE path IS NULL AND ref_price IS NOT NULL;

    UPDATE #Universe SET path = 'B'
    WHERE path IS NULL
      AND whole_sale_price IS NOT NULL
      AND whole_sale_price > 0;

    SET @ElapsedMs = DATEDIFF(MILLISECOND, @StartTime, SYSDATETIME());
    RAISERROR('Path assignment complete  (%d ms)', 0, 1, @ElapsedMs) WITH NOWAIT;

    -- 8. PATH R
    DECLARE @PathR_Count INT = 0;
    IF @VEP_Count > 0
    BEGIN
        INSERT INTO dbo.Daily_Prices (
            item_id, item_name, market_id, market_name, state,
            category_id, unit, price_date, time_slot, time_slot_name,
            price_naira, data_source, confidence_score, generated_at
        )
        SELECT
            item_id, item_name, market_id, market_name, state,
            category_id, ISNULL(unit, ''), @TargetDate, @TimeSlot, @SlotName,
            vep_price, 'REAL_ANCHORED', 100, SYSDATETIME()
        FROM #Universe WHERE path = 'R';
        SET @PathR_Count = @@ROWCOUNT;
    END
    SET @ElapsedMs = DATEDIFF(MILLISECOND, @StartTime, SYSDATETIME());
    RAISERROR('PATH R (REAL_ANCHORED):   %d rows  (VEP=%d, %d ms)',
              0, 1, @PathR_Count, @VEP_Count, @ElapsedMs) WITH NOWAIT;

    -- 9. PATH A
    DECLARE @PathA_Count INT = 0;
    INSERT INTO dbo.Daily_Prices (
        item_id, item_name, market_id, market_name, state,
        category_id, unit, price_date, time_slot, time_slot_name,
        price_naira, data_source, confidence_score, generated_at
    )
    SELECT
        item_id, item_name, market_id, market_name, state,
        category_id, ISNULL(unit, ''), @TargetDate, @TimeSlot, @SlotName,
        ROUND(
            ref_price
            + (ISNULL(whole_sale_price, ref_price) * mf * bias - ref_price) * @MRStrength
            + ref_price * @NoiseRange * (2.0 * RAND(CHECKSUM(NEWID())) - 1.0)
        , 2),
        'SIM_TRACKED', 75, SYSDATETIME()
    FROM #Universe WHERE path = 'A';
    SET @PathA_Count = @@ROWCOUNT;
    SET @ElapsedMs   = DATEDIFF(MILLISECOND, @StartTime, SYSDATETIME());
    RAISERROR('PATH A (SIM_TRACKED):     %d rows  (%d ms)',
              0, 1, @PathA_Count, @ElapsedMs) WITH NOWAIT;

    -- 10. PATH B
    DECLARE @PathB_Count INT = 0;
    INSERT INTO dbo.Daily_Prices (
        item_id, item_name, market_id, market_name, state,
        category_id, unit, price_date, time_slot, time_slot_name,
        price_naira, data_source, confidence_score, generated_at
    )
    SELECT
        item_id, item_name, market_id, market_name, state,
        category_id, ISNULL(unit, ''), @TargetDate, @TimeSlot, @SlotName,
        ROUND(
            whole_sale_price * mf * bias
            * (1.0 + @NoiseRange * (2.0 * RAND(CHECKSUM(NEWID())) - 1.0))
        , 2),
        'SIM_BASELINE', 50, SYSDATETIME()
    FROM #Universe WHERE path = 'B';
    SET @PathB_Count = @@ROWCOUNT;
    SET @ElapsedMs   = DATEDIFF(MILLISECOND, @StartTime, SYSDATETIME());
    RAISERROR('PATH B (SIM_BASELINE):    %d rows  (%d ms)',
              0, 1, @PathB_Count, @ElapsedMs) WITH NOWAIT;

    -- 11. Daily_Price_Stats
    MERGE dbo.Daily_Price_Stats AS tgt
    USING (
        SELECT item_name, market_name,
               AVG(price_naira) AS avg_price,
               MAX(price_naira) AS max_price,
               MIN(price_naira) AS min_price
        FROM dbo.Daily_Prices WITH (NOLOCK)
        WHERE price_date  = @TargetDate
          AND time_slot   = @TimeSlot
          AND price_naira > 0
        GROUP BY item_name, market_name
    ) AS src
        ON  tgt.item_name   = src.item_name
        AND tgt.market_name = src.market_name
        AND tgt.price_date  = @TargetDate
    WHEN MATCHED THEN UPDATE SET
        tgt.avg_price = src.avg_price,
        tgt.max_price = src.max_price,
        tgt.min_price = src.min_price
    WHEN NOT MATCHED THEN INSERT (item_name, market_name, price_date, avg_price, max_price, min_price)
    VALUES (src.item_name, src.market_name, @TargetDate, src.avg_price, src.max_price, src.min_price);

    SET @ElapsedMs = DATEDIFF(MILLISECOND, @StartTime, SYSDATETIME());
    RAISERROR('Daily_Price_Stats maintained  (%d ms)', 0, 1, @ElapsedMs) WITH NOWAIT;

    -- 12. Cleanup
    DROP TABLE IF EXISTS #R;
    DROP TABLE IF EXISTS #MF;
    DROP TABLE IF EXISTS #SB;
    DROP TABLE IF EXISTS #Universe;

    -- 13. Synthetic Submissions
    BEGIN TRY
        EXEC dbo.sp_Generate_Synthetic_Submissions
            @TargetDate = @TargetDate,
            @SlotName   = @SlotName;
        RAISERROR('sp_Generate_Synthetic_Submissions: complete', 0, 1) WITH NOWAIT;
    END TRY
    BEGIN CATCH
        DECLARE @SubErr NVARCHAR(500) = ERROR_MESSAGE();
        RAISERROR('WARNING: sp_Generate_Synthetic_Submissions failed -- %s', 0, 1, @SubErr) WITH NOWAIT;
    END CATCH

    -- 14. Summary
    DECLARE @TotalMs   INT = DATEDIFF(MILLISECOND, @StartTime, SYSDATETIME());
    DECLARE @TotalRows INT = @PathR_Count + @PathA_Count + @PathB_Count;
    DECLARE @VEP_DateStr2 VARCHAR(20);
    SET @VEP_DateStr2 = ISNULL(CONVERT(VARCHAR(20), @VEP_Date, 120), 'NULL');

    RAISERROR('===========================================', 0, 1) WITH NOWAIT;
    RAISERROR('COMPLETED %s',                0, 1, @RunLabel)     WITH NOWAIT;
    RAISERROR('VEP date used            : %s', 0, 1, @VEP_DateStr2) WITH NOWAIT;
    RAISERROR('PATH R (REAL_ANCHORED)   : %d', 0, 1, @PathR_Count) WITH NOWAIT;
    RAISERROR('PATH A (SIM_TRACKED)     : %d', 0, 1, @PathA_Count) WITH NOWAIT;
    RAISERROR('PATH B (SIM_BASELINE)    : %d', 0, 1, @PathB_Count) WITH NOWAIT;
    RAISERROR('TOTAL ROWS INSERTED      : %d', 0, 1, @TotalRows)   WITH NOWAIT;
    RAISERROR('LPS ref rows used        : %d', 0, 1, @RRows)       WITH NOWAIT;
    RAISERROR('ELAPSED                  : %d ms', 0, 1, @TotalMs)  WITH NOWAIT;
    RAISERROR('===========================================', 0, 1) WITH NOWAIT;

    SELECT
        @TargetDate   AS price_date,
        @TimeSlot     AS time_slot,
        @SlotName     AS time_slot_name,
        @VEP_DateStr2 AS vep_date_used,
        @PathR_Count  AS path_r_real_anchored,
        @PathA_Count  AS path_a_sim_tracked,
        @PathB_Count  AS path_b_sim_baseline,
        @TotalRows    AS total_rows_inserted,
        @TotalMs      AS elapsed_ms,
        @RRows        AS ref_rows_in_lps,
        @UniverseRows AS universe_rows;
END;


