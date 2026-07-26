"""
otp_verify — Verify WhatsApp OTP
POST /api/otp_verify
Body: { "phone": "2349131095009", "otp": "123456" }

SECURITY PATCHES (api-v5):
  F4: Brute-force lockout added — 5 wrong attempts locks account for 30 minutes.
      Attempt counter incremented on every wrong guess.
      Lockout checked before OTP comparison.
  F5: Raw exceptions not returned to client.

PREREQUISITE: Run this DDL once in Portal Query Editor before deploying:
  ALTER TABLE dbo.OTP_Sessions
    ADD attempt_count INT DEFAULT 0,
        locked_until  DATETIME2 NULL;
"""
import json
import logging
import datetime
import azure.functions as func
from shared.db import get_connection, cors_headers

MAX_ATTEMPTS  = 5
LOCKOUT_MINS  = 30


def main(req: func.HttpRequest) -> func.HttpResponse:
    headers = cors_headers()
    if req.method == "OPTIONS":
        return func.HttpResponse("", status_code=200, headers=headers)
    try:
        body  = req.get_json()
        phone = str(body.get("phone", "")).replace("+", "").replace(" ", "").strip()
        otp   = str(body.get("otp", "")).strip()

        if not phone or not otp:
            return func.HttpResponse(
                json.dumps({"error": "phone and otp required"}),
                status_code=400, headers=headers
            )

        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            SELECT otp_code, expires_at, verified,
                   COALESCE(attempt_count, 0) AS attempt_count,
                   locked_until
            FROM   dbo.OTP_Sessions
            WHERE  phone_number = %s
        """, (phone,))
        row = cur.fetchone()

        if not row:
            conn.close()
            return func.HttpResponse(
                json.dumps({"valid": False, "error": "OTP not found"}),
                status_code=200, headers=headers
            )

        # ── F4 FIX: Check lockout before anything else ────────────────────────
        locked_until = row.get("locked_until")
        if locked_until:
            if isinstance(locked_until, str):
                locked_until = datetime.datetime.fromisoformat(locked_until)
            if locked_until > datetime.datetime.utcnow():
                conn.close()
                remaining = int((locked_until - datetime.datetime.utcnow()).total_seconds() // 60) + 1
                return func.HttpResponse(
                    json.dumps({
                        "valid": False,
                        "error": f"Too many attempts. Try again in {remaining} minute(s)."
                    }),
                    status_code=429, headers=headers
                )
        # ─────────────────────────────────────────────────────────────────────

        if row["verified"]:
            conn.close()
            return func.HttpResponse(
                json.dumps({"valid": False, "error": "OTP already used"}),
                status_code=200, headers=headers
            )

        expires = row["expires_at"]
        if isinstance(expires, str):
            expires = datetime.datetime.fromisoformat(expires)
        if expires < datetime.datetime.utcnow():
            conn.close()
            return func.HttpResponse(
                json.dumps({"valid": False, "error": "OTP expired"}),
                status_code=200, headers=headers
            )

        if str(row["otp_code"]).strip() != otp:
            # ── F4: Increment attempt counter, lock if threshold reached ──────
            new_count = int(row["attempt_count"]) + 1
            if new_count >= MAX_ATTEMPTS:
                lock_time = datetime.datetime.utcnow() + datetime.timedelta(minutes=LOCKOUT_MINS)
                cur.execute("""
                    UPDATE dbo.OTP_Sessions
                    SET attempt_count = %s, locked_until = %s
                    WHERE phone_number = %s
                """, (new_count, lock_time, phone))
                conn.commit()
                conn.close()
                logging.warning(f"[otp_verify] Account locked for {phone} after {new_count} attempts")
                return func.HttpResponse(
                    json.dumps({
                        "valid": False,
                        "error": f"Too many attempts. Account locked for {LOCKOUT_MINS} minutes."
                    }),
                    status_code=429, headers=headers
                )
            else:
                cur.execute("""
                    UPDATE dbo.OTP_Sessions
                    SET attempt_count = %s
                    WHERE phone_number = %s
                """, (new_count, phone))
                conn.commit()
                conn.close()
                remaining_attempts = MAX_ATTEMPTS - new_count
                return func.HttpResponse(
                    json.dumps({
                        "valid": False,
                        "error": f"Incorrect OTP. {remaining_attempts} attempt(s) remaining."
                    }),
                    status_code=200, headers=headers
                )
            # ──────────────────────────────────────────────────────────────────

        # Correct OTP — mark verified, reset attempt counter
        cur.execute("""
            UPDATE dbo.OTP_Sessions
            SET verified = 1, attempt_count = 0, locked_until = NULL
            WHERE phone_number = %s
        """, (phone,))
        conn.commit()
        conn.close()

        return func.HttpResponse(
            json.dumps({"valid": True}),
            status_code=200, headers=headers
        )

    except Exception as e:
        # F5 FIX: Log full error internally, return generic message to client
        logging.error(f"[otp_verify] error: {e}", exc_info=True)
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500, headers=headers
        )
