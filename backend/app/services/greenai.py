"""Green AI proof: run FIXED-rate vs ADAPTIVE sampling over the SAME seeded
environment and report samples, messages, bytes, detection latency, missed anomalies,
and an explicitly ESTIMATED energy figure (never presented as a measured mW draw)."""
from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone

from app.config import get_settings
from app.monitoring.engine import DetectionEngine, EngineConfig
from app.simulation.scenarios import BASELINE, environment, scenario_length

PACKET_BYTES = 220  # typical telemetry JSON packet, bytes (ESTIMATED, see GREEN_AI.md)

# --- energy model constants. ESTIMATED order-of-magnitude values, NOT measured. ---
E_SAMPLE_MWH = 0.0008   # one ADC+MCU wake-and-read
E_TX_MWH = 0.012        # one Wi-Fi radio-on + POST (dominant cost)
E_IDLE_MWH_PER_S = 0.0002  # light-sleep idle draw per second


def _engine_cfg() -> EngineConfig:
    c = get_settings()
    return EngineConfig(escalate_index_delta=c.escalate_index_delta,
                        escalate_persist_seconds=c.escalate_persist_seconds,
                        recover_index_delta=c.recover_index_delta,
                        recover_persist_seconds=c.recover_persist_seconds,
                        baseline_window=c.baseline_window, median_window=c.median_window)


def _true_onset(env, escalate_delta: float) -> int | None:
    """First virtual second a real sustained anomaly exists (ground truth)."""
    for p in env:
        if p.index is not None and p.storm_active and (p.index - BASELINE) >= escalate_delta:
            return p.t
    return None


def _run_policy(env, *, adaptive: bool, fixed_interval: float,
                normal_interval: float, storm_interval: float,
                heartbeat_every: int, onset: int | None) -> dict:
    cfg = _engine_cfg()
    eng = DetectionEngine(cfg)
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    by_t = {p.t: p for p in env}
    end = scenario_length_from(env)

    t = 0.0
    samples = messages = bytes_tx = 0
    last_state = "NORMAL"
    since_tx = 0
    alert_t: int | None = None

    t0 = time.perf_counter()
    while t <= end:
        p = by_t.get(int(round(t)))
        if p is not None:
            samples += 1
            res = eng.process(observed_at=base + timedelta(seconds=p.t),
                              turbidity_index=p.index, storm_active=p.storm_active)
            since_tx += 1
            state_changed = res.state != last_state
            escalated = res.event_action in ("OPEN", "ESCALATE")
            if escalated and alert_t is None:
                alert_t = p.t
            # transmission policy
            if adaptive:
                send = state_changed or escalated or since_tx >= heartbeat_every
            else:
                send = True  # fixed-rate transmits every sample
            if send:
                messages += 1
                bytes_tx += PACKET_BYTES
                since_tx = 0
            last_state = res.state
            interval = (normal_interval if res.state == "NORMAL" else storm_interval) if adaptive else fixed_interval
        else:
            interval = (normal_interval if last_state == "NORMAL" else storm_interval) if adaptive else fixed_interval
        t += interval
    processing_ms = (time.perf_counter() - t0) * 1000.0

    missed = 1 if (onset is not None and alert_t is None) else 0
    latency = float(alert_t - onset) if (onset is not None and alert_t is not None) else None

    energy = (samples * E_SAMPLE_MWH + messages * E_TX_MWH + end * E_IDLE_MWH_PER_S)
    return {"strategy": "adaptive" if adaptive else "fixed", "samples": samples,
            "messages": messages, "bytes_tx": bytes_tx, "processing_ms": round(processing_ms, 3),
            "alert_latency_seconds": latency, "missed_anomalies": missed,
            "energy_mwh_estimated": round(energy, 4), "energy_kind": "ESTIMATED"}


def scenario_length_from(env) -> int:
    return env[-1].t if env else 0


def compare(scenario: str = "B", seed: int = 42, intensity: float = 1.0) -> dict:
    c = get_settings()
    env = environment(scenario, seed, intensity)
    onset = _true_onset(env, c.escalate_index_delta)
    common = dict(normal_interval=10.0, storm_interval=2.0, heartbeat_every=6, onset=onset)
    fixed = _run_policy(env, adaptive=False, fixed_interval=5.0, **common)
    adaptive = _run_policy(env, adaptive=True, fixed_interval=5.0, **common)

    def pct(a: float, b: float) -> float:
        return round(100.0 * (a - b) / a, 1) if a else 0.0

    return {
        "scenario": scenario, "seed": seed, "intensity": intensity,
        "true_anomaly_onset_s": onset,
        "fixed": fixed, "adaptive": adaptive,
        "reductions_pct": {
            "messages": pct(fixed["messages"], adaptive["messages"]),
            "bytes": pct(fixed["bytes_tx"], adaptive["bytes_tx"]),
            "energy_estimated": pct(fixed["energy_mwh_estimated"], adaptive["energy_mwh_estimated"]),
        },
        "energy_model": {
            "kind": "ESTIMATED",
            "formula": "E = samples*E_sample + messages*E_tx + duration_s*E_idle",
            "constants_mwh": {"E_sample": E_SAMPLE_MWH, "E_tx": E_TX_MWH,
                              "E_idle_per_s": E_IDLE_MWH_PER_S},
            "assumptions": [
                "Wi-Fi radio-on per POST dominates; values are order-of-magnitude, not measured.",
                "No deep-sleep between samples modelled beyond light-sleep idle.",
                "Adaptive samples faster during events, so fewer messages != always less energy — both are reported.",
            ],
            "disclaimer": "Host-side estimate. NOT a measured ESP32 current draw. See docs/GREEN_AI.md.",
        },
    }
