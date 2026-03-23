"""Create a Google Calendar event."""

import argparse
import json
from google_auth import get_calendar_service


def create_event(summary: str, start: str, end: str, location: str = "",
                 description: str = "", attendees: str = ""):
    service = get_calendar_service()

    event_body = {
        "summary": summary,
        "start": {"dateTime": start, "timeZone": "Europe/Prague"},
        "end": {"dateTime": end, "timeZone": "Europe/Prague"},
    }

    if location:
        event_body["location"] = location
    if description:
        event_body["description"] = description
    if attendees:
        event_body["attendees"] = [{"email": e.strip()} for e in attendees.split(",")]

    result = service.events().insert(calendarId="primary", body=event_body).execute()

    return {
        "status": "created",
        "id": result.get("id"),
        "summary": result.get("summary"),
        "start": result.get("start", {}).get("dateTime", ""),
        "end": result.get("end", {}).get("dateTime", ""),
        "link": result.get("htmlLink", ""),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create Google Calendar event")
    parser.add_argument("--summary", required=True, help="Event title")
    parser.add_argument("--start", required=True, help="Start time (YYYY-MM-DDTHH:MM)")
    parser.add_argument("--end", required=True, help="End time (YYYY-MM-DDTHH:MM)")
    parser.add_argument("--location", default="", help="Location")
    parser.add_argument("--description", default="", help="Description")
    parser.add_argument("--attendees", default="", help="Attendee emails (comma-separated)")
    args = parser.parse_args()

    result = create_event(
        summary=args.summary, start=args.start, end=args.end,
        location=args.location, description=args.description, attendees=args.attendees,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
