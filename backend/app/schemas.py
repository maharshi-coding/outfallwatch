"""Pydantic request/response models. Strict validation at the trust boundary."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class TelemetryIn(BaseModel):
    """Canonical device packet — identical for HARDWARE and SIMULATION sources."""

    reading_id: str = Field(min_length=1, max_length=128)
    device_id: str = Field(min_length=1, max_length=128)
    # Optional: a device without a synced RTC omits this; the backend stamps receive time.
    observed_at: datetime | None = None
    source: str = "HARDWARE"
    turbidity_raw_mv: float | None = Field(default=None, ge=0, le=5000)
    turbidity_index: float | None = Field(default=None, ge=0, le=100)
    temperature_c: float | None = Field(default=None, ge=-5, le=60)
    conductivity_us_cm: float | None = Field(default=None, ge=0, le=200000)
    calibration_id: str | None = None
    storm_active: bool = False
    sample_interval_seconds: float | None = Field(default=None, ge=0, le=3600)
    quality_flags: list[str] = Field(default_factory=list)

    @field_validator("source")
    @classmethod
    def _source(cls, v: str) -> str:
        if v not in ("HARDWARE", "SIMULATION"):
            raise ValueError("source must be HARDWARE or SIMULATION")
        return v


class ReadingOut(BaseModel):
    reading_id: str
    device_id: str
    observed_at: datetime
    received_at: datetime
    source: str
    turbidity_raw_mv: float | None
    turbidity_index: float | None
    temperature_c: float | None
    conductivity_us_cm: float | None
    mode: str
    storm_active: bool
    sample_interval_seconds: float | None
    quality_flags: list[str]

    model_config = {"from_attributes": True}


class EventOut(BaseModel):
    event_id: str
    device_id: str
    source: str
    event_type: str
    severity: str
    state: str
    started_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    explanation: str
    recommendation: str
    acknowledged: bool
    reading_ids: list[str]

    model_config = {"from_attributes": True}


class CalibrationIn(BaseModel):
    device_id: str
    v_clear_mv: float = Field(gt=0, le=5000)
    v_cloudy_mv: float = Field(ge=0, le=5000)
    polarity_verified: bool = False
    method: str = "two-point relative index"


class ConfigurationOut(BaseModel):
    escalate_index_delta: float
    escalate_persist_seconds: float
    recover_index_delta: float
    recover_persist_seconds: float
    normal_interval_seconds: float
    storm_interval_seconds: float
    version: int


class ConfigurationPatch(BaseModel):
    escalate_index_delta: float | None = Field(default=None, gt=0, le=100)
    escalate_persist_seconds: float | None = Field(default=None, gt=0, le=600)
    recover_index_delta: float | None = Field(default=None, ge=0, le=100)
    recover_persist_seconds: float | None = Field(default=None, gt=0, le=600)
    normal_interval_seconds: float | None = Field(default=None, gt=0, le=600)
    storm_interval_seconds: float | None = Field(default=None, gt=0, le=600)


class SimulationStart(BaseModel):
    scenario: str = "B"  # A..F
    intensity: float = Field(default=1.0, ge=0.1, le=3.0)
    speed: float = Field(default=1.0, ge=0.25, le=20.0)  # wall-clock compression

    @field_validator("scenario")
    @classmethod
    def _scn(cls, v: str) -> str:
        if v.upper() not in {"A", "B", "C", "D", "E", "F"}:
            raise ValueError("scenario must be one of A-F")
        return v.upper()


class EnergyCompareIn(BaseModel):
    scenario: str = "B"
    seed: int = 42
    intensity: float = Field(default=1.0, ge=0.1, le=3.0)
