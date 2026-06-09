#!/usr/bin/env python3
"""Mechanical conformance linter for GroundWork skills (`./dev lint skills`).

Checks the conventions that drift silently — the ones a human reviewer stops
noticing after the third skill:

  1. frontmatter      — every canonical skill file opens with parseable name+description;
                        name equals the directory name.
  2. contract-ref     — every methodology skill names the operating contract WITH its
                        major version: `operating-contract.md` (contract v1).
  3. review-gate      — every committing skill carries the fail-closed review-gate block
                        (review subagent + document_type + VERDICT: PRESENT + fail-closed
                        + Protocol 8).
  4. notes-headers    — every quoted discovery-notes section header is one of the five
                        canonical headers; the shared template carries exactly those five.
  5. routing          — the orchestrator Skill Paths table and the filesystem agree in
                        both directions.
  6. llms-links       — llms.txt links resolve (repo root against the repo; the shipped
                        template against src/docs/ plus the runtime doc set).
  7. doc-pairs        — declared skill↔doc pairs agree: routed phases appear in the
                        lifecycle docs; every cited protocol number exists in the contract.
  8. index-fresh      — the generated workflow-index.md matches the routing tables.

Exit 0 when clean; exit 1 with named findings otherwise.
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent.resolve()
HIDDEN = ROOT / "src" / "hidden-skills"
REGISTERED = ROOT / "src" / "skills"

findings: list[str] = []


def fail(check: str, path, msg: str) -> None:
    findings.append(f"[{check}] {Path(path).relative_to(ROOT)}: {msg}")


# Skills that are routed methodology phases (canonical file: instructions.md).
METHODOLOGY = [
    "groundwork-product-brief",
    "groundwork-design-system",
    "groundwork-architecture",
    "groundwork-scaffold",
    "groundwork-mvp",
    "groundwork-scan",
    "groundwork-product-brief-extract",
    "groundwork-design-system-extract",
    "groundwork-architecture-extract",
    "groundwork-infra-adopt",
    "groundwork-bet",
    "groundwork-update",
    "groundwork-review",
]
# Single-file skills whose canonical file is SKILL.md.
SKILLMD_SKILLS = [
    "groundwork-writer",
    "groundwork-go-engineer",
    "groundwork-python-engineer",
    "groundwork-nextjs-engineer",
]
# Methodology skills that must reference the versioned operating contract.
# groundwork-review is exempt by design: it is the isolated reviewer the
# contract points at, not a phase operating under it.
MUST_REFERENCE_CONTRACT = [s for s in METHODOLOGY if s != "groundwork-review"]

# Files that commit or mutate canonical docs and therefore must carry the
# fail-closed review gate. Bet workflow 04-delivery implements code, not
# canonical docs, and is exempt. groundwork-design-system's drafting phases
# live in its track files — the gate lives there, not in instructions.md.
COMMITTING_FILES = [
    HIDDEN / s / "instructions.md"
    for s in METHODOLOGY
    if s not in ("groundwork-review", "groundwork-scan", "groundwork-bet", "groundwork-design-system")
] + [
    HIDDEN / "groundwork-bet" / "workflows" / w
    for w in ("01-discovery.md", "02-design.md", "03-decomposition.md", "05-validation.md")
] + sorted((HIDDEN / "groundwork-design-system" / "tracks").glob("*.md"))

REVIEW_GATE_MARKERS = {
    "review subagent invocation": re.compile(r"review subagent|groundwork-review", re.I),
    "document_type parameter": re.compile(r"document_type"),
    "parseable PRESENT verdict": re.compile(r"VERDICT: PRESENT"),
    "fail-closed language": re.compile(r"fail-closed", re.I),
    "Protocol 8 reference": re.compile(r"Protocol 8"),
}

CANONICAL_HEADERS = {
    "## Product Brief",
    "## Design System",
    "## Architecture",
    "## Design Details",
    "## Bets",
}

# Doc-structure headers legitimately quoted near discovery-notes mentions.
ALLOWED_NON_NOTES = {"## Summary for Downstream", "## History"}

# Sections legitimately quoted as `## X` in skill files that are not
# discovery-notes headers (document structure, summaries, etc.).
NON_NOTES_HEADER_RE = re.compile(r"`(## [A-Z][^`]*)`")


def parse_frontmatter(path: Path):
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end == -1:
        return None
    fm = {}
    block = text[3:end]
    current_key = None
    for line in block.split("\n"):
        m = re.match(r"^([A-Za-z_][\w-]*):\s*(.*)$", line)
        if m:
            current_key = m.group(1)
            fm[current_key] = m.group(2).strip()
        elif current_key and line.startswith((" ", "\t")):
            fm[current_key] = (fm[current_key] + " " + line.strip()).strip()
    return fm


def check_frontmatter():
    targets = []
    for name in METHODOLOGY:
        targets.append((HIDDEN / name / "instructions.md", name))
    for name in SKILLMD_SKILLS:
        targets.append((HIDDEN / name / "SKILL.md", name))
    for d in sorted(REGISTERED.iterdir()):
        if d.is_dir():
            targets.append((d / "SKILL.md", d.name))
    targets.append((HIDDEN / "operating-contract.md", "operating-contract"))
    targets.append((HIDDEN / "maturity-model.md", "maturity-model"))

    for path, expected_name in targets:
        if not path.exists():
            fail("frontmatter", path, "canonical skill file missing")
            continue
        fm = parse_frontmatter(path)
        if fm is None:
            fail("frontmatter", path, "no YAML frontmatter block")
            continue
        if fm.get("name") != expected_name:
            fail("frontmatter", path, f"frontmatter name {fm.get('name')!r} != expected {expected_name!r}")
        desc = fm.get("description", "").lstrip(">").strip()
        if not desc:
            fail("frontmatter", path, "missing or empty description")


def check_contract_ref():
    pattern = re.compile(r"operating-contract\.md`?\s*\(contract v\d+\)")
    for name in MUST_REFERENCE_CONTRACT:
        path = HIDDEN / name / "instructions.md"
        if not path.exists():
            continue  # reported by frontmatter check
        if not pattern.search(path.read_text(encoding="utf-8")):
            fail("contract-ref", path, "no versioned operating-contract reference — expected `operating-contract.md` (contract v1)")


def check_review_gate():
    for path in COMMITTING_FILES:
        if not path.exists():
            fail("review-gate", path, "committing skill file missing")
            continue
        text = path.read_text(encoding="utf-8")
        missing = [label for label, rx in REVIEW_GATE_MARKERS.items() if not rx.search(text)]
        if missing:
            fail("review-gate", path, f"review-gate block incomplete — missing: {', '.join(missing)}")


def check_notes_headers():
    # The shared template must carry exactly the five canonical headers.
    template = HIDDEN / "templates" / "discovery-notes.md"
    if template.exists():
        headers = {l.strip() for l in template.read_text(encoding="utf-8").splitlines() if l.startswith("## ")}
        if headers != CANONICAL_HEADERS:
            fail("notes-headers", template,
                 f"template headers {sorted(headers)} != canonical {sorted(CANONICAL_HEADERS)}")
    else:
        fail("notes-headers", template, "shared discovery-notes template missing")

    # Any backticked `## X` token within 3 lines of a discovery-notes mention
    # must be a canonical header — drifted strings orphan the note.
    for path in sorted(HIDDEN.rglob("*.md")) + sorted(REGISTERED.rglob("*.md")):
        lines = path.read_text(encoding="utf-8").splitlines()
        notes_lines = [i for i, l in enumerate(lines) if "discovery-notes.md" in l]
        for i in notes_lines:
            window = "\n".join(lines[max(0, i - 3): i + 4])
            for header in NON_NOTES_HEADER_RE.findall(window):
                if header not in CANONICAL_HEADERS and header not in ALLOWED_NON_NOTES:
                    fail("notes-headers", path,
                         f"`{header}` quoted next to discovery-notes.md is not a canonical section header")


def routing_table():
    skill_md = (REGISTERED / "groundwork-orchestrator" / "SKILL.md").read_text(encoding="utf-8")
    section = skill_md.split("### Skill Paths", 1)[1]
    rows = re.findall(r"^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|", section, re.M)
    return dict(rows)


def check_routing():
    paths = routing_table()
    for skill, install_path in paths.items():
        if install_path.startswith(".agents/groundwork/skills/"):
            src = HIDDEN / install_path[len(".agents/groundwork/skills/"):]
        elif install_path.startswith(".agents/skills/"):
            src = REGISTERED / install_path[len(".agents/skills/"):]
        else:
            fail("routing", REGISTERED / "groundwork-orchestrator" / "SKILL.md",
                 f"Skill Paths entry for {skill} has unrecognised prefix: {install_path}")
            continue
        if not src.exists():
            fail("routing", src, f"Skill Paths routes `{skill}` to a file that does not exist in src/")

    # Reverse: every routed hidden skill directory appears in the table.
    routed = set(paths.keys())
    exempt = set(SKILLMD_SKILLS) - {"groundwork-writer"}  # engineer skills install with generator output
    for d in sorted(HIDDEN.iterdir()):
        if not d.is_dir() or d.name == "templates":
            continue
        if d.name in exempt:
            continue
        if d.name not in routed:
            fail("routing", d, "hidden skill directory has no Skill Paths entry in the orchestrator")


RUNTIME_DOCS = {
    "docs/product-brief.md",
    "docs/design-system.md",
    "docs/architecture.md",
    "docs/infrastructure.md",
    "docs/maturity.md",
    # Runtime directories minted by lifecycle phases in the user's project.
    "docs/domain/",
    "docs/decisions/",
    "docs/services/",
    "docs/api/",
    "docs/bets/",
}


def check_llms_links():
    link_rx = re.compile(r"\]\(([^)]+)\)")
    root_llms = ROOT / "llms.txt"
    if root_llms.exists():
        for link in link_rx.findall(root_llms.read_text(encoding="utf-8")):
            if not (ROOT / link).exists():
                fail("llms-links", root_llms, f"link does not resolve: {link}")

    shipped = ROOT / "src" / "docs" / "llms.txt"
    if shipped.exists():
        for link in link_rx.findall(shipped.read_text(encoding="utf-8")):
            if link in RUNTIME_DOCS:
                continue  # created in the user's project by a lifecycle phase
            if link.startswith("docs/") and (ROOT / "src" / "docs" / link[len("docs/"):]).exists():
                continue
            fail("llms-links", shipped, f"link neither ships under src/docs/ nor is a known runtime doc: {link}")


def check_doc_pairs():
    """Declared skill↔doc pairs that must agree (S21).

    The orchestrator's routing tables and the lifecycle docs describe the same
    flow from two sides; a protocol number cited in a skill must exist in the
    contract. Drift between them is silent — a reader of either side sees a
    coherent story that happens to be wrong.
    """
    setup_doc = ROOT / "docs" / "lifecycle" / "01-setup.md"
    loop_doc = ROOT / "docs" / "lifecycle" / "02-delivery-loop.md"
    skill_md = (REGISTERED / "groundwork-orchestrator" / "SKILL.md").read_text(encoding="utf-8")

    # 1. Every phase skill in the routing tables appears in the setup lifecycle doc.
    if setup_doc.exists():
        setup_text = setup_doc.read_text(encoding="utf-8")
        for section in ("### Greenfield Setup Phases", "### Brownfield Setup Phases"):
            block = skill_md.split(section, 1)[1].split("###", 1)[0]
            for name in re.findall(r"`(groundwork-[\w-]+)`", block):
                if name not in setup_text:
                    fail("doc-pairs", setup_doc,
                         f"orchestrator routes setup phase `{name}` but the setup lifecycle doc never mentions it")
    else:
        fail("doc-pairs", setup_doc, "setup lifecycle doc missing")

    # 2. Every bet workflow phase appears in the delivery-loop lifecycle doc.
    if loop_doc.exists():
        loop_text = loop_doc.read_text(encoding="utf-8").lower()
        for wf in sorted((HIDDEN / "groundwork-bet" / "workflows").glob("*.md")):
            phase = wf.stem.split("-", 1)[1]  # 01-discovery -> discovery
            if phase not in loop_text:
                fail("doc-pairs", loop_doc,
                     f"bet workflow {wf.name} exists but the delivery-loop doc never mentions '{phase}'")
    else:
        fail("doc-pairs", loop_doc, "delivery-loop lifecycle doc missing")

    # 3. Every protocol number cited anywhere resolves to a heading in the contract.
    contract = (HIDDEN / "operating-contract.md").read_text(encoding="utf-8")
    defined = set(re.findall(r"^## Protocol (\d+):", contract, re.M))
    scan_dirs = [HIDDEN, REGISTERED, ROOT / ".agents" / "skills" / "groundwork-contributor"]
    for base in scan_dirs:
        for path in sorted(base.rglob("*.md")):
            cited = set(re.findall(r"Protocol (\d+)", path.read_text(encoding="utf-8")))
            for n in sorted(cited - defined):
                fail("doc-pairs", path,
                     f"cites Protocol {n}, which the operating contract does not define")


def check_index_fresh():
    proc = subprocess.run(
        ["node", str(ROOT / "scripts" / "generate_workflow_index.js"), "--check"],
        capture_output=True, text=True, cwd=ROOT,
    )
    if proc.returncode != 0:
        fail("index-fresh", REGISTERED / "groundwork-orchestrator" / "workflow-index.md",
             (proc.stderr or proc.stdout).strip().splitlines()[0])


def main() -> int:
    check_frontmatter()
    check_contract_ref()
    check_review_gate()
    check_notes_headers()
    check_routing()
    check_llms_links()
    check_doc_pairs()
    check_index_fresh()

    if findings:
        print(f"lint: {len(findings)} finding(s)\n")
        for f in findings:
            print(f"  ✖ {f}")
        return 1
    print("lint: skills conform — frontmatter, contract refs, review gates, notes headers, routing, llms links, doc pairs, workflow index.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
