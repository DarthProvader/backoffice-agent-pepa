"""Read/search emails via Gmail API."""

import argparse
import json
import base64
from google_auth import get_gmail_service


def list_emails(query: str = "", max_results: int = 10, full_body: bool = False):
    service = get_gmail_service()

    params = {"userId": "me", "maxResults": max_results}
    if query:
        params["q"] = query

    results = service.users().messages().list(**params).execute()
    messages = results.get("messages", [])

    emails = []
    for msg_ref in messages:
        msg = service.users().messages().get(
            userId="me", id=msg_ref["id"], format="full"
        ).execute()

        headers = {h["name"]: h["value"] for h in msg["payload"].get("headers", [])}

        email_data = {
            "id": msg["id"],
            "from": headers.get("From", ""),
            "to": headers.get("To", ""),
            "subject": headers.get("Subject", ""),
            "date": headers.get("Date", ""),
            "snippet": msg.get("snippet", ""),
        }

        if full_body:
            body = _extract_body(msg["payload"])
            email_data["body"] = body

        emails.append(email_data)

    return emails


def _extract_body(payload):
    """Extract plain text body from message payload."""
    if payload.get("body", {}).get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")

    for part in payload.get("parts", []):
        if part["mimeType"] == "text/plain" and part.get("body", {}).get("data"):
            return base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
        if part.get("parts"):
            result = _extract_body(part)
            if result:
                return result
    return ""


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Read/search Gmail")
    parser.add_argument("--query", default="", help="Gmail search query (e.g. 'from:novak', 'is:unread')")
    parser.add_argument("--unread", action="store_true", help="Show only unread emails")
    parser.add_argument("--max", type=int, default=10, help="Max results (default 10)")
    parser.add_argument("--full", action="store_true", help="Include full body text")
    args = parser.parse_args()

    query = args.query
    if args.unread:
        query = f"is:unread {query}".strip()

    emails = list_emails(query=query, max_results=args.max, full_body=args.full)
    print(json.dumps(emails, ensure_ascii=False, indent=2))
