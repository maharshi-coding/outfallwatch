# Implementation status

Last updated: 2026-10-09. Truth over optimism — code, runtime, and tests are the evidence.

## Environment verified

- node v22.23.2, npm 10.9.8, Python 3.14.6 — confirmed.
- PlatformIO installed → **firmware compiles clean** for esp32-s3-devkitc-1 (SUCCESS, firmware.bin 874 KB).
- **Flash-verified 2026-10-09 on a real Freenove ESP32-S3-WROOM (CAM variant)**: uploaded over the
  CH343 UART bridge (`/dev/cu.usbmodem*`, VID 1A86:55D3) at 921600 baud, hash verified, boots and
  runs. Serial @115200 confirmed: baseline established after 12 samples (`base=100.0`), bounded
  offline queue increments on the 6-sample heartbeat (`buf` 1→2→3) while Wi-Fi is unconfigured.
  RAM 14.7%, Flash 26.8%.
- **End-to-end HARDWARE telemetry verified 2026-10-09**: board joined a 2.4 GHz WPA2 hotspot and
  POSTed to the backend over LAN HTTP. Serial showed `msgs` 3→4→5 at the 60s heartbeat cadence
  with `buf=0`, and the queued offline reading flushed on reconnect. `GET /api/devices` lists
  `outfallwatch-esp32-01` as `source: HARDWARE`, `connection_status: ONLINE`; readings persist with
  `source: HARDWARE` and `temperature_c: null` (no probe → null, never a fabricated 0).
  Note: ESP32-S3 is **2.4 GHz only** — a 5 GHz-only AP fails silently at `WiFi.begin()`.
- **Config invariant**: the firmware heartbeat (`HEARTBEAT_EVERY` × `NORMAL_INTERVAL_MS`) must stay
  **under** the backend's `stale_after_seconds` (30s), or a perfectly healthy board flaps
  ONLINE→STALE between heartbeats. Observed and fixed 2026-10-09: 6×10s=60s heartbeat flapped every
  cycle; `HEARTBEAT_EVERY` lowered to 2 (20s heartbeat) → 0 STALE across 10 polls / 72s. The
  firmware's `msgCount`/`byteCount` are serial-only and never enter the packet, so heartbeat rate
  does not affect the Green AI figures (those come from seeded replays).
- **Fixed 2026-10-09 — `reading_id` collision across reboots.** `readingSeq` restarts at 0 on every
  boot, and the backend treats `reading_id` as the PK and skips rows it already has
  (`ingestion.py`, "idempotent on reading_id"). So after any power cycle the board re-emitted IDs
  that already existed and they were **silently dropped** — while `device.last_seen` still updated
  on that path, so the dashboard showed ONLINE / "updated just now" with a frozen chart, and serial
  showed `msgs` climbing. Observed live: device ONLINE, last_seen 11s ago, newest stored reading
  11.5 minutes old. The dead window scaled with row count (22 rows ≈ 7 min; an hour of uptime
  ≈ an hour of silence). Fix: a per-boot `esp_random()` nonce in the id
  (`outfallwatch-esp32-01-0c659f1f-1`), which keeps retry-idempotency *within* a boot while making
  readings from different boots distinct. Verified: post-reboot rows stored immediately, +1 per 20s.
- Unplugging USB cuts **power**, not just telemetry — it is a device-death test (→ STALE after 30s),
  not an offline-buffer test. To exercise the buffer/flush path, drop Wi-Fi with the board powered.
- **Hardware design finalised 2026-10-09 — DIY optical sensor, not a commercial probe.** The
  turbidity input is an **LED + photoresistor** pair on GPIO1 running at 3.3 V (no 5 V, no
  step-down divider). Wiring the LDR on the high side preserves the firmware's required
  `V_CLEAR > V_CLOUDY` polarity, so **no firmware change was needed**. HARDWARE.md, WIRING.md,
  CALIBRATION.md and LIMITATIONS.md updated to match; the `DIVIDER_R_*` constants are now
  explicitly documented as unused. Power is a USB power bank (untethered run verified).
- **IMPLEMENTED (code-complete, hardware-unverified) — flow-gated optical subsystem.** The
  turbine reading on `FLOW_ADC_PIN` gates the LED + photoresistor measurement: above
  `FLOW_TRIGGER_MV` the firmware pulses the LED, takes a dark reference, reads lit, uses
  `lit - dark` to cancel ambient light, classifies the water, and reports. Below it the LED
  and indicators go off and a `NO_FLOW` heartbeat is sent with a **null** index.
  - Water condition rides in the existing `quality_flags` list (`CLEAN` / `MURKY` / `AIR_GAP`
    / `NO_FLOW`), so **no schema, model, or DB migration was needed**.
  - `AIR_GAP` is a distinct band because an empty gap passes *more* light than clean water and
    would otherwise score as the cleanest possible sample.
  - Backend: `DetectionEngine.process(idle=...)` adds health **IDLE**, checked before the
    fault branch so an expected null is never reported as a broken sensor, and clearing the
    persistence timers so a dry gap cannot accumulate toward an escalation. 2 tests added
    (21 passing).
  - UI: condition badge, plain-language condition row, and capture time in Live Monitoring.
  - **Both pins default to `-1` (disabled)**, preserving the verified always-on behaviour, so
    the currently-running board is unaffected until the motor and LED are wired.
  - **Unverified on hardware**: no turbine, LED, or LDR is connected yet, so
    `FLOW_TRIGGER_MV`, `V_AIR_MIN_MV`, `MURKY_INDEX_MIN` and the calibration references are
    all untuned placeholders. Compiles clean with the gate both enabled and disabled.
- Hardware alert path caveat: with GPIO1 unwired the index clamps to 100, so the baseline settles at
  the ceiling and escalation (+30) is unreachable — the board **cannot** alert until a sensor or a
  pot/jumper on GPIO1 lets the baseline establish low and then rise.
- Still physically unverified: no sensor wired to GPIO1 (floating input reads ~10–24 mV of noise
  → index clamps to 100, as designed), LEDs/buzzer not observed, and no real turbidity calibration (`V_CLEAR_MV`/`V_CLOUDY_MV` still at
  template defaults, so the index carries no physical meaning yet).

## Tested commands & results

| Command | Result |
| --- | --- |
| `backend: pytest` | **19 passed** (engine lifecycle, API, calibration, integrations incl. biodiversity caveats, green-ai). |
| `frontend: npm run build` | **passed** — `tsc --noEmit` clean, Vite production build ok. |
| `frontend: npm run test` | **2 passed** — status/source labelling. |
| `uvicorn app.main:app` + browser | **verified** — Launch Storm Demo drove NORMAL→ELEVATED→ALERT live via SSE; baseline 21, index 71, explainable alert. |
| `POST /api/energy/compare {B,42}` | **verified** — fixed 45 msgs vs adaptive 5 (88.9% fewer), 0 missed, energy ESTIMATED. |
| SSE stream capture during sim | **verified** — `reading`×30, `alert`×2, `simulation`×1 frames delivered. |
| `GET /api/integrations/status` | **verified** — scope is NOAA + GCOOS only. |
| `POST /api/integrations/refresh` (live) | **verified** — NOAA WORKING (240→25 hourly water levels) and GCOOS WORKING (temp + salinity, CBI_042). |

## Feature status

| Feature | Status | Evidence |
| --- | --- | --- |
| FastAPI + SQLite + SSE | **WORKING** | server boots, persists, streams. |
| Canonical telemetry + ingestion (1 path) | **WORKING** | hardware POST & simulator share `ingest_reading`. |
| Detection engine (states, hysteresis, fault, baseline freeze) | **WORKING** | `test_engine.py` 10 tests. |
| Offline simulator, 6 scenarios, start/stop/reset | **WORKING** | browser + API verified; reset keeps official data. |
| React dashboard, 7 pages, live SSE, offline map | **WORKING** | browser-verified render + interaction. |
| Green AI fixed-vs-adaptive + ESTIMATED energy | **WORKING** | reproducible, labelled. |
| Calibration (compute + validation) & config (hysteresis) | **WORKING** | API tests + UI forms persist. |
| NOAA water levels | **WORKING** | live real-time + historical (24 h hourly) verified; station 8775296; fixture fallback offline. |
| GCOOS oceanographic/WQ | **WORKING** | live ERDDAP CBI_042 verified (temp 29.4 °C, salinity 27.9 PSU); fixture fallback offline. |
| _(removed by request)_ | — | TCEQ, Open-Meteo, GBIF, iNaturalist, NASA Earthdata, OpenWeatherMap deleted. |
| ESP32-S3 firmware | **WORKING** (unwired) | compiles clean; **flashed, booted and streaming HARDWARE telemetry** from a real Freenove ESP32-S3-WROOM CAM to the backend over Wi-Fi; detection, baseline, bounded offline queue and reconnect-flush all verified. Sensor/indicator wiring + turbidity calibration still unverified. |
| CodeCarbon | **WORKING** | ran 50k-replay host benchmark; measured ≈49.5 mWh / 23.6 mg CO₂ (M2, ESTIMATED); served at `/api/energy/codecarbon`, shown in Green AI Lab. |
| TFLM / ESP-NN | **NOT_IMPLEMENTED** | no NN deployed; honest. |

## Known gaps / blockers

- **Firmware** needs a real Freenove board + PlatformIO to compile, flash, and verify pins,
  ADC range, and on-water behaviour (FREENOVE_INTEGRATION.md).
- **TCEQ → WORKING** needs a real SWQM export dropped into the fixtures path.
- **NOAA** shows live data only with internet.
- **GCOOS/Weather** need a verified dataset URL / API key respectively.
- **CodeCarbon** benchmark run; re-run `scripts/benchmark_codecarbon.py` to refresh the committed result.

## Remaining next steps (priority order)

1. (done) Flashed, booted and streaming real HARDWARE telemetry to the backend over Wi-Fi.
   Remaining: wire the turbidity sensor to GPIO1 and run the calibration wizard to set
   `V_CLEAR_MV`/`V_CLOUDY_MV`; confirm LEDs/buzzer physically; reconcile pins verified vs assumed.
2. Replace the TCEQ fixture with an authentic export; flip status to WORKING.
3. (done) CodeCarbon host benchmark run; measured figures in GREEN_AI.md + Green AI Lab.
4. Wire a verified GCOOS ERDDAP series.
5. (Stretch) train/quantize/deploy a small TinyML model and benchmark vs the rule engine.
