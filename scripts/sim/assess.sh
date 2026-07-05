#!/usr/bin/env bash
# ./dev sim assess [name] — one verb, the whole verdict. From a finished (or
# still-running) sim, produce the complete review bundle:
#
#   .sandboxes/<name>-review/
#     conversation.md   ← rendered transcript (+ subagents/)
#     checklist.md      ← structural check, bound-aware for --until runs
#     verdict.md        ← fresh-context judge verdict (durable copy)
#     findings.md       ← grading scaffold — the driver's remaining work
#
# After this, nothing mechanical remains: the driver reads and grades.
set -e
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

NAME="greenfield"; NOJUDGE=0; JMODEL="opus"; TIMEOUT=3600; STALL=600
for arg in "$@"; do
  case "$arg" in
    --no-judge) NOJUDGE=1 ;;
    --judge-model=*) JMODEL="${arg#*=}" ;;
    --timeout=*) TIMEOUT="${arg#*=}" ;;
    --stall=*) STALL="${arg#*=}" ;;
    -*) print_error "Unknown flag: $arg"; exit 2 ;;
    *) NAME="$arg" ;;
  esac
done
DIR="$(require_sandbox "$NAME")"
OUT="$SANDBOXES/$NAME-review"

print_logo "Sim Assess"

# ── The run under assessment ──────────────────────────────────────────────────
RUN_ID=""; SID=""; UNTIL=""; RPATH="?"; RSUITE="?"; RMODEL="?"
if $RECORDS latest "$DIR" --kind sim >/dev/null 2>&1; then
  RUN_ID="$($RECORDS latest "$DIR" --kind sim --field run_id)"
  SID="$($RECORDS latest "$DIR" --kind sim --field session_id)"
  UNTIL="$($RECORDS latest "$DIR" --kind sim --field until)"
  RPATH="$($RECORDS latest "$DIR" --kind sim --field path)"
  RSUITE="$($RECORDS latest "$DIR" --kind sim --field suite)"
  RMODEL="$($RECORDS latest "$DIR" --kind sim --field model)"
  OUTCOME="$($RECORDS latest "$DIR" --kind sim --field outcome)"
  if [ "$OUTCOME" = "running" ]; then
    SHORT="$($RECORDS latest "$DIR" --kind sim --field session_short)"
    print_step "Sim session still running — waiting for it first (timeout ${TIMEOUT}s)..."
    set +e; wait_for_session "$DIR" "$SHORT" "$SID" "$TIMEOUT" "$STALL"; RC=$?; set -e
    case "$RC" in
      0) $RECORDS set-outcome "$DIR" "$RUN_ID" done ;;
      3) $RECORDS set-outcome "$DIR" "$RUN_ID" stalled
         fail "Sim session is stalled — inspect (claude logs) or stop (./dev sim stop $NAME) before assessing." ;;
      4) fail "Timed out waiting for the sim session — re-run assess later or raise --timeout." ;;
      5) $RECORDS set-outcome "$DIR" "$RUN_ID" blocked
         fail "Sim session is blocked — read why (claude logs $SHORT), stop it, then re-assess." ;;
    esac
  fi
else
  print_info "(no run record — attended run or pre-records session; assessing the latest transcript)"
fi

# Fold any finished session worktrees back into the sandbox root before reading it.
absorb_worktrees "$DIR"

# ── Transcript bundle (render wipes OUT — preserve any in-progress grading) ───
FINDINGS_STASH=""
if [ -f "$OUT/findings.md" ]; then
  FINDINGS_STASH="$(mktemp)"
  cp "$OUT/findings.md" "$FINDINGS_STASH"
fi
print_step "Rendering transcript..."
python3 "$REPO_ROOT/scripts/render_transcript.py" "$DIR" "$OUT" $SID
if [ -n "$FINDINGS_STASH" ]; then
  cp "$FINDINGS_STASH" "$OUT/findings.md"; rm -f "$FINDINGS_STASH"
  print_substep "existing findings.md preserved (grading in progress)"
fi

# ── Structural checklist, bound-aware ─────────────────────────────────────────
print_step "Running structural checklist${UNTIL:+ (bounded: $UNTIL)}..."
if [ -n "$UNTIL" ]; then
  python3 "$REPO_ROOT/scripts/sandbox_checklist.py" "$DIR" "$OUT/checklist.md" --until "$UNTIL"
else
  python3 "$REPO_ROOT/scripts/sandbox_checklist.py" "$DIR" "$OUT/checklist.md"
fi

# ── Fresh-context judge ───────────────────────────────────────────────────────
if [ "$NOJUDGE" -eq 1 ]; then
  print_substep "skipping judge (--no-judge)"
else
  bash "$SIM_LIB_DIR/judge.sh" "$NAME" "--model=$JMODEL"
  JRUN="$($RECORDS latest "$DIR" --kind judge --field run_id)"
  JSHORT="$($RECORDS latest "$DIR" --kind judge --field session_short)"
  JSID="$($RECORDS latest "$DIR" --kind judge --field session_id)"
  print_step "Waiting for the judge..."
  set +e; wait_for_session "$DIR" "$JSHORT" "$JSID" 1800 "$STALL"; RC=$?; set -e
  if [ "$RC" -eq 0 ]; then
    $RECORDS set-outcome "$DIR" "$JRUN" done
  elif [ "$RC" -eq 5 ]; then
    $RECORDS set-outcome "$DIR" "$JRUN" blocked
    print_error "Judge session is blocked (claude logs $JSHORT) — continuing without a verdict."
  else
    $RECORDS set-outcome "$DIR" "$JRUN" stalled
    print_error "Judge session did not finish cleanly — continuing without a verdict."
  fi
  # Harvest the verdict from the judge's isolated worktree.
  absorb_worktrees "$DIR"
  if [ -f "$DIR/.simrun/verdict.md" ]; then
    cp "$DIR/.simrun/verdict.md" "$OUT/verdict.md"
    cp "$DIR/.simrun/verdict.md" "$DIR/.simrun/verdict-${JRUN}.md"
    print_substep "verdict harvested → $OUT/verdict.md"
  else
    print_error "Judge finished but wrote no .simrun/verdict.md — read its session (claude logs $JSHORT)."
  fi
fi

# ── Findings scaffold ─────────────────────────────────────────────────────────
if [ -f "$OUT/findings.md" ]; then
  print_substep "findings.md already present — not overwriting"
else
  python3 - "$REPO_ROOT/tests/evals/templates/findings.md" "$OUT/findings.md" \
    "${RUN_ID:-unrecorded}" "$RPATH" "$RSUITE" "$RMODEL" "${UNTIL:-full run}" <<'EOF'
import re, sys
from datetime import datetime, timezone
tpl, out, run_id, path, suite, model, until = sys.argv[1:8]
text = re.sub(r"^<!--[\s\S]*?-->\s*", "", open(tpl).read())
for k, v in {
    "runId": run_id, "path": path, "suite": suite, "model": model, "until": until,
    "assessedAt": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
}.items():
    text = text.replace("{{%s}}" % k, v)
open(out, "w").write(text)
EOF
  print_substep "findings scaffold seeded → $OUT/findings.md"
fi

[ -n "$RUN_ID" ] && $RECORDS set-outcome "$DIR" "$RUN_ID" assessed
print_success "Review bundle ready at .sandboxes/$NAME-review/"
print_info "Read conversation.md + checklist.md + verdict.md, then grade findings.md."
print_info "Every finding gets a generalized fix or an explicit disposition — that closes the loop."
