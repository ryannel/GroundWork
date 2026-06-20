"""Engineer-skill sync gate.

Sync anchors — every `sync-anchor.md` pins the SHA-256 of the principle
files its skill embeds. A principle edit without a skill review (and hash
update) fails here. Delegates to scripts/check_sync_anchors.py so the gate
and the local tool share one implementation.
"""

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent


def test_sync_anchors_match_principle_files():
    result = subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / "check_sync_anchors.py")],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        "Sync anchor check failed — a pinned principle file changed without a "
        f"skill review:\n{result.stdout}{result.stderr}"
    )
