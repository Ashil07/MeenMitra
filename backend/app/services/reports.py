"""Farmer observation reports and cluster-level cooperative monitoring.

Cooperative summaries aggregate by village cluster and never include farmer names, phone numbers
or pond names.
"""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timedelta
from typing import Any

from app.context import AppContext
from app.errors import InvalidInputError
from app.schemas.reports import FarmerReportCreate
from app.services.ponds import get_pond_record, latest_status

# Demonstration signal rule (not an epidemiological threshold).
INVESTIGATE_MIN_PONDS = 3
WATCH_MIN_PONDS = 2
SIGNAL_RULE = (
    f"Within the window: {INVESTIGATE_MIN_PONDS}+ distinct ponds reporting the same symptom, or "
    f"{WATCH_MIN_PONDS}+ with the same symptom plus any reported mortality → investigate; "
    f"{WATCH_MIN_PONDS}+ distinct ponds with the same symptom, or any mortality → watch. Demo setting."
)
PRIVACY_NOTE = (
    "Aggregated by village cluster. Farmer names, phone numbers and pond names are never included "
    "in cooperative summaries."
)
METHOD_NOTE = (
    "Counts use farmer reports and seeded synthetic records only. A signal is a prompt for a fisheries "
    "officer to follow up, not a confirmed outbreak."
)


def create_report(ctx: AppContext, payload: FarmerReportCreate, *, is_demo_record: bool = False) -> dict[str, Any]:
    pond = get_pond_record(ctx, payload.pond_id)
    if payload.observed_at > ctx.clock():
        raise InvalidInputError("observed_at cannot be in the future", details={"now": ctx.clock().isoformat()})
    record = {
        "id": ctx.ids("rpt"),
        "pond_id": pond["id"],
        "district": pond["district"],
        "village_cluster": pond["village_cluster"],
        "symptoms": list(payload.symptoms),
        "mortality_count": payload.mortality_count,
        "note": payload.note,
        "observed_at": payload.observed_at.isoformat(),
        "created_at": ctx.clock().isoformat(),
        "is_demo_record": is_demo_record,
    }
    ctx.db.put("farmer_reports", record)
    return record


def list_reports(ctx: AppContext, pond_id: str | None) -> list[dict[str, Any]]:
    if pond_id:
        get_pond_record(ctx, pond_id)
    return ctx.db.list("farmer_reports", pond_id=pond_id)


def _cluster_id(district: str, cluster: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", f"{district}-{cluster}".lower()).strip("-")


def cooperative_summary(ctx: AppContext, window_days: int = 7) -> dict[str, Any]:
    now = ctx.clock()
    start = now - timedelta(days=window_days)
    ponds = ctx.db.list("ponds", newest_first=False)
    reports = [r for r in ctx.db.list("farmer_reports") if datetime.fromisoformat(r["observed_at"]) >= start]

    clusters: dict[tuple[str, str], dict[str, Any]] = {}
    for pond in ponds:
        key = (pond["district"], pond["village_cluster"])
        entry = clusters.setdefault(key, {"ponds": [], "reports": []})
        entry["ponds"].append(pond)
    pond_cluster = {p["id"]: (p["district"], p["village_cluster"]) for p in ponds}
    for report in reports:
        cluster_key = pond_cluster.get(report["pond_id"])
        if cluster_key is not None:
            clusters[cluster_key]["reports"].append(report)

    out = []
    for (district, cluster), entry in sorted(clusters.items()):
        by_status: Counter[str] = Counter()
        for pond in entry["ponds"]:
            by_status[latest_status(ctx, pond["id"])["overall_status"] or "unknown"] += 1
        symptom_ponds: dict[str, set[str]] = {}
        mortality = 0
        mortality_ponds: set[str] = set()
        for report in entry["reports"]:
            for symptom in report["symptoms"]:
                symptom_ponds.setdefault(symptom, set()).add(report["pond_id"])
            if report.get("mortality_count"):
                mortality += int(report["mortality_count"])
                mortality_ponds.add(report["pond_id"])
        out.append({
            "cluster_id": _cluster_id(district, cluster),
            "village_cluster": cluster,
            "district": district,
            "pond_count": len(entry["ponds"]),
            "ponds_by_status": {s: by_status.get(s, 0) for s in ("safe", "watch", "danger", "unknown")},
            "reports_in_window": len(entry["reports"]),
            "ponds_reporting": len({r["pond_id"] for r in entry["reports"]}),
            "symptom_counts": {s: len(p) for s, p in sorted(symptom_ponds.items())},
            "mortality_reported": mortality,
            "signal": _signal(symptom_ponds, mortality_ponds),
        })
    return {
        "window_days": window_days,
        "window_start": start.isoformat(),
        "clusters": out,
        "privacy_note": PRIVACY_NOTE,
        "method_note": METHOD_NOTE,
    }


def _signal(symptom_ponds: dict[str, set[str]], mortality_ponds: set[str]) -> dict[str, str]:
    top = max(symptom_ponds.items(), key=lambda kv: (len(kv[1]), kv[0]), default=None)
    if top and len(top[1]) >= INVESTIGATE_MIN_PONDS:
        level, text = "investigate", f"{len(top[1])} ponds reported '{top[0]}' in the window."
    elif mortality_ponds and top and len(top[1]) >= WATCH_MIN_PONDS:
        level, text = "investigate", (f"{len(top[1])} ponds reported '{top[0]}' and "
                                       f"{len(mortality_ponds)} reported mortality in the window.")
    elif top and len(top[1]) >= WATCH_MIN_PONDS:
        level, text = "watch", f"{len(top[1])} ponds reported '{top[0]}' in the window."
    elif mortality_ponds:
        level, text = "watch", f"{len(mortality_ponds)} pond(s) reported mortality in the window."
    else:
        level, text = "none", "No repeated symptom across ponds in the window."
    return {"level": level, "explanation": text, "rule": SIGNAL_RULE}
