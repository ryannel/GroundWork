#!/usr/bin/env bash
# Team skill pipeline: scripts/skill-src is the source of truth; .agents/skills
# is a build product. Overwrites same-named skills; never deletes others.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT_DIR/scripts/skill-src"
DEST="$ROOT_DIR/.agents/skills"
[ -d "$SRC" ] || { echo "no skill-src to sync"; exit 0; }
mkdir -p "$DEST"
for d in "$SRC"/*/; do
  name="$(basename "$d")"
  rm -rf "$DEST/$name"
  cp -R "$d" "$DEST/$name"
  echo "synced $name"
done
