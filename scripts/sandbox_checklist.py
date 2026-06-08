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

Usage: python3 scripts/sandbox_checklist.py <sandbox_path> [out_file.md]
"""

import json
import subprocess
import sys
from pathlib import Path

# Canonical durable artifacts per path. These are the GroundWork delivery contract,
# not a per-suite detail, so they're defined here rather than read from scenarios.
# Verified against the paths the skills actually write (greenfield methodology
# skills; brownfield *-extract / infra-adopt skills).
DURABLE_DOCS = {
    "greenfield": [
        "docs/product-brief.md",
        "docs/design-system.md",
        "docs/architecture.md",
        "docs/infrastructure.md",
    ],
    "brownfield": [
        "docs/product-brief.md",
        "docs/design-system.md",
        "docs/architecture.md",
        "docs/infrastructure.md",
        "docs/onboarding-report.md",  # gap ledger
    ],
}

# Directory deliverables that must contain at least one file. Brownfield's
# architecture-extract mints docs/domain/, and infra-adopt writes docs/api/ +
# docs/services/ — these ARE the brownfield deliverables, so a checklist blind to
# them would pass while missing the point.
DURABLE_DIRS = {
    "greenfield": [],
    "brownfield": ["docs/api", "docs/domain", "docs/services"],
}


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
    if not any(line.lstrip().startswith("#") for line in text.splitlines()[:5]):
        return "weak", "no title heading in first 5 lines"
    lines = text.count("\n") + 1
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


MARK = {"ok": "✔", "weak": "▵", "empty": "✖", "missing": "✖"}


def build_report(sandbox: Path) -> tuple[str, dict]:
    flow_path, suite = detect_path(sandbox)
    expected = DURABLE_DOCS.get(flow_path, DURABLE_DOCS["greenfield"])

    doc_rows = [(rel, *check_doc(sandbox, rel)) for rel in expected]

    expected_dirs = DURABLE_DIRS.get(flow_path, [])
    dir_rows = []
    for rel in expected_dirs:
        d = sandbox / rel
        files = [f for f in d.rglob("*") if f.is_file()] if d.is_dir() else []
        status = "ok" if files else "missing"
        detail = f"{len(files)} file(s)" if files else "directory absent or empty"
        dir_rows.append((rel, status, detail))

    bets = sorted((sandbox / "docs" / "bets").glob("*")) if (sandbox / "docs" / "bets").is_dir() else []
    state = read_state(sandbox)
    commits, committed_docs = git_summary(sandbox)

    present = sum(1 for _, st, _ in doc_rows if st == "ok")
    stats = {"present": present, "expected": len(expected), "commits": commits}

    out = [
        f"# Structural checklist — {flow_path} (suite: {suite})",
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
    if len(sys.argv) < 2:
        print("Usage: sandbox_checklist.py <sandbox_path> [out_file.md]")
        sys.exit(2)
    sandbox = Path(sys.argv[1]).resolve()
    if not sandbox.is_dir():
        print(f"✖ No sandbox at {sandbox}")
        sys.exit(2)

    report, stats = build_report(sandbox)
    if len(sys.argv) > 2:
        out_file = Path(sys.argv[2]).resolve()
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_text(report)
        print(f"  ✔ checklist → {out_file}")
    # Always echo a one-line summary to the console; never gate (exit 0).
    print(f"  Docs {stats['present']}/{stats['expected']} solid · {stats['commits']} commit(s)")


if __name__ == "__main__":
    main()
