"""The single deterministic detection engine shared by hardware telemetry and the
simulator. Pure logic: feed it readings in time order, it drives the state machine
and tells the caller when to open / escalate / resolve an event. No DB, no clock of
its own — timestamps come from the reading, so a seeded replay is fully deterministic.

States:  NORMAL -> ELEVATED -> ALERT -> RECOVERING -> NORMAL
Health:  OK | IDLE | SENSOR_FAULT   (health is tracked separately from monitoring state)
         IDLE = the flow gate reports no water to measure, so the optical subsystem did
         not run. That is a healthy resting state, NOT a sensor fault and NOT a clean
         reading — no value is invented for it.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from statistics import median


@dataclass
class EngineConfig:
    baseline_window: int = 12
    median_window: int = 5
    escalate_index_delta: float = 30.0
    escalate_persist_seconds: float = 15.0
    recover_index_delta: float = 15.0
    recover_persist_seconds: float = 12.0
    # ALERT is reached when the ELEVATED condition holds this many times longer.
    alert_persist_multiplier: float = 2.0

    def __post_init__(self) -> None:
        # Hysteresis must hold or recovery races escalation.
        if self.recover_index_delta >= self.escalate_index_delta:
            raise ValueError("recover_index_delta must be below escalate_index_delta (hysteresis)")


@dataclass
class DetectionResult:
    observed_at: datetime
    state: str
    health: str
    smoothed_index: float | None
    baseline: float | None
    delta: float | None
    event_action: str | None  # OPEN | ESCALATE | RESOLVE | None
    severity: str | None
    explanation: str
    recommendation: str
    storm_active: bool


RECOMMENDATION = (
    "Inspect the site and consider collecting a field sample for laboratory testing. "
    "This system detects change only; it does not identify pollutants, bacteria, or safety."
)


def calibrated_index(raw_mv: float, v_clear_mv: float, v_cloudy_mv: float) -> float:
    """0 = clear-water reference, 100 = cloudy reference. A 0-100 RELATIVE demo index,
    NOT a certified NTU value. Sensor output typically falls as water gets cloudier,
    so v_clear_mv > v_cloudy_mv."""
    span = v_clear_mv - v_cloudy_mv
    if span == 0:
        raise ValueError("calibration references must differ")
    return max(0.0, min(100.0, 100.0 * (v_clear_mv - raw_mv) / span))


class DetectionEngine:
    def __init__(self, config: EngineConfig | None = None) -> None:
        self.cfg = config or EngineConfig()
        self._median_buf: deque[float] = deque(maxlen=self.cfg.median_window)
        self._baseline_buf: deque[float] = deque(maxlen=self.cfg.baseline_window)
        self._baseline_value: float | None = None
        self.state = "NORMAL"
        self.health = "OK"
        self._above_since: datetime | None = None
        self._below_since: datetime | None = None

    @property
    def baseline(self) -> float | None:
        return self._baseline_value

    def process(self, *, observed_at: datetime, turbidity_index: float | None,
                storm_active: bool = False, idle: bool = False) -> DetectionResult:
        cfg = self.cfg

        # --- idle: the flow gate found no moving water, so no measurement was taken. This
        # is deliberately checked BEFORE the fault branch: an idle heartbeat carries a null
        # index by design and must not be reported as a broken sensor. The persistence
        # timers are cleared so a dry gap cannot accumulate toward an escalation. ---
        if idle:
            self.health = "IDLE"
            self._above_since = self._below_since = None
            return DetectionResult(
                observed_at, self.state, self.health, None, self.baseline, None,
                None, None,
                "No flow detected — optical subsystem idle, no measurement taken.",
                "None. The sensor powers up when the turbine reports water movement.",
                storm_active)

        # --- sensor health: a missing/invalid turbidity index is a fault, not a zero ---
        if turbidity_index is None or not (0.0 <= turbidity_index <= 100.0):
            self.health = "SENSOR_FAULT"
            self._above_since = self._below_since = None
            return DetectionResult(
                observed_at, self.state, self.health, None, self.baseline, None,
                None, None,
                "Sensor reading missing or out of range — reading rejected, no value invented.",
                "Check sensor wiring, power, and calibration.", storm_active)
        self.health = "OK"

        self._median_buf.append(turbidity_index)
        smoothed = median(self._median_buf)

        # Establish the baseline ONCE from the initial calm window, then freeze it for the
        # whole event — a moving baseline tracks a slow storm ramp and hides the deviation.
        # It is re-established from fresh calm samples only after an event RESOLVES (below).
        if self.state == "NORMAL" and self._baseline_value is None:
            self._baseline_buf.append(smoothed)
            if len(self._baseline_buf) >= cfg.baseline_window:
                self._baseline_value = median(self._baseline_buf)

        baseline = self._baseline_value
        if baseline is None:  # still warming up
            return DetectionResult(observed_at, "NORMAL", "OK", smoothed, None, None,
                                   None, None, "Establishing baseline from stable samples.",
                                   "", storm_active)

        delta = smoothed - baseline
        action: str | None = None
        severity: str | None = None
        explanation = ""

        above = delta >= cfg.escalate_index_delta
        below = delta <= cfg.recover_index_delta
        self._above_since = observed_at if (above and self._above_since is None) else (None if not above else self._above_since)
        self._below_since = observed_at if (below and self._below_since is None) else (None if not below else self._below_since)

        def held(since: datetime | None, seconds: float) -> bool:
            return since is not None and (observed_at - since).total_seconds() >= seconds

        if self.state == "NORMAL":
            if held(self._above_since, cfg.escalate_persist_seconds):
                self.state, severity, action = "ELEVATED", "ELEVATED", "OPEN"
                explanation = self._explain(delta, self._above_since, observed_at, storm_active, "Elevated")
        elif self.state == "ELEVATED":
            if held(self._above_since, cfg.escalate_persist_seconds * cfg.alert_persist_multiplier):
                self.state, severity, action = "ALERT", "ALERT", "ESCALATE"
                explanation = self._explain(delta, self._above_since, observed_at, storm_active, "Alert")
            elif held(self._below_since, cfg.recover_persist_seconds):
                self.state = "RECOVERING"
        elif self.state == "ALERT":
            if held(self._below_since, cfg.recover_persist_seconds):
                self.state = "RECOVERING"
        elif self.state == "RECOVERING":
            if held(self._below_since, cfg.recover_persist_seconds):
                self.state, action = "NORMAL", "RESOLVE"
                explanation = "Conditions returned to baseline and held; event resolved."
                self._baseline_value = None  # re-establish from fresh calm samples
                self._baseline_buf.clear()
            elif above:  # re-escalated before recovery completed
                self.state, severity, action = "ALERT", "ALERT", "ESCALATE"
                explanation = self._explain(delta, self._above_since, observed_at, storm_active, "Alert")

        return DetectionResult(observed_at, self.state, "OK", smoothed, baseline, delta,
                               action, severity, explanation,
                               RECOMMENDATION if action in ("OPEN", "ESCALATE") else "", storm_active)

    def _explain(self, delta: float, since: datetime | None, now: datetime,
                 storm: bool, label: str) -> str:
        secs = int((now - since).total_seconds()) if since else 0
        storm_txt = " Storm simulation was active." if storm else ""
        return (f"{label} monitoring concern: relative turbidity rose {delta:.0f} index points "
                f"above baseline for {secs}s.{storm_txt} {RECOMMENDATION}")
