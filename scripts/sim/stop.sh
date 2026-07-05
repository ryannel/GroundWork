#!/usr/bin/env bash
# ./dev sim stop [name] — stop the sandbox's latest recorded session (sim or,
# with --judge, the judge session) and stamp the run record.
set -e
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

NAME="greenfield"; KIND="sim"
for arg in "$@"; do
  case "$arg" in
    --judge) KIND="judge" ;;
    -*) print_error "Unknown flag: $arg"; exit 2 ;;
    *) NAME="$arg" ;;
  esac
done
DIR="$(require_sandbox "$NAME")"

RUN_ID="$($RECORDS latest "$DIR" --kind "$KIND" --field run_id)" \
  || fail "No recorded $KIND run for .sandboxes/$NAME."
SHORT="$($RECORDS latest "$DIR" --kind "$KIND" --field session_short)"
[ -n "$SHORT" ] || fail "Run $RUN_ID has no recorded session id."

print_step "Stopping session $SHORT ($RUN_ID)..."
claude_clean stop "$SHORT" || print_info "(session already gone — stamping the record anyway)"
$RECORDS set-outcome "$DIR" "$RUN_ID" stopped
print_success "Stopped. Record updated."
