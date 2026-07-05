#!/usr/bin/env bash
# Simulation-harness invariant check, run as part of `./dev ci`.
#
# THE BILLING INVARIANT: harness sessions launch via `claude --bg` only, with a
# scrubbed environment (claude_clean in scripts/sim/_common.sh). Headless print
# mode (`claude -p` / `claude --print`) is BANNED in the harness — it mis-bills
# subscription-OAuth runs as per-token API usage (upstream claude-code issue
# #43333), and the whole point of the harness is that flow tests run on the
# subscription. An invariant that lives only in a comment regresses; this check
# is the comment with teeth.
set -e
cd "$(dirname "$0")/.."

VIOLATIONS="$(grep -rnE 'claude (-p|--print)([^a-zA-Z-]|$)' dev scripts \
  --include='*.sh' --include='*.py' --include='*.js' \
  | grep -v 'check_sim_invariants.sh' || true)"
# The ./dev entry script has no extension — check it explicitly.
DEV_HITS="$(grep -nE 'claude (-p|--print)([^a-zA-Z-]|$)' dev || true)"

if [ -n "$VIOLATIONS$DEV_HITS" ]; then
  echo "✖ Billing invariant violated: 'claude -p' / 'claude --print' found in the harness."
  echo "  Headless print mode mis-bills subscription runs as API usage (claude-code #43333)."
  echo "  Launch sessions with 'claude --bg' via claude_clean (scripts/sim/_common.sh) instead."
  [ -n "$VIOLATIONS" ] && echo "$VIOLATIONS"
  [ -n "$DEV_HITS" ] && echo "dev:$DEV_HITS"
  exit 1
fi
echo "  ✔ sim invariants hold (no claude print-mode usage in the harness)"
