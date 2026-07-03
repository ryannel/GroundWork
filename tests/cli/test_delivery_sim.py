"""Contract tests for the Delivery-phase simulation harness.

The `./dev sandbox --delivery` flow seeds a sealed `task-capture` bet ready for the
Delivery phase, plus a `/simulate-delivery` kickoff that drives the delivery engine
against a simulated owner. These tests pin the two halves that make that run
faithful and repeatable:

  1. the delivery **fixture** is shaped so the implementation-readiness gate passes
     (the document chain, sealed proofs, and importable-but-unimplemented stubs), and
     it still carries the amendment seam the exit gate exercises;
  2. `seed_simulation.js delivery` emits the delivery kickoff, persona, and judge.

If the fixture drifts out of readiness shape, the exit-gate simulation would fail
for the wrong reason — these gates catch that deterministically, before a live run.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
SCENARIO = REPO_ROOT / "tests" / "evals" / "scenarios" / "delivery_task_capture"
FIXTURE = SCENARIO / "fixture"
BET = FIXTURE / "docs" / "bets" / "task-capture"
SEED = REPO_ROOT / "scripts" / "seed_simulation.js"


# --- The fixture is shaped for the readiness gate -------------------------

def test_pitch_is_at_delivery_status():
    pitch = (BET / "pitch.md").read_text()
    assert pitch.startswith("---"), "pitch needs frontmatter"
    front = pitch.split("---", 2)[1]
    assert "status: delivery" in front, "readiness needs status: delivery"


def test_technical_design_chain_present():
    td = BET / "technical-design"
    for name in ("01-ui-design.md", "02-data-flows.md", "03-api-design.md", "04-data-design.md"):
        assert (td / name).is_file(), f"missing technical-design/{name}"


def test_decomposition_tree_present_and_sliced():
    dec = BET / "decomposition"
    assert (dec / "meta.json").is_file()
    # Milestone 1 is sliced up front; milestone 2 is sliced-on-arrival (index only).
    m1 = dec / "01-capture-and-list"
    assert (m1 / "index.md").is_file()
    assert (m1 / "01-add-task.md").is_file()
    assert (m1 / "02-list-tasks.md").is_file()
    m2 = dec / "02-complete-a-task"
    assert (m2 / "index.md").is_file()
    assert not list(m2.glob("0[0-9]-*.md")), "milestone 2 must be unsliced (sliced on arrival)"


@pytest.mark.parametrize(
    "rel",
    [
        "decomposition/01-capture-and-list/index.md",
        "decomposition/01-capture-and-list/01-add-task.md",
        "decomposition/01-capture-and-list/02-list-tasks.md",
        "decomposition/02-complete-a-task/index.md",
    ],
)
def test_every_proof_names_a_test_file(rel):
    text = (BET / rel).read_text()
    assert "## Proof of work" in text, f"{rel} lacks a Proof of work section"
    assert "**Test file:**" in text and "tests/bets/task-capture/" in text, (
        f"{rel} names no Test file — nothing for Delivery to materialize red"
    )


def test_review_verdict_flagged_for_seeded_run():
    # A seeded run has no conversation history, so the PRESENT verdict must be
    # flagged in the doc tree or the readiness gate blocks on "Unreviewed artifact".
    note = (BET / "decomposition" / "review-note.md").read_text()
    assert note.count("VERDICT: PRESENT") >= 2, "both artifacts must show a PRESENT verdict"


def test_amendment_seam_present():
    # Milestone 2's second agreed case over-reaches the committed CLI surface; the
    # exit gate drops it via an owner-approved amendment. If this line disappears,
    # the amendment mechanic has no natural trigger.
    m2 = (BET / "decomposition" / "02-complete-a-task" / "index.md").read_text()
    assert "list --pending" in m2, "the amendment seam (list --pending) is gone from milestone 2"
    ui = (BET / "technical-design" / "01-ui-design.md").read_text()
    assert "--pending" not in ui, "the amendment seam must NOT be a committed surface (readiness would flag drift)"


# --- The taskcli stubs are importable but unimplemented (red for absence) --

def _load_store():
    spec = importlib.util.spec_from_file_location(
        "taskcli_fixture_store", FIXTURE / "src" / "taskcli" / "store.py"
    )
    mod = importlib.util.module_from_spec(spec)
    # Register before exec so @dataclass can resolve cls.__module__ during load.
    sys.modules[spec.name] = mod
    try:
        spec.loader.exec_module(mod)
    finally:
        sys.modules.pop(spec.name, None)
    return mod


def test_store_stub_imports_but_is_unimplemented():
    store = _load_store()
    s = store.TaskStore(":memory:")
    # A real Task record with the sealed shape exists...
    t = store.Task(id=1, title="x")
    assert (t.id, t.title, t.done) == (1, "x", False)
    # ...but the behaviour does not: the red board fails for absence, not import error.
    for call in (lambda: s.add("x"), lambda: s.all(), lambda: s.complete(1)):
        with pytest.raises(NotImplementedError):
            call()


# --- The seeder emits the delivery kickoff, persona, and judge ------------

def test_seed_simulation_emits_delivery_harness(tmp_path):
    res = subprocess.run(
        ["node", str(SEED), "delivery_task_capture", str(tmp_path), "delivery"],
        capture_output=True, text=True,
    )
    assert res.returncode == 0, res.stderr

    kickoff = (tmp_path / ".claude" / "commands" / "simulate-delivery.md").read_text()
    # The kickoff must script every exit-gate mechanic by name.
    for needle in (
        "step router",
        "File-backed lens verdicts",
        "Default+veto",
        "fresh-context resume",
        "Blocked milestone close",
        "Amendment + pack recompile",
        "bet/task-capture/approved",
    ):
        assert needle in kickoff, f"delivery kickoff is missing: {needle!r}"

    persona = (tmp_path / ".claude" / "agents" / "sandbox-user.md").read_text()
    assert "Owner" in persona and "Task Capture" in persona

    judge = (tmp_path / ".claude" / "commands" / "judge.md").read_text()
    assert "Faithful / Partial / Unfaithful" in judge, "delivery judge rubric not rendered"


def test_seed_simulation_rejects_unknown_path(tmp_path):
    res = subprocess.run(
        ["node", str(SEED), "delivery_task_capture", str(tmp_path), "sideways"],
        capture_output=True, text=True,
    )
    assert res.returncode != 0
    assert "Unknown path" in res.stderr
