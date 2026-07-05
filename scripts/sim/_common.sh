#!/usr/bin/env bash
# Shared library for the ./dev sim verb scripts. Sourced, never executed.
#
# Owns the three invariants every verb depends on:
#   - claude_clean: launch `claude` with a scrubbed environment (billing invariant)
#   - run records: thin wrappers around records.py
#   - session state: one way to ask "where is that background session now?"

# Resolve the repo root from this file's location so verbs work from any cwd.
SIM_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SIM_LIB_DIR/../.." && pwd)"
SANDBOXES="$REPO_ROOT/.sandboxes"
RECORDS="python3 $SIM_LIB_DIR/records.py"

# UI helpers (same fallbacks as ./dev).
if [ -f "$REPO_ROOT/scripts/_ui.sh" ]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/scripts/_ui.sh"
else
  print_logo() { echo "GroundWork Dev CLI"; }
  print_step() { echo "-> $1"; }
  print_substep() { echo "   $1"; }
  print_info() { echo "  $1"; }
  print_success() { echo "OK: $1"; }
  print_error() { echo "ERROR: $1"; }
  fail() { echo "ERROR: $1"; exit 1; }
fi

# ── Billing invariant ─────────────────────────────────────────────────────────
# Launch the `claude` CLI with a scrubbed environment. When a sim verb runs
# inside a Claude Code session (an agent driving the harness from chat), the
# child would inherit that session's plumbing — ANTHROPIC_BASE_URL,
# CLAUDE_CODE_* session vars, or a stray ANTHROPIC_API_KEY that would silently
# switch billing from the subscription to API tokens. Scrubbing makes a child
# launched from chat identical to one launched from a plain terminal: it
# authenticates with the machine's own subscription OAuth login.
# CLAUDE_CONFIG_DIR is kept — it points at the user's config home, not a session.
# Sessions are launched with `claude --bg` ONLY; `claude` print mode is banned
# here (it mis-bills subscription runs as API usage — claude-code issue #43333)
# and scripts/check_sim_invariants.sh enforces that in CI.
claude_clean() {
  local unset_flags=() v
  while IFS= read -r v; do
    [ "$v" = "CLAUDE_CONFIG_DIR" ] && continue
    unset_flags+=(-u "$v")
  done < <(env | grep -oE '^(ANTHROPIC|CLAUDE)[A-Za-z0-9_]*' | sort -u)
  env "${unset_flags[@]}" claude "$@"
}

require_claude() {
  command -v claude >/dev/null 2>&1 || fail "claude CLI not found on PATH."
}

# ── Sandbox resolution ────────────────────────────────────────────────────────
sandbox_dir() { echo "$SANDBOXES/$1"; }

require_sandbox() {
  local dir; dir="$(sandbox_dir "$1")"
  [ -d "$dir" ] || fail "No sandbox at .sandboxes/$1. Create one with: ./dev sim run $1"
  echo "$dir"
}

# Read a field ("path" or "suite") from the sandbox's sim marker.
marker_get() { # <sandbox_dir> <field>
  python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get(sys.argv[2],""))' \
    "$1/.groundwork-sim.json" "$2" 2>/dev/null || true
}

# ── Session launch & state ────────────────────────────────────────────────────
# Launch a detached background session from inside a sandbox and record it.
# Prints claude's own "backgrounded · <id> · <name>" block, then the run_id.
# Sets: LAUNCHED_RUN_ID, LAUNCHED_SHORT_ID.
launch_bg() { # <sandbox_dir> <kind sim|judge> <session_name> <model> <until> <prompt>
  local dir="$1" kind="$2" name="$3" model="$4" until="$5" prompt="$6"
  require_claude
  local out
  out="$(cd "$dir" && claude_clean --bg -n "$name" --model "$model" --permission-mode bypassPermissions "$prompt")"
  echo "$out"
  LAUNCHED_SHORT_ID="$(echo "$out" | sed -n 's/^backgrounded · \([a-z0-9]*\).*/\1/p' | head -1)"
  # Enrich with the full session id from the live registry (best-effort).
  local session_id=""
  if [ -n "$LAUNCHED_SHORT_ID" ]; then
    session_id="$(claude_clean agents --json --all --cwd "$dir" 2>/dev/null \
      | python3 -c 'import json,sys
short=sys.argv[1]
try: rows=json.load(sys.stdin)
except Exception: rows=[]
for r in rows:
    if r.get("id")==short: print(r.get("sessionId","")); break' "$LAUNCHED_SHORT_ID" || true)"
  fi
  local pathv suitev
  pathv="$(marker_get "$dir" path)"; suitev="$(marker_get "$dir" suite)"
  LAUNCHED_RUN_ID="$($RECORDS add "$dir" --kind "$kind" --path "${pathv:-?}" --suite "${suitev:-?}" \
    --model "$model" --until "$until" --session-short "${LAUNCHED_SHORT_ID:-}" \
    --session-id "${session_id:-}" --session-name "$name")"
  print_substep "run recorded: $LAUNCHED_RUN_ID (.simrun/runs.jsonl)"
}

# Print the live state of a session under a sandbox: "running", "done",
# "blocked" (finished its turn but waiting on something it can't do unattended),
# or "gone" (the live registry no longer knows it; treat as finished).
session_state() { # <sandbox_dir> <short_id>
  claude_clean agents --json --all --cwd "$1" 2>/dev/null \
    | python3 -c 'import json,sys
short=sys.argv[1]
try: rows=json.load(sys.stdin)
except Exception: rows=[]
for r in rows:
    if r.get("id")==short:
        s=r.get("state")
        print("done" if s in ("done","stopped") else "blocked" if s=="blocked" else "running")
        sys.exit()
print("gone")' "$2"
}

# Fold a finished session's isolated output back into the sandbox root.
# Background sessions edit inside a git worktree (<sandbox>/.agents/worktrees/*,
# branch worktree-<name>) — the sandbox root stays the single source of truth,
# so after every session the harness: harvests untracked .simrun/ outputs (the
# judge's verdict), commits any stragglers the session wrote but didn't commit,
# merges the session branch into the root checkout, and removes the worktree.
absorb_worktrees() { # <sandbox_dir>
  local dir="$1" wt branch
  git -C "$dir" worktree prune >/dev/null 2>&1 || true
  while IFS= read -r wt; do
    [ -d "$wt" ] || continue
    # Only session worktrees INSIDE this sandbox. Matching on the substring
    # alone is wrong — the sandbox's own path can contain ".agents/worktrees/"
    # when the framework checkout itself is a worktree.
    case "$wt" in
      "$dir"/.agents/worktrees/*|"$dir"/.claude/worktrees/*) ;;
      *) continue ;;
    esac
    if [ -f "$wt/.simrun/verdict.md" ]; then
      mkdir -p "$dir/.simrun"
      cp "$wt/.simrun/verdict.md" "$dir/.simrun/verdict.md"
    fi
    branch="$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    if [ -n "$branch" ] && [ "$branch" != "HEAD" ]; then
      if [ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]; then
        git -C "$wt" add -A
        git -C "$wt" -c user.email=sim@groundwork.dev -c user.name=sim \
          commit -q -m "chore(sim): absorb uncommitted session output" || true
      fi
      if ! git -C "$dir" -c user.email=sim@groundwork.dev -c user.name=sim \
          merge -q --no-edit "$branch" 2>/dev/null; then
        git -C "$dir" merge --abort >/dev/null 2>&1 || true
        print_error "Could not merge session branch '$branch' into the sandbox — inspect it manually."
        continue
      fi
      print_substep "absorbed session worktree ($branch → sandbox root)"
    fi
    git -C "$dir" worktree remove --force "$wt" >/dev/null 2>&1 || true
    [ -n "$branch" ] && git -C "$dir" branch -q -D "$branch" >/dev/null 2>&1 || true
  done < <(git -C "$dir" worktree list --porcelain 2>/dev/null \
             | sed -n 's/^worktree //p' || true)
}

# The Claude Code transcript file for a session. Sessions start under the
# sandbox's cwd-encoded projects dir, but EnterWorktree re-homes the transcript
# to the worktree's slug — so fall back to a global search by session id.
transcript_path() { # <sandbox_dir> <session_id>
  local slug direct hit
  slug="$(echo "$1" | sed 's/[\/.]/-/g')"
  direct="$HOME/.claude/projects/$slug/$2.jsonl"
  if [ -f "$direct" ] || [ -z "$2" ]; then
    echo "$direct"
    return
  fi
  hit="$(ls "$HOME/.claude/projects"/*/"$2.jsonl" 2>/dev/null | head -1)"
  echo "${hit:-$direct}"
}

# Block until a session finishes, blocks, stalls, or times out.
# Returns 0 done/gone · 3 stalled · 4 timeout · 5 blocked.
wait_for_session() { # <sandbox_dir> <short_id> <session_id> [timeout_s=3600] [stall_s=600] [interval_s=20]
  local dir="$1" short="$2" sid="$3" timeout="${4:-3600}" stall="${5:-600}" interval="${6:-20}"
  local waited=0 state tfile mtime now
  while :; do
    state="$(session_state "$dir" "$short")"
    if [ "$state" = "done" ] || [ "$state" = "gone" ]; then return 0; fi
    if [ "$state" = "blocked" ]; then return 5; fi
    # Re-resolve each poll — EnterWorktree re-homes the transcript mid-run.
    tfile="$(transcript_path "$dir" "$sid")"
    if [ -f "$tfile" ]; then
      mtime="$(stat -f %m "$tfile" 2>/dev/null || stat -c %Y "$tfile" 2>/dev/null || echo 0)"
      now="$(date +%s)"
      if [ "$mtime" -gt 0 ] && [ $((now - mtime)) -ge "$stall" ]; then return 3; fi
    fi
    [ "$waited" -ge "$timeout" ] && return 4
    sleep "$interval"; waited=$((waited + interval))
  done
}
