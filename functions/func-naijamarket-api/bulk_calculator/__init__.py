"""
bulk_calculator — Bulk buyer tool backend

SECURITY PATCHES (api-v5):
  F7: Tier is now read from DB via session token — never trusted from request body/params.
      Unauthenticated callers default to FREE tier limits (fail-safe).
  F5: Raw exceptions not returned to client.
"""
import json
import math
import os
import logging
import pymssql
import azure.functions as func
from shared.cache import check_rate_limit
from shared.db import cors_headers
from shared.auth import get_session_phone


def get_tier_limits(tier):
    t = (tier or 'FREE').upper()
    if t in ('CORPORATE', 'ENTERPRISE', 'OGA_BOSS', 'GOVERNMENT'):
        return {'tier': t, 'maxItems': 999, 'showSavings': True, 'showOptimal': True, 'canExport': True}
    if t == 'BUSINESS':
        return {'tier': t, 'maxItems': 20, 'showSavings': True, 'showOptimal': True, 'canExport': True}
    if t == 'GOLD':
        return {'tier': t, 'maxItems': 10, 'showSavings': True, 'showOptimal': True, 'canExport': True}
    if t == 'SILVER':
        return {'tier': t, 'maxItems': 5, 'showSavings': False, 'showOptimal': False, 'canExport': False}
    return {'tier': 'FREE', 'maxItems': 3, 'showSavings': False, 'showOptimal': False, 'canExport': False}


def get_bulk_conn():
    user = os.environ.get('SQL_USERNAME') or os.environ.get('SQL_USER', '')
    return pymssql.connect(
        server        = os.environ['SQL_SERVER'],
        database      = os.environ['SQL_DATABASE'],
        user          = user,
        password      = os.environ['SQL_PASSWORD'],
        as_dict       = True,
        timeout       = 0,
        login_timeout = 30
    )


def _get_tier_from_db(phone: str) -> str:
    """
    F7 FIX: Fetch real subscription tier from DB using session phone.
    Never trust tier from client request.
    Falls back to FREE on any error — always safe direction.
    """
    if not phone:
        return 'FREE'
    try:
        conn = get_bulk_conn()
        cur  = conn.cursor()
        cur.execute(
            "SELECT subscription_tier FROM dbo.Consumers WHERE phone=%s OR phone_number=%s",
            (phone, phone)
        )
        row = cur.fetchone()
        conn.close()
        if row and row.get('subscription_tier'):
            return str(row['subscription_tier']).upper()
        return 'FREE'
    except Exception as e:
        logging.error(f'[bulk_calculator] _get_tier_from_db error: {e}')
        return 'FREE'  # Fail safe to lowest tier


def handle_items(tier, headers):
    limits = get_tier_limits(tier)
    try:
        conn = get_bulk_conn()
        cur  = conn.cursor()
        cur.execute(
            """SELECT DISTINCT item_id, item_name,
                      COALESCE(category_name, category_id) AS category_name, unit
               FROM   dbo.Latest_Prices_Summary
               WHERE  is_nbs_ref = 0 AND is_food = 1
                 AND  item_name IS NOT NULL AND item_name != ''
                 AND  price_naira > 0
               ORDER  BY category_name, item_name"""
        )
        rows  = cur.fetchall()
        conn.close()
        items = [{'id': r['item_id'], 'name': r['item_name'],
                  'category': r['category_name'] or 'Other',
                  'unit': r['unit'] or 'unit'} for r in rows]
        return func.HttpResponse(
            json.dumps({'success': True, 'items': items, 'tierLimits': limits}),
            status_code=200, headers=headers
        )
    except Exception as e:
        logging.error(f'[bulk_calculator] items error: {e}')
        return func.HttpResponse(
            json.dumps({'success': False, 'error': 'Failed to load items'}),
            status_code=500, headers=headers
        )


def handle_nbs_refs(headers):
    try:
        conn = get_bulk_conn()
        cur  = conn.cursor()
        cur.execute(
            """SELECT item_name, AVG(price_naira) AS nbs_price
               FROM   dbo.Latest_Prices_Summary
               WHERE  is_nbs_ref = 1 AND price_naira > 0 AND item_name IS NOT NULL
               GROUP  BY item_name"""
        )
        rows = cur.fetchall()
        conn.close()
        refs = {}
        for r in rows:
            price = float(r['nbs_price']) if r['nbs_price'] is not None else 0
            if price > 0:
                refs[r['item_name']] = price
        return func.HttpResponse(json.dumps({'refs': refs}), status_code=200, headers=headers)
    except Exception as e:
        logging.error(f'[bulk_calculator] nbs_refs error: {e}')
        return func.HttpResponse(json.dumps({'refs': {}}), status_code=200, headers=headers)


def handle_calculate(body, tier, headers):
    """F7 FIX: tier param now comes from DB lookup, not body."""
    cart   = body.get('cart', [])
    limits = get_tier_limits(tier)

    if not cart:
        return func.HttpResponse(
            json.dumps({'success': False, 'error': 'Cart is empty'}),
            status_code=400, headers=headers
        )

    capped = cart[:limits['maxItems']]

    item_market_prices = []
    conn = get_bulk_conn()
    try:
        cur = conn.cursor()
        for cart_item in capped:
            cur.execute(
                """SELECT market_name, market_id, state, price_naira
                   FROM   dbo.Latest_Prices_Summary
                   WHERE  item_name=%s AND is_nbs_ref=0 AND is_food=1 AND price_naira>0
                   ORDER  BY price_naira ASC""",
                (cart_item['item'],)
            )
            rows = cur.fetchall()
            item_market_prices.append([
                {'market_name': r['market_name'], 'market_id': r['market_id'],
                 'state': r['state'], 'price_naira': float(r['price_naira'])}
                for r in rows
            ])
    finally:
        conn.close()

    breakdowns = []
    for i, cart_item in enumerate(capped):
        mprices = item_market_prices[i]
        if not mprices:
            continue
        prices = [m['price_naira'] for m in mprices]
        min_p  = prices[0]
        max_p  = prices[-1]
        avg_p  = sum(prices) / len(prices)
        qty    = cart_item.get('quantity', 1)

        quotes = [{
            'market':        m['market_name'],
            'marketId':      m['market_id'],
            'state':         m['state'],
            'region':        m['state'],
            'unitPrice':     m['price_naira'],
            'totalPrice':    m['price_naira'] * qty,
            'available':     True,
            'priceRank':     qi + 1,
            'savingsVsAvg':  (avg_p - m['price_naira']) * qty,
            'savingsPercent': ((avg_p - m['price_naira']) / avg_p * 100) if avg_p > 0 else 0,
        } for qi, m in enumerate(mprices)]

        breakdowns.append({
            'item':       cart_item['item'],
            'quantity':   qty,
            'unit':       cart_item.get('unit', ''),
            'avgPrice':   avg_p,
            'minPrice':   min_p,
            'maxPrice':   max_p,
            'priceRange': max_p - min_p,
            'marketQuotes': quotes,
            'bestMarket': {'market': mprices[0]['market_name'], 'price': min_p,
                           'savings': (avg_p - min_p) * qty},
            'worstMarket': {'market': mprices[-1]['market_name'], 'price': max_p,
                            'premium': (max_p - avg_p) * qty} if len(mprices) > 1 else None,
        })

    total_qty = sum(c.get('quantity', 1) for c in capped)
    est_cost  = sum(b['avgPrice'] * b['quantity'] for b in breakdowns)
    min_cost  = sum(b['minPrice'] * b['quantity'] for b in breakdowns)
    pot_savings = est_cost - min_cost

    optimal = None
    if limits['showOptimal'] and breakdowns:
        purchases = [{'item': b['item'], 'quantity': b['quantity'],
                      'market': b['marketQuotes'][0]['market'],
                      'unitPrice': b['marketQuotes'][0]['unitPrice'],
                      'totalPrice': b['marketQuotes'][0]['totalPrice']} for b in breakdowns]
        mkt_map = {}
        for p in purchases:
            if p['market'] not in mkt_map:
                mkt_map[p['market']] = {'items': 0, 'subtotal': 0}
            mkt_map[p['market']]['items']    += 1
            mkt_map[p['market']]['subtotal'] += p['totalPrice']
        opt_total = sum(p['totalPrice'] for p in purchases)
        optimal = {
            'totalCost':     opt_total,
            'totalSavings':  est_cost - opt_total,
            'savingsPercent': round((est_cost - opt_total) / est_cost * 100) if est_cost > 0 else 0,
            'purchases':     purchases,
            'marketBreakdown': sorted(
                [{'market': m, 'items': d['items'], 'subtotal': d['subtotal']}
                 for m, d in mkt_map.items()],
                key=lambda x: -x['subtotal']
            ),
        }

    mkt_cov = {}
    for b in breakdowns:
        for q in b['marketQuotes']:
            if q['market'] not in mkt_cov:
                mkt_cov[q['market']] = {'total': 0, 'count': 0}
            mkt_cov[q['market']]['total'] += q['totalPrice']
            mkt_cov[q['market']]['count'] += 1

    opt_total_val = optimal['totalCost'] if optimal else min_cost
    single_compare = sorted(
        [{'market': m, 'totalCost': d['total'], 'itemsAvailable': d['count'],
          'vsOptimal': max(0, d['total'] - opt_total_val)} for m, d in mkt_cov.items()],
        key=lambda x: x['totalCost']
    )[:10]
    if single_compare:
        single_compare[0]['vsOptimal'] = 0

    insights = []
    if limits['showSavings'] and breakdowns:
        high_var = sorted(
            breakdowns,
            key=lambda b: (b['priceRange'] / b['avgPrice']) if b['avgPrice'] > 0 else 0,
            reverse=True
        )
        if high_var and high_var[0]['avgPrice'] > 0:
            pct = high_var[0]['priceRange'] / high_var[0]['avgPrice']
            if pct > 0.15:
                insights.append({
                    'type':    'variance',
                    'message': f"{high_var[0]['item']} varies {round(pct*100)}% across markets. Always shop around for this item.",
                    'impact':  'high'
                })
        if optimal and optimal['totalSavings'] > 0:
            insights.append({
                'type':    'savings',
                'message': f"Buying each item from its cheapest market saves \u20a6{optimal['totalSavings']:,.0f} ({optimal['savingsPercent']}% off average prices).",
                'impact':  'high'
            })
        if single_compare and optimal and single_compare[0]['itemsAvailable'] >= len(capped):
            extra = single_compare[0]['totalCost'] - optimal['totalCost']
            if extra > 0:
                insights.append({
                    'type':    'convenience',
                    'message': f"{single_compare[0]['market']} has all your items. One-stop costs \u20a6{extra:,.0f} more than the optimal split-market strategy.",
                    'impact':  'medium'
                })

    import datetime
    return func.HttpResponse(json.dumps({
        'success':              True,
        'timestamp':            datetime.datetime.utcnow().isoformat() + 'Z',
        'cartSummary': {
            'totalItems':      len(breakdowns),
            'totalQuantity':   total_qty,
            'estimatedCost':   est_cost,
            'potentialSavings': pot_savings,
            'savingsPercent':  round(pot_savings / est_cost * 100) if est_cost > 0 else 0,
        },
        'itemBreakdowns':       breakdowns,
        'optimalStrategy':      optimal,
        'singleMarketComparison': single_compare,
        'insights':             insights,
        'tierLimits':           limits,
        'dataSource':           'Latest_Prices_Summary',
        'recordCount':          sum(len(b['marketQuotes']) for b in breakdowns),
    }), status_code=200, headers=headers)


def main(req: func.HttpRequest) -> func.HttpResponse:
    ip = req.headers.get('X-Forwarded-For', req.headers.get('X-Real-IP', 'unknown')).split(',')[0].strip()
    if not check_rate_limit(ip, 'bulk_calc', 30, 60):
        return func.HttpResponse(
            '{"error":"Rate limit exceeded. Max 30 requests per minute."}',
            status_code=429, mimetype='application/json'
        )
    headers = cors_headers()
    if req.method == 'OPTIONS':
        return func.HttpResponse('', status_code=200, headers=headers)

    qtype = req.params.get('type', 'items')

    if qtype == 'nbs_refs':
        return handle_nbs_refs(headers)

    if req.method == 'POST' or qtype == 'calculate':
        try:
            body = req.get_json()
        except Exception:
            body = {}

        # ── F7 FIX: Fetch real tier from DB via session — ignore body tier ────
        session_phone = get_session_phone(req)
        tier          = _get_tier_from_db(session_phone)  # FREE if no session
        # ─────────────────────────────────────────────────────────────────────

        return handle_calculate(body, tier, headers)

    # Items listing — tier from session (unauthenticated gets FREE limits)
    session_phone = get_session_phone(req)
    tier          = _get_tier_from_db(session_phone)
    return handle_items(tier, headers)
