"""
price_guidance_batch — canonical price guidance for MANY items at once.

Same source of truth as the single price_guidance endpoint, batched so the
trader PWA can fetch a whole category in one call (mirrors how slot-status,
commodities, today-count already return maps keyed by item_id).

Both surfaces consume this:
  - PWA submit page: POST a market + the item_ids in the opened category
  - WhatsApp flow:   can POST a single item_id (works the same)

POST /api/price_guidance_batch
  { "market_id": "MKT0001", "item_ids": ["ITM00002","ITM00004", ...] }

Response (200):
{
  "ok": true,
  "market_id": "MKT0001",
  "variance_pct": 0.10,
  "guidance": {
    "ITM00002": {
      "baseline": 69898.73,
      "baseline_source": "LATEST_PRICES_SUMMARY",
      "expected_low": 62908.86,
      "expected_high": 76888.6,
      "peer": null,                      # or { count, low, high }
      "hint_text": "Expected range: \u20a662,909 \u2013 \u20a676,889"
    },
    ...
  }
}

Items with no baseline are returned with baseline=null and an empty hint_text
so the client can simply skip rendering a hint for them.
"""

import os
import json
import logging

import azure.functions as func
import pymssql

PRICE_VARIANCE_PCT = 0.10
MAX_ITEMS = 100  # safety cap on batch size


def get_connection():
    return pymssql.connect(
        server   = os.environ["SQL_SERVER"],
        user     = os.environ["SQL_USERNAME"],
        password = os.environ["SQL_PASSWORD"],
        database = os.environ["SQL_DATABASE"],
        timeout  = 0,
        login_timeout = 30,
        as_dict  = True,
    )


def _naira(v: float) -> str:
    return f"\u20a6{v:,.0f}"


def _baselines_for(cur, market_id, item_ids):
    """
    One query, latest price per item for this market from Latest_Prices_Summary.
    Returns {item_id: baseline_float}. Uses ROW_NUMBER (QUALIFY unsupported on
    Azure SQL) to take the most recent price_date per item.
    """
    placeholders = ",".join(["%s"] * len(item_ids))
    sql = f"""
        SELECT item_id, price_naira
        FROM (
            SELECT item_id, price_naira,
                   ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY price_date DESC) AS rn
            FROM   dbo.Latest_Prices_Summary
            WHERE  market_id = %s
              AND  price_naira > 0
              AND  item_id IN ({placeholders})
        ) t
        WHERE rn = 1
    """
    cur.execute(sql, tuple([market_id] + item_ids))
    out = {}
    for r in cur.fetchall():
        if r.get("price_naira"):
            out[r["item_id"]] = (float(r["price_naira"]), "LATEST_PRICES_SUMMARY")
    return out


def _external_fallback(cur, market_id, missing_ids):
    """Verified_External_Prices fallback for items with no summary row."""
    if not missing_ids:
        return {}
    placeholders = ",".join(["%s"] * len(missing_ids))
    sql = f"""
        SELECT item_id, price_naira
        FROM   dbo.Verified_External_Prices
        WHERE  market_id = %s
          AND  price_naira > 0
          AND  item_id IN ({placeholders})
    """
    cur.execute(sql, tuple([market_id] + missing_ids))
    out = {}
    for r in cur.fetchall():
        if r.get("price_naira") and r["item_id"] not in out:
            out[r["item_id"]] = (float(r["price_naira"]), "VERIFIED_EXTERNAL")
    return out


def _peer_ranges(cur, market_id, item_ids):
    """
    Today's approved peer submissions per item (>=2 real traders).
    submitted_at is nvarchar ISO-8601 -> TRY_CAST. Returns {item_id: {count,low,high}}.
    """
    placeholders = ",".join(["%s"] * len(item_ids))
    sql = f"""
        SELECT item_id, COUNT(*) AS cnt, MIN(price) AS lo, MAX(price) AS hi
        FROM   dbo.Submissions
        WHERE  market_id = %s
          AND  validation_status = 'APPROVED'
          AND  price > 0
          AND  trader_id NOT LIKE 'SYN-%%'
          AND  item_id IN ({placeholders})
          AND  CAST(TRY_CAST(submitted_at AS DATETIME2) AS DATE) = CAST(GETUTCDATE() AS DATE)
        GROUP BY item_id
    """
    cur.execute(sql, tuple([market_id] + item_ids))
    out = {}
    for r in cur.fetchall():
        cnt = int(r.get("cnt") or 0)
        if cnt >= 2 and r.get("lo") and r.get("hi"):
            out[r["item_id"]] = {"count": cnt, "low": float(r["lo"]), "high": float(r["hi"])}
    return out


def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
    except Exception:
        body = {}
    market_id = body.get("market_id")
    item_ids = body.get("item_ids") or []

    if not market_id or not isinstance(item_ids, list) or not item_ids:
        return func.HttpResponse(
            json.dumps({"ok": False, "error": "market_id and non-empty item_ids[] required"}),
            status_code=400, mimetype="application/json",
        )

    # de-dup, cap, stringify
    item_ids = [str(i) for i in dict.fromkeys(item_ids)][:MAX_ITEMS]

    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()

        baselines = _baselines_for(cur, market_id, item_ids)
        missing = [i for i in item_ids if i not in baselines]
        baselines.update(_external_fallback(cur, market_id, missing))
        peers = _peer_ranges(cur, market_id, item_ids)

        guidance = {}
        for iid in item_ids:
            b = baselines.get(iid)
            peer = peers.get(iid)
            if b:
                baseline, source = b
                lo = round(baseline * (1 - PRICE_VARIANCE_PCT), 2)
                hi = round(baseline * (1 + PRICE_VARIANCE_PCT), 2)
                if peer:
                    hint = f"Other traders today: {_naira(peer['low'])} \u2013 {_naira(peer['high'])}"
                else:
                    hint = f"Expected range: {_naira(lo)} \u2013 {_naira(hi)}"
                guidance[iid] = {
                    "baseline": baseline, "baseline_source": source,
                    "expected_low": lo, "expected_high": hi,
                    "peer": peer, "hint_text": hint,
                }
            else:
                guidance[iid] = {
                    "baseline": None, "baseline_source": None,
                    "expected_low": None, "expected_high": None,
                    "peer": peer, "hint_text": "",
                }

        return func.HttpResponse(
            json.dumps({"ok": True, "market_id": market_id,
                        "variance_pct": PRICE_VARIANCE_PCT, "guidance": guidance}),
            status_code=200, mimetype="application/json",
        )

    except Exception as e:
        logging.error(f"[price_guidance_batch] error: {e}")
        return func.HttpResponse(
            json.dumps({"ok": False, "error": "guidance_unavailable", "guidance": {}}),
            status_code=200, mimetype="application/json",
        )
    finally:
        if conn:
            conn.close()
