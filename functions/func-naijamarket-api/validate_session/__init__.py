"""
validate_session — Validate session token, return fresh consumer data
POST /api/validate_session
Body: { "consumer_id": "...", "session_token": "..." }
"""
import json
import logging
import datetime
import azure.functions as func
from shared.db import get_connection, cors_headers


def main(req: func.HttpRequest) -> func.HttpResponse:
    headers = cors_headers()
    if req.method == "OPTIONS":
        return func.HttpResponse("", status_code=200, headers=headers)
    try:
        body         = req.get_json()
        consumer_id  = str(body.get("consumer_id","")).strip()
        session_token= str(body.get("session_token","")).strip()

        if not consumer_id or not session_token:
            return func.HttpResponse(
                json.dumps({"valid": False, "error": "consumer_id and session_token required"}),
                status_code=400, headers=headers
            )

        conn = get_connection(); cur = conn.cursor()
        cur.execute("""
            SELECT consumer_id, phone, phone_number, email,
                   first_name, last_name, full_name,
                   subscription_tier, account_status,
                   preferred_language, session_token,
                   session_created_at
            FROM dbo.Consumers
            WHERE consumer_id=%s AND session_token=%s
        """, (consumer_id, session_token))
        row = cur.fetchone()

        if not row:
            conn.close()
            return func.HttpResponse(
                json.dumps({"valid": False, "error": "Invalid session"}),
                status_code=200, headers=headers
            )

        # Check session age (24 hours)
        created = row.get("session_created_at")
        if created:
            if isinstance(created, str):
                created = datetime.datetime.fromisoformat(created)
            if (datetime.datetime.utcnow() - created).total_seconds() > 86400:
                conn.close()
                return func.HttpResponse(
                    json.dumps({"valid": False, "error": "Session expired"}),
                    status_code=200, headers=headers
                )

        # Update last activity
        cur.execute("""
            UPDATE dbo.Consumers SET last_activity_at=GETUTCDATE()
            WHERE consumer_id=%s
        """, (consumer_id,))
        conn.commit(); conn.close()

        return func.HttpResponse(
            json.dumps({
                "valid": True,
                "consumer": {
                    "id":                row["consumer_id"],
                    "consumer_id":       row["consumer_id"],
                    "phone":             row.get("phone") or row.get("phone_number",""),
                    "email":             row.get("email",""),
                    "first_name":        row.get("first_name",""),
                    "last_name":         row.get("last_name",""),
                    "full_name":         row.get("full_name",""),
                    "subscription_tier": row.get("subscription_tier","FREE"),
                    "account_status":    row.get("account_status","ACTIVE"),
                    "preferred_language":row.get("preferred_language","en"),
                }
            }),
            status_code=200, headers=headers
        )
    except Exception as e:
        logging.error(f"[validate_session] error: {e}")
        return func.HttpResponse(
            json.dumps({"valid": False, "error": "Internal server error"}),
            status_code=500, headers=headers
        )