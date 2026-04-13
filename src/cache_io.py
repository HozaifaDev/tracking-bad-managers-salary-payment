"""Serialize calendar events for events_cache.json (offline report)."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List


def save_events_cache(path: Path, events: List[Dict[str, Any]]) -> None:
    """Write events with ISO datetimes."""
    serializable: List[Dict[str, Any]] = []
    for e in events:
        serializable.append(
            {
                "title": e["title"],
                "start": e["start"].isoformat(),
                "end": e["end"].isoformat(),
                "duration_hours": e["duration_hours"],
                "date": e["date"].isoformat(),
            }
        )
    path.write_text(json.dumps(serializable, indent=2), encoding="utf-8")


def load_events_cache(path: Path) -> List[Dict[str, Any]]:
    """Load cache; restore date/datetime objects."""
    data = json.loads(path.read_text(encoding="utf-8"))
    out: List[Dict[str, Any]] = []
    for e in data:
        start = datetime.fromisoformat(e["start"])
        end = datetime.fromisoformat(e["end"])
        d = datetime.fromisoformat(e["date"]).date()
        out.append(
            {
                "title": e["title"],
                "start": start,
                "end": end,
                "duration_hours": float(e["duration_hours"]),
                "date": d,
            }
        )
    return out
