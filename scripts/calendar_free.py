"""Show free time slots for a given day."""

import argparse
import json
from datetime import datetime, timedelta, timezone
from google_auth import get_calendar_service


WORK_START = 9   # 9:00
WORK_END = 17    # 17:00
SLOT_MINUTES = 60


def get_free_slots(date: str):
    service = get_calendar_service()

    day = datetime.fromisoformat(date)
    tz_offset = timezone(timedelta(hours=1))  # CET (simplified)

    day_start = day.replace(hour=WORK_START, minute=0, second=0, tzinfo=tz_offset)
    day_end = day.replace(hour=WORK_END, minute=0, second=0, tzinfo=tz_offset)

    # Fetch events for the day
    result = service.events().list(
        calendarId="primary",
        timeMin=day_start.isoformat(),
        timeMax=day_end.isoformat(),
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    busy = []
    for ev in result.get("items", []):
        start_str = ev.get("start", {}).get("dateTime")
        end_str = ev.get("end", {}).get("dateTime")
        if start_str and end_str:
            busy.append((
                datetime.fromisoformat(start_str),
                datetime.fromisoformat(end_str),
            ))

    # Calculate free slots
    free = []
    current = day_start
    for b_start, b_end in sorted(busy):
        if current < b_start:
            free.append({
                "start": current.strftime("%H:%M"),
                "end": b_start.strftime("%H:%M"),
                "duration_min": int((b_start - current).total_seconds() / 60),
            })
        current = max(current, b_end)

    if current < day_end:
        free.append({
            "start": current.strftime("%H:%M"),
            "end": day_end.strftime("%H:%M"),
            "duration_min": int((day_end - current).total_seconds() / 60),
        })

    return {
        "date": date,
        "work_hours": f"{WORK_START}:00–{WORK_END}:00",
        "busy_events": len(busy),
        "free_slots": free,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Show free calendar slots")
    parser.add_argument("--date", required=True, help="Date (YYYY-MM-DD)")
    args = parser.parse_args()

    result = get_free_slots(args.date)
    print(json.dumps(result, ensure_ascii=False, indent=2))
