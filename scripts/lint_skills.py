#!/usr/bin/env python3
"""Mechanical conformance linter for GroundWork skills (`./dev lint skills`).

Checks the conventions that drift silently — the ones a human reviewer stops
noticing after the third skill:

  1. frontmatter      — every canonical skill file opens with parseable name+description;
                        name equals the directory name.
  2. contract-ref     — every methodology skill names the operating contract WITH its
                        major version: `operating-contract.md` (contract v1).
  3. review-gate      — every committing skill carries the fail-closed review-gate
                        payload: a trigger (review subagent invocation), the two
                        identifiers a caller owns (document_path + document_type),
                        and a fail-closed pointer to Protocols 8 (revise cap /
                        verdict) and 9 (dispatch mechanics). The dispatch and
                        failure mechanics themselves live once in the operating
                        contract and are deliberately NOT required here — a
                        skill that restates them is not this check's concern;
                        a skill that drops the invocation is.
  4. notes-headers    — every quoted discovery-notes section header is one of the five
                        canonical headers; the shared template carries exactly those five.
  5. routing          — the orchestrator Skill Paths table and the filesystem agree in
                        both directions.
  6. llms-links       — llms.txt links resolve (repo root against the repo; the shipped
                        template against src/docs/ plus the runtime doc set).
  7. doc-pairs        — declared skill↔doc pairs agree: routed phases appear in the
                        lifecycle docs; every cited protocol number exists in the contract.
  8. index-fresh      — the generated workflow-index.md matches the routing tables.
  9. writer-ref       — every document-producing hidden skill references
                        `groundwork-writer` somewhere in its tree (a dispatched brief
                        counts, not just the canonical instructions.md/SKILL.md).
 10. reference-link    — every `references/<name>.md` mention (backtick or markdown
                        link, bare or path-qualified) inside a hidden or engineer
                        skill resolves to a real file — first in that skill's own
                        `references/`, then in the three discipline personas'
                        `references/` (cross-skill pins); intra-reference relative
                        links resolve within their own directory.

Exit 0 when clean; exit 1 with named findings otherwise.
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent.resolve()
HIDDEN = ROOT / "src" / "hidden-skills"
REGISTERED = ROOT / "src" / "skills"
# Engineer skills are canon here and never installed at the GroundWork root —
# a generator promotes one into a scaffolded project's .agents/skills/.
ENGINEER = ROOT / "src" / "engineer-skills"

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
    "groundwork-doc-sync",
    "groundwork-review",
]
# Single-file skills under HIDDEN whose canonical file is SKILL.md.
SKILLMD_SKILLS = [
    "groundwork-writer",
]
# Engineer skills (canonical file SKILL.md) live under ENGINEER, not HIDDEN.
ENGINEER_SKILLS = [
    "groundwork-go-engineer",
    "groundwork-python-engineer",
    "groundwork-node-engineer",
    "groundwork-nextjs-engineer",
    "groundwork-flutter-engineer",
    "groundwork-electron-engineer",
]
# Methodology skills that must reference the versioned operating contract.
# groundwork-review is exempt by design: it is the isolated reviewer the
# contract points at, not a phase operating under it.
MUST_REFERENCE_CONTRACT = [s for s in METHODOLOGY if s != "groundwork-review"]

# Hidden skills that are exempt from the writer-ref check because they do not
# themselves finalize a document, by design:
#   - groundwork-scan     brownfield Phase 0 — writes cache findings, no docs artifact
#   - groundwork-review   the isolated reviewer — produces verdicts, not documents
#   - groundwork-persona  always-on conversational posture, not a workflow phase
#   - groundwork-writer   is the standard itself
WRITER_EXEMPT = {"groundwork-scan", "groundwork-review", "groundwork-persona", "groundwork-writer"}

# Every hidden skill directory not explicitly exempt must reference
# groundwork-writer somewhere in its tree — derived the same way as
# MUST_REFERENCE_CONTRACT (a live directory scan, not a hand-maintained list),
# so a new skill is covered automatically instead of needing a second registration.
MUST_REFERENCE_WRITER = sorted(
    d.name for d in HIDDEN.iterdir()
    if d.is_dir() and d.name != "templates" and d.name not in WRITER_EXEMPT
)

# Files that commit or mutate canonical docs and therefore must carry the
# fail-closed review gate. Bet workflow 04-delivery implements code, not
# canonical docs, and is exempt. groundwork-design-system's drafting phases
# live in its track files — the gate lives there, not in instructions.md, and
# tracks/_foundation.md is the multi-type coordinator that delegates Phase 5
# (translation + review) to each active track, so the gate lives in the tracks
# it loads, not in the coordinator.
# groundwork-architecture and groundwork-scaffold are split into per-phase
# files — the gate lives in their draft/review phase file, not in instructions.md.
COMMITTING_FILES = [
    HIDDEN / s / "instructions.md"
    for s in METHODOLOGY
    if s not in ("groundwork-review", "groundwork-scan", "groundwork-bet",
                 "groundwork-design-system", "groundwork-architecture", "groundwork-scaffold")
] + [
    HIDDEN / "groundwork-bet" / "workflows" / w
    for w in ("01-discovery.md", "02-design.md", "03-decomposition.md", "05-validation.md")
] + sorted(
    p for p in (HIDDEN / "groundwork-design-system" / "tracks").glob("*.md")
    if p.name != "_foundation.md"
) + [
    HIDDEN / "groundwork-architecture" / "phases" / "06-draft-review-present.md",
    HIDDEN / "groundwork-scaffold" / "phases" / "05-draft-review.md",
]

# The payload a caller owns per Protocol 9 ("calling skills state what they
# pass and when in their phase the review fires; the dispatch mechanics and
# the failure procedure live here and are never restated per skill"): a
# trigger, the document identifier, and a pointer into the two protocols that
# govern the verdict/cap (8) and the dispatch/fail-closed mechanics (9). This
# does not require the full mechanics prose (verdict grammar, cap arithmetic,
# failure-path enumeration) — those are exactly what a caller should NOT
# restate. It does require every element of the payload, so a skill that
# drops its review invocation entirely fails every marker below, not just
# one. `document_type` is checked as the literal parameter name (every
# invocation names it as a key); the path it reviews is sometimes passed as
# a `document_path:` key and sometimes as a bare path ahead of
# `document_type:` — both are legitimate Protocol 9 payload expressions, so
# only the type key is required verbatim.
REVIEW_GATE_MARKERS = {
    "review subagent invocation": re.compile(r"review subagent|groundwork-review", re.I),
    "document_type parameter": re.compile(r"document_type"),
    "fail-closed pointer": re.compile(r"fail-closed", re.I),
    "Protocol 8 reference (verdict / revise cap)": re.compile(r"Protocol 8"),
    "Protocol 9 reference (dispatch mechanics)": re.compile(r"Protocol 9"),
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
    for name in ENGINEER_SKILLS:
        targets.append((ENGINEER / name / "SKILL.md", name))
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


def check_writer_ref():
    pattern = re.compile(r"groundwork-writer")
    for name in MUST_REFERENCE_WRITER:
        skill_dir = HIDDEN / name
        if not skill_dir.exists():
            continue  # reported by routing/frontmatter checks
        if not any(pattern.search(p.read_text(encoding="utf-8")) for p in skill_dir.rglob("*.md")):
            fail("writer-ref", skill_dir,
                 "document-producing skill has no groundwork-writer reference anywhere in its tree")


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
    for path in sorted(HIDDEN.rglob("*.md")) + sorted(REGISTERED.rglob("*.md")) + sorted(ENGINEER.rglob("*.md")):
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
        if install_path.startswith(".groundwork/skills/"):
            src = HIDDEN / install_path[len(".groundwork/skills/"):]
        elif install_path.startswith(".agents/skills/"):
            src = REGISTERED / install_path[len(".agents/skills/"):]
        else:
            fail("routing", REGISTERED / "groundwork-orchestrator" / "SKILL.md",
                 f"Skill Paths entry for {skill} has unrecognised prefix: {install_path}")
            continue
        if not src.exists():
            fail("routing", src, f"Skill Paths routes `{skill}` to a file that does not exist in src/")

    # Reverse: every routed hidden skill directory appears in the table.
    # Engineer skills live under ENGINEER (promoted by generators, never routed),
    # so HIDDEN now contains only directories that must appear in the table.
    routed = set(paths.keys())
    exempt: set[str] = set()
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
    "docs/architecture/index.md",
    "docs/architecture/infrastructure.md",
    "docs/maturity.md",
    # Runtime directories minted by lifecycle phases in the user's project.
    # The architecture set nests under docs/architecture/; the getting-started
    # on-ramp is authored by the setup skills.
    "docs/architecture/domain/",
    "docs/architecture/decisions/",
    "docs/architecture/services/",
    "docs/architecture/api/",
    "docs/getting-started/",
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
    scan_dirs = [HIDDEN, REGISTERED, ENGINEER, ROOT / ".agents" / "skills" / "groundwork-contributor"]
    for base in scan_dirs:
        for path in sorted(base.rglob("*.md")):
            cited = set(re.findall(r"Protocol (\d+)", path.read_text(encoding="utf-8")))
            for n in sorted(cited - defined):
                fail("doc-pairs", path,
                     f"cites Protocol {n}, which the operating contract does not define")


# Cross-skill pins: the three discipline personas' `references/` are the only
# reference libraries other skills are meant to route into by filename (bet
# workflows, groundwork-product-brief — PERSONA-11). A mention that misses a
# skill's own references/ falls back to these before it counts as drift.
PERSONA_REFERENCE_DIRS = [
    HIDDEN / "groundwork-architect" / "references",
    HIDDEN / "groundwork-product" / "references",
    HIDDEN / "groundwork-designer" / "references",
]

# Bare `<name>.md` tokens that are never a `references/` pin — templates,
# caches, canonical docs, and other skill files legitimately named without a
# path prefix in prose. Documented here rather than silently skipped, per
# skill-writer: an exemption is a decision, not an absence.
REFERENCE_LINK_EXEMPT = {
    "SKILL.md", "instructions.md", "sync-anchor.md", "README.md",
    "CHANGELOG.md", "AGENTS.md", "workflow-index.md", "operating-contract.md",
    "maturity-model.md", "decomposition.md", "pitch.md", "discovery-notes.md",
    "scaffold-cache.md", "mvp-cache.md", "dev-cli-reference.md",
    "code-intelligence.md", "repo-map-schema.md", "retrospective.md",
    "milestone-index.md", "host-support.md", "hexagonal-architecture.md",
    "graphical-ui.md", "exclusions.md", "cli.md", "bet-pitch-draft.md",
    "agentic-protocol.md", "index.md", "setup.md", "infrastructure.md",
    "product-findings.md", "design-findings.md", "architecture-findings.md",
    # Generator-shipped contract doc, not a skill reference — lives at
    # src/generators/system-test-runner/NATIVE-CHECK-CONTRACT.md.
    "NATIVE-CHECK-CONTRACT.md",
}

# File-scoped exemptions: a bare `<name>.md` that is genuinely a
# `references/` pin everywhere else, but names a project-owned doc (not a
# skill reference) in this one spot — groundwork-update's migration table
# talks about renaming `docs/architecture.md` -> `docs/architecture/index.md`
# and `docs/ux-design.md`/`hexagonal-architecture.md` -> `code-structure.md`,
# none of which are references/ pins.
REFERENCE_LINK_EXEMPT_BY_FILE = {
    HIDDEN / "groundwork-update" / "instructions.md": {"architecture.md", "code-structure.md"},
    # The forge's authoring standard requires every *forged* skill to ship a
    # version-corrections.md — the mention describes that output file, not a
    # pin into stack-forge's own references/.
    HIDDEN / "groundwork-stack-forge" / "references" / "authoring-engineer-skills.md": {"version-corrections.md"},
}

_CODE_FENCE_RE = re.compile(r"```.*?```", re.S)
_BACKTICK_MD_RE = re.compile(r"`([A-Za-z][\w-]*\.md)`")
_LINK_MD_RE = re.compile(r"\]\(([A-Za-z][\w-]*\.md)\)")
# Path-qualified mentions: capture what precedes `references/<name>.md` too,
# so a mention naming a specific *other* skill (`groundwork-nextjs-engineer/
# references/testing.md`, e.g. electron deferring to the web stack) resolves
# against that named skill, not just the mentioning skill's own directory.
_PATH_MD_RE = re.compile(r"([\w./<>-]*)references/([A-Za-z][\w-]*\.md)")


def _skill_roots():
    roots = []
    for d in sorted(HIDDEN.iterdir()):
        if d.is_dir() and d.name != "templates":
            roots.append(d)
    for d in sorted(ENGINEER.iterdir()):
        if d.is_dir():
            roots.append(d)
    return roots


_ALL_SKILL_DIRS = {d.name: d for d in _skill_roots()}


def _resolves(name: str, own_refs: Path) -> bool:
    if (own_refs / name).exists():
        return True
    return any((d / name).exists() for d in PERSONA_REFERENCE_DIRS)


def _resolves_path_qualified(prefix: str, name: str, own_refs: Path) -> bool:
    """`references/<name>.md` mentions that carry a path prefix.

    A `<stack>` placeholder (`groundwork-<stack>-engineer/references/...`) is
    unresolvable by design — decomposition defers the concrete stack to
    delivery time. It is not drift, so long as the filename it promises
    exists in at least one real engineer skill's references/ (otherwise the
    promise is broken everywhere, which *is* drift worth catching).
    """
    if "<stack>" in prefix:
        return any((ENGINEER / d.name / "references" / name).exists()
                    for d in ENGINEER.iterdir() if d.is_dir())
    for skill_name, skill_dir in _ALL_SKILL_DIRS.items():
        if skill_name in prefix:
            if ((skill_dir / "references" / name).exists()
                    or (skill_dir / "references" / "templates" / name).exists()):
                return True
    return _resolves(name, own_refs)


def check_reference_links():
    for skill_dir in _skill_roots():
        own_refs = skill_dir / "references"
        for path in sorted(skill_dir.rglob("*.md")):
            if "templates" in path.relative_to(skill_dir).parts:
                continue
            text = _CODE_FENCE_RE.sub("", path.read_text(encoding="utf-8"))
            in_refs_dir = path.parent == own_refs
            file_exempt = REFERENCE_LINK_EXEMPT_BY_FILE.get(path, set())

            bare_names: set[str] = set(_BACKTICK_MD_RE.findall(text))
            path_qualified: set[tuple[str, str]] = set(_PATH_MD_RE.findall(text))

            if in_refs_dir:
                # Rule B: a relative markdown link inside references/ is a
                # sibling pin — it must resolve in this same directory, no
                # cross-skill fallback.
                for m in _LINK_MD_RE.finditer(text):
                    name = m.group(1)
                    if name == path.name or name in file_exempt:
                        continue
                    if not (own_refs / name).exists():
                        fail("reference-link", path,
                             f"relative link to `{name}` does not resolve in "
                             f"{own_refs.relative_to(ROOT)}")
            else:
                bare_names |= set(_LINK_MD_RE.findall(text))

            for prefix, name in sorted(path_qualified):
                if name in REFERENCE_LINK_EXEMPT or name in file_exempt:
                    continue
                if not _resolves_path_qualified(prefix, name, own_refs):
                    fail("reference-link", path,
                         f"`{prefix}references/{name}` does not resolve "
                         "against the named skill, the mentioning skill's "
                         "own references/, nor the discipline personas'")

            path_qualified_names = {n for _, n in path_qualified}
            for name in sorted(bare_names - path_qualified_names):
                if name in REFERENCE_LINK_EXEMPT or name in file_exempt:
                    continue
                if not _resolves(name, own_refs):
                    fail("reference-link", path,
                         f"`{name}` does not resolve in "
                         f"{own_refs.relative_to(ROOT)} nor the discipline "
                         "personas' references/ (architect, product, designer)")


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
    check_writer_ref()
    check_reference_links()

    if findings:
        print(f"lint: {len(findings)} finding(s)\n")
        for f in findings:
            print(f"  ✖ {f}")
        return 1
    print("lint: skills conform — frontmatter, contract refs, review gates, notes headers, routing, llms links, doc pairs, workflow index, writer refs, reference links.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
