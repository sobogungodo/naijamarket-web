"""
waitlist_handler — Waitlist DB operations

SECURITY PATCHES (api-v5):
  F10: GET (aggregate stats) now requires X-API-Key header matching
       NAIJAMARKET_API_KEY env var. Prevents competitors monitoring
       signup traction daily.
  F5:  Raw exceptions not returned to client.
"""
import json
import os
import logging
import azure.functions as func
from shared.db import get_connection, cors_headers
from shared.cache import check_rate_limit

_API_KEY = os.environ.get("NAIJAMARKET_API_KEY", "")


def _is_admin_request(req) -> bool:
    """Check X-API-Key header for stats endpoint."""
    key = req.headers.get("X-API-Key", "") or req.params.get("admin_key", "")
    return bool(_API_KEY and key == _API_KEY)


def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method not in ('OPTIONS', 'GET'):
        ip = req.headers.get('X-Forwarded-For', req.headers.get('X-Real-IP', 'unknown')).split(',')[0].strip()
        if not check_rate_limit(ip, 'waitlist', 10, 60):
            headers = cors_headers()
            return func.HttpResponse(
                '{"error":"Too many requests. Try again in a minute."}',
                status_code=429, headers=headers, mimetype='application/json'
            )
    headers = cors_headers()
    if req.method == 'OPTIONS':
        return func.HttpResponse('', status_code=200, headers=headers)

    if req.method == 'GET':
        # F10 FIX: Require API key for stats endpoint
        if not _is_admin_request(req):
            return func.HttpResponse(
                json.dumps({'error': 'Unauthorized'}),
                status_code=401, headers=headers
            )
        try:
            conn = get_connection()
            cur  = conn.cursor()
            cur.execute(
                """SELECT
                     COUNT(*) AS total,
                     SUM(CASE WHEN interest='TRADER'   THEN 1 ELSE 0 END) AS traders,
                     SUM(CASE WHEN interest='CONSUMER' THEN 1 ELSE 0 END) AS consumers,
                     SUM(CASE WHEN market_area='Lagos' THEN 1 ELSE 0 END) AS lagos,
                     SUM(CASE WHEN market_area='Anambra (Onitsha)' THEN 1 ELSE 0 END) AS anambra
                   FROM dbo.Waitlist"""
            )
            row = cur.fetchone()
            conn.close()
            return func.HttpResponse(json.dumps(row or {}), status_code=200, headers=headers)
        except Exception as e:
            logging.error(f'[waitlist] GET error: {e}')
            return func.HttpResponse(
                json.dumps({'error': 'Failed'}),
                status_code=500, headers=headers
            )

    # POST — public, no auth required (anyone can join waitlist)
    try:
        body = req.get_json()
    except Exception:
        return func.HttpResponse(
            json.dumps({'error': 'Invalid JSON'}),
            status_code=400, headers=headers
        )

    phone       = body.get('phone', '')
    name        = body.get('name') or None
    email       = body.get('email') or None
    interest    = body.get('interest') or 'CONSUMER'
    market_area = body.get('market_area') or None
    ip          = body.get('ip') or None
    waitlist_id = body.get('id') or f"WL-{__import__('time').time_ns()}"

    if not phone:
        return func.HttpResponse(
            json.dumps({'error': 'Phone required'}),
            status_code=400, headers=headers
        )

    try:
        conn = get_connection()
        cur  = conn.cursor()

        cur.execute("SELECT waitlist_id FROM dbo.Waitlist WHERE phone_number=%s", (phone,))
        existing = cur.fetchone()
        if existing:
            conn.close()
            return func.HttpResponse(json.dumps({
                'success':   True,
                'duplicate': True,
                'message':   "You're already on the waitlist! We'll reach out on WhatsApp at launch."
            }), status_code=200, headers=headers)

        cur.execute(
            """INSERT INTO dbo.Waitlist
                 (waitlist_id, phone_number, name, email, interest, market_area, source, ip_address, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, 'landing_page', %s, GETUTCDATE())""",
            (waitlist_id, phone, name, email, interest, market_area, ip)
        )
        conn.commit()
        conn.close()

        return func.HttpResponse(json.dumps({
            'success': True,
            'message': "You're on the list! We'll text you on WhatsApp when we launch."
        }), status_code=200, headers=headers)

    except Exception as e:
        # F5 FIX: Log internally, generic message to client
        logging.error(f'[waitlist] POST error: {e}')
        return func.HttpResponse(
            json.dumps({'error': 'Something went wrong. Please try again.'}),
            status_code=500, headers=headers
        )
