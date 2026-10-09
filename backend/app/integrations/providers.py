"""Official coastal-data adapters. Scope: NOAA (water levels) and GCOOS (near-real-time
oceanographic + water-quality) only.

Honest statuses: WORKING (live verified) · PARTIAL (importer works, showing labelled
fixture / live fetch fell back offline) · UNAVAILABLE. Fixtures are labelled TEST_FIXTURE
and never shown as LIVE."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import httpx
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import models
from app.config import get_settings

FIXTURES = Path(__file__).parent / "fixtures"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _set_status(db: Session, provider: str, *, status: str, capabilities: list[str],
                succeeded: bool, latest_obs: datetime | None = None,
                error: str | None = None) -> None:
    row = db.get(models.IntegrationStatus, provider)
    if row is None:
        row = models.IntegrationStatus(provider=provider)
        db.add(row)
    row.status = status
    row.capabilities = capabilities
    row.enabled = True
    row.last_attempted = _now()
    if succeeded:
        row.last_succeeded = _now()
    row.latest_observation_at = latest_obs
    row.last_error = error


def _replace_observations(db: Session, provider: str, rows: list[models.ExternalObservation]) -> None:
    db.execute(delete(models.ExternalObservation).where(models.ExternalObservation.provider == provider))
    for r in rows:
        db.add(r)


# ===================================================================== NOAA (water levels)
def _parse_noaa(payload: dict, station: str, label: str, kind: str) -> list[models.ExternalObservation]:
    meta = payload.get("metadata", {})
    name = meta.get("name", station)
    rows = []
    for d in payload.get("data", []):
        ts = datetime.strptime(d["t"], "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
        rows.append(models.ExternalObservation(
            provider="NOAA", station_or_dataset=f"{name} ({station}) · {label}",
            parameter="water_level", value_numeric=float(d["v"]), unit="ft", observed_at=ts,
            quality_flags=[d.get("q", "")],
            source_url=f"https://tidesandcurrents.noaa.gov/stationhome.html?id={station}",
            source_id=station, data_kind=kind))
    return rows


def _seed_noaa_fixture(db: Session) -> None:
    fx = json.loads((FIXTURES / "noaa_water_level.json").read_text())
    _replace_observations(db, "NOAA", _parse_noaa(fx, fx["metadata"]["id"], "example", models.SOURCE_TEST_FIXTURE))
    _set_status(db, "NOAA", status="PARTIAL", capabilities=["water_level (fixture)"],
                succeeded=False, error="Showing offline fixture; live fetch upgrades to WORKING.")


def refresh_noaa(db: Session) -> None:
    """Real-time (latest) + historical (24 h hourly) water levels."""
    cfg = get_settings()
    station = cfg.noaa_station_id
    base_params = {"station": station, "product": "water_level", "datum": "MLLW",
                   "time_zone": "gmt", "units": "english", "format": "json"}
    try:
        rt = httpx.get(cfg.noaa_base_url, params={**base_params, "date": "latest"}, timeout=cfg.http_timeout_seconds)
        hist = httpx.get(cfg.noaa_base_url, params={**base_params, "range": 24, "interval": "h"}, timeout=cfg.http_timeout_seconds)
        rt.raise_for_status(); hist.raise_for_status()
        rt_json, hist_json = rt.json(), hist.json()
        if "data" not in rt_json and "data" not in hist_json:
            raise ValueError(rt_json.get("error", {}).get("message", "no data"))
        # downsample historical to ~hourly (the API returns native 6-min observations)
        hist_rows = _parse_noaa(hist_json, station, "historical 24 h", models.SOURCE_IMPORTED_OFFICIAL)[::10]
        rows = _parse_noaa(rt_json, station, "real-time", models.SOURCE_IMPORTED_OFFICIAL) + hist_rows
        _replace_observations(db, "NOAA", rows)
        latest = max((r.observed_at for r in rows), default=None)
        _set_status(db, "NOAA", status="WORKING",
                    capabilities=["real-time water level", "historical water level (24 h hourly)"],
                    succeeded=True, latest_obs=latest)
    except Exception as exc:
        _seed_noaa_fixture(db)
        row = db.get(models.IntegrationStatus, "NOAA")
        if row:
            row.last_error = f"live fetch failed ({type(exc).__name__}); showing fixture"
    db.commit()


# ===================================================== GCOOS (ERDDAP CBI, near-real-time)
# friendly name, ERDDAP variable, unit (fallback if info lookup fails)
_GCOOS_VARS = [
    ("water_temperature", "sea_surface_temperature_1", "°C"),
    ("salinity", "sea_water_practical_salinity_1", "PSU"),
    ("dissolved_oxygen", "mass_concentration_of_oxygen_in_sea_water_1", "mg/L"),
    ("chlorophyll", "mass_concentration_of_chlorophyll_in_sea_water_1", "µg/L"),
    ("turbidity", "sea_water_turbidity_1", "NTU"),
    ("water_level", "sea_surface_height_1", "m"),
]


def _seed_gcoos_fixture(db: Session) -> None:
    fx = json.loads((FIXTURES / "gcoos_cbi.json").read_text())
    rows = [models.ExternalObservation(
        provider="GCOOS", station_or_dataset=fx["station_label"], parameter=m["parameter"],
        value_numeric=m["value"], unit=m["unit"],
        observed_at=datetime.fromisoformat(m["observed_at"]),
        source_url=fx["source_url"], source_id=fx["station_id"],
        data_kind=models.SOURCE_TEST_FIXTURE) for m in fx["metrics"]]
    _replace_observations(db, "GCOOS", rows)
    _set_status(db, "GCOOS", status="PARTIAL",
                capabilities=["CBI oceanographic + water quality (fixture)"], succeeded=False,
                error="Showing offline fixture; live ERDDAP fetch upgrades to WORKING.")


def refresh_gcoos(db: Session) -> None:
    """Latest non-null value per metric from a GCOOS/ERDDAP Conrad Blucher Institute station."""
    cfg = get_settings()
    station = cfg.gcoos_station
    tabledap = f"{cfg.gcoos_base_url}/tabledap/{station}.json"
    source_url = f"{cfg.gcoos_base_url}/tabledap/{station}.html"
    label = f"GCOOS · Conrad Blucher Institute {station}"
    rows: list[models.ExternalObservation] = []
    latest: datetime | None = None
    try:
        for friendly, var, unit in _GCOOS_VARS:
            try:
                # latest non-null value for this metric (ERDDAP builds the query in the URL)
                r = httpx.get(f"{tabledap}?time,{var}&{var}!=NaN&orderByMax(%22time%22)",
                              timeout=cfg.http_timeout_seconds)
                if r.status_code != 200:
                    continue  # station lacks this variable
                data = r.json()["table"]["rows"]
                if not data:
                    continue
                t_str, val = data[-1][0], data[-1][1]
                if val is None:
                    continue
                ts = datetime.fromisoformat(t_str.replace("Z", "+00:00"))
                latest = ts if latest is None or ts > latest else latest
                rows.append(models.ExternalObservation(
                    provider="GCOOS", station_or_dataset=label, parameter=friendly,
                    value_numeric=float(val), unit=unit, observed_at=ts,
                    source_url=source_url, source_id=station,
                    data_kind=models.SOURCE_IMPORTED_OFFICIAL))
            except Exception:
                continue  # one variable failing must not sink the whole station
        if not rows:
            raise ValueError("no metrics returned from station")
        _replace_observations(db, "GCOOS", rows)
        _set_status(db, "GCOOS", status="WORKING",
                    capabilities=[m[0] for m in _GCOOS_VARS if any(x.parameter == m[0] for x in rows)],
                    succeeded=True, latest_obs=latest,
                    error="Independent CBI data (not NOAA-republished).")
    except Exception as exc:
        _seed_gcoos_fixture(db)
        row = db.get(models.IntegrationStatus, "GCOOS")
        if row:
            row.last_error = f"live ERDDAP fetch failed ({type(exc).__name__}); showing fixture"
    db.commit()


# =============================================================================== orchestration
def seed_offline(db: Session) -> None:
    """Network-free seeds so both panels populate instantly; background refresh upgrades them."""
    _seed_noaa_fixture(db)
    _seed_gcoos_fixture(db)
    db.commit()


def refresh_all(db: Session) -> None:
    refresh_noaa(db)
    refresh_gcoos(db)


def status_snapshot(db: Session) -> list[dict]:
    rows = db.execute(select(models.IntegrationStatus)).scalars().all()
    return [{
        "provider": r.provider, "enabled": r.enabled, "status": r.status,
        "capabilities": r.capabilities,
        "last_attempted": r.last_attempted.isoformat() if r.last_attempted else None,
        "last_succeeded": r.last_succeeded.isoformat() if r.last_succeeded else None,
        "latest_observation_at": r.latest_observation_at.isoformat() if r.latest_observation_at else None,
        "last_error": r.last_error,
    } for r in rows]
