# OutfallWatch — Project Overview

A tour of the web app (what each page showcases and where **live hardware data** appears)
and the full tech stack. Useful for the DevPost "How we built it" section and for the demo.

## The core idea — one pipeline

Everything flows through a single path. Whether a reading comes from the **simulator** or the
real **ESP32**, it hits the same `POST /api/telemetry` → detection engine → database → live
SSE stream. Every record is tagged `HARDWARE` or `SIMULATION`, and a **device selector** (on
Mission Control & Live Monitoring) switches which one the charts show. When the ESP32 connects
it is **auto-selected**, so those pages flip to live hardware data with no extra steps.

Legend: 🟢 live **hardware** data · 🔵 live **external** data (NOAA/GCOOS) · 🟡 simulator/analysis · ⚪ config

## The 7 pages

### 1. Mission Control (`/`) — 🟢 hardware
The hero dashboard: state headline (NORMAL/ELEVATED/ALERT), turbidity **gauge**, stat tiles
(index, baseline, temp, active alerts), the **telemetry trend chart**, the **coastal map** with
a state-coloured sensor pin, the active-alert card, and a Green-AI snapshot.
→ *With hardware:* gauge, stats, trend, map pin, and alert card show the real ESP32 readings.

### 2. Live Monitoring (`/live`) — 🟢 hardware
The dedicated sensor view: live gauge + trend, **raw analog mV**, relative index, water temp
(simulation only — no probe fitted on the hardware), conductivity (if fitted),
sensor-health state, sampling interval, quality flags.
→ *With hardware:* the primary page for the real probe — including "Unavailable" for unwired
sensors and SENSOR_FAULT for bad reads (never a fabricated 0).

### 3. Storm Simulator (`/simulator`) — 🟡 simulator
Controls the **virtual** device: scenario A–F dropdown, intensity/speed sliders, Start/Stop/
Reset, progress bar, live chart + gauge. The no-hardware demo and the venue fallback.
→ *With hardware:* stays the simulator (drives the synthetic generator); use Live Monitoring
for the real sensor.

### 4. Alerts & Incidents (`/alerts`) — 🟢 hardware
The incident timeline: every ELEVATED/ALERT event with explanation, exact thresholds,
timestamps, severity, and an acknowledge action — each tagged HARDWARE or SIMULATION.
→ *With hardware:* real alerts the ESP32 triggers appear here, labelled HARDWARE.

### 5. Green AI Lab (`/green-ai`) — 🟡 analysis
The fixed-vs-adaptive efficiency comparison (messages/samples/bytes/energy saved), the energy
methodology, and the honest CodeCarbon / on-device-TinyML status cards.
→ *With hardware:* runs on the reproducible **seeded replay** (a benchmark, not a live feed);
the firmware uses the same adaptive policy this measures.

### 6. Coastal Conditions (`/coastal`) — 🔵 external live
Official context: **NOAA** real-time + historical water levels, and **GCOOS** (Conrad Blucher
Institute) oceanographic / water-quality readings — with source, time, and units.
→ *With hardware:* live **official** data (independent of the prototype sensor), kept
deliberately separate from the prototype readings.

### 7. Data & Settings (`/data-sources`) — ⚪ config (🔵 live statuses)
Live integration statuses (NOAA/GCOOS), the detection-threshold editor, and the two-point
calibration wizard.
→ *With hardware:* where you set **calibration** (V_clear/V_cloudy) and thresholds that shape
how real readings are interpreted.

## Where live hardware data shows up

| Page | On hardware integration |
| --- | --- |
| Mission Control, Live Monitoring, Alerts | 🟢 real ESP32 data |
| Coastal Conditions | 🔵 live NOAA/GCOOS (not the sensor) |
| Storm Simulator, Green AI Lab | 🟡 simulator / benchmark |
| Data & Settings | ⚪ config + 🔵 live statuses |

## Tech stack

**Frontend**
- React 18 + TypeScript (strict), Vite (build/dev)
- Tailwind CSS + shadcn-style components on Radix UI primitives (`class-variance-authority`,
  `clsx`/`tailwind-merge`)
- Apache ECharts (gauge, telemetry, comparison bars)
- MapLibre GL JS (interactive dark map, ESRI tiles) + SVG fallback for offline
- Motion (framer-motion) animations · Zustand state · React Router · lucide-react icons
- Vitest + Testing Library

**Backend**
- Python / FastAPI, Pydantic v2 validation, pydantic-settings
- SQLAlchemy 2 + SQLite persistence
- SSE (`sse-starlette`) live push, with REST polling fallback
- httpx for external APIs · Uvicorn ASGI server · pytest (19 tests)

**Firmware**
- ESP32-S3 in C++ (Arduino framework), PlatformIO build
- ArduinoJson v7 · Wi-Fi HTTP telemetry

**Data sources:** NOAA Tides & Currents API · GCOOS ERDDAP

**Deploy / infra:** Docker (multi-stage) · Render (hosting) · Cloudflare Tunnel (local public
link) · single-origin serving (FastAPI serves the built React app)

**Architecture highlights:** one shared deterministic detection engine (backend + firmware
mirror it) · one canonical telemetry schema for hardware + sim · device-agnostic ingestion
with the HARDWARE/SIMULATION selector.
