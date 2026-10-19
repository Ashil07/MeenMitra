"""Local SQLite persistence for the demo.

Records are stored as JSON documents keyed by (collection, id), with pond_id and created_at
indexed for filtering. This keeps the MVP dependency-free (stdlib sqlite3) while the service
layer stays independent of the storage choice.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

COLLECTIONS = (
    "ponds",
    "water_checks",
    "farmer_reports",
    "forecasts",
    "alerts",
    "calibration_states",
    "calibration_events",
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS records (
    collection TEXT NOT NULL,
    id TEXT NOT NULL,
    pond_id TEXT,
    created_at TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS idx_records_pond ON records (collection, pond_id);
CREATE INDEX IF NOT EXISTS idx_records_created ON records (collection, created_at);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""


class RecordNotFound(KeyError):
    pass


class Database:
    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)
        self._lock = threading.Lock()
        if str(self.path) != ":memory:":
            self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.executescript(_SCHEMA)

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        with self._lock:
            conn = sqlite3.connect(self.path)
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

    def _check(self, collection: str) -> None:
        if collection not in COLLECTIONS:
            raise ValueError(f"unknown collection: {collection}")

    def put(self, collection: str, record: dict[str, Any]) -> dict[str, Any]:
        """Insert or replace a record. It must carry 'id' and 'created_at'."""
        self.put_many([(collection, record)])
        return record

    def put_many(self, items: list[tuple[str, dict[str, Any]]]) -> None:
        """Write several records in one transaction (all or nothing)."""
        for collection, _ in items:
            self._check(collection)
        with self._connect() as conn:
            conn.executemany(
                "INSERT OR REPLACE INTO records (collection, id, pond_id, created_at, data) "
                "VALUES (?, ?, ?, ?, ?)",
                [
                    (
                        collection,
                        record["id"],
                        record.get("pond_id"),
                        record["created_at"],
                        json.dumps(record, ensure_ascii=False),
                    )
                    for collection, record in items
                ],
            )

    def get(self, collection: str, record_id: str) -> dict[str, Any]:
        self._check(collection)
        with self._connect() as conn:
            row = conn.execute(
                "SELECT data FROM records WHERE collection = ? AND id = ?", (collection, record_id)
            ).fetchone()
        if row is None:
            raise RecordNotFound(f"{collection}/{record_id}")
        result: dict[str, Any] = json.loads(row[0])
        return result

    def find(self, collection: str, record_id: str) -> dict[str, Any] | None:
        try:
            return self.get(collection, record_id)
        except RecordNotFound:
            return None

    def list(
        self,
        collection: str,
        pond_id: str | None = None,
        newest_first: bool = True,
    ) -> list[dict[str, Any]]:
        self._check(collection)
        sql = "SELECT data FROM records WHERE collection = ?"
        params: list[Any] = [collection]
        if pond_id is not None:
            sql += " AND pond_id = ?"
            params.append(pond_id)
        sql += f" ORDER BY created_at {'DESC' if newest_first else 'ASC'}, id ASC"
        with self._connect() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [json.loads(r[0]) for r in rows]

    def count(self, collection: str) -> int:
        self._check(collection)
        with self._connect() as conn:
            (n,) = conn.execute(
                "SELECT COUNT(*) FROM records WHERE collection = ?", (collection,)
            ).fetchone()
        return int(n)

    def clear(self) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM records")
            conn.execute("DELETE FROM meta")

    def set_meta(self, key: str, value: str) -> None:
        with self._connect() as conn:
            conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", (key, value))

    def get_meta(self, key: str) -> str | None:
        with self._connect() as conn:
            row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
        return None if row is None else str(row[0])
