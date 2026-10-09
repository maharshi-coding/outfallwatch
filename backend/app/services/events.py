"""Tiny in-process pub/sub for SSE. One broker, fan-out to per-client queues.

ponytail: in-memory broadcast, single-process only. Swap for Redis pub/sub if the
backend is ever scaled to multiple workers.
"""
from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from datetime import datetime, timezone


class EventBroker:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Captured at startup so threadpool/sync code can still reach the event loop."""
        self._loop = loop

    async def publish(self, event_type: str, data: dict) -> None:
        payload = json.dumps({"type": event_type, "ts": datetime.now(timezone.utc).isoformat(),
                              "data": data}, default=str)
        for q in list(self._subscribers):
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                pass  # slow client drops frames rather than stalling the pipeline

    def publish_soon(self, event_type: str, data: dict) -> None:
        """Fire-and-forget from ANY thread. Telemetry ingestion (hardware POST handlers and
        the simulator's to_thread call) runs without a running loop, so we schedule onto the
        captured main loop instead of silently dropping the frame."""
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.publish(event_type, data))
            return
        except RuntimeError:
            pass
        if self._loop is not None:
            asyncio.run_coroutine_threadsafe(self.publish(event_type, data), self._loop)

    async def subscribe(self) -> AsyncIterator[str]:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._subscribers.add(q)
        try:
            # greet immediately so the client knows the stream is live
            yield json.dumps({"type": "connected", "ts": datetime.now(timezone.utc).isoformat()})
            while True:
                try:
                    yield await asyncio.wait_for(q.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    yield json.dumps({"type": "heartbeat",
                                      "ts": datetime.now(timezone.utc).isoformat()})
        finally:
            self._subscribers.discard(q)


broker = EventBroker()
