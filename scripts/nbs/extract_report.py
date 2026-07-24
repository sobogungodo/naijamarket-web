#!/usr/bin/env python3
"""
NBS Selected Food Prices report -- national-table extractor.

Extracts the *national* average table (one row per food item, current-month
average price in the item's native unit) from an NBS monthly "Selected Food
Prices Watch" PDF.

Design goals / robustness contract (see scripts/nbs/README notes in the task):
  1. The national table is located by HEADER TEXT, not by page number. A page
     is the national page iff one of its lines carries all four of the tokens
     MoM, YoY, Highest, Lowest. (The zone APPENDIX page uses the 6 geopolitical
     zone names as columns and has none of those four tokens -> it is skipped.)
  2. Columns are identified by NAME, not fixed index. There are always three
     "Average of {month}" columns (year-ago, previous-month, current-month).
     The value we want is the CURRENT month = the last of those three. We try
     to confirm it by matching the report's own month (from the filename) to
     the header month tokens; if that fails we fall back to "the last average
     column before MoM/YoY". This survives the documented flips of
     MoM/YoY vs Highest/Lowest ordering across report vintages, because we only
     ever take the *first three* numeric fields after the label as the averages.
  3. Multi-line / wrapped labels (e.g. "Agric eggs(medium size price of" +
     "one)", or the hyphenated "carna-" + "tion 170g") are stitched back
     together by accumulating leading label fragments. We do NOT hand-filter
     phantom rows; the verify step matches on a normalized label key so any
     phantom that matches no target is simply ignored.
  4. Zone appendix status is reported, never fatal: table@pN if a zone table is
     text-extractable, image-only if the zone section pages carry no text,
     absent otherwise.

CLI:
    python extract_report.py <pdf> [--month YYYY-MM]
    python extract_report.py --verify [--targets targets.csv] [--dir DIR]

pdftotext (xpdf 4.06) is invoked in -table mode: it column-aligns the national
table so that splitting each row on runs of 2+ spaces cleanly separates the
label from the numeric columns.
"""

import argparse
import os
import re
import subprocess
import sys
from decimal import Decimal, InvalidOperation

# --------------------------------------------------------------------------- #
# pdftotext plumbing
# --------------------------------------------------------------------------- #

MONTH_ABBR = {
    1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
    7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
}


def pdftotext_page(pdf, page):
    """Return the -table text of a single PDF page (1-indexed)."""
    try:
        r = subprocess.run(
            ["pdftotext", "-f", str(page), "-l", str(page), "-table", pdf, "-"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
    except FileNotFoundError:
        sys.exit("ERROR: pdftotext not found on PATH (need xpdf pdftotext).")
    return (r.stdout or "").replace("\x0c", "\n")


def scan_pages(pdf, max_scan=45):
    """
    Return {page_number: page_text} for pages 1..N. Stops after enough trailing
    empty pages once we are past the typical national-table region.
    """
    pages = {}
    empty_streak = 0
    for p in range(1, max_scan + 1):
        t = pdftotext_page(pdf, p)
        pages[p] = t
        if len(t.strip()) < 3:
            empty_streak += 1
        else:
            empty_streak = 0
        # NBS reports run ~17-25 pages; bail once clearly past the end.
        if p >= 18 and empty_streak >= 5:
            break
    return pages


# --------------------------------------------------------------------------- #
# label / number helpers
# --------------------------------------------------------------------------- #

_NUM_RE = re.compile(r"^-?\d[\d,]*(?:\.\d+)?$")

# A Lowest/Highest state annotation such as "Yobe (41.05)" or bare "(2212.42)":
# any text followed by a parenthesised PURE number. This distinguishes state
# cells from label fragments that merely contain parentheses or units
# ("(peak)", "(epiya)", "500g", "2kg)") -- those keep letters inside/around.
_STATE_CELL_RE = re.compile(r"\([\d.,]+\)")

# The NBS national table carries ~43 physical food rows (41 of which are the
# tracked anchors). A healthy parse yields ~43; anything materially short means
# rows were silently dropped (the worst failure mode) -> flag as INCOMPLETE.
EXPECTED_MIN_ROWS = 40

# Label-plausibility gate. A row whose label is truncated (unclosed '(' or a
# trailing hyphen from a wrap) or that fails to match any known NBS commodity
# label after normalisation is counted as an "unmatched label", SEPARATELY from
# usable rows -- so a month with unrecoverable text-layer dropout announces
# itself, e.g. "rows (43, usable=38, unmatched_labels=5)", instead of passing
# the row-count gate. More than UNMATCHED_MAX unmatched labels -> INCOMPLETE.
UNMATCHED_MAX = 2

# Normalised roster of every NBS national-table commodity label seen across the
# z_nbs_anchor vintages (81 raw spellings -> 67 normalised forms: comma/space
# drift collapses, but Gari/Garri, unit changes 500g/450g/75cl and item-roster
# changes remain), PLUS the two legit non-anchored rows every report prints
# ('Agric eggs medium size' whole tray, 'Frozen chicken'). Used only to FLAG
# truncated/unknown labels, never to filter data. Regenerate from
#   SELECT DISTINCT nbs_label FROM dbo.z_nbs_anchor  (normalised via normalize_label)
# if the roster changes.
KNOWN_NBS_LABELS_NORM = frozenset({
    'agriceggsmediumsize', 'agriceggsmediumsizepriceofone', 'agricheneggs',
    'agricheneggsacrateof30pieces', 'beansbrown', 'beansbrownsoldloose',
    'beanswhite', 'beanswhiteblackeyesoldloose', 'beefbonein', 'beefboneless',
    'breadsliced450g', 'breadsliced500g', 'breadunsliced450g', 'breadunsliced500g',
    'brokenriceofada', 'catfishdried', 'catfishobokunfresh', 'catfishsmoked',
    'catfreshfish', 'chickenfeet', 'chickenwings', 'driedfishsardine',
    'evaporatedtinnedmilkcarnation170g', 'evaporatedtinnedmilkpeak170g',
    'frozenchicken', 'gariwhitesoldloose', 'gariyellowsoldloose', 'garriwhite',
    'garriyellow', 'groundnutoil1bottle', 'groundnutoil1bottlespecifybottle',
    'groundnutoil75cl', 'icedsardine', 'irishpotato', 'irishpotatoe',
    'localricebroken', 'mackerelfrozen', 'maizecorngrainswhitesoldloose',
    'maizegrainwhitesoldloose', 'maizegrainyellowsoldloose', 'mudfisharofresh',
    'mudfishdried', 'onionbulb', 'onionsfresh', 'palmoil1bottlespecifybottle',
    'palmoil75cl', 'plantainripe', 'plantainunripe', 'riceagricsoldloose',
    'riceimportedhighqualitysoldloose', 'ricelocalshortgrained', 'ricelocalsoldloose',
    'ricelonggrainedimported', 'ricemediumgrained', 'sweetpotato', 'sweetpotatoes',
    'tilapiafishepiyafresh', 'tilapiafreshfishepiya', 'tinmilkevaporatedpeakmilk150g',
    'titusfrozen', 'tomato', 'tomatoesfresh', 'vegetableoil1bottlespecifybottle',
    'vegetableoil75cl', 'wheatflourprepacked2kg', 'wheatflourprepackedgoldenpenny2kg',
    'yamtuber',
})


def is_number(s):
    return bool(_NUM_RE.match(s.strip()))


def looks_like_state_cell(field):
    """True for a Lowest/Highest state annotation like 'Yobe (41.05)'."""
    return bool(_STATE_CELL_RE.search(field))


def leading_numbers(rest):
    """
    The leading run of numeric fields from ``rest`` (the post-label fields).

    Crucially, this also expands fields that pdftotext -table glued together
    with a SINGLE space when two adjacent average columns render close, e.g.
    the field '2,158.12 2,174.24' is split back into two numbers. Without this,
    such a merged field is non-numeric, the leading numeric run stops at 1, the
    row fails the ">=3 averages" test and is silently dropped (root cause of the
    2023-09 8/9-row loss). Stops at the first field that is neither a number nor
    a pure run of space-separated numbers (e.g. a state cell 'Edo (2644.9)').
    """
    nums = []
    for fv in rest:
        fv = fv.strip()
        if is_number(fv):
            nums.append(fv)
            continue
        parts = fv.split()
        if len(parts) >= 2 and all(is_number(p) for p in parts):
            nums.extend(parts)
            continue
        break
    return nums


def normalize_label(s):
    """Lowercase and strip everything that is not a-z/0-9 (spaces, punctuation,
    hyphens from line-wrap hyphenation, etc.)."""
    return re.sub(r"[^a-z0-9]", "", s.lower())


def label_implausible(raw_label):
    """
    Return a short reason string if the row's label looks truncated or unknown,
    else None. Three signals:
      * 'open-paren'      -- an unclosed '(' (e.g. 'Wheat flour: prepacked (golden').
                             A complete label balances its parens ('(peak)',
                             '(golden penny 2kg)'), so only a wrap-truncated one trips.
      * 'trailing-hyphen' -- ends with '-' (a hyphenated wrap, e.g. 'specify bot-').
      * 'unmatched'       -- normalises to something absent from KNOWN_NBS_LABELS_NORM.
                             Catches mid-word cuts with no structural marker, e.g.
                             '...carnation' missing '170g', or '...sold' missing 'loose'.
    """
    s = raw_label.strip()
    if not s:
        return "empty"
    if s.count("(") > s.count(")"):
        return "open-paren"
    if s.endswith("-"):
        return "trailing-hyphen"
    if normalize_label(s) not in KNOWN_NBS_LABELS_NORM:
        return "unmatched"
    return None


def parse_price(s):
    """'1,550.24' -> Decimal quantized to 2dp as a string ('1550.24')."""
    try:
        d = Decimal(s.replace(",", "").strip())
    except InvalidOperation:
        return None
    return str(d.quantize(Decimal("0.01")))


# --------------------------------------------------------------------------- #
# national table location + parsing
# --------------------------------------------------------------------------- #

def _is_national_header_line(line):
    return (
        re.search(r"\bMoM\b", line, re.I)
        and re.search(r"\bYoY\b", line, re.I)
        and re.search(r"\bHighest\b", line, re.I)
        and re.search(r"\bLowest\b", line, re.I)
    )


def find_national_page(pages):
    """Return (page_number, page_text, header_line_index) or (None, None, None)."""
    for p in sorted(pages):
        lines = pages[p].split("\n")
        for i, ln in enumerate(lines):
            if _is_national_header_line(ln):
                return p, pages[p], i
    return None, None, None


def detect_current_column(header_context, year, month):
    """
    Determine which of the three average columns is the current month and a
    human-readable label for it.

    Returns (current_idx, label_str, matched_bool).
    current_idx is the 0-based index into the three averages (0,1,2).
    """
    ab = MONTH_ABBR[month]
    yy = f"{year % 100:02d}"
    # Month tokens like Jun-21 / Feb-24 / Oct-24, in reading order.
    toks = re.findall(r"([A-Za-z]{3})-(\d{2,4})", header_context)
    want = {f"{ab}-{yy}".lower(), f"{ab}-{year}".lower()}
    for idx, (m, y) in enumerate(toks):
        if f"{m}-{y}".lower() in want:
            # Map token position onto the (last three) average columns.
            # There are exactly three averages; index within them:
            col = idx if len(toks) <= 3 else idx - (len(toks) - 3)
            col = max(0, min(2, col))
            return col, f"{m}-{y}", True
    # Flexible match (handles a month split across wrapped header lines).
    if re.search(rf"{ab}[-\s]*{yy}\b", header_context) or \
       re.search(rf"{ab}[-\s]*{year}\b", header_context):
        return 2, f"{ab}-{yy} (flex-matched)", True
    return 2, f"{ab}-{yy} (NOT found in header; using last average column)", False


def parse_national_rows(page_text, header_idx, current_idx):
    """
    Parse the national table body. Returns list of dicts:
       {raw_label, current_price, averages}

    Wrapped labels are stitched two ways:
      * PRE  -- a bare label fragment on a line with no numbers, belonging to
                the NEXT row (numbers are on the following line), e.g.
                "Evaporated tinned milk carnation" + "170g  251.65 ...".
                Accumulated in ``pending`` and prepended to the next data row.
      * POST -- a label tail that belongs to the PREVIOUS data row, appearing
                on the line AFTER it because that row's state cell wrapped. In
                the compact "C1" layout Lowest/Highest come BEFORE MoM/YoY, so
                a wrapped row leaves its tail plus the bled state cells on the
                next line, e.g. "one)  Yobe (41.05)  Lagos (68)". We append the
                label tail ("one)") to the previous row and DROP the state cells
                (rather than letting them bleed into the next row's label).
    """
    lines = page_text.split("\n")
    rows = []
    pending = []  # accumulated PRE label fragments from prior lines

    for raw in lines[header_idx + 1:]:
        raw = raw.rstrip("\n").rstrip()
        if raw.strip() == "":
            continue  # -table double-spaces rows; blank lines are separators
        leading_ws = len(raw) - len(raw.lstrip(" "))
        stripped = raw.strip()
        fields = re.split(r"\s{2,}", stripped)

        # The label is the run of leading NON-numeric fields. This handles the
        # case where a long label wraps onto a second column on the SAME line
        # (e.g. "Palm oil: 1 bottle,specify" | "bottle" | 825.51 | ...): both
        # "Palm oil: 1 bottle,specify" and "bottle" are non-numeric and belong
        # to the label; the averages begin at the first numeric field. (No food
        # label field is ever a bare number -- embedded numbers carry a unit
        # like 500g / 2kg, so they are never split off as pure-numeric fields.)
        li = 0
        while li < len(fields) and not is_number(fields[li]):
            li += 1
        label_fields = fields[:li]
        rest = fields[li:]

        # Leading run of numeric fields = the three averages (+MoM/YoY when they
        # precede the state cells). Single-space-merged average columns are
        # expanded here so the run reaches 3 (see leading_numbers()).
        nums = leading_numbers(rest)

        if len(nums) >= 3:
            # Data row.
            label = " ".join(pending + label_fields).strip()
            averages = nums[:3]
            idx = current_idx if current_idx < len(averages) else len(averages) - 1
            rows.append({
                "raw_label": label,
                "current_price": parse_price(averages[idx]),
                "averages": [parse_price(a) for a in averages],
            })
            pending = []
            continue

        # ---- Not a data row: a wrapped-label continuation fragment. ----
        if leading_ws != 0 or not label_fields:
            # Indented overflow (a wrapped state name such as "Akwa Ibom"),
            # page number, etc. -> ignore; leave the accumulators intact.
            continue

        # Separate the label tail (left, in the label column) from any bled
        # state cells (Lowest/Highest annotations that wrapped onto this line).
        frag_fields = [f for f in label_fields if not looks_like_state_cell(f)]
        has_state = any(looks_like_state_cell(f) for f in fields)
        tail = " ".join(frag_fields).strip()

        if has_state and tail and rows:
            # POST continuation: complete the PREVIOUS row's (possibly empty)
            # label and discard the bled state cells.
            rows[-1]["raw_label"] = (rows[-1]["raw_label"] + " " + tail).strip()
        elif tail:
            # PRE fragment: a bare label wrap belonging to the NEXT row.
            pending.append(tail)
        # else: nothing usable -> ignore, leave accumulators intact.
    return rows


# --------------------------------------------------------------------------- #
# zone appendix status
# --------------------------------------------------------------------------- #

_DECIMAL_RE = re.compile(r"\d[\d,]*\.\d+")


def zone_status(pages, national_page):
    """
    Report the zone-appendix status:
      table@pN   -- a zone DATA table (the 6 geopolitical zones as columns/
                    sections, WITH a numeric price grid) is text-extractable on
                    page N.
      image-only -- no extractable zone table, but there are near-empty
                    (image-only) pages in the zone/appendix region.
      absent     -- neither.

    A page qualifies as the zone data table only if it carries BOTH a strong
    zone signal (>=2 NORTH and >=2 SOUTH mentions -- the six zone names) AND an
    actual numeric grid. The grid requirement is what rejects a table-of-
    contents / summary page: those name the zones and even the word "APPENDIX"
    but contain no price numbers (root cause of 2021-10 mis-selecting the p2
    contents page over the real p15 zone table). The literal word "APPENDIX" is
    only a weak hint now, never a requirement -- the real zone table
    ("Selected Food Prices - All Zone") often omits it. Ties break toward the
    page nearest the national table.
    """
    def grid_count(text):
        return len(_DECIMAL_RE.findall(text))

    candidates = []
    for p in sorted(pages):
        up = pages[p].upper()
        strong_zone = up.count("NORTH") >= 2 and up.count("SOUTH") >= 2
        has_grid = grid_count(pages[p]) >= 10
        if strong_zone and has_grid:
            candidates.append(p)
    if candidates:
        # The real zone data table sits adjacent to the national table; prefer
        # the nearest qualifying page, then earliest.
        best = min(candidates, key=lambda p: (abs(p - national_page), p))
        return f"table@p{best}"
    near_empty = [p for p in pages if p > national_page and len(pages[p].strip()) < 40]
    if near_empty:
        return "image-only"
    return "absent"


# --------------------------------------------------------------------------- #
# top-level extract
# --------------------------------------------------------------------------- #

def infer_month(pdf_path, month_arg):
    if month_arg:
        m = re.match(r"^(\d{4})-(\d{2})$", month_arg.strip())
        if not m:
            sys.exit(f"ERROR: --month must be YYYY-MM, got {month_arg!r}")
        return int(m.group(1)), int(m.group(2))
    m = re.search(r"(\d{4})-(\d{2})", os.path.basename(pdf_path))
    if not m:
        sys.exit("ERROR: cannot infer month from filename; pass --month YYYY-MM")
    return int(m.group(1)), int(m.group(2))


def extract(pdf_path, month_arg=None):
    """
    Returns a dict:
      {pdf, year, month, national_page, current_label, current_matched,
       rows: [ {raw_label, current_price, averages}, ... ],
       zone}
    """
    year, month = infer_month(pdf_path, month_arg)
    pages = scan_pages(pdf_path)
    nat_page, nat_text, hdr_idx = find_national_page(pages)
    if nat_page is None:
        return {
            "pdf": pdf_path, "year": year, "month": month,
            "national_page": None, "current_label": None, "current_matched": False,
            "rows": [], "row_count": 0, "usable_count": 0, "price_rows": 0,
            "unmatched_count": 0, "unmatched_labels": [], "incomplete": True,
            "zone": zone_status(pages, 9999),
            "error": "national header (MoM/YoY/Highest/Lowest) not found",
        }
    lines = nat_text.split("\n")
    header_context = " ".join(lines[max(0, hdr_idx - 2): hdr_idx + 1])
    current_idx, current_label, matched = detect_current_column(header_context, year, month)
    rows = parse_national_rows(nat_text, hdr_idx, current_idx)
    # Gate 1 (row-count / silent-drop): rows that yielded a price. A short list
    # means rows were dropped -- never return that quietly.
    price_rows = sum(1 for r in rows if r["current_price"] is not None)
    # Gate 2 (label plausibility): flag truncated/unknown labels SEPARATELY, so a
    # text-layer dropout (prices present, labels cut) can't slip past the count.
    unmatched = [(r["raw_label"], label_implausible(r["raw_label"])) for r in rows]
    unmatched = [(lbl, why) for lbl, why in unmatched if why]
    usable = sum(1 for r in rows
                 if r["current_price"] is not None and not label_implausible(r["raw_label"]))
    return {
        "pdf": pdf_path, "year": year, "month": month,
        "national_page": nat_page, "current_label": current_label,
        "current_matched": matched, "rows": rows,
        "row_count": len(rows), "usable_count": usable, "price_rows": price_rows,
        "unmatched_count": len(unmatched), "unmatched_labels": unmatched,
        "incomplete": price_rows < EXPECTED_MIN_ROWS or len(unmatched) > UNMATCHED_MAX,
        "zone": zone_status(pages, nat_page),
    }


# --------------------------------------------------------------------------- #
# verify harness
# --------------------------------------------------------------------------- #

def load_targets(path):
    """targets.csv: UTF-8 BOM, pipe-delimited, YYYY-MM|item_id|nbs_label|price|unit."""
    out = {}  # month -> list of dicts
    with open(path, "r", encoding="utf-8-sig") as fh:
        for line in fh:
            line = line.rstrip("\n").rstrip("\r")
            if not line.strip():
                continue
            parts = line.split("|")
            if len(parts) < 5:
                continue
            ym, item_id, label, price, unit = parts[0], parts[1], parts[2], parts[3], parts[4]
            out.setdefault(ym.strip(), []).append({
                "item_id": item_id.strip(),
                "nbs_label": label.strip(),
                "price": parse_price(price),
                "unit": unit.strip(),
            })
    return out


def verify(targets_path, pdf_dir):
    targets = load_targets(targets_path)
    grand_match = grand_mismatch = grand_missing = grand_total = 0
    per_month_summary = []
    print("=" * 78)
    print("NBS national-table extractor -- verification against known-good anchors")
    print("targets:", targets_path)
    print("=" * 78)

    for ym in sorted(targets):
        pdf = os.path.join(pdf_dir, f"tg_{ym}.pdf")
        tlist = targets[ym]
        print(f"\n----- {ym}  ({len(tlist)} targets)  pdf={pdf} -----")
        if not os.path.exists(pdf):
            print(f"  !! PDF not found: {pdf}")
            per_month_summary.append((ym, 0, 0, len(tlist), len(tlist)))
            grand_missing += len(tlist); grand_total += len(tlist)
            continue

        res = extract(pdf, ym)
        print(f"  national table found on page: {res['national_page']}")
        print(f"  detected current-month column: {res['current_label']}"
              f"   (month-matched={res['current_matched']})")
        print(f"  zone status: {res['zone']}")
        print(f"  extracted data rows: {len(res['rows'])}"
              f"  (usable={res['usable_count']}, unmatched_labels={res['unmatched_count']})")
        for lbl, why in res["unmatched_labels"]:
            print(f"    [unmatched-label:{why}] {lbl!r}")

        if res.get("incomplete"):
            # Silent short lists / label dropout are the worst failure modes:
            # fail the whole month rather than partially trust it.
            print(f"  !! INCOMPLETE (rows={res['price_rows']} < {EXPECTED_MIN_ROWS}? "
                  f"or unmatched_labels={res['unmatched_count']} > {UNMATCHED_MAX}?) -- "
                  f"counting all {len(tlist)} targets as FAILED.")
            per_month_summary.append((ym, 0, 0, len(tlist), len(tlist)))
            grand_missing += len(tlist); grand_total += len(tlist)
            continue

        # Build normalized-label -> price map (note collisions if any).
        ext = {}
        collisions = []
        for r in res["rows"]:
            k = normalize_label(r["raw_label"])
            if k in ext and ext[k] != r["current_price"]:
                collisions.append((k, ext[k], r["current_price"]))
            ext.setdefault(k, r["current_price"])
        for k, a, b in collisions:
            print(f"    [warn] normalized-label collision {k!r}: {a} vs {b}")

        matched = mismatch = missing = 0
        discrepancies = []
        for t in tlist:
            k = normalize_label(t["nbs_label"])
            got = ext.get(k)
            if got is None:
                missing += 1
                discrepancies.append(("MISSING", t, "no row"))
            elif got == t["price"]:
                matched += 1
            else:
                mismatch += 1
                discrepancies.append(("MISMATCH", t, got))

        for kind, t, got in discrepancies:
            print(f"    {kind:8s} {t['item_id']}  {t['nbs_label']!r}"
                  f"  target={t['price']}  extracted={got}")

        print(f"  >>> {ym}: {matched}/{len(tlist)} exact"
              f"  (mismatch={mismatch}, missing={missing})")
        per_month_summary.append((ym, matched, mismatch, missing, len(tlist)))
        grand_match += matched; grand_mismatch += mismatch
        grand_missing += missing; grand_total += len(tlist)

    print("\n" + "=" * 78)
    print("SUMMARY")
    for ym, m, mm, ms, tot in per_month_summary:
        print(f"  {ym}: {m}/{tot} exact  (mismatch={mm}, missing={ms})")
    print("-" * 78)
    print(f"  OVERALL: {grand_match}/{grand_total} exact"
          f"  (mismatch={grand_mismatch}, missing={grand_missing})")
    print("=" * 78)
    return grand_match == grand_total


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def main():
    ap = argparse.ArgumentParser(description="NBS national-table extractor")
    ap.add_argument("pdf", nargs="?", help="path to an NBS report PDF")
    ap.add_argument("--month", help="YYYY-MM (else inferred from filename)")
    ap.add_argument("--verify", action="store_true",
                    help="run verification against targets.csv over all reports")
    ap.add_argument("--targets", default=None, help="path to targets.csv (verify mode)")
    ap.add_argument("--dir", default=None,
                    help="dir holding tg_YYYY-MM.pdf files (verify mode)")
    args = ap.parse_args()

    if args.verify:
        here = os.path.dirname(os.path.abspath(__file__))
        targets = args.targets or os.path.join(here, "targets.csv")
        pdf_dir = args.dir or (os.path.dirname(os.path.abspath(args.pdf)) if args.pdf
                               else os.getcwd())
        ok = verify(targets, pdf_dir)
        sys.exit(0 if ok else 1)

    if not args.pdf:
        ap.error("provide a <pdf> path, or use --verify")

    res = extract(args.pdf, args.month)
    print(f"pdf: {res['pdf']}")
    print(f"report month: {res['year']}-{res['month']:02d}")
    print(f"national table page: {res['national_page']}")
    print(f"detected current-month column: {res['current_label']}"
          f"  (month-matched={res['current_matched']})")
    print(f"zone status: {res['zone']}")
    if res.get("error"):
        print(f"ERROR: {res['error']}")
        sys.stderr.write(f"\nINCOMPLETE: {res['error']}\n")
        sys.exit(2)
    print(f"rows ({len(res['rows'])}, usable={res['usable_count']}, "
          f"unmatched_labels={res['unmatched_count']}):")
    for r in res["rows"]:
        print(f"  {r['current_price']:>12}   {r['raw_label']}")
    if res["unmatched_labels"]:
        print("  -- truncated / unknown labels (excluded from usable):")
        for lbl, why in res["unmatched_labels"]:
            print(f"       [{why}] {lbl!r}")
    if res.get("incomplete"):
        # Fail loudly (non-zero exit + stderr) rather than returning a bad list
        # quietly: either rows were dropped, or labels are truncated/unknown.
        reasons = []
        if res["price_rows"] < EXPECTED_MIN_ROWS:
            reasons.append(f"only {res['price_rows']} data rows (< {EXPECTED_MIN_ROWS}) "
                           f"-- rows were dropped")
        if res["unmatched_count"] > UNMATCHED_MAX:
            reasons.append(f"{res['unmatched_count']} unmatched/truncated labels "
                           f"(> {UNMATCHED_MAX}) -- text-layer dropout")
        sys.stderr.write("\nINCOMPLETE: " + "; ".join(reasons or ["failed a completeness gate"])
                         + " -- do NOT trust this extraction.\n")
        sys.exit(2)


if __name__ == "__main__":
    main()
