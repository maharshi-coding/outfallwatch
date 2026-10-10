"""All HTTP + SSE endpoints (section 7.2). One router — the surface is small."""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app import models
from app.config import get_settings
from app.database.base import get_db
from app.integrations import providers
from app.schemas import (CalibrationIn, ConfigurationOut, ConfigurationPatch, EnergyCompareIn,
                         EventOut, ReadingOut, SimulationStart, TelemetryIn)
from app.services import greenai
from app.services.events import broker
from app.services.ingestion import ingest_reading
from app.simulation.runner import SIM_DEVICE_ID, runner

router = APIRouter(prefix="/api")


def _settings_row(db: Session) -> models.DeviceSettings:
    row = db.execute(select(models.DeviceSettings).limit(1)).scalar_one_or_none()
    if row is None:
        c = get_settings()
        row = models.DeviceSettings(
            escalate_index_delta=c.escalate_index_delta,
            escalate_persist_seconds=c.escalate_persist_seconds,
            recover_index_delta=c.recover_index_delta,
            recover_persist_seconds=c.recover_persist_seconds)
        db.add(row)
        db.commit()
    return row


# ------------------------------------------------------------------- health / devices
@router.get("/health")
def health() -> dict:
    return {"status": "ok", "app": get_settings().app_name,
            "time": datetime.now(timezone.utc).isoformat()}


@router.get("/devices")
def list_devices(db: Session = Depends(get_db)) -> list[dict]:
    return [_device_dict(d) for d in db.execute(select(models.Device)).scalars().all()]


@router.get("/devices/{device_id}")
def get_device(device_id: str, db: Session = Depends(get_db)) -> dict:
    d = db.get(models.Device, device_id)
    if not d:
        raise HTTPException(404, "device not found")
    return _device_dict(d)


@router.get("/devices/{device_id}/status")
def device_status(device_id: str, db: Session = Depends(get_db)) -> dict:
    d = db.get(models.Device, device_id)
    if not d:
        raise HTTPException(404, "device not found")
    stale = _is_stale(d)
    return {**_device_dict(d), "stale": stale,
            "health": "STALE" if stale else d.connection_status}


@router.get("/devices/{device_id}/readings", response_model=list[ReadingOut])
def device_readings(device_id: str, limit: int = Query(200, le=2000),
                    db: Session = Depends(get_db)) -> list[models.SensorReading]:
    return list(db.execute(
        select(models.SensorReading).where(models.SensorReading.device_id == device_id)
        .order_by(desc(models.SensorReading.observed_at)).limit(limit)).scalars().all())[::-1]


@router.post("/telemetry")
def post_telemetry(t: TelemetryIn, db: Session = Depends(get_db),
                   x_device_key: str = Header(default="")) -> dict:
    if x_device_key != get_settings().device_api_key:
        raise HTTPException(401, "invalid or missing X-Device-Key")
    reading, event = ingest_reading(db, t)
    return {"accepted": True, "reading_id": reading.reading_id, "mode": reading.mode,
            "event_id": event.event_id if event else None}


# ------------------------------------------------------------------- monitoring
@router.get("/monitoring/overview")
def overview(db: Session = Depends(get_db)) -> dict:
    devices = db.execute(select(models.Device)).scalars().all()
    active = db.execute(select(models.MonitoringEvent)
                        .where(models.MonitoringEvent.state != "RESOLVED")).scalars().all()
    recent = db.execute(select(models.MonitoringEvent)
                        .order_by(desc(models.MonitoringEvent.started_at)).limit(10)).scalars().all()
    latest_run = db.execute(select(models.EfficiencyRun)
                            .order_by(desc(models.EfficiencyRun.created_at)).limit(2)).scalars().all()
    return {
        "devices": [{**_device_dict(d), "stale": _is_stale(d)} for d in devices],
        "active_alerts": [EventOut.model_validate(e).model_dump() for e in active],
        "recent_events": [EventOut.model_validate(e).model_dump() for e in recent],
        "simulation": runner.status(),
        "green_ai_latest": [{"strategy": r.strategy, "messages": r.messages,
                             "bytes_tx": r.bytes_tx, "energy_mwh_estimated": r.energy_mwh_estimated,
                             "energy_kind": r.energy_kind} for r in latest_run],
    }


@router.get("/monitoring/timeseries")
def timeseries(device_id: str = SIM_DEVICE_ID, minutes: int = Query(60, le=1440),
               db: Session = Depends(get_db)) -> dict:
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    rows = db.execute(
        select(models.SensorReading)
        .where(models.SensorReading.device_id == device_id,
               models.SensorReading.observed_at >= since)
        .order_by(models.SensorReading.observed_at)).scalars().all()
    return {"device_id": device_id, "points": [{
        "observed_at": r.observed_at.isoformat(), "turbidity_index": r.turbidity_index,
        "turbidity_raw_mv": r.turbidity_raw_mv, "temperature_c": r.temperature_c,
        "conductivity_us_cm": r.conductivity_us_cm, "mode": r.mode,
        "storm_active": r.storm_active, "quality_flags": r.quality_flags} for r in rows]}


# ------------------------------------------------------------------- alerts
@router.get("/alerts", response_model=list[EventOut])
def alerts(state: str | None = None, db: Session = Depends(get_db)) -> list[models.MonitoringEvent]:
    q = select(models.MonitoringEvent).order_by(desc(models.MonitoringEvent.started_at))
    if state:
        q = q.where(models.MonitoringEvent.state == state.upper())
    return list(db.execute(q).scalars().all())


@router.get("/alerts/{event_id}", response_model=EventOut)
def alert(event_id: str, db: Session = Depends(get_db)) -> models.MonitoringEvent:
    e = db.get(models.MonitoringEvent, event_id)
    if not e:
        raise HTTPException(404, "event not found")
    return e


@router.post("/alerts/{event_id}/acknowledge", response_model=EventOut)
def acknowledge(event_id: str, db: Session = Depends(get_db)) -> models.MonitoringEvent:
    e = db.get(models.MonitoringEvent, event_id)
    if not e:
        raise HTTPException(404, "event not found")
    e.acknowledged = True
    if e.state == "ACTIVE":
        e.state = "ACKNOWLEDGED"
    e.updated_at = datetime.now(timezone.utc)
    db.commit()
    broker.publish_soon("alert", {"event_id": e.event_id, "state": e.state, "acknowledged": True})
    return e


# ------------------------------------------------------------------- calibration / config
@router.get("/calibrations")
def list_calibrations(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.execute(select(models.Calibration).order_by(desc(models.Calibration.created_at))).scalars().all()
    return [{"calibration_id": c.calibration_id, "device_id": c.device_id,
             "v_clear_mv": c.v_clear_mv, "v_cloudy_mv": c.v_cloudy_mv,
             "valid": c.valid, "method": c.method,
             "created_at": c.created_at.isoformat()} for c in rows]


@router.post("/calibrations")
def create_calibration(c: CalibrationIn, db: Session = Depends(get_db)) -> dict:
    if c.v_clear_mv <= c.v_cloudy_mv:
        raise HTTPException(422, "v_clear_mv must exceed v_cloudy_mv (sensor output falls as water clouds)")
    if (c.v_clear_mv - c.v_cloudy_mv) < 50:
        raise HTTPException(422, "clear/cloudy references too close to be meaningful (<50 mV)")
    row = models.Calibration(calibration_id=f"cal-{uuid.uuid4().hex[:8]}", device_id=c.device_id,
                             v_clear_mv=c.v_clear_mv, v_cloudy_mv=c.v_cloudy_mv,
                             polarity_verified=c.polarity_verified, method=c.method, valid=True)
    db.add(row)
    db.commit()
    return {"calibration_id": row.calibration_id, "valid": True}


@router.get("/configuration", response_model=ConfigurationOut)
def get_configuration(db: Session = Depends(get_db)) -> ConfigurationOut:
    s = _settings_row(db)
    return ConfigurationOut(escalate_index_delta=s.escalate_index_delta,
                            escalate_persist_seconds=s.escalate_persist_seconds,
                            recover_index_delta=s.recover_index_delta,
                            recover_persist_seconds=s.recover_persist_seconds,
                            normal_interval_seconds=s.normal_interval_seconds,
                            storm_interval_seconds=s.storm_interval_seconds, version=s.version)


@router.patch("/configuration", response_model=ConfigurationOut)
def patch_configuration(patch: ConfigurationPatch, db: Session = Depends(get_db)) -> ConfigurationOut:
    s = _settings_row(db)
    data = patch.model_dump(exclude_none=True)
    for k, v in data.items():
        setattr(s, k, v)
    if s.recover_index_delta >= s.escalate_index_delta:
        raise HTTPException(422, "recover_index_delta must stay below escalate_index_delta (hysteresis)")
    s.version += 1
    s.updated_at = datetime.now(timezone.utc)
    db.commit()
    from app.services.ingestion import reset_engines
    reset_engines()  # new thresholds take effect on next readings
    return get_configuration(db)


# ------------------------------------------------------------------- energy / green ai
@router.get("/energy/summary")
def energy_summary(db: Session = Depends(get_db)) -> dict:
    rows = db.execute(select(models.EfficiencyRun)
                      .order_by(desc(models.EfficiencyRun.created_at)).limit(10)).scalars().all()
    return {"runs": [{"strategy": r.strategy, "scenario": r.scenario, "seed": r.seed,
                      "samples": r.samples, "messages": r.messages, "bytes_tx": r.bytes_tx,
                      "alert_latency_seconds": r.alert_latency_seconds,
                      "missed_anomalies": r.missed_anomalies,
                      "energy_mwh_estimated": r.energy_mwh_estimated, "energy_kind": r.energy_kind,
                      "created_at": r.created_at.isoformat()} for r in rows]}


@router.get("/energy/codecarbon")
def energy_codecarbon() -> dict:
    """Real CodeCarbon host-footprint benchmark result (or {"ran": false})."""
    return greenai.codecarbon_result()


@router.post("/energy/compare")
def energy_compare(body: EnergyCompareIn, db: Session = Depends(get_db)) -> dict:
    result = greenai.compare(body.scenario, body.seed, body.intensity)
    for key in ("fixed", "adaptive"):
        m = result[key]
        db.add(models.EfficiencyRun(
            strategy=m["strategy"], scenario=body.scenario, seed=body.seed, samples=m["samples"],
            messages=m["messages"], bytes_tx=m["bytes_tx"], processing_ms=m["processing_ms"],
            alert_latency_seconds=m["alert_latency_seconds"], missed_anomalies=m["missed_anomalies"],
            energy_mwh_estimated=m["energy_mwh_estimated"], energy_kind="ESTIMATED",
            assumptions={"model": result["energy_model"]}))
    db.commit()
    return result


# ------------------------------------------------------------------- simulation
@router.post("/simulation/start")
async def sim_start(body: SimulationStart) -> dict:
    return await runner.start(body.scenario, body.intensity, body.speed)


@router.post("/simulation/stop")
async def sim_stop() -> dict:
    return await runner.stop()


@router.post("/simulation/reset")
async def sim_reset() -> dict:
    await runner.stop()
    return runner.reset()


@router.get("/simulation/status")
def sim_status() -> dict:
    return runner.status()


# ------------------------------------------------------------------- integrations
@router.get("/integrations/status")
def integrations_status(db: Session = Depends(get_db)) -> dict:
    return {"providers": providers.status_snapshot(db)}


@router.post("/integrations/refresh")
async def integrations_refresh(db: Session = Depends(get_db)) -> dict:
    await asyncio.to_thread(providers.refresh_all, db)
    return {"providers": providers.status_snapshot(db)}


@router.get("/external-observations")
def external_observations(provider: str | None = None,
                          db: Session = Depends(get_db)) -> list[dict]:
    q = select(models.ExternalObservation).order_by(desc(models.ExternalObservation.observed_at))
    if provider:
        q = q.where(models.ExternalObservation.provider == provider.upper())
    rows = db.execute(q.limit(500)).scalars().all()
    return [{"provider": r.provider, "station_or_dataset": r.station_or_dataset,
             "parameter": r.parameter, "value_numeric": r.value_numeric,
             "value_text": r.value_text, "unit": r.unit,
             "observed_at": r.observed_at.isoformat() if r.observed_at else None,
             "ingested_at": r.ingested_at.isoformat(), "quality_flags": r.quality_flags,
             "source_url": r.source_url, "source_id": r.source_id,
             "data_kind": r.data_kind} for r in rows]


# ------------------------------------------------------------------- SSE
@router.get("/events/stream")
async def events_stream():
    async def gen():
        async for payload in broker.subscribe():
            yield {"data": payload}
    return EventSourceResponse(gen())


# ------------------------------------------------------------------- helpers
def _device_dict(d: models.Device) -> dict:
    return {"device_id": d.device_id, "name": d.name, "source": d.source,
            "location_label": d.location_label, "latitude": d.latitude, "longitude": d.longitude,
            "coordinates_verified": d.coordinates_verified, "mode": d.mode,
            "connection_status": d.connection_status,
            "last_seen": d.last_seen.isoformat() if d.last_seen else None,
            "firmware": d.firmware, "capabilities": d.capabilities}


def _is_stale(d: models.Device) -> bool:
    if d.last_seen is None:
        return True
    last = d.last_seen if d.last_seen.tzinfo else d.last_seen.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - last).total_seconds() > get_settings().stale_after_seconds
