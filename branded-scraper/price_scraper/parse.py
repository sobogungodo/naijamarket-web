"""Pure parsers for branded price sources. No network, no DB — unit-testable."""
import re
from datetime import datetime

_PRICE = r'(?:₦|N|NGN|&#8358;)\s?([0-9]{1,3}(?:,[0-9]{3})+)'
_LI = re.compile(r'<li[^>]*>(.*?)</li>', re.I | re.S)
_MONTHS = {m: i for i, m in enumerate(
    ['january','february','march','april','may','june','july','august',
     'september','october','november','december'], start=1)}

def _to_float(s: str) -> float:
    return float(s.replace(',', ''))

def _extract_updated_date(html: str):
    m = re.search(r'PRICES LAST UPDATED[:\s]*([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})', html, re.I)
    if not m:
        return None
    mon = _MONTHS.get(m.group(1).lower())
    if not mon:
        return None
    try:
        return datetime(int(m.group(3)), mon, int(m.group(2))).strftime('%Y-%m-%d')
    except ValueError:
        return None

def parse_nigerianprice(html: str, parse_hint: str):
    """Pick the <li> line(s) matching parse_hint (case-insensitive) and return the price.

    Fail-safe on ambiguity: collects ALL <li> lines whose text contains the hint
    AND contain a price.
      - Zero matches -> None (hint not found).
      - Exactly one DISTINCT price among matches -> return it (covers both the
        single-match case and benign duplicates that agree on price).
      - More than one DISTINCT price among matches -> None (ambiguous; safer to
        skip than to mispick).
    """
    hint = (parse_hint or '').lower()
    if not hint:
        return None

    matches = []  # list of (price: float, excerpt_text: str)
    for li in _LI.finditer(html):
        text = re.sub(r'<[^>]+>', ' ', li.group(1))
        if hint in text.lower():
            pm = re.search(_PRICE, text)
            if pm:
                matches.append((_to_float(pm.group(1)), text))

    if not matches:
        return None

    distinct_prices = {price for price, _ in matches}
    if len(distinct_prices) > 1:
        return None

    price, text = matches[0]
    return {
        'raw_price': price,
        'source_date': _extract_updated_date(html),
        'excerpt': ' '.join(text.split())[:280],
    }

def parse_source(source: str, html: str, parse_hint: str):
    if source == 'NGPRICE':
        return parse_nigerianprice(html, parse_hint)
    # WIGMORE / SUPERMART / PRICEPALLY: not enabled in first ship (map rows active=0).
    return None
