"""Transparent water-quality and symptom rules engine (pure functions, no I/O besides loading config).

Thresholds come from a JSON profile (app/config_data/water_thresholds.json by default) and are
DEMONSTRATION SETTINGS. The engine never diagnoses disease; it flags observations for follow-up.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

Status = Literal["safe", "watch", "danger"]
_SEVERITY = {"safe": 0, "watch": 1, "danger": 2}

DEFAULT_PROFILE_PATH = Path(__file__).resolve().parent.parent / "config_data" / "water_thresholds.json"

REFERRAL_TEXT = (
    "This check is not a diagnosis. For suspected disease, unusual mortality or any medication or "
    "chemical treatment, consult a qualified fisheries officer (e.g. the local Department of Fisheries "
    "office or a Krishi Vigyan Kendra fisheries specialist) before acting."
)
DISCLAIMER = (
    "Demonstration rules engine. Thresholds are unvalidated demonstration settings for generic "
    "warm-water ponds and do not diagnose disease."
)

MEASURED_PARAMETERS = ("ph", "water_temp_c", "total_ammonia_mg_l", "nitrite_mg_l", "dissolved_oxygen_mg_l")


@dataclass(frozen=True)
class ThresholdProfile:
    raw: dict[str, Any]

    @property
    def id(self) -> str:
        return str(self.raw["id"])

    def parameter(self, name: str) -> dict[str, Any]:
        result: dict[str, Any] = self.raw["parameters"][name]
        return result

    def info(self) -> dict[str, Any]:
        return {k: self.raw[k] for k in ("id", "label", "status", "validated", "applies_to", "notes")}


def load_profile(path: Path | None = None) -> ThresholdProfile:
    with open(path or DEFAULT_PROFILE_PATH, encoding="utf-8") as fh:
        raw = json.load(fh)
    validate_profile(raw)
    return ThresholdProfile(raw)


def validate_profile(raw: dict[str, Any]) -> None:
    """Fail fast on a malformed threshold file instead of evaluating with bad bands."""
    if raw.get("status") != "demonstration_settings" and raw.get("validated") is not True:
        raise ValueError("an unvalidated threshold profile must declare status 'demonstration_settings'")
    for name, spec in raw["parameters"].items():
        bands = spec["bands"]
        if not bands or bands[0].get("min") is not None or bands[-1].get("max") is not None:
            raise ValueError(f"bands for {name} must be open-ended at both ends")
        for prev, nxt in zip(bands, bands[1:]):
            if prev.get("max") != nxt.get("min"):
                raise ValueError(f"bands for {name} must be contiguous")
        for band in bands:
            if band["status"] not in _SEVERITY:
                raise ValueError(f"unknown status in {name}: {band['status']}")


def unionized_ammonia_fraction(ph: float, water_temp_c: float) -> float:
    """Fraction of TAN present as un-ionised NH3 (Emerson et al., 1975, freshwater).

    pKa = 0.09018 + 2729.92 / T(K);  f = 1 / (1 + 10^(pKa - pH))
    """
    pka = 0.09018 + 2729.92 / (water_temp_c + 273.15)
    return 1.0 / (1.0 + math.pow(10.0, pka - ph))


def _band_for(value: float, bands: list[dict[str, Any]]) -> dict[str, Any]:
    for band in bands:
        low = band.get("min")
        high = band.get("max")
        if (low is None or value >= low) and (high is None or value < high):
            return band
    raise ValueError(f"value {value} not covered by bands")  # unreachable for validated profiles


def _describe(band: dict[str, Any], unit: str) -> str:
    low, high = band.get("min"), band.get("max")
    if low is None:
        return f"{band['status']}: below {high} {unit}"
    if high is None:
        return f"{band['status']}: {low} {unit} or above"
    return f"{band['status']}: {low} to below {high} {unit}"


@dataclass
class RuleOutcome:
    rule_id: str
    parameter: str
    observed_value: float | str | None
    unit: str | None
    status: Status
    threshold_description: str
    explanation: str
    source: str

    def as_dict(self) -> dict[str, Any]:
        return dict(self.__dict__)


@dataclass
class Evaluation:
    overall_status: Status
    evaluated: list[RuleOutcome]
    missing_parameters: list[str]
    derived: dict[str, float | None]
    next_steps: list[str]
    referral: str = REFERRAL_TEXT
    disclaimer: str = DISCLAIMER
    triggered: list[RuleOutcome] = field(default_factory=list)


def _measurement_rule(profile: ThresholdProfile, name: str, value: float, context: str = "") -> RuleOutcome:
    spec = profile.parameter(name)
    band = _band_for(value, spec["bands"])
    unit = spec["unit"]
    explanation = f"{spec['label']} of {round(value, 4)} {unit} falls in the '{band['status']}' band."
    if context:
        explanation += f" {context}"
    return RuleOutcome(
        rule_id=f"{name}_band",
        parameter=name,
        observed_value=round(value, 4),
        unit=unit,
        status=band["status"],
        threshold_description="; ".join(_describe(b, unit) for b in spec["bands"]),
        explanation=explanation,
        source=profile.raw["source_label"],
    )


def evaluate(readings: dict[str, Any], symptoms: list[str], profile: ThresholdProfile) -> Evaluation:
    outcomes: list[RuleOutcome] = []
    derived: dict[str, float | None] = {"unionized_ammonia_fraction": None, "unionized_ammonia_mg_l": None}
    missing = [p for p in MEASURED_PARAMETERS if readings.get(p) is None]

    for name in ("ph", "water_temp_c", "dissolved_oxygen_mg_l", "nitrite_mg_l"):
        if readings.get(name) is not None:
            outcomes.append(_measurement_rule(profile, name, float(readings[name])))

    tan = readings.get("total_ammonia_mg_l")
    if tan is not None:
        ph, temp = readings.get("ph"), readings.get("water_temp_c")
        if ph is not None and temp is not None:
            fraction = unionized_ammonia_fraction(float(ph), float(temp))
            nh3 = float(tan) * fraction
            derived["unionized_ammonia_fraction"] = round(fraction, 5)
            derived["unionized_ammonia_mg_l"] = round(nh3, 5)
            outcomes.append(_measurement_rule(
                profile, "unionized_ammonia_mg_l", nh3,
                f"Derived from TAN {tan} mg/L at pH {ph} and {temp} °C (Emerson et al., 1975); "
                f"{round(fraction * 100, 2)}% of TAN is un-ionised under these conditions.",
            ))
        else:
            outcomes.append(_measurement_rule(
                profile, "total_ammonia_mg_l", float(tan),
                "pH and/or temperature missing, so the toxic un-ionised fraction could not be estimated; "
                "this coarse TAN fallback band was used instead.",
            ))

    symptom_cfg = profile.raw["symptoms"]
    disease_signs = []
    for symptom in symptoms:
        cfg = symptom_cfg[symptom]
        if cfg["category"] == "disease_sign":
            disease_signs.append(symptom)
        outcomes.append(RuleOutcome(
            rule_id=f"symptom_{symptom}",
            parameter="symptom",
            observed_value=symptom,
            unit=None,
            status=cfg["status"],
            threshold_description=f"reported symptom → {cfg['status']}",
            explanation=cfg["explanation"],
            source="Demonstration symptom rule; not a diagnosis",
        ))
    min_signs = int(profile.raw["multiple_disease_signs_danger_count"])
    if len(disease_signs) >= min_signs:
        outcomes.append(RuleOutcome(
            rule_id="multiple_disease_signs",
            parameter="symptom",
            observed_value=", ".join(disease_signs),
            unit=None,
            status="danger",
            threshold_description=f"{min_signs} or more visible disease-type signs → danger",
            explanation="Several visible signs were reported together; arrange a professional inspection promptly.",
            source="Demonstration symptom rule; not a diagnosis",
        ))

    overall: Status = "safe"
    for outcome in outcomes:
        if _SEVERITY[outcome.status] > _SEVERITY[overall]:
            overall = outcome.status
    triggered = [o for o in outcomes if o.status != "safe"]
    return Evaluation(
        overall_status=overall,
        evaluated=outcomes,
        missing_parameters=missing,
        derived=derived,
        next_steps=_next_steps(overall, triggered, missing, symptoms),
        triggered=triggered,
    )


def _next_steps(overall: Status, triggered: list[RuleOutcome], missing: list[str], symptoms: list[str]) -> list[str]:
    steps: list[str] = []
    params = {o.parameter for o in triggered}
    if "dissolved_oxygen_mg_l" in params or "gasping_at_surface" in symptoms:
        steps.append("Run aerators or add fresh, well-oxygenated water if available, and stop feeding until fish recover.")
    if params & {"unionized_ammonia_mg_l", "total_ammonia_mg_l", "nitrite_mg_l"}:
        steps.append("Reduce or pause feeding and re-test ammonia/nitrite within 24 hours; consider a partial water exchange.")
    if "ph" in params:
        steps.append("Re-test pH at dawn and late afternoon; large daily swings often follow dense algal blooms.")
    if "water_temp_c" in params:
        steps.append("Watch fish closely during the hottest and coolest hours; avoid handling or netting.")
    if any(o.rule_id.startswith("symptom_") and o.status != "safe" for o in triggered) or "multiple_disease_signs" in {o.rule_id for o in triggered}:
        steps.append("Record which fish show signs and how many, take clear photos, and contact a fisheries officer. Do not start medication without professional advice.")
    if overall == "danger":
        steps.append("Treat this as urgent: check the pond again within a few hours.")
    if missing:
        steps.append("Not measured: " + ", ".join(missing) + ". Adding these readings makes the check more informative.")
    if overall == "safe" and not missing:
        steps.append("No rule triggered. Continue routine monitoring.")
    elif overall == "safe":
        steps.append("No rule triggered for the values provided. Continue routine monitoring.")
    return steps
