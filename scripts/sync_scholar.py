#!/usr/bin/env python3
"""Refresh public Google Scholar summary metrics for the static academic site."""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

SCHOLAR_ID = "nB2d3vgAAAAJ"
PROFILE_URL = f"https://scholar.google.com/citations?user={SCHOLAR_ID}&hl=en"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "scholar-stats.json"


def read_metrics() -> dict[str, int]:
    request = urllib.request.Request(PROFILE_URL, headers={"User-Agent": "Mozilla/5.0 (compatible; AcademicSiteMetrics/1.0)"})
    with urllib.request.urlopen(request, timeout=30) as response:
        page = response.read().decode("utf-8", errors="replace")
    values = re.findall(r'class=["\']gsc_rsb_std["\'][^>]*>\s*([^<]+)', page)
    values = [html.unescape(value).replace(",", "").strip() for value in values]
    if len(values) < 3 or not all(value.isdigit() for value in values[:3]):
        raise ValueError("Could not find the public Scholar summary metrics")
    return {"citations": int(values[0]), "h_index": int(values[1]), "i10_index": int(values[2])}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    try:
        metrics = read_metrics()
    except Exception as exc:
        print(f"Scholar refresh skipped: {exc}", file=sys.stderr)
        return 0
    payload = {"scholar_id": SCHOLAR_ID, **metrics, "updated_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"), "source": PROFILE_URL}
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if args.write:
        OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
