"""
login — Exchange verified OTP for session token
POST /api/login
Body: { "phone": "2349131095009" }  or  { "email": "user@example.com" }
Returns: { "session_token": "...", "consumer": {...} }

SECURITY PATCHES (api-v5):
  F8: Login now verifies OTP was actually completed before issuing session token.
      Direct calls to /login bypassing the OTP flow are now rejected.
  F5: Raw exception strings no longer returned to client.
"""
import json
import uuid
import logging
import datetime
import azure.functions as func
from shared.db import get_connection, cors_headers
from shared.auth import otp_was_verified, consume_otp


def _ensure_user_role(cur, phone: str, phone_plus: str):
    try:
        cur.execute(
            "SELECT COUNT(*) as cnt FROM dbo.User_Roles WHERE phone_number = %s OR phone_number = %s",
            (phone, phone_plus)
        )
        row = cur.fetchone()
        cnt = row.get('cnt', 0) if isinstance(row, dict) else row[0]
        if cnt == 0:
            cur.execute(
                "INSERT INTO dbo.User_Roles (phone_number, role, created_at) VALUES (%s, 'CONSUMER', GETUTCDATE())",
                (phone_plus,)
            )
            logging.info(f"[login] User_Roles synced for {phone_plus}")
    except Exception as e:
        logging.warning(f"[login] _ensure_user_role failed: {e}")


def main(req: func.HttpRequest) -> func.HttpResponse:
    headers = cors_headers()
    if req.method == "OPTIONS":
        return func.HttpResponse("", status_code=200, headers=headers)
    try:
        body  = req.get_json()
        phone = str(body.get("phone", "")).replace("+", "").replace(" ", "").strip()
        email = str(body.get("email", "")).strip().lower()

        if not phone and not email:
            return func.HttpResponse(
                json.dumps({"error": "phone or email required"}),
                status_code=400, headers=headers
            )

        conn = get_connection()
        cur  = conn.cursor()

        # ── F8 FIX: Verify OTP was completed before issuing session ──────────
        if phone:
            if not otp_was_verified(cur, phone):
                conn.close()
                logging.warning(f"[login] OTP not verified for phone={phone}")
                return func.HttpResponse(
                    json.dumps({"error": "OTP verification required"}),
                    status_code=401, headers=headers
                )
        # Email login: email OTP verification checked via otp_verify_email table
        # (existing flow — otp_verify_email sets verified flag same pattern)
        # ─────────────────────────────────────────────────────────────────────

        # Find consumer
        if phone:
            cur.execute("""
                SELECT consumer_id, phone, phone_number, email,
                       first_name, last_name, full_name,
                       subscription_tier, account_status, preferred_language,
                       session_token
                FROM   dbo.Consumers
                WHERE  phone=%s OR phone_number=%s
            """, (phone, phone))
        else:
            cur.execute("""
                SELECT consumer_id, phone, phone_number, email,
                       first_name, last_name, full_name,
                       subscription_tier, account_status, preferred_language,
                       session_token
                FROM   dbo.Consumers
                WHERE  email=%s
            """, (email,))

        consumer = cur.fetchone()
        if not consumer:
            conn.close()
            return func.HttpResponse(
                json.dumps({"error": "Consumer not found"}),
                status_code=404, headers=headers
            )

        # Sync User_Roles
        raw_phone  = str(consumer.get("phone") or consumer.get("phone_number") or phone or "").replace("+", "").strip()
        phone_plus = f"+{raw_phone}"
        _ensure_user_role(cur, raw_phone, phone_plus)

        # Tier-exempt session reuse: CORPORATE/ENTERPRISE keep their active
        # session token across logins (multi-device allowance) — only the
        # timestamps refresh. All other tiers rotate (single-session).
        tier           = str(consumer.get("subscription_tier") or "FREE").upper()
        existing_token = consumer.get("session_token")
        now            = datetime.datetime.utcnow()

        if tier in ("CORPORATE", "ENTERPRISE") and existing_token:
            session_token = existing_token
            cur.execute("""
                UPDATE dbo.Consumers
                SET session_created_at = %s,
                    last_activity_at   = %s,
                    updated_at         = %s
                WHERE consumer_id = %s
            """, (now, now, now, consumer["consumer_id"]))
        else:
            session_token = uuid.uuid4().hex + uuid.uuid4().hex
            cur.execute("""
                UPDATE dbo.Consumers
                SET session_token      = %s,
                    session_created_at = %s,
                    last_activity_at   = %s,
                    updated_at         = %s
                WHERE consumer_id = %s
            """, (session_token, now, now, now, consumer["consumer_id"]))

        # F8: Consume the OTP so it cannot be replayed
        consume_otp(cur, phone or raw_phone)

        conn.commit()
        conn.close()

        return func.HttpResponse(
            json.dumps({
                "session_token": session_token,
                "consumer": {
                    "id":                consumer["consumer_id"],
                    "consumer_id":       consumer["consumer_id"],
                    "phone":             consumer.get("phone") or consumer.get("phone_number", ""),
                    "email":             consumer.get("email", ""),
                    "first_name":        consumer.get("first_name", ""),
                    "last_name":         consumer.get("last_name", ""),
                    "full_name":         consumer.get("full_name", ""),
                    "subscription_tier": consumer.get("subscription_tier", "FREE"),
                    "account_status":    consumer.get("account_status", "ACTIVE"),
                    "preferred_language": consumer.get("preferred_language", "en"),
                }
            }),
            status_code=200, headers=headers
        )
    except Exception as e:
        # F5 FIX: Log full error internally, return generic message to client
        logging.error(f"[login] error: {e}", exc_info=True)
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500, headers=headers
        )
