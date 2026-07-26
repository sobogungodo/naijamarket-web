"""
process_rewards — VTPass airtime payout processor.
Timer: every 30 minutes.

PATCHES (api-v7):
  Fix 1: payout_batch_id now set to batch_id (was NULL).
  Fix 2: _db_log called inside settle except so failures are always visible.
  Fix 3: description column widened to nvarchar(500) — done via DDL, not code.

SECURITY PATCHES (api-v5):
  F9: PROCESSING reclaim added — rows stuck in PROCESSING for >10 minutes
      are reclaimed and retried. VTPass idempotency (request_id = transaction_id)
      makes this safe — duplicate sends return code 019 which resolves to PAID.
"""
import os
import logging
import datetime
import azure.functions as func
from shared.db import get_connection
from shared.vtpass import is_enabled, buy_airtime


def _db_log(conn, batch_id, step, detail=""):
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO dbo.Process_Rewards_Log (batch_id, step, detail) VALUES (%s, %s, %s)",
            (batch_id, step[:100], str(detail)[:500])
        )
        conn.commit()
    except Exception as e:
        logging.error(f"[process_rewards] _db_log failed: {e}")


BATCH_SIZE = 50

_TRANSIENT_MARKERS = (
    "Low wallet balance",
    "Request failed",
    "HTTP 5",
    "timed out",
)


def _is_transient(error: str | None) -> bool:
    if not error:
        return False
    return any(m.lower() in error.lower() for m in _TRANSIENT_MARKERS)


def main(timer: func.TimerRequest) -> None:
    if not is_enabled():
        logging.info("[process_rewards] VTPASS_ENABLED is not true — skipping")
        return

    batch_id = "VT-" + datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S")
    paid = failed = deferred = 0

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT TOP %s transaction_id, phone_number, net_amount, amount,
                      user_type, user_id, description
               FROM   dbo.Rewards_Ledger
               WHERE  (
                   status = 'PENDING'
                   OR (
                       status = 'PROCESSING'
                       AND timestamp < DATEADD(MINUTE, -10, GETUTCDATE())
                   )
               )
               AND phone_number IS NOT NULL
               AND COALESCE(net_amount, amount, 0) > 0
               AND transaction_type IN ('SUBMISSION_REWARD','VALIDATION_REWARD','DIFFICULTY_BONUS','REFERRAL_REWARD')
               ORDER  BY timestamp ASC""",
            (BATCH_SIZE,)
        )
        rows = cur.fetchall() or []
    except Exception as e:
        logging.error(f"[process_rewards] fetch failed: {e}")
        try:
            conn.close()
        except Exception:
            pass
        return

    if not rows:
        conn.close()
        logging.info("[process_rewards] no PENDING rewards")
        return

    logging.info(f"[process_rewards] batch {batch_id}: {len(rows)} rows (PENDING + reclaimed PROCESSING)")
    _db_log(conn, batch_id, 'BATCH_START', f'{len(rows)} rows')

    for r in rows:
        txid      = r["transaction_id"]
        phone     = (r["phone_number"] or "").strip()
        amount    = float(r["net_amount"] if r["net_amount"] is not None else r["amount"])
        user_type = (r["user_type"] or "").upper()
        user_id   = r["user_id"] or ""

        try:
            cur = conn.cursor()
            cur.execute(
                """UPDATE dbo.Rewards_Ledger SET status='PROCESSING'
                   WHERE transaction_id=%s AND status IN ('PENDING','PROCESSING')""",
                (txid,)
            )
            conn.commit()
            if cur.rowcount == 0:
                continue
        except Exception as e:
            logging.error(f"[process_rewards] claim failed {txid}: {e}")
            continue

        _db_log(conn, batch_id, 'PRE_VTPASS', f'txid={txid} phone={phone} amount={amount}')
        result = buy_airtime(phone, amount, txid)
        _db_log(conn, batch_id, 'POST_VTPASS', str(result)[:400])

        if not result["ok"] and result.get("raw_code") == "019":
            result["ok"]    = True
            result["error"] = "resolved-as-duplicate (019)"

        try:
            cur = conn.cursor()
            if result["ok"]:
                cur.execute(
                    """UPDATE dbo.Rewards_Ledger
                       SET status='PAID', payout_batch_id=%s,
                           description = CONCAT(COALESCE(description,''),
                                                ' | paid ', %s, ' ref=', %s)
                       WHERE transaction_id=%s""",
                    (batch_id, batch_id, result["vtpass_ref"] or "", txid)
                )
                cur.execute(
                    """INSERT INTO dbo.Payout_Log
                         (trader_id, batch_id, phone_number, network, amount,
                          status, vtpass_ref, error_message, processed_at)
                       VALUES (%s,%s,%s,%s,%s,'PAID',%s,NULL,GETUTCDATE())""",
                    (user_id, batch_id, phone, result["network"] or "",
                     amount, result["vtpass_ref"] or "")
                )
                paid += 1
            elif _is_transient(result["error"]):
                cur.execute(
                    "UPDATE dbo.Rewards_Ledger SET status='PENDING' WHERE transaction_id=%s",
                    (txid,)
                )
                deferred += 1
                logging.warning(f"[process_rewards] transient {txid}: {result['error']}")
            else:
                cur.execute(
                    """UPDATE dbo.Rewards_Ledger
                       SET status='FAILED',
                           description = CONCAT(COALESCE(description,''),
                                                ' | failed: ', %s)
                       WHERE transaction_id=%s""",
                    ((result["error"] or "unknown")[:200], txid)
                )
                cur.execute(
                    """INSERT INTO dbo.Payout_Log
                         (trader_id, batch_id, phone_number, network, amount,
                          status, vtpass_ref, error_message, processed_at)
                       VALUES (%s,%s,%s,%s,%s,'FAILED',NULL,%s,GETUTCDATE())""",
                    (user_id, batch_id, phone, result["network"] or "",
                     amount, (result["error"] or "unknown")[:500])
                )
                failed += 1
            conn.commit()
        except Exception as e:
            logging.error(f"[process_rewards] settle failed {txid}: {e}")
            _db_log(conn, batch_id, 'SETTLE_ERROR', f'txid={txid} err={str(e)[:400]}')
            try:
                conn.rollback()
            except Exception:
                pass

    try:
        conn.close()
    except Exception:
        pass

    logging.info(
        f"[process_rewards] {batch_id} done: paid={paid} failed={failed} deferred={deferred}"
    )
