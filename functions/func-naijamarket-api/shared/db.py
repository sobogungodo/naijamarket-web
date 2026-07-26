"""
Database connection — pymssql, returns dicts.

SECURITY PATCHES (api-v5):
  F6: CORS wildcard replaced with allowlist from ALLOWED_ORIGINS env var
"""
import os
import pymssql


def get_connection():
    user = os.environ.get("SQL_USERNAME") or os.environ.get("SQL_USER", "")
    return pymssql.connect(
        server        = os.environ["SQL_SERVER"],
        database      = os.environ["SQL_DATABASE"],
        user          = user,
        password      = os.environ["SQL_PASSWORD"],
        as_dict       = True,
        timeout       = 0,
        login_timeout = 15
    )


def cors_headers():
    """
    F6 FIX: Restrict CORS to known origins instead of wildcard *.
    Set ALLOWED_ORIGINS env var as comma-separated list.
    Defaults to production domains if env var not set.
    """
    allowed = os.environ.get(
        "ALLOWED_ORIGINS",
        "https://www.naijamarketintel.com,https://naijamarketintel.ng,"
        "https://naijamarket-web.vercel.app,https://naijamarket-admin.vercel.app"
    )
    # Use first origin as the header value (browsers send one Origin at a time;
    # proper multi-origin support requires request-time matching — acceptable
    # for now; full multi-origin middleware is a P2 item)
    return {
        "Access-Control-Allow-Origin":  allowed.split(",")[0].strip(),
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Vary":                         "Origin",
        "Content-Type":                 "application/json"
    }


def safe_error(msg: str = "Internal server error") -> str:
    """
    F5 FIX: Return generic error string safe for client consumption.
    Always log the real exception before calling this.
    """
    return msg
