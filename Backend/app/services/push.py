"""Delivers admin broadcast alerts to employees' devices via Expo's push API.

No receipt/ticket handling yet: we fire-and-forget to Expo, which queues
delivery to Apple/Google. A dead or unregistered token just fails silently on
Expo's side. Pruning stale tokens from delivery receipts is a later story if
it turns out to matter.
"""

from datetime import datetime, timezone

import requests
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import AdminNotification, PushToken

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_PUSH_CHUNK_SIZE = 100
REQUEST_TIMEOUT_S = 10


def send_expo_push(tokens: list[str], title: str, body: str) -> int:
    """Sends to Expo in batches. Returns how many tokens were submitted."""
    if not tokens:
        return 0

    sent = 0
    for i in range(0, len(tokens), EXPO_PUSH_CHUNK_SIZE):
        chunk = tokens[i : i + EXPO_PUSH_CHUNK_SIZE]
        messages = [
            {"to": token, "title": title, "body": body, "sound": "default"} for token in chunk
        ]
        try:
            requests.post(EXPO_PUSH_URL, json=messages, timeout=REQUEST_TIMEOUT_S)
            sent += len(chunk)
        except requests.RequestException:
            pass
    return sent


def dispatch_notification(db: Session, notification: AdminNotification) -> None:
    """Sends a notification now and marks it sent. Idempotent-ish: callers
    should only invoke this for notifications still in 'scheduled' status."""
    tokens = list(db.scalars(select(PushToken.token)))
    count = send_expo_push(tokens, notification.title, notification.body)
    notification.status = "sent"
    notification.sent_at = datetime.now(timezone.utc)
    notification.recipient_count = count
    db.commit()
