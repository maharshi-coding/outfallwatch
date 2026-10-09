# Presentation

## 30-second pitch

> OutfallWatch is a low-cost coastal runoff sentinel for places like Corpus Christi. Cheap
> water sensors plus **local edge processing** flag unusual *changes* and send **explainable**
> alerts to a live dashboard. An **adaptive** monitoring strategy cuts routine sampling and
> telemetry — which we measure transparently — so the node lasts longer on less power. It
> doesn't replace lab testing; it tells teams **when and where to investigate**.

## Seven slides

1. **The Coastal Bend problem** — industrial/port activity + stormwater; short-lived runoff
   changes slip between periodic sampling visits; continuous monitoring is costly and
   power-hungry.
2. **Why current workflows miss events** — intermittent grab-sampling, limited budgets, no
   continuous low-power eyes on the outfall.
3. **OutfallWatch** — low-cost local change-detection + explainable early warning.
   *Detect Change. Protect the Coast.*
4. **Architecture** — sensor → ESP32-S3 **edge decisions** → FastAPI → SQLite + SSE →
   dashboard; official coastal data kept separate; one engine shared by firmware & sim.
5. **Live demo** — NORMAL → storm → sustained anomaly → explainable ALERT → recovery
   (run it; see DEMO.md).
6. **Green AI results** — fixed vs adaptive on the same seed: ~89% fewer messages, 0 missed
   anomalies, **ESTIMATED** energy with stated assumptions and trade-offs.
7. **Local relevance & future** — real users (technicians, municipal/conservation teams),
   official NOAA/TCEQ context, and the honest path to field validation before deployment.

## Full 3-minute talk track

- **(0:00) Hook** — "Between sampling visits, a storm can push a sediment plume through an
  outfall and nobody sees it. Continuous monitoring usually means expensive, power-hungry
  gear." 
- **(0:25) Solution** — "OutfallWatch is a cheap ESP32-S3 node that decides *at the edge*
  when conditions change enough to matter, and only then talks more. It flags change; it
  never pretends to identify pollutants."
- **(0:45) Demo** — launch the storm; narrate baseline → elevated → alert; open the alert and
  read the explanation (actual delta + duration + the inspect/sample recommendation).
- **(1:45) Green AI** — run the comparison; "same seeded replay, two strategies. Adaptive
  sends ~89% fewer messages and still catches the event. Energy is an **estimate** from a
  documented model — not a measured chip current; we're explicit about that."
- **(2:20) Honesty & integrations** — show Data & Settings statuses; "NOAA is real when
  online; TCEQ here is a labelled example until a real export is dropped in; GCOOS we
  couldn't verify, so it says so."
- **(2:40) Close** — "It doesn't replace the lab. It tells a small team *where to look
  first*, on less power. Detect change, protect the coast."

## Five tough judge questions (and honest answers)

1. **"Is this really AI?"** — The edge detector is a deterministic, explainable rule engine.
   We don't call it a neural network. The *Green-AI* contribution is energy-aware adaptive
   processing, which we measure. A trained on-device model is a documented future step.
2. **"Can it tell if the water is polluted/safe?"** — No. Turbidity/temp/conductivity show
   *change*, not chemistry or safety. Alerts recommend inspection and sampling.
3. **"Are your energy numbers real?"** — They're **ESTIMATED** from a stated model; the
   dominant term is Wi-Fi radio-on per message. A measured number needs a power meter; we
   don't claim one.
4. **"Is the NOAA/TCEQ data live and real?"** — NOAA is a real API (live online, labelled
   fixture offline). TCEQ ships an **attributed EXAMPLE fixture** — clearly marked — with a
   working importer ready for a real export. GCOOS is honestly UNAVAILABLE.
5. **"Did the firmware run on hardware?"** — The source is complete and mirrors the backend
   logic, but it was **not compiled or flashed** (no board/toolchain here). We don't claim
   on-water verification.
