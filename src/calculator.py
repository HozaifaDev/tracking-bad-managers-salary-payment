"""Earnings engine: map calendar events to categories and EGP amounts."""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from src.utils import get_salary_month


def process_events(
    raw_events: List[Dict[str, Any]],
    config: Dict[str, Any],
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Build session rows with earnings. Returns (rows, unrecognized_titles).
    """
    start_day = int(config.get("work_cycle", {}).get("start_day", 25))
    rows: List[Dict[str, Any]] = []
    unrecognized: List[str] = []

    for ev in raw_events:
        title = str(ev.get("title", ""))
        d: date = ev["date"]
        duration = float(ev["duration_hours"])
        cat, meta = _classify_title(title)

        if cat == "Uncategorized":
            unrecognized.append(title)

        row = _compute_row(
            date_=d,
            title=title,
            duration_hours=duration,
            category=cat,
            meta=meta,
            config=config,
            start_day=start_day,
        )
        rows.append(row)

    return rows, unrecognized


def _classify_title(title: str) -> Tuple[str, Dict[str, Any]]:
    """Return (category, metadata)."""
    t = title.strip()
    lower = t.lower()

    if "diploma:" in lower:
        rest = t.split(":", 1)[1].strip()
        parts = [p.strip() for p in rest.split(" - ") if p.strip()]
        complete = bool(parts) and parts[-1].upper() in ("COMPLETE", "DONE")
        if complete and len(parts) >= 2:
            milestone = parts[-2]
            track = " - ".join(parts[:-2]) if len(parts) > 2 else parts[0]
        elif len(parts) >= 2:
            track, milestone = parts[0], parts[1]
        elif len(parts) == 1:
            track, milestone = parts[0], ""
        else:
            track, milestone = "", ""
        return "Diploma", {"track": track, "milestone": milestone, "complete": complete}

    if "private course:" in lower:
        rest = t.split(":", 1)[1].strip()
        parts = [p.strip() for p in rest.split(" - ") if p.strip()]
        complete = bool(parts) and parts[-1].upper() in ("COMPLETE", "DONE")
        if complete:
            course_key = " - ".join(parts[:-1]) if len(parts) > 1 else ""
        else:
            course_key = parts[0] if parts else rest
        return "Private Course", {"course_key": course_key, "complete": complete}

    if "group a" in lower:
        return "Group A", {}
    if "group b" in lower:
        return "Group B", {}

    return "Uncategorized", {}


def _compute_row(
    date_: date,
    title: str,
    duration_hours: float,
    category: str,
    meta: Dict[str, Any],
    config: Dict[str, Any],
    start_day: int,
) -> Dict[str, Any]:
    """Single session row with earnings, rate, note, flagged."""
    salary_month = get_salary_month(date_, start_day)
    rate_applied = 0.0
    earnings = 0.0
    note = ""
    flagged = category == "Uncategorized"

    if category == "Group A":
        rate_applied = float(config["groups"]["Group A"]["rate_per_hour"])
        earnings = round(duration_hours * rate_applied, 2)
    elif category == "Group B":
        rate_applied = float(config["groups"]["Group B"]["rate_per_hour"])
        earnings = round(duration_hours * rate_applied, 2)

    elif category == "Private Course":
        pc = config.get("private_courses", {})
        overrides = pc.get("overrides", {})
        split = float(pc.get("default_split_instructor", 0.5))
        default_hr = float(pc.get("default_hourly_rate", 300))

        override = _find_private_override(overrides, meta.get("course_key", ""), title)
        if meta.get("complete") and override and override.get("fixed_instructor_amount") is not None:
            earnings = float(override["fixed_instructor_amount"])
            note = "Fixed deal override (course complete)"
        elif meta.get("complete") and not override:
            note = "COMPLETE marker but no matching override — 0 EGP"
            flagged = True
        elif not meta.get("complete"):
            total_session = duration_hours * default_hr
            earnings = round(total_session * split, 2)
            rate_applied = default_hr
            note = f"Split {split:.0%} of {default_hr} EGP/hr assumed total"

    elif category == "Diploma":
        tracks_cfg = config.get("diplomas", {}).get("tracks", {})
        track = meta.get("track", "")
        milestone = meta.get("milestone", "")
        if meta.get("complete"):
            payout = _diploma_payout(tracks_cfg, track, milestone)
            if payout is not None:
                earnings = float(payout)
                note = f"Milestone payout: {milestone}"
            else:
                note = f"No payout found for track={track!r}, milestone={milestone!r}"
                flagged = True
        else:
            note = "Diploma session (no milestone payout until COMPLETE/Done)"

    return {
        "date": date_,
        "salary_month": salary_month,
        "title": title,
        "category": category,
        "duration_hours": round(duration_hours, 2),
        "rate_applied": rate_applied,
        "earnings": round(earnings, 2),
        "note": note,
        "flagged": flagged,
    }


def _find_private_override(
    overrides: Dict[str, Any],
    course_key: str,
    full_title: str,
) -> Optional[Dict[str, Any]]:
    """Match override dict by course name or full calendar-style key."""
    if not overrides:
        return None
    candidates = [course_key.strip(), full_title.strip()]
    for key, val in overrides.items():
        kl = key.lower().strip()
        for c in candidates:
            if not c:
                continue
            cl = c.lower().strip()
            if cl == kl or kl in cl or cl in kl:
                return val if isinstance(val, dict) else None
    return None


def _diploma_payout(
    tracks_cfg: Dict[str, Any],
    track: str,
    milestone: str,
) -> Optional[float]:
    """Lookup milestone payout for a track."""
    for tname, tdata in tracks_cfg.items():
        if tname.strip().lower() == track.strip().lower():
            payouts = (tdata or {}).get("payout_per_milestone", {})
            for mname, amount in payouts.items():
                if mname.strip().lower() == milestone.strip().lower():
                    return float(amount)
            return None
    return None
