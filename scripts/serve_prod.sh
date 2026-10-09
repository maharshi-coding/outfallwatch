#!/usr/bin/env bash
# Build the frontend and serve the WHOLE app (API + SSE + dashboard) from one port.
# This is the single-origin server you expose via a tunnel or deploy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8000}"

cd "$ROOT/frontend" && { [ -d node_modules ] || npm ci; } && npm run build

cd "$ROOT/backend"
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate
pip install -q -r requirements.txt
echo "OutfallWatch (full app) on http://localhost:$PORT  — expose this with a tunnel."
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
