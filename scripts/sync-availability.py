#!/usr/bin/env python3
"""Fetch Booking/Airbnb iCal feeds and write data/availability.json (busy dates only)."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path


def parse_ical_dates(text: str) -> list[tuple[date, date]]:
    """Return list of [start, end) busy ranges. DTEND is exclusive for VALUE=DATE."""
    # Unfold lines
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n[ \t]", "", text)
    ranges: list[tuple[date, date]] = []
    for block in re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", text, re.S):
        start_m = re.search(r"DTSTART(?:;VALUE=DATE)?(?:;[^:]*)?:(\d{8})", block)
        end_m = re.search(r"DTEND(?:;VALUE=DATE)?(?:;[^:]*)?:(\d{8})", block)
        if not start_m:
            continue
        start = datetime.strptime(start_m.group(1), "%Y%m%d").date()
        if end_m:
            end = datetime.strptime(end_m.group(1), "%Y%m%d").date()
        else:
            end = start + timedelta(days=1)
        if end <= start:
            end = start + timedelta(days=1)
        ranges.append((start, end))
    return ranges


def fetch(url: str, timeout: int = 30) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "VillaZenoCalendarSync/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def merge_busy(ranges: list[tuple[date, date]]) -> list[str]:
    """Expand ranges to exclusive end into sorted unique ISO date strings."""
    days: set[str] = set()
    for start, end in ranges:
        d = start
        while d < end:
            days.add(d.isoformat())
            d += timedelta(days=1)
    return sorted(days)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--booking-url", default=os.environ.get("BOOKING_ICAL_URL", ""))
    ap.add_argument("--airbnb-url", default=os.environ.get("AIRBNB_ICAL_URL", ""))
    ap.add_argument("--booking-file", default="", help="Local .ics path (preview/dev)")
    ap.add_argument("--airbnb-file", default="")
    ap.add_argument("--out", default="data/availability.json")
    ap.add_argument("--sample", action="store_true", help="Mark output as sample")
    args = ap.parse_args()

    ranges: list[tuple[date, date]] = []
    sources: list[str] = []

    if args.booking_file:
        ranges.extend(parse_ical_dates(Path(args.booking_file).read_text(encoding="utf-8")))
        sources.append("booking")
    elif args.booking_url:
        try:
            ranges.extend(parse_ical_dates(fetch(args.booking_url)))
            sources.append("booking")
        except Exception as e:
            print(f"WARN: Booking iCal failed: {e}", file=sys.stderr)

    if args.airbnb_file:
        ranges.extend(parse_ical_dates(Path(args.airbnb_file).read_text(encoding="utf-8")))
        sources.append("airbnb")
    elif args.airbnb_url:
        try:
            ranges.extend(parse_ical_dates(fetch(args.airbnb_url)))
            sources.append("airbnb")
        except Exception as e:
            print(f"WARN: Airbnb iCal failed: {e}", file=sys.stderr)

    if not sources and not args.sample:
        print("No iCal sources available (missing secrets/files).", file=sys.stderr)
        # Still write empty-ish file so the site can show friendly empty state
        payload = {
            "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "sources": [],
            "busy": [],
        }
    else:
        payload = {
            "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "sources": sources,
            "busy": merge_busy(ranges),
        }
    if args.sample:
        payload["sample"] = True

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    new_text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"

    if out.exists():
        try:
            old = json.loads(out.read_text(encoding="utf-8"))
            # Compare without updated_at for change detection
            old_cmp = {k: v for k, v in old.items() if k != "updated_at"}
            new_cmp = {k: v for k, v in payload.items() if k != "updated_at"}
            if old_cmp == new_cmp:
                print("No availability changes.")
                # Still refresh updated_at only if forced? Skip write for GH action commit skip
                print("UNCHANGED")
                return 0
        except Exception:
            pass

    out.write_text(new_text, encoding="utf-8")
    print(f"Wrote {out} ({len(payload.get('busy', []))} busy days, sources={payload.get('sources')})")
    print("CHANGED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
