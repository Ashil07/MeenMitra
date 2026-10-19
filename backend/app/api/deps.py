"""FastAPI dependencies and response-envelope helpers."""

from __future__ import annotations

from typing import Any, TypeVar

from fastapi import Query, Request

from app.context import AppContext

T = TypeVar("T")


def get_ctx(request: Request) -> AppContext:
    ctx: AppContext = request.app.state.ctx
    return ctx


class Page:
    def __init__(
        self,
        limit: int = Query(50, ge=1, le=200, description="Maximum items to return"),
        offset: int = Query(0, ge=0, description="Items to skip"),
    ) -> None:
        self.limit = limit
        self.offset = offset


def envelope(ctx: AppContext, data: Any) -> dict[str, Any]:
    return {"data": data, "meta": {"generated_at": ctx.clock().isoformat(), "demo_mode": True, "api_version": "v1"}}


def list_envelope(ctx: AppContext, items: list[Any], page: Page) -> dict[str, Any]:
    body = envelope(ctx, items[page.offset: page.offset + page.limit])
    body["meta"]["pagination"] = {"total": len(items), "limit": page.limit, "offset": page.offset}
    return body
