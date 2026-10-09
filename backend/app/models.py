"""All persisted entities (section 7.1). One module — the schema is small enough."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Source labels used everywhere. Never blend these silently.
SOURCE_HARDWARE = "HARDWARE"
SOURCE_SIMULATION = "SIMULATION"
SOURCE_IMPORTED_OFFICIAL = "IMPORTED_OFFICIAL"
SOURCE_TEST_FIXTURE = "TEST_FIXTURE"


class Device(Base):
    __tablename__ = "devices"

    device_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="OutfallWatch Device")
    source: Mapped[str] = mapped_column(String, default=SOURCE_SIMULATION)
    capabilities: Mapped[dict] = mapped_column(JSON, default=dict)
    firmware: Mapped[str] = mapped_column(String, default="n/a")
    location_label: Mapped[str] = mapped_column(String, default="Simulated Corpus Christi Outfall — Demo Site")
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    coordinates_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    connection_status: Mapped[str] = mapped_column(String, default="UNKNOWN")
    mode: Mapped[str] = mapped_column(String, default="NORMAL")
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    reading_id: Mapped[str] = mapped_column(String, primary_key=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.device_id"), index=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    source: Mapped[str] = mapped_column(String)  # HARDWARE | SIMULATION
    turbidity_raw_mv: Mapped[float | None] = mapped_column(Float, nullable=True)
    turbidity_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    conductivity_us_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    calibration_id: Mapped[str | None] = mapped_column(String, nullable=True)
    mode: Mapped[str] = mapped_column(String, default="NORMAL")
    storm_active: Mapped[bool] = mapped_column(Boolean, default=False)
    sample_interval_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    quality_flags: Mapped[list] = mapped_column(JSON, default=list)


class ExternalObservation(Base):
    """Official data (NOAA/TCEQ/GCOOS/weather). Kept strictly apart from SensorReading."""

    __tablename__ = "external_observations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String, index=True)  # NOAA | TCEQ | GCOOS | WEATHER
    station_or_dataset: Mapped[str] = mapped_column(String)
    parameter: Mapped[str] = mapped_column(String)
    value_numeric: Mapped[float | None] = mapped_column(Float, nullable=True)
    value_text: Mapped[str | None] = mapped_column(String, nullable=True)
    unit: Mapped[str | None] = mapped_column(String, nullable=True)
    observed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    quality_flags: Mapped[list] = mapped_column(JSON, default=list)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    source_id: Mapped[str | None] = mapped_column(String, nullable=True)
    data_kind: Mapped[str] = mapped_column(String, default=SOURCE_IMPORTED_OFFICIAL)  # or TEST_FIXTURE


class MonitoringEvent(Base):
    __tablename__ = "monitoring_events"

    event_id: Mapped[str] = mapped_column(String, primary_key=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.device_id"), index=True)
    source: Mapped[str] = mapped_column(String)
    event_type: Mapped[str] = mapped_column(String, default="TURBIDITY_ANOMALY")
    severity: Mapped[str] = mapped_column(String)  # ELEVATED | ALERT
    state: Mapped[str] = mapped_column(String, default="ACTIVE")  # ACTIVE | ACKNOWLEDGED | RESOLVED
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    trigger_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    recovery_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    reading_ids: Mapped[list] = mapped_column(JSON, default=list)
    explanation: Mapped[str] = mapped_column(Text, default="")
    recommendation: Mapped[str] = mapped_column(Text, default="")
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)


class Calibration(Base):
    __tablename__ = "calibrations"

    calibration_id: Mapped[str] = mapped_column(String, primary_key=True)
    device_id: Mapped[str] = mapped_column(String, index=True)
    v_clear_mv: Mapped[float] = mapped_column(Float)
    v_cloudy_mv: Mapped[float] = mapped_column(Float)
    polarity_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    method: Mapped[str] = mapped_column(String, default="two-point relative index")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    valid: Mapped[bool] = mapped_column(Boolean, default=True)


class DeviceSettings(Base):
    __tablename__ = "device_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String, index=True, default="global")
    version: Mapped[int] = mapped_column(Integer, default=1)
    escalate_index_delta: Mapped[float] = mapped_column(Float)
    escalate_persist_seconds: Mapped[float] = mapped_column(Float)
    recover_index_delta: Mapped[float] = mapped_column(Float)
    recover_persist_seconds: Mapped[float] = mapped_column(Float)
    normal_interval_seconds: Mapped[float] = mapped_column(Float, default=10.0)
    storm_interval_seconds: Mapped[float] = mapped_column(Float, default=2.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class EfficiencyRun(Base):
    __tablename__ = "efficiency_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    strategy: Mapped[str] = mapped_column(String)  # fixed | adaptive
    scenario: Mapped[str] = mapped_column(String)
    seed: Mapped[int] = mapped_column(Integer)
    samples: Mapped[int] = mapped_column(Integer)
    messages: Mapped[int] = mapped_column(Integer)
    bytes_tx: Mapped[int] = mapped_column(Integer)
    processing_ms: Mapped[float] = mapped_column(Float)
    alert_latency_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    missed_anomalies: Mapped[int] = mapped_column(Integer, default=0)
    energy_mwh_estimated: Mapped[float | None] = mapped_column(Float, nullable=True)
    energy_kind: Mapped[str] = mapped_column(String, default="ESTIMATED")
    assumptions: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class IntegrationStatus(Base):
    __tablename__ = "integration_status"

    provider: Mapped[str] = mapped_column(String, primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String, default="NOT_IMPLEMENTED")  # WORKING|PARTIAL|UNAVAILABLE|NOT_IMPLEMENTED
    capabilities: Mapped[list] = mapped_column(JSON, default=list)
    last_attempted: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_succeeded: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    latest_observation_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(String, nullable=True)
