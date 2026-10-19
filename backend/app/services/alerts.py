"""Alert creation, simulated delivery and acknowledgement."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.context import AppContext
from app.errors import ConflictError, NotFoundError
from app.providers.base import DeliveryRequest
from app.schemas.alerts import AcknowledgeRequest, SimulateSendRequest
from app.services.ponds import get_pond_record
from app.utils import IST, mask_phone

SEND_NOTICE = (
    "Simulated delivery via the offline mock provider. No WhatsApp message, SMS or phone call was sent, "
    "and no external service was contacted."
)


def _render(ctx: AppContext, template_key: str, values_by_lang: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
    template = ctx.templates["templates"][template_key]
    title = dict(template["title"])
    message = {lang: text.format(**values_by_lang[lang]) for lang, text in template["message"].items()}
    voice = {lang: f"{template['voice_intro'][lang]} {message[lang]}" for lang in message}
    return {"title": title, "message": message, "voice_script": voice}


def _new_alert(ctx: AppContext, pond: dict[str, Any], source_type: str, source_id: str,
               severity: str, rendered: dict[str, dict[str, str]], created_at: str) -> dict[str, Any]:
    alert = {
        "id": ctx.ids("alert"),
        "pond_id": pond["id"],
        "pond_name": pond["name"],
        "source_type": source_type,
        "source_id": source_id,
        "severity": severity,
        **rendered,
        "status": "pending",
        "created_at": created_at,
        "updated_at": created_at,
        "deliveries": [],
        "acknowledgement": None,
        "template_review_status": ctx.templates["review_status"],
        "is_demo_record": bool(pond.get("is_demo_record")),
    }
    return alert


def build_forecast_alert(ctx: AppContext, pond: dict[str, Any], forecast: dict[str, Any]) -> dict[str, Any]:
    status = forecast["summary"]["overall_status"]
    peak = datetime.fromisoformat(forecast["summary"]["peak_risk_time"]).astimezone(IST).strftime("%H:%M")
    values = {"pond_name": pond["name"], "peak_time": peak}
    rendered = _render(ctx, f"forecast_{status}", {"en": values, "kn": values})
    return _new_alert(ctx, pond, "forecast", forecast["id"], status, rendered, forecast["generated_at"])


def build_water_alert(ctx: AppContext, pond: dict[str, Any], check: dict[str, Any]) -> dict[str, Any]:
    status = check["overall_status"]
    labels = ctx.templates["parameter_labels"]
    params: list[str] = []
    for rule in check["triggered_rules"]:
        if rule["parameter"] not in params:
            params.append(rule["parameter"])
    per_lang = {
        lang: {"pond_name": pond["name"], "reasons": ", ".join(labels[p][lang] for p in params)}
        for lang in ("en", "kn")
    }
    rendered = _render(ctx, f"water_check_{status}", per_lang)
    return _new_alert(ctx, pond, "water_check", check["id"], status, rendered, check["created_at"])


def get_alert(ctx: AppContext, alert_id: str) -> dict[str, Any]:
    alert = ctx.db.find("alerts", alert_id)
    if alert is None:
        raise NotFoundError(f"Alert '{alert_id}' not found", details={"alert_id": alert_id})
    return alert


def list_alerts(ctx: AppContext, pond_id: str | None, status: str | None, severity: str | None) -> list[dict[str, Any]]:
    alerts = ctx.db.list("alerts", pond_id=pond_id)
    if status:
        alerts = [a for a in alerts if a["status"] == status]
    if severity:
        alerts = [a for a in alerts if a["severity"] == severity]
    return alerts


def _attempt_number(alert: dict[str, Any], channel: str) -> int:
    return 1 + sum(1 for d in alert["deliveries"] if d["channel"] == channel)


def simulate_send(ctx: AppContext, alert_id: str, payload: SimulateSendRequest) -> dict[str, Any]:
    alert = get_alert(ctx, alert_id)
    if alert["status"] == "acknowledged":
        raise ConflictError("Alert is already acknowledged; no further sends are simulated",
                            details={"alert_id": alert_id})
    pond = get_pond_record(ctx, alert["pond_id"])
    channels = payload.channels or pond["alert_channels"]
    language = payload.language or pond["preferred_language"]
    now = ctx.clock().isoformat()

    attempts = []
    for channel in channels:
        previous = [d for d in alert["deliveries"] if d["channel"] == channel]
        if previous and previous[-1]["status"] == "simulated_delivered":
            continue  # already delivered on this channel; do not duplicate
        if previous and not previous[-1]["retry_allowed"]:
            raise ConflictError(f"No retries left on channel '{channel}' for this alert",
                                details={"alert_id": alert_id, "channel": channel})
        text = alert["voice_script"][language] if channel == "voice" else alert["message"][language]
        request = DeliveryRequest(
            alert_id=alert_id,
            channel=channel,
            language=language,
            message=text,
            recipient=pond.get("contact_phone"),
            attempt_number=_attempt_number(alert, channel),
            force_failure=channel in payload.simulate_failure_channels,
        )
        outcome = ctx.alert_provider.send(request)
        attempt = {
            "id": ctx.ids("dlv"),
            "channel": channel,
            "language": language,
            "message": text,
            "attempt_number": request.attempt_number,
            "attempted_at": now,
            "status": "simulated_delivered" if outcome.delivered else "simulated_failed",
            "provider_mode": outcome.provider_mode,
            "provider_name": outcome.provider_name,
            "recipient_masked": mask_phone(request.recipient),
            "error": None if outcome.delivered else {"code": outcome.error_code, "message": outcome.error_message},
            "retry_allowed": outcome.retry_allowed,
            "simulated": True,
            "external_request_made": outcome.external_request_made,
            "simulated_call_duration_s": outcome.simulated_call_duration_s,
        }
        alert["deliveries"].append(attempt)
        attempts.append(attempt)

    latest_by_channel: dict[str, dict[str, Any]] = {}
    for d in alert["deliveries"]:
        latest_by_channel[d["channel"]] = d
    if attempts:
        any_delivered = any(d["status"] == "simulated_delivered" for d in latest_by_channel.values())
        alert["status"] = "sent" if any_delivered else "failed"
        alert["updated_at"] = now
        ctx.db.put("alerts", alert)
    return {"alert": alert, "attempts": attempts, "notice": SEND_NOTICE}


def acknowledge(ctx: AppContext, alert_id: str, payload: AcknowledgeRequest) -> dict[str, Any]:
    alert = get_alert(ctx, alert_id)
    if alert["acknowledgement"] is not None:
        raise ConflictError("Alert is already acknowledged",
                            details={"acknowledged_at": alert["acknowledgement"]["acknowledged_at"]})
    now = ctx.clock().isoformat()
    alert["acknowledgement"] = {
        "acknowledged_at": now,
        "response": payload.response,
        "channel": payload.channel,
        "note": payload.note,
    }
    alert["status"] = "acknowledged"
    alert["updated_at"] = now
    ctx.db.put("alerts", alert)
    return alert
