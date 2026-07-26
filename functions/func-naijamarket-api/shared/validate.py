"""
shared/validate.py — Lightweight response schema validator.

Validates outbound API responses before they reach clients.
If a DB row returns unexpected nulls or wrong types, this catches it
and returns a safe error instead of malformed JSON to the WA engine or app.

Usage:
    from shared.validate import validate_price_guidance, validate_account_digest

    result = validate_price_guidance(payload)
    if not result["ok"]:
        logging.error(f"[price_guidance] schema violation: {result['errors']}")
        # return safe fallback
"""

import logging
from typing import Any


def _check(errors, payload, key, expected_type, required=True):
    if key not in payload:
        if required:
            errors.append(f"missing required key: {key}")
        return
    val = payload[key]
    if val is None and not required:
        return
    if val is not None and not isinstance(val, expected_type):
        errors.append(f"{key}: expected {expected_type.__name__}, got {type(val).__name__} = {repr(val)[:60]}")


def validate_price_guidance(payload: dict) -> dict:
    """
    Validates price_guidance response payload.
    Required: ok(bool), item_id(str), market_id(str), variance_pct(float), hint_text(str)
    Optional: baseline(float|None), baseline_source(str|None), expected_low(float|None),
              expected_high(float|None), peer(dict|None)
    """
    errors = []
    if not isinstance(payload, dict):
        return {"ok": False, "errors": ["payload is not a dict"]}

    _check(errors, payload, "ok",             bool,  required=True)
    _check(errors, payload, "item_id",        str,   required=True)
    _check(errors, payload, "market_id",      str,   required=True)
    _check(errors, payload, "variance_pct",   float, required=True)
    _check(errors, payload, "hint_text",      str,   required=True)

    # Optional numeric fields — allowed to be None but must be float if present
    for key in ("baseline", "expected_low", "expected_high"):
        if payload.get(key) is not None:
            _check(errors, payload, key, float, required=False)

    # peer must be dict with count/low/high if present
    peer = payload.get("peer")
    if peer is not None:
        if not isinstance(peer, dict):
            errors.append(f"peer: expected dict, got {type(peer).__name__}")
        else:
            for pk in ("count", "low", "high"):
                if pk not in peer:
                    errors.append(f"peer.{pk}: missing")

    return {"ok": len(errors) == 0, "errors": errors}


def validate_account_digest(payload: dict) -> dict:
    """Validates account_data digest response: requires enabled(bool)."""
    errors = []
    if not isinstance(payload, dict):
        return {"ok": False, "errors": ["payload is not a dict"]}
    _check(errors, payload, "enabled", bool, required=True)
    return {"ok": len(errors) == 0, "errors": errors}


def validate_account_referral(payload: dict) -> dict:
    """Validates account_data referral response: requires code(str|None)."""
    errors = []
    if not isinstance(payload, dict):
        return {"ok": False, "errors": ["payload is not a dict"]}
    if "code" not in payload:
        errors.append("missing required key: code")
    elif payload["code"] is not None and not isinstance(payload["code"], str):
        errors.append(f"code: expected str or None, got {type(payload['code']).__name__}")
    return {"ok": len(errors) == 0, "errors": errors}
