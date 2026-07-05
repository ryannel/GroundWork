#!/usr/bin/env bash
# ./dev sim follow [name] — block until the sandbox's latest sim session
# finishes (or stalls / times out), then print a completion digest: phases
# completed, commit count, and the tail of the conversation. Designed to be
# the single call a chat-driving agent runs (in background) after `sim run`.
#
# Exit codes: 0 done · 3 stalled · 4 timeout.
set -e
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

NAME="greenfield"; TIMEOUT=3600; STALL=600; KIND="sim"
for arg in "$@"; do
  case "$arg" in
    --timeout=*) TIMEOUT="${arg#*=}" ;;
    --stall=*) STALL="${arg#*=}" ;;
    --judge) KIND="judge" ;;
    -*) print_error "Unknown flag: $arg"; exit 2 ;;
    *) NAME="$arg" ;;
  esac
done
DIR="$(require_sandbox "$NAME")"

RUN_ID="$($RECORDS latest "$DIR" --kind "$KIND" --field run_id)" \
  || fail "No recorded $KIND run for .sandboxes/$NAME — launch one with ./dev sim run $NAME."
SHORT="$($RECORDS latest "$DIR" --kind "$KIND" --field session_short)"
SID="$($RECORDS latest "$DIR" --kind "$KIND" --field session_id)"
OUTCOME="$($RECORDS latest "$DIR" --kind "$KIND" --field outcome)"

print_logo "Sim Follow"
if [ "$OUTCOME" != "running" ]; then
  print_info "Run $RUN_ID already finished (outcome: $OUTCOME) — printing the digest."
else
  print_step "Waiting on session $SHORT ($RUN_ID) · timeout ${TIMEOUT}s · stall threshold ${STALL}s..."
  set +e
  wait_for_session "$DIR" "$SHORT" "$SID" "$TIMEOUT" "$STALL"
  RC=$?
  set -e
  case "$RC" in
    0) $RECORDS set-outcome "$DIR" "$RUN_ID" done; print_success "Session finished." ;;
    3) $RECORDS set-outcome "$DIR" "$RUN_ID" stalled
       print_error "Session appears STALLED (no transcript activity for ${STALL}s, still registered as running)."
       print_info "Inspect it: claude logs $SHORT   ·   stop it: ./dev sim stop $NAME"
       exit 3 ;;
    4) print_error "Timed out after ${TIMEOUT}s — the session is still running."
       print_info "Keep waiting: ./dev sim follow $NAME --timeout=...   ·   stop it: ./dev sim stop $NAME"
       exit 4 ;;
    5) $RECORDS set-outcome "$DIR" "$RUN_ID" blocked
       print_error "Session is BLOCKED — it stopped on something it cannot do unattended."
       print_info "Read why: claude logs $SHORT   ·   then stop it: ./dev sim stop $NAME"
       exit 5 ;;
  esac
fi

# Fold the session's isolated worktree output back into the sandbox root.
absorb_worktrees "$DIR"

# ── Completion digest ─────────────────────────────────────────────────────────
print_step "Digest for .sandboxes/$NAME:"
python3 - "$DIR" <<'EOF'
import json, sys
from pathlib import Path
dir = Path(sys.argv[1])
sf = dir / ".groundwork" / "config" / "state.json"
if sf.exists():
    try:
        state = json.loads(sf.read_text())
        done = state.get("completed", [])
        print(f"  phases completed: {', '.join(done) if done else '(none recorded)'}"
              f"  ·  project_type: {state.get('project_type')}")
    except json.JSONDecodeError:
        print("  state.json unparseable")
else:
    print("  (no state.json)")
EOF
COMMITS="$(git -C "$DIR" rev-list --count HEAD 2>/dev/null || echo 0)"
print_info "git commits: $COMMITS"
if [ -n "$SID" ]; then
  print_step "Conversation tail:"
  python3 "$REPO_ROOT/scripts/render_transcript.py" "$DIR" --tail 6 "$SID" || true
fi
print_info "Next: ./dev sim assess $NAME"
