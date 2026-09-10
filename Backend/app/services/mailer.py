"""Outbound email via the shared Gmail Workspace SMTP relay.

Stdlib-only (smtplib + email.mime) — no new dependency. Configured via the
SMTP_* settings in config.py / .env; with no smtp_host set, send_email() is a
silent no-op so credential-less environments (CI, fresh dev) keep working.
"""

import logging
import smtplib
import ssl
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# (filename, content, mime type) — e.g. ("report.csv", b"...", "text/csv")
Attachment = tuple[str, bytes, str]


def send_email(
    to: str,
    subject: str,
    body: str,
    html: str | None = None,
    attachments: list[Attachment] | None = None,
) -> bool:
    """Send one email. Returns True on success, False on failure or when SMTP
    isn't configured — callers treat email as best-effort, never a hard
    dependency of the request that triggered it."""
    if not settings.smtp_host:
        logger.info("SMTP not configured — skipping email %r to %s", subject, to)
        return False

    sender = settings.smtp_from or settings.smtp_user
    alternative = MIMEMultipart("alternative")
    alternative.attach(MIMEText(body, "plain"))
    if html:
        alternative.attach(MIMEText(html, "html"))

    if attachments:
        # mixed wraps the text alternatives plus the file parts.
        msg = MIMEMultipart("mixed")
        msg.attach(alternative)
        for filename, content, mime_type in attachments:
            maintype, _, subtype = mime_type.partition("/")
            part = MIMEBase(maintype or "application", subtype or "octet-stream")
            part.set_payload(content)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", "attachment", filename=filename)
            msg.attach(part)
    else:
        msg = alternative

    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to

    try:
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=ssl.create_default_context(), timeout=15) as server:
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        else:  # 587 (STARTTLS) — what the shared Gmail relay uses
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
                server.starttls(context=ssl.create_default_context())
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        return True
    except Exception:
        logger.exception("Failed to send email %r to %s", subject, to)
        return False
