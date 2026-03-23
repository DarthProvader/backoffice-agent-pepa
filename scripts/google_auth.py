"""Shared Google OAuth helper — creates authenticated credentials from env vars."""

import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# Load from env or .env file
def _load_env():
    """Try loading .env from server directory if env vars not set."""
    if not os.environ.get("GOOGLE_CLIENT_ID"):
        env_path = os.path.join(os.path.dirname(__file__), "..", "server", ".env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        os.environ.setdefault(key.strip(), val.strip())

_load_env()

def get_credentials() -> Credentials:
    """Create Google OAuth credentials from environment variables."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    refresh_token = os.environ.get("GOOGLE_REFRESH_TOKEN")

    if not all([client_id, client_secret, refresh_token]):
        raise RuntimeError(
            "Missing Google credentials. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, "
            "GOOGLE_REFRESH_TOKEN in server/.env"
        )

    return Credentials(
        token=None,
        refresh_token=refresh_token,
        client_id=client_id,
        client_secret=client_secret,
        token_uri="https://oauth2.googleapis.com/token",
    )

def get_gmail_service():
    """Build authenticated Gmail API service."""
    return build("gmail", "v1", credentials=get_credentials())

def get_calendar_service():
    """Build authenticated Google Calendar API service."""
    return build("calendar", "v3", credentials=get_credentials())
