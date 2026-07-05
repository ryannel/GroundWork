#!/usr/bin/env python3
"""Structural checklist for a GroundWork simulation sandbox.

A *non-gating* heads-up display: did the flow's mechanics produce the durable
artifacts a real project ends with? Read this before reading the transcript for
quality — it tells you whether to trust the run at all.

Deliberately checks only **durable** signals, never transient ones:
  - canonical docs/*.md exist, are non-empty, and carry a title
  - .groundwork/config/state.json project_type + completed phases
  - git commits (count + which docs were committed)

It does NOT check `.groundwork/cache/*` (deleted on commit — checking it reports
false failures in a full-flow run) and does NOT check frontmatter (GroundWork doc
templates carry none). Stdlib only — no venv, mirrors render_transcript.py.

Usage: python3 scripts/sandbox_checklist.py <sandbox_path> [out_file.md] [--until <phase>]

--until bounds the contract for a bounded run (`./dev sim run --until=...`):
artifacts owned by phases past the bound are reported as `out of bound`, not
missing, so a clean bounded run reads green instead of failing the full-path
contract.
"""

import json
import subprocess
import sys
from pathlib import Path

# Canonical durable artifacts per path, as an ORDERED phase contract. This is
# the single source of truth for what a flow must leave behind — the GroundWork
# delivery contract, not a per-suite detail, so it's defined here rather than
# read from scenarios. Doc/dir paths are verified against what the skills
# actually write; the phase attribution is the flow's commit order (a bounded
# check only ever cuts on a phase boundary, so the cumulative prefix is what
# must be exact).
# Each entry: (phase_key, [expected docs], [expected non-empty dirs]).
PHASES = {
    "greenfield": [
        ("product-brief", ["docs/product-brief.md"], []),
        ("design-system", ["docs/design-system.md"], []),
        ("architecture", [
            "docs/architecture/index.md",
            "docs/surfaces.md",  # surface registry (architecture commit; written even for one surface)
            "docs/architecture/infrastructure.md",
        ], []),
        ("scaffold", [], []),   # scaffold's durable output is code, checked by the scaffold harness
        ("mvp", [], []),        # MVP planning writes bets/, counted separately below
        ("bet", [], []),
    ],
    "brownfield": [
        ("scan", [], []),  # scan output is cache-only by design (deleted on commit)
        ("product-brief-extract", ["docs/product-brief.md"], []),
        ("design-system-extract", ["docs/design-system.md"], []),
        ("architecture-extract", [
            "docs/architecture/index.md",
            "docs/surfaces.md",  # surface registry (architecture-extract; ledger empty by design)
            "docs/maturity.md",  # maturity roadmap (consolidated gap ledger)
        ], ["docs/architecture/domain"]),
        ("infra-adopt", [
            "docs/architecture/infrastructure.md",
        ], ["docs/architecture/api", "docs/architecture/services"]),
        ("bet", [], []),
    ],
    # The delivery path starts from a sealed bet and drives Phase 4 only, so its
    # durable contract is the sealed plan plus what delivery produces: the
    # materialized red→green bet-progress tests and the owner-decision record.
    "delivery": [
        ("delivery", [
            "docs/bets/task-capture/pitch.md",
            "docs/bets/task-capture/technical-design/03-api-design.md",
            "docs/bets/task-capture/decomposition/meta.json",
        ], ["tests/bets/task-capture"]),
    ],
}


def normalize_phase(s: str) -> str:
    return "-".join("".join(c if c.isalnum() else " " for c in s.lower()).split())


def resolve_until(flow_path: str, until: str) -> int:
    """Return the index of the bounding phase, or exit with the valid names."""
    phases = PHASES.get(flow_path, PHASES["greenfield"])
    want = normalize_phase(until)
    for i, (key, _, _) in enumerate(phases):
        if key == want or want in key or key in want:
            return i
    names = ", ".join(k for k, _, _ in phases)
    print(f"✖ --until '{until}' matches no {flow_path} phase. Valid: {names}")
    sys.exit(2)


def detect_path(sandbox: Path) -> tuple[str, str]:
    """Return (path, suite) from the sim marker, defaulting to greenfield."""
    marker = sandbox / ".groundwork-sim.json"
    if marker.exists():
        try:
            m = json.loads(marker.read_text())
            return m.get("path", "greenfield"), m.get("suite", "?")
        except json.JSONDecodeError:
            pass
    return "greenfield", "?"


def check_doc(sandbox: Path, rel: str) -> tuple[str, str]:
    """Return (status, detail) for one expected document."""
    f = sandbox / rel
    if not f.exists():
        return "missing", "not written"
    text = f.read_text(errors="replace").strip()
    if not text:
        return "empty", "0 bytes of content"
    lines = text.count("\n") + 1
    # GroundWork docs carry no H1 by design — they lead with `## Summary for Downstream`
    # (Protocol 5), optionally preceded by drift-tracking YAML frontmatter on code-coupled
    # docs. Strip a leading frontmatter block, then require the first content line to be a
    # heading. Checking only the first 5 raw lines misfired on every frontmatter-stamped doc.
    body = text
    if body.startswith("---"):
        end = body.find("\n---", 3)
        if end != -1:
            body = body[end + 4:].lstrip()
    first = next((ln for ln in body.splitlines() if ln.strip()), "")
    if not first.lstrip().startswith("#"):
        return "weak", "does not lead with a heading"
    return "ok", f"{len(text)} chars, {lines} lines"


def read_state(sandbox: Path) -> dict | None:
    sf = sandbox / ".groundwork" / "config" / "state.json"
    if not sf.exists():
        return None
    try:
        return json.loads(sf.read_text())
    except json.JSONDecodeError:
        return None


def git_summary(sandbox: Path) -> tuple[int, list[str]]:
    """Return (commit_count, committed_docs). Empty/absent git → (0, [])."""
    if not (sandbox / ".git").is_dir():
        return 0, []

    def git(*args):
        return subprocess.run(
            ["git", "-C", str(sandbox), *args],
            capture_output=True, text=True,
        )

    count_r = git("rev-list", "--count", "HEAD")
    if count_r.returncode != 0:
        return 0, []
    count = int(count_r.stdout.strip() or "0")
    names_r = git("log", "--name-only", "--pretty=format:")
    docs = sorted({
        ln.strip() for ln in names_r.stdout.splitlines()
        if ln.strip().startswith("docs/") and ln.strip().endswith(".md")
    })
    return count, docs


MARK = {"ok": "✔", "weak": "▵", "empty": "✖", "missing": "✖", "out-of-bound": "·"}


def build_report(sandbox: Path, until: str | None = None) -> tuple[str, dict]:
    flow_path, suite = detect_path(sandbox)
    phases = PHASES.get(flow_path, PHASES["greenfield"])
    until_idx = resolve_until(flow_path, until) if until else len(phases) - 1

    doc_rows, dir_rows = [], []
    for i, (_, docs, dirs) in enumerate(phases):
        in_bound = i <= until_idx
        for rel in docs:
            if in_bound:
                doc_rows.append((rel, *check_doc(sandbox, rel)))
            else:
                doc_rows.append((rel, "out-of-bound", "past the run's bound"))
        for rel in dirs:
            if not in_bound:
                dir_rows.append((rel, "out-of-bound", "past the run's bound"))
                continue
            d = sandbox / rel
            files = [f for f in d.rglob("*") if f.is_file()] if d.is_dir() else []
            status = "ok" if files else "missing"
            detail = f"{len(files)} file(s)" if files else "directory absent or empty"
            dir_rows.append((rel, status, detail))
    expected = [r for r in doc_rows if r[1] != "out-of-bound"]

    bets = sorted((sandbox / "docs" / "bets").glob("*")) if (sandbox / "docs" / "bets").is_dir() else []
    state = read_state(sandbox)
    commits, committed_docs = git_summary(sandbox)

    present = sum(1 for _, st, _ in doc_rows if st == "ok")
    stats = {"present": present, "expected": len(expected), "commits": commits}

    bound_note = f" · bounded: through {phases[until_idx][0]}" if until else ""
    out = [
        f"# Structural checklist — {flow_path} (suite: {suite}){bound_note}",
        "",
        "Non-gating mechanical check of durable artifacts. Read the transcript and "
        "run `/judge` for quality.",
        "",
        f"## Documents ({present}/{len(expected)} solid)",
        "",
        "| Doc | Status | Detail |",
        "|---|---|---|",
    ]
    for rel, status, detail in doc_rows:
        out.append(f"| `{rel}` | {MARK[status]} {status} | {detail} |")
    if dir_rows:
        out += ["", "### Directory deliverables", "", "| Dir | Status | Detail |", "|---|---|---|"]
        for rel, status, detail in dir_rows:
            out.append(f"| `{rel}/` | {MARK[status]} {status} | {detail} |")
    out += [
        "",
        f"- **Bets scoped:** {len(bets)}" + (f" ({', '.join(b.name for b in bets)})" if bets else ""),
        "",
        "## Orchestration state",
        "",
    ]
    if state is None:
        out.append("- ✖ `state.json` missing or unparseable")
    else:
        completed = state.get("completed", [])
        out.append(f"- **project_type:** `{state.get('project_type')}`")
        out.append(f"- **completed phases:** {', '.join(completed) if completed else '(none recorded)'}")
    out += [
        "",
        "## Git",
        "",
        f"- **commits:** {commits}",
        f"- **docs committed:** {', '.join(committed_docs) if committed_docs else '(none)'}",
        "",
    ]
    return "\n".join(out) + "\n", stats


def main():
    argv = sys.argv[1:]
    until = None
    if "--until" in argv:
        i = argv.index("--until")
        if i + 1 >= len(argv):
            print("✖ --until requires a phase name")
            sys.exit(2)
        until = argv[i + 1]
        del argv[i:i + 2]
    if not argv:
        print("Usage: sandbox_checklist.py <sandbox_path> [out_file.md] [--until <phase>]")
        sys.exit(2)
    sandbox = Path(argv[0]).resolve()
    if not sandbox.is_dir():
        print(f"✖ No sandbox at {sandbox}")
        sys.exit(2)

    report, stats = build_report(sandbox, until)
    if len(argv) > 1:
        out_file = Path(argv[1]).resolve()
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_text(report)
        print(f"  ✔ checklist → {out_file}")
    # Always echo a one-line summary to the console; never gate (exit 0).
    print(f"  Docs {stats['present']}/{stats['expected']} solid · {stats['commits']} commit(s)")


if __name__ == "__main__":
    main()
