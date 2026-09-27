"""Password hashing, password rules, and signed session tokens (stdlib only)."""

import base64
import hashlib
import hmac
import os
import re
import secrets
import time
from pathlib import Path

ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 600_000  # OWASP 2023+ recommendation for PBKDF2-HMAC-SHA256
LEGACY_ITERATIONS = 120_000  # seed users are stored as pbkdf2_sha256$salt$hash at this count

SESSION_COOKIE = "cc_session"
SESSION_TTL_SECONDS = 7 * 24 * 3600

SPECIAL_CHAR = re.compile(r"[^A-Za-z0-9]")
DIGIT = re.compile(r"\d")
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# --- Passwords ---------------------------------------------------------------

def _pbkdf2(password: str, salt: str, iterations: int) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations).hex()


def hash_password(password: str) -> str:
    """Return pbkdf2_sha256$<iterations>$<salt>$<hex digest> with a fresh random salt."""
    salt = secrets.token_hex(16)
    return f"{ALGORITHM}${ITERATIONS}${salt}${_pbkdf2(password, salt, ITERATIONS)}"


def verify_password(password: str, stored: str) -> bool:
    parts = stored.split("$")
    if len(parts) == 4:
        algorithm, iterations, salt, digest = parts
        iterations = int(iterations)
    elif len(parts) == 3:  # seed format without an iteration count
        algorithm, salt, digest = parts
        iterations = LEGACY_ITERATIONS
    else:
        return False
    if algorithm != ALGORITHM:
        return False
    return hmac.compare_digest(_pbkdf2(password, salt, iterations), digest)


# Hashed once so logins for unknown emails take as long as real ones.
DUMMY_HASH = hash_password(secrets.token_hex(16))


def password_problems(password: str) -> list[str]:
    """Rules for new accounts; the frontend shows the same checklist."""
    problems = []
    if len(password) < 8:
        problems.append("at least 8 characters")
    if not DIGIT.search(password):
        problems.append("a number")
    if not SPECIAL_CHAR.search(password):
        problems.append("a special character")
    return problems


# --- Sessions ----------------------------------------------------------------

def _load_secret() -> bytes:
    """SESSION_SECRET env var, else a random secret persisted next to this file."""
    if env := os.environ.get("SESSION_SECRET"):
        return env.encode()
    path = Path(__file__).with_name(".session_secret")
    if not path.exists():
        path.write_text(secrets.token_hex(32))
        path.chmod(0o600)
    return path.read_text().strip().encode()


SECRET = _load_secret()


def _sign(payload: str) -> str:
    return hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()


def create_session_token(user_id: int) -> str:
    payload = f"{user_id}.{int(time.time()) + SESSION_TTL_SECONDS}"
    token = f"{payload}.{_sign(payload)}"
    return base64.urlsafe_b64encode(token.encode()).decode()


def read_session_token(token: str) -> int | None:
    """Return the user id if the token is authentic and unexpired."""
    try:
        user_id, expires, signature = base64.urlsafe_b64decode(token.encode()).decode().split(".")
        if not hmac.compare_digest(_sign(f"{user_id}.{expires}"), signature):
            return None
        if int(expires) < time.time():
            return None
        return int(user_id)
    except (ValueError, UnicodeDecodeError):
        return None


# --- Login throttling ---------------------------------------------------------

MAX_FAILURES = 5
LOCKOUT_SECONDS = 60
_failures: dict[str, list[float]] = {}


def is_locked_out(email: str) -> bool:
    recent = [t for t in _failures.get(email, []) if time.time() - t < LOCKOUT_SECONDS]
    _failures[email] = recent
    return len(recent) >= MAX_FAILURES


def record_failure(email: str) -> None:
    _failures.setdefault(email, []).append(time.time())


def clear_failures(email: str) -> None:
    _failures.pop(email, None)
