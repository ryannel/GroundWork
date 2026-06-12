"""Engineer-skill sync gates.

Two invariants keep the engineer skills trustworthy:

1. Sync anchors — every `sync-anchor.md` pins the SHA-256 of the principle
   files its skill embeds. A principle edit without a skill review (and hash
   update) fails here. Delegates to scripts/check_sync_anchors.py so the gate
   and the local tool share one implementation.

2. Mirror identity — `src/hidden-skills/` is the canon for the three engineer
   skills that also live in `.agents/skills/` for in-repo use. The mirrors are
   copies, never edited directly; any byte difference fails here.
"""

import filecmp
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent

MIRRORED_SKILLS = [
    "groundwork-go-engineer",
    "groundwork-python-engineer",
    "groundwork-nextjs-engineer",
]


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


def _assert_dirs_identical(canon: Path, mirror: Path) -> list[str]:
    cmp = filecmp.dircmp(canon, mirror)
    diffs = []
    if cmp.left_only:
        diffs.append(f"only in canon {canon}: {cmp.left_only}")
    if cmp.right_only:
        diffs.append(f"only in mirror {mirror}: {cmp.right_only}")
    for name in cmp.common_files:
        if not filecmp.cmp(canon / name, mirror / name, shallow=False):
            diffs.append(f"content differs: {name}")
    for sub in cmp.common_dirs:
        diffs.extend(_assert_dirs_identical(canon / sub, mirror / sub))
    return diffs


def test_engineer_skill_mirrors_are_byte_identical():
    failures = []
    for skill in MIRRORED_SKILLS:
        canon = REPO_ROOT / "src" / "hidden-skills" / skill
        mirror = REPO_ROOT / ".agents" / "skills" / skill
        assert canon.is_dir(), f"canon missing: {canon}"
        assert mirror.is_dir(), f"mirror missing: {mirror}"
        diffs = _assert_dirs_identical(canon, mirror)
        if diffs:
            failures.append(f"[{skill}]\n  " + "\n  ".join(diffs))
    assert not failures, (
        "Engineer-skill mirror drift — edit src/hidden-skills/ (the canon) and "
        "copy over .agents/skills/, never the reverse:\n" + "\n".join(failures)
    )
