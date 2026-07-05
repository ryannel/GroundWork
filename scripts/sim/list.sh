#!/usr/bin/env bash
# ./dev sim list — every sandbox's latest recorded run: the "what has been
# proven lately" view. Reads run records only; needs no live sessions.
set -e
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_logo "Sim Runs"
[ -d "$SANDBOXES" ] || { print_info "(no .sandboxes directory yet)"; exit 0; }
$RECORDS list-all "$SANDBOXES" | while IFS= read -r line; do print_info "$line"; done
