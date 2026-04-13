#!/usr/bin/env python3
"""
Hours & Salary Tracker — CLI entry point.
Run from the project root: python main.py <command> ...
"""

from __future__ import annotations

import argparse
import json
import sys
from calendar import month_abbr
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Ensure project root is importable
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.balancer import (
    append_payment,
    compute_balance,
    ensure_payments_file,
    load_payments_csv,
)
from src.cache_io import load_events_cache, save_events_cache
from src.calculator import process_events
from src.calendar_fetcher import fetch_events
from src.report_builder import build_report
from src.utils import default_fetch_date_range_today, parse_cli_date

CONFIG_NAME = "config.json"
PAYMENTS_NAME = "payments.csv"
CACHE_NAME = "events_cache.json"
OUTPUT_XLSX = ROOT / "output" / "salary_report.xlsx"


def _default_config_dict() -> Dict[str, Any]:
    """Factory default config (same as shipped config.json)."""
    return json.loads(
        """{
  "work_cycle": {"start_day": 25, "description": "Cycle runs from 25th of previous month to 24th of current month"},
  "groups": {
    "Group A": {"type": "regular", "platform": "online", "rate_per_hour": 175, "schedule": ["Sunday", "Wednesday"]},
    "Group B": {"type": "regular", "platform": "onsite", "rate_per_hour": 200, "schedule": ["Monday", "Thursday"]}
  },
  "private_courses": {
    "default_split_instructor": 0.50,
    "default_hourly_rate": 300,
    "overrides": {
      "Private Course: SQL": {
        "fixed_instructor_amount": 6000,
        "total_course_amount": 10000,
        "note": "Fixed deal — instructor gets 6k flat regardless of hours"
      }
    }
  },
  "diplomas": {
    "tracks": {
      "Data Analysis": {
        "milestones": ["Excel", "SQL", "Power BI", "Python"],
        "payout_per_milestone": {"Excel": 2000, "SQL": 2000, "Power BI": 2000, "Python": 2000}
      },
      "Data Science": {
        "milestones": ["Python", "Statistics", "ML", "Deployment"],
        "payout_per_milestone": {"Python": 2500, "Statistics": 2500, "ML": 2500, "Deployment": 2500}
      }
    }
  }
}"""
    )


def ensure_config(path: Path) -> Dict[str, Any]:
    if path.is_file():
        return json.loads(path.read_text(encoding="utf-8"))
    data = _default_config_dict()
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"⚠️  Created default {path.name}. Please review and edit rates.")
    return data


def resolve_date_range(
    args: argparse.Namespace,
    start_day: int,
) -> Tuple[date, date]:
    has_from = getattr(args, "date_from", None)
    has_to = getattr(args, "date_to", None)
    if has_from or has_to:
        if not (has_from and has_to):
            raise SystemExit("Provide both --from and --to, or omit both for the current salary cycle.")
        return parse_cli_date(has_from), parse_cli_date(has_to)
    return default_fetch_date_range_today(start_day)


def _format_period_human(d0: date, d1: date) -> str:
    return f"{month_abbr[d0.month]} {d0.day}, {d0.year} → {month_abbr[d1.month]} {d1.day}, {d1.year}"


def print_terminal_summary(
    session_rows: List[Dict[str, Any]],
    summary: Dict[str, Any],
    date_from: date,
    date_to: date,
) -> None:
    total_hours = round(sum(float(r["duration_hours"]) for r in session_rows), 2)
    sessions = len(session_rows)
    earned = summary["total_earned_all_time"]
    paid = summary["total_paid_all_time"]
    bal = summary["current_balance_owed"]
    if bal > 0:
        bal_str = f"{bal:,.0f} EGP owed"
    elif bal < 0:
        bal_str = f"{abs(bal):,.0f} EGP overpaid"
    else:
        bal_str = "0 EGP (balanced)"

    print()
    print(f"✅ Report generated: {OUTPUT_XLSX}")
    print("──────────────────────────────────────")
    print(f"📅 Period     : {_format_period_human(date_from, date_to)}")
    print(f"📚 Sessions   : {sessions}")
    print(f"⏱  Total Hours: {total_hours} hrs")
    print(f"💰 Earned     : {earned:,.0f} EGP")
    print(f"💵 Paid       : {paid:,.0f} EGP")
    print(f"⚠️  Balance    : {bal_str}")
    print("──────────────────────────────────────")


def print_balance_only(summary: Dict[str, Any]) -> None:
    e, p, b = (
        summary["total_earned_all_time"],
        summary["total_paid_all_time"],
        summary["current_balance_owed"],
    )
    print("── Balance summary ──")
    print(f"Total Earned (from cached sessions): {e:,.2f} EGP")
    print(f"Total Paid (payments.csv):           {p:,.2f} EGP")
    print(f"Balance Owed:                        {b:,.2f} EGP")


def cmd_fetch(args: argparse.Namespace) -> int:
    config = ensure_config(ROOT / CONFIG_NAME)
    start_day = int(config.get("work_cycle", {}).get("start_day", 25))
    date_from, date_to = resolve_date_range(args, start_day)

    payments_path = ROOT / PAYMENTS_NAME
    ensure_payments_file(payments_path)
    lines = [ln for ln in payments_path.read_text(encoding="utf-8").splitlines() if ln.strip()]
    if len(lines) <= 1:
        print(f"⚠️  {PAYMENTS_NAME} has no payment rows yet (headers only).")

    try:
        raw = fetch_events(ROOT, date_from, date_to)
    except FileNotFoundError as e:
        print(str(e))
        return 1

    save_events_cache(ROOT / CACHE_NAME, raw)
    payments = load_payments_csv(payments_path)
    session_rows, unrecognized = process_events(raw, config)
    if unrecognized:
        print("⚠️  Unrecognized event titles (Uncategorized / zero earnings):")
        for t in sorted(set(unrecognized)):
            print(f"   - {t}")

    summary, monthly = compute_balance(session_rows, payments, start_day)
    build_report(OUTPUT_XLSX, summary, monthly, session_rows, payments, date_from, date_to)
    print_terminal_summary(session_rows, summary, date_from, date_to)
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    cache_path = ROOT / CACHE_NAME
    if not cache_path.is_file():
        print(f"Missing {CACHE_NAME}. Run: python main.py fetch --from ... --to ...")
        return 1

    config = ensure_config(ROOT / CONFIG_NAME)
    start_day = int(config.get("work_cycle", {}).get("start_day", 25))
    date_from, date_to = resolve_date_range(args, start_day)

    raw = load_events_cache(cache_path)
    # Filter cached events to requested range (inclusive)
    raw = [e for e in raw if date_from <= e["date"] <= date_to]

    payments_path = ROOT / PAYMENTS_NAME
    ensure_payments_file(payments_path)
    payments = load_payments_csv(payments_path)

    session_rows, unrecognized = process_events(raw, config)
    if unrecognized:
        print("⚠️  Unrecognized event titles (Uncategorized / zero earnings):")
        for t in sorted(set(unrecognized)):
            print(f"   - {t}")

    summary, monthly = compute_balance(session_rows, payments, start_day)
    build_report(OUTPUT_XLSX, summary, monthly, session_rows, payments, date_from, date_to)
    print_terminal_summary(session_rows, summary, date_from, date_to)
    return 0


def cmd_balance(_args: argparse.Namespace) -> int:
    cache_path = ROOT / CACHE_NAME
    payments_path = ROOT / PAYMENTS_NAME
    ensure_payments_file(payments_path)
    payments = load_payments_csv(payments_path)

    if not cache_path.is_file():
        paid = round(sum(p.amount_egp for p in payments), 2)
        print("No events cache yet — earned total is unknown. Run `python main.py fetch` first.")
        print(f"Total Paid (payments.csv): {paid:,.2f} EGP")
        return 0

    config = ensure_config(ROOT / CONFIG_NAME)
    start_day = int(config.get("work_cycle", {}).get("start_day", 25))
    raw = load_events_cache(cache_path)
    session_rows, _ = process_events(raw, config)
    summary, _ = compute_balance(session_rows, payments, start_day)
    print_balance_only(summary)
    return 0


def cmd_add_payment(args: argparse.Namespace) -> int:
    path = ROOT / PAYMENTS_NAME
    ensure_payments_file(path)
    d = parse_cli_date(args.date)
    append_payment(path, d, float(args.amount), args.note or "")
    print(f"✅ Appended payment: {d.isoformat()} — {float(args.amount):,.2f} EGP — {args.note!r}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Hours & Salary Tracker (Google Calendar to Excel)",
    )
    sub = p.add_subparsers(dest="command", required=True)

    pf = sub.add_parser("fetch", help="Fetch Calendar, compute, write Excel + cache")
    pf.add_argument("--from", dest="date_from", default=None, help="YYYY-MM-DD (default: current cycle)")
    pf.add_argument("--to", dest="date_to", default=None, help="YYYY-MM-DD (default: today in cycle)")
    pf.set_defaults(func=cmd_fetch)

    pr = sub.add_parser("report", help="Rebuild Excel from events_cache.json (no API)")
    pr.add_argument("--from", dest="date_from", default=None)
    pr.add_argument("--to", dest="date_to", default=None)
    pr.set_defaults(func=cmd_report)

    pb = sub.add_parser("balance", help="Print balance summary using cache + payments")
    pb.set_defaults(func=cmd_balance)

    pa = sub.add_parser("add-payment", help="Append a row to payments.csv")
    pa.add_argument("--date", required=True, help="YYYY-MM-DD")
    pa.add_argument("--amount", required=True, type=float, help="Amount in EGP")
    pa.add_argument("--note", default="", help="Free-text note")
    pa.set_defaults(func=cmd_add_payment)

    return p


def main() -> int:
    _configure_stdio()
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


def _configure_stdio() -> None:
    """Avoid UnicodeEncodeError on Windows consoles when printing emoji or arrows."""
    if sys.platform == "win32":
        for stream in (sys.stdout, sys.stderr):
            reconf = getattr(stream, "reconfigure", None)
            if callable(reconf):
                try:
                    reconf(encoding="utf-8")
                except (OSError, ValueError):
                    pass


if __name__ == "__main__":
    sys.exit(main())
