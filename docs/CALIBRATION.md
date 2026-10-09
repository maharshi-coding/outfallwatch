# Calibration

## What it is (and isn't)

OutfallWatch reports a **0–100 relative turbidity index**, NOT a certified NTU value. The
UI says this everywhere. The index is a two-point linear map between a clear-water
reference and a lightly-clouded reference, measured under consistent container geometry.

## Sensor behaviour

For common modules (e.g. SEN0189) the analog output **decreases as water gets cloudier**.
So the clear-water voltage is the *high* reference and the cloudy voltage is the *low* one.

## Formula

```
relative_turbidity_index = clamp( 100 × (V_clear − V_current) / (V_clear − V_cloudy), 0, 100 )
```

- At `V_current = V_clear` → index 0 (clear).
- At `V_current = V_cloudy` → index 100 (cloudy reference).
- Implemented identically in backend (`monitoring/engine.calibrated_index`) and firmware
  (`toIndex`).

## Procedure

1. Fill the test container with **clear** water; let the reading settle; record `V_clear`.
2. Stir in a small, safe amount of clay/soil to a repeatable "cloudy" reference; record
   `V_cloudy`.
3. Enter both in the dashboard **Data & Settings → Turbidity calibration**, or POST to
   `/api/calibrations`, or set `V_CLEAR_MV`/`V_CLOUDY_MV` in firmware `config.h`.

## Validation (enforced)

- `V_clear` must exceed `V_cloudy` (correct polarity) — rejected otherwise.
- Separation `V_clear − V_cloudy` must be ≥ 50 mV (meaningful span) — rejected otherwise.
- Stored with id, method, timestamp, and references (`Calibration` entity).

Measured voltage values depend on your sensor, divider, and geometry — **there are no
"official" calibration numbers**; you must measure your own.
