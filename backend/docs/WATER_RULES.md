# Water-quality and symptom rules

Code: [app/services/water_rules.py](../app/services/water_rules.py). Thresholds:
[app/config_data/water_thresholds.json](../app/config_data/water_thresholds.json) (profile
`generic_warm_water_demo_v1`).

## Status of the thresholds

**Demonstration settings, not validated.** The bands are informed by commonly cited general
ranges for warm-water pond aquaculture (e.g. C.E. Boyd, *Water Quality in Ponds for Aquaculture*,
1990). The exact numbers have **not** been checked against a specific published table for any
species, nor for brackish/shrimp culture or coastal Karnataka conditions. A qualified fisheries
professional must review them before real use. Every water-check response reports the profile
with `status: demonstration_settings` and `validated: false`.

| Parameter | Unit | Danger | Watch | Safe |
|---|---|---|---|---|
| pH | pH units | < 6.0 or ≥ 9.5 | 6.0–6.5 or 9.0–9.5 | 6.5–9.0 |
| Water temperature | °C | < 20 or ≥ 34 | 20–25 or 32–34 | 25–32 |
| Dissolved oxygen | mg/L | < 3 | 3–5 | ≥ 5 |
| Un-ionised ammonia (derived) | mg/L NH3-N | ≥ 0.2 | 0.05–0.2 | < 0.05 |
| Total ammonia N (fallback) | mg/L TAN-N | ≥ 2 | 1–2 | < 1 |
| Nitrite | mg/L NO2-N | ≥ 1 | 0.3–1 | < 0.3 |

Band lower bounds are inclusive and upper bounds exclusive. The loader rejects profiles whose
bands are not contiguous and open-ended, and rejects unvalidated profiles that are not labelled
`demonstration_settings`.

### Ammonia

When TAN, pH and temperature are all present, the toxic un-ionised fraction comes from
Emerson et al. (1975):
`pKa = 0.09018 + 2729.92 / (T + 273.15)`, `f = 1 / (1 + 10^(pKa − pH))`, `NH3-N = TAN · f`.
(Check: ≈ 0.57 % at pH 7.0 / 25 °C.) If pH or temperature is missing, a coarse TAN fallback band
is used and the explanation says so.

## Symptoms

Gasping at the surface and abnormal mortality map to **danger**. Behaviour signs (reduced feeding,
lethargy, erratic swimming) and visible signs (red patches/lesions, white spots, fin/tail rot,
cotton-like growth, bloated abdomen) map to **watch**. Two or more visible signs together map to
**danger**. Symptom rules never name a disease. Every response includes a referral to a fisheries
officer, and the next steps say not to start medication without professional advice.

## Missing data

Unmeasured parameters are listed in `missing_parameters` and mentioned in `next_steps`. A request
with neither a measurement nor a symptom is rejected (422).
