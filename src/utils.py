"""Date helpers and salary-cycle logic."""

from __future__ import annotations

from calendar import month_name
from datetime import date, datetime
from typing import Tuple

from dateutil.relativedelta import relativedelta


def get_salary_month(event_date: date, start_day: int = 25) -> str:
    """
    Map a calendar date to the salary-cycle label (month when the cycle ends).

    Example: Nov 25–Dec 24 → "December 2024"; Dec 25–Jan 24 → "January 2025".
    """
    if event_date.day >= start_day:
        end = event_date + relativedelta(months=1)
    else:
        end = event_date
    return f"{month_name[end.month]} {end.year}"


def get_cycle_range(salary_month_label: str, start_day: int = 25) -> Tuple[date, date]:
    """
    Given e.g. "December 2024", return (cycle_start, cycle_end) inclusive.

    End date is always (start_day - 1) of the named month; start is start_day
    of the previous calendar month.
    """
    parts = salary_month_label.strip().split()
    if len(parts) < 2:
        raise ValueError(f"Invalid salary month label: {salary_month_label!r}")
    month_name_str, year_str = parts[0], parts[1]
    month_num = _month_name_to_num(month_name_str)
    year = int(year_str)

    end = date(year, month_num, start_day - 1)
    start = end + relativedelta(months=-1) + relativedelta(days=1)
    return start, end


def _month_name_to_num(name: str) -> int:
    name_lower = name.lower()
    for i in range(1, 13):
        if month_name[i].lower() == name_lower:
            return i
    raise ValueError(f"Unknown month name: {name!r}")


def default_fetch_date_range_today(start_day: int = 25) -> Tuple[date, date]:
    """
    Default --from/--to: current salary cycle from its start through today.

    The cycle containing `today` is used; range ends at today (not cycle end).
    """
    today = date.today()
    label = get_salary_month(today, start_day)
    cycle_start, cycle_end = get_cycle_range(label, start_day)
    end = min(today, cycle_end)
    return cycle_start, end


def parse_cli_date(s: str) -> date:
    """Parse YYYY-MM-DD from CLI."""
    return datetime.strptime(s.strip(), "%Y-%m-%d").date()
