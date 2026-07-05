#!/usr/bin/env bash
# ./dev sim judge [name] [--model=<m>] — launch a FRESH background session that
# runs /judge in the sandbox. Fresh context is the point: a judge sharing the
# context that wrote the docs would rubber-stamp its own work.
#
# The judge writes its verdict durably to <sandbox>/.simrun/verdict.md (the
# rubric requires it); `./dev sim assess` harvests that into the review bundle.
# Default model is opus — a verdict is review-grade work.
set -e
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

NAME="greenfield"; MODEL="opus"
for arg in "$@"; do
  case "$arg" in
    --model=*) MODEL="${arg#*=}" ;;
    -*) print_error "Unknown flag: $arg"; exit 2 ;;
    *) NAME="$arg" ;;
  esac
done
DIR="$(require_sandbox "$NAME")"
[ -f "$DIR/.claude/commands/judge.md" ] \
  || fail "No judge command in .sandboxes/$NAME — provision with ./dev sim run (or --attended)."

# The run the verdict should cite (best-effort — a judge can run unattributed).
SIM_RUN="$($RECORDS latest "$DIR" --kind sim --field run_id 2>/dev/null || echo "")"
rm -f "$DIR/.simrun/verdict.md"

print_logo "Sim Judge"
print_step "Launching fresh background judge session (model: $MODEL)..."
launch_bg "$DIR" judge "judge-$NAME" "$MODEL" "" "/judge ${SIM_RUN:-unattributed}"
print_info "Follow it:  ./dev sim follow $NAME --judge"
print_info "Verdict lands at .sandboxes/$NAME/.simrun/verdict.md — or run ./dev sim assess $NAME to collect everything."
