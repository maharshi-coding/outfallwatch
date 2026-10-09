#!/usr/bin/env bash
# Start backend + frontend for local development. Ctrl-C stops both.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT/backend"
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate
pip install -q -r requirements.txt
uvicorn app.main:app --port 8000 --reload &
BACK=$!

cd "$ROOT/frontend"
[ -d node_modules ] || npm install
npm run dev &
FRONT=$!

trap 'kill $BACK $FRONT 2>/dev/null' EXIT
echo "Backend  : http://localhost:8000/docs"
echo "Frontend : http://localhost:5173"
wait
