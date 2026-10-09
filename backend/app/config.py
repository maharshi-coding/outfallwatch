"""Central configuration. All values overridable via environment / .env."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "OutfallWatch"
    database_url: str = f"sqlite:///{BACKEND_DIR / 'outfallwatch.db'}"

    # Device ingestion key. Simplified auth for a local demo (documented in API.md).
    device_api_key: str = "demo-device-key"

    # CORS for the Vite dev server.
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # NOAA Tides & Currents — water levels. 8775296 = USS Lexington, Corpus Christi Bay
    # (verified to report real-time + historical water_level).
    noaa_station_id: str = "8775296"
    noaa_base_url: str = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"

    # GCOOS ERDDAP — Conrad Blucher Institute (Corpus Christi) near-real-time stations.
    gcoos_base_url: str = "https://erddap.gcoos.org/erddap"
    gcoos_station: str = "CBI_042"  # independent CBI data, not NOAA-republished
    http_timeout_seconds: float = 10.0

    # Monitoring defaults (demo values, NOT regulatory standards).
    baseline_window: int = 12
    median_window: int = 5
    escalate_index_delta: float = 30.0
    escalate_persist_seconds: float = 15.0
    recover_index_delta: float = 15.0
    recover_persist_seconds: float = 12.0
    stale_after_seconds: float = 30.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
