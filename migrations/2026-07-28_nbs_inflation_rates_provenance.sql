-- ============================================================================
-- Migration: NBS_Inflation_Rates provenance columns and verified corrections
-- Date:      2026-07-28
-- Target:    Azure SQL Database  naijafoodmarket-live  dbo.NBS_Inflation_Rates
--
-- This file is a TEXT ARTIFACT. It is NOT executed by the commit that adds it.
-- Run the three sections SEPARATELY, in order, each under the token named in its
-- header. Sections are separated by GO so each is its own batch.
--
--   SECTION A  pre-image backup      requires APPROVE DDL
--   SECTION B  add columns (DDL)     requires APPROVE DDL
--   SECTION C  data corrections (DML) requires APPROVE DB
--
-- Must run as db_owner (AAD admin). The app users naijaapp and vercel_web are
-- db_datareader only and cannot CREATE / ALTER / INSERT / UPDATE this table.
--
-- yoy_inflation and mom_inflation are decimal(10,2) (confirmed pre-flight).
-- ============================================================================


-- ============================================================================
-- SECTION A  --  PRE-IMAGE BACKUP   (requires APPROVE DDL)
-- Snapshots all 125 current rows before any change. Fails closed if a prior
-- snapshot with this name already exists.
-- ============================================================================
DECLARE @err_a nvarchar(200);

IF OBJECT_ID('dbo.z_NBS_Inflation_Rates_preimage_20260728', 'U') IS NOT NULL
BEGIN
    SET @err_a = N'SECTION A: dbo.z_NBS_Inflation_Rates_preimage_20260728 already exists; refusing to overwrite';
    THROW 50000, @err_a, 1;
END;

SELECT *
INTO dbo.z_NBS_Inflation_Rates_preimage_20260728
FROM dbo.NBS_Inflation_Rates;

DECLARE @src_count int = (SELECT COUNT(*) FROM dbo.NBS_Inflation_Rates);
DECLARE @pre_count int = (SELECT COUNT(*) FROM dbo.z_NBS_Inflation_Rates_preimage_20260728);

IF @src_count <> 125 OR @pre_count <> 125
BEGIN
    SET @err_a = N'SECTION A: expected 125 rows in both source and pre-image';
    THROW 50000, @err_a, 1;
END;
GO


-- ============================================================================
-- SECTION B  --  DDL: ADD PROVENANCE COLUMNS   (requires APPROVE DDL)
-- Idempotent: each ADD is guarded by COL_LENGTH so a re-run is a no-op.
-- ============================================================================
IF COL_LENGTH('dbo.NBS_Inflation_Rates', 'mom_inflation') IS NULL
    ALTER TABLE dbo.NBS_Inflation_Rates ADD mom_inflation decimal(10,2) NULL;

IF COL_LENGTH('dbo.NBS_Inflation_Rates', 'data_source') IS NULL
    ALTER TABLE dbo.NBS_Inflation_Rates ADD data_source nvarchar(30) NULL;

IF COL_LENGTH('dbo.NBS_Inflation_Rates', 'source_url') IS NULL
    ALTER TABLE dbo.NBS_Inflation_Rates ADD source_url nvarchar(500) NULL;

IF COL_LENGTH('dbo.NBS_Inflation_Rates', 'published_date') IS NULL
    ALTER TABLE dbo.NBS_Inflation_Rates ADD published_date date NULL;
GO


-- ============================================================================
-- SECTION C  --  DML: VERIFIED CORRECTIONS + PROVENANCE   (requires APPROVE DB)
-- Single explicit transaction, XACT_ABORT ON. Each of the eight rows is its own
-- statement with a @@ROWCOUNT = 1 gate. All values are literals. Do not reorder:
-- the UNRECONCILED backfill uses WHERE data_source IS NULL so it cannot touch the
-- eight rows just stamped.
-- ============================================================================
SET XACT_ABORT ON;
DECLARE @err_c nvarchar(200);

BEGIN TRANSACTION;

-- 2025-06  UPDATE yoy_inflation (mom left NULL)  [Vanguard 2026-07-15]
UPDATE dbo.NBS_Inflation_Rates
SET yoy_inflation  = 25.41,
    data_source    = 'NBS_CPI_SECONDARY',
    source_url     = 'https://www.vanguardngr.com/2026/07/breaking-nigerias-inflation-rate-slows-to-15-91/',
    published_date  = '2026-07-15'
WHERE yr = 2025 AND mth = 6;
IF @@ROWCOUNT <> 1 BEGIN SET @err_c = N'SECTION C: 2025-06 UPDATE did not affect exactly 1 row'; THROW 50000, @err_c, 1; END;

-- 2025-12  UPDATE mom_inflation (yoy unchanged)  [ChampionNews 2026-02-16]
UPDATE dbo.NBS_Inflation_Rates
SET mom_inflation  = -0.36,
    data_source    = 'NBS_CPI_SECONDARY',
    source_url     = 'https://championnews.com.ng/2026/02/16/nigerias-inflation-rate-drops-to-15-1-in-january-nbs/',
    published_date  = '2026-02-16'
WHERE yr = 2025 AND mth = 12;
IF @@ROWCOUNT <> 1 BEGIN SET @err_c = N'SECTION C: 2025-12 UPDATE did not affect exactly 1 row'; THROW 50000, @err_c, 1; END;

-- 2026-01  UPDATE mom_inflation (yoy unchanged)  [ChampionNews 2026-02-16]
UPDATE dbo.NBS_Inflation_Rates
SET mom_inflation  = -6.02,
    data_source    = 'NBS_CPI_SECONDARY',
    source_url     = 'https://championnews.com.ng/2026/02/16/nigerias-inflation-rate-drops-to-15-1-in-january-nbs/',
    published_date  = '2026-02-16'
WHERE yr = 2026 AND mth = 1;
IF @@ROWCOUNT <> 1 BEGIN SET @err_c = N'SECTION C: 2026-01 UPDATE did not affect exactly 1 row'; THROW 50000, @err_c, 1; END;

-- 2026-02  provenance only (yoy unchanged, mom left NULL)  [Punch 2026-05-19]
UPDATE dbo.NBS_Inflation_Rates
SET data_source    = 'NBS_CPI_SECONDARY',
    source_url     = 'https://punchng.com/food-inflation-spikes-above-20-in-11-states/',
    published_date  = '2026-05-19'
WHERE yr = 2026 AND mth = 2;
IF @@ROWCOUNT <> 1 BEGIN SET @err_c = N'SECTION C: 2026-02 UPDATE did not affect exactly 1 row'; THROW 50000, @err_c, 1; END;

-- 2026-03  UPDATE yoy_inflation + mom_inflation (was headline 15.38, food is 14.31)  [Nairametrics 2026-05-18]
UPDATE dbo.NBS_Inflation_Rates
SET yoy_inflation  = 14.31,
    mom_inflation  = 4.17,
    data_source    = 'NBS_CPI_SECONDARY',
    source_url     = 'https://nairametrics.com/2026/05/18/nigerias-food-inflation-surpasses-headline-rate-for-first-time-in-eight-months/',
    published_date  = '2026-05-18'
WHERE yr = 2026 AND mth = 3;
IF @@ROWCOUNT <> 1 BEGIN SET @err_c = N'SECTION C: 2026-03 UPDATE did not affect exactly 1 row'; THROW 50000, @err_c, 1; END;

-- 2026-04  UPDATE mom_inflation (yoy unchanged)  [Nairametrics 2026-05-18]
UPDATE dbo.NBS_Inflation_Rates
SET mom_inflation  = 3.63,
    data_source    = 'NBS_CPI_SECONDARY',
    source_url     = 'https://nairametrics.com/2026/05/18/nigerias-food-inflation-surpasses-headline-rate-for-first-time-in-eight-months/',
    published_date  = '2026-05-18'
WHERE yr = 2026 AND mth = 4;
IF @@ROWCOUNT <> 1 BEGIN SET @err_c = N'SECTION C: 2026-04 UPDATE did not affect exactly 1 row'; THROW 50000, @err_c, 1; END;

-- 2026-05  UPDATE yoy_inflation + mom_inflation + month_name (was 14.80, blank name)  [Vanguard 2026-07-15]
UPDATE dbo.NBS_Inflation_Rates
SET yoy_inflation  = 16.96,
    mom_inflation  = 2.98,
    month_name     = 'May',
    data_source    = 'NBS_CPI_SECONDARY',
    source_url     = 'https://www.vanguardngr.com/2026/07/breaking-nigerias-inflation-rate-slows-to-15-91/',
    published_date  = '2026-07-15'
WHERE yr = 2026 AND mth = 5;
IF @@ROWCOUNT <> 1 BEGIN SET @err_c = N'SECTION C: 2026-05 UPDATE did not affect exactly 1 row'; THROW 50000, @err_c, 1; END;

-- 2026-06  INSERT new row  [Vanguard 2026-07-15]
INSERT INTO dbo.NBS_Inflation_Rates
    (yr, mth, yoy_inflation, month_name, mom_inflation, data_source, source_url, published_date)
VALUES
    (2026, 6, 17.52, 'Jun', 3.75, 'NBS_CPI_SECONDARY',
     'https://www.vanguardngr.com/2026/07/breaking-nigerias-inflation-rate-slows-to-15-91/', '2026-07-15');
IF @@ROWCOUNT <> 1 BEGIN SET @err_c = N'SECTION C: 2026-06 INSERT did not affect exactly 1 row'; THROW 50000, @err_c, 1; END;

-- Backfill the remaining months. IS NULL guard protects the eight rows above.
UPDATE dbo.NBS_Inflation_Rates
SET data_source = 'UNRECONCILED'
WHERE data_source IS NULL;

-- Final gates: 126 total, 8 stamped NBS_CPI_SECONDARY, 118 UNRECONCILED.
DECLARE @total       int = (SELECT COUNT(*) FROM dbo.NBS_Inflation_Rates);
DECLARE @secondary   int = (SELECT COUNT(*) FROM dbo.NBS_Inflation_Rates WHERE data_source = 'NBS_CPI_SECONDARY');
DECLARE @unreconciled int = (SELECT COUNT(*) FROM dbo.NBS_Inflation_Rates WHERE data_source = 'UNRECONCILED');

IF @total <> 126 OR @secondary <> 8 OR @unreconciled <> 118
BEGIN
    SET @err_c = N'SECTION C: final gate failed (expected total=126, secondary=8, unreconciled=118)';
    ROLLBACK TRANSACTION;
    THROW 50000, @err_c, 1;
END;

COMMIT TRANSACTION;
GO


-- ============================================================================
-- READ-BACK (NOT executed by this script). Run manually after SECTION C COMMIT
-- to verify the corrected rows and provenance:
--
-- SELECT yr, mth, yoy_inflation, mom_inflation, month_name,
--        data_source, source_url, published_date
-- FROM dbo.NBS_Inflation_Rates
-- WHERE (yr = 2025 AND mth = 6) OR yr = 2026
-- ORDER BY yr, mth;
-- ============================================================================
