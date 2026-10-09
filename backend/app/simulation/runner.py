"""Live virtual device. Walks the seeded environment and feeds the SAME ingestion
path as real hardware. Adaptive sampling interval comes from the engine's current
state. Start/stop/reset only; a second start replaces the running loop (no duplicates)."""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from app import models
from app.config import get_settings
from app.database.base import SessionLocal
from app.schemas import TelemetryIn
from app.services.events import broker
from app.services.ingestion import get_engine, ingest_reading
from app.simulation.scenarios import environment, scenario_length

SIM_DEVICE_ID = "outfallwatch-sim-01"
BASE_TICK_SECONDS = 0.8  # wall-clock pace of one virtual sample at speed=1


class SimulationRunner:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self.scenario = "B"
        self.intensity = 1.0
        self.speed = 1.0
        self.virtual_t = 0
        self.running = False
        self.started_at: datetime | None = None

    def status(self) -> dict:
        return {"running": self.running, "scenario": self.scenario,
                "intensity": self.intensity, "speed": self.speed,
                "virtual_t": self.virtual_t,
                "length_s": scenario_length(self.scenario),
                "started_at": self.started_at.isoformat() if self.started_at else None,
                "device_id": SIM_DEVICE_ID}

    async def start(self, scenario: str, intensity: float, speed: float) -> dict:
        await self.stop()  # idempotent: never two loops
        self.scenario, self.intensity, self.speed = scenario, intensity, speed
        self.virtual_t = 0
        self.running = True
        self.started_at = datetime.now(timezone.utc)
        # fresh baseline/state for this run
        from app.services.ingestion import _engines
        _engines.pop(SIM_DEVICE_ID, None)
        self._task = asyncio.create_task(self._loop())
        await broker.publish("simulation", {"event": "start", **self.status()})
        return self.status()

    async def stop(self) -> dict:
        self.running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        await broker.publish("simulation", {"event": "stop", **self.status()})
        return self.status()

    def reset(self) -> dict:
        """Clear SIMULATION demo data only. Official/hardware records are never touched."""
        with SessionLocal() as db:
            db.execute(delete(models.MonitoringEvent).where(models.MonitoringEvent.source == "SIMULATION"))
            db.execute(delete(models.SensorReading).where(models.SensorReading.source == "SIMULATION"))
            db.execute(delete(models.Device).where(models.Device.device_id == SIM_DEVICE_ID))
            db.commit()
        from app.services.ingestion import _engines
        _engines.pop(SIM_DEVICE_ID, None)
        self.virtual_t = 0
        return self.status()

    async def _loop(self) -> None:
        cfg = get_settings()
        env = {p.t: p for p in environment(self.scenario, 42, self.intensity)}
        length = scenario_length(self.scenario)
        observed_base = datetime.now(timezone.utc)
        normal_i, storm_i = self._intervals()

        while self.running and self.virtual_t <= length:
            p = env.get(self.virtual_t)
            interval = normal_i
            if p is not None:
                # scenario F: visible telemetry outage 140-170s — stop sending, go stale
                in_outage = self.scenario == "F" and 140 <= self.virtual_t <= 170
                if in_outage:
                    await self._mark_stale(observed_base)
                else:
                    raw_mv = None if p.index is None else 2500 - (p.index / 100.0) * 1500
                    t = TelemetryIn(
                        reading_id=f"sim-{uuid.uuid4().hex[:12]}", device_id=SIM_DEVICE_ID,
                        observed_at=observed_base + timedelta(seconds=self.virtual_t),
                        source="SIMULATION", turbidity_raw_mv=raw_mv, turbidity_index=p.index,
                        temperature_c=p.temperature_c, conductivity_us_cm=p.conductivity_us_cm,
                        storm_active=p.storm_active)
                    mode = await asyncio.to_thread(self._ingest, t)
                    interval = normal_i if mode == "NORMAL" else storm_i
            self.virtual_t += int(interval)
            await asyncio.sleep(BASE_TICK_SECONDS / self.speed)

        self.running = False
        await broker.publish("simulation", {"event": "complete", **self.status()})

    def _intervals(self) -> tuple[int, int]:
        with SessionLocal() as db:
            s = db.execute(select(models.DeviceSettings).limit(1)).scalar_one_or_none()
            if s:
                return int(s.normal_interval_seconds), int(s.storm_interval_seconds)
        return 10, 2

    @staticmethod
    def _ingest(t: TelemetryIn) -> str:
        with SessionLocal() as db:
            reading, _ = ingest_reading(db, t)
            return reading.mode

    async def _mark_stale(self, _base) -> None:
        with SessionLocal() as db:
            dev = db.get(models.Device, SIM_DEVICE_ID)
            if dev:
                dev.connection_status = "STALE"
                db.commit()
        await broker.publish("device", {"device_id": SIM_DEVICE_ID, "connection_status": "STALE"})


runner = SimulationRunner()
