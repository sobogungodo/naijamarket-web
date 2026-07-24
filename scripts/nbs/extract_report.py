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


def is_number(s):
    return bool(_NUM_RE.match(s.strip()))


def normalize_label(s):
    """Lowercase and strip everything that is not a-z/0-9 (spaces, punctuation,
    hyphens from line-wrap hyphenation, etc.)."""
    return re.sub(r"[^a-z0-9]", "", s.lower())


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
       {raw_label, current_price, all_averages}
    Multi-line labels are stitched via a pending-fragment accumulator.
    """
    lines = page_text.split("\n")
    rows = []
    pending = []  # accumulated leading label fragments from prior lines

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
        # precede the state cells; the state cells like "Delta (N1321.86)" are
        # non-numeric and terminate the run).
        nums = []
        for fv in rest:
            if is_number(fv):
                nums.append(fv)
            else:
                break

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
        else:
            # Not a data row.
            if leading_ws == 0 and label_fields and len(nums) == 0:
                # Left-margin text with no numbers -> a wrapped label fragment
                # continued on the next line (e.g. "Agric eggs(medium size
                # price of" -> "one)").
                pending.append(" ".join(label_fields))
            # else: indented phantom (a wrapped state cell such as "Akwa Ibom"),
            #       page number, etc. -> ignore; leave the accumulator intact.
    return rows


# --------------------------------------------------------------------------- #
# zone appendix status
# --------------------------------------------------------------------------- #

def zone_status(pages, national_page):
    """
    Report the zone-appendix status:
      table@pN   -- a zone table (6 geopolitical zones as columns) is
                    text-extractable on page N.
      image-only -- no extractable zone table, but there are near-empty
                    (image-only) pages in the zone/appendix region.
      absent     -- neither.
    """
    zone_pages = []
    for p in sorted(pages):
        up = pages[p].upper()
        strong_zone = up.count("NORTH") >= 2 and up.count("SOUTH") >= 2
        if strong_zone and "APPENDIX" in up:
            zone_pages.append(p)
    if not zone_pages:
        # secondary: strong zone signal without the literal APPENDIX word,
        # near the national table (excludes the page-2 summary infographic)
        for p in sorted(pages):
            up = pages[p].upper()
            if up.count("NORTH") >= 3 and up.count("SOUTH") >= 3 and abs(p - national_page) <= 3:
                zone_pages.append(p)
    if zone_pages:
        # The real zone data table sits adjacent to the national table; a
        # contents/summary page may also mention "APPENDIX" + zones far away.
        best = min(zone_pages, key=lambda p: abs(p - national_page))
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
            "rows": [], "zone": zone_status(pages, 9999),
            "error": "national header (MoM/YoY/Highest/Lowest) not found",
        }
    lines = nat_text.split("\n")
    header_context = " ".join(lines[max(0, hdr_idx - 2): hdr_idx + 1])
    current_idx, current_label, matched = detect_current_column(header_context, year, month)
    rows = parse_national_rows(nat_text, hdr_idx, current_idx)
    return {
        "pdf": pdf_path, "year": year, "month": month,
        "national_page": nat_page, "current_label": current_label,
        "current_matched": matched, "rows": rows,
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
        print(f"  extracted data rows: {len(res['rows'])}")

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
        return
    print(f"rows ({len(res['rows'])}):")
    for r in res["rows"]:
        print(f"  {r['current_price']:>12}   {r['raw_label']}")


if __name__ == "__main__":
    main()
