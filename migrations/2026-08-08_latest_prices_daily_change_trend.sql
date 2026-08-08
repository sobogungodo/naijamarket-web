-- ============================================================================
-- ALTER: usp_Refresh_LatestPrices
-- CHANGE (2026-08-08): compute day-over-day previous_price / price_change_pct /
--   trend in this proc instead of passing through Daily_Prices, where the
--   generator never sets them (trend DEFAULT 'stable', others NULL). This left
--   Latest_Prices_Summary with trend='stable' + price_change_pct NULL for every
--   row -> admin "Live Market Proxy" showed 0.0% rising, and the consumer app's
--   trend arrows were flat everywhere.
--
--   previous_price = most recent prior-day avg_price for that item+market
--   (Daily_Price_Stats, within a 7-day lookback; covers items that skipped a
--   day without a second 90-day scan — items stale >7d fall back to 'stable').
--   trend uses a +/-0.5% dead-band and
--   LOWERCASE 'up'/'down'/'stable' — the consumer app compares trend==='up'
--   case-sensitively, and admin SQL (trend='UP') is case-insensitive collation.
--
--   Everything else (date-anchor, #Today, #Agg, MERGE) is unchanged.
-- ============================================================================
ALTER PROCEDURE dbo.usp_Refresh_LatestPrices AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @start DATETIME2 = SYSDATETIME();
    DECLARE @ms    INT;

    -- ── anchor to latest available data, not the wall clock ────────
    DECLARE @today DATE = (SELECT MAX(price_date) FROM dbo.Daily_Prices WITH (NOLOCK));
    IF @today IS NULL
    BEGIN
        RAISERROR('usp_Refresh_LatestPrices: no data in Daily_Prices — aborting', 0, 1) WITH NOWAIT;
        RETURN;
    END
    DECLARE @d7    DATE = DATEADD(DAY,  -7, @today);
    DECLARE @d30   DATE = DATEADD(DAY, -30, @today);
    DECLARE @d90   DATE = DATEADD(DAY, -90, @today);
    DECLARE @todayStr VARCHAR(10) = CONVERT(VARCHAR(10), @today, 23);
    RAISERROR('usp_Refresh_LatestPrices: anchoring to latest price_date = %s', 0, 1,
        @todayStr) WITH NOWAIT;
    -- ─────────────────────────────────────────────────────────────────────────

    IF OBJECT_ID('tempdb..#Today','U') IS NOT NULL DROP TABLE #Today;

    SELECT
        item_name, item_id, market_name, market_id, state,
        category_id, unit, price_naira, price_date,
        previous_price, price_change_pct, trend,
        confidence_score, data_source
    INTO #Today
    FROM (
        SELECT *,
            ROW_NUMBER() OVER (
                PARTITION BY item_name, market_name
                ORDER BY time_slot DESC
            ) AS rn
        FROM dbo.Daily_Prices WITH (NOLOCK)
        WHERE price_date  = @today
          AND price_naira > 0
    ) t
    WHERE rn = 1;

    CREATE INDEX IX_Today ON #Today (item_name, market_name);
    SET @ms = DATEDIFF(MILLISECOND, @start, SYSDATETIME());
    RAISERROR('#Today built: %d ms', 0, 1, @ms) WITH NOWAIT;

    IF OBJECT_ID('tempdb..#Agg','U') IS NOT NULL DROP TABLE #Agg;

    SELECT
        s.item_name,
        s.market_name,
        MAX(CASE WHEN s.price_date >= @d7  THEN s.max_price END) AS week_high,
        MIN(CASE WHEN s.price_date >= @d7  THEN s.min_price END) AS week_low,
        AVG(CASE WHEN s.price_date >= @d7  THEN s.avg_price END) AS week_avg,
        MAX(CASE WHEN s.price_date >= @d30 THEN s.max_price END) AS month_high,
        MIN(CASE WHEN s.price_date >= @d30 THEN s.min_price END) AS month_low,
        AVG(CASE WHEN s.price_date >= @d30 THEN s.avg_price END) AS month_avg,
        AVG(CASE WHEN s.price_date >= @d90 THEN s.avg_price END) AS quarter_avg,
        MAX(CASE WHEN s.price_date >= @d90 THEN s.max_price END) AS quarter_max,
        MIN(CASE WHEN s.price_date >= @d90 THEN s.min_price END) AS quarter_min
    INTO #Agg
    FROM dbo.Daily_Price_Stats s WITH (NOLOCK)
    JOIN (SELECT DISTINCT item_name, market_name FROM #Today) t
        ON  t.item_name   = s.item_name
        AND t.market_name = s.market_name
    WHERE s.price_date >= @d90
    GROUP BY s.item_name, s.market_name;

    SET @ms = DATEDIFF(MILLISECOND, @start, SYSDATETIME());
    RAISERROR('#Agg built: %d ms', 0, 1, @ms) WITH NOWAIT;

    -- ── NEW: previous-day price per item+market (most recent date strictly
    --    before @today, within a 7-day lookback). Basis for day-over-day
    --    change/trend. Kept to 7 days so this adds only a light scan on top of
    --    #Agg and does not slow the scheduled refresh. ──
    IF OBJECT_ID('tempdb..#Prev','U') IS NOT NULL DROP TABLE #Prev;

    SELECT item_name, market_name, prev_price
    INTO #Prev
    FROM (
        SELECT s.item_name, s.market_name, s.avg_price AS prev_price,
            ROW_NUMBER() OVER (
                PARTITION BY s.item_name, s.market_name
                ORDER BY s.price_date DESC
            ) AS rn
        FROM dbo.Daily_Price_Stats s WITH (NOLOCK)
        JOIN (SELECT DISTINCT item_name, market_name FROM #Today) t
            ON  t.item_name   = s.item_name
            AND t.market_name = s.market_name
        WHERE s.price_date <  @today
          AND s.price_date >= @d7
          AND s.avg_price   > 0
    ) x
    WHERE rn = 1;

    CREATE INDEX IX_Prev ON #Prev (item_name, market_name);
    SET @ms = DATEDIFF(MILLISECOND, @start, SYSDATETIME());
    RAISERROR('#Prev built: %d ms', 0, 1, @ms) WITH NOWAIT;

    MERGE dbo.Latest_Prices_Summary AS tgt
    USING (
        SELECT
            t.item_name, t.item_id, t.market_name, t.market_id, t.state,
            t.category_id,
            CASE t.category_id
                WHEN 'CAT001' THEN 'Staple Foods & Grains'
                WHEN 'CAT002' THEN 'Vegetables & Produce'
                WHEN 'CAT003' THEN 'Oils & Fats'
                WHEN 'CAT004' THEN 'Proteins & Meat'
                WHEN 'CAT005' THEN 'Beverages'
                WHEN 'CAT006' THEN 'Fruits'
                WHEN 'CAT007' THEN 'Spices & Seasonings'
                WHEN 'CAT008' THEN 'Dried & Smoked Fish'
                WHEN 'CAT009' THEN 'Baked Goods'
                WHEN 'CAT010' THEN 'Bread'
                WHEN 'CAT013' THEN 'Dairy'
                WHEN 'CAT014' THEN 'Roots & Tubers'
                WHEN 'CAT015' THEN 'Legumes & Pulses'
                WHEN 'CAT070' THEN 'Animal Feed & Livestock'
                WHEN 'CAT103' THEN 'Frozen Fish'
                ELSE t.category_id
            END AS category_name,
            t.unit, t.price_naira, t.price_date,
            -- ── NEW: computed day-over-day previous_price / change / trend ──
            p.prev_price AS previous_price,
            CASE WHEN p.prev_price > 0
                 THEN CAST((t.price_naira - p.prev_price) / p.prev_price * 100.0 AS DECIMAL(9,4))
                 ELSE NULL END AS price_change_pct,
            CASE WHEN p.prev_price > 0 AND (t.price_naira - p.prev_price) / p.prev_price * 100.0 >  0.5 THEN 'up'
                 WHEN p.prev_price > 0 AND (t.price_naira - p.prev_price) / p.prev_price * 100.0 < -0.5 THEN 'down'
                 ELSE 'stable' END AS trend,
            t.confidence_score, t.data_source,
            a.week_high, a.week_low, a.week_avg,
            a.month_high, a.month_low, a.month_avg,
            CASE WHEN a.month_avg > 0
                THEN CAST((t.price_naira - a.month_avg) / a.month_avg * 100.0 AS DECIMAL(10,4))
                ELSE NULL END AS month_change_pct,
            a.quarter_avg,
            CASE WHEN a.quarter_min > 0
                THEN CAST((a.quarter_max - a.quarter_min) / a.quarter_min * 100.0 AS DECIMAL(10,4))
                ELSE NULL END AS quarter_change_pct
        FROM #Today t
        LEFT JOIN #Agg  a ON a.item_name = t.item_name AND a.market_name = t.market_name
        LEFT JOIN #Prev p ON p.item_name = t.item_name AND p.market_name = t.market_name
    ) AS src ON tgt.item_name = src.item_name AND tgt.market_name = src.market_name
    WHEN MATCHED THEN UPDATE SET
        tgt.item_id            = src.item_id,
        tgt.market_id          = src.market_id,
        tgt.state              = src.state,
        tgt.category_id        = src.category_id,
        tgt.category_name      = src.category_name,
        tgt.unit               = src.unit,
        tgt.price_naira        = src.price_naira,
        tgt.price_date         = src.price_date,
        tgt.previous_price     = src.previous_price,
        tgt.price_change_pct   = src.price_change_pct,
        tgt.trend              = src.trend,
        tgt.confidence_score   = src.confidence_score,
        tgt.data_source        = src.data_source,
        tgt.week_high          = src.week_high,
        tgt.week_low           = src.week_low,
        tgt.week_avg           = src.week_avg,
        tgt.month_high         = src.month_high,
        tgt.month_low          = src.month_low,
        tgt.month_avg          = src.month_avg,
        tgt.month_change_pct   = src.month_change_pct,
        tgt.quarter_avg        = src.quarter_avg,
        tgt.quarter_change_pct = src.quarter_change_pct,
        tgt.last_updated       = SYSDATETIME()
    WHEN NOT MATCHED THEN INSERT (
        item_name, item_id, market_name, market_id, state,
        category_id, category_name, unit,
        price_naira, price_date, previous_price, price_change_pct, trend,
        week_high, week_low, week_avg,
        month_high, month_low, month_avg, month_change_pct,
        quarter_avg, quarter_change_pct,
        confidence_score, data_source, last_updated
    ) VALUES (
        src.item_name, src.item_id, src.market_name, src.market_id, src.state,
        src.category_id, src.category_name, src.unit,
        src.price_naira, src.price_date, src.previous_price, src.price_change_pct, src.trend,
        src.week_high, src.week_low, src.week_avg,
        src.month_high, src.month_low, src.month_avg, src.month_change_pct,
        src.quarter_avg, src.quarter_change_pct,
        src.confidence_score, src.data_source, SYSDATETIME()
    );

    DROP TABLE IF EXISTS #Today;
    DROP TABLE IF EXISTS #Agg;
    DROP TABLE IF EXISTS #Prev;

    DECLARE @cnt INT = (SELECT COUNT(*) FROM dbo.Latest_Prices_Summary);
    SET @ms = DATEDIFF(MILLISECOND, @start, SYSDATETIME());
    RAISERROR('usp_Refresh_LatestPrices DONE: %d rows, %d ms', 0, 1, @cnt, @ms) WITH NOWAIT;
    PRINT 'usp_Refresh_LatestPrices: ' + CAST(@cnt AS VARCHAR) + ' rows in ' + CAST(@ms AS VARCHAR) + 'ms';
END;
