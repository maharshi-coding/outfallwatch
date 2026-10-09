# Architecture

## Data flow

```
                 ┌─────────────────────────┐
  ESP32-S3  ───▶ │  POST /api/telemetry     │ ─┐
  (HARDWARE)     │  (X-Device-Key auth)     │  │
                 └─────────────────────────┘  │
                                              ▼
  Simulator  ──▶  ingest_reading()  ──▶  DetectionEngine  ──▶  SQLite
  (SIMULATION)         │ (one path)        (per-device,         (SensorReading,
                       │                    in-memory state)     MonitoringEvent,
                       │                                          Device, …)
                       └──────────────▶  EventBroker  ──▶  SSE /api/events/stream
                                                                    │
                                                                    ▼
                                                            React dashboard

  NOAA / TCEQ / GCOOS / weather  ──▶  providers.py  ──▶  ExternalObservation
                                      (separate table, never fed to the engine)
```

## Key invariants

1. **One canonical telemetry schema** (`schemas.TelemetryIn`) for both HARDWARE and
   SIMULATION. The simulator builds the exact same packet a device POSTs.
2. **One detection engine** (`monitoring/engine.py`), pure and deterministic. It takes
   `(observed_at, turbidity_index, storm_active)` and drives the state machine. Both the
   live backend and the Green AI replay instantiate the same class; the firmware mirrors
   its logic in C++.
3. **Official data is isolated.** `ExternalObservation` is a distinct table. Official
   observations are never silently inserted as a local `SensorReading`.
4. **Everything is labelled** `HARDWARE | SIMULATION | IMPORTED_OFFICIAL | TEST_FIXTURE`.
   Fixtures are never shown as LIVE.
5. **Null ≠ zero.** A missing/invalid sensor value becomes `SENSOR_FAULT` + `null`, never a
   fabricated 0.

## Detection state machine

```
NORMAL ──(Δindex ≥ escalate for ≥15s)──▶ ELEVATED ──(sustained ≥30s)──▶ ALERT
   ▲                                         │                            │
   │                                         └──(Δ ≤ recover for ≥12s)────▶ RECOVERING
   └────────────(sustained recovery ≥12s, event RESOLVED)──────────────────┘

SENSOR_FAULT and STALE/OFFLINE are explicit health states, tracked apart from the
monitoring state (a fault is not a healthy NORMAL, and not a turbidity alert).
```

**Baseline** is established once from the initial calm window, then **frozen** for the
whole event and re-learned only after RESOLVE. This is the fix for the classic failure
where a moving baseline tracks a slow storm ramp and never detects it (see
`tests/test_engine.py::test_baseline_not_learned_during_storm`).

## Real-time events (SSE)

`reading`, `alert`, `simulation`, `device`, plus `heartbeat`/`connected`. The broker
captures the event loop at startup so telemetry ingested in a worker thread (hardware POST
handlers, the simulator's `to_thread` call) can still publish frames.

## Persistence

SQLite via SQLAlchemy 2. `init_db()` runs `create_all` (no Alembic — hackathon scope).
The DB survives restarts. `POST /api/simulation/reset` clears **SIMULATION** rows only;
official/hardware rows are never wiped.

## Why these choices (lazy-by-design)

- SQLite + `create_all`: zero-ops persistence; Alembic would be ceremony for a demo.
- SSE over WebSockets: one-way live push, trivially proxied, no handshake library.
- In-memory SVG map default instead of MapLibre tiles: guarantees the offline demo.
- Deterministic rule engine instead of a NN: honest, testable, and the Green-AI win comes
  from adaptive edge processing, not from inventing "AI".
