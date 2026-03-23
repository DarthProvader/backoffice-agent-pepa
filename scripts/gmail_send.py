"""Send an email via Gmail API."""

import argparse
import base64
import json
from email.mime.text import MIMEText
from google_auth import get_gmail_service


def send_email(to: str, subject: str, body: str, cc: str = "", bcc: str = ""):
    service = get_gmail_service()

    msg = MIMEText(body, "plain", "utf-8")
    msg["To"] = to
    msg["Subject"] = subject
    if cc:
        msg["Cc"] = cc
    if bcc:
        msg["Bcc"] = bcc

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    result = service.users().messages().send(
        userId="me", body={"raw": raw}
    ).execute()

    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Send email via Gmail")
    parser.add_argument("--to", required=True, help="Recipient email")
    parser.add_argument("--subject", required=True, help="Email subject")
    parser.add_argument("--body", required=True, help="Email body text")
    parser.add_argument("--cc", default="", help="CC recipients (comma-separated)")
    parser.add_argument("--bcc", default="", help="BCC recipients (comma-separated)")
    args = parser.parse_args()

    result = send_email(args.to, args.subject, args.body, args.cc, args.bcc)
    print(json.dumps({"status": "sent", "messageId": result.get("id", "")}, ensure_ascii=False))
