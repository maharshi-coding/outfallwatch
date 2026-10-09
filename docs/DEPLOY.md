# Deploy — getting a live demo link

OutfallWatch now runs as **one service**: FastAPI serves the built React frontend from the
same origin, so a single URL gives you the dashboard + API + SSE + simulator. The frontend
calls the API with relative paths (`/api/...`), so there's nothing to reconfigure per host.

> The **ESP32 hardware is physically local** — it can't live "in the cloud." A shared link
> runs the **simulator** (judges click *Launch Storm Demo* from anywhere). To show *real*
> hardware on a link, use the tunnel path below (the board keeps posting to your laptop).

---

## Path A — Instant public link via a tunnel  ⭐ best for a live presentation (+ hardware)

Run the whole app locally, then expose port 8000.

```bash
./scripts/serve_prod.sh                 # builds frontend + serves everything on :8000
```
In another terminal:
```bash
# Cloudflare quick tunnel — no account needed, prints an https URL
brew install cloudflared
cloudflared tunnel --url http://localhost:8000
#   -> https://random-words.trycloudflare.com   (share this)
```
(ngrok alternative: `brew install ngrok`, add your free authtoken, then `ngrok http 8000`.)

- Judges open the link and click **Launch Storm Demo** — full pipeline, live.
- **Your ESP32 still posts to your laptop** (`http://<laptop-ip>:8000/api/telemetry`) over the
  LAN, so real hardware readings show up on the *same public link*. Both HW + SIM at once.
- Trade-off: the link lives only while your laptop + tunnel run, and the quick-tunnel URL is
  random/ephemeral (fine for a demo; regenerate before presenting).

## Path B — Persistent hosted link (always-ish on)

Deploy the single container ([`Dockerfile`](../Dockerfile)). Pick one host:

| Host | How | Notes |
| --- | --- | --- |
| **Render** | New → Web Service → connect GitHub repo → it detects the Dockerfile → deploy | easiest free tier; sleeps after ~15 min idle (cold start ~30–60 s) |
| **Fly.io** | `fly launch` then `fly deploy` (from this folder) | good SSE support; deploys from local dir |
| **Google Cloud Run** | `gcloud run deploy outfallwatch --source . --allow-unauthenticated` | scales to zero; pay-per-use (effectively free at demo scale) |
| **Hugging Face Spaces** | create a **Docker** Space, push the repo | free, stays warm longer than Render |

Optional env vars: `DEVICE_API_KEY` (match it in the firmware), `NOAA_STATION_ID`,
`GCOOS_STATION`. `PORT` is injected by the host automatically.

**Hardware → a hosted link:** the board would have to POST to the public `https://…` URL.
The current firmware uses plain HTTP; HTTPS on the ESP32 needs `WiFiClientSecure` +
`setInsecure()`. So for a hosted link, demo with the simulator — or ask and I'll add HTTPS
to the firmware.

---

## Good to know (both paths)
- **SSE** may be buffered by some free proxies; the dashboard **auto-falls back to REST
  polling** (~2 s), so it keeps updating either way.
- The **SQLite DB is ephemeral** on free hosts (resets on redeploy/sleep). That's fine — it
  reseeds NOAA/GCOOS and the simulator regenerates everything. Don't rely on persistence.
- **Security is demo-grade:** `/api/telemetry` needs the device key, but the simulation
  controls are open — anyone with the link can start/reset the demo. Acceptable for judging,
  not for production.
- **Warm it up** right before judging if you're on a sleep-after-idle free tier (open the
  link once so the cold start happens before, not during, your demo).

## Verified in this build
- ✅ Single-origin serving (`/`, client routes like `/coastal`, and `/api/*`) tested locally.
- ⚠️ The Docker image itself was **not** build-tested here (no Docker in the build env); the
  Dockerfile is standard multi-stage. Run `docker build -t outfallwatch .` once to confirm
  before relying on Path B.
