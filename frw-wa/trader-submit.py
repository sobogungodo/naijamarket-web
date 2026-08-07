# === PATCH FILE 3: trader/submit.py ===
# Two changes only:
#   1. _check_daily_limit(): fail-CLOSED on DB error (was fail-open)
#   2. SUBMIT step daily-cap call site: send_message() instead of bare return

"""
trader/submit.py — WhatsApp Trader Price Submission Flow
=========================================================
Multi-step flow:
  Step 1: Category selection
  Step 2: Item selection (with price guidance hint)
  Step 3: Price entry (with guidance range shown)
  Step 4: Confirmation
  Step 5: Submit to DB

Security patches (wa-v46):
  W2: SQL injection in _get_items() fixed — category_id was interpolated
      directly into f-string query. Now uses parameterized %s with
      explicit allowlist validation.

Security patches (wa-v121):
  H1: _check_daily_limit() now fails CLOSED on DB error instead of open —
      a forced DB error must not become a free unlimited-submission exploit.
  H2: Fixed silent-block bug — daily-cap rejection at SUBMIT step now
      actually sends the message to the trader instead of discarding it.
  H3: Added _write_submission_slot() — writes Reporter_Submission_Slots
      audit ledger row on successful insert (source_system='WA'), matching
      the PWA submit route's parallel write. Cross-platform dedup audit
      trail; does not affect the daily-count logic itself (that still
      reads from the shared dbo.Submissions table, which both surfaces
      already write to).

First-reporter-wins parity (frw, Task 7 — mirrors the trader PWA /api/submit
change from Task 4):
  - _check_slot_rules() REMOVED. It used to pre-block a submission on two
    ad-hoc rules (RULE-1 "you already have an APPROVED row this slot",
    RULE-2 "two other traders already reported this slot"). Both are now
    subsumed by dbo.usp_Process_Trader_Submission, which is the single
    source of truth for win/duplicate/cap arbitration.
  - _check_daily_limit() no longer BLOCKS the submission before insert —
    under first-reporter-wins the cap counts WINS, not raw submissions,
    and is enforced by the proc. It is still called to read the configured
    limit value, which is passed to the proc as @daily_limit. An
    over-cap submission is still INSERTED (the proc returns OVER_CAP and
    the row is kept so it still counts toward the consumer price average).
  - SUBMIT step now always inserts the PENDING row first, then EXECs
    dbo.usp_Process_Trader_Submission and maps its outcome
    (WINNER / ALREADY_REPORTED / ALREADY_REPORTED_SELF / OVER_CAP / ERROR)
    to the trader-facing reply. Only WINNER triggers validator assignment
    and the reward-earned confirmation.
"""

import logging
import os
from datetime import datetime, timezone

from shared.db import log_activity, log_submission_attempt
from shared.trader_i18n import tt
from shared.trader_lang import get_trader_lang

REWARD_PER_SUBMISSION = 50

_VALID_CATEGORY_IDS = frozenset({
    'CAT001', 'CAT002', 'CAT003', 'CAT004', 'CAT005',
    'CAT006', 'CAT007', 'CAT008', 'CAT009', 'CAT010',
    'CAT013', 'CAT014', 'CAT015', 'CAT070',
})


def _current_slot():
    h = datetime.now(timezone.utc).hour
    if h < 8:  return 'MORNING'
    if h < 13: return 'MIDDAY'
    return 'AFTERNOON'


def _get_conn():
    import pymssql
    return pymssql.connect(
        server   = os.environ['SQL_SERVER'],
        user     = os.environ.get('SQL_USERNAME') or os.environ.get('SQL_USER'),
        password = os.environ['SQL_PASSWORD'],
        database = os.environ.get('SQL_DATABASE', 'naijafoodmarket-live'),
        timeout  = 30,
        as_dict  = True,
    )


def _fmt(n):
    try:
        return f"₦{int(float(n)):,}"
    except Exception:
        return str(n)


def _get_trader(phone):
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        _c = phone.lstrip("+").strip(); _p = "+" + _c
        cur.execute("""
            SELECT trader_id, full_name, first_name,
                   assigned_market_id, assigned_market_name, assigned_state,
                   reputation, registration_status, is_suspended,
                   preferred_language
            FROM   dbo.Traders_register
            WHERE  phone_number = %s
               OR  phone_number = %s
        """, (_c, _p))
        row = cur.fetchone()
        conn.close()
        return row
    except Exception as e:
        logging.error(f'[trader.submit] get_trader error: {e}')
        return None


def _get_categories(market_id):
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute("""
            SELECT DISTINCT i.category_id,
                   CASE i.category_id
                     WHEN 'CAT001' THEN 'Grains & Staples'
                     WHEN 'CAT002' THEN 'Vegetables'
                     WHEN 'CAT003' THEN 'Dairy & Spreads'
                     WHEN 'CAT004' THEN 'Meat'
                     WHEN 'CAT005' THEN 'Drinks'
                     WHEN 'CAT006' THEN 'Fruits'
                     WHEN 'CAT007' THEN 'Spices & Peppers'
                     WHEN 'CAT008' THEN 'Fish & Seafood'
                     WHEN 'CAT009' THEN 'Bread & Bakery'
                     WHEN 'CAT010' THEN 'Bread & Bakery'
                     WHEN 'CAT013' THEN 'Dairy & Eggs'
                     WHEN 'CAT014' THEN 'Tubers & Roots'
                     WHEN 'CAT015' THEN 'Legumes & Beans'
                     WHEN 'CAT070' THEN 'Poultry'
                     ELSE i.category_id
                   END AS category_name
            FROM   dbo.Items_Catalog i
            WHERE  (i.status = 'ACTIVE' OR i.status IS NULL)
              AND  i.category_id IN ('CAT001','CAT002','CAT003','CAT004','CAT005',
                                     'CAT006','CAT007','CAT008','CAT009','CAT010',
                                     'CAT013','CAT014','CAT015','CAT070')
              AND  i.item_id NOT LIKE 'NBS[_]%'
            ORDER BY i.category_id
        """)
        rows = cur.fetchall()
        conn.close()
        seen = set(); result = []
        for r in rows:
            cid = 'CAT010' if r['category_id'] == 'CAT009' else r['category_id']
            if cid not in seen:
                seen.add(cid)
                result.append({'category_id': cid, 'category_name': r['category_name']})
        return result
    except Exception as e:
        logging.error(f'[trader.submit] get_categories error: {e}')
        return []


def _get_items(category_id, market_id):
    if category_id not in _VALID_CATEGORY_IDS:
        logging.warning(f'[trader.submit] _get_items: invalid category_id={category_id!r}')
        return []

    try:
        conn = _get_conn()
        cur  = conn.cursor()

        if category_id == 'CAT010':
            cur.execute("""
                SELECT i.item_id, i.item_name, i.Unit,
                       lps.price_naira AS baseline
                FROM   dbo.Items_Catalog i
                LEFT JOIN (
                    SELECT item_id, price_naira
                    FROM   dbo.Latest_Prices_Summary
                    WHERE  market_id  = %s
                      AND  is_nbs_ref = 0
                      AND  is_food    = 1
                ) lps ON lps.item_id = i.item_id
                WHERE  i.category_id IN ('CAT009', 'CAT010')
                  AND  (i.status = 'ACTIVE' OR i.status IS NULL)
                  AND  i.item_id NOT LIKE 'NBS[_]%%'
                ORDER BY i.item_name
            """, (market_id,))
        else:
            cur.execute("""
                SELECT i.item_id, i.item_name, i.Unit,
                       lps.price_naira AS baseline
                FROM   dbo.Items_Catalog i
                LEFT JOIN (
                    SELECT item_id, price_naira
                    FROM   dbo.Latest_Prices_Summary
                    WHERE  market_id  = %s
                      AND  is_nbs_ref = 0
                      AND  is_food    = 1
                ) lps ON lps.item_id = i.item_id
                WHERE  i.category_id = %s
                  AND  (i.status = 'ACTIVE' OR i.status IS NULL)
                  AND  i.item_id NOT LIKE 'NBS[_]%%'
                ORDER BY i.item_name
            """, (market_id, category_id))

        rows = cur.fetchall()
        conn.close()
        return rows
    except Exception as e:
        logging.error(f'[trader.submit] get_items error: {e}')
        return []


def _check_daily_limit(phone):
    """
    Returns (allowed: bool, count: int, limit: int)
    Reads limit from Admin_Config (section='validation', key_name='maxSubmissionsPerDay'), fallback 15.
    Counts APPROVED+PENDING submissions for this phone on today's WAT date.

    H1 (wa-v121): FAILS CLOSED on any DB error. Previously failed open
    (returned True, allowing submission past the cap on any error) — that
    is a money-gating exploit surface. A trader hitting this during a
    transient DB blip gets blocked and can retry; that cost is acceptable.
    Unbounded submission past the cap during DB instability is not.

    frw (Task 7): the caller at the SUBMIT step no longer uses the
    `allowed` flag to block the submission — the daily cap is now enforced
    by dbo.usp_Process_Trader_Submission (it counts WINS, not raw
    submissions, and an over-cap row must still be saved). This function
    is still called for its `limit` value, which is passed to the proc as
    @daily_limit. Fail-closed on DB error still applies to the value
    returned (defaults to 15) — a genuinely unreachable DB will also fail
    the subsequent insert, so there is no separate exploit surface here.
    """
    try:
        conn = _get_conn()
    except Exception as e:
        logging.error(f"_check_daily_limit: cannot connect, failing CLOSED for {phone}: {e}")
        return False, 0, 15

    try:
        cur = conn.cursor(as_dict=True)
        cur.execute(
            "SELECT key_value FROM dbo.Admin_Config "
            "WHERE section = 'validation' AND key_name = 'maxSubmissionsPerDay'"
        )
        row = cur.fetchone()
        daily_limit = int(row['key_value']) if row else 15

        _c = phone.lstrip("+").strip(); _p = "+" + _c
        cur.execute(
            """
            SELECT COUNT(*) AS daily_count
            FROM dbo.Submissions
            WHERE (trader_phone = %s OR trader_phone = %s)
              AND CAST(DATEADD(HOUR, 1,
                    TRY_CAST(submitted_at AS DATETIME2)) AS DATE)
                  = CAST(DATEADD(HOUR, 1, GETUTCDATE()) AS DATE)
              AND validation_status IN ('APPROVED', 'PENDING')
            """,
            (_c, _p)
        )
        result = cur.fetchone()
        count = result['daily_count'] if result else 0
        return count < daily_limit, count, daily_limit
    except Exception as e:
        # H1: fail CLOSED — block the submission rather than allow past the cap
        logging.error(f"_check_daily_limit query error for {phone}, failing CLOSED: {e}")
        return False, 0, 15
    finally:
        conn.close()


def _insert_submission(phone, trader_id, trader_name, market_id, market_name,
                       state, item_id, item_name, unit, price,
                       gps_lat, gps_lon, notes_marker):
    sub_id = f"SUB-WA-{trader_id}-{int(datetime.now(timezone.utc).timestamp())}"
    now    = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    _c = phone.lstrip("+").strip(); _p = "+" + _c
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO dbo.Submissions (
                submission_id, trader_phone, trader_id, trader_name,
                market_id, market, state,
                item_id, item, category_id, unit,
                price, validation_status, status,
                fraud_flag, gps_verified,
                gps_latitude, gps_longitude, notes,
                submitted_at, created_at
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, 'WA', %s,
                %s, 'PENDING', 'PENDING',
                0, 0,
                %s, %s, %s,
                %s, %s
            )
        """, (sub_id, _p, trader_id, trader_name,
              market_id, market_name, state,
              item_id, item_name, unit,
              price, gps_lat, gps_lon, notes_marker, now, now))

        cur.execute("""
            SELECT COUNT(*) AS cnt FROM dbo.Submissions
            WHERE (trader_phone = %s OR trader_phone = %s) AND item_id = %s
        """, (_c, _p, item_id))
        sub_count = int(cur.fetchone()['cnt']) or 0

        if sub_count >= 3:
            cur.execute("""
                MERGE dbo.Trader_Favourites AS target
                USING (SELECT %s AS trader_phone, %s AS item_id) AS source
                  ON  target.trader_phone = source.trader_phone
                  AND target.item_id      = source.item_id
                WHEN MATCHED THEN
                  UPDATE SET use_count = use_count + 1, last_used_at = GETUTCDATE()
                WHEN NOT MATCHED THEN
                  INSERT (trader_phone, trader_id, item_id, item_name, unit)
                  VALUES (%s, %s, %s, %s, %s)
            """, (_p, item_id, _p, trader_id, item_id, item_name, unit or ''))

        conn.commit()
        conn.close()
        return sub_id, sub_count
    except Exception as e:
        logging.error(f'[trader.submit] insert error: {e}')
        raise


# NEW (wa-v121) — writes the cross-platform dedup audit ledger row.
# Fire-and-forget — never blocks the main submission flow on a logging failure.
def _write_submission_slot(phone, submission_id, slot_name):
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO dbo.Reporter_Submission_Slots
                (submission_id, phone_number, slot_name, slot_date,
                 slot_utc_open, slot_utc_close, submitted_at_utc,
                 within_window, created_at, source_system)
            VALUES
                (%s, %s, %s, CAST(GETUTCDATE() AS DATE),
                 GETUTCDATE(), GETUTCDATE(), GETUTCDATE(),
                 1, GETUTCDATE(), 'WA')
        """, (submission_id, phone, slot_name))
        conn.commit()
        conn.close()
    except Exception as e:
        logging.warning(f'[trader.submit] Reporter_Submission_Slots write failed: {e}')


def _send_location_request(phone, body_text):
    """wa-v155 (AF1/Ov8): send Meta's interactive location_request_message (Graph v25.0).
    Business-initiated interactive message; valid inside the 24h service window (always
    true mid-submit). Returns True on HTTP 200. No text fallback - caller uses the PWA
    pointer (AI2) on False."""
    import requests
    token    = os.environ.get("META_ACCESS_TOKEN", "")
    phone_id = os.environ.get("META_PHONE_NUMBER_ID", "")
    if not token or not phone_id:
        logging.warning("[trader.submit] location_request: META vars not set")
        return False
    to = phone.replace("+", "").strip()
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "location_request_message",
            "body": {"text": body_text[:1024]},
            "action": {"name": "send_location"},
        },
    }
    try:
        r = requests.post(
            f"https://graph.facebook.com/v25.0/{phone_id}/messages",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=payload, timeout=10)
        if r.status_code != 200:
            logging.error(f"[trader.submit] location_request {r.status_code}: {r.text[:200]}")
            return False
        return True
    except Exception as e:
        logging.error(f"[trader.submit] location_request send error: {e}")
        return False


def check_pin_distance(phone, lat, lon, session):
    """wa-v155 (AF1): accept/reject a shared WhatsApp pin against the trader's assigned
    market. Returns (verdict, dist_km_str, market_name, notes_marker); verdict 'ACCEPT' =
    in range OR fail-open, 'REJECT' = out of range. Config mirrors _check_daily_limit's
    Admin_Config read. FAILS OPEN (marker 'WA_PIN_UNVERIFIED') on config error, geofence
    disabled, or missing coords/radius. Reuses validator.menu helpers (not rewritten)."""
    market_id   = session.get('_market_id', '')
    market_name = session.get('_market_name', 'the market')
    enabled, multiplier = True, 10.0
    try:
        conn = _get_conn(); cur = conn.cursor(as_dict=True)
        cur.execute(
            "SELECT key_name, key_value FROM dbo.Admin_Config "
            "WHERE section='validation' AND key_name IN ('geofenceEnabled','geofenceRadiusMultiplier')")
        for row in cur.fetchall():
            if row['key_name'] == 'geofenceEnabled':
                enabled = str(row['key_value']).strip().lower() == 'true'
            elif row['key_name'] == 'geofenceRadiusMultiplier':
                try:
                    _m = float(row['key_value'])
                    if _m > 0:
                        multiplier = _m
                except Exception:
                    pass
        conn.close()
    except Exception as e:
        logging.error(f"[trader.submit] geofence config read failed, FAIL OPEN: {e}")
        return 'ACCEPT', '', market_name, 'WA_PIN_UNVERIFIED'
    if not enabled:
        return 'ACCEPT', '', market_name, 'WA_PIN_UNVERIFIED'
    try:
        from validator.menu import _get_market_coords
        mlat, mlon = _get_market_coords(market_id)
    except Exception as e:
        logging.error(f"[trader.submit] market coords fetch failed, FAIL OPEN: {e}")
        return 'ACCEPT', '', market_name, 'WA_PIN_UNVERIFIED'
    radius = None
    try:
        conn = _get_conn(); cur = conn.cursor(as_dict=True)
        cur.execute("SELECT radius_meters FROM dbo.Markets WHERE market_id = %s", (market_id,))
        _rr = cur.fetchone(); conn.close()
        if _rr and _rr.get('radius_meters') is not None:
            radius = float(_rr['radius_meters'])
    except Exception as e:
        logging.error(f"[trader.submit] radius fetch failed, FAIL OPEN: {e}")
        return 'ACCEPT', '', market_name, 'WA_PIN_UNVERIFIED'
    if mlat is None or mlon is None or radius is None:
        return 'ACCEPT', '', market_name, 'WA_PIN_UNVERIFIED'
    from validator.menu import _distance_m
    dist = _distance_m(float(lat), float(lon), float(mlat), float(mlon))
    allowed = radius * multiplier
    dist_km_str = f"{dist / 1000:.1f}"
    if dist <= allowed:
        return 'ACCEPT', dist_km_str, market_name, 'WA_PIN'
    return 'REJECT', dist_km_str, market_name, 'WA_PIN'


def handle_submit(phone, message="", session=None, *args):
    from shared.sender  import send_message
    from shared.session import save_session, clear_session

    if session is None:
        session = {}

    msg  = message.strip()
    step = session.get('_step', 'START')

    trader = _get_trader(phone)
    if not trader:
        send_message(phone, tt("en", "submit_not_registered"))
        return

    lang = get_trader_lang(trader, session)

    if trader.get('registration_status') != 'APPROVED':
        send_message(phone, tt(lang, "submit_pending"))
        return

    if trader.get('is_suspended'):
        send_message(phone, tt(lang, "submit_suspended"))
        return

    market_id   = trader['assigned_market_id']
    market_name = trader['assigned_market_name']
    state       = trader['assigned_state'] or ''
    trader_id   = trader['trader_id']
    first_name  = (trader.get('first_name') or trader.get('full_name') or 'Trader').split()[0]

    if step == 'START' or step == 'CATEGORY':
        categories = _get_categories(market_id)
        if not categories:
            send_message(phone, tt(lang, "no_categories"))
            return

        lines = [tt(lang, "cat_header", market=market_name)]
        for i, cat in enumerate(categories, 1):
            lines.append(f"{i}. {cat['category_name']}")
        lines.append(tt(lang, "back_to_menu_line"))
        lines.append(tt(lang, "reply_number_line"))

        session['_flow'] = 'TRADER_SUBMIT'
        session['_step'] = 'ITEM'
        save_session(phone, session)
        send_message(phone, '\n'.join(lines))
        return

    if step == 'ITEM':
        if msg == '0':
            session['_step'] = 'CATEGORY'
            save_session(phone, session)
            handle_submit(phone, '', session)
            return

        categories = _get_categories(market_id)
        try:
            idx = int(msg) - 1
            assert 0 <= idx < len(categories)
        except Exception:
            send_message(phone, tt(lang, "pick_between", n=len(categories)))
            return

        cat_id   = categories[idx]['category_id']
        cat_name = categories[idx]['category_name']

        items = _get_items(cat_id, market_id)

        if not items:
            send_message(phone, tt(lang, "no_items_in_cat", cat=cat_name))
            return

        lines = [tt(lang, "item_header", cat=cat_name)]
        for i, item in enumerate(items, 1):
            # wa-v155 (AH1): reference-price anchor removed - baseline not shown
            lines.append(f"{i}. {item['item_name']}")
        lines.append(tt(lang, "item_back_line"))

        session['_step']   = 'PRICE'
        session['_cat_id'] = cat_id
        session['_items']  = [
            (r['item_id'], r['item_name'], r.get('Unit') or '',
             float(r['baseline']) if r.get('baseline') is not None else None)
            for r in items
        ]
        save_session(phone, session)
        send_message(phone, '\n'.join(lines))
        return

    if step == 'PRICE':
        if msg == '0':
            session['_step'] = 'ITEM'
            save_session(phone, session)
            handle_submit(phone, '', session)
            return

        items = session.get('_items', [])
        try:
            idx = int(msg) - 1
            assert 0 <= idx < len(items)
        except Exception:
            send_message(phone, tt(lang, "pick_between", n=len(items)))
            return

        item_id, item_name, unit, baseline = items[idx]

        # frw (Task 7): the old pre-check (_check_slot_rules) is removed here.
        # dbo.usp_Process_Trader_Submission is now the single source of truth for
        # win/duplicate/cap arbitration, evaluated once at the SUBMIT step after
        # the row is inserted — not as an early item-selection gate.

        # wa-v155 (AH1): baseline +/-10% market-range anchor removed - never inject.
        # (market_range i18n key retained; simply no longer used.)
        guidance = ''

        unit_str = f"per {unit}" if unit else ''
        session['_step']      = 'CONFIRM'
        session['_item_id']   = item_id
        session['_item_name'] = item_name
        session['_item_unit'] = unit
        session['_baseline']  = baseline   # wa-v156 (PW1): persist the LPS baseline the item list was built from (NULL-safe)
        save_session(phone, session)

        send_message(phone, tt(lang, "price_prompt",
                               item=item_name, unit_str=unit_str, guidance=guidance))
        return

    if step == 'CONFIRM':
        if msg == '0':
            session['_step'] = 'PRICE'
            save_session(phone, session)
            handle_submit(phone, '', session)
            return

        price_str = msg.replace(',', '').replace('₦', '').strip()
        try:
            price = float(price_str)
            assert price >= 10
            assert price <= 100_000_000
        except Exception:
            send_message(phone, tt(lang, "invalid_price"))
            return

        item_id   = session.get('_item_id', '')
        item_name = session.get('_item_name', '')
        unit      = session.get('_item_unit', '')
        unit_str  = f"per {unit}" if unit else ''

        # wa-v156 (PW1): out-of-band price WARNING (never a rejection). Compares the
        # reporter's own number to the LPS baseline the item list was built from
        # (persisted at item-selection). _price_warn is written on EVERY branch — a stale
        # True from an abandoned attempt must never demand 'ok' or stamp |PRICE_WARN on an
        # unrelated row. NULL/0 baseline => our data gap, fail OPEN (no warning).
        b = session.get('_baseline')
        if not b:
            session['_price_warn']     = False
            session['_price_warn_dir'] = None
        elif price > b * 3:
            session['_price_warn']     = True
            session['_price_warn_dir'] = 'high'
        elif price < b * 0.33:
            session['_price_warn']     = True
            session['_price_warn_dir'] = 'low'
        else:
            session['_price_warn']     = False
            session['_price_warn_dir'] = None

        session['_step']  = 'SUBMIT'
        session['_price'] = price
        save_session(phone, session)

        if session['_price_warn']:
            # Warning replaces the confirm prompt; SUBMIT then requires the literal 'ok'.
            # No baseline / range / percentage — do not re-anchor server-side (v155).
            send_message(phone, tt(lang, "price_warn_" + session['_price_warn_dir'],
                                   price=_fmt(price), item=item_name))
        else:
            send_message(phone, tt(lang, "confirm_submission",
                                   market=market_name, item=item_name,
                                   unit_str=unit_str, price=_fmt(price)))
        return

    if step == 'LOCATION':
        # wa-v155 (AF1): awaiting a shared pin (the actual pin arrives as type="location"
        # and is handled in whatsapp_main/__init__.py). A text reply here means the user
        # typed instead of sharing; 'menu'/reset words are intercepted earlier in menu.py.
        send_message(phone,
            "Please share your location to finish: tap the attach (+) button, choose "
            "*Location*, then *Send your current location*. Or type *menu* to cancel.")
        return

    if step == 'SUBMIT':
        if msg == '0' or msg in ('no', 'cancel'):
            session['_step'] = 'CATEGORY'
            save_session(phone, session)
            handle_submit(phone, '', session)
            return

        if session.get('_price_warn'):
            # wa-v156 (PW1): a warned price requires the literal 'ok'. yes/y/1 must NOT
            # pass by habit — they re-send the warning so the reporter actually reads it.
            if msg != 'ok':
                send_message(phone, tt(lang, "price_warn_" + (session.get('_price_warn_dir') or 'high'),
                                       price=_fmt(float(session.get('_price', 0))),
                                       item=session.get('_item_name', '')))
                return
        else:
            if msg not in ('yes', 'y', '1'):
                send_message(phone, tt(lang, "reply_yes_or_cancel"))
                return

        item_id     = session.get('_item_id', '')
        item_name   = session.get('_item_name', '')
        unit        = session.get('_item_unit', '')
        price       = float(session.get('_price', 0))
        trader_name = trader.get('full_name') or first_name

        try:
            from shared.db import log_reporter_activity
            log_reporter_activity(phone, 'WA_SUBMISSION_STARTED',
                                  activity_detail=item_name,
                                  market_id=market_id,
                                  source_system='func-naijamarket-wa')
        except Exception:
            pass

        # frw (Task 7): daily_limit VALUE only — no longer gates the submission here.
        # Under first-reporter-wins the cap counts WINS and is enforced by
        # dbo.usp_Process_Trader_Submission after insert; an over-cap submission is
        # still saved (the proc returns OVER_CAP and the row counts toward the
        # consumer average). `allowed`/`count` are intentionally unused below.
        _allowed, _count, daily_limit = _check_daily_limit(phone)

        # wa-v155 (AF1): GPS gate. On first confirmation, request the pin and pause at
        # LOCATION; the insert below runs only after an in-range pin sets _geo_done.
        if not session.get('_geo_done'):
            session['_market_id']   = market_id
            session['_market_name'] = market_name
            session['_step']        = 'LOCATION'
            save_session(phone, session)
            ok = _send_location_request(
                phone,
                "One more step - share your location so we can confirm you are at "
                f"{market_name}. Tap the button below and choose 'Send your current location'.")
            if not ok:
                # AI2: interactive send failed - block with a PWA pointer, never strand
                clear_session(phone)
                send_message(phone,
                    "We could not request your location. Please submit this price at "
                    "https://trader.naijamarketintel.com instead.")
            return

        try:
            # wa-v156 (PW1): append the price-warning marker when this row was confirmed
            # past a warning. notes is nvarchar(500); the INSERT stays 16 %s / 16 params —
            # only param #14 (the notes VALUE) changes. session.clear() at the success
            # reset below wipes _price_warn so it cannot carry into the next submission.
            _notes_val = session.get('_notes') or 'WA_PIN_UNVERIFIED'
            if session.get('_price_warn'):
                _notes_val = _notes_val + '|PRICE_WARN'
            sub_id, sub_count = _insert_submission(
                phone, trader_id, trader_name,
                market_id, market_name, state,
                item_id, item_name, unit, price,
                session.get('_lat'), session.get('_lon'),
                _notes_val
            )

            # frw (Task 7): the insert above always happens; this proc is the
            # single source of truth for who "wins" the slot. It reads/updates
            # the just-inserted row by submission_id.
            outcome = 'ERROR'
            try:
                _pconn = _get_conn()
                _pcur  = _pconn.cursor()
                _pcur.execute(
                    "EXEC dbo.usp_Process_Trader_Submission @submission_id=%s, @daily_limit=%s",
                    (sub_id, daily_limit)
                )
                _prow = _pcur.fetchone()
                outcome = _prow['outcome'] if _prow else 'ERROR'
                _pconn.commit()
                _pconn.close()
            except Exception as pe:
                logging.error(f"[trader.submit] usp_Process_Trader_Submission error: {pe}")
                outcome = 'ERROR'

            try:
                log_submission_attempt(
                    phone_number=phone, platform="WA",
                    outcome="SUBMITTED" if outcome != 'ERROR' else 'FAILED',
                    item_id=item_id, item_name=item_name,
                    market_id=market_id, market_name=market_name,
                    price_entered=price, unit=unit,
                    submission_id=str(sub_id) if sub_id else None,
                    failure_reason=None if outcome != 'ERROR' else 'proc_outcome_ERROR',
                )
            except Exception:
                pass

            if outcome != 'WINNER':
                # ALREADY_REPORTED / ALREADY_REPORTED_SELF / OVER_CAP / ERROR: the row
                # is saved (or the proc failed) but this trader does not win the slot —
                # no validator assignment, no reward-earned copy.
                try:
                    log_activity(
                        phone_number=phone, platform="WA",
                        event_type="SUBMISSION_DUPLICATE",
                        event_detail={"item_id": item_id, "market_id": market_id, "outcome": outcome},
                    )
                except Exception:
                    pass

                if outcome == 'ALREADY_REPORTED_SELF':
                    reply = f"You already reported {item_name} today."
                elif outcome in ('ALREADY_REPORTED', 'OVER_CAP'):
                    reply = f"We already have the price for {item_name}. Please submit a price for another item."
                else:
                    reply = "Could not record your price. Please try again."

                session['_step'] = 'CATEGORY'
                save_session(phone, session)
                send_message(phone, reply)
                return

            # NEW (wa-v121) — cross-platform dedup audit ledger. frw (parity fix):
            # written ONLY on WINNER, matching the trader PWA /api/submit (Task 4)
            # behavior — not on every insert.
            _write_submission_slot(phone, sub_id, _current_slot())

            fav_note = tt(lang, "fav_note") if sub_count >= 3 else ''

            try:
                conn = _get_conn()
                cur  = conn.cursor()
                cur.execute(
                    "EXEC dbo.usp_Assign_Validators %s, %s, %s, %s, %s, %s, %s, %s, %s",
                    (sub_id, phone, trader_id, market_id, market_name,
                     item_id, item_name, str(int(price)), unit or '')
                )
                assign_row = cur.fetchone()
                conn.commit()
                conn.close()

                if assign_row:
                    result = (assign_row.get('result') or '').upper()
                    if result == 'ASSIGNED':
                        from shared.sender import send_message as _send
                        v_msg = (
                            f"\U0001f514 *New Validation Request*\n"
                            f"━━━ New submission ready for review ━━━\n"
                            f"Market: {market_name}\n"
                            f"Item: {item_name}\n"
                            f"Price: {_fmt(price)}\n\n"
                            f"Type *pending* to view and cast your vote."
                        )
                        for vphone_key in ("v1_phone", "v2_phone", "v3_phone"):
                            vphone = assign_row.get(vphone_key)
                            if vphone:
                                try:
                                    _send("+" + vphone.lstrip("+"), v_msg)
                                except Exception as ve:
                                    logging.error(f"[trader.submit] validator notify error {vphone}: {ve}")
            except Exception as ae:
                logging.error(f"[trader.submit] assign_validators error: {ae}")

            session.clear()
            session["_flow"] = "TRADER_SUBMIT"
            session["_step"] = "CATEGORY"
            save_session(phone, session)

            send_message(phone, tt(lang, "submit_success",
                                   item=item_name, price=_fmt(price),
                                   market=market_name,
                                   reward=REWARD_PER_SUBMISSION,
                                   fav_note=fav_note))
            handle_submit(phone, "", session)

        except Exception as e:
            logging.error(f"[trader.submit] final submit error: {e}")
            try:
                log_submission_attempt(
                    phone_number=phone, platform="WA", outcome="FAILED",
                    item_id=item_id, item_name=item_name,
                    market_id=market_id, market_name=market_name,
                    price_entered=price, unit=unit,
                    failure_reason=str(e)[:500],
                )
            except Exception:
                pass
            send_message(phone, tt(lang, "submit_failed"))
        return

    session['_step'] = 'START'
    save_session(phone, session)
    handle_submit(phone, '', session)
