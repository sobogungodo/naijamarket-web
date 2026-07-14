import logging
import uuid
from shared.db import get_connection
from shared.sender import send_message
from shared.session import save_session, clear_session
from shared.lang import get_lang
from shared.i18n import t
from consumer.menu import show_main_menu


def _clean(phone):
    return (phone or "").replace("+", "").strip()


def handle_basket(phone, message="", session=None, consumer=None, *args):
    session = session or {}; consumer = consumer or {}
    lang = get_lang(session, consumer)
    text = (message or "").strip(); msg = text.lower()
    step = session.get("step", 0)

    # v149: AWAIT_PICK interceptor. _pick_ids present ⇒ last turn showed a numbered
    # pick-list. Bare number = pick; command or new commodity name drops pick state and
    # falls through (anti-dead-end). "0" stays the menu command, never a pick index.
    pick_ids = session.get("_pick_ids")
    if pick_ids:
        if msg.isdigit() and msg != "0":
            n = int(msg)
            if 1 <= n <= len(pick_ids):
                item_id = pick_ids[n - 1]
                session.pop("_pick_ids", None); save_session(phone, session)
                _add_by_id(phone, item_id, session, lang)
                return
            send_message(phone, t(lang, "basket_pick_range", n=len(pick_ids))); return
        # command or new search → clear stale pick state, then fall through.
        # MUST save here (a single-match add never touches _pick_ids).
        session.pop("_pick_ids", None); save_session(phone, session)

    if msg in ("0", "menu", "back"):
        clear_session(phone); show_main_menu(phone); return

    if msg == "clear":
        try:
            _clear_basket(phone)
            session["step"] = 1; save_session(phone, session)
            send_message(phone, t(lang, "basket_cleared"))
        except Exception as e:
            logging.error(f"[basket.clear] {e}"); send_message(phone, t(lang, "error_generic"))
        return

    if msg == "done":
        _show_summary(phone, lang); return

    # Prevent "basket" keyword being treated as commodity search
    if msg == "basket" and step == 1:
        try:
            rows = _fetch_basket(phone)
            count = len(rows)
            total = sum(float(r["price_at_add"] or 0) * r["quantity"] for r in rows)
            send_message(phone, t(lang, "basket_status", count=count, total=total))
        except Exception as e:
            logging.error(f"[basket.status] {e}"); send_message(phone, t(lang, "error_generic"))
        return

    if step == 0:
        session.update({"_flow": "BASKET", "step": 1}); save_session(phone, session)
        send_message(phone, t(lang, "basket_title")); return

    # step == 1: accumulate items (persisted to dbo.Consumer_Basket)
    _add_item(phone, text, session, lang)


def _add_item(phone, query, session, lang):
    conn = None
    try:
        clean = _clean(phone)
        conn = get_connection(); cur = conn.cursor()

        # Word-boundary match (validated against live): drops cross-commodity
        # false-positives like yam->Cocoyam and oil->brOILer, keeps legit multi-word
        # names (Palm Oil, Green Beans). Fetch ALL matches (no TOP 1) to disambiguate.
        # NOTE: literal % in the LIKE patterns are escaped as %% for pymssql's %s
        # param substitution (else pymssql raises a param-count mismatch at runtime).
        cur.execute(
            "SELECT item_id, item_name, AVG(price_naira) AS avg_p, unit "
            "FROM dbo.Latest_Prices_Summary "
            "WHERE is_nbs_ref=0 AND is_food=1 AND price_naira>0 "
            "AND ( item_name = %s "
            "   OR item_name LIKE %s + ' %%' "
            "   OR item_name LIKE '%% ' + %s "
            "   OR item_name LIKE '%% ' + %s + ' %%' "
            "   OR item_name LIKE %s + ' -%%' "
            "   OR item_name LIKE %s + '-%%' ) "
            "GROUP BY item_id, item_name, unit ORDER BY item_name",
            (query, query, query, query, query, query))
        rows = cur.fetchall() or []
        if not rows:
            send_message(phone, t(lang, "basket_not_found", q=query)); return
        if len(rows) > 1:
            # v149: numbered pick-list replaces the v148 dead-end narrow-prompt.
            # ids-only (price re-resolved live at pick time); self-save full dict.
            capped = rows[:10]
            session["_pick_ids"] = [r["item_id"] for r in capped]
            save_session(phone, session)
            lines = "\n".join(f"{i+1}. {r['item_name']}" for i, r in enumerate(capped))
            more = t(lang, "basket_more_hint") if len(rows) > 10 else ""
            send_message(phone, t(lang, "basket_picklist",
                count=len(rows), shown=len(capped), lines=lines, q=query, more=more))
            return
        row = rows[0]

        item_id      = row["item_id"]
        item_name    = row["item_name"]
        unit         = row["unit"] or "unit"
        avg_p        = row["avg_p"]
        price_at_add = float(avg_p) if avg_p is not None else None

        _upsert_and_reply(cur, conn, phone, clean, lang,
                          item_id, item_name, unit, price_at_add)
    except Exception as e:
        logging.error(f"[basket._add_item] {e}"); send_message(phone, t(lang, "error_generic"))
    finally:
        if conn:
            conn.close()


def _upsert_and_reply(cur, conn, phone, clean, lang, item_id, item_name, unit, price_at_add):
    # Shared upsert+reply for direct add (_add_item) and pick add (_add_by_id) so a pick
    # and a direct add of the SAME item render identically. Extracted verbatim from v148
    # _add_item — NO logic change. CALLER owns conn lifecycle (open + finally-close) and
    # the try/except; this helper does neither.
    cur.execute(
        "SELECT TOP 1 is_active FROM dbo.Consumer_Basket "
        "WHERE REPLACE(phone_number,'+','') = REPLACE(%s,'+','') AND item_id=%s",
        (clean, item_id))
    found = cur.fetchone()

    if found and int(found["is_active"]) == 1:
        cur.execute(
            "UPDATE dbo.Consumer_Basket "
            "SET quantity = quantity + 1, is_active = 1, updated_at = SYSUTCDATETIME() "
            "WHERE REPLACE(phone_number,'+','') = REPLACE(%s,'+','') AND item_id=%s",
            (clean, item_id))
        cur.execute(
            "SELECT quantity FROM dbo.Consumer_Basket "
            "WHERE REPLACE(phone_number,'+','') = REPLACE(%s,'+','') AND item_id=%s",
            (clean, item_id))
        out = cur.fetchone()
        new_quantity = int(out["quantity"]) if out else 1
    elif found:
        date_sql = "NULL" if price_at_add is None else "SYSUTCDATETIME()"
        cur.execute(
            "UPDATE dbo.Consumer_Basket "
            "SET quantity = 1, is_active = 1, "
            "price_at_add = %s, price_at_add_date = " + date_sql + ", "
            "updated_at = SYSUTCDATETIME() "
            "WHERE REPLACE(phone_number,'+','') = REPLACE(%s,'+','') AND item_id=%s",
            (price_at_add, clean, item_id))
        new_quantity = 1
    else:
        basket_id = "BSK_" + uuid.uuid4().hex[:20]
        date_sql = "NULL" if price_at_add is None else "SYSUTCDATETIME()"
        cur.execute(
            "INSERT INTO dbo.Consumer_Basket "
            "(basket_id, phone_number, consumer_id, item_id, item_name, category_id, "
            " quantity, unit, price_at_add, price_at_add_date, is_active, created_at, updated_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, " + date_sql + ", 1, SYSUTCDATETIME(), SYSUTCDATETIME())",
            (basket_id, clean, None, item_id, item_name, None, 1, unit, price_at_add))
        new_quantity = 1

    conn.commit()

    price_disp = price_at_add if price_at_add is not None else 0.0
    send_message(phone, t(lang, "basket_added_persisted",
        item_name=item_name, quantity=new_quantity,
        price=f"{price_disp:,.0f}", unit=unit))


def _add_by_id(phone, item_id, session, lang):
    # v149 pick resolver: re-resolve price LIVE for the chosen item_id (ids-only design —
    # no stale-price window), then run the SAME upsert+reply as a direct add.
    conn = None
    try:
        clean = _clean(phone)
        conn = get_connection(); cur = conn.cursor()
        cur.execute(
            "SELECT item_id, item_name, AVG(price_naira) AS avg_p, unit "
            "FROM dbo.Latest_Prices_Summary "
            "WHERE is_nbs_ref=0 AND is_food=1 AND price_naira>0 AND item_id=%s "
            "GROUP BY item_id, item_name, unit",
            (item_id,))
        row = cur.fetchone()
        if not row:
            send_message(phone, t(lang, "basket_not_found", q=item_id)); return
        item_name    = row["item_name"]
        unit         = row["unit"] or "unit"
        avg_p        = row["avg_p"]
        price_at_add = float(avg_p) if avg_p is not None else None
        _upsert_and_reply(cur, conn, phone, clean, lang,
                          item_id, item_name, unit, price_at_add)
    except Exception as e:
        logging.error(f"[basket._add_by_id] {e}"); send_message(phone, t(lang, "error_generic"))
    finally:
        if conn:
            conn.close()


def _fetch_basket(phone):
    conn = None
    try:
        conn = get_connection(); cur = conn.cursor()
        cur.execute(
            "SELECT item_name, quantity, unit, price_at_add "
            "FROM dbo.Consumer_Basket "
            "WHERE REPLACE(phone_number,'+','') = REPLACE(%s,'+','') AND is_active=1 "
            "ORDER BY created_at",
            (_clean(phone),))
        return cur.fetchall() or []
    finally:
        if conn:
            conn.close()


def _clear_basket(phone):
    # Soft-delete only — never DELETE.
    conn = None
    try:
        conn = get_connection(); cur = conn.cursor()
        cur.execute(
            "UPDATE dbo.Consumer_Basket "
            "SET is_active=0, updated_at=SYSUTCDATETIME() "
            "WHERE REPLACE(phone_number,'+','') = REPLACE(%s,'+','') AND is_active=1",
            (_clean(phone),))
        conn.commit()
    finally:
        if conn:
            conn.close()


def _show_summary(phone, lang):
    try:
        rows = _fetch_basket(phone)
        if not rows:
            send_message(phone, t(lang, "basket_empty")); return
        lines = "\n".join(
            f"{i+1}. {r['item_name']} (x{r['quantity']}): *₦{float(r['price_at_add'] or 0):,.0f}* per {r['unit'] or 'unit'}"
            for i, r in enumerate(rows))
        total = sum(float(r["price_at_add"] or 0) * r["quantity"] for r in rows)
        send_message(phone, t(lang, "basket_summary",
            count=len(rows), lines=lines, total=total))
    except Exception as e:
        logging.error(f"[basket._show_summary] {e}"); send_message(phone, t(lang, "error_generic"))
