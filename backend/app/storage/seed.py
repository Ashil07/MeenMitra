"""Reproducible synthetic demo data.

Every seeded record is fictional and flagged `is_demo_record: true`. Ponds, farmers and phone numbers
are invented (phone numbers use an invalid "+91 00000…" range so they cannot belong to anyone).
IDs and scenario contents are stable; timestamps are laid out relative to an anchor time (default:
now at seed time) so the dashboard's "last 7 days" views stay meaningful.

Usage (from backend/):
    python -m app.storage.seed            # seed only if the database is empty
    python -m app.storage.seed --reset    # wipe the local demo database and re-seed
"""

from __future__ import annotations

import argparse
import logging
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from app.context import AppContext, build_context
from app.config import get_settings
from app.schemas.alerts import AcknowledgeRequest, SimulateSendRequest
from app.schemas.calibration import FeedbackRequest
from app.schemas.forecast import ForecastRequest, ForecastWaterInput
from app.schemas.ponds import PondCreate
from app.schemas.reports import FarmerReportCreate
from app.schemas.water import WaterCheckRequest
from app.services import alerts as alert_service
from app.services import forecasts as forecast_service
from app.services import reports as report_service
from app.services import water_checks as water_service
from app.utils import IST

logger = logging.getLogger(__name__)
SEED_VERSION = "demo-seed-1"

PONDS: list[tuple[str, dict[str, Any]]] = [
    ("pond_demo_001", dict(
        name="Demo Pond A1 (carp)", farmer_name="Demo Farmer 01", contact_phone="+910000000001",
        district="Udupi", village_cluster="Demo Cluster Brahmavar", area_m2=2000, depth_m=1.4,
        species="indian_major_carp_polyculture", stocking_date="2026-06-15", stocked_count=4000,
        estimated_biomass_kg=1800, has_aerator=True, aerator_count=1, preferred_language="kn",
        alert_channels=["whatsapp", "sms"])),
    ("pond_demo_002", dict(
        name="Demo Pond A2 (tilapia)", farmer_name="Demo Farmer 02", contact_phone="+910000000002",
        district="Udupi", village_cluster="Demo Cluster Brahmavar", area_m2=1200, depth_m=1.2,
        species="tilapia", stocking_date="2026-07-01", stocked_count=5000, estimated_biomass_kg=1100,
        has_aerator=False, aerator_count=0, preferred_language="kn", alert_channels=["whatsapp", "sms", "voice"])),
    ("pond_demo_003", dict(
        name="Demo Pond B1 (pangasius)", farmer_name="Demo Farmer 03", contact_phone="+910000000003",
        district="Dakshina Kannada", village_cluster="Demo Cluster Mulki", area_m2=3000, depth_m=1.8,
        species="pangasius", stocking_date="2026-05-20", stocked_count=9000, estimated_biomass_kg=4500,
        has_aerator=True, aerator_count=2, preferred_language="en", alert_channels=["whatsapp"])),
    ("pond_demo_004", dict(
        name="Demo Pond B2 (carp)", farmer_name="Demo Farmer 04", contact_phone=None,
        district="Dakshina Kannada", village_cluster="Demo Cluster Mulki", area_m2=1500, depth_m=1.0,
        species="indian_major_carp_polyculture", stocking_date=None, stocked_count=None,
        estimated_biomass_kg=None, has_aerator=False, aerator_count=0, preferred_language="kn",
        alert_channels=["whatsapp"])),
    ("pond_demo_005", dict(
        name="Demo Pond C1 (shrimp)", farmer_name="Demo Farmer 05", contact_phone="+910000000005",
        district="Uttara Kannada", village_cluster="Demo Cluster Kumta", area_m2=4000, depth_m=1.3,
        species="pacific_white_shrimp", water_type="brackish", stocking_date="2026-08-10",
        stocked_count=200000, estimated_biomass_kg=2600, has_aerator=True, aerator_count=4,
        preferred_language="kn", alert_channels=["sms", "voice"])),
    ("pond_demo_006", dict(
        name="Demo Pond B3 (carp)", farmer_name="Demo Farmer 06", contact_phone="+910000000006",
        district="Dakshina Kannada", village_cluster="Demo Cluster Mulki", area_m2=800, depth_m=1.1,
        species="indian_major_carp_polyculture", stocking_date="2026-07-20", stocked_count=1200,
        estimated_biomass_kg=300, has_aerator=False, aerator_count=0, preferred_language="en",
        alert_channels=["whatsapp", "sms"])),
]


def deterministic_ids() -> Callable[[str], str]:
    counters: dict[str, int] = {}

    def make(prefix: str) -> str:
        counters[prefix] = counters.get(prefix, 0) + 1
        return f"{prefix}_demo_{counters[prefix]:03d}"

    return make


def seed(ctx: AppContext, anchor: datetime | None = None) -> dict[str, int]:
    """Populate an EMPTY database. Raises if records already exist (use reset())."""
    if ctx.db.count("ponds"):
        raise RuntimeError("database already contains ponds; use --reset to re-seed")
    anchor = (anchor or ctx.clock()).astimezone(timezone.utc).replace(second=0, microsecond=0)
    ids = deterministic_ids()

    def at(hours_before: float) -> AppContext:
        moment = anchor - timedelta(hours=hours_before)
        return replace(ctx, clock=lambda: moment, ids=ids)

    today_ist = anchor.astimezone(IST).date()
    yesterday_ist = today_ist - timedelta(days=1)
    created = (anchor - timedelta(days=30)).isoformat()
    for pond_id, data in PONDS:
        validated = PondCreate(**data).model_dump(mode="json")
        ctx.db.put("ponds", {"id": pond_id, **validated, "is_demo_record": True,
                             "created_at": created, "updated_at": created})

    # Yesterday's forecast for pond 001 plus dawn feedback → shows an auditable calibration update.
    old = forecast_service.run_forecast(at(30), "pond_demo_001", ForecastRequest(
        forecast_date=yesterday_ist, scenario="clear_calm_night", aerator_planned=False, create_alert=False),
        is_demo_record=True)
    # Feedback is recorded 3 h before the anchor, i.e. before today's forecasts (2 h before) use it.
    feedback_time = anchor - timedelta(hours=3)
    observed = min(datetime(today_ist.year, today_ist.month, today_ist.day, 6, 15, tzinfo=IST),
                   feedback_time - timedelta(minutes=5))
    forecast_service.submit_feedback(at(3), "pond_demo_001", FeedbackRequest(
        forecast_id=old["id"], observation="fish_gasping_at_dawn", observed_at=observed,
        note="Synthetic demo feedback"))

    water: list[tuple[str, dict[str, Any]]] = [
        ("pond_demo_001", dict(ph=7.8, water_temp_c=29.5, total_ammonia_mg_l=0.4, nitrite_mg_l=0.1,
                               dissolved_oxygen_mg_l=5.6)),
        ("pond_demo_002", dict(ph=8.6, water_temp_c=30.5, total_ammonia_mg_l=1.2, nitrite_mg_l=0.2,
                               dissolved_oxygen_mg_l=3.8, symptoms=["reduced_feeding"])),
        ("pond_demo_004", dict(ph=7.2, symptoms=["red_patches_or_lesions", "reduced_feeding"])),
        ("pond_demo_006", dict(ph=7.0, water_temp_c=28.0, dissolved_oxygen_mg_l=6.1)),
    ]
    checks = {}
    for pond_id, values in water:
        checks[pond_id] = water_service.run_water_check(
            at(5), pond_id, WaterCheckRequest(**values, note="Synthetic demo reading"), is_demo_record=True)

    scenarios: list[tuple[str, dict[str, Any]]] = [
        ("pond_demo_001", dict(scenario="overcast_still_night", aerator_planned=True)),
        ("pond_demo_002", dict(scenario="overcast_still_night")),
        ("pond_demo_003", dict(scenario="hot_humid_still", aerator_planned=True)),
        ("pond_demo_004", dict(scenario="clear_calm_night")),
        ("pond_demo_005", dict(scenario="windy_clear_night")),
        ("pond_demo_006", dict(scenario="monsoon_heavy_rain",
                               water=ForecastWaterInput(water_temp_c=27.0, dissolved_oxygen_mg_l=6.5))),
    ]
    forecasts = {}
    for pond_id, params in scenarios:
        forecasts[pond_id] = forecast_service.run_forecast(
            at(2), pond_id, ForecastRequest(forecast_date=today_ist, **params), is_demo_record=True)

    reports: list[tuple[str, float, dict[str, Any]]] = [
        ("pond_demo_003", 50, dict(symptoms=["red_patches_or_lesions"])),
        ("pond_demo_004", 26, dict(symptoms=["red_patches_or_lesions", "reduced_feeding"])),
        ("pond_demo_006", 74, dict(symptoms=["red_patches_or_lesions"], note="A few fish with red marks")),
        ("pond_demo_001", 20, dict(symptoms=["reduced_feeding"])),
        ("pond_demo_002", 3, dict(symptoms=["reduced_feeding", "gasping_at_surface"])),
        ("pond_demo_005", 30, dict(note="Routine check, no issues seen")),
        ("pond_demo_005", 240, dict(mortality_count=5, note="Older report outside the 7-day window")),
    ]
    for pond_id, hours_before, values in reports:
        report_service.create_report(at(hours_before), FarmerReportCreate(
            pond_id=pond_id, observed_at=anchor - timedelta(hours=hours_before), **values), is_demo_record=True)

    # Simulated delivery history: delivered + acknowledged, partial failure, and no-recipient failure.
    send_ctx = at(1.5)
    if forecasts["pond_demo_002"]["alert_id"]:
        alert_id = forecasts["pond_demo_002"]["alert_id"]
        alert_service.simulate_send(send_ctx, alert_id, SimulateSendRequest(channels=["whatsapp", "sms"]))
        alert_service.acknowledge(at(1), alert_id, AcknowledgeRequest(response="action_taken", channel="whatsapp",
                                                                      note="Synthetic demo acknowledgement"))
    if checks["pond_demo_002"]["alert_id"]:
        alert_service.simulate_send(send_ctx, checks["pond_demo_002"]["alert_id"],
                                    SimulateSendRequest(channels=["whatsapp", "sms"], simulate_failure_channels=["sms"]))
    if forecasts["pond_demo_004"]["alert_id"]:
        alert_service.simulate_send(send_ctx, forecasts["pond_demo_004"]["alert_id"], SimulateSendRequest())

    ctx.db.set_meta("seed_version", SEED_VERSION)
    ctx.db.set_meta("seed_anchor", anchor.isoformat())
    counts = {c: ctx.db.count(c) for c in ("ponds", "forecasts", "water_checks", "alerts", "farmer_reports",
                                          "calibration_events")}
    logger.info("seeded demo data: %s", counts)
    return counts


def reset(ctx: AppContext, anchor: datetime | None = None) -> dict[str, int]:
    ctx.db.clear()
    return seed(ctx, anchor)


def seed_if_empty(ctx: AppContext) -> bool:
    if ctx.db.count("ponds"):
        return False
    seed(ctx)
    return True


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="wipe the local demo database first")
    parser.add_argument("--anchor", type=datetime.fromisoformat, default=None,
                        help="ISO timestamp with offset to anchor seeded times (default: now)")
    args = parser.parse_args()
    settings = get_settings()
    ctx = build_context(settings)
    if args.reset:
        counts = reset(ctx, args.anchor)
    elif ctx.db.count("ponds"):
        print(f"database {settings.database_file} already has data; pass --reset to re-seed")
        return
    else:
        counts = seed(ctx, args.anchor)
    print(f"seeded {settings.database_file}: {counts}")


if __name__ == "__main__":
    main()
