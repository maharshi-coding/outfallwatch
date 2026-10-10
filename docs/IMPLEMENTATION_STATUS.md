# Implementation status

Last updated: 2026-10-09. Truth over optimism — code, runtime, and tests are the evidence.

## Environment verified

- node v22.23.2, npm 10.9.8, Python 3.14.6 — confirmed.
- PlatformIO installed → **firmware compiles clean** for esp32-s3-devkitc-1 (SUCCESS, 0 warnings, firmware.bin 874 KB). Not flashed (no board).
- No ESP32-S3 board present → no physical sensor tests.

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
| ESP32-S3 firmware | **PARTIAL** | full source + wiring; **compiles clean** (PlatformIO); not flash-verified (no board). |
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

1. Flash firmware on the actual board; reconcile pins; record verified vs assumed.
2. Replace the TCEQ fixture with an authentic export; flip status to WORKING.
3. (done) CodeCarbon host benchmark run; measured figures in GREEN_AI.md + Green AI Lab.
4. Wire a verified GCOOS ERDDAP series.
5. (Stretch) train/quantize/deploy a small TinyML model and benchmark vs the rule engine.
