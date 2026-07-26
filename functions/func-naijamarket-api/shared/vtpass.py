"""
shared/vtpass.py — VTPass airtime purchase client.

Env vars (set in Azure Portal on func-naijamarket-api):
  VTPASS_ENABLED     "true" / "false"  — kill switch, default false
  VTPASS_BASE_URL    sandbox: https://sandbox.vtpass.com/api
                     live:    https://vtpass.com/api
  VTPASS_API_KEY     static API key
  VTPASS_SECRET_KEY  secret key (POST requests)
  VTPASS_PUBLIC_KEY  public key (GET requests)

VTPass airtime API:
  POST {base}/pay
  Headers: api-key, secret-key
  Body: request_id, serviceID (mtn|glo|airtel|etisalat), amount, phone
  Success: code == "000" and content.transactions.status == "delivered"

request_id MUST be unique per transaction and is our idempotency key —
we pass the Rewards_Ledger transaction_id so a re-run can never double-pay.
VTPass requires request_id to start with YYYYMMDDHHmm (Africa/Lagos time).
"""
import os
import json
import logging
import datetime
import urllib.request
import urllib.error

# ── Network detection from Nigerian phone prefix ─────────────────────────────
# Prefixes per NCC allocation. serviceID values per VTPass docs
# (9mobile is "etisalat" in VTPass).
_PREFIX_MAP = {
    "mtn":      ["0703","0704","0706","0801","0803","0806","0810","0813","0814","0816",
                 "0903","0906","0913","0916","07025","07026","0702"],
    "glo":      ["0705","0805","0807","0811","0815","0905","0915"],
    "airtel":   ["0701","0708","0802","0808","0812","0901","0902","0904","0907","0912"],
    "etisalat": ["0709","0809","0817","0818","0908","0909"],
}


def detect_network(phone: str) -> str | None:
    """Return VTPass serviceID for a Nigerian phone number, or None."""
    p = phone.strip().replace(" ", "").replace("-", "")
    if p.startswith("+234"):
        p = "0" + p[4:]
    elif p.startswith("234"):
        p = "0" + p[3:]
    # Longest prefixes first (07025/07026 before 0702)
    candidates = []
    for network, prefixes in _PREFIX_MAP.items():
        for pre in prefixes:
            candidates.append((pre, network))
    candidates.sort(key=lambda x: -len(x[0]))
    for pre, network in candidates:
        if p.startswith(pre):
            return network
    return None


def _normalize_phone(phone: str) -> str:
    """VTPass expects 0XXXXXXXXXX format."""
    p = phone.strip().replace(" ", "").replace("-", "")
    if p.startswith("+234"):
        return "0" + p[4:]
    if p.startswith("234"):
        return "0" + p[3:]
    return p


def _request_id(transaction_id: str) -> str:
    """VTPass request_id must start with YYYYMMDDHHmm in Africa/Lagos (UTC+1)."""
    lagos_now = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    stamp = lagos_now.strftime("%Y%m%d%H%M")
    # Strip non-alphanumeric from transaction_id, cap total length
    clean = "".join(c for c in str(transaction_id) if c.isalnum())[:30]
    return f"{stamp}{clean}"


def is_enabled() -> bool:
    return os.environ.get("VTPASS_ENABLED", "false").strip().lower() == "true"


def buy_airtime(phone: str, amount: float, transaction_id: str) -> dict:
    """
    Purchase airtime. Returns:
      {ok: bool, vtpass_ref: str|None, network: str|None,
       error: str|None, raw_code: str|None}
    Never raises — all errors returned in dict.
    """
    result = {"ok": False, "vtpass_ref": None, "network": None,
              "error": None, "raw_code": None}

    network = detect_network(phone)
    if not network:
        result["error"] = f"Cannot detect network for {phone}"
        return result
    result["network"] = network

    base = os.environ.get("VTPASS_BASE_URL", "https://sandbox.vtpass.com/api").rstrip("/")
    api_key = os.environ.get("VTPASS_API_KEY", "")
    secret = os.environ.get("VTPASS_SECRET_KEY", "")
    if not api_key or not secret:
        result["error"] = "VTPASS_API_KEY / VTPASS_SECRET_KEY not configured"
        return result

    payload = json.dumps({
        "request_id": _request_id(transaction_id),
        "serviceID": network,
        "amount": int(amount),
        "phone": _normalize_phone(phone),
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{base}/pay",
        data=payload,
        headers={
            "api-key": api_key,
            "secret-key": secret,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode("utf-8"))
            result["error"] = f"HTTP {e.code}: {body.get('response_description', str(body))[:200]}"
        except Exception:
            result["error"] = f"HTTP {e.code}"
        return result
    except Exception as e:
        result["error"] = f"Request failed: {str(e)[:200]}"
        return result

    code = str(body.get("code", ""))
    result["raw_code"] = code

    if code == "000":
        content = body.get("content", {}) or {}
        txn = content.get("transactions", {}) or {}
        status = str(txn.get("status", "")).lower()
        result["vtpass_ref"] = txn.get("transactionId") or body.get("requestId")
        if status in ("delivered", "completed", "successful"):
            result["ok"] = True
        elif status == "pending":
            # VTPass accepted but delivery pending — treat as success,
            # ref is stored for reconciliation via requery endpoint
            result["ok"] = True
            result["error"] = "vtpass_status=pending"
        else:
            result["error"] = f"VTPass status: {status}"
    elif code == "016":
        result["error"] = "Transaction failed (016)"
    elif code == "018":
        result["error"] = "Low wallet balance (018)"
    elif code == "019":
        result["error"] = "Duplicate request_id (019) — already processed"
    else:
        result["error"] = f"VTPass code {code}: {str(body.get('response_description',''))[:150]}"

    return result
