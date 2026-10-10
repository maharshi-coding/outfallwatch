# Limitations

OutfallWatch is a **change-detection and triage aid**, not a water-quality laboratory.
Stated plainly so judges and future users are never misled.

## Scientific limits

- Turbidity, temperature, and conductivity indicate **changing conditions** only. They
  **cannot** identify specific chemicals, bacteria, toxins, pathogens, contamination
  sources, regulatory violations, or recreational safety.
- An alert means **"conditions warrant closer investigation and appropriate sampling,"**
  nothing more. The UI never says water is toxic, clean, or safe.
- Temporal correlation with rain does **not** prove causation; the system never claims a
  rain event *caused* an anomaly.
- The turbidity value is a **0–100 relative index**, not a certified NTU measurement.
- The sensor is a **DIY LED + photoresistor pair**, not a calibrated turbidity probe. It
  measures how much light crosses a water gap, which is affected by stray light, LED output
  drift, LDR temperature sensitivity, bubbles, biofouling on the optical surfaces, and any
  change in LED–LDR geometry. It is a **demonstration-grade optical substitute** and is
  further from NTU than a commercial probe would be.
- Flow rate from the turbine input is **not implemented** — no pin is read and no flow value
  is transmitted or displayed.

## Technical limits

- **False alarms / misses** are possible: thresholds are demonstration defaults, not
  field-validated; sediment plumes, sensor drift, and fouling all affect readings.
- Baseline is frozen during an event and re-learned after recovery; very slow legitimate
  drift during a long event is not tracked (re-establishes afterward).
- Single-process backend; the SSE broker is in-memory (one worker). Scaling needs a shared
  bus (noted in code).
- SQLite + `create_all`, no migrations — fine for a demo, not for production schema changes.

## Hardware limits

- Firmware is **not flash-verified** (no board/PlatformIO in the build env). Board variant
  and GPIOs are unverified — see FREENOVE_INTEGRATION.md.
- Tabletop only. No waterproof enclosure, no field power, no deployment claims.

## Data/integration limits

- External data is scoped to **NOAA** (water levels) and **GCOOS** (oceanographic + water
  quality); both fetch live and fall back to labelled fixtures offline.
- **GCOOS** shows the latest **non-null** value per metric from station CBI_042, so a metric
  that station isn't currently reporting simply won't appear (never fabricated).
- Official observations are context, not measurements of the demo outfall.

## Map

- The coastal map is an **offline SVG schematic, not to scale**, chosen so the demo never
  depends on a tile server. MapLibre GL JS with real tiles is the online upgrade path; it
  is intentionally not the default because judging may be offline.

## Green AI

- Energy numbers are **ESTIMATED** from a documented model, not measured. A real figure
  requires a hardware power meter. CodeCarbon (host-only) was not executed here.

## Before any operational use

Calibrated field validation, waterproofing, power budgeting, security hardening of
ingestion/admin endpoints, and corroboration against accredited laboratory sampling.
