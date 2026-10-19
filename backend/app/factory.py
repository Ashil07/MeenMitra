"""FastAPI application factory (importing this module has no side effects)."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import install_error_handlers
from app.api.routes import alerts, insights, ponds
from app.config import Settings, get_settings
from app.context import AppContext, build_context
from app.storage.seed import seed_if_empty

logger = logging.getLogger("app")

DESCRIPTION = """
MeenMitra MVP backend — **demo mode**.

* Forecasts are a *relative demo oxygen-risk index* from an uncalibrated physics-inspired model, not
  dissolved-oxygen measurements or predictions of when oxygen will crash.
* Water-quality thresholds are unvalidated demonstration settings; the rules engine never diagnoses disease.
* Alerts are delivered only through an offline mock provider; no real message or call is ever sent.
* Seeded ponds, readings, reports and alerts are synthetic.

Successful responses use `{"data": ..., "meta": {...}}`; errors use `{"error": {"code", "message", "details"}}`.
"""


def create_app(settings: Settings | None = None, ctx: AppContext | None = None) -> FastAPI:
    settings = settings or (ctx.settings if ctx else get_settings())

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if settings.seed_on_startup and seed_if_empty(app.state.ctx):
            logger.info("seeded empty demo database at %s", settings.database_file)
        yield

    app = FastAPI(title="MeenMitra API", version="0.1.0", description=DESCRIPTION, lifespan=lifespan)
    app.state.ctx = ctx or build_context(settings)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
        allow_credentials=False,
    )
    install_error_handlers(app)
    app.include_router(insights.health_router)
    app.include_router(insights.health_router, prefix="/api/v1", include_in_schema=False)
    for router in (insights.router, ponds.router, alerts.router):
        app.include_router(router, prefix="/api/v1")
    return app
