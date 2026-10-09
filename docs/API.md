# API

Base URL: `http://localhost:8000`. Interactive docs at `/docs` (Swagger UI).
All bodies are JSON. Timestamps are ISO-8601 UTC.

## Auth

Only `POST /api/telemetry` is authenticated, via header `X-Device-Key` (must equal the
backend `DEVICE_API_KEY`, default `demo-device-key`). This is a **simplified local-demo**
auth; a real deployment would issue per-device keys and restrict admin routes. No secrets
ship in the frontend bundle.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | liveness |
| GET | `/api/devices` | list devices |
| GET | `/api/devices/{id}` | one device |
| GET | `/api/devices/{id}/status` | device + stale flag |
| GET | `/api/devices/{id}/readings?limit=` | recent readings (oldest→newest) |
| POST | `/api/telemetry` | **ingest a reading** (auth) |
| GET | `/api/monitoring/overview` | dashboard summary |
| GET | `/api/monitoring/timeseries?device_id=&minutes=` | chart data |
| GET | `/api/alerts?state=` | incidents |
| GET | `/api/alerts/{id}` | one incident |
| POST | `/api/alerts/{id}/acknowledge` | acknowledge |
| GET/POST | `/api/calibrations` | list / create calibration |
| GET/PATCH | `/api/configuration` | thresholds (hysteresis enforced) |
| GET | `/api/energy/summary` | recent efficiency runs |
| POST | `/api/energy/compare` | run fixed-vs-adaptive comparison |
| POST | `/api/simulation/{start,stop,reset}` · GET `/status` | simulator control |
| GET | `/api/integrations/status` | NOAA/TCEQ/GCOOS/weather/firmware/TinyML/CodeCarbon |
| POST | `/api/integrations/refresh` | re-fetch external sources |
| GET | `/api/external-observations?provider=` | official data |
| GET | `/api/events/stream` | **SSE** live events |

## Telemetry ingestion

```bash
curl -X POST http://localhost:8000/api/telemetry \
  -H 'content-type: application/json' -H 'X-Device-Key: demo-device-key' \
  -d '{
        "reading_id": "r-123", "device_id": "outfallwatch-esp32-01",
        "observed_at": "2026-10-09T18:00:00Z", "source": "HARDWARE",
        "turbidity_raw_mv": 2150, "turbidity_index": 44,
        "temperature_c": 25.1, "conductivity_us_cm": null,
        "calibration_id": "cal-01", "storm_active": false,
        "sample_interval_seconds": 10, "quality_flags": []
      }'
# -> {"accepted": true, "reading_id": "r-123", "mode": "NORMAL", "event_id": null}
```

If `turbidity_index` is omitted but `turbidity_raw_mv` + a valid calibration exist, the
index is computed server-side. Missing both → `null` + `NO_CALIBRATION` flag (treated as a
sensor fault, never a 0).

## Validation & errors

- Pydantic enforces ranges: index 0–100, raw mV 0–5000, temp −5…60 °C, conductivity
  0–200000 µS/cm. Out-of-range → `422`.
- `source` must be `HARDWARE` or `SIMULATION`.
- Bad `X-Device-Key` → `401`. Unknown id → `404`.
- Calibration: `v_clear_mv` must exceed `v_cloudy_mv` by ≥50 mV → else `422`.
- Configuration PATCH: `recover_index_delta` must stay below `escalate_index_delta`
  (hysteresis) → else `422`.

## SSE

```js
const es = new EventSource("/api/events/stream");
es.onmessage = (m) => console.log(JSON.parse(m.data));
// frames: {type:"reading"|"alert"|"simulation"|"device"|"heartbeat"|"connected", data:{…}}
```
A `heartbeat` is sent every ~15 s so clients can detect a dead stream; reconnect is the
browser's native `EventSource` retry.
