import os, pathlib
from price_scraper.parse import parse_nigerianprice, parse_source

FIX = pathlib.Path(__file__).parent / "fixtures"

def _load(name): return (FIX / name).read_text(encoding="utf-8", errors="ignore")

def test_nigerianprice_full_carton_titus_sardine():
    html = _load("nigerianprice_titus_sardine.html")
    r = parse_nigerianprice(html, "1 Carton")
    assert r is not None
    assert r["raw_price"] == 35000.0            # "50 Pieces (1 Carton): From N35,000"
    # NOTE: the real captured fixture reads "PRICES LAST UPDATED: MARCH 4, 2024."
    # (the task brief's draft text said 2026, but the actual scraped HTML says 2024 —
    # asserting against the real fixture content here, see task-3-report.md).
    assert r["source_date"] == "2024-03-04"

def test_nigerianprice_half_carton_hint_picks_different_line():
    html = _load("nigerianprice_titus_sardine.html")
    r = parse_nigerianprice(html, "Half Carton")
    assert r["raw_price"] == 18000.0

def test_nigerianprice_hint_not_found_returns_none():
    assert parse_nigerianprice("<ul><li>nothing here</li></ul>", "1 Carton") is None

def test_parse_source_disabled_sources_return_none():
    assert parse_source("SUPERMART", "<html></html>", "x") is None
    assert parse_source("WIGMORE", "<html></html>", "x") is None

def test_nigerianprice_ambiguous_hint_multiple_distinct_prices_returns_none():
    # Two <li> lines both contain the hint but have DIFFERENT prices -> unsafe to
    # pick either one, so the fail-safe behavior is to return None.
    html = (
        "<ul>"
        "<li>Golden Penny Semovita 1 Carton: From N10,000</li>"
        "<li>Honeywell Semovita 1 Carton: From N12,000</li>"
        "</ul>"
    )
    assert parse_nigerianprice(html, "1 Carton") is None

def test_nigerianprice_ambiguous_hint_same_price_returns_that_price():
    # Two <li> lines both contain the hint with the SAME price -> benign duplicate,
    # safe to return that price.
    html = (
        "<ul>"
        "<li>Golden Penny Semovita 1 Carton: From N10,000</li>"
        "<li>Honeywell Semovita 1 Carton: From N10,000</li>"
        "</ul>"
    )
    r = parse_nigerianprice(html, "1 Carton")
    assert r is not None
    assert r["raw_price"] == 10000.0
