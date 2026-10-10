# Calibration

## What it is (and isn't)

OutfallWatch reports a **0–100 relative turbidity index**, NOT a certified NTU value. The
UI says this everywhere. The index is a two-point linear map between a clear-water
reference and a lightly-clouded reference, measured under consistent container geometry.

## Sensor behaviour

OutfallWatch uses a **DIY LED + photoresistor (LDR)** pair, not a commercial probe. The LED
shines across a water gap and the LDR measures the light that survives.

With the LDR wired on the **high side** of the divider (3V3 → LDR → GPIO1, fixed resistor to
GND — see WIRING.md), the voltage at the ADC **decreases as water gets cloudier**:

| Water | Light reaching LDR | LDR resistance | Voltage at GPIO1 |
| --- | --- | --- | --- |
| Clear | high | low | **high** = `V_clear` |
| Cloudy | low | high | **low** = `V_cloudy` |

So the clear-water voltage is the *high* reference and the cloudy voltage the *low* one, which
is what the formula and the validator below expect. **Swapping the divider legs inverts this**,
makes `span` negative, and the firmware will latch `SENSOR_FAULT` — wire it as documented.

Because this is an optical measurement, **geometry and stray light dominate**. The LED–LDR
spacing must be mechanically fixed and the path light-tight, and the rig must be physically
final *before* you calibrate. Moving the LED, changing the container, or letting room light in
invalidates the references.

## Two things that will invalidate your calibration

**1. Dark correction.** With `SENSOR_LED_PIN` wired, the firmware reports `lit - dark`, not the
raw pin voltage. Calibrate against **that** number — use the dashboard wizard, which stores
exactly what the firmware sends. A multimeter reading of the pin will not match it.

**2. Air is not clean water.** An empty gap passes *more* light than clean water, so a dry rig
produces the highest voltage of all and would otherwise be scored as the cleanest possible
sample. `V_AIR_MIN_MV` is the cut-off above which the firmware reports `AIR_GAP` instead of a
water reading. Measure it with the gap empty and set it just below that value.

The resulting bands, highest voltage first: **AIR_GAP** → **CLEAN** → **MURKY**
(`MURKY_INDEX_MIN` splits the last two).

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

Measured voltage values depend on your LED brightness, LDR, divider resistor, gap width, and
ambient shielding — **there are no "official" calibration numbers**; you must measure your own.
The defaults shipped in `config.example.h` (2700 / 1100 mV) are placeholders from the original
commercial-probe design and carry **no meaning** for an LED/LDR rig.
