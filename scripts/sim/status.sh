#!/usr/bin/env bash
# ./dev sim status [name] [--json] — where is that run now?
# Merges the durable run record (.simrun/) with the live session registry, so it
# keeps answering after `claude agents` has forgotten the session.
set -e
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

NAME="greenfield"; JSON=0
for arg in "$@"; do
  case "$arg" in
    --json) JSON=1 ;;
    -*) print_error "Unknown flag: $arg"; exit 2 ;;
    *) NAME="$arg" ;;
  esac
done
DIR="$(require_sandbox "$NAME")"

if [ "$JSON" -eq 1 ]; then
  LIVE="$(claude_clean agents --json --all --cwd "$DIR" 2>/dev/null || echo '[]')"
  python3 - "$DIR" "$LIVE" <<'EOF'
import json, sys
from pathlib import Path
dir = Path(sys.argv[1]); live = json.loads(sys.argv[2])
latest_f = dir / ".simrun" / "latest.json"
latest = json.loads(latest_f.read_text()) if latest_f.exists() else {}
by_short = {r.get("id"): r for r in live}
out = {}
for kind, rec in latest.items():
    out[kind] = {**rec, "live": by_short.get(rec.get("session_short"))}
print(json.dumps(out, indent=2))
EOF
  exit 0
fi

print_logo "Sim Status"
print_step "Recorded runs for .sandboxes/$NAME:"
if [ -f "$DIR/.simrun/runs.jsonl" ]; then
  $RECORDS list-runs "$DIR" | while IFS= read -r line; do print_info "$line"; done
else
  print_info "(no recorded runs — launched before run records existed, or never launched)"
fi
print_step "Live sessions under the sandbox:"
LIVE_JSON="$(claude_clean agents --json --all --cwd "$DIR" 2>/dev/null || echo '[]')"
LIVE_LINES="$(python3 - "$LIVE_JSON" <<'PY' || true
import json, sys
try:
    rows = json.loads(sys.argv[1])
except Exception:
    rows = []
for r in rows:
    print(f"{r.get('id', '?')} · {r.get('name', '?')} · state={r.get('state', '?')}")
PY
)"
if [ -n "$LIVE_LINES" ]; then
  echo "$LIVE_LINES" | while IFS= read -r line; do print_info "$line"; done
else
  print_info "(none — the live registry has moved on; the run records above are the durable truth)"
fi
