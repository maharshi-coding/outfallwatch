"""OutfallWatch FastAPI app."""
from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.config import get_settings
from app.database.base import SessionLocal, init_db
from app.integrations import providers

# Built frontend (from `npm run build`). Overridable via FRONTEND_DIST for container deploys.
FRONTEND_DIST = Path(os.environ.get(
    "FRONTEND_DIST", Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    from app.services.events import broker
    broker.set_loop(asyncio.get_running_loop())  # let threadpool ingestion reach SSE
    with SessionLocal() as db:
        # offline-safe seeds so every panel is populated with no network
        providers.seed_offline(db)
    # live fetches best-effort in the background (fall back to fixtures offline)
    asyncio.create_task(_background_refresh())
    yield


async def _background_refresh() -> None:
    try:
        with SessionLocal() as db:
            await asyncio.to_thread(providers.refresh_noaa, db)
            await asyncio.to_thread(providers.refresh_gcoos, db)
    except Exception:
        pass  # never let a flaky network break startup


app = FastAPI(title="OutfallWatch API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


# ---- Serve the built frontend from the same origin (one URL for the whole app) ----
# When frontend/dist exists (production/container), serve it; API stays under /api, /docs.
# When it doesn't (local dev), the Vite server on :5173 handles the UI instead.
if (FRONTEND_DIST / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        # /api/* and /docs are matched earlier; everything else is the SPA.
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)  # hashed assets — safe to cache
        # index.html must never be cached, or browsers keep loading stale asset hashes
        # after a redeploy. The hashed /assets/* it references stay cacheable.
        return FileResponse(FRONTEND_DIST / "index.html", headers={"Cache-Control": "no-cache"})
else:
    @app.get("/")
    def root() -> dict:
        return {"name": "OutfallWatch API", "docs": "/docs", "health": "/api/health",
                "note": "frontend/dist not built; run `npm run build` or use the Vite dev server"}
