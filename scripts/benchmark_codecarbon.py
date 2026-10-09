#!/usr/bin/env python3
"""Measure the HOST computer's energy/CO2 while running the Green AI replay many times.

CodeCarbon tracks the host (CPU/RAM/GPU) footprint of this Python process. It does NOT
measure the ESP32's current draw — that requires a hardware power meter. Run from the
backend venv:  python ../scripts/benchmark_codecarbon.py

If codecarbon is not installed:  pip install codecarbon
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.services.greenai import compare  # noqa: E402

N = 300


def main() -> None:
    try:
        from codecarbon import EmissionsTracker
    except ImportError:
        print("codecarbon not installed. `pip install codecarbon` to enable this benchmark.")
        print(f"Running the {N}-iteration workload WITHOUT measurement for timing only...")
        t0 = time.perf_counter()
        for _ in range(N):
            compare("B", seed=42)
        print(f"workload: {N} compares in {time.perf_counter() - t0:.2f}s (NO energy measured)")
        return

    tracker = EmissionsTracker(project_name="outfallwatch-greenai", save_to_file=False, log_level="error")
    tracker.start()
    t0 = time.perf_counter()
    for _ in range(N):
        compare("B", seed=42)
    dur = time.perf_counter() - t0
    emissions_kg = tracker.stop()

    print("=== CodeCarbon host benchmark (MEASURED host, ESTIMATED grid factors) ===")
    print(f"iterations        : {N} Green-AI comparisons")
    print(f"wall duration     : {dur:.2f} s")
    print(f"est. CO2 emissions: {emissions_kg:.8f} kg CO2eq")
    print("NOTE: host footprint only. NOT the ESP32 sensor-node energy.")


if __name__ == "__main__":
    main()
