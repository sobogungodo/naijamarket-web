# Branded Wholesale Price Scraper — Design

**Date:** 2026-08-08
**Status:** Approved (design), pending implementation plan
**Repo of record:** `naijamarket-web` (scraper recovery source + committed deployment zips live here)
**Author:** design session 2026-08-08

---

## 1. Problem & goal

On 2026-08-08 a prior session unhid CAT005 "Drinks" and inserted 17 new **branded processed-food**
items into `dbo.Items_Catalog` as **ITM01044–ITM01060** (Titus, Geisha, Exeter corned beef,
Gino/Tasty Tom/De Rica tomato paste, Golden Penny/Honeywell/Minimie pasta+noodles, Golden Morn,
Nasco cornflakes, Checkers custard, Heinz baked beans, peeled tomatoes). All are `Unit='carton'`,
status `ACTIVE`, with a curated `whole_sale_Price` plus `min_price`/`max_price` guidance bands.

**Observed state (verified 2026-08-08):** these 17 items have **0 rows in `Latest_Prices_Summary`**,
so consumers currently see no price for them. They now accept reporter submissions, but the task is
to also fetch **current online wholesale prices** so consumers see a price independent of reporter
volume.

**Goal:** weekly, fetch wholesale carton prices for the 17 items from Nigerian sources, gate them
against the curated seed, and surface them through the existing `Daily_Prices → Latest_Prices_Summary`
path, stamped `data_source='WEB_SCRAPE'`, without disturbing the NFPI food-inflation basket.

## 2. Ground truth established during design (verified against prod DB / Azure)

- **Live function apps** (`az functionapp list`, RG `foodprice`): `func-naijamarket-api`,
  **`func-naijamarket-scraper`**, `func-naijamarket-wa`. **`func-naijamarket-prod` does NOT exist.**
  Therefore the repo's `func-naijamarket-prod/price_scraper/` (AFEX/NBS/PricePatrol, pyodbc) is
  **dead legacy** — confirmed by `Verified_External_Prices` containing none of its sources.
- **The live, maintained scraper is `func-naijamarket-scraper`** (Linux Consumption, RUN_FROM_PACKAGE
  via `WEBSITE_RUN_FROM_PACKAGE` SAS URL; current build **scraper-v44**). It vendors `pymssql`
  (`shared/db.py`) and `requests` (used by `worldbank_rtfp_scraper`).
- **`sp_Generate_Daily_Prices`** builds `#Universe = Items_Catalog CROSS JOIN Markets`
  filtered only by `status IN (ACTIVE, NULL)`. Path priority:
  - **R (`REAL_ANCHORED`, conf 100):** row exists in `Verified_External_Prices` matching
    `item_id` + `state = market.state` + `market_id IS NULL` + `price_date = @VEP_Date`.
  - **A (`SIM_TRACKED`, conf 75):** has `ref_price` from `Latest_Prices_Summary`; value =
    `ref + (whole_sale·mf·bias − ref)·0.03 ± 1.5%` (slow mean-reversion toward seed).
  - **B (`SIM_BASELINE`, conf 50):** only a `whole_sale_Price>0`; value = `whole_sale·mf·bias·(1±1.5%)`.
  - The 17 branded items currently qualify for **Path B** — so the next full generation slot will
    give them synthetic wholesale-baseline prices (identical across all 226 markets).
- A capacity-window gate in `sp_Generate_Daily_Prices` refuses heavy generation outside
  **07:10–10:50 / 13:10–16:50 UTC** (DB is S3 only in those Logic-App-scaled windows; S1 otherwise).
- **`sp_Apply_Scrape_To_Generated`** exists: a post-generation `UPDATE` that overwrites
  `Daily_Prices` rows with `Verified_External_Prices` where `(item_id, market_id)` match and
  `used_in_gen=0`, stamping `data_source='WEB_SCRAPE'`. (Present; may be uncalled.)
- **`usp_Refresh_LatestPrices`** rebuilds `Latest_Prices_Summary` from the newest `Daily_Prices`
  slot; it is expensive (~5 min even on S3 — `Daily_Prices` is 53M+ rows with stale stats).
- **NFPI is a fixed basket.** `usp_Compute_NFPI_v2` reads `dbo.NFPI_Basket_v2` (Guard enforces
  **count = 29**) joined to `dbo.Price_History_NBS_v2_national` — **not** `Daily_Prices` or the full
  catalog. The 17 branded items have **0 membership** in `NFPI_Basket_v2` and `NFPI_Basket`.
  ⇒ Branded `WEB_SCRAPE` prices **cannot** enter NFPI. They are consumer-display-only.

## 3. Decisions (confirmed with product owner)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Price semantics | **Wholesale carton** — matches `Unit='carton'`, the wholesale seed, and the ±40% gate baseline |
| 2 | Surface mechanism / provenance | **Direct MERGE into `Daily_Prices` stamped `WEB_SCRAPE`** (mirrors the proven FRW `usp_Aggregate_Trader_Prices` pattern) |
| 3 | Cadence | **Weekly** |
| 4 | Sources | nigerianprice.com + Wigmore (carton-wholesale, primary); Supermart.ng + Pricepally (retail per-unit, best-effort cross-check) |
| 5 | NFPI | **Excluded** (fixed 29-item basket; branded items are not members) |

## 4. Source feasibility (verified 2026-08-08)

- **nigerianprice.com** — `robots.txt` = `User-agent: * / Crawl-delay: 3` (allowed). Publishes
  per-item **carton-level** articles (e.g. `/titus-sardine-carton-prices-in-nigeria/`,
  `/titus-fish-carton-prices-in-nigeria/`) reachable at HTTP 200 with extractable ₦ figures.
  **Caveat:** each article lists **multiple pack variants** → the parser must select the figure
  matching the item's exact pack spec; the ±40% gate rejects wrong-pack matches. **Primary source.**
- **Wigmore** — wholesale; the `www.wigmore.ng` host did not respond during probing. **Exact domain
  to be confirmed at build time** before enabling. Secondary carton-wholesale cross-check.
- **Supermart.ng** — reachable (301 → `www.supermart.ng`, 200). Retail per-unit. Page embeds
  captcha elements (reCAPTCHA on newsletter/checkout); we fetch only the public listing and
  **never** interact with or attempt to solve any challenge. If a bot wall appears, the source is
  skipped, not bypassed.
- **Pricepally** — `robots.txt` allows product/category pages (disallows only checkout/account/cart/
  auth/wallet/orders); sitemap published. Retail/semi-wholesale per-unit.

**Retail→wholesale reality:** Supermart/Pricepally give *retail per-unit*. Converted to a carton
figure (`per_unit × pack_count`) they reflect retail markup and will **frequently exceed the ±40%
gate vs the wholesale seed and be rejected**. They therefore serve as availability signals /
cross-checks; nigerianprice.com + Wigmore are the effective wholesale-carton sources. This is
intended, not a bug.

## 5. Architecture

New timer function **`branded_price_scraper`** inside **`func-naijamarket-scraper`** (next package
build = **scraper-v45.zip**). Reuses vendored `pymssql` (`shared/db.py`) and `requests`;
`beautifulsoup4` + `lxml` vendored into the package if not already present (verified at build time).

### 4-part flow

```
weekly timer (Mon, inside S3 capacity window)
  1. FETCH + PARSE  — for each active (item_id, source) in dbo.Branded_Scrape_Map:
         GET url (polite UA + per-source crawl-delay), parse per parse_hint,
         normalise to carton wholesale = raw_price × unit_multiplier.
         DB-light; failures per (item,source) are non-fatal and logged.
  2. STAGE          — write candidates to staging.Branded_Price_Feeds (PENDING).
  3. MERGE (proc)   — EXEC dbo.usp_Merge_Branded_Scrape_Prices:
         • aggregate candidates per item = MEDIAN of sources that passed
         • GATE: reject if |price − whole_sale_Price| / whole_sale_Price > 0.40
         • MERGE survivors into Daily_Prices (today, latest existing slot,
           17 items × all markets), data_source='WEB_SCRAPE', confidence ≈ 85
         • targeted UPSERT of the same 17×market rows into Latest_Prices_Summary
           (bounded 17-item write — NOT the ~5-min full usp_Refresh_LatestPrices)
  4. RESULT         — consumers see the WEB_SCRAPE price immediately.
```

### Stickiness between weekly scrapes
Once the scraped value is in `Latest_Prices_Summary`, daily `sp_Generate_Daily_Prices` **Path A
(`SIM_TRACKED`)** uses it as `ref_price` and drifts it only ~3%/slot toward the seed. So between
weekly scrapes consumers see a value that *tracks* the last scraped price rather than snapping back
to a flat baseline. Provenance is honest: `WEB_SCRAPE` on scrape day, `SIM_TRACKED` (tracking it)
on other days. If a scrape fails entirely one week, items degrade gracefully to `SIM_TRACKED`/
`SIM_BASELINE` — never a hard gap.

### Timing
The weekly run must land its `Daily_Prices` MERGE **inside the S3 window (07:10–10:50 UTC)** and
**after** a generation slot exists for the day (so there is a row to overwrite). Target **Monday
~08:30 UTC** (after the ~07:30 UTC morning slot, well inside the window). The HTTP fetch/parse/stage
steps are tier-independent; only the MERGE + targeted LPS upsert touch heavy tables and must respect
the window. Scheduler: a timerTrigger CRON on the function (final choice — in-function CRON vs a
Logic App HTTP trigger — settled in the implementation plan; in-function CRON is the default).

## 6. New DB objects (all DDL gated behind an explicit approval token)

1. **`dbo.Branded_Scrape_Map`** — data-driven mapping, one row per (item_id, source):
   `map_id, item_id, source, fetch_url_or_query, pack_count, unit_multiplier, parse_hint,
   active, notes, created_at`. Seeded for the 17 items (nigerianprice.com URLs first;
   Wigmore/Supermart/Pricepally rows added as URLs are confirmed). `active=0` disables a
   (item,source) without a code change.
2. **`staging.Branded_Price_Feeds`** — raw candidates per run:
   `feed_id, run_ts, source, item_id, raw_price, unit_multiplier, normalized_price, status
   (PENDING|USED|REJECTED|GATED|UNPARSED), reject_reason, raw_excerpt`.
3. **`dbo.usp_Merge_Branded_Scrape_Prices @price_date`** — aggregate (median) → ±40% gate →
   MERGE into `Daily_Prices` (today's latest slot, `WEB_SCRAPE`) → targeted `Latest_Prices_Summary`
   upsert for the 17 items. Guards: item set restricted to ITM01044–ITM01060; slot must already
   exist; per-item logging; `SET XACT_ABORT ON`.

Grants: writes execute as the scraper's DB principal (AAD/app login). If that login lacks
UPDATE/INSERT on the target tables, the MERGE runs inside a proc owned by a principal that has them
(same approach as existing generation procs). Confirmed in the plan.

## 7. Provenance, safety rails, and NFPI

- `WEB_SCRAPE` is a distinct `data_source` — branded online prices are separable in analytics and
  never conflated with `REAL_ANCHORED` (genuine market anchors) or `SIM_*`.
- **±40% gate vs `whole_sale_Price`** is the primary safety rail against bad parses, wrong pack
  sizes, and stale articles. Gated/unparsed candidates are recorded (not silently dropped) for
  observability.
- **NFPI is structurally unaffected** (fixed 29-item basket; branded items not members) — no code
  path lets `WEB_SCRAPE` rows reach NFPI computation.

## 8. Deployment & rollback (production — gated)

Per the established scraper packaging rule:
- Build with Python `zipfile`, forward-slash paths, `ZipInfo.external_attr = 0o100644 << 16` on
  added files; **new blob name** `scraper-v45.zip`; diff namelist vs live v44 (only the new
  function's folder + any newly vendored deps added; no root `function.json`).
- Upload to `sanaijamarketprod/function-releases/scraper-v45.zip`; mint a **past-start** SAS;
  `curl --range 0-100` → expect 206; flip `WEBSITE_RUN_FROM_PACKAGE` via `--settings @file.json`
  (no BOM), read-back byte-identical; restart; verify `/admin/functions` shows all functions loaded
  (never trust `az functionapp function list`).
- Commit `scraper-v45.zip` to `naijamarket-web/deployments/` and the recovery source under
  `naijamarket-web/branded-scraper/`.
- **DDL applied first** (gated token), then the package deploy (separate gated token).
- **Rollback:** re-flip `WEBSITE_RUN_FROM_PACKAGE` to `scraper-v44.zip` (+ restart). DB objects are
  additive (new table/proc) and safe to leave; the MERGE only runs when the function invokes it.

## 9. Out of scope (YAGNI)

- Per-market / regional price variation (uniform national value for now).
- The CAT005 "Drinks" items (this task covers the 17 CAT010 branded items; the same map/proc can be
  extended later).
- Reviving AFEX / NBS / PricePatrol scrapers.
- Bypassing any bot wall or CAPTCHA (explicitly prohibited — affected sources are skipped).

## 10. Success criteria

1. After one weekly run, all 17 items (whose scrape passed the gate) have `WEB_SCRAPE` rows in
   today's `Daily_Prices` slot and non-null `Latest_Prices_Summary` prices within the wholesale band.
2. Gated/failed items are recorded in `staging.Branded_Price_Feeds` with a reason (no silent drops).
3. NFPI monthly/weekly outputs are byte-unchanged by the run.
4. Between runs, the 17 items show `SIM_TRACKED` prices tracking the last scrape (no snap-back, no gap).
5. Deploy leaves `func-naijamarket-scraper` with all functions loaded; rollback path verified.
