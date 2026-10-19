"""Small shared helpers: IDs, clocks and canonical hashing."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

# India Standard Time has no daylight saving, so a fixed offset is exact and avoids a tzdata dependency.
IST = timezone(timedelta(hours=5, minutes=30), name="IST")

Clock = Callable[[], datetime]


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def stable_hash(payload: Any) -> str:
    """SHA-256 over canonical JSON — the same inputs always produce the same hash."""
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def mask_phone(phone: str | None) -> str | None:
    """Show only the last four digits of a phone number in API responses."""
    if not phone:
        return None
    digits = [c for c in phone if c.isdigit()]
    if len(digits) < 4:
        return "••••"
    return "•••••• " + "".join(digits[-4:])
