"""Deterministic 'true environment' signal at 1-second resolution. Pure and seeded:
the same (scenario, seed, intensity) always yields the same trajectory. Both the live
runner and the Green AI replay consume this so they compare on identical ground truth.

turbidity index is a 0-100 RELATIVE demo index, never NTU. index=None models a sensor
fault (scenario E). Conductivity is left None by default — an optional sensor that is
'Unavailable', not a fabricated 0."""
from __future__ import annotations

import random
from dataclasses import dataclass

BASELINE = 20.0


@dataclass(frozen=True)
class EnvPoint:
    t: int                       # virtual seconds from scenario start
    index: float | None          # relative turbidity index or None (sensor fault)
    temperature_c: float | None
    conductivity_us_cm: float | None
    storm_active: bool


def _clamp(v: float) -> float:
    return max(0.0, min(100.0, v))


# (length_seconds, storm window start/end, description). Kept small & explicit.
_LENGTHS = {"A": 180, "B": 220, "C": 180, "D": 280, "E": 200, "F": 200}


def scenario_length(scenario: str) -> int:
    return _LENGTHS[scenario.upper()]


def environment(scenario: str, seed: int = 42, intensity: float = 1.0) -> list[EnvPoint]:
    scenario = scenario.upper()
    rng = random.Random(seed)
    amp = 50.0 * intensity
    out: list[EnvPoint] = []
    for t in range(scenario_length(scenario) + 1):
        noise = rng.uniform(-1.5, 1.5)
        temp = 25.0 + rng.uniform(-0.3, 0.3)
        storm = False
        idx: float | None = BASELINE + noise

        if scenario == "A" or scenario == "F":
            pass  # steady normal; F adds a *transmission* gap in the runner, not here
        elif scenario == "B":
            storm = 135 <= t <= 210
            if t < 140:
                pass
            elif t < 170:
                idx = BASELINE + amp * (t - 140) / 30.0 + noise   # ramp up
            else:
                idx = BASELINE + amp + noise                      # sustained high
        elif scenario == "C":
            storm = 138 <= t <= 150
            if 140 <= t <= 148:
                idx = BASELINE + amp + noise                      # brief spike only
        elif scenario == "D":
            storm = 135 <= t <= 210
            if t < 140:
                pass
            elif t < 170:
                idx = BASELINE + amp * (t - 140) / 30.0 + noise
            elif t < 210:
                idx = BASELINE + amp + noise
            elif t < 245:
                idx = BASELINE + amp * (245 - t) / 35.0 + noise   # decline
        elif scenario == "E":
            if t >= 140:
                idx = None                                        # sensor fault
                temp = None
        out.append(EnvPoint(t, None if idx is None else _clamp(idx), temp, None, storm))
    return out
