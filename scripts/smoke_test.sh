#!/usr/bin/env bash
# Hit the key endpoints to confirm a running backend. Usage: ./smoke_test.sh [base_url]
set -euo pipefail
BASE="${1:-http://localhost:8000}"
echo "health:        $(curl -s "$BASE/api/health")"
echo "start sim:     $(curl -s -X POST "$BASE/api/simulation/start" -H 'content-type: application/json' -d '{"scenario":"B","speed":8}' | head -c 80)"
sleep 8
echo "alerts:        $(curl -s "$BASE/api/alerts" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(len(d),"event(s)",d[0]["severity"] if d else "")')"
echo "green ai:      $(curl -s -X POST "$BASE/api/energy/compare" -H 'content-type: application/json' -d '{"scenario":"B"}' | python3 -c 'import sys,json;d=json.load(sys.stdin);print("msg reduction",d["reductions_pct"]["messages"],"%")')"
curl -s -X POST "$BASE/api/simulation/reset" >/dev/null && echo "reset:         ok"
