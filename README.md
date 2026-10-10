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
cd backend  && . .venv/bin/activate && pytest        # 19 tests: engine + API + green-ai
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

Tabletop demo only — electronics stay dry. The turbidity input is a **DIY LED + photoresistor**
rig at 3.3 V (no 5 V, no step-down divider). BOM, wiring, and safety:
[`docs/HARDWARE.md`](docs/HARDWARE.md), [`docs/WIRING.md`](docs/WIRING.md),
[`docs/CALIBRATION.md`](docs/CALIBRATION.md), [`docs/FREENOVE_INTEGRATION.md`](docs/FREENOVE_INTEGRATION.md).

### Bringing the board up on a different laptop

The quick start above needs **no hardware**. To stream from a real ESP32-S3 instead, the board
posts over Wi-Fi to *your* machine, so three things must match your network:

```bash
# 1. Backend must listen on the LAN, not just localhost
cd backend && . .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 2. Find your machine's LAN IP
ipconfig getifaddr en0          # macOS
hostname -I | awk '{print $1}'  # Linux

# 3. Point the firmware at it, then flash
cd firmware
cp include/config.example.h include/config.h
#   edit config.h: WIFI_SSID / WIFI_PASSWORD / SERVER_URL=http://<YOUR_LAN_IP>:8000/api/telemetry
export PATH="$HOME/.platformio/penv/bin:$PATH"   # if `pio` is not on PATH
pio run -t upload
pio device monitor                                # expect: idx=.. base=.. state=.. msgs=.. buf=..
```

`msgs` incrementing means POSTs are succeeding. Then confirm the rows actually landed — this is
the check that catches silent drops, because serial and device status can both look healthy
while nothing is stored:

```bash
sqlite3 backend/outfallwatch.db \
  "SELECT COUNT(*) FROM sensor_readings WHERE device_id='outfallwatch-esp32-01';"
```

**Gotchas that will cost you an hour each:**

- **The ESP32-S3 is 2.4 GHz only.** It cannot see a 5 GHz network. On an iPhone hotspot turn on
  *Maximize Compatibility*; on Android set the AP band to 2.4 GHz.
- **`SERVER_URL` is compiled into the firmware.** If your laptop's IP changes, reflash.
- **Firewall**: inbound TCP 8000 must be allowed, and both devices on the same network.
- **The heartbeat must stay under `stale_after_seconds`** (30 s). `HEARTBEAT_EVERY ×
  NORMAL_INTERVAL_MS` is currently 2 × 10 s = 20 s. Raise the heartbeat above 30 s and a healthy
  board flaps ONLINE/STALE.
- **Only one program can hold the serial port** — close VS Code's monitor before `pio device
  monitor`, and vice versa.
- WPA2-Enterprise networks (campus Wi-Fi) will **not** work; the firmware does WPA2-Personal.

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
