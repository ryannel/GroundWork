"""
Init smoke test (Slice 7c)

Verifies that `npx groundwork init` deploys the expected documentation tree into
a fresh project directory. Checks:

- Every path listed in §5.2 of the documentation plan exists with non-empty content
- llms.txt exists at the project root
- Re-running init does not overwrite user-edited files (idempotency)

This test must run in under 30 seconds.
"""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"

EXPECTED_DOCS = [
    "docs/principles/index.md",
    "docs/principles/foundations/code-craft.md",
    "docs/principles/foundations/documentation.md",
    "docs/principles/foundations/testing.md",
    "docs/principles/foundations/product-engineering.md",
    "docs/principles/quality/reliability.md",
    "docs/principles/quality/observability.md",
    "docs/principles/quality/performance.md",
    "docs/principles/quality/security.md",
    "docs/principles/quality/privacy.md",
    "docs/principles/delivery/devex.md",
    "docs/principles/delivery/progressive-delivery.md",
    "docs/principles/delivery/platform.md",
    "docs/principles/system-design/hexagonal-architecture.md",
    "docs/principles/system-design/api-design.md",
    "docs/principles/system-design/integration-patterns.md",
    "docs/principles/system-design/real-time.md",
    "docs/principles/system-design/data-engineering.md",
    "docs/principles/ai-native/ai-engineering.md",
    "docs/principles/ai-native/agent-native-systems.md",
    "docs/principles/stack/postgres.md",
    "docs/ways-of-working/how-we-work.md",
    "docs/ways-of-working/units-of-work.md",
    "docs/ways-of-working/documentation.md",
    "llms.txt",
]


@pytest.fixture()
def init_sandbox():
    d = tempfile.mkdtemp(prefix="gw-init-smoke-")
    yield Path(d)
    shutil.rmtree(d, ignore_errors=True)


def _run_init(project_dir: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", str(CLI), "init"],
        cwd=project_dir,
        capture_output=True,
        text=True,
        timeout=30,
    )


def test_init_deploys_doc_tree(init_sandbox):
    result = _run_init(init_sandbox)
    assert result.returncode == 0, f"init failed\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"

    for rel_path in EXPECTED_DOCS:
        full_path = init_sandbox / rel_path
        assert full_path.exists(), f"Expected file missing after init: {rel_path}"
        assert full_path.stat().st_size > 0, f"File is empty after init: {rel_path}"


def test_init_does_not_overwrite_user_edits(init_sandbox):
    result = _run_init(init_sandbox)
    assert result.returncode == 0, f"First init failed\n{result.stderr}"

    sentinel = "USER_EDIT_SENTINEL"
    target = init_sandbox / "docs" / "principles" / "index.md"
    original = target.read_text()
    target.write_text(original + f"\n{sentinel}\n")
    mtime_before = target.stat().st_mtime

    result2 = _run_init(init_sandbox)
    assert result2.returncode == 0, f"Second init failed\n{result2.stderr}"

    assert sentinel in target.read_text(), "User edit was overwritten on second init"
    assert target.stat().st_mtime == mtime_before, "File mtime changed on second init"


def test_init_idempotent_llms_txt(init_sandbox):
    """llms.txt must not be overwritten on a second init run."""
    result = _run_init(init_sandbox)
    assert result.returncode == 0

    llms = init_sandbox / "llms.txt"
    assert llms.exists(), "llms.txt not created by init"
    original_content = llms.read_text()
    llms.write_text(original_content + "\n# user addition\n")

    result2 = _run_init(init_sandbox)
    assert result2.returncode == 0

    assert "# user addition" in llms.read_text(), "llms.txt user addition was overwritten"
