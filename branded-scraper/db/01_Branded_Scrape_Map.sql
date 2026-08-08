-- Branded_Scrape_Map: data-driven (item_id, source) → fetch + parse config.
-- Gated: APPROVE DDL
IF OBJECT_ID('dbo.Branded_Scrape_Map','U') IS NULL
BEGIN
    CREATE TABLE dbo.Branded_Scrape_Map (
        map_id          INT IDENTITY(1,1) PRIMARY KEY,
        item_id         NVARCHAR(20)  NOT NULL,
        source          NVARCHAR(20)  NOT NULL,   -- NGPRICE | WIGMORE | SUPERMART | PRICEPALLY
        fetch_url       NVARCHAR(400) NOT NULL,
        pack_count      INT           NULL,        -- units per carton (documentation)
        unit_multiplier DECIMAL(10,4) NOT NULL DEFAULT 1.0, -- raw_price × this = carton wholesale
        parse_hint      NVARCHAR(200) NULL,        -- regex/text to pick the right line
        active          BIT           NOT NULL DEFAULT 1,
        notes           NVARCHAR(200) NULL,
        created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Branded_Scrape_Map UNIQUE (item_id, source)
    );
END
