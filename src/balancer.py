"""Compare earned totals vs manual payments; monthly breakdown with running totals."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Tuple

from src.utils import get_cycle_range


@dataclass
class PaymentRow:
    date_received: date
    amount_egp: float
    note: str


def load_payments_csv(path: Path) -> List[PaymentRow]:
    """Load payments; file may be created empty by caller."""
    rows: List[PaymentRow] = []
    if not path.is_file():
        return rows
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            if not r.get("date"):
                continue
            rows.append(
                PaymentRow(
                    date_received=date.fromisoformat(r["date"].strip()),
                    amount_egp=float(r.get("amount_egp", 0) or 0),
                    note=(r.get("note") or "").strip(),
                )
            )
    return rows


def ensure_payments_file(path: Path) -> None:
    """Create payments.csv with headers only if missing."""
    if path.is_file():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["date", "amount_egp", "note"])


def append_payment(path: Path, d: date, amount: float, note: str) -> None:
    """Append one payment row."""
    file_exists = path.is_file()
    with path.open("a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if not file_exists:
            w.writerow(["date", "amount_egp", "note"])
        w.writerow([d.isoformat(), amount, note])


def compute_balance(
    session_rows: List[Dict[str, Any]],
    payments: List[PaymentRow],
    start_day: int = 25,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    All-time totals plus per-salary-month rows with cumulative earned/paid/balance.

    Cumulative paid for a salary month = sum of payments with date_received <= that
    cycle's end date.
    """
    total_earned = round(sum(float(r["earnings"]) for r in session_rows), 2)
    total_paid = round(sum(p.amount_egp for p in payments), 2)
    balance = round(total_earned - total_paid, 2)

    summary = {
        "total_earned_all_time": total_earned,
        "total_paid_all_time": total_paid,
        "current_balance_owed": balance,
    }

    # Group sessions by salary month
    by_month: Dict[str, List[Dict[str, Any]]] = {}
    for r in session_rows:
        m = r["salary_month"]
        by_month.setdefault(m, []).append(r)

    def month_sort_key(label: str) -> Tuple[int, int]:
        _, end = get_cycle_range(label, start_day)
        return (end.year, end.month)

    sorted_months = sorted(by_month.keys(), key=month_sort_key)

    monthly: List[Dict[str, Any]] = []
    cum_earned = 0.0
    payments_sorted = sorted(payments, key=lambda p: p.date_received)

    for label in sorted_months:
        sessions = by_month[label]
        expected = round(sum(float(s["earnings"]) for s in sessions), 2)
        hours = round(sum(float(s["duration_hours"]) for s in sessions), 2)
        count = len(sessions)
        cum_earned = round(cum_earned + expected, 2)

        _, cycle_end = get_cycle_range(label, start_day)
        cum_paid = round(
            sum(p.amount_egp for p in payments_sorted if p.date_received <= cycle_end),
            2,
        )
        running_balance = round(cum_earned - cum_paid, 2)

        monthly.append(
            {
                "salary_month": label,
                "sessions_count": count,
                "total_hours": hours,
                "expected_earnings": expected,
                "cumulative_earned": cum_earned,
                "cumulative_paid": cum_paid,
                "running_balance": running_balance,
                "cycle_end": cycle_end,
            }
        )

    return summary, monthly
