# branded-scraper — SHELVED scaffolding (2026-08-08)

Intended: a weekly scraper to fetch **wholesale carton** prices for the 17 branded CAT010 items
(ITM01044–ITM01060) and surface them to consumers as `WEB_SCRAPE`.

## Status: ⛔ SHELVED — built but NOT deployed, NOT applied to prod

Shelved during implementation because **no reliable current wholesale-carton online source exists**
for these SKUs:
- **nigerianprice.com** — carton-level but every relevant article is stamped **March 2024**
  (~2.4 yrs stale); freshness guard rejects it. Correct brand+pack coverage for only 6/17 items.
- **Supermart.ng / Pricepally** — current but **retail per-unit**; per-unit × pack overshoots the
  wholesale seed and fails the ±40% gate.
- **Wigmore** — domain unconfirmed.

**Decision (product owner):** keep wholesale semantics; rely on `sp_Generate_Daily_Prices`
(`SIM_BASELINE`, next fresh-day slot) + the first-reporter-wins reporter pipeline. Consumers get
prices for these items via those paths (verified: `usp_Refresh_LatestPrices` has no item/category
filter).

## What's here (all committed, none applied to prod)

| File | What | Applied? |
|------|------|----------|
| `db/01_Branded_Scrape_Map.sql` | `dbo.Branded_Scrape_Map` DDL | ❌ no |
| `db/02_staging_Branded_Price_Feeds.sql` | `staging.Branded_Price_Feeds` DDL | ❌ no |
| `db/04_seed_Branded_Scrape_Map.sql` | 17-row NGPRICE seed (6 active) | ❌ no |
| `price_scraper/parse.py` | regex nigerianprice parser (fail-safe on ambiguous hints) | n/a |
| `tests/` | pytest for the parser (6 passing) | n/a |

Not built (Tasks 4–7 of the plan): `usp_Merge_Branded_Scrape_Prices`, the function entrypoint
rewrite, the `scraper-v45` package, and the deploy.

## To resume

1. Find a **fetchable, current wholesale-carton** Nigerian source (or accept retail semantics — a
   separate product decision that changes the gate baseline).
2. Add a parser to `price_scraper/parse.py` + rows to `Branded_Scrape_Map`.
3. Implement Tasks 4–7 in `docs/superpowers/plans/2026-08-08-branded-price-scraper.md`. Keep the
   merge proc's freshness (`@max_age_days`) + ±40% outlier gates — they are the safety rails that
   surfaced the staleness problem in the first place.

Full context: `docs/superpowers/specs/2026-08-08-branded-price-scraper-design.md` (see "Shelving addendum").
