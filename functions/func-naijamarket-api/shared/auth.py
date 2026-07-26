"""
shared/auth.py — Session authentication helpers.

SECURITY PATCHES (api-v5):
  F2+F3: Centralised session validation so account_data and bulk_calculator
         always bind requests to the authenticated phone — never trust client-
         supplied phone params.
  F8:    login() checks OTP was verified before issuing session token.
"""
import datetime
import logging
from shared.db import get_connection


def get_session_phone(req) -> str | None:
    """
    Extract and verify phone from Bearer session token in Authorization header.
    Returns the phone string (normalised, no +) on success, None on failure.

    All protected endpoints call this first. If None → return 401 immediately.
    The phone returned is sourced from the DB — never from the request body.
    """
    token = req.headers.get("Authorization", "").replace("Bearer ", "").strip()
    if not token or len(token) < 32:
        return None
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            SELECT phone, phone_number, session_created_at, account_status
            FROM   dbo.Consumers
            WHERE  session_token = %s
        """, (token,))
        row = cur.fetchone()
        conn.close()

        if not row:
            return None
        if (row.get("account_status") or "").upper() != "ACTIVE":
            return None

        created = row.get("session_created_at")
        if created:
            if isinstance(created, str):
                created = datetime.datetime.fromisoformat(created)
            age = (datetime.datetime.utcnow() - created).total_seconds()
            if age > 86400:   # 24-hour expiry
                return None

        phone = str(row.get("phone") or row.get("phone_number") or "").strip()
        return phone if phone else None

    except Exception as e:
        logging.error(f"[auth] get_session_phone error: {e}")
        return None


def otp_was_verified(cur, phone: str) -> bool:
    """
    F8 FIX: Check that OTP was actually verified for this phone before
    issuing a session token. Called inside login handler.
    Returns True only if a fresh verified OTP exists.
    """
    try:
        cur.execute("""
            SELECT verified, expires_at
            FROM   dbo.OTP_Sessions
            WHERE  phone_number = %s
              AND  verified = 1
              AND  expires_at > DATEADD(MINUTE, -10, GETUTCDATE())
        """, (phone,))
        return cur.fetchone() is not None
    except Exception as e:
        logging.error(f"[auth] otp_was_verified error: {e}")
        return False


def consume_otp(cur, phone: str):
    """Invalidate OTP after successful login so it cannot be replayed."""
    try:
        cur.execute(
            "UPDATE dbo.OTP_Sessions SET verified = 0 WHERE phone_number = %s",
            (phone,)
        )
    except Exception as e:
        logging.warning(f"[auth] consume_otp error: {e}")
