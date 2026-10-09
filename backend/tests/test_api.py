"""API + integration + green-ai tests against an isolated temp DB."""
import os
import tempfile
from datetime import datetime, timezone

import pytest

# point the app at a throwaway sqlite file BEFORE importing app modules
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"

from fastapi.testclient import TestClient  # noqa: E402

from app.database.base import SessionLocal, init_db  # noqa: E402
from app.integrations import providers  # noqa: E402
from app.main import app  # noqa: E402

init_db()
# mirror the offline seeds that lifespan does (TestClient without `with` skips lifespan)
with SessionLocal() as _db:
    providers.seed_offline(_db)
client = TestClient(app)
KEY = {"X-Device-Key": "demo-device-key"}


def _packet(reading_id: str, index: float, storm=False):
    return {"reading_id": reading_id, "device_id": "test-dev",
            "observed_at": datetime.now(timezone.utc).isoformat(), "source": "HARDWARE",
            "turbidity_index": index, "temperature_c": 25.0, "storm_active": storm}


def test_health():
    assert client.get("/api/health").json()["status"] == "ok"


def test_telemetry_requires_key():
    assert client.post("/api/telemetry", json=_packet("r1", 20)).status_code == 401
    assert client.post("/api/telemetry", json=_packet("r1", 20), headers=KEY).status_code == 200


def test_telemetry_accepts_missing_timestamp():
    # a device with no synced RTC omits observed_at -> backend stamps receive time
    pkt = _packet("no-ts", 22)
    del pkt["observed_at"]
    r = client.post("/api/telemetry", json=pkt, headers=KEY)
    assert r.status_code == 200 and r.json()["accepted"] is True


def test_telemetry_rejects_out_of_range():
    bad = _packet("r2", 20)
    bad["turbidity_index"] = 999
    assert client.post("/api/telemetry", json=bad, headers=KEY).status_code == 422


def test_telemetry_idempotent_reading_id():
    client.post("/api/telemetry", json=_packet("dup", 21), headers=KEY)
    client.post("/api/telemetry", json=_packet("dup", 21), headers=KEY)
    rows = client.get("/api/devices/test-dev/readings").json()
    assert sum(1 for r in rows if r["reading_id"] == "dup") == 1


def test_calibration_validation():
    assert client.post("/api/calibrations",
                       json={"device_id": "d", "v_clear_mv": 1000, "v_cloudy_mv": 2000}).status_code == 422
    assert client.post("/api/calibrations",
                       json={"device_id": "d", "v_clear_mv": 2500, "v_cloudy_mv": 1000}).status_code == 200


def test_config_patch_enforces_hysteresis():
    bad = client.patch("/api/configuration", json={"recover_index_delta": 99})
    assert bad.status_code == 422
    ok = client.patch("/api/configuration", json={"escalate_index_delta": 40})
    assert ok.status_code == 200 and ok.json()["escalate_index_delta"] == 40


def test_integrations_scope_is_noaa_and_gcoos_only():
    data = client.get("/api/integrations/status").json()["providers"]
    provs = {p["provider"] for p in data}
    assert provs == {"NOAA", "GCOOS"}                 # trimmed scope: only these two
    # removed resources must be gone entirely
    assert not ({"TCEQ", "OPEN_METEO", "GBIF", "INATURALIST", "NASA_EARTHDATA",
                 "WEATHER", "FREENOVE", "CODECARBON", "TFLM_ESP_NN"} & provs)


def test_external_observations_are_labelled():
    # offline seed => both sources show labelled fixtures, never LIVE
    for provider in ("NOAA", "GCOOS"):
        obs = client.get(f"/api/external-observations?provider={provider}").json()
        assert obs and all(o["data_kind"] == "TEST_FIXTURE" for o in obs)


def test_green_ai_compare_deterministic_and_labelled():
    a = client.post("/api/energy/compare", json={"scenario": "B", "seed": 42}).json()
    b = client.post("/api/energy/compare", json={"scenario": "B", "seed": 42}).json()
    assert a["fixed"]["messages"] == b["fixed"]["messages"]           # reproducible
    assert a["adaptive"]["messages"] < a["fixed"]["messages"]         # adaptive sends fewer
    assert a["adaptive"]["energy_kind"] == "ESTIMATED"               # never 'MEASURED'
    assert a["true_anomaly_onset_s"] is not None
    assert a["adaptive"]["missed_anomalies"] == 0                     # still catches the event


def test_simulation_status_default_stopped():
    assert client.get("/api/simulation/status").json()["running"] is False
