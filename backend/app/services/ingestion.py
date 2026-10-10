"""Single ingestion path: validated telemetry -> engine -> DB -> SSE.
Both HARDWARE POSTs and the SIMULATION loop call ingest_reading(). Only one engine
instance per device lives in memory and holds the running baseline/state."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.config import get_settings
from app.monitoring.engine import DetectionEngine, EngineConfig, calibrated_index
from app.schemas import TelemetryIn
from app.services.events import broker

_engines: dict[str, DetectionEngine] = {}


def _engine_config(db: Session) -> EngineConfig:
    s = db.execute(select(models.DeviceSettings).limit(1)).scalar_one_or_none()
    cfg = get_settings()
    if s is None:
        return EngineConfig(escalate_index_delta=cfg.escalate_index_delta,
                            escalate_persist_seconds=cfg.escalate_persist_seconds,
                            recover_index_delta=cfg.recover_index_delta,
                            recover_persist_seconds=cfg.recover_persist_seconds,
                            baseline_window=cfg.baseline_window, median_window=cfg.median_window)
    return EngineConfig(escalate_index_delta=s.escalate_index_delta,
                        escalate_persist_seconds=s.escalate_persist_seconds,
                        recover_index_delta=s.recover_index_delta,
                        recover_persist_seconds=s.recover_persist_seconds,
                        baseline_window=cfg.baseline_window, median_window=cfg.median_window)


def get_engine(db: Session, device_id: str) -> DetectionEngine:
    eng = _engines.get(device_id)
    if eng is None:
        eng = DetectionEngine(_engine_config(db))
        _engines[device_id] = eng
    return eng


def reset_engines() -> None:
    _engines.clear()


def _resolve_index(db: Session, t: TelemetryIn) -> tuple[float | None, list[str]]:
    flags = list(t.quality_flags)
    if t.turbidity_index is not None:
        return t.turbidity_index, flags
    if t.turbidity_raw_mv is None:
        return None, flags
    cal = db.execute(
        select(models.Calibration)
        .where(models.Calibration.device_id == t.device_id, models.Calibration.valid.is_(True))
        .order_by(models.Calibration.created_at.desc())
    ).scalars().first()
    if cal is None:
        flags.append("NO_CALIBRATION")
        return None, flags
    try:
        return calibrated_index(t.turbidity_raw_mv, cal.v_clear_mv, cal.v_cloudy_mv), flags
    except ValueError:
        flags.append("BAD_CALIBRATION")
        return None, flags


def ingest_reading(db: Session, t: TelemetryIn) -> tuple[models.SensorReading, models.MonitoringEvent | None]:
    device = db.get(models.Device, t.device_id)
    if device is None:
        # Label honestly by source: a real board on a bench is NOT the simulated outfall site,
        # and the column default says "Simulated ...", which would mislabel HARDWARE devices.
        device = models.Device(
            device_id=t.device_id, source=t.source,
            location_label=("Bench Prototype — Tabletop Demo (not field-deployed)"
                            if t.source == "HARDWARE"
                            else "Simulated Corpus Christi Outfall — Demo Site"),
            latitude=27.5801, longitude=-97.2167)  # Bob Hall Pier area (demo pin, unverified)
        db.add(device)

    index, flags = _resolve_index(db, t)
    # a device without a synced clock omits observed_at -> use receive time honestly
    observed = t.observed_at or datetime.now(timezone.utc)

    reading = models.SensorReading(
        reading_id=t.reading_id, device_id=t.device_id, observed_at=observed,
        received_at=datetime.now(timezone.utc), source=t.source,
        turbidity_raw_mv=t.turbidity_raw_mv, turbidity_index=index,
        temperature_c=t.temperature_c, conductivity_us_cm=t.conductivity_us_cm,
        calibration_id=t.calibration_id, storm_active=t.storm_active,
        sample_interval_seconds=t.sample_interval_seconds, quality_flags=flags)
    # idempotent on reading_id
    if db.get(models.SensorReading, t.reading_id) is None:
        db.add(reading)

    engine = get_engine(db, t.device_id)
    # NO_FLOW is the firmware's flow gate saying there was no water to measure, so the
    # null index is expected rather than a sensor failure.
    result = engine.process(observed_at=observed, turbidity_index=index,
                            storm_active=t.storm_active,
                            idle="NO_FLOW" in (t.quality_flags or []))
    reading.mode = result.state

    device.source = t.source
    device.last_seen = reading.received_at
    device.mode = result.state
    device.connection_status = "ONLINE"

    event = _apply_event(db, device, result, reading)
    db.commit()

    broker.publish_soon("reading", {
        "reading_id": reading.reading_id, "device_id": reading.device_id,
        "observed_at": reading.observed_at.isoformat(), "source": reading.source,
        "turbidity_index": reading.turbidity_index, "temperature_c": reading.temperature_c,
        "conductivity_us_cm": reading.conductivity_us_cm, "mode": result.state,
        "health": result.health, "baseline": result.baseline, "delta": result.delta,
        "storm_active": reading.storm_active})
    return reading, event


def _apply_event(db: Session, device: models.Device, result, reading) -> models.MonitoringEvent | None:
    cfg = get_settings()
    active = db.execute(
        select(models.MonitoringEvent).where(
            models.MonitoringEvent.device_id == device.device_id,
            models.MonitoringEvent.state != "RESOLVED")
        .order_by(models.MonitoringEvent.started_at.desc())).scalars().first()

    if result.event_action in ("OPEN", "ESCALATE"):
        if active is None:
            active = models.MonitoringEvent(
                event_id=f"evt-{uuid.uuid4().hex[:12]}", device_id=device.device_id,
                source=reading.source, severity=result.severity or "ELEVATED",
                trigger_threshold=cfg.escalate_index_delta,
                recovery_threshold=cfg.recover_index_delta, reading_ids=[reading.reading_id],
                explanation=result.explanation, recommendation=result.recommendation)
            db.add(active)
        else:
            active.severity = result.severity or active.severity
            active.explanation = result.explanation or active.explanation
            active.reading_ids = (active.reading_ids or []) + [reading.reading_id]
        active.updated_at = reading.received_at
        db.flush()
        broker.publish_soon("alert", _event_dict(active))
        return active

    if result.event_action == "RESOLVE" and active is not None:
        active.state = "RESOLVED"
        active.resolved_at = reading.received_at
        active.updated_at = reading.received_at
        active.explanation = result.explanation or active.explanation
        db.flush()
        broker.publish_soon("alert", _event_dict(active))
        return active
    return active


def _event_dict(e: models.MonitoringEvent) -> dict:
    return {"event_id": e.event_id, "device_id": e.device_id, "severity": e.severity,
            "state": e.state, "explanation": e.explanation, "source": e.source,
            "started_at": e.started_at.isoformat(),
            "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None}
