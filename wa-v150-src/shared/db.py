import os

def get_connection():
    # Supabase Dev environment: DB_BACKEND=supabase routes to psycopg2 -> Supabase Postgres.
    # Production leaves DB_BACKEND unset -> pymssql -> Azure SQL (below).
    if os.environ.get("DB_BACKEND") == "supabase":
        try:
            from shared.db_supabase import get_supabase_connection
        except ImportError:
            from db_supabase import get_supabase_connection
        return get_supabase_connection()
    import pymssql
    return pymssql.connect(
        server=os.environ["SQL_SERVER"],
        user=os.environ.get("SQL_USERNAME", os.environ.get("SQL_USER","")),
        password=os.environ["SQL_PASSWORD"],
        database=os.environ["SQL_DATABASE"],
        as_dict=True, timeout=30
    )

def get_consumer(phone):
    conn = get_connection()
    try:
        cur = conn.cursor(as_dict=True)
        clean = phone.replace("+","").strip()
        cur.execute("""
            SELECT consumer_id, phone, phone_number, subscription_tier,
                   subscription_end_date, account_status, preferred_language,
                   pending_downgrade_tier, downgrade_effective_date
            FROM dbo.Consumers
            WHERE phone = %s OR phone_number = %s OR phone = %s OR phone_number = %s
        """, (clean, clean, f"+{clean}", f"+{clean}"))
        return cur.fetchone() or {}
    finally:
        conn.close()

def get_role(phone):
    """Returns 'TRADER', 'VALIDATOR', 'CONSUMER', or None from User_Roles."""
    conn = get_connection()
    try:
        cur = conn.cursor(as_dict=True)
        clean = phone.replace("+","").strip()
        cur.execute("""
            SELECT role FROM dbo.User_Roles
            WHERE phone_number = %s OR phone_number = %s
        """, (clean, f"+{clean}"))
        row = cur.fetchone()
        return row['role'].upper() if row else None
    except Exception:
        return None
    finally:
        conn.close()

def get_trader(phone):
    """Returns trader record from Traders_register or None."""
    conn = get_connection()
    try:
        cur = conn.cursor(as_dict=True)
        clean = phone.replace("+","").strip()
        cur.execute("""
            SELECT trader_id, full_name, first_name,
                   assigned_market_id, assigned_market_name, assigned_state,
                   reputation, registration_status, is_suspended
            FROM dbo.Traders_register
            WHERE phone_number = %s OR phone_number = %s
        """, (clean, f"+{clean}"))
        return cur.fetchone() or None
    except Exception:
        return None
    finally:
        conn.close()

def get_validator(phone):
    """Returns validator record from Validators or None."""
    conn = get_connection()
    try:
        cur = conn.cursor(as_dict=True)
        clean = phone.replace("+","").strip()
        cur.execute("""
            SELECT validator_id, full_name, status
            FROM dbo.Validators
            WHERE phone_number = %s OR phone_number = %s
        """, (clean, f"+{clean}"))
        return cur.fetchone() or None
    except Exception:
        return None
    finally:
        conn.close()


# ──────────────────────────────────────────────────────────────
# Trader Activity Audit Trail helpers
# Added wa-v113 — additive only, no existing logic changed
# ──────────────────────────────────────────────────────────────

def log_activity(phone_number, platform, event_type,
                 event_detail=None, session_token=None, ip_address=None):
    """
    Write one row to dbo.Trader_Activity_Log.
    Fire-and-forget pattern: errors are swallowed so a logging
    failure never breaks the main flow.
    platform: 'WA' | 'PWA' | 'ANDROID'
    event_type taxonomy:
        LOGIN, LOGOUT, MAGIC_LINK_REQUEST, MAGIC_LINK_USED,
        SUBMISSION_STARTED, SUBMISSION_COMPLETED, SUBMISSION_FAILED,
        SUBMISSION_ABANDONED, SUBMISSION_DUPLICATE,
        GPS_VERIFIED, GPS_FAILED,
        PAYOUT_REQUESTED, PAYOUT_FAILED,
        PROFILE_VIEWED, PROFILE_UPDATED, PHOTO_UPLOADED,
        BANK_ACCOUNT_CHANGED, PHONE_CHANGE_REQUESTED, PHONE_CHANGED,
        MENU_VIEWED, ITEM_SEARCHED, CATEGORY_BROWSED,
        SESSION_STARTED, SESSION_EXPIRED, SESSION_INVALIDATED,
        KYC_STARTED, KYC_COMPLETED, KYC_FAILED,
        VALIDATOR_REGISTERED, VOTE_CAST
    """
    import json
    try:
        conn = get_connection()
        cursor = conn.cursor()
        detail_str = None
        if event_detail is not None:
            detail_str = json.dumps(event_detail) if isinstance(event_detail, dict) else str(event_detail)
        cursor.execute(
            """
            INSERT INTO dbo.Trader_Activity_Log
                (phone_number, platform, event_type, event_detail,
                 session_token, ip_address, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, SYSUTCDATETIME())
            """,
            (str(phone_number), str(platform)[:10], str(event_type)[:50],
             detail_str, str(session_token)[:64] if session_token else None,
             str(ip_address)[:45] if ip_address else None)
        )
        conn.commit()
    except Exception as e:
        import logging
        logging.warning(f"[audit] log_activity failed silently: {e}")


def log_session_start(phone_number, platform, session_token=None,
                      device_info=None, ip_address=None):
    """
    Write one row to dbo.Trader_Session_Log on session start.
    Returns session_log_id for later update on session end.
    Returns None on failure (non-fatal).
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO dbo.Trader_Session_Log
                (phone_number, platform, session_token, device_info,
                 ip_address, started_at, last_active_at)
            OUTPUT INSERTED.session_log_id
            VALUES (%s, %s, %s, %s, %s, SYSUTCDATETIME(), SYSUTCDATETIME())
            """,
            (str(phone_number), str(platform)[:10],
             str(session_token)[:64] if session_token else None,
             str(device_info)[:500] if device_info else None,
             str(ip_address)[:45] if ip_address else None)
        )
        row = cursor.fetchone()
        conn.commit()
        return row['session_log_id'] if row else None
    except Exception as e:
        import logging
        logging.warning(f"[audit] log_session_start failed silently: {e}")
        return None


def log_session_end(phone_number, session_token, end_reason='LOGOUT'):
    """
    Close open session row in Trader_Session_Log.
    end_reason: 'LOGOUT' | 'EXPIRED' | 'INVALIDATED'
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE dbo.Trader_Session_Log
            SET ended_at   = SYSUTCDATETIME(),
                end_reason = %s
            WHERE phone_number   = %s
              AND session_token  = %s
              AND ended_at IS NULL
            """,
            (str(end_reason)[:20], str(phone_number),
             str(session_token)[:64] if session_token else None)
        )
        conn.commit()
    except Exception as e:
        import logging
        logging.warning(f"[audit] log_session_end failed silently: {e}")


def log_submission_attempt(phone_number, platform, outcome,
                           item_id=None, item_name=None,
                           market_id=None, market_name=None,
                           price_entered=None, unit=None,
                           gps_lat=None, gps_lng=None, gps_distance_m=None,
                           submission_id=None, failure_reason=None):
    """
    Write one row to dbo.Trader_Submission_Attempts.
    outcome: 'SUBMITTED' | 'ABANDONED' | 'GPS_FAIL' |
             'FRAUD_BLOCKED' | 'LIMIT_REACHED' | 'FAILED'
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO dbo.Trader_Submission_Attempts
                (phone_number, platform, item_id, item_name,
                 market_id, market_name, price_entered, unit,
                 gps_lat, gps_lng, gps_distance_m,
                 outcome, submission_id, failure_reason, attempted_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, SYSUTCDATETIME())
            """,
            (str(phone_number), str(platform)[:10],
             str(item_id)[:50] if item_id else None,
             str(item_name)[:200] if item_name else None,
             str(market_id)[:50] if market_id else None,
             str(market_name)[:200] if market_name else None,
             float(price_entered) if price_entered else None,
             str(unit)[:50] if unit else None,
             float(gps_lat) if gps_lat else None,
             float(gps_lng) if gps_lng else None,
             float(gps_distance_m) if gps_distance_m else None,
             str(outcome)[:20],
             str(submission_id)[:50] if submission_id else None,
             str(failure_reason)[:500] if failure_reason else None)
        )
        conn.commit()
    except Exception as e:
        import logging
        logging.warning(f"[audit] log_submission_attempt failed silently: {e}")


def log_reporter_activity(phone, activity_type, activity_detail=None,
                           session_id=None, market_id=None,
                           channel='WHATSAPP', source_system='func-naijamarket-wa'):
    """
    Fire-and-forget write to dbo.Reporter_Activity_Log (W6.1).
    Never raises — errors are swallowed so the caller is never blocked.
    Different from log_activity which writes to Trader_Activity_Log.
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO dbo.Reporter_Activity_Log
                (phone_number, activity_type, activity_detail,
                 session_id, market_id, channel,
                 occurred_at, created_at, source_system)
            VALUES (%s, %s, %s, %s, %s, %s,
                    SYSUTCDATETIME(), SYSUTCDATETIME(), %s)
            """,
            (phone, activity_type, activity_detail,
             session_id, market_id, channel, source_system)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        import logging
        logging.warning(f'[log_reporter_activity] Failed for {phone}/{activity_type}: {e}')
