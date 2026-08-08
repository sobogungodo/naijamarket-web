# Branded Wholesale Price Scraper — Design

**Date:** 2026-08-08
**Status:** ⛔ **SHELVED 2026-08-08 — not deployed.** During implementation the chosen primary source
(nigerianprice.com) was found to be **~2.4 years stale** (all relevant articles stamped March 2024),
which the freshness guard rejects; the only *current* sources (Supermart/Pricepally) are **retail
per-unit**, which systematically overshoot the wholesale seed and fail the ±40% gate. Conclusion:
no reliable *current wholesale-carton* online source exists for these branded SKUs. **Decision
(product owner): keep wholesale semantics and rely on generation (`SIM_BASELINE`) + the
first-reporter-wins reporter pipeline; drop online scraping.** The pipeline scaffolding (map table,
staging table, parser framework — Tasks 1–3) is **built and committed on branch
`feat/branded-price-scraper` but NOT applied to prod**, preserved in case a genuine fetchable
wholesale source appears. See "Shelving addendum" at the end of this doc.
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

**Repurpose the dormant `price_scraper` timer function** inside **`func-naijamarket-scraper`**
(next package build = **scraper-v45.zip**). Discovery (2026-08-08): the live package already contains
a `price_scraper/` function that is a **127-char no-op stub** (`logging.info("[price_scraper] tick")`)
on a daily `0 0 6 * * *` timer. Repurposing this existing folder (edit `__init__.py`, change the
CRON to weekly) is **lower-risk than adding a new function folder** — it avoids the
"root/extra `function.json` → 0-functions" indexing trap from the packaging rule and reuses a
dormant slot. The folder name `price_scraper` is kept (it is a price scraper).

**Dependencies already vendored** (verified in the live package's `.python_packages`): `pymssql`,
`requests`, `beautifulsoup4` (`bs4`), `lxml`, `soupsieve`, `certifi`, `urllib3`, `charset`, `idna`.
No new dependency vendoring is required. DB access reuses `shared/db.py` (`pymssql`, SQL auth as
`SQL_USER=naijaapp`).

**Write path via ownership chaining (verified):** `naijaapp` is `db_datareader` only — it has
**SELECT-only** on `Daily_Prices`/`Latest_Prices_Summary` and no `db_datawriter`. All writes
therefore go through a **`dbo`-owned proc**: `dbo`, `staging`, and their tables are all `dbo`-owned,
so ownership chaining lets the proc write with no table-level grants. The Python function passes its
scraped candidates to the proc as a **JSON string parameter** (DB compat level 170 → `OPENJSON`
supported); the proc shreds JSON → stages → gates → MERGEs → upserts LPS. `naijaapp` needs exactly
**one** new grant: `GRANT EXECUTE` on that proc.

### 4-part flow

```
weekly timer (Mon, inside S3 capacity window)
  1. LOAD MAP       — Python reads dbo.Branded_Scrape_Map (active rows) via naijaapp SELECT.
  2. FETCH + PARSE  — for each active (item_id, source): GET url (polite UA + per-source
         crawl-delay), parse per parse_hint, normalise to carton wholesale =
         raw_price × unit_multiplier. DB-light HTTP only; failures per (item,source)
         are non-fatal and logged. Build a JSON array of candidates.
  3. EXEC PROC      — Python calls EXEC dbo.usp_Merge_Branded_Scrape_Prices
         @price_date=<today WAT>, @candidates_json='[…]'. The dbo-owned proc:
         • OPENJSON-shreds candidates → INSERT staging.Branded_Price_Feeds (audit)
         • aggregate per item = MEDIAN of sources that passed parsing
         • GATE: reject if |price − whole_sale_Price| / whole_sale_Price > 0.40
         • MERGE survivors into Daily_Prices (today, latest existing slot,
           17 items × all markets), data_source='WEB_SCRAPE', confidence ≈ 85
         • targeted UPSERT of the same 17×market rows into Latest_Prices_Summary
           (bounded 17-item write — NOT the ~5-min full usp_Refresh_LatestPrices)
         All writes via ownership chaining; naijaapp needs only EXECUTE on this proc.
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
2. **`staging.Branded_Price_Feeds`** — raw candidates per run (populated by the proc from the JSON
   param, for audit): `feed_id, run_ts, source, item_id, raw_price, unit_multiplier,
   normalized_price, source_date, status (USED|GATED|UNPARSED|REJECTED), reject_reason, raw_excerpt`.
3. **`dbo.usp_Merge_Branded_Scrape_Prices @price_date DATE, @candidates_json NVARCHAR(MAX),
   @max_age_days INT = 120`** — OPENJSON-shred → INSERT staging (audit) → drop `STALE`
   (`source_date` older than `@max_age_days`) → aggregate (median of survivors) → ±40% gate → MERGE
   into `Daily_Prices` (today's latest slot, `WEB_SCRAPE`, conf 85) → targeted
   `Latest_Prices_Summary` upsert for the 17 items. Guards: item set restricted to ITM01044–ITM01060
   (join on `Branded_Scrape_Map` / catalog); slot must already exist for the date; per-item status
   logged; `SET XACT_ABORT ON`.

**Grants (verified during design):** `naijaapp` is `db_datareader` (SELECT-only; no `db_datawriter`).
`dbo`, `staging`, and their tables are all `dbo`-owned, so the proc writes via **ownership chaining**
— no table grants needed. The only new grant is **`GRANT EXECUTE ON dbo.usp_Merge_Branded_Scrape_Prices
TO naijaapp`** (matching how existing generation procs are exposed). The Python never writes tables
directly; it only `SELECT`s `Branded_Scrape_Map` and `EXEC`s the proc.

## 7. Provenance, safety rails, and NFPI

- `WEB_SCRAPE` is a distinct `data_source` — branded online prices are separable in analytics and
  never conflated with `REAL_ANCHORED` (genuine market anchors) or `SIM_*`.
- **±40% gate vs `whole_sale_Price`** is the primary safety rail against bad parses and wrong pack
  sizes. Gated/unparsed candidates are recorded (not silently dropped) for observability.
- **Freshness guard.** nigerianprice.com articles carry a "PRICES LAST UPDATED: &lt;date&gt;" stamp
  and can be months stale (the Titus Sardine article was last updated 2026-03-04 during design). The
  parser extracts that date into each candidate's `source_date`; the proc **rejects** (status
  `GATED`, reason `STALE`) any candidate whose `source_date` is older than `@max_age_days` (default
  **120**). Sources without a parseable date (e.g. live retail listings) use the run date.
- **NFPI is structurally unaffected** (fixed 29-item basket; branded items not members) — no code
  path lets `WEB_SCRAPE` rows reach NFPI computation.

## 8. Deployment & rollback (production — gated)

Per the established scraper packaging rule:
- Build with Python `zipfile`, forward-slash paths, `ZipInfo.external_attr = 0o100644 << 16` on
  changed files; **new blob name** `scraper-v45.zip`; diff namelist vs live v44 — the **only**
  changes are `price_scraper/__init__.py` (content) and `price_scraper/function.json` (schedule);
  **no folders added/removed, no new deps, no root `function.json`**. Function count must be
  identical before/after.
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

---

## Shelving addendum (2026-08-08)

**Why shelved.** Verified during implementation:
- **nigerianprice.com** — every relevant carton article ("PRICES LAST UPDATED") is stamped
  **March 2024** (~2.4 yrs old). With NGN inflation ~30%/yr these figures are ~50%+ too low; the
  120-day freshness guard correctly rejects them. Also carries correct brand+pack carton pricing for
  only **6 of 17** items.
- **Supermart.ng** — live WooCommerce, current prices, statically fetchable (captcha widget present
  but product HTML is served), but **retail per-unit**. Retail-per-unit × pack overshoots the
  wholesale seed by well over 40% ⇒ rejected by the outlier gate under wholesale semantics.
- **Pricepally** — live but Next.js with no product sitemap; needs internal-API reverse-engineering.
- **Wigmore** — `www.wigmore.ng` did not resolve; domain unconfirmed.

Net: no reliable **current wholesale-carton** online source exists for these branded SKUs.

**Fallback that consumers actually get (verified).** `sp_Generate_Daily_Prices` includes all ACTIVE
`Items_Catalog` items (`#Universe = Items_Catalog × Markets`); the 17 branded items have
`whole_sale_Price>0` ⇒ **Path B `SIM_BASELINE`** at the next fresh-day slot. `usp_Refresh_LatestPrices`
surfaces the latest slot with **no category/is_food/item filter**, so they reach consumers
automatically. Reporters overlay real prices via first-reporter-wins. (As of 2026-08-08 they are not
yet in `Latest_Prices_Summary` — added after today's slots generated; the same-day guard blocks
regeneration — so they appear at the next successful new-day generation slot.)

**What is built and preserved (branch `feat/branded-price-scraper`, NOT applied to prod):**
- `branded-scraper/db/01_Branded_Scrape_Map.sql`, `02_staging_Branded_Price_Feeds.sql` — table DDL (unapplied)
- `branded-scraper/db/04_seed_Branded_Scrape_Map.sql` — 17-row NGPRICE seed (6 active)
- `branded-scraper/price_scraper/parse.py` + `tests/` — regex parser + passing unit tests (fail-safe on ambiguous hints)

**To resume if a fetchable current wholesale source appears:** confirm the source is current, add a
parser to `parse.py` + `Branded_Scrape_Map` rows, then implement Tasks 4–7 of the plan
(`usp_Merge_Branded_Scrape_Prices`, function rewrite, scraper-v45 build, gated deploy). The merge
proc's freshness + ±40% gates are the safety rails and should stay.
