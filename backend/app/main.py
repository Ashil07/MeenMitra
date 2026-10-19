"""ASGI entry point.

Run locally (from backend/):  uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging

from app.factory import create_app

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
app = create_app()
