#!/usr/bin/env python3
"""Live sensor tail for the demo. Dependency-free (stdlib urllib).

    python3 scripts/watch_sensor.py                 # hardware device
    python3 scripts/watch_sensor.py outfallwatch-sim-01
"""
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone

BASE = "http://localhost:8000"
DEV = sys.argv[1] if len(sys.argv) > 1 else "outfallwatch-esp32-01"
C = {"g": "\033[92m", "a": "\033[93m", "r": "\033[91m", "c": "\033[96m",
     "d": "\033[90m", "b": "\033[1m", "0": "\033[0m"}
TONE = {"NORMAL": "g", "ELEVATED": "a", "ALERT": "r", "RECOVERING": "c",
        "SENSOR_FAULT": "r", "IDLE": "d"}


def get(path):
    with urllib.request.urlopen(BASE + path, timeout=5) as r:
        return json.load(r)


def main():
    print(f"{C['b']}{C['c']}  OUTFALLWATCH — live sensor feed{C['0']}")
    print(f"{C['d']}  device: {DEV}   source: {BASE}   Ctrl-C to stop{C['0']}\n")
    print(f"{C['d']}  {'time':8s} {'raw mV':>7s} {'index':>6s}  {'turbidity':<25s} {'state':<10s} {'health':<8s} flags{C['0']}")
    seen = set()
    while True:
        try:
            st = get(f"/api/devices/{DEV}/status")
            age = (datetime.now(timezone.utc).replace(tzinfo=None)
                   - datetime.fromisoformat(st["last_seen"])).total_seconds()
            for r in get(f"/api/devices/{DEV}/readings?limit=5"):
                if r["reading_id"] in seen:
                    continue
                seen.add(r["reading_id"])
                idx = r.get("turbidity_index")
                mv = r.get("turbidity_raw_mv")
                state = r.get("mode", "?")
                tone = C[TONE.get(state, "d")]
                bar = "█" * int((idx or 0) / 4)
                flags = ",".join(r.get("quality_flags") or []) or "-"
                print(f"  {r['observed_at'][11:19]} {('-' if mv is None else f'{mv:.0f}'):>7s} "
                      f"{('-' if idx is None else f'{idx:.1f}'):>6s}  {tone}{bar:<25s}{C['0']} "
                      f"{tone}{state:<10s}{C['0']} {st['health']:<8s} {flags}", flush=True)
            if age > 30:
                print(f"  {C['r']}· no data for {age:.0f}s — device STALE{C['0']}", flush=True)
        except Exception as e:
            print(f"  {C['r']}· {type(e).__name__}: {e}{C['0']}", flush=True)
        time.sleep(3)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{C['d']}  stopped{C['0']}")
