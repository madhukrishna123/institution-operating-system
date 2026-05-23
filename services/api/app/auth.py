import base64
import hashlib
import hmac
import json
import secrets
import time

from app.settings import settings


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    ).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    if stored == password:
        return True
    try:
        scheme, salt, digest = stored.split("$", 2)
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False
    computed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    ).hex()
    return hmac.compare_digest(computed, digest)


def is_hashed_password(stored: str) -> bool:
    return stored.startswith("pbkdf2_sha256$")


def create_access_token(user_id: int, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": int(time.time()) + settings.access_token_minutes * 60,
    }
    body = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    ).decode("ascii").rstrip("=")
    signature = hmac.new(
        settings.secret_key.encode("utf-8"),
        body.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"signed:{body}.{signature}"


def verify_access_token(token: str) -> dict:
    if not token.startswith("signed:"):
        raise ValueError("Unsupported token")
    raw = token.removeprefix("signed:")
    body, signature = raw.rsplit(".", 1)
    expected = hmac.new(
        settings.secret_key.encode("utf-8"),
        body.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise ValueError("Invalid token signature")
    padded = body + "=" * (-len(body) % 4)
    payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))
    if int(payload.get("exp", 0)) < int(time.time()):
        raise ValueError("Expired token")
    return payload
