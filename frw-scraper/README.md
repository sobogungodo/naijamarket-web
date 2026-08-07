# Phase 2 scraper wiring (first-reporter-wins consumer trimmed-mean)

Base = deployed `scraper-v43.zip`. Change = ONE file `generate_afternoon_prices/__init__.py`:
insert `EXEC dbo.usp_Aggregate_Trader_Prices` (non-fatal try/except) BETWEEN
`EXEC dbo.sp_Generate_Daily_Prices` and `EXEC dbo.usp_Refresh_LatestPrices`.

Deployed as **scraper-v44** on 2026-08-07:
- blob `sanaijamarketprod/function-releases/scraper-v44-20260807212107.zip` (SAS st=fresh to bust RUN_FROM_PACKAGE cache, exp 2028-08-04)
- flip `WEBSITE_RUN_FROM_PACKAGE` on `func-naijamarket-scraper` via @file.json → restart → host loaded 26 functions (healthy).
- ROLLBACK: re-flip `WEBSITE_RUN_FROM_PACKAGE` to the prior `scraper-v43.zip` blob.
DB dep: `dbo.usp_Aggregate_Trader_Prices` (applied to prod dbo first). See naijamarket-trader feat/frw-phase2.
