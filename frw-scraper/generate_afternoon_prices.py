"""generate_afternoon_prices — timer trigger fires at 14:30 UTC (WAT+1)
Calls sp_Generate_Daily_Prices with no args — SP self-determines date+slot.
timeout=0 does NOT mean unlimited on this pymssql/FreeTDS build — it falls
back to login_timeout (30s) as the query timeout, killing the 47-162s
generation insert mid-run. Explicit timeout below fixes that (see shared/db.py).
"""
import logging
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import pymssql
import azure.functions as func
from datetime import datetime, timezone


def _get_gen_connection():
    """Dedicated connection for the long-running generation SP. Query timeout
    must be set explicitly (600s) — timeout=0 silently caps at login_timeout
    on this driver/server combo, not "unlimited"."""
    # Supabase Dev environment: DB_BACKEND=supabase routes to psycopg2 -> Supabase Postgres
    # (EXEC->CALL, dbo.-strip). Production leaves DB_BACKEND unset -> pymssql -> Azure SQL.
    if os.environ.get("DB_BACKEND") == "supabase":
        from db_supabase import get_supabase_connection
        return get_supabase_connection()
    return pymssql.connect(
        server=os.environ["SQL_SERVER"],
        user=os.environ.get("SQL_USERNAME") or os.environ.get("SQL_USER", ""),
        password=os.environ["SQL_PASSWORD"],
        database=os.environ.get("SQL_DATABASE", "naijafoodmarket-live"),
        timeout=600,
        login_timeout=30,
        as_dict=True,
    )


def main(myTimer: func.TimerRequest) -> None:
    start = datetime.now(timezone.utc)
    logging.info("[generate_afternoon_prices] START %s", start.isoformat())

    if myTimer.past_due:
        logging.warning("[generate_afternoon_prices] Timer is past due — running anyway.")

    conn = None
    try:
        conn = _get_gen_connection()
        cur = conn.cursor()

        # SP self-determines @TargetDate and @TimeSlot from GETUTCDATE()
        # Do NOT pass args — avoids pymssql callproc parameter mapping issues
        logging.info("[generate_afternoon_prices] Calling sp_Generate_Daily_Prices ...")
        cur.execute("EXEC dbo.sp_Generate_Daily_Prices")
        conn.commit()

        # Fetch result row for logging
        row = cur.fetchone()
        if row:
            logging.info(
                "[generate_afternoon_prices] DONE — date=%s slot=%s "
                "pathA=%s pathB=%s total=%s elapsed_ms=%s",
                row.get("price_date"), row.get("time_slot"),
                row.get("path_a_sim_tracked"), row.get("path_b_sim_baseline"),
                row.get("total_rows_inserted"), row.get("elapsed_ms"),
            )
        else:
            logging.info("[generate_afternoon_prices] SP completed (guard path or no result row).")

        cur.close()

        # Phase 2 (first-reporter-wins): fold real trader submissions into the day's
        # 14:30 cells as an outlier-trimmed mean. usp_Aggregate_Trader_Prices MERGE-overwrites
        # the generator's (price_date,'14:30',item,market) cell wherever reporters submitted,
        # so usp_Refresh_LatestPrices below (which picks the highest slot per item+market =
        # 14:30) surfaces the trader-derived price to consumers. MUST run AFTER
        # sp_Generate_Daily_Prices (which owns full-catalog 14:30 generation — running before it
        # would trip its "slot already generated" guard) and BEFORE the LPS refresh.
        # Non-fatal: an aggregation hiccup must NOT break the core generate->refresh; consumers
        # then simply keep the generator price for that cell.
        try:
            logging.info("[generate_afternoon_prices] Aggregating trader prices ...")
            cur_agg = conn.cursor()
            cur_agg.execute("EXEC dbo.usp_Aggregate_Trader_Prices")
            conn.commit()
            cur_agg.close()
            logging.info("[generate_afternoon_prices] Trader aggregation complete.")
        except Exception as agg_e:
            logging.error(
                "[generate_afternoon_prices] Trader aggregation FAILED (non-fatal, consumers "
                "keep generator prices): %s", str(agg_e), exc_info=True)
            try:
                conn.rollback()
            except Exception:
                pass

        # Refresh Latest_Prices_Summary
        logging.info("[generate_afternoon_prices] Refreshing Latest_Prices_Summary ...")
        cur2 = conn.cursor()
        cur2.execute("EXEC dbo.usp_Refresh_LatestPrices")
        conn.commit()
        cur2.close()
        logging.info("[generate_afternoon_prices] Refresh complete.")

    except Exception as e:
        logging.error("[generate_afternoon_prices] ERROR: %s", str(e), exc_info=True)
        raise
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass

    elapsed = (datetime.now(timezone.utc) - start).total_seconds()
    logging.info("[generate_afternoon_prices] FINISHED in %.1f seconds.", elapsed)
