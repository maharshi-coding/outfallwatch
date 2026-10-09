# Demo script (≈3 minutes)

Works fully **offline** — no hardware, no internet, no accounts.

## Setup (once, before judging)

```bash
# terminal 1
cd backend && . .venv/bin/activate && uvicorn app.main:app --port 8000
# terminal 2
cd frontend && npm run dev
```
Open <http://localhost:5173>. Confirm the header shows **"Live stream connected"** (green).
If you ran a demo already, click **Data & Settings** is not needed — just press **Reset** in
the Storm Simulator first.

## The run

| Time | Action | What the judge sees |
| --- | --- | --- |
| 0:00 | **Mission Control**, state NORMAL | "Conditions nominal", baseline learned, calm trend, offline coastal map with the simulated demo-outfall pin. |
| 0:20 | Click **Launch Storm Demo** | Live SSE telemetry starts streaming through the real backend. |
| 0:35 | Watch the trend rise | Turbidity climbs above the dashed baseline; storm band shades the chart; state → **ELEVATED** (amber). |
| 0:55 | Sustained rise | State → **ALERT** (red, pulsing). Hero shows an **explainable** alert with the actual index delta and duration. |
| 1:15 | Open **Alerts & Incidents** | The incident with exact thresholds, timestamps, severity, and the recommendation to inspect + sample. Acknowledge it. |
| 1:40 | Open **Green AI Lab** → **Run comparison** | Fixed vs adaptive on the same seed: ~**89% fewer messages**, energy **ESTIMATED**, **0 missed** anomalies, honest methodology + disclaimer. |
| 2:10 | Open **Coastal Conditions** | NOAA/TCEQ official data with source, time, units — all labelled FIXTURE/OFFICIAL, visually separate from sensor data. |
| 2:30 | Open **Data & Settings** | Live integration statuses (WORKING/PARTIAL/UNAVAILABLE/NOT_IMPLEMENTED), threshold + calibration controls that actually persist. |
| 2:50 | Back to **Storm Simulator**, pick **D · Recovery**, Start | Show the full lifecycle resolve: ALERT → RECOVERING → NORMAL, event resolved. |

## Other scenarios to show robustness

- **C · Transient spike** — a brief spike that the persistence filter correctly suppresses
  (no false alert).
- **E · Sensor disconnect** — SENSOR_FAULT health state, no fabricated value.
- **F · Network interruption** — dashboard visibly goes **stale**; the point that local
  firmware keeps its alarms is made verbally (and is true in the firmware logic).

## Fallbacks

- **Frontend won't build/start:** demo the API directly — `./scripts/smoke_test.sh` prints
  the storm → alert → green-AI flow from the backend.
- **Port busy:** change `--port` and `VITE_API_TARGET`.
- **No internet:** everything above still works; NOAA simply shows its labelled fixture.
