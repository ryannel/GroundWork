#!/usr/bin/env python3
"""
Verify that engineer skill sync anchors match the current SHA-256 of their
referenced principle files. Fails with a non-zero exit code and a clear
message naming the skill and mismatched file.

Usage: python scripts/check_sync_anchors.py
"""

import hashlib
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
ANCHOR_GLOB = "src/hidden-skills/*/sync-anchor.md"
TABLE_ROW = re.compile(r"^\|\s*([^|]+?)\s*\|\s*([a-f0-9]{64})\s*\|")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def check_anchor(anchor_path: Path) -> list[str]:
    skill_name = anchor_path.parent.name
    failures = []
    for line in anchor_path.read_text().splitlines():
        m = TABLE_ROW.match(line)
        if not m:
            continue
        principle_rel, stored_hash = m.group(1).strip(), m.group(2).strip()
        principle_path = REPO_ROOT / principle_rel
        if not principle_path.exists():
            failures.append(
                f"  [{skill_name}] {principle_rel}: file not found"
            )
            continue
        actual_hash = sha256(principle_path)
        if actual_hash != stored_hash:
            failures.append(
                f"  [{skill_name}] {principle_rel}: hash mismatch\n"
                f"    stored:  {stored_hash}\n"
                f"    current: {actual_hash}\n"
                f"  Review {anchor_path.relative_to(REPO_ROOT)} and update "
                f"the skill knowledge before updating the hash."
            )
    return failures


def main() -> int:
    anchors = sorted(REPO_ROOT.glob(ANCHOR_GLOB))
    if not anchors:
        print("No sync-anchor.md files found — nothing to check.")
        return 0

    all_failures = []
    for anchor in anchors:
        all_failures.extend(check_anchor(anchor))

    if all_failures:
        print("Sync anchor check FAILED:\n")
        for f in all_failures:
            print(f)
        print(
            f"\n{len(all_failures)} mismatch(es). Update the skill, then "
            "regenerate hashes with: shasum -a 256 <file>"
        )
        return 1

    print(f"Sync anchor check passed ({len(anchors)} anchor(s) verified).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
