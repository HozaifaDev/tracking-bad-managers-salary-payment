"""Google Calendar API: OAuth and event fetch (Cairo local time)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from zoneinfo import ZoneInfo

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
CAIRO = ZoneInfo("Africa/Cairo")


def _project_paths(base_dir: Path) -> tuple[Path, Path]:
    creds_path = base_dir / "credentials.json"
    token_path = base_dir / "token.json"
    return creds_path, token_path


def get_calendar_service(base_dir: Path | str) -> Any:
    """
    Build Calendar API service; run browser OAuth if needed.
    Raises FileNotFoundError with guidance if credentials.json is missing.
    """
    base = Path(base_dir)
    creds_path, token_path = _project_paths(base)
    if not creds_path.is_file():
        raise FileNotFoundError(
            "Missing credentials.json.\n"
            "1) Open Google Cloud Console → APIs & Services → Credentials.\n"
            "2) Create OAuth 2.0 Client ID (Desktop app).\n"
            "3) Enable Google Calendar API for the project.\n"
            "4) Download the JSON and save it as credentials.json in the project root "
            f"(next to main.py): {creds_path}"
        )

    creds: Credentials | None = None
    if token_path.is_file():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
            creds = flow.run_local_server(port=0)
        token_path.write_text(creds.to_json(), encoding="utf-8")

    return build("calendar", "v3", credentials=creds)


def fetch_events(
    base_dir: Path | str,
    date_from: date,
    date_to: date,
) -> List[Dict[str, Any]]:
    """
    Fetch primary calendar events in [date_from, date_to] (inclusive by date in Cairo).

    Skips all-day events. Returns structured dicts with Cairo-local datetimes.
    """
    service = get_calendar_service(base_dir)
    # Query in Cairo boundaries as UTC instants for API
    start_cairo = datetime.combine(date_from, datetime.min.time(), tzinfo=CAIRO)
    end_cairo = datetime.combine(date_to + timedelta(days=1), datetime.min.time(), tzinfo=CAIRO)
    time_min = start_cairo.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    time_max = end_cairo.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    events: List[Dict[str, Any]] = []
    page_token: str | None = None
    while True:
        resp = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,
                orderBy="startTime",
                pageToken=page_token,
            )
            .execute()
        )
        for item in resp.get("items", []):
            ev = _parse_event_item(item)
            if ev is not None:
                events.append(ev)
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return events


def _parse_event_item(item: Dict[str, Any]) -> Dict[str, Any] | None:
    """Convert API item to our structure, or None to skip (all-day / invalid)."""
    if item.get("start", {}).get("date") is not None:
        return None  # all-day

    start_info = item.get("start", {})
    end_info = item.get("end", {})
    start_raw = start_info.get("dateTime")
    end_raw = end_info.get("dateTime")
    if not start_raw or not end_raw:
        return None

    start_dt = _parse_rfc3339_to_cairo(start_raw)
    end_dt = _parse_rfc3339_to_cairo(end_raw)
    duration_seconds = (end_dt - start_dt).total_seconds()
    duration_hours = round(max(0.0, duration_seconds / 3600.0), 2)

    title = item.get("summary", "") or "(no title)"
    return {
        "title": title,
        "start": start_dt,
        "end": end_dt,
        "duration_hours": duration_hours,
        "date": start_dt.date(),
    }


def _parse_rfc3339_to_cairo(s: str) -> datetime:
    """Parse event datetime and normalize to Africa/Cairo (aware)."""
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(CAIRO)
