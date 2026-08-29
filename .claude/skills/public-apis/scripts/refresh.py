#!/usr/bin/env python3
"""Regenerate references/apis.tsv from the upstream public-apis README.

Source: https://github.com/public-apis/public-apis (MIT). Upstream ships the
whole catalogue as one 2200-line README of markdown tables, which is the wrong
shape for an agent: loading it costs thousands of tokens to answer a question
about three entries. This flattens it to a greppable TSV.

Output is deliberately pure ASCII (accents are NFKD-folded, the "back to top"
arrows dropped) so the file survives transfer through a non-UTF-8 console pipe
without silent corruption.

Usage:
    python refresh.py                 # fetch from GitHub, rewrite apis.tsv
    python refresh.py --from README.md   # parse a local copy instead
    python refresh.py --check         # report drift without writing
"""

import argparse
import os
import re
import sys
import unicodedata
import urllib.request

RAW_URL = "https://raw.githubusercontent.com/public-apis/public-apis/master/README.md"

# | [Name](url) | Description | Auth | HTTPS | CORS |
ROW = re.compile(
    r"^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|"   # name, url
    r"([^|]*)\|"                            # description
    r"([^|]*)\|"                            # auth
    r"([^|]*)\|"                            # https
    r"([^|]*)\|"                            # cors
)
HEADING = re.compile(r"^###\s+(.+?)\s*$")
COLUMNS = ["name", "category", "auth", "https", "cors", "url", "description"]

# Sections that are not catalogue categories.
SKIP_HEADINGS = {"apis covered under apilayer suite!", "index", "contributing"}


def fold(text):
    """NFKD-fold to ASCII and squeeze whitespace. Tabs would break the TSV."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if ord(c) < 128)
    return re.sub(r"\s+", " ", text).strip()


def parse(markdown):
    """Yield one dict per catalogue entry, in README order."""
    category = None
    seen = set()
    for line in markdown.splitlines():
        heading = HEADING.match(line)
        if heading:
            title = fold(heading.group(1))
            category = None if title.lower() in SKIP_HEADINGS else title
            continue
        if not category:
            continue
        row = ROW.match(line)
        if not row:
            continue
        name, url, desc, auth, https, cors = (fold(g) for g in row.groups())
        if not name:
            continue
        # Upstream writes "No" for no-auth and wraps token kinds in backticks.
        auth = auth.strip("`") or "Unknown"
        if auth.lower() == "no":
            auth = "None"
        key = (name.lower(), url)
        if key in seen:          # upstream carries a few genuine duplicates
            continue
        seen.add(key)
        yield {
            "name": name, "category": category, "auth": auth,
            "https": https or "Unknown", "cors": cors or "Unknown",
            "url": url, "description": desc,
        }


def to_tsv(entries):
    lines = ["\t".join(COLUMNS)]
    lines += ["\t".join(e[c] for c in COLUMNS) for e in entries]
    return "\n".join(lines) + "\n"


def load(source):
    if source:
        with open(source, encoding="utf-8") as fh:
            return fh.read()
    with urllib.request.urlopen(RAW_URL, timeout=60) as resp:
        return resp.read().decode("utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="source", help="parse a local README.md")
    ap.add_argument("--check", action="store_true", help="report drift, write nothing")
    args = ap.parse_args()

    entries = list(parse(load(args.source)))
    if not entries:
        sys.exit("Parsed 0 entries  -  upstream table format probably changed.")

    tsv = to_tsv(entries)
    assert all(ord(c) < 128 for c in tsv), "output is not pure ASCII"

    out = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "..", "references", "apis.tsv")
    out = os.path.normpath(out)

    categories = sorted({e["category"] for e in entries})
    if args.check:
        old = open(out, encoding="ascii").read() if os.path.exists(out) else ""
        status = "unchanged" if old == tsv else "CHANGED"
        print(f"{len(entries)} entries, {len(categories)} categories - {status}")
        return

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="ascii", newline="\n") as fh:
        fh.write(tsv)
    print(f"Wrote {out}: {len(entries)} entries across {len(categories)} categories")
    no_auth = sum(1 for e in entries if e["auth"] == "None")
    print(f"  no-auth: {no_auth}   https: {sum(1 for e in entries if e['https'] == 'Yes')}")


if __name__ == "__main__":
    main()
