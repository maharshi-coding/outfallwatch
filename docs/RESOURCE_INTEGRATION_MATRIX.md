# Resource integration matrix

Honest status of every official IslanderHack resource. **A link in the README is not an
integration.** Status reflects verified runtime behaviour. Live status is also served at
`GET /api/integrations/status` and shown on the **Coastal Conditions** page.

Legend: **WORKING** (real source verified, parsed, stored, shown) · **PARTIAL** (importer
works but data is a labelled fixture, or live fetch fell back offline) · **UNAVAILABLE**
(no verified access path; interface kept) · **NOT_IMPLEMENTED**.

**Scope (by request):** the external data integrations are deliberately limited to **NOAA**
(water levels) and **GCOOS** (oceanographic + water quality). TCEQ, Open-Meteo, GBIF,
iNaturalist, NASA Earthdata and OpenWeatherMap were removed. The Freenove firmware and the
Green-AI (CodeCarbon/TFLM/ESP-NN) material remain as **app features**, documented in
`FREENOVE_INTEGRATION.md` and `GREEN_AI.md` — they are no longer listed as data integrations.

| Resource | Module | UI surface | Method / auth | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| **NOAA Tides & Currents** | `providers.refresh_noaa` | Coastal Conditions → NOAA | HTTPS datagetter, no key; station **8775296** (USS Lexington, Corpus Christi Bay) | **WORKING** | Real-time (`date=latest`) + historical (24 h, downsampled hourly) `water_level`. Offline → labelled fixture (PARTIAL). |
| **GCOOS** | `providers.refresh_gcoos` | Coastal Conditions → GCOOS | ERDDAP tabledap, no key; station **CBI_042** (Conrad Blucher Institute) | **WORKING** | Latest non-null per metric: water temperature, salinity, (dissolved O₂, chlorophyll, turbidity, water level when the station reports them). Independent CBI data, not NOAA-republished. Offline → labelled fixture (PARTIAL). |

## What "WORKING" requires here

Source endpoint verified · parser runs · values/units/timestamps/source metadata preserved ·
data reaches the backend (`ExternalObservation`) · a frontend panel shows it · verification
succeeds. A fallback is a **fixture**, not a working real integration, and is labelled
`TEST_FIXTURE` (never LIVE).

## Verified live (this build)

- **NOAA** → WORKING: real-time 1.768 ft + 24 historical hourly points, USS Lexington (8775296).
- **GCOOS** → WORKING: water temperature 29.4 °C + salinity 27.9 PSU from CBI_042.

Both fall back to labelled offline fixtures and report PARTIAL if the network is unavailable,
so the demo still works offline.
