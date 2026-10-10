"""Core detection lifecycle — the scientific heart. Deterministic, no DB, no network."""
from datetime import datetime, timedelta, timezone

import pytest

from app.monitoring.engine import DetectionEngine, EngineConfig, calibrated_index
from app.simulation.scenarios import environment


def _run_scenario(scenario: str):
    """Feed the seeded environment through one engine; return (states, actions, healths)."""
    eng = DetectionEngine(EngineConfig())
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    states, actions, healths = [], [], []
    for p in environment(scenario, seed=42, intensity=1.0):
        r = eng.process(observed_at=base + timedelta(seconds=p.t),
                        turbidity_index=p.index, storm_active=p.storm_active)
        states.append(r.state)
        healths.append(r.health)
        if r.event_action:
            actions.append(r.event_action)
    return states, actions, healths


def test_calibration_formula():
    assert calibrated_index(2500, 2500, 1000) == 0.0       # clear reference -> 0
    assert calibrated_index(1000, 2500, 1000) == 100.0     # cloudy reference -> 100
    assert calibrated_index(1750, 2500, 1000) == pytest.approx(50.0)
    assert calibrated_index(3000, 2500, 1000) == 0.0       # clamped low
    with pytest.raises(ValueError):
        calibrated_index(1000, 2000, 2000)                 # equal refs rejected


def test_hysteresis_config_guard():
    with pytest.raises(ValueError):
        EngineConfig(escalate_index_delta=20, recover_index_delta=20)


def test_scenario_A_normal_stays_normal():
    states, actions, _ = _run_scenario("A")
    assert set(states) <= {"NORMAL"}
    assert actions == []


def test_scenario_B_sediment_runoff_alerts():
    states, actions, _ = _run_scenario("B")
    assert "ELEVATED" in states and "ALERT" in states
    assert actions[0] == "OPEN"
    assert "ESCALATE" in actions


def test_scenario_C_transient_spike_suppressed():
    states, actions, _ = _run_scenario("C")
    assert "ALERT" not in states          # brief spike must not sustain an alert
    assert "OPEN" not in actions


def test_scenario_D_recovery_resolves():
    states, actions, _ = _run_scenario("D")
    assert "ALERT" in states
    assert "RESOLVE" in actions           # event actually closes out
    assert states[-1] == "NORMAL"


def test_scenario_E_sensor_fault_detected():
    states, actions, healths = _run_scenario("E")
    assert "SENSOR_FAULT" in healths      # null reading -> fault, not a fake zero
    assert "OPEN" not in actions          # a fault is not a turbidity alert


def test_baseline_not_learned_during_storm():
    """Baseline must not drift up while elevated, or recovery never triggers."""
    eng = DetectionEngine(EngineConfig())
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for p in environment("B", seed=1, intensity=1.0):
        eng.process(observed_at=base + timedelta(seconds=p.t),
                    turbidity_index=p.index, storm_active=p.storm_active)
    assert eng.baseline is not None and eng.baseline < 35  # near ~20, not dragged to storm level


# --------------------------------------------------- flow-gated optical subsystem (IDLE)
def _eng_at():
    return DetectionEngine(EngineConfig()), datetime(2026, 1, 1, tzinfo=timezone.utc)


def test_idle_is_not_a_sensor_fault():
    """A no-flow heartbeat carries a null index BY DESIGN. It must read IDLE, not
    SENSOR_FAULT, and must not invent a value."""
    eng, base = _eng_at()
    r = eng.process(observed_at=base, turbidity_index=None, idle=True)
    assert r.health == "IDLE"
    assert r.smoothed_index is None          # nothing measured, nothing invented
    assert r.event_action is None

    # the same null WITHOUT the flow gate is still a genuine fault
    r2 = eng.process(observed_at=base + timedelta(seconds=10), turbidity_index=None)
    assert r2.health == "SENSOR_FAULT"


def test_idle_preserves_state_and_does_not_escalate():
    """A dry gap must not accumulate toward an escalation, and must not reset the
    monitoring state the device had reached."""
    eng, base = _eng_at()
    for i in range(12):                                   # settle a baseline near 10
        eng.process(observed_at=base + timedelta(seconds=i), turbidity_index=10.0)

    # one high sample starts the persistence clock
    t = base + timedelta(seconds=20)
    eng.process(observed_at=t, turbidity_index=90.0)

    # ... then the water stops for well past the escalate persistence window
    for i in range(1, 10):
        r = eng.process(observed_at=t + timedelta(seconds=i * 10), turbidity_index=None, idle=True)
        assert r.health == "IDLE"
        assert r.state == "NORMAL"                        # held, never escalated on a dry gap

    # a single high sample after the gap must not instantly escalate either: the timer
    # was cleared, so persistence has to be re-earned from now.
    r = eng.process(observed_at=t + timedelta(seconds=200), turbidity_index=90.0)
    assert r.state == "NORMAL"
