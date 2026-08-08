-- staging.Branded_Price_Feeds: per-run audit of scrape candidates. Gated: APPROVE DDL
IF SCHEMA_ID('staging') IS NULL EXEC('CREATE SCHEMA staging AUTHORIZATION dbo;');
IF OBJECT_ID('staging.Branded_Price_Feeds','U') IS NULL
BEGIN
    CREATE TABLE staging.Branded_Price_Feeds (
        feed_id          INT IDENTITY(1,1) PRIMARY KEY,
        run_ts           DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        price_date       DATE          NOT NULL,
        source           NVARCHAR(20)  NOT NULL,
        item_id          NVARCHAR(20)  NOT NULL,
        raw_price        DECIMAL(18,2) NULL,
        unit_multiplier  DECIMAL(10,4) NULL,
        normalized_price DECIMAL(18,2) NULL,
        source_date      DATE          NULL,
        status           NVARCHAR(12)  NOT NULL,  -- USED | GATED | UNPARSED | REJECTED
        reject_reason    NVARCHAR(120) NULL,
        raw_excerpt      NVARCHAR(300) NULL
    );
    CREATE INDEX IX_BPF_run ON staging.Branded_Price_Feeds(run_ts);
END
