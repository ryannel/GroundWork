"""The milestone bet-progress stub ships with an ACTIVE, red Layer 1 (interface)
alongside the already-active Layer 2 (API) — B2 of docs/plans/review-throughput.md.
Before this change, Layer 1 shipped commented out with only Layer 2 live, so a
milestone could green with zero user-observable assertion (finding F2).

This renders the shipped template the way `bet.ts`'s `newMilestone` does — a
literal `@@KEY@@` substring substitution, no regex, no escaping — and proves the
rendered file is valid Python that fails pytest with exactly two failures, not
an import or fixture error (the same bar `step-01-readiness.md` Step 0.5 sets:
"every stub is red ... because the implementation does not exist, not an import
or fixture error").
"""

import ast
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
TEMPLATE = (
    REPO_ROOT
    / "src"
    / "generators"
    / "workspace-dev-cli"
    / "files"
    / "scripts"
    / "cli"
    / "templates"
    / "milestone-test.pytmpl.template"
)

# Mirrors `substitute()` in cli-src/src/commands/bet.ts exactly: a literal
# `@@KEY@@` substring replace per token, applied in `newMilestone`'s order.
def substitute(template: str, tokens: dict) -> str:
    out = template
    for k, v in tokens.items():
        out = out.replace(f"@@{k}@@", v)
    return out


def render(n: str, milestone: str, bet: str) -> str:
    template = TEMPLATE.read_text()
    return substitute(
        template,
        {
            "BET": bet,
            "MILESTONE": milestone,
            "MILESTONE_IDENT": milestone.replace("-", "_"),
            "N": n,
        },
    )


# A minimal conftest so the rendered file fails on its own explicit
# `pytest.fail(...)` calls, never on a missing fixture — `cluster`/`api_client`
# are the only fixtures the rendered stub's signatures request. Shaped like the
# real `tests/system/conftest.py` fixtures (plain `@pytest.fixture` on an async
# def), which is why `asyncio_mode = auto` below is required, mirroring the
# generated project's own `tests/pyproject.toml`.
CONFTEST = '''
import pytest

@pytest.fixture
def cluster():
    yield None

@pytest.fixture
async def api_client():
    yield None
'''

PYTEST_INI = '''
[pytest]
asyncio_mode = auto
'''


def test_template_placeholders_survive_substitution(tmp_path):
    """Every `@@TOKEN@@` the template carries is resolved by bet.ts's token set —
    a leftover placeholder is a SyntaxError or a silently-wrong identifier."""
    rendered = render("1", "event-intake", "notifications")
    assert "@@" not in rendered, rendered
    ast.parse(rendered)


def test_layer_1_interface_ships_active_not_commented():
    rendered = render("1", "event-intake", "notifications")
    tree = ast.parse(rendered)
    names = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
    assert "test_milestone_1_event_intake_interface" in names, names
    assert "test_milestone_1_event_intake_api" in names, names
    # Not merely present as a name — present as live source, not inside a
    # comment (ast.parse would already have skipped a commented-out def, but
    # this asserts the positive: an uncommented `def` line exists verbatim).
    assert "def test_milestone_1_event_intake_interface(cluster):" in rendered
    assert "# def test_milestone_1_event_intake_interface" not in rendered


def test_collapse_note_present_for_cli_and_agentic_tracks():
    """The docstring documents the cli/agentic-protocol collapse rule so a
    deliberate layer removal leaves a trace instead of a silent deletion."""
    rendered = render("1", "event-intake", "notifications")
    assert "cli" in rendered and "agentic-protocol" in rendered
    assert "collaps" in rendered.lower()
    assert "Never delete Layer 1 silently" in rendered


def test_rendered_stub_fails_pytest_with_two_failures_not_errors(tmp_path):
    """The bar `step-01-readiness.md` Step 0.5 sets: every stub is red because
    the implementation does not exist, not an import or fixture error."""
    rendered = render("1", "event-intake", "notifications")
    project = tmp_path / "proj"
    project.mkdir()
    (project / "conftest.py").write_text(CONFTEST)
    (project / "pytest.ini").write_text(PYTEST_INI)
    (project / "test_milestone_1_event-intake.py").write_text(rendered)

    proc = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", str(project)],
        cwd=project,
        capture_output=True,
        text=True,
        timeout=60,
    )
    out = proc.stdout + proc.stderr
    assert proc.returncode == 1, out  # 1 == test failures, never a collection/usage error
    assert "2 failed" in out, out
    assert "error" not in out.lower(), out
