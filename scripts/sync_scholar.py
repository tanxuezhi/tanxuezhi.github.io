#!/usr/bin/env python3
"""Refresh public Google Scholar profile statistics and publication records."""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

SCHOLAR_ID = "nB2d3vgAAAAJ"
PROFILE_URL = f"https://scholar.google.com/citations?user={SCHOLAR_ID}&hl=en"
ROOT = Path(__file__).resolve().parents[1]
STATS_OUTPUT = ROOT / "data" / "scholar-stats.json"
PUBLICATIONS_OUTPUT = ROOT / "data" / "scholar-publications.json"


def clean(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def tag_has_class(attributes: str, class_name: str) -> bool:
    match = re.search(r"\bclass=[\"']([^\"']*)[\"']", attributes)
    return bool(match and class_name in match.group(1).split())


def request_page(start: int = 0, retries: int = 3) -> str:
    """Retrieve a Scholar works page, retrying transient rate-limit responses."""
    url = f"{PROFILE_URL}&view_op=list_works&cstart={start}&pagesize=100"
    error: Exception | None = None
    for attempt in range(retries):
        try:
            request = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
            with urllib.request.urlopen(request, timeout=30) as response:
                page = response.read().decode("utf-8", errors="replace")
            if "gsc_a_tr" in page:
                return page
            raise ValueError("Scholar returned no publication rows")
        except Exception as exc:
            error = exc
            if attempt + 1 < retries:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Could not retrieve Scholar works page: {error}")


def read_metrics(page: str) -> dict[str, int]:
    values = re.findall(r'class=["\']gsc_rsb_std["\'][^>]*>\s*([^<]+)', page)
    values = [html.unescape(value).replace(",", "").strip() for value in values]
    if len(values) < 3 or not all(value.isdigit() for value in values[:3]):
        raise ValueError("Could not find the public Scholar summary metrics")
    return {"citations": int(values[0]), "h_index": int(values[1]), "i10_index": int(values[2])}


def classify(title: str) -> str:
    text = title.lower()
    groups = {
        "energy": ("wind energy", "solar energy", "hydropower", "renewable energy", "photovoltaic", "wind power"),
        "agri": ("agricultur", "crop", "maize", "wheat", "irrigation", "nitrogen", "soil moisture"),
        "hazards": ("drought", "flood", "whiplash", "disaster", "hazard", "cyclone"),
        "extreme": ("precipitation", "rainfall", "rainstorm", "extreme rain", "moisture transport", "monsoon"),
    }
    for category, keywords in groups.items():
        if any(keyword in text for keyword in keywords):
            return category
    return "water"


def parse_publications(page: str) -> list[dict[str, object]]:
    rows = re.findall(r'<tr[^>]*class=["\'][^"\']*\bgsc_a_tr\b[^"\']*["\'][^>]*>(.*?)</tr>', page, re.S)
    records: list[dict[str, object]] = []
    for row in rows:
        title = citation_url = ""
        for anchor in re.finditer(r"<a\b([^>]*)>(.*?)</a>", row, re.S):
            if tag_has_class(anchor.group(1), "gsc_a_at"):
                title = clean(anchor.group(2))
                href = re.search(r"\bhref=[\"']([^\"']+)[\"']", anchor.group(1))
                citation_url = urllib.parse.urljoin("https://scholar.google.com", html.unescape(href.group(1))) if href else PROFILE_URL
                break
        if not title:
            continue
        # Google Scholar stores authors and venue in two `gs_gray` divs inside
        # the publication cell; `gsc_a_at` is an anchor class, not a div class.
        details = [clean(div.group(2)) for div in re.finditer(r"<div\b([^>]*)>(.*?)</div>", row, re.S) if tag_has_class(div.group(1), "gs_gray")]
        citations = 0
        for anchor in re.finditer(r"<a\b([^>]*)>(.*?)</a>", row, re.S):
            if tag_has_class(anchor.group(1), "gsc_a_ac"):
                digits = re.sub(r"\D", "", clean(anchor.group(2)))
                citations = int(digits) if digits else 0
                break
        year_match = re.search(r'class=["\'][^"\']*\bgsc_a_y\b[^"\']*["\'][^>]*>.*?(\d{4})', row, re.S)
        records.append({"title": title, "authors": details[0] if details else "", "venue": details[1] if len(details) > 1 else "Google Scholar", "year": int(year_match.group(1)) if year_match else None, "citations": citations, "category": classify(title), "url": citation_url})
    return records


def read_profile(retries: int = 3) -> tuple[dict[str, int], list[dict[str, object]]]:
    first_page = request_page(retries=retries)
    metrics = read_metrics(first_page)
    publications: list[dict[str, object]] = []
    seen_titles: set[str] = set()
    for start in range(0, 501, 100):
        page = first_page if start == 0 else request_page(start, retries=retries)
        batch = parse_publications(page)
        for record in batch:
            title = str(record["title"])
            if title not in seen_titles:
                publications.append(record)
                seen_titles.add(title)
        if len(batch) < 100:
            break
    if not publications:
        raise ValueError("Could not find public Scholar publication rows")
    return metrics, publications


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--retries", type=int, default=3)
    args = parser.parse_args()
    try:
        metrics, publications = read_profile(retries=max(args.retries, 1))
    except Exception as exc:
        print(f"Scholar refresh failed: {exc}", file=sys.stderr)
        return 1
    checked_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    stats = {"scholar_id": SCHOLAR_ID, **metrics, "updated_at": checked_at, "source": PROFILE_URL}
    catalogue = {"scholar_id": SCHOLAR_ID, "updated_at": checked_at, "source": PROFILE_URL, "publications": publications}
    print(f"Fetched {len(publications)} Scholar publications.")
    if args.write:
        STATS_OUTPUT.write_text(json.dumps(stats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        PUBLICATIONS_OUTPUT.write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
