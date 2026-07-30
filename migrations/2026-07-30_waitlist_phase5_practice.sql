-- Migration: 2026-07-30_waitlist_phase5_practice.sql
-- Phase 5 — waitlist registration + practice mode
-- Authorized: APPROVE DDL + APPROVE DB (advisor via Prof), 2026-07-30
-- Scope: 1 pre-image table, 1 ALTER (4 nullable cols), 1 CREATE, 2 GRANTs. No app/code changes.
-- Target: naijafoodmarket-live @ naijafood.database.windows.net
-- Executed under db_owner (AAD) via System.Data.SqlClient + access token.

SET NOCOUNT ON;

-- Step 2 — Pre-image backup of dbo.Waitlist (expect 7 rows copied)
SELECT * INTO dbo.z_Waitlist_preimage_20260730 FROM dbo.Waitlist;

-- Step 3 — Add 4 nullable columns to dbo.Waitlist.
-- All NULL; the existing writer (func-naijamarket-api waitlist_handler) uses an explicit
-- column list, so these additions are non-breaking.
ALTER TABLE dbo.Waitlist ADD
    state               nvarchar(50)  NULL,
    consent_at          datetime2     NULL,
    consent_version     nvarchar(20)  NULL,
    registration_source nvarchar(30)  NULL;

-- Step 4 — Practice_Submissions: submission-shaped columns ONLY.
-- NO validation_status/status/fraud_flag/baseline_price/variance_from_baseline/
-- reputation_at_submission. This table must NEVER join dbo.Latest_Prices_Summary.
CREATE TABLE dbo.Practice_Submissions (
    practice_id          nvarchar(50)  NOT NULL PRIMARY KEY,
    waitlist_id          nvarchar(50)  NULL,
    trader_id            nvarchar(50)  NULL,
    trader_phone         nvarchar(20)  NOT NULL,
    state                nvarchar(50)  NULL,
    market_id            nvarchar(20)  NULL,
    market               nvarchar(100) NULL,
    category_id          nvarchar(20)  NULL,
    category             nvarchar(100) NULL,
    item_id              nvarchar(20)  NULL,
    item                 nvarchar(200) NULL,
    unit                 nvarchar(50)  NULL,
    price                decimal(18,2) NULL,
    gps_latitude         decimal(10,7) NULL,
    gps_longitude        decimal(10,7) NULL,
    gps_accuracy         decimal(10,2) NULL,
    distance_from_market decimal(18,2) NULL,
    submitted_at         datetime2     NULL,
    created_at           datetime2     NOT NULL DEFAULT sysutcdatetime()
);

-- Step 5 — App login (naijaapp) can read/write the practice table.
GRANT INSERT, SELECT ON dbo.Practice_Submissions TO naijaapp;

-- Step 6 — App login (naijaapp) gains INSERT/SELECT/UPDATE on WhatsApp_Optins.
-- (Missing INSERT was one of two reasons that table is empty; the other is the
--  wa optin.py column-name mismatch, out of scope for this migration.)
GRANT INSERT, SELECT, UPDATE ON dbo.WhatsApp_Optins TO naijaapp;
