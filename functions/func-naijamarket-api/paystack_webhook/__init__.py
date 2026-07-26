"""
NaijaMarket Intel — Paystack Webhook v1.2
func-naijamarket-api / paystack_webhook

SECURITY PATCHES (api-v5):
  F1a: HMAC verification now REJECTS on mismatch — no longer falls through.
       "test mode" bypass removed entirely.
  F1b: Amount validated against minimum tier price before activation.
       Prevents ₦1 payment activating ENTERPRISE.
  F13: DB connection timeout changed to 0 (was 30 — risked mid-write kill
       during S1→S2 autoscale).
  F5:  Raw exception strings no longer returned to client.
"""
import os
import json
import hmac
import hashlib
import logging
import datetime
import uuid

import azure.functions as func
import pymssql
import requests

PAYSTACK_SECRET = os.environ.get("PAYSTACK_SECRET_KEY", "")
META_TOKEN      = os.environ.get("META_ACCESS_TOKEN", "")
META_PHONE_ID   = os.environ.get("META_PHONE_NUMBER_ID", "")
META_VERSION    = "v25.0"

TIER_CONFIG = {
    "SILVER":    {"name": "SILVER",    "duration_days": 7,  "query_limit": 50},
    "GOLD":      {"name": "GOLD",      "duration_days": 30, "query_limit": 200},
    "BUSINESS":  {"name": "BUSINESS",  "duration_days": 30, "query_limit": 1000},
    "CORPORATE": {"name": "CORPORATE", "duration_days": 30, "query_limit": 5000},
    "ENTERPRISE": {"name": "ENTERPRISE", "duration_days": 30, "query_limit": 99999},
}

# F1b: Minimum expected payment per tier in NGN (90% of list price = Paystack fee buffer)
TIER_MIN_AMOUNTS = {
    "SILVER":     450,     # ₦500 × 0.90
    "GOLD":      1800,     # ₦2,000 × 0.90
    "BUSINESS": 13500,     # ₦15,000 × 0.90
    "CORPORATE": 45000,    # ₦50,000 × 0.90
    "ENTERPRISE": 135000,  # ₦150,000 × 0.90
}


def get_connection():
    return pymssql.connect(
        server        = os.environ["SQL_SERVER"],
        database      = os.environ["SQL_DATABASE"],
        user          = os.environ.get("SQL_USERNAME") or os.environ.get("SQL_USER", ""),
        password      = os.environ["SQL_PASSWORD"],
        as_dict       = True,
        timeout       = 0,        # F13: was 30 — changed to 0 to survive autoscale delays
        login_timeout = 30,
    )


def normalise_phone(raw: str) -> str:
    return raw.replace("+", "").replace(" ", "").replace("-", "").strip()


def find_consumer(phone_raw: str) -> dict:
    digits = normalise_phone(phone_raw)
    candidates = [digits]
    if digits.startswith("234"):
        candidates.append("+" + digits)
        candidates.append("0" + digits[3:])
    elif digits.startswith("0"):
        candidates.append("234" + digits[1:])
        candidates.append("+234" + digits[1:])

    try:
        conn = get_connection()
        cur  = conn.cursor()
        conditions = " OR ".join(["phone = %s OR phone_number = %s"] * len(candidates))
        params = []
        for c in candidates:
            params += [c, c]
        cur.execute(f"""
            SELECT TOP 1 consumer_id, phone, phone_number, subscription_tier, email
            FROM   dbo.Consumers
            WHERE  {conditions}
        """, params)
        row = cur.fetchone()
        conn.close()
        return row or {}
    except Exception as e:
        logging.error(f"[webhook] find_consumer error: {e}")
        return {}


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("[paystack_webhook] Request received")

    body_bytes = req.get_body()
    sig_header = req.headers.get("x-paystack-signature", "")

    # ── F1a: HMAC verification — HARD REJECT on failure ──────────────────────
    if not PAYSTACK_SECRET:
        logging.error("[paystack_webhook] PAYSTACK_SECRET_KEY not set — rejecting all requests")
        return func.HttpResponse("Unauthorized", status_code=401)

    expected = hmac.new(
        PAYSTACK_SECRET.encode("utf-8"),
        body_bytes,
        hashlib.sha512
    ).hexdigest()

    if not hmac.compare_digest(expected, sig_header):
        logging.warning(
            f"[paystack_webhook] Signature REJECTED. "
            f"Got={sig_header[:20] if sig_header else 'MISSING'} "
            f"Expected={expected[:20]}"
        )
        return func.HttpResponse("Unauthorized", status_code=401)
    # ─────────────────────────────────────────────────────────────────────────

    try:
        payload = json.loads(body_bytes)
    except Exception as e:
        logging.error(f"[paystack_webhook] JSON parse error: {e}")
        return func.HttpResponse("OK", status_code=200)

    event = payload.get("event", "")
    data  = payload.get("data", {})
    logging.info(f"[paystack_webhook] event={event} ref={data.get('reference', '')}")

    try:
        if event == "charge.success":
            _handle_charge_success(data)
        elif event == "charge.failed":
            _handle_charge_failed(data)
        elif event in ("subscription.disable", "subscription.not_renew"):
            logging.info("[paystack_webhook] subscription cancelled")
        elif event == "refund.processed":
            _handle_refund(data)
        elif event == "test":
            try:
                conn = get_connection()
                conn.close()
                return func.HttpResponse(
                    json.dumps({"db": "OK", "event": "test"}),
                    status_code=200,
                    headers={"Content-Type": "application/json"}
                )
            except Exception as db_err:
                logging.error(f"[paystack_webhook] test DB error: {db_err}")
                return func.HttpResponse(
                    json.dumps({"db": "FAIL"}),
                    status_code=200,
                    headers={"Content-Type": "application/json"}
                )
        else:
            logging.info(f"[paystack_webhook] Unhandled event: {event}")
    except Exception as e:
        logging.error(f"[paystack_webhook] Handler error: {e}", exc_info=True)
        # F5: Do not return str(e) — return generic OK (Paystack expects 200)
        return func.HttpResponse("OK", status_code=200)

    return func.HttpResponse("OK", status_code=200)


def _handle_charge_success(data: dict):
    reference  = data.get("reference", "")
    amount_ngn = int(data.get("amount", 0)) / 100
    meta       = data.get("metadata") or {}

    phone_raw   = str(meta.get("phone") or "").strip()
    tier        = str(meta.get("tier") or "").upper().strip()
    consumer_id = str(meta.get("consumer_id") or "").strip()

    logging.info(f"[webhook] charge.success ref={reference} phone_raw={phone_raw} tier={tier}")

    if not phone_raw:
        email = (data.get("customer") or {}).get("email", "")
        logging.error(f"[webhook] No phone in metadata. email={email}")
        return

    if not tier:
        logging.error("[webhook] No tier in metadata")
        return

    tier_cfg = TIER_CONFIG.get(tier)
    if not tier_cfg:
        logging.error(f"[webhook] Unknown tier: {tier}")
        return

    # ── F1b: Amount validation ────────────────────────────────────────────────
    min_amount = TIER_MIN_AMOUNTS.get(tier, 0)
    if amount_ngn < min_amount:
        logging.error(
            f"[webhook] Amount mismatch REJECTED: paid=₦{amount_ngn:,.0f} "
            f"minimum=₦{min_amount:,.0f} tier={tier} ref={reference}"
        )
        _log_failed_activation(reference, phone_raw, tier, amount_ngn, "AMOUNT_MISMATCH")
        return
    # ─────────────────────────────────────────────────────────────────────────

    if _already_processed(reference):
        logging.info(f"[webhook] Already processed ref={reference}")
        return

    consumer = find_consumer(phone_raw)
    if not consumer:
        logging.error(f"[webhook] Consumer not found for phone={phone_raw}")
        _log_failed_activation(reference, phone_raw, tier, amount_ngn, "CONSUMER_NOT_FOUND")
        return

    if not consumer_id:
        consumer_id = consumer.get("consumer_id", "")

    db_phone = consumer.get("phone") or consumer.get("phone_number") or phone_raw

    now      = datetime.datetime.utcnow()
    end_date = now + datetime.timedelta(days=tier_cfg["duration_days"])
    sub_id   = f"SUB-{uuid.uuid4().hex[:12].upper()}"
    txn_id   = f"TXN-{uuid.uuid4().hex[:12].upper()}"
    billing  = "WEEKLY" if tier == "SILVER" else "MONTHLY"

    conn = get_connection()
    cur  = conn.cursor()

    cur.execute("""
        UPDATE dbo.Consumers
        SET subscription_tier       = %s,
            subscription_start_date = %s,
            subscription_end_date   = %s,
            daily_query_limit       = %s,
            account_status          = 'ACTIVE',
            updated_at              = GETUTCDATE()
        WHERE consumer_id = %s
    """, (tier, now, end_date, tier_cfg["query_limit"], consumer_id))
    logging.info(f"[webhook] Consumers updated: {cur.rowcount} rows")

    # One ACTIVE row per consumer: supersede ALL existing ACTIVE rows for this
    # consumer (any channel — matched by consumer_id OR phone in +/non-+ form)
    # then INSERT the new ACTIVE row. Replaces the previous MERGE-ON-consumer_id,
    # which could reactivate a stale row or hit a cardinality error on duplicate
    # consumer_ids (e.g. a web-verify row + a webhook row).
    cur.execute("""
        UPDATE dbo.Consumer_Active_Subscriptions
        SET status = 'SUPERSEDED', updated_at = GETUTCDATE()
        WHERE status = 'ACTIVE'
          AND ( consumer_id = %s
             OR REPLACE(phone_number, '+', '') = REPLACE(%s, '+', '') )
    """, (consumer_id, db_phone))

    cur.execute("""
        INSERT INTO dbo.Consumer_Active_Subscriptions
            (subscription_id, consumer_id, phone_number,
             tier_code, tier_name, status, start_date, end_date,
             payment_reference, payment_provider,
             payment_amount, amount_paid, billing_cycle,
             created_at, updated_at)
        VALUES
            (%s, %s, %s, %s, %s, 'ACTIVE', %s, %s, %s, 'PAYSTACK',
             %s, %s, %s, GETUTCDATE(), GETUTCDATE());
    """, (
        sub_id, consumer_id, db_phone, tier, tier, now, end_date, reference,
        amount_ngn, amount_ngn, billing,
    ))

    cur.execute("""
        UPDATE dbo.Payment_Logs
        SET status = 'COMPLETED', completed_at = GETUTCDATE(),
            verified_at = GETUTCDATE(), updated_at = GETUTCDATE()
        WHERE payment_reference = %s
    """, (reference,))

    cur.execute("""
        INSERT INTO dbo.Subscription_Transactions
            (transaction_id, consumer_id, phone_number,
             transaction_type, product_code, product_name,
             billing_cycle, gross_amount, net_amount, currency,
             payment_provider, payment_reference,
             payment_status, subscription_start, subscription_end,
             created_at, completed_at, verified_at)
        VALUES
            (%s, %s, %s, 'NEW_SUBSCRIPTION', %s, %s,
             %s, %s, %s, 'NGN', 'PAYSTACK', %s,
             'COMPLETED', %s, %s,
             GETUTCDATE(), GETUTCDATE(), GETUTCDATE())
    """, (
        txn_id, consumer_id, db_phone,
        tier, f"NaijaMarket Intel {tier}",
        billing, amount_ngn, amount_ngn,
        reference, str(now.date()), str(end_date.date()),
    ))

    conn.commit()
    conn.close()
    logging.info(
        f"[webhook] ✅ Activated consumer_id={consumer_id} "
        f"tier={tier} end={end_date.date()} ref={reference}"
    )
    _send_whatsapp_confirmation(db_phone, tier, end_date, amount_ngn)


def _handle_charge_failed(data: dict):
    reference = data.get("reference", "")
    meta      = data.get("metadata") or {}
    phone_raw = str(meta.get("phone") or "").strip()
    tier      = str(meta.get("tier") or "").upper().strip()
    reason    = data.get("gateway_response", "Payment failed")
    logging.info(f"[webhook] charge.failed ref={reference}")
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            UPDATE dbo.Payment_Logs
            SET status = 'FAILED', failure_reason = %s, updated_at = GETUTCDATE()
            WHERE payment_reference = %s
        """, (reason[:500], reference))
        conn.commit()
        conn.close()
    except Exception as e:
        logging.error(f"[webhook] log charge.failed error: {e}")
    if phone_raw:
        _send_whatsapp_failure(phone_raw, tier, reason)


def _handle_refund(data: dict):
    reference = data.get("transaction_reference", "")
    amount    = int(data.get("amount", 0)) / 100
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            UPDATE dbo.Payment_Logs
            SET refund_status = 'REFUNDED', refund_amount = %s, updated_at = GETUTCDATE()
            WHERE payment_reference = %s
        """, (amount, reference))
        conn.commit()
        conn.close()
    except Exception as e:
        logging.error(f"[webhook] refund error: {e}")


def _already_processed(reference: str) -> bool:
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            SELECT 1 FROM dbo.Subscription_Transactions
            WHERE payment_reference = %s AND payment_status = 'COMPLETED'
        """, (reference,))
        row = cur.fetchone()
        conn.close()
        return row is not None
    except Exception as e:
        logging.error(f"[webhook] idempotency error: {e}")
        return False


def _log_failed_activation(ref, phone, tier, amount, reason):
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            UPDATE dbo.Payment_Logs
            SET status = 'ACTIVATION_FAILED', failure_reason = %s, updated_at = GETUTCDATE()
            WHERE payment_reference = %s
        """, (reason, ref))
        conn.commit()
        conn.close()
    except Exception as e:
        logging.error(f"[webhook] _log_failed_activation error: {e}")


def _send_whatsapp_confirmation(phone, tier, end_date, amount):
    if not META_TOKEN or not META_PHONE_ID:
        logging.warning("[webhook] Meta not configured")
        return
    clean = normalise_phone(phone)
    body  = (
        f"✅ *Payment Confirmed!*\n\n"
        f"Welcome to NaijaMarket Intel *{tier}*!\n\n"
        f"Amount paid: ₦{amount:,.0f}\n"
        f"Valid until: {end_date.strftime('%d %b %Y')}\n\n"
        f"Your subscription is now active. Type *menu* to get started."
    )
    _send_meta(clean, body)


def _send_whatsapp_failure(phone, tier, reason):
    if not META_TOKEN or not META_PHONE_ID:
        return
    clean = normalise_phone(phone)
    body  = (
        f"❌ *Payment Failed*\n\n"
        f"Your payment for *{tier}* could not be processed.\n"
        f"Reason: {reason}\n\n"
        f"Please try again or visit naijamarketintel.ng"
    )
    _send_meta(clean, body)


def _send_meta(phone, body):
    try:
        url  = f"https://graph.facebook.com/{META_VERSION}/{META_PHONE_ID}/messages"
        resp = requests.post(url, headers={
            "Authorization": f"Bearer {META_TOKEN}",
            "Content-Type":  "application/json"
        }, json={
            "messaging_product": "whatsapp",
            "recipient_type":    "individual",
            "to":                phone,
            "type":              "text",
            "text":              {"preview_url": False, "body": body}
        }, timeout=15)
        if resp.status_code == 200:
            logging.info(f"[webhook] WhatsApp sent to {phone}: HTTP {resp.status_code}")
        else:
            logging.error(f"[webhook] WhatsApp FAILED to {phone}: HTTP {resp.status_code} — {resp.text[:200]}")
    except Exception as e:
        logging.error(f"[webhook] WhatsApp error: {e}")
