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
