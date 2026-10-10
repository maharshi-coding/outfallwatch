#!/usr/bin/env python3
"""Measure the HOST computer's energy/CO2 while running the Green AI replay many times,
and write the result to a JSON file the backend serves on the Green AI Lab page.

CodeCarbon tracks the host (CPU/RAM) footprint of this Python process — it does NOT measure
the ESP32's current draw (that needs a hardware power meter). Run from the backend venv:
    python ../scripts/benchmark_codecarbon.py

Install first if needed:  pip install codecarbon
"""
from __future__ import annotations

import json
import platform
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.services.greenai import compare  # noqa: E402

N = 50000  # ~15 s of work so CodeCarbon has a real sampling window
RESULT_PATH = ROOT / "backend" / "app" / "integrations" / "fixtures" / "codecarbon_result.json"


def _write(result: dict) -> None:
    RESULT_PATH.write_text(json.dumps(result, indent=2))
    print(f"\nwrote {RESULT_PATH.relative_to(ROOT)}")


def main() -> None:
    try:
        from codecarbon import EmissionsTracker
    except ImportError:
        print("codecarbon not installed. `pip install codecarbon` to enable this benchmark.")
        return

    tracker = EmissionsTracker(project_name="outfallwatch-greenai", save_to_file=False,
                               log_level="error")
    tracker.start()
    t0 = time.perf_counter()
    for _ in range(N):
        compare("B", seed=42)
    duration = time.perf_counter() - t0
    co2_kg = tracker.stop() or 0.0

    data = getattr(tracker, "final_emissions_data", None)
    energy_kwh = float(getattr(data, "energy_consumed", 0.0) or 0.0)
    cpu_model = getattr(data, "cpu_model", None) or platform.processor() or platform.machine()

    result = {
        "ran": True,
        "measured_at": datetime.now(timezone.utc).isoformat(),
        "iterations": N,
        "workload": "Green AI fixed-vs-adaptive replay (scenario B)",
        "duration_s": round(duration, 2),
        "energy_kwh": energy_kwh,
        "co2_kg": float(co2_kg),
        "host": f"{platform.system()} {platform.machine()}",
        "cpu_model": str(cpu_model),
        "kind": "ESTIMATED",  # CodeCarbon models host power; on Apple Silicon it's not RAPL-measured
        "note": "Host computer footprint via CodeCarbon. NOT the ESP32 sensor-node energy.",
    }
    print("=== CodeCarbon host benchmark ===")
    for k, v in result.items():
        print(f"  {k}: {v}")
    _write(result)


if __name__ == "__main__":
    main()
