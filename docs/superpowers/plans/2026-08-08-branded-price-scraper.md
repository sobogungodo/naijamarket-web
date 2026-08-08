# Branded Wholesale Price Scraper — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Weekly-scrape current wholesale carton prices for the 17 branded CAT010 items (ITM01044–ITM01060) from Nigerian sites and surface them to consumers via `Daily_Prices → Latest_Prices_Summary`, stamped `WEB_SCRAPE`, without touching the NFPI basket.

**Architecture:** Repurpose the dormant `price_scraper` timer function inside the live `func-naijamarket-scraper` (RUN_FROM_PACKAGE) app. The Python fetches + parses prices (deps already vendored), then calls one `dbo`-owned proc with a JSON param; the proc stages, applies freshness + ±40% gates, MERGEs into `Daily_Prices`, and does a bounded `Latest_Prices_Summary` upsert. All DB writes go through ownership chaining, so `naijaapp` needs only `EXECUTE`.

**Tech Stack:** Python 3 (Azure Functions, vendored `pymssql`/`requests`/`bs4`/`lxml`), T-SQL (Azure SQL, compat 170, `OPENJSON`, `MERGE`), Azure blob RUN_FROM_PACKAGE deploy.

**Spec:** `docs/superpowers/specs/2026-08-08-branded-price-scraper-design.md`

## Global Constraints

- **Production DB** `naijafoodmarket-live` on `naijafood.database.windows.net`, S1 (IO-throttled; S3 only 07:10–10:50 / 13:10–16:50 UTC). Keep queries light; do NOT scan `Daily_Prices` (53M+ rows) unindexed.
- **Every DB change (DDL/DML) and every deploy is gated** — require an explicit literal approval token in the operator's message before executing against prod (`APPROVE DDL`, `APPROVE DB`, `APPROVE DEPLOY`). Write the SQL/build now; execute only when the token is given.
- **Item scope:** exactly ITM01044–ITM01060 (17 items, `Unit='carton'`, CAT010). Never widen.
- **Provenance:** scraped rows use `data_source='WEB_SCRAPE'`, `confidence_score=85`.
- **Gates:** freshness `@max_age_days=120`; outlier `|price−whole_sale_Price|/whole_sale_Price > 0.40` → reject.
- **No bot/CAPTCHA bypass.** If a source returns a challenge page, skip it; never solve or evade it. Respect `robots.txt` + crawl-delay (nigerianprice: 3s).
- **Scraper DB principal** = `naijaapp` (SQL auth via `shared/db.py`), `db_datareader` only. It may only `SELECT` and `EXEC` granted procs. All writes are inside `dbo` procs (ownership chaining).
- **Packaging rule:** build zips with Python `zipfile` (forward-slash paths, `external_attr=0o100644<<16` on changed files); new blob name `scraper-v45.zip`; past-start SAS; flip `WEBSITE_RUN_FROM_PACKAGE` via `--settings @file.json` (no BOM); verify via `/admin/functions` (never `az functionapp function list`). Commit the zip to `deployments/` and recovery source to `branded-scraper/`.
- **Recovery source location:** `naijamarket-web/branded-scraper/` (repo of record). Branch: `feat/branded-price-scraper`.

---

## File Structure

```
naijamarket-web/branded-scraper/
  price_scraper/__init__.py                 # function entrypoint (repurposed stub)
  price_scraper/parse.py                    # pure parsers (unit-tested, no DB/network)
  price_scraper/function.json               # weekly timer schedule
  db/01_Branded_Scrape_Map.sql              # table DDL
  db/02_staging_Branded_Price_Feeds.sql     # staging table DDL
  db/03_usp_Merge_Branded_Scrape_Prices.sql # merge proc + GRANT EXECUTE
  db/04_seed_Branded_Scrape_Map.sql         # 17 nigerianprice rows + inactive rows for other sources
  tests/test_parse.py                       # pytest for parse.py
  tests/fixtures/nigerianprice_titus_sardine.html
  tests/fixtures/nigerianprice_<...>.html   # one fixture per representative item
  scripts/test_merge_proc.ps1               # sandbox-schema proc harness (prod, gated)
  scripts/build_scraper_v45.py              # pull v44 from blob → swap files → v45.zip
  README.md
naijamarket-web/deployments/scraper-v45.zip # built artifact (committed at deploy time)
```

---

## Task 1: Branded scrape map — DDL + seed data

**Files:**
- Create: `branded-scraper/db/01_Branded_Scrape_Map.sql`
- Create: `branded-scraper/db/04_seed_Branded_Scrape_Map.sql`

**Interfaces:**
- Produces: table `dbo.Branded_Scrape_Map(map_id INT IDENTITY PK, item_id NVARCHAR(20), source NVARCHAR(20), fetch_url NVARCHAR(400), pack_count INT, unit_multiplier DECIMAL(10,4), parse_hint NVARCHAR(200), active BIT, notes NVARCHAR(200), created_at DATETIME2)`. Read by `price_scraper/__init__.py`.

- [ ] **Step 1: Write the table DDL**

`branded-scraper/db/01_Branded_Scrape_Map.sql`:
```sql
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
```

- [ ] **Step 2: Research the 17 nigerianprice.com article URLs + carton parse hints**

For each of ITM01044–ITM01060, find the nigerianprice.com carton article and the `<li>` qualifier that denotes a **full carton** matching the item's pack spec. Method (respect 3s crawl-delay):
```bash
UA="Mozilla/5.0 (compatible; NaijaMarketBot/1.0; +price-research)"
for q in "titus sardine carton" "geisha mackerel carton" "exeter corned beef carton" \
         "gino tomato paste sachet carton" "gino tomato tin carton" "tasty tom carton" \
         "de rica tomato carton" "golden penny macaroni carton" "honeywell spaghetti carton" \
         "honeywell noodles carton" "golden penny noodles carton" "minimie noodles carton" \
         "golden morn carton" "nasco cornflakes carton" "checkers custard carton" \
         "heinz baked beans carton" "peeled tomatoes carton"; do
  echo "== $q =="
  curl -s -L -A "$UA" -m 25 "https://nigerianprice.com/?s=$(echo $q | sed 's/ /+/g')" \
    | grep -oiE 'href="https://nigerianprice.com/[a-z0-9-]*(carton|price)[a-z0-9-]*/"' | sort -u | head -3
  sleep 3
done
```
Record the chosen article URL, the full-carton `<li>` qualifier (e.g. `1 Carton`, `50 Pieces`), and `pack_count` per item. Items with no carton article stay unmapped for NGPRICE (map row `active=0`, note "no carton article").

- [ ] **Step 3: Write the seed SQL from the research**

`branded-scraper/db/04_seed_Branded_Scrape_Map.sql` — one row per item for NGPRICE (carton-level ⇒ `unit_multiplier=1.0`), plus **inactive** placeholder rows for WIGMORE/SUPERMART/PRICEPALLY (`active=0`, `fetch_url=''`) so they exist but are never fetched until a follow-up confirms URLs. Example (fill real URLs from Step 2):
```sql
-- Gated: APPROVE DB. Idempotent upsert.
MERGE dbo.Branded_Scrape_Map AS t
USING (VALUES
 ('ITM01044','NGPRICE','https://nigerianprice.com/titus-sardine-carton-prices-in-nigeria/',50,1.0,'1 Carton',1,'50 x 125g'),
 ('ITM01045','NGPRICE','https://nigerianprice.com/geisha-mackerel-...-in-nigeria/',50,1.0,'1 Carton',1,'50 x 155g')
 -- … ITM01046 … ITM01060 (17 NGPRICE rows total)
) AS s(item_id,source,fetch_url,pack_count,unit_multiplier,parse_hint,active,notes)
   ON t.item_id=s.item_id AND t.source=s.source
WHEN MATCHED THEN UPDATE SET t.fetch_url=s.fetch_url, t.pack_count=s.pack_count,
     t.unit_multiplier=s.unit_multiplier, t.parse_hint=s.parse_hint, t.active=s.active, t.notes=s.notes
WHEN NOT MATCHED THEN INSERT (item_id,source,fetch_url,pack_count,unit_multiplier,parse_hint,active,notes)
     VALUES (s.item_id,s.source,s.fetch_url,s.pack_count,s.unit_multiplier,s.parse_hint,s.active,s.notes);
```

- [ ] **Step 4: (gated) Apply DDL + seed to prod and verify**

On `APPROVE DDL`+`APPROVE DB`, run `01_...sql` then `04_...sql` via `scripts/db-connect.ps1`. Verify:
```powershell
. C:/Users/sobog/Documents/naijamarket-trader/scripts/db-connect.ps1; $c=New-DbConn
Invoke-Sql "SELECT source,COUNT(*) n,SUM(CASE WHEN active=1 THEN 1 ELSE 0 END) act FROM dbo.Branded_Scrape_Map GROUP BY source" $c | Format-Table
$c.Close()
```
Expected: `NGPRICE` = 17 rows (active count = number with real carton articles).

- [ ] **Step 5: Commit**
```bash
git add branded-scraper/db/01_Branded_Scrape_Map.sql branded-scraper/db/04_seed_Branded_Scrape_Map.sql
git commit -m "feat(branded-scraper): Branded_Scrape_Map DDL + nigerianprice seed"
```

---

## Task 2: Staging table DDL

**Files:**
- Create: `branded-scraper/db/02_staging_Branded_Price_Feeds.sql`

**Interfaces:**
- Produces: `staging.Branded_Price_Feeds` — written only by the merge proc (Task 4).

- [ ] **Step 1: Write the DDL**
```sql
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
```

- [ ] **Step 2: (gated) Apply + verify**
On `APPROVE DDL`: run it, then `SELECT OBJECT_ID('staging.Branded_Price_Feeds')` returns non-null.

- [ ] **Step 3: Commit**
```bash
git add branded-scraper/db/02_staging_Branded_Price_Feeds.sql
git commit -m "feat(branded-scraper): staging.Branded_Price_Feeds audit table"
```

---

## Task 3: Parser module (pure, TDD)

**Files:**
- Create: `branded-scraper/price_scraper/parse.py`
- Create: `branded-scraper/tests/test_parse.py`
- Create: `branded-scraper/tests/fixtures/nigerianprice_titus_sardine.html` (already captured; copy from scratchpad `titus_sardine.html`)

**Interfaces:**
- Produces:
  - `parse_nigerianprice(html: str, parse_hint: str) -> dict | None` → `{'raw_price': float, 'source_date': 'YYYY-MM-DD'|None, 'excerpt': str}` or `None` if the hint line isn't found.
  - `parse_source(source: str, html: str, parse_hint: str) -> dict | None` → dispatch by source; returns `None` for not-yet-enabled sources (WIGMORE/SUPERMART/PRICEPALLY).
- Consumed by `price_scraper/__init__.py` (Task 5).

- [ ] **Step 1: Set up a local test venv (bs4 not needed — parser is regex-based)**
```bash
cd C:/Users/sobog/naijamarket-web/branded-scraper
python -m venv .venv && . .venv/Scripts/activate && pip install pytest
mkdir -p tests/fixtures
cp "$SCRATCH/titus_sardine.html" tests/fixtures/nigerianprice_titus_sardine.html   # $SCRATCH = session scratchpad
```

- [ ] **Step 2: Write the failing test**

`branded-scraper/tests/test_parse.py`:
```python
import os, pathlib
from price_scraper.parse import parse_nigerianprice, parse_source

FIX = pathlib.Path(__file__).parent / "fixtures"

def _load(name): return (FIX / name).read_text(encoding="utf-8", errors="ignore")

def test_nigerianprice_full_carton_titus_sardine():
    html = _load("nigerianprice_titus_sardine.html")
    r = parse_nigerianprice(html, "1 Carton")
    assert r is not None
    assert r["raw_price"] == 35000.0            # "50 Pieces (1 Carton): From N35,000"
    assert r["source_date"] == "2026-03-04"     # "PRICES LAST UPDATED: MARCH 4, 2026"

def test_nigerianprice_half_carton_hint_picks_different_line():
    html = _load("nigerianprice_titus_sardine.html")
    r = parse_nigerianprice(html, "Half Carton")
    assert r["raw_price"] == 18000.0

def test_nigerianprice_hint_not_found_returns_none():
    assert parse_nigerianprice("<ul><li>nothing here</li></ul>", "1 Carton") is None

def test_parse_source_disabled_sources_return_none():
    assert parse_source("SUPERMART", "<html></html>", "x") is None
    assert parse_source("WIGMORE", "<html></html>", "x") is None
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd branded-scraper && python -m pytest tests/test_parse.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'price_scraper.parse'`.

- [ ] **Step 4: Write the parser**

`branded-scraper/price_scraper/parse.py`:
```python
"""Pure parsers for branded price sources. No network, no DB — unit-testable."""
import re
from datetime import datetime

_PRICE = r'(?:₦|N|NGN|&#8358;)\s?([0-9]{1,3}(?:,[0-9]{3})+)'
_LI = re.compile(r'<li[^>]*>(.*?)</li>', re.I | re.S)
_MONTHS = {m: i for i, m in enumerate(
    ['january','february','march','april','may','june','july','august',
     'september','october','november','december'], start=1)}

def _to_float(s: str) -> float:
    return float(s.replace(',', ''))

def _extract_updated_date(html: str):
    m = re.search(r'PRICES LAST UPDATED[:\s]*([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})', html, re.I)
    if not m:
        return None
    mon = _MONTHS.get(m.group(1).lower())
    if not mon:
        return None
    try:
        return datetime(int(m.group(3)), mon, int(m.group(2))).strftime('%Y-%m-%d')
    except ValueError:
        return None

def parse_nigerianprice(html: str, parse_hint: str):
    """Pick the <li> matching parse_hint (case-insensitive), return its price."""
    hint = (parse_hint or '').lower()
    for li in _LI.finditer(html):
        text = re.sub(r'<[^>]+>', ' ', li.group(1))
        if hint and hint in text.lower():
            pm = re.search(_PRICE, text)
            if pm:
                return {
                    'raw_price': _to_float(pm.group(1)),
                    'source_date': _extract_updated_date(html),
                    'excerpt': ' '.join(text.split())[:280],
                }
    return None

def parse_source(source: str, html: str, parse_hint: str):
    if source == 'NGPRICE':
        return parse_nigerianprice(html, parse_hint)
    # WIGMORE / SUPERMART / PRICEPALLY: not enabled in first ship (map rows active=0).
    return None
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `python -m pytest tests/test_parse.py -v`
Expected: 4 passed.

- [ ] **Step 6: Commit**
```bash
git add branded-scraper/price_scraper/parse.py branded-scraper/tests/
git commit -m "feat(branded-scraper): nigerianprice carton parser + tests"
```

---

## Task 4: Merge proc + sandbox test

**Files:**
- Create: `branded-scraper/db/03_usp_Merge_Branded_Scrape_Prices.sql`
- Create: `branded-scraper/scripts/test_merge_proc.ps1`

**Interfaces:**
- Consumes: `dbo.Branded_Scrape_Map`, `staging.Branded_Price_Feeds`, `dbo.Items_Catalog`, `dbo.Daily_Prices`, `dbo.Latest_Prices_Summary`.
- Produces: `dbo.usp_Merge_Branded_Scrape_Prices(@price_date DATE, @candidates_json NVARCHAR(MAX), @max_age_days INT=120)` returning a per-item status result set; `GRANT EXECUTE … TO naijaapp`.
- JSON contract (from Task 5): array of `{"item_id","source","normalized_price","source_date","raw_excerpt"}`.

- [ ] **Step 1: Write the proc SQL**

`branded-scraper/db/03_usp_Merge_Branded_Scrape_Prices.sql`:
```sql
-- Gated: APPROVE DDL. Merge branded scrape candidates → Daily_Prices (WEB_SCRAPE) + LPS.
CREATE OR ALTER PROCEDURE dbo.usp_Merge_Branded_Scrape_Prices
    @price_date      DATE,
    @candidates_json NVARCHAR(MAX),
    @max_age_days    INT = 120
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;

    -- 1. Shred JSON candidates
    DECLARE @cand TABLE (
        item_id NVARCHAR(20), source NVARCHAR(20),
        normalized_price DECIMAL(18,2), source_date DATE, raw_excerpt NVARCHAR(300));
    INSERT INTO @cand (item_id, source, normalized_price, source_date, raw_excerpt)
    SELECT j.item_id, j.source, j.normalized_price,
           TRY_CONVERT(DATE, j.source_date), j.raw_excerpt
    FROM OPENJSON(@candidates_json)
      WITH (item_id NVARCHAR(20) '$.item_id', source NVARCHAR(20) '$.source',
            normalized_price DECIMAL(18,2) '$.normalized_price',
            source_date NVARCHAR(20) '$.source_date', raw_excerpt NVARCHAR(300) '$.raw_excerpt') j;

    -- 2. Restrict to in-scope branded items only
    DELETE FROM @cand WHERE item_id NOT BETWEEN 'ITM01044' AND 'ITM01060';

    -- 3. Classify each candidate + seed guidance
    DECLARE @classified TABLE (
        item_id NVARCHAR(20), source NVARCHAR(20), normalized_price DECIMAL(18,2),
        source_date DATE, raw_excerpt NVARCHAR(300), seed DECIMAL(18,2),
        status NVARCHAR(12), reject_reason NVARCHAR(120));
    INSERT INTO @classified
    SELECT c.item_id, c.source, c.normalized_price, c.source_date, c.raw_excerpt,
           i.whole_sale_Price,
           CASE
             WHEN c.normalized_price IS NULL OR c.normalized_price <= 0 THEN 'UNPARSED'
             WHEN c.source_date IS NOT NULL
                  AND DATEDIFF(DAY, c.source_date, @price_date) > @max_age_days THEN 'GATED'
             WHEN i.whole_sale_Price > 0
                  AND ABS(c.normalized_price - i.whole_sale_Price)/i.whole_sale_Price > 0.40 THEN 'GATED'
             ELSE 'USED' END,
           CASE
             WHEN c.normalized_price IS NULL OR c.normalized_price <= 0 THEN 'no price parsed'
             WHEN c.source_date IS NOT NULL
                  AND DATEDIFF(DAY, c.source_date, @price_date) > @max_age_days THEN 'STALE'
             WHEN i.whole_sale_Price > 0
                  AND ABS(c.normalized_price - i.whole_sale_Price)/i.whole_sale_Price > 0.40 THEN 'OUTLIER >40%'
             ELSE NULL END
    FROM @cand c
    JOIN dbo.Items_Catalog i ON i.item_id = c.item_id;

    -- 4. Audit ALL candidates
    INSERT INTO staging.Branded_Price_Feeds
        (price_date, source, item_id, normalized_price, source_date, status, reject_reason, raw_excerpt)
    SELECT @price_date, source, item_id, normalized_price, source_date, status, reject_reason, raw_excerpt
    FROM @classified;

    -- 5. Aggregate survivors = MEDIAN of USED per item
    DECLARE @agg TABLE (item_id NVARCHAR(20) PRIMARY KEY, price DECIMAL(18,2));
    ;WITH used AS (
        SELECT item_id, normalized_price,
               ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY normalized_price) rn,
               COUNT(*)     OVER (PARTITION BY item_id) c
        FROM @classified WHERE status='USED')
    INSERT INTO @agg (item_id, price)
    SELECT item_id, AVG(normalized_price)
    FROM used WHERE rn IN ((c+1)/2, (c+2)/2)   -- median (handles even/odd)
    GROUP BY item_id;

    -- 6. Find the latest existing slot for @price_date (must exist to overwrite)
    DECLARE @slot VARCHAR(5) = (
        SELECT MAX(time_slot) FROM dbo.Daily_Prices WHERE price_date = @price_date);
    IF @slot IS NULL
    BEGIN
        RAISERROR('No Daily_Prices slot exists for %s — run after generation. Nothing merged.', 16, 1,
                  CONVERT(VARCHAR(10), @price_date, 120));
        SELECT item_id, status, reject_reason FROM @classified ORDER BY item_id;
        RETURN;
    END

    -- 7. MERGE aggregated price into Daily_Prices for all markets (WEB_SCRAPE)
    MERGE dbo.Daily_Prices AS tgt
    USING (
        SELECT a.item_id, i.item_name, m.market_id, m.market_name, m.state,
               i.category_id, i.Unit, a.price
        FROM @agg a
        JOIN dbo.Items_Catalog i ON i.item_id = a.item_id
        CROSS JOIN dbo.Markets m
    ) AS src
      ON  tgt.price_date = @price_date AND tgt.time_slot = @slot
      AND tgt.item_id = src.item_id AND tgt.market_id = src.market_id
    WHEN MATCHED THEN UPDATE SET
        tgt.price_naira = src.price, tgt.data_source='WEB_SCRAPE',
        tgt.confidence_score=85, tgt.generated_at=SYSDATETIME()
    WHEN NOT MATCHED THEN INSERT
        (item_id,item_name,market_id,market_name,state,category_id,unit,
         price_date,time_slot,time_slot_name,price_naira,data_source,confidence_score,generated_at)
        VALUES (src.item_id,src.item_name,src.market_id,src.market_name,src.state,src.category_id,
                ISNULL(src.Unit,''),@price_date,@slot,'AFTERNOON',src.price,'WEB_SCRAPE',85,SYSDATETIME());

    -- 8. Targeted LPS upsert for the 17 items (bounded — no full refresh)
    MERGE dbo.Latest_Prices_Summary AS tgt
    USING (
        SELECT a.item_id, i.item_name, m.market_id, m.market_name, m.state,
               i.category_id, i.Unit, a.price
        FROM @agg a
        JOIN dbo.Items_Catalog i ON i.item_id = a.item_id
        CROSS JOIN dbo.Markets m
    ) AS src
      ON tgt.item_id = src.item_id AND tgt.market_id = src.market_id
    WHEN MATCHED THEN UPDATE SET
        tgt.price_naira=src.price, tgt.price_date=@price_date, tgt.data_source='WEB_SCRAPE',
        tgt.last_updated=SYSDATETIME()
    WHEN NOT MATCHED THEN INSERT
        (item_id,item_name,market_id,market_name,state,category_id,unit,
         price_naira,price_date,data_source,last_updated)
        VALUES (src.item_id,src.item_name,src.market_id,src.market_name,src.state,src.category_id,
                ISNULL(src.Unit,''),src.price,@price_date,'WEB_SCRAPE',SYSDATETIME());

    -- 9. Per-item outcome
    SELECT item_id, status, reject_reason, normalized_price FROM @classified ORDER BY item_id, source;
END;
GO
GRANT EXECUTE ON dbo.usp_Merge_Branded_Scrape_Prices TO naijaapp;
```
> **Build-time check:** confirm the exact `Latest_Prices_Summary` column names (`price_naira`, `price_date`, `data_source`, `last_updated`) against `INFORMATION_SCHEMA.COLUMNS` before applying; adjust the MERGE column list if they differ. `Daily_Prices` columns are confirmed from `sp_Generate_Daily_Prices`.

- [ ] **Step 2: Write the sandbox test harness (runs against a throwaway schema on prod)**

`branded-scraper/scripts/test_merge_proc.ps1` — mirrors the FRW `frw_test` pattern: create schema `bscrape_test`, clone the 4 dependency tables (structure + minimal rows: the 17 catalog items, a few Markets, one seeded Daily_Prices slot per item/market), load the proc rewritten `dbo.`→`bscrape_test.`, then assert. Scenarios:
1. Fresh in-band candidate → status `USED`, Daily_Prices cell overwritten `WEB_SCRAPE`, LPS upserted.
2. Stale candidate (`source_date` > 120d) → `GATED`/`STALE`, no merge.
3. Outlier (>40% from seed) → `GATED`/`OUTLIER`, no merge.
4. Two sources for one item → median used.
5. No slot for date → RAISERROR path, nothing written.
```powershell
# Skeleton — full asserts filled in during implementation. Gated: APPROVE DB (uses a test schema only).
. C:/Users/sobog/Documents/naijamarket-trader/scripts/db-connect.ps1
$c = New-DbConn
Invoke-Sql "IF SCHEMA_ID('bscrape_test') IS NULL EXEC('CREATE SCHEMA bscrape_test');" $c | Out-Null
# … create bscrape_test.Items_Catalog / Markets / Daily_Prices / Latest_Prices_Summary / staging clone,
#    insert fixtures, load proc into bscrape_test, run each scenario, assert row states, print PASS/FAIL,
#    then DROP the schema objects. …
$c.Close()
```

- [ ] **Step 3: (gated) Run the sandbox harness**
Run: `pwsh branded-scraper/scripts/test_merge_proc.ps1`
Expected: all 5 scenarios print `PASS`; `bscrape_test` cleaned up; **`dbo` tables untouched**.

- [ ] **Step 4: (gated) Apply the real proc to `dbo` + verify grant**
On `APPROVE DDL`: run `03_...sql`. Verify:
```powershell
Invoke-Sql "SELECT OBJECT_ID('dbo.usp_Merge_Branded_Scrape_Prices') pid" $c
Invoke-Sql "SELECT p.permission_name FROM sys.database_permissions p JOIN sys.database_principals pr ON p.grantee_principal_id=pr.principal_id WHERE pr.name='naijaapp' AND p.major_id=OBJECT_ID('dbo.usp_Merge_Branded_Scrape_Prices')" $c
```
Expected: non-null id; `EXECUTE` grant present.

- [ ] **Step 5: Commit**
```bash
git add branded-scraper/db/03_usp_Merge_Branded_Scrape_Prices.sql branded-scraper/scripts/test_merge_proc.ps1
git commit -m "feat(branded-scraper): merge proc (freshness+outlier gate, median, LPS upsert) + sandbox test"
```

---

## Task 5: Function entrypoint (repurpose the stub)

**Files:**
- Create: `branded-scraper/price_scraper/__init__.py`
- Create: `branded-scraper/price_scraper/function.json`

**Interfaces:**
- Consumes: `parse_source` (Task 3); `dbo.Branded_Scrape_Map` (SELECT); `dbo.usp_Merge_Branded_Scrape_Prices` (EXEC); `shared/db.py` `get_connection()`.

- [ ] **Step 1: Write the weekly `function.json`**
```json
{"scriptFile":"__init__.py","bindings":[{"name":"myTimer","type":"timerTrigger","direction":"in","schedule":"0 30 8 * * 1","runOnStartup":false}]}
```
> `0 30 8 * * 1` = Mondays 08:30 UTC — inside the S3 window (07:10–10:50) and after the ~07:30 UTC morning generation slot, so a slot exists to overwrite.

- [ ] **Step 2: Write the entrypoint**

`branded-scraper/price_scraper/__init__.py`:
```python
"""Branded wholesale price scraper (weekly). Repurposed price_scraper stub.
Fetch → parse → hand candidates to dbo.usp_Merge_Branded_Scrape_Prices (all writes in-proc)."""
import json, logging, time
from datetime import datetime, timezone, timedelta
import azure.functions as func
import requests
from shared.db import get_connection
from . import parse as P

UA = "Mozilla/5.0 (compatible; NaijaMarketBot/1.0; +https://naijamarket.ng price-research)"
CRAWL_DELAY = {"NGPRICE": 3, "WIGMORE": 3, "SUPERMART": 2, "PRICEPALLY": 2}

def _wat_today():
    return (datetime.now(timezone.utc) + timedelta(hours=1)).date().isoformat()

def _load_map(conn):
    cur = conn.cursor(as_dict=True)
    cur.execute("SELECT item_id, source, fetch_url, unit_multiplier, parse_hint "
                "FROM dbo.Branded_Scrape_Map WHERE active = 1")
    return cur.fetchall()

def _fetch(url):
    r = requests.get(url, headers={"User-Agent": UA}, timeout=30)
    r.raise_for_status()
    return r.text

def run():
    price_date = _wat_today()
    candidates, stats = [], {"fetched": 0, "parsed": 0, "errors": 0}
    conn = get_connection()
    try:
        rows = _load_map(conn)
        last = {}
        for m in rows:
            src = m["source"]
            delay = CRAWL_DELAY.get(src, 3)
            if src in last:
                gap = time.time() - last[src]
                if gap < delay:
                    time.sleep(delay - gap)
            try:
                html = _fetch(m["fetch_url"]); stats["fetched"] += 1
                last[src] = time.time()
                parsed = P.parse_source(src, html, m["parse_hint"])
                if not parsed:
                    continue
                candidates.append({
                    "item_id": m["item_id"], "source": src,
                    "normalized_price": round(parsed["raw_price"] * float(m["unit_multiplier"]), 2),
                    "source_date": parsed.get("source_date"),
                    "raw_excerpt": parsed.get("excerpt", "")[:280],
                })
                stats["parsed"] += 1
            except Exception as e:
                stats["errors"] += 1
                logging.warning("[branded] %s %s fetch/parse failed: %s", src, m["item_id"], e)

        logging.info("[branded] candidates=%d stats=%s", len(candidates), stats)
        cur = conn.cursor(as_dict=True)
        cur.execute("EXEC dbo.usp_Merge_Branded_Scrape_Prices @price_date=%s, @candidates_json=%s",
                    (price_date, json.dumps(candidates)))
        try:
            outcome = cur.fetchall()
            logging.info("[branded] merge outcome: %s", json.dumps(outcome, default=str))
        except Exception:
            pass
        conn.commit()
    finally:
        conn.close()

def main(myTimer: func.TimerRequest) -> None:
    logging.info("[branded] price_scraper weekly run start")
    try:
        run()
    except Exception as e:
        logging.error("[branded] run failed: %s", e)
    logging.info("[branded] price_scraper weekly run done")
```

- [ ] **Step 3: Static-check the entrypoint compiles**
Run: `python -m py_compile branded-scraper/price_scraper/__init__.py branded-scraper/price_scraper/parse.py`
Expected: no output (exit 0). (Full run needs the Azure runtime + vendored deps; validated live in Task 7.)

- [ ] **Step 4: Commit**
```bash
git add branded-scraper/price_scraper/__init__.py branded-scraper/price_scraper/function.json
git commit -m "feat(branded-scraper): weekly entrypoint (fetch→parse→EXEC merge proc)"
```

---

## Task 6: Build scraper-v45 package

**Files:**
- Create: `branded-scraper/scripts/build_scraper_v45.py`
- Produce: `deployments/scraper-v45.zip`

**Interfaces:**
- Consumes live `scraper-v44.zip` (pulled from blob) + the new `price_scraper/*` files.

- [ ] **Step 1: Pull the live v44 package from blob (base for the diff)**
```bash
# Get the live RUN_FROM_PACKAGE URL and download it as the v44 base.
URL=$(az functionapp config appsettings list -g foodprice -n func-naijamarket-scraper \
      --query "[?name=='WEBSITE_RUN_FROM_PACKAGE'].value" -o tsv)
curl -s -L "$URL" -o "$SCRATCH/scraper-v44-live.zip" -w "HTTP %{http_code} bytes=%{size_download}\n"
```
Expected: HTTP 200, ~9–10 MB.

- [ ] **Step 2: Write the build script (swap only the two `price_scraper` files)**

`branded-scraper/scripts/build_scraper_v45.py`:
```python
import zipfile, sys, os, shutil
BASE = sys.argv[1]      # scraper-v44-live.zip
OUT  = sys.argv[2]      # deployments/scraper-v45.zip
SRC  = sys.argv[3]      # branded-scraper/price_scraper
REPL = {f"price_scraper/{f}": os.path.join(SRC, f) for f in ("__init__.py", "function.json")}
zin = zipfile.ZipFile(BASE)
names = zin.namelist()
assert "price_scraper/__init__.py" in names and "price_scraper/function.json" in names
zout = zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED)
for n in names:
    data = open(REPL[n], "rb").read() if n in REPL else zin.read(n)
    zi = zipfile.ZipInfo(n.replace(os.sep, "/"))
    zi.external_attr = 0o100644 << 16
    zi.compress_type = zipfile.ZIP_DEFLATED
    zout.writestr(zi, data)
zout.close(); zin.close()
# Verify: same count, only the 2 files differ, no backslashes, no root function.json
z = zipfile.ZipFile(OUT); nn = z.namelist()
assert len(nn) == len(names), f"count changed {len(names)}->{len(nn)}"
assert not any("\\" in x for x in nn), "backslash path present"
assert "function.json" not in nn, "root function.json present"
print(f"OK v45: {len(nn)} entries, price_scraper/__init__.py {z.getinfo('price_scraper/__init__.py').file_size}B")
```

- [ ] **Step 3: Build + verify the diff vs v44**
```bash
python branded-scraper/scripts/build_scraper_v45.py "$SCRATCH/scraper-v44-live.zip" \
       deployments/scraper-v45.zip branded-scraper/price_scraper
python - <<'PY'
import zipfile
a=zipfile.ZipFile("/tmp/scraper-v44-live.zip"); b=zipfile.ZipFile("deployments/scraper-v45.zip")
da={n:a.read(n) for n in a.namelist()}; db={n:b.read(n) for n in b.namelist()}
diff=[n for n in db if da.get(n)!=db[n]]
print("changed entries:", diff)   # expect exactly the two price_scraper files
assert set(diff)=={"price_scraper/__init__.py","price_scraper/function.json"}
print("function.json count:", sum(1 for n in b.namelist() if n.endswith('function.json')))
PY
```
Expected: changed entries = the two `price_scraper` files only; function.json count unchanged (26).

- [ ] **Step 4: Commit the build script (zip committed at deploy time in Task 7)**
```bash
git add branded-scraper/scripts/build_scraper_v45.py
git commit -m "feat(branded-scraper): scraper-v45 build script (repurpose price_scraper)"
```

---

## Task 7: Deploy + first run + verify (gated)

**Files:**
- Modify (Azure): `func-naijamarket-scraper` `WEBSITE_RUN_FROM_PACKAGE`
- Commit: `deployments/scraper-v45.zip`, `branded-scraper/README.md`

**Interfaces:** none downstream — terminal task.

- [ ] **Step 1: (gated) Upload v45 to blob under a NEW name + mint past-start SAS**
On `APPROVE DEPLOY`: upload to `sanaijamarketprod/function-releases/scraper-v45.zip`; mint read SAS with `--start` in the past (e.g. yesterday) / `--expiry` 2027-12-31; `curl --range 0-100 "$SAS"` → expect **206**.

- [ ] **Step 2: (gated) Flip `WEBSITE_RUN_FROM_PACKAGE` via `--settings @file.json` (no BOM) + read-back**
Write the new SAS URL into a no-BOM JSON file, PUT via `az functionapp config appsettings set --settings @file.json`, then read back and assert byte-identical (SAS `&` splitting trap — never inline). Restart the app.

- [ ] **Step 3: Verify all functions still load**
```bash
MK=$(az functionapp keys list -g foodprice -n func-naijamarket-scraper --query masterKey -o tsv)
curl -s -H "x-functions-key: $MK" https://func-naijamarket-scraper.azurewebsites.net/admin/functions | python -c "import sys,json;d=json.load(sys.stdin);print('functions:',len(d))"
```
Expected: same count as before the deploy (26). If 0 → immediately roll back (Step 6).

- [ ] **Step 4: (gated) Trigger one manual run inside the S3 window + confirm consumer surfacing**
On `APPROVE DB` (run touches prod data), invoke the function (admin trigger) or `EXEC` the proc with a freshly-scraped JSON during 07:10–10:50 UTC. Then verify (light queries only):
```powershell
. C:/Users/sobog/Documents/naijamarket-trader/scripts/db-connect.ps1; $c=New-DbConn
Invoke-Sql "SELECT item_id, price_naira, data_source, price_date FROM dbo.Latest_Prices_Summary WHERE item_id BETWEEN 'ITM01044' AND 'ITM01060' ORDER BY item_id" $c | Format-Table
Invoke-Sql "SELECT status, COUNT(*) n FROM staging.Branded_Price_Feeds WHERE price_date=CAST(SYSUTCDATETIME() AS date) GROUP BY status" $c | Format-Table
$c.Close()
```
Expected: `USED` items appear in LPS within their wholesale band, `data_source='WEB_SCRAPE'`; gated items logged with a reason. (Do NOT scan `Daily_Prices` broadly on S1.)

- [ ] **Step 5: Confirm NFPI unaffected**
```powershell
Invoke-Sql "SELECT COUNT(*) branded_in_basket FROM dbo.NFPI_Basket_v2 WHERE item_id BETWEEN 'ITM01044' AND 'ITM01060'" $c
```
Expected: `0`. (NFPI reads the fixed basket only — no code path lets WEB_SCRAPE reach it.)

- [ ] **Step 6: Record rollback + commit artifact**
Rollback = re-flip `WEBSITE_RUN_FROM_PACKAGE` to the v44 SAS (snapshot the pre-flip value in Step 2) + restart. DB objects are additive; leaving them is safe (the proc only runs when the function calls it; set `Branded_Scrape_Map.active=0` to disable scraping without redeploy).
```bash
git add deployments/scraper-v45.zip branded-scraper/README.md
git commit -m "deploy(branded-scraper): scraper-v45 live (weekly branded price scrape → WEB_SCRAPE)"
```

---

## Self-Review

**Spec coverage:**
- §2 live app / repurpose stub → Tasks 5, 6. §3 decisions (wholesale/WEB_SCRAPE/weekly/sources) → Tasks 1,4,5. §4 source feasibility → Task 1 (map), Task 3 (parser). §5 architecture / ownership chaining / JSON param → Tasks 4,5. §6 DB objects → Tasks 1,2,4. §7 provenance/NFPI/±40%/freshness → Task 4 (gates), Task 7 (NFPI check). §8 deploy/rollback → Tasks 6,7. §10 success criteria → Task 7 verification. ✓ No gaps.

**Placeholder scan:** The nigerianprice URLs/hints are produced by Task 1 Step 2 research (method given, not hand-waved); the sandbox harness (Task 4 Step 2) and README are the only skeletoned files — both have explicit scenario lists / content requirements, not "TBD". LPS column names flagged for a build-time confirm (Task 4 note) rather than assumed. Acceptable.

**Type consistency:** JSON contract `{item_id, source, normalized_price, source_date, raw_excerpt}` is identical in Task 5 (producer) and Task 4 Step 1 `OPENJSON WITH` (consumer). `parse_source`/`parse_nigerianprice` signatures match between Task 3 and Task 5. Proc name identical across Tasks 4, 5, 7. ✓
