import json, math, logging
import azure.functions as func
from shared.db    import get_connection, cors_headers
from shared.auth  import get_session_phone
from shared.cache import get_cache, set_cache, invalidate_cache

_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

def _gen_referral(seed):
    h = 0
    for c in seed:
        h = ((h << 5) - h) + ord(c)
        h &= 0xFFFFFFFF
    if h < 0: h += 0x100000000
    code = ''
    for _ in range(6):
        code += _CHARS[h % len(_CHARS)]
        h //= len(_CHARS)
    return f'NMI-{code}'

def handle_digest_get(phone, headers):
    cached = get_cache("digest", phone)
    if cached is not None:
        return func.HttpResponse(json.dumps(cached), status_code=200, headers=headers)
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("SELECT preferences FROM dbo.Consumers WHERE phone=%s OR phone_number=%s", (phone, phone))
        row = cur.fetchone()
        conn.close()
        if not row:
            result = {'enabled': False}
            set_cache("digest", phone, result)
            return func.HttpResponse(json.dumps(result), status_code=200, headers=headers)
        prefs   = json.loads(row['preferences'] or '{}')
        enabled = prefs.get('daily_digest') in (True, 1)
        result  = {'enabled': enabled}
        set_cache("digest", phone, result)
        return func.HttpResponse(json.dumps(result), status_code=200, headers=headers)
    except Exception as e:
        logging.error(f'[account_data] digest_get error: {e}')
        return func.HttpResponse(json.dumps({'enabled': False}), status_code=200, headers=headers)

def handle_digest_patch(phone, body, headers):
    enabled = body.get('enabled', False)
    val     = 1 if enabled else 0
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("UPDATE dbo.Consumers SET preferences = JSON_MODIFY(COALESCE(preferences,'{}'), '$.daily_digest', CAST(%s AS BIT)) WHERE phone=%s OR phone_number=%s", (val, phone, phone))
        conn.commit()
        conn.close()
        invalidate_cache("digest", phone)
        return func.HttpResponse(json.dumps({'success': True, 'enabled': enabled}), status_code=200, headers=headers)
    except Exception as e:
        logging.error(f'[account_data] digest_patch error: {e}')
        return func.HttpResponse(json.dumps({'error': 'Failed to update preference'}), status_code=500, headers=headers)

def handle_history(phone, page, headers):
    page_size = 20
    offset    = (page - 1) * page_size
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("SELECT query_id, item_name, item_id, market_name, market_id, category_id, price_returned, unit, previous_price, price_change_pct, query_type, query_source, subscription_tier, counted_against_limit, query_timestamp FROM dbo.Query_Log WHERE consumer_phone=%s ORDER BY query_timestamp DESC OFFSET %s ROWS FETCH NEXT %s ROWS ONLY", (phone, offset, page_size))
        rows = cur.fetchall()
        cur.execute("SELECT COUNT(*) AS total FROM dbo.Query_Log WHERE consumer_phone=%s", (phone,))
        count_row = cur.fetchone()
        conn.close()
    except Exception as e:
        logging.error(f'[account_data] history error: {e}')
        return func.HttpResponse(json.dumps({'queries': [], 'total': 0, 'page': 1, 'pages': 0}), status_code=200, headers=headers)
    total   = int(count_row['total']) if count_row else 0
    queries = []
    for r in rows:
        ts = r['query_timestamp']
        queries.append({
            'query_id': r['query_id'], 'item_name': r['item_name'], 'item_id': r['item_id'],
            'market_name': r['market_name'], 'market_id': r['market_id'], 'category_id': r['category_id'],
            'price_returned': float(r['price_returned']) if r['price_returned'] is not None else None,
            'unit': r['unit'],
            'previous_price': float(r['previous_price']) if r['previous_price'] is not None else None,
            'price_change_pct': float(r['price_change_pct']) if r['price_change_pct'] is not None else None,
            'query_type': r['query_type'], 'query_source': r['query_source'],
            'subscription_tier': r['subscription_tier'], 'counted_against_limit': r['counted_against_limit'],
            'query_timestamp': ts.isoformat() if hasattr(ts, 'isoformat') else str(ts),
        })
    return func.HttpResponse(json.dumps({'queries': queries, 'total': total, 'page': page, 'pages': math.ceil(total / page_size) if total else 0}), status_code=200, headers=headers)

def handle_referral(phone, headers):
    cached = get_cache("ref", phone)
    if cached is not None:
        return func.HttpResponse(json.dumps(cached), status_code=200, headers=headers)
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("SELECT consumer_id, preferences FROM dbo.Consumers WHERE phone=%s OR phone_number=%s", (phone, phone))
        row = cur.fetchone()
        conn.close()
        if not row:
            result = {'code': None}
            set_cache("ref", phone, result)
            return func.HttpResponse(json.dumps(result), status_code=200, headers=headers)
        prefs = json.loads(row['preferences'] or '{}')
        if prefs.get('referral_code'):
            result = {'code': prefs['referral_code']}
            set_cache("ref", phone, result)
            return func.HttpResponse(json.dumps(result), status_code=200, headers=headers)
        code = _gen_referral(f"{row['consumer_id']}-{phone}")
        try:
            conn2 = get_connection()
            cur2  = conn2.cursor()
            cur2.execute("UPDATE dbo.Consumers SET preferences = JSON_MODIFY(COALESCE(preferences,'{}'), '$.referral_code', %s) WHERE consumer_id=%s", (code, row['consumer_id']))
            conn2.commit()
            conn2.close()
        except Exception:
            pass
        result = {'code': code}
        set_cache("ref", phone, result)
        return func.HttpResponse(json.dumps(result), status_code=200, headers=headers)
    except Exception as e:
        logging.error(f'[account_data] referral error: {e}')
        return func.HttpResponse(json.dumps({'code': None}), status_code=200, headers=headers)

def main(req: func.HttpRequest) -> func.HttpResponse:
    headers = cors_headers()
    if req.method == 'OPTIONS':
        return func.HttpResponse('', status_code=200, headers=headers)
    session_phone = get_session_phone(req)
    if not session_phone:
        return func.HttpResponse(json.dumps({'error': 'Unauthorized'}), status_code=401, headers=headers)
    qtype = req.params.get('type', '')
    if qtype == 'digest':
        if req.method in ('POST', 'PATCH'):
            try: body = req.get_json()
            except Exception: body = {}
            return handle_digest_patch(session_phone, body, headers)
        return handle_digest_get(session_phone, headers)
    elif qtype == 'digest_patch':
        try: body = req.get_json()
        except Exception: body = {}
        return handle_digest_patch(session_phone, body, headers)
    elif qtype == 'history':
        try: page = max(1, int(req.params.get('page', '1')))
        except ValueError: page = 1
        return handle_history(session_phone, page, headers)
    elif qtype == 'referral':
        return handle_referral(session_phone, headers)
    return func.HttpResponse(json.dumps({'error': f'Unknown type: {qtype}'}), status_code=400, headers=headers)
