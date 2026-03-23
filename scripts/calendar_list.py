"""List Google Calendar events."""

import argparse
import json
from datetime import datetime, timedelta, timezone
from google_auth import get_calendar_service


def list_events(days: int = 7, date: str = ""):
    service = get_calendar_service()

    if date:
        start = datetime.fromisoformat(date).replace(hour=0, minute=0, second=0, tzinfo=timezone.utc)
        end = start + timedelta(days=1)
    else:
        start = datetime.now(timezone.utc)
        end = start + timedelta(days=days)

    result = service.events().list(
        calendarId="primary",
        timeMin=start.isoformat(),
        timeMax=end.isoformat(),
        singleEvents=True,
        orderBy="startTime",
        maxResults=50,
    ).execute()

    events = []
    for ev in result.get("items", []):
        events.append({
            "id": ev.get("id"),
            "summary": ev.get("summary", "(bez názvu)"),
            "start": ev.get("start", {}).get("dateTime", ev.get("start", {}).get("date", "")),
            "end": ev.get("end", {}).get("dateTime", ev.get("end", {}).get("date", "")),
            "location": ev.get("location", ""),
            "description": ev.get("description", ""),
            "attendees": [a.get("email") for a in ev.get("attendees", [])],
        })

    return events


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="List Google Calendar events")
    parser.add_argument("--days", type=int, default=7, help="Number of days ahead (default 7)")
    parser.add_argument("--date", default="", help="Specific date (YYYY-MM-DD)")
    args = parser.parse_args()

    events = list_events(days=args.days, date=args.date)
    if not events:
        print("Žádné události.")
    else:
        print(json.dumps(events, ensure_ascii=False, indent=2))
