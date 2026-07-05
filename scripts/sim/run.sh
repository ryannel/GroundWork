#!/usr/bin/env bash
# ./dev sim run — provision a simulation sandbox and launch it in a detached
# real Claude Code session, one command. The trigger end of the driver loop:
#
#   ./dev sim run → ./dev sim follow → ./dev sim assess → grade findings.md
#
# Provisioning delegates to `./dev sandbox` (the provisioning primitive stays
# single-sourced there); this script owns launch + run records. Re-provisioning
# is destructive by design — a simulation wants a fresh instrument — but the
# sandbox's .simrun/ run history is preserved across it.
set -e
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

usage() {
  cat <<'EOF'
Usage: ./dev sim run [name] [flags]

  --path=greenfield|brownfield|delivery   flow path (default greenfield)
  --brownfield | --delivery               shorthands for --path=...
  --suite=<suite>       scenario suite (default: per-path default)
  --repo=owner/repo[@ref]  brownfield baseline from a real GitHub repo
  --from=<label>        resume from a captured checkpoint
  --model=<m>           session model (default sonnet; pin opus for review-grade runs)
  --until=<phase>       bound the run: stop after this phase's output is committed
  --attended            provision + seed only; print kickoff instructions for a human session
  --reuse               skip provisioning; launch in the existing sandbox as-is
  --no-build            skip the generator build during provisioning
EOF
  exit 2
}

NAME=""
FLOW_PATH=""
SUITE=""
REPO=""
FROM=""
MODEL="sonnet"
UNTIL=""
ATTENDED=0
REUSE=0
NOBUILD=0
for arg in "$@"; do
  case "$arg" in
    --path=*) FLOW_PATH="${arg#*=}" ;;
    --brownfield) FLOW_PATH="brownfield" ;;
    --delivery) FLOW_PATH="delivery" ;;
    --suite=*) SUITE="${arg#*=}" ;;
    --repo=*) REPO="${arg#*=}"; FLOW_PATH="brownfield" ;;
    --from=*) FROM="${arg#*=}" ;;
    --model=*) MODEL="${arg#*=}" ;;
    --until=*) UNTIL="${arg#*=}" ;;
    --attended) ATTENDED=1 ;;
    --reuse) REUSE=1 ;;
    --no-build) NOBUILD=1 ;;
    -h|--help) usage ;;
    -*) print_error "Unknown flag: $arg"; usage ;;
    *) NAME="$arg" ;;
  esac
done
[ -n "$FLOW_PATH" ] || FLOW_PATH="greenfield"
[ -n "$NAME" ] || NAME="$FLOW_PATH"
DIR="$(sandbox_dir "$NAME")"

# ── Provision (unless --reuse) ────────────────────────────────────────────────
if [ "$REUSE" -eq 1 ]; then
  [ -d "$DIR" ] || fail "No sandbox at .sandboxes/$NAME to reuse."
  [ -f "$DIR/.claude/commands/simulate-$(marker_get "$DIR" path).md" ] \
    || fail ".sandboxes/$NAME has no seeded kickoff — run without --reuse to provision."
else
  # Preserve run history across the destructive re-provision.
  STASH=""
  if [ -d "$DIR/.simrun" ]; then
    STASH="$(mktemp -d)"
    mv "$DIR/.simrun" "$STASH/.simrun"
  fi
  PROVISION_ARGS=("$NAME" --force)
  case "$FLOW_PATH" in
    brownfield) [ -n "$REPO" ] && PROVISION_ARGS+=("--repo=$REPO") || PROVISION_ARGS+=(--brownfield) ;;
    delivery) PROVISION_ARGS+=(--delivery) ;;
  esac
  if [ -n "$SUITE" ]; then PROVISION_ARGS+=("--simulate=$SUITE"); else PROVISION_ARGS+=(--simulate); fi
  [ -n "$FROM" ] && PROVISION_ARGS+=("--from=$FROM")
  [ "$NOBUILD" -eq 1 ] && PROVISION_ARGS+=(--no-build)
  "$REPO_ROOT/dev" sandbox "${PROVISION_ARGS[@]}"
  if [ -n "$STASH" ]; then
    mv "$STASH/.simrun" "$DIR/.simrun"
    rmdir "$STASH" 2>/dev/null || true
  fi
fi

FLOW_PATH="$(marker_get "$DIR" path)"
[ -n "$FLOW_PATH" ] || fail "Sandbox has no .groundwork-sim.json marker — provisioning failed?"

# ── Attended mode: hand the keyboard to a human ───────────────────────────────
if [ "$ATTENDED" -eq 1 ]; then
  print_success "Sandbox seeded for an attended run."
  print_info "Open a NEW Claude Code chat from .sandboxes/$NAME and run /simulate-$FLOW_PATH"
  [ -n "$UNTIL" ] && print_info "Bound it yourself: /simulate-$FLOW_PATH Bounded run: stop after the $UNTIL phase output is committed and approved."
  print_info "Afterwards: ./dev sim assess $NAME"
  exit 0
fi

# ── Launch ────────────────────────────────────────────────────────────────────
KICKOFF="/simulate-$FLOW_PATH"
if [ -n "$UNTIL" ]; then
  KICKOFF="$KICKOFF Bounded run: stop after the $UNTIL phase output is committed and approved — do not start the next phase."
fi
print_step "Launching background simulation session (model: $MODEL)..."
launch_bg "$DIR" sim "sim-$NAME" "$MODEL" "$UNTIL" "$KICKOFF"
print_success "Simulation running."
print_info "Follow it:   ./dev sim follow $NAME     (blocks until done, prints a digest)"
print_info "Peek at it:  ./dev sim status $NAME"
print_info "Assess it:   ./dev sim assess $NAME     (transcript + checklist + judge + findings)"
