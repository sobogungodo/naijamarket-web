import os, json, logging, time
import azure.functions as func
import pymssql
from shared.cache    import get_cache, set_cache
from shared.validate import validate_price_guidance

PRICE_VARIANCE_PCT = 0.10

def get_connection():
    return pymssql.connect(
        server=os.environ["SQL_SERVER"], user=os.environ["SQL_USERNAME"],
        password=os.environ["SQL_PASSWORD"], database=os.environ["SQL_DATABASE"],
        timeout=0, login_timeout=30, as_dict=True)

def _get_baseline(cur, item_id, market_id):
    cur.execute("SELECT TOP 1 price_naira AS p FROM dbo.Latest_Prices_Summary WHERE item_id=%s AND market_id=%s AND price_naira>0 ORDER BY price_date DESC", (item_id, market_id))
    row = cur.fetchone()
    if row and row.get("p"): return float(row["p"]), "LATEST_PRICES_SUMMARY"
    cur.execute("SELECT TOP 1 price_naira AS p FROM dbo.Verified_External_Prices WHERE item_id=%s AND market_id=%s AND price_naira>0", (item_id, market_id))
    row = cur.fetchone()
    if row and row.get("p"): return float(row["p"]), "VERIFIED_EXTERNAL"
    return None, None

def _get_peer_range(cur, item_id, market_id):
    cur.execute("SELECT COUNT(*) AS cnt, MIN(price) AS lo, MAX(price) AS hi FROM dbo.Submissions WHERE item_id=%s AND market_id=%s AND validation_status='APPROVED' AND price>0 AND trader_id NOT LIKE 'SYN-%%' AND CAST(TRY_CAST(submitted_at AS DATETIME2) AS DATE)=CAST(GETUTCDATE() AS DATE)", (item_id, market_id))
    row = cur.fetchone() or {}
    cnt = int(row.get("cnt") or 0)
    if cnt >= 2 and row.get("lo") and row.get("hi"):
        return {"count": cnt, "low": float(row["lo"]), "high": float(row["hi"])}
    return None

def _naira(v): return f"\u20a6{v:,.0f}"

def _build_hint(baseline, lo, hi, peer):
    if peer: return f"Other traders at this market today: {_naira(peer['low'])} \u2013 {_naira(peer['high'])}"
    if baseline is not None: return f"Expected range for this item: {_naira(lo)} \u2013 {_naira(hi)}"
    return "No price guidance available yet for this item at this market."

def main(req: func.HttpRequest) -> func.HttpResponse:
    t_start = time.monotonic()

    item_id = req.params.get("item_id")
    market_id = req.params.get("market_id")
    if not item_id or not market_id:
        try:
            body = req.get_json()
            item_id = item_id or body.get("item_id")
            market_id = market_id or body.get("market_id")
        except Exception:
            pass
    if not item_id or not market_id:
        return func.HttpResponse(json.dumps({"ok": False, "error": "item_id and market_id are required"}), status_code=400, mimetype="application/json")

    cache_key = f"{item_id}:{market_id}"
    cached = get_cache("pg", cache_key)
    if cached is not None:
        logging.info(f"[price_guidance] CACHE HIT {item_id}:{market_id} latency={time.monotonic()-t_start:.3f}s")
        return func.HttpResponse(json.dumps(cached), status_code=200, mimetype="application/json")

    conn = None
    try:
        t_db = time.monotonic()
        conn = get_connection()
        cur = conn.cursor()
        baseline, source = _get_baseline(cur, item_id, market_id)
        peer = _get_peer_range(cur, item_id, market_id)
        db_latency = time.monotonic() - t_db

        if baseline is not None:
            lo = round(baseline * (1 - PRICE_VARIANCE_PCT), 2)
            hi = round(baseline * (1 + PRICE_VARIANCE_PCT), 2)
        else:
            lo = hi = None

        payload = {"ok": True, "item_id": item_id, "market_id": market_id,
                   "baseline": baseline, "baseline_source": source,
                   "expected_low": lo, "expected_high": hi,
                   "variance_pct": PRICE_VARIANCE_PCT, "peer": peer,
                   "hint_text": _build_hint(baseline, lo, hi, peer)}

        validation = validate_price_guidance(payload)
        if not validation["ok"]:
            logging.error(f"[price_guidance] SCHEMA VIOLATION {item_id}:{market_id} errors={validation['errors']}")
            return func.HttpResponse(
                json.dumps({"ok": False, "error": "guidance_unavailable", "hint_text": ""}),
                status_code=200, mimetype="application/json")

        set_cache("pg", cache_key, payload)
        logging.info(f"[price_guidance] DB HIT {item_id}:{market_id} db={db_latency:.3f}s total={time.monotonic()-t_start:.3f}s baseline={baseline}")
        return func.HttpResponse(json.dumps(payload), status_code=200, mimetype="application/json")

    except Exception as e:
        logging.error(f"[price_guidance] ERROR {item_id}:{market_id} latency={time.monotonic()-t_start:.3f}s error={e}")
        return func.HttpResponse(
            json.dumps({"ok": False, "error": "guidance_unavailable", "hint_text": ""}),
            status_code=200, mimetype="application/json")
    finally:
        if conn: conn.close()
