#!/usr/bin/env bash
# ./dev sim checkpoint <capture|list> — phase snapshots harvested from a green
# simulation run. A checkpoint is the durable workspace (docs/ + .groundwork/,
# NEVER .agents/ — skills are always re-installed fresh) at a point in the flow,
# so a new sandbox can resume mid-flow via `./dev sim run <name> --from=<label>`.
#
# Checkpoints are a cache of the last green run, not a frozen golden. Each one
# records the skill-corpus commit it was harvested under (meta.json), and `list`
# flags checkpoints whose corpus has moved since — stale = re-harvest candidate.
set -e
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

CKPT_DIR="$SANDBOXES/checkpoints"
# The corpus a checkpoint depends on: everything that shapes what a session
# writes into docs/ + .groundwork/.
CORPUS_PATHS=(src/skills src/hidden-skills src/docs src/config)

corpus_commit() {
  git -C "$REPO_ROOT" log -1 --format=%H -- "${CORPUS_PATHS[@]}" 2>/dev/null || echo unknown
}

ACTION="$1"
case "$ACTION" in
  list)
    print_logo "Checkpoints"
    CURRENT="$(corpus_commit)"
    if [ -d "$CKPT_DIR" ] && [ -n "$(ls -A "$CKPT_DIR" 2>/dev/null)" ]; then
      for c in "$CKPT_DIR"/*/; do
        [ -d "$c" ] || continue
        LABEL="$(basename "$c")"
        META="$c/meta.json"
        if [ -f "$META" ]; then
          CAPTURED_COMMIT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("corpus_commit","unknown"))' "$META")"
          CAPTURED_AT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("captured_at","?"))' "$META")"
          if [ "$CAPTURED_COMMIT" = "$CURRENT" ]; then
            print_info "$LABEL · captured $CAPTURED_AT · fresh"
          else
            print_info "$LABEL · captured $CAPTURED_AT · ⚠ STALE (skill corpus moved since capture — re-harvest from a fresh green run)"
          fi
        else
          print_info "$LABEL · ⚠ no meta.json (pre-freshness capture — treat as stale)"
        fi
      done
    else
      print_info "(no checkpoints captured yet)"
    fi
    ;;
  capture)
    CK_NAME="greenfield"
    CK_LABEL=""
    shift
    while [ $# -gt 0 ]; do
      case "$1" in
        --as) CK_LABEL="$2"; shift 2 ;;
        --as=*) CK_LABEL="${1#*=}"; shift ;;
        -*) print_error "Unknown flag: $1"; exit 1 ;;
        *) CK_NAME="$1"; shift ;;
      esac
    done
    SRC="$(sandbox_dir "$CK_NAME")"
    [ -d "$SRC" ] || fail "No sandbox at .sandboxes/$CK_NAME to capture."
    [ -n "$CK_LABEL" ] || fail "Provide a label: ./dev sim checkpoint capture $CK_NAME --as <label>"
    DEST="$CKPT_DIR/$CK_LABEL"
    print_logo "Checkpoint"
    print_step "Capturing .sandboxes/$CK_NAME → checkpoints/$CK_LABEL (docs/ + .groundwork/)"
    rm -rf "$DEST"
    mkdir -p "$DEST"
    [ -d "$SRC/docs" ] && cp -R "$SRC/docs" "$DEST/docs"
    [ -d "$SRC/.groundwork" ] && cp -R "$SRC/.groundwork" "$DEST/.groundwork"
    SOURCE_RUN="$($RECORDS latest "$SRC" --kind sim --field run_id 2>/dev/null || echo "")"
    python3 - "$DEST/meta.json" "$CK_LABEL" "$CK_NAME" "$SOURCE_RUN" "$(corpus_commit)" <<'EOF'
import json, sys
from datetime import datetime, timezone
out, label, name, run_id, commit = sys.argv[1:6]
json.dump({
    "label": label,
    "source_sandbox": name,
    "source_run_id": run_id,
    "corpus_commit": commit,
    "captured_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
}, open(out, "w"), indent=2)
EOF
    print_success "Checkpoint saved: checkpoints/$CK_LABEL (corpus commit stamped)"
    print_info "Resume from it with: ./dev sim run <name> --from=$CK_LABEL"
    ;;
  *)
    fail "Usage: ./dev sim checkpoint <capture [name] --as <label> | list>"
    ;;
esac
