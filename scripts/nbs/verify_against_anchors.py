#!/usr/bin/env python3
"""
Verify the NBS national-table extractor against known-good anchors.

Joins the extractor's output for each report to the anchors in targets.csv by a
NORMALIZED label key (lowercase, all spaces + punctuation stripped) and compares
the current-month price to the kobo (exact 2-decimal equality). Prints, per
month, matched / mismatched / missing counts and every discrepancy, plus an
overall total.

Usage:
    python verify_against_anchors.py [--targets targets.csv] [--dir DIR]

Defaults: targets.csv sits next to this script; PDFs (tg_YYYY-MM.pdf) are read
from --dir (default: the directory given, else current dir). For the build/prove
run the PDFs live in the scratchpad, so pass --dir <scratchpad>.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import extract_report as er  # noqa: E402


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser()
    ap.add_argument("--targets", default=os.path.join(here, "targets.csv"))
    ap.add_argument("--dir", default=here,
                    help="directory containing tg_YYYY-MM.pdf files")
    args = ap.parse_args()
    ok = er.verify(args.targets, args.dir)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
