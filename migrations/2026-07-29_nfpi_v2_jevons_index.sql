-- ============================================================================
-- Migration: 2026-07-29_nfpi_v2_jevons_index.sql
-- NFPI v2 -- unweighted Jevons geometric food-price index (base Jun 2018 = 100)
-- over the 29-item frozen NBS-anchored staples basket.
--
-- NOT EXECUTED BY THE COMMIT THAT ADDS THIS FILE.
--   Sections A-C require APPROVE DDL (Section A also seeds 29 rows).
--   Section D requires APPROVE DB (executes usp_Compute_NFPI_v2).
--   Section E is read-only (SELECT only, no token required).
-- Azure SQL. LOG() is natural log. price_naira source type is decimal(18,6).
-- ASCII only.
-- ============================================================================

-- ============================================================================
-- SECTION A -- basket table -- authorising token: APPROVE DDL
-- Frozen basket. 36 full-span non-PACK items, minus ITM01010 (mixed
-- SEG_A/SEG_B) and 6 items with fewer than 24 of 28 anchor months. Do not
-- recompute this filter at runtime - a composition change mid-series creates
-- a spurious index jump.
-- ============================================================================
-- This guard protects creation only. If the table already exists this section is a no-op and the 29-row gate does not run. To change the basket, drop and re-seed under an explicit token.
IF OBJECT_ID('dbo.NFPI_Basket_v2', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.NFPI_Basket_v2 (
        item_id            nvarchar(20)  NOT NULL CONSTRAINT PK_NFPI_Basket_v2 PRIMARY KEY,
        item_name_standard nvarchar(200) NULL,
        added_at           datetime2     NOT NULL CONSTRAINT DF_NFPI_Basket_v2_added_at DEFAULT SYSUTCDATETIME(),
        basket_version     nvarchar(20)  NOT NULL
    );

    INSERT INTO dbo.NFPI_Basket_v2 (item_id, item_name_standard, basket_version)
    SELECT b.item_id,
           (SELECT MAX(p.item_name_standard)
              FROM dbo.Price_History_NBS_v2_national p
             WHERE p.item_id = b.item_id),
           'V2_2026Q3'
    FROM (VALUES
        ('ITM01002'),('ITM01003'),('ITM01004'),('ITM01006'),('ITM01007'),
        ('ITM01008'),('ITM01009'),('ITM01013'),('ITM01014'),('ITM01017'),
        ('ITM01019'),('ITM01020'),('ITM01021'),('ITM01023'),('ITM01024'),
        ('ITM01025'),('ITM01029'),('ITM01030'),('ITM01031'),('ITM01032'),
        ('ITM01035'),('ITM01036'),('ITM01037'),('ITM01038'),('ITM01039'),
        ('ITM01040'),('ITM01041'),('ITM01042'),('ITM01043')
    ) AS b(item_id);

    DECLARE @basket_seed_count int = (SELECT COUNT(*) FROM dbo.NFPI_Basket_v2);
    DECLARE @msgA nvarchar(200);
    IF @basket_seed_count <> 29
    BEGIN
        SET @msgA = N'SECTION A gate failed: NFPI_Basket_v2 expected 29 rows, got '
                    + CAST(@basket_seed_count AS nvarchar(10));
        THROW 50001, @msgA, 1;
    END
END
GO

-- ============================================================================
-- SECTION B -- result table -- authorising token: APPROVE DDL
-- ============================================================================
IF OBJECT_ID('dbo.NFPI_Monthly_v2', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.NFPI_Monthly_v2 (
        observation_month  date          NOT NULL CONSTRAINT PK_NFPI_Monthly_v2 PRIMARY KEY,
        geo_mean           decimal(18,6) NOT NULL,
        index_value        decimal(18,4) NOT NULL,
        mom_change_pct     decimal(10,4) NULL,
        yoy_change_pct     decimal(10,4) NULL,
        items_in_basket    int           NOT NULL,
        month_is_anchored  bit           NOT NULL,
        mom_fully_anchored bit           NOT NULL,
        yoy_fully_anchored bit           NOT NULL,
        base_period        date          NOT NULL,
        method             nvarchar(50)  NOT NULL,
        basket_version     nvarchar(20)  NOT NULL,
        computed_at        datetime2     NOT NULL
    );
END
GO

-- ============================================================================
-- SECTION C -- usp_Compute_NFPI_v2 -- authorising token: APPROVE DDL
-- Note: T-SQL requires CREATE/ALTER PROCEDURE to be the only statement in its
-- batch, so a GO separates the procedure from the trailing GRANT. This is the
-- one structurally mandatory batch separator inside a section.
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.usp_Compute_NFPI_v2
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @msg nvarchar(200);
    DECLARE @base_period date = '2018-06-01';
    DECLARE @basket_version nvarchar(20) = (SELECT TOP 1 basket_version FROM dbo.NFPI_Basket_v2);

    -- Guard 1: basket count = 29
    DECLARE @bcount int = (SELECT COUNT(*) FROM dbo.NFPI_Basket_v2);
    IF @bcount <> 29
    BEGIN
        SET @msg = N'Guard 1 failed: basket count expected 29, got ' + CAST(@bcount AS nvarchar(10));
        THROW 50010, @msg, 1;
    END

    -- Guard 2: no price_naira <= 0 or NULL in the basket source rows
    DECLARE @badprice int = (
        SELECT COUNT(*)
        FROM dbo.Price_History_NBS_v2_national p
        JOIN dbo.NFPI_Basket_v2 b ON b.item_id = p.item_id
        WHERE p.segment = 'MAIN' AND (p.price_naira IS NULL OR p.price_naira <= 0)
    );
    IF @badprice <> 0
    BEGIN
        SET @msg = N'Guard 2 failed: ' + CAST(@badprice AS nvarchar(10)) + N' non-positive or NULL prices';
        THROW 50011, @msg, 1;
    END

    -- Guard 3: every month has exactly 29 basket items
    DECLARE @badmonths int = (
        SELECT COUNT(*) FROM (
            SELECT p.observation_month
            FROM dbo.Price_History_NBS_v2_national p
            JOIN dbo.NFPI_Basket_v2 b ON b.item_id = p.item_id
            WHERE p.segment = 'MAIN'
            GROUP BY p.observation_month
            HAVING COUNT(*) <> 29
        ) x
    );
    IF @badmonths <> 0
    BEGIN
        SET @msg = N'Guard 3 failed: ' + CAST(@badmonths AS nvarchar(10)) + N' months not carrying exactly 29 items';
        THROW 50012, @msg, 1;
    END

    -- Guard 4: base month present
    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Price_History_NBS_v2_national p
        JOIN dbo.NFPI_Basket_v2 b ON b.item_id = p.item_id
        WHERE p.segment = 'MAIN' AND p.observation_month = @base_period
    )
    BEGIN
        SET @msg = N'Guard 4 failed: base month 2018-06-01 not present';
        THROW 50013, @msg, 1;
    END

    -- Guard 5: no duplicate (item_id, observation_month)
    DECLARE @dups int = (
        SELECT COUNT(*) FROM (
            SELECT p.item_id, p.observation_month
            FROM dbo.Price_History_NBS_v2_national p
            JOIN dbo.NFPI_Basket_v2 b ON b.item_id = p.item_id
            WHERE p.segment = 'MAIN'
            GROUP BY p.item_id, p.observation_month
            HAVING COUNT(*) > 1
        ) x
    );
    IF @dups <> 0
    BEGIN
        SET @msg = N'Guard 5 failed: ' + CAST(@dups AS nvarchar(10)) + N' duplicate (item_id, observation_month) pairs';
        THROW 50014, @msg, 1;
    END

    BEGIN TRANSACTION;

    DELETE FROM dbo.NFPI_Monthly_v2;

    ;WITH src AS (
        SELECT p.item_id, p.observation_month, p.price_naira, p.data_source
        FROM dbo.Price_History_NBS_v2_national p
        JOIN dbo.NFPI_Basket_v2 b ON b.item_id = p.item_id
        WHERE p.segment = 'MAIN'
    ),
    gm AS (
        SELECT observation_month,
               EXP(AVG(LOG(price_naira))) AS G,
               COUNT(*) AS items_in_basket,
               -- MIN not MAX: the flag must mean ALL basket items anchored, not any. Identical on current data (all 29 items share the same 28 anchor months); fails safe if the basket changes.
               MIN(CASE WHEN data_source = 'NBS_ANCHOR' THEN 1 ELSE 0 END) AS month_is_anchored
        FROM src
        GROUP BY observation_month
    ),
    base AS (
        SELECT G AS G_base FROM gm WHERE observation_month = @base_period
    ),
    calc AS (
        SELECT g.observation_month, g.G, g.items_in_basket, g.month_is_anchored,
               LAG(g.G, 1)  OVER (ORDER BY g.observation_month) AS G_prev,
               LAG(g.G, 12) OVER (ORDER BY g.observation_month) AS G_yoy,
               LAG(g.month_is_anchored, 1)  OVER (ORDER BY g.observation_month) AS anch_prev,
               LAG(g.month_is_anchored, 12) OVER (ORDER BY g.observation_month) AS anch_yoy
        FROM gm g
    )
    INSERT INTO dbo.NFPI_Monthly_v2 (
        observation_month, geo_mean, index_value, mom_change_pct, yoy_change_pct,
        items_in_basket, month_is_anchored, mom_fully_anchored, yoy_fully_anchored,
        base_period, method, basket_version, computed_at
    )
    SELECT
        c.observation_month,
        CAST(c.G AS decimal(18,6)),
        CAST(100.0 * c.G / (SELECT G_base FROM base) AS decimal(18,4)),
        CASE WHEN c.G_prev IS NOT NULL THEN CAST((c.G / c.G_prev - 1) * 100 AS decimal(10,4)) END,
        CASE WHEN c.G_yoy  IS NOT NULL THEN CAST((c.G / c.G_yoy  - 1) * 100 AS decimal(10,4)) END,
        c.items_in_basket,
        CAST(c.month_is_anchored AS bit),
        CAST(CASE WHEN c.month_is_anchored = 1 AND c.anch_prev = 1 THEN 1 ELSE 0 END AS bit),
        CAST(CASE WHEN c.month_is_anchored = 1 AND c.anch_yoy  = 1 THEN 1 ELSE 0 END AS bit),
        @base_period,
        'JEVONS_UNWEIGHTED',
        @basket_version,
        SYSUTCDATETIME()
    FROM calc c;

    -- Final gate before COMMIT: row count = 96
    DECLARE @rc int = (SELECT COUNT(*) FROM dbo.NFPI_Monthly_v2);
    IF @rc <> 96
    BEGIN
        ROLLBACK TRANSACTION;
        SET @msg = N'Final gate failed: NFPI_Monthly_v2 expected 96 rows, got ' + CAST(@rc AS nvarchar(10));
        THROW 50020, @msg, 1;
    END

    COMMIT TRANSACTION;
END
GO

GRANT EXECUTE ON dbo.usp_Compute_NFPI_v2 TO naijaapp;
GO

-- ============================================================================
-- SECTION D -- execute the computation -- authorising token: APPROVE DB
-- This is the statement that writes 96 rows to dbo.NFPI_Monthly_v2.
-- Run once after Sections A-C. Re-running is safe: the SP DELETEs and
-- repopulates inside one transaction with a 96-row gate.
-- ============================================================================
EXEC dbo.usp_Compute_NFPI_v2;
GO

-- ============================================================================
-- SECTION E -- acceptance verification -- read-only, no token required (SELECT only)
-- Run AFTER Section D has executed. Manual comparison only.
-- ============================================================================
SELECT observation_month, index_value, mom_change_pct, yoy_change_pct, items_in_basket
FROM dbo.NFPI_Monthly_v2
WHERE observation_month IN ('2018-06-01', '2024-12-01', '2025-07-01', '2026-05-01')
ORDER BY observation_month;
-- expected (items_in_basket = 29 on every row):
--   2018-06 -> index_value 100.00
--   2024-12 -> index_value 557.14
--   2025-07 -> index_value 610.34
--   2026-05 -> index_value 554.28, mom_change_pct +2.57, yoy_change_pct -8.92

SELECT COUNT(*) AS total_rows,                                              -- expect 96
       SUM(CASE WHEN yoy_fully_anchored = 1 THEN 1 ELSE 0 END) AS yoy_fully_anchored_rows,  -- expect 12
       SUM(CASE WHEN mom_fully_anchored = 1 THEN 1 ELSE 0 END) AS mom_fully_anchored_rows,  -- expect 20
       SUM(CASE WHEN month_is_anchored  = 1 THEN 1 ELSE 0 END) AS anchored_months,          -- expect 28
       MIN(observation_month) AS first_month,                                               -- expect 2018-06-01
       MAX(observation_month) AS last_month                                                 -- expect 2026-05-01
FROM dbo.NFPI_Monthly_v2;
GO
