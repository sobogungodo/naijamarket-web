"""
otp_send — Send OTP via Meta Cloud API WhatsApp
POST /api/otp_send
Body: { "phone": "2349131095009" }

SECURITY PATCHES (api-v8):
  F6: OTP send rate limiting — 60-second cooldown between sends per phone.
      Prevents WhatsApp message bombing attacks.
  F7: attempt_count + locked_until reset on fresh OTP issue.
      Prevents permanent lockout after OTP resend.
  F8: Raw exceptions not returned to client.

DELIVERY (api-v16):
  - Send via approved WhatsApp *template* `otp_verification` (works outside the
    24h session window, unlike freeform text).
  - _send_whatsapp_otp now returns bool; main() reports 502 + success:false when
    the code is stored but NOT delivered (no more false success:true).
"""
import json
import random
import string
import logging
import datetime
import os
import azure.functions as func
from shared.db import get_connection, cors_headers
import requests

META_TOKEN    = os.environ.get("META_ACCESS_TOKEN", "")
META_PHONE_ID = os.environ.get("META_PHONE_NUMBER_ID", "")
META_VERSION  = "v19.0"
OTP_COOLDOWN_SECS = 60  # minimum seconds between OTP sends per phone


def main(req: func.HttpRequest) -> func.HttpResponse:
    headers = cors_headers()
    if req.method == "OPTIONS":
        return func.HttpResponse("", status_code=200, headers=headers)
    try:
        body  = req.get_json()
        phone = str(body.get("phone", "")).replace("+", "").replace(" ", "").strip()
        if not phone:
            return func.HttpResponse(
                json.dumps({"error": "phone required"}),
                status_code=400, headers=headers
            )

        # ── F6: Rate limiting — check cooldown ────────────────────────────
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            SELECT created_at FROM dbo.OTP_Sessions
            WHERE phone_number = %s
        """, (phone,))
        row = cur.fetchone()
        conn.close()

        if row:
            last_sent = row.get("created_at")
            if last_sent:
                if isinstance(last_sent, str):
                    last_sent = datetime.datetime.fromisoformat(last_sent)
                elapsed = (datetime.datetime.utcnow() - last_sent).total_seconds()
                if elapsed < OTP_COOLDOWN_SECS:
                    wait = int(OTP_COOLDOWN_SECS - elapsed) + 1
                    return func.HttpResponse(
                        json.dumps({
                            "error": f"Please wait {wait} seconds before requesting a new code."
                        }),
                        status_code=429, headers=headers
                    )
        # ─────────────────────────────────────────────────────────────────

        otp = "".join(random.choices(string.digits, k=6))
        _store_otp(phone, otp)
        delivered = _send_whatsapp_otp(phone, otp)
        if not delivered:
            logging.warning(f"[otp_send] OTP stored but NOT delivered to {phone}")
            return func.HttpResponse(
                json.dumps({"success": False, "error": "Code could not be delivered. Please try again."}),
                status_code=502, headers=headers
            )
        logging.info(f"[otp_send] OTP sent to {phone}")
        return func.HttpResponse(
            json.dumps({"success": True}),
            status_code=200, headers=headers
        )
    except Exception as e:
        # F8: Log full error internally, return generic message to client
        logging.error(f"[otp_send] error: {e}", exc_info=True)
        return func.HttpResponse(
            json.dumps({"error": "Failed to send verification code. Please try again."}),
            status_code=500, headers=headers
        )


def _store_otp(phone: str, otp: str):
    conn = get_connection()
    cur  = conn.cursor()
    # F7: Reset attempt_count and locked_until on fresh OTP issue
    cur.execute("""
        MERGE dbo.OTP_Sessions AS t
        USING (SELECT %s AS phone_number) AS s ON t.phone_number = s.phone_number
        WHEN MATCHED THEN UPDATE SET
            otp_code      = %s,
            created_at    = GETUTCDATE(),
            expires_at    = DATEADD(MINUTE, 10, GETUTCDATE()),
            verified      = 0,
            attempt_count = 0,
            locked_until  = NULL
        WHEN NOT MATCHED THEN INSERT
            (phone_number, otp_code, created_at, expires_at, verified,
             attempt_count, locked_until)
        VALUES (%s, %s, GETUTCDATE(), DATEADD(MINUTE, 10, GETUTCDATE()), 0, 0, NULL);
    """, (phone, otp, phone, otp))
    conn.commit()
    conn.close()


def _send_whatsapp_otp(phone: str, otp: str) -> bool:
    if not META_TOKEN or not META_PHONE_ID:
        logging.warning("[otp_send] Meta not configured — OTP not sent")
        return False
    try:
        resp = requests.post(
            f"https://graph.facebook.com/{META_VERSION}/{META_PHONE_ID}/messages",
            headers={"Authorization": f"Bearer {META_TOKEN}",
                     "Content-Type": "application/json"},
            json={
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": phone,
                "type": "template",
                "template": {
                    "name": "otp_verification",
                    "language": {"code": "en"},
                    "components": [
                        {
                            "type": "body",
                            "parameters": [
                                {"type": "text", "text": otp}
                            ]
                        },
                        {
                            "type": "button",
                            "sub_type": "url",
                            "index": "0",
                            "parameters": [
                                {"type": "text", "text": otp}
                            ]
                        }
                    ]
                }
            },
            timeout=15
        )
        logging.info(f"[otp_send] WhatsApp HTTP {resp.status_code} for {phone}")
        if resp.status_code == 401:
            logging.error("[otp_send] Meta token expired or invalid — rotate META_ACCESS_TOKEN")
        return resp.ok
    except Exception as e:
        logging.error(f"[otp_send] WhatsApp error: {e}")
        return False
