"""JWT issuance/verification, password hashing, and Google ID-token verification."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from jose import JWTError, jwt

from .config import get_settings

settings = get_settings()

TYPE_EMPLOYEE = "employee"
TYPE_ADMIN = "admin"
_ACCESS = "access"
_REFRESH = "refresh"

_PBKDF2_ITERATIONS = 320_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algo, iterations, salt, hash_hex = encoded.split("$")
    except (ValueError, AttributeError):
        return False
    if algo != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations))
    return secrets.compare_digest(digest.hex(), hash_hex)


def _create_token(subject: str, token_type: str, scope: str, extra: dict, expires: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "type": token_type,  # "employee" | "admin"
        "scope": scope,      # "access" | "refresh"
        "iat": now,
        "exp": now + expires,
        **extra,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str, token_type: str, extra: dict | None = None) -> str:
    return _create_token(
        subject, token_type, _ACCESS, extra or {},
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(subject: str, token_type: str) -> str:
    return _create_token(
        subject, token_type, _REFRESH, {},
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_token(token: str, expected_scope: str = _ACCESS) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    if payload.get("scope") != expected_scope:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token scope")
    return payload


def decode_refresh_token(token: str) -> dict:
    return decode_token(token, expected_scope=_REFRESH)


def verify_google_id_token(token: str) -> dict:
    """Verify a Google-issued ID token and return {sub, email, name}.

    Accepts any of the configured client IDs (mobile web/iOS). Raises 401 on
    any failure so the caller can surface a clean error.
    """
    if not settings.allowed_google_client_ids:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "No Google client IDs configured on the server",
        )
    try:
        info = google_id_token.verify_oauth2_token(token, google_requests.Request())
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google token")

    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Untrusted token issuer")
    if info.get("aud") not in settings.allowed_google_client_ids:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token was not issued for this app")
    if not info.get("email_verified", False):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google email not verified")

    email = (info.get("email") or "").lower()
    domain = settings.allowed_email_domain.strip().lower()
    if domain and not email.endswith("@" + domain):
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Only @{domain} accounts are allowed")

    return {
        "sub": info["sub"],
        "email": email,
        "name": info.get("name") or info.get("given_name") or email,
    }
