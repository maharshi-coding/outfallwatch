# OutfallWatch — Detect Change. Protect the Coast.

**Low-power coastal runoff change-detection & early-warning system.**
IslanderHack · Corpus Christi, TX · *Green AI & Resource Efficiency* track · Topic: Coastal Conservation.

### 🔗 Live demo
**https://outfallwatch.onrender.com** — open it and click **Launch Storm Demo**.

> Hosted on Render's free tier: the first visit after it's been idle may take ~50 s to wake up — give it a moment.
> For the in-person demo with real ESP32 hardware on the same Wi-Fi, run a local tunnel instead (see
> [docs/DEPLOY.md](docs/DEPLOY.md)).

OutfallWatch watches stormwater outfalls for **sustained change** in water conditions
(turbidity, temperature, optional conductivity) using a cheap ESP32-S3 sensor node that
makes alert decisions **at the edge** — even with Wi-Fi down — and transmits **adaptively**
to save energy. A FastAPI backend stores telemetry, runs the authoritative state machine,
and streams live updates to a mission-control dashboard. A fully offline, seeded storm
**simulator** drives the entire pipeline with no hardware and no internet.

> **Scientific boundary:** turbidity/temperature/conductivity indicate *changing conditions*.
> They **cannot** identify chemicals, bacteria, contamination sources, or whether water is
> safe. An alert means *"conditions warrant closer investigation and sampling."*

---

## Quick start (offline demo — no hardware, no internet)

### Backend
```bash
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload      # http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
npm run dev                                     # http://localhost:5173
```

Open the dashboard and click **Launch Storm Demo**. Watch NORMAL → ELEVATED → ALERT →
recovery with an explainable alert — all driven by the real backend.

Or run both at once: `./scripts/run_dev.sh`

### Tests
```bash
cd backend  && . .venv/bin/activate && pytest        # 18 tests: engine + API + green-ai
cd frontend && npm run test                          # component labelling tests
cd frontend && npm run build                          # type-check + production build
```

---

## What's in the box

| Area | Status | Notes |
| --- | --- | --- |
| FastAPI backend + SQLite + SSE | **WORKING** | one ingestion path for hardware & simulation |
| Deterministic detection engine | **WORKING** | shared by firmware & backend; 18 tests |
| Offline storm simulator (6 scenarios) | **WORKING** | seeded, runs the real pipeline |
| React/TS mission-control dashboard | **WORKING** | 7 pages, live SSE, offline-safe map |
| Green AI fixed-vs-adaptive lab | **WORKING** | reproducible, honest ESTIMATED energy |
| NOAA Tides & Currents (water levels) | **WORKING** | live real-time + historical; station 8775296 (Corpus Christi Bay); fixture fallback offline |
| GCOOS (oceanographic + water quality) | **WORKING** | live ERDDAP CBI_042 (temp, salinity, …); fixture fallback offline |
| ESP32-S3 firmware | **PARTIAL** | full source + wiring; **compiles clean** (PlatformIO); not flash-verified (no board) |
| CodeCarbon (Green AI) | **WORKING** | real host benchmark (≈49.5 mWh / 23.6 mg CO₂, M2); shown in Green AI Lab |
| TFLM / ESP-NN (on-device NN) | **DESIGN DECISION** | deterministic edge engine by choice; see docs/GREEN_AI.md |

> External coastal data is scoped to **NOAA + GCOOS** by request; other resource adapters
> (TCEQ, Open-Meteo, GBIF, iNaturalist, NASA, OpenWeatherMap) were removed.

Full, continuously-updated truth table: [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md)
and [`docs/RESOURCE_INTEGRATION_MATRIX.md`](docs/RESOURCE_INTEGRATION_MATRIX.md).

---

## Architecture (one line)

`sensor / simulator → canonical telemetry → FastAPI validate → shared state machine →
SQLite + SSE → React dashboard`, with **official** coastal data kept in a separate
`ExternalObservation` table and never blended into sensor readings. Every record is
labelled `HARDWARE`, `SIMULATION`, `IMPORTED_OFFICIAL`, or `TEST_FIXTURE`.

Details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · API: [`docs/API.md`](docs/API.md) · Page-by-page tour + tech stack: [`docs/OVERVIEW.md`](docs/OVERVIEW.md)

## Hardware

Tabletop demo only — electronics stay dry, USB-powered. BOM, voltage divider, and safety:
[`docs/HARDWARE.md`](docs/HARDWARE.md), [`docs/WIRING.md`](docs/WIRING.md),
[`docs/CALIBRATION.md`](docs/CALIBRATION.md), [`docs/FREENOVE_INTEGRATION.md`](docs/FREENOVE_INTEGRATION.md).

## Limitations

What OutfallWatch deliberately does **not** claim: [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).

## Demo & presentation

3-minute script + offline fallbacks: [`docs/DEMO.md`](docs/DEMO.md) ·
[`docs/PRESENTATION.md`](docs/PRESENTATION.md).

---

## Team Skilos

Built together at IslanderHack 2026.

| Member | Role |
| --- | --- |
| **Maharshi Kamleshkumar Barot** ([@maharshi-coding](https://github.com/maharshi-coding)) | Software — full stack: FastAPI backend, detection engine, React dashboard, firmware integration, deploy |
| **Ratli2099** ([@Ratli2099](https://github.com/Ratli2099)) | Research & hardware |
| **David I** ([@David-Iglesias2022](https://github.com/David-Iglesias2022)) | Research & hardware |
| _4th member — to be added_ | _TBD_ |

---

Monorepo layout: `backend/`, `frontend/`, `firmware/`, `datasets/`, `docs/`, `scripts/`.
