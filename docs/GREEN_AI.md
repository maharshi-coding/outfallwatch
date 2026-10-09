# Green AI / resource efficiency

The Green-AI claim here is **energy-aware edge processing**, proven by a reproducible
comparison — not a buzzword and not a neural network we didn't build.

## The experiment

`POST /api/energy/compare` (and the **Green AI Lab** page) run two strategies over the
**same seeded environment** (identical ground truth), each through its own copy of the real
detection engine:

- **Fixed-rate:** sample every 5 s, transmit **every** sample.
- **Adaptive:** sample every 10 s in NORMAL, 2 s during an event; transmit on state change,
  on escalation, or as a heartbeat every 6 samples.

## What it measures

| Metric | Source |
| --- | --- |
| samples, messages, bytes | counted during replay |
| processing time (ms) | measured host wall-time of the replay |
| alert latency (s) | `alert_time − true_anomaly_onset` |
| missed anomalies | 1 if a true onset existed and the strategy never alerted |
| energy (mWh) | **ESTIMATED** model below |

Typical scenario B result: adaptive sends ~**89% fewer messages** with **0 missed
anomalies** (alerts ~40 s after onset at the adaptive cadence). Reproducible for a fixed
seed (`tests/test_api.py::test_green_ai_compare_deterministic_and_labelled`).

## Energy model — ESTIMATED, not measured

```
E = samples × E_sample + messages × E_tx + duration_s × E_idle
E_sample = 0.0008 mWh   (one ADC + MCU wake-and-read)
E_tx     = 0.012  mWh   (one Wi-Fi radio-on + POST — the dominant cost)
E_idle   = 0.0002 mWh/s (light-sleep idle)
```

**Assumptions & honesty:**
- Order-of-magnitude constants, **not** a measured ESP32 current draw.
- Wi-Fi radio-on per POST dominates, which is why cutting messages cuts estimated energy.
- Adaptive samples *faster* during events, so "fewer messages" does **not** automatically
  mean "less energy" — both the sample count and message count are reported so the trade-off
  is visible.
- No deep-sleep between samples is modelled beyond light-sleep idle.
- No real-world battery-life projection is claimed. A measured number needs a power meter.

## CodeCarbon

`scripts/benchmark_codecarbon.py` runs the replay many times under CodeCarbon to estimate
the **host computer's** footprint. It was **not executed** in the build environment (status
NOT_IMPLEMENTED/runnable). CodeCarbon measures the host, **never** the microcontroller.

## TFLM / ESP-NN

**NOT_IMPLEMENTED.** No trained, quantized model is deployed on-device, so there is no
hardware-accelerated inference to benchmark and we do not claim any. Calling the threshold
rule "neural-network AI" would be false. A future model would be trained on labelled field
data, quantized, deployed via esp-tflite-micro, and benchmarked (memory, latency, energy)
against this deterministic baseline — documented, not assumed.
