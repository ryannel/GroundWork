# Engineer-Skill Alignment Pass — coverage, topic parity, and the canon→skill chain

**Status:** EXECUTED 2026-06-26. All six workstreams landed. Gates green — contracts (sync-anchor + migration-coverage), generation (225, incl. stack-docs idempotency), cli (56), lint (skill conformance). The healed chain is proven by a negative test: perturbing `foundations/testing.md` now fails the sync gate for all five skills. **Remaining:** (1) WS-E is observational — confirm repo-map/Serena adoption in the next `./dev sandbox --simulate` run; (2) package version bump deferred to the release act; (3) future-simplification candidate — collapse the three-way duplication (canon / per-stack / skill reference), a separate plan.
**Audience:** An engineer or agent executing this alignment pass across the five engineer skills.
**Scope owner:** `src/engineer-skills/*` (the five engineer skills), the per-stack principle docs under `src/generators/*/docs/principles/stack/`, and the sync-anchor gate (`scripts/check_sync_anchors.py`).

---

## Context

The five engineer skills (`src/engineer-skills/groundwork-{go,python,nextjs,flutter,electron}-engineer`)
are product deliverables: each is promoted into a scaffolded project's `.agents/skills/` per
language. They are supposed to be consistent reflections of the central principle canon
(`src/docs/principles/`), stack-adapted. The trigger for this pass: testing coverage looked
uneven (the honeycomb/independent-oracle material read as strong only on Python). Audit
confirmed the inconsistency is real but more nuanced than "only Python is good," and it has a
**structural root cause** that will keep regenerating drift unless fixed.

Two user decisions scope this pass:
- **Full topic parity** — testing *and* observability, security, documentation, performance/reliability
  references made consistent across all five.
- **Fix the chain** — repair the broken canon→per-stack→skill propagation so a future canon edit
  cannot silently bypass engineer-skill review.

A third, related issue surfaced mid-audit: **coding agents aren't using the repo-map / Serena
tooling.** Audit shows the capability is documented identically in all five skills but positioned
as skippable advisory prose — a salience problem, not a missing capability. Folded in as WS-E.

## What the audit found (the corrected picture)

The recent "test-coverage rigor uplift" *did* touch all five skill `references/testing.md` files,
so they are mostly aligned. Two layers, two distinct problems:

**Layer 1 — the engineer-skill references (`src/engineer-skills/*/references/`).** Mostly good.
Residual gaps, by canon principle:

| Canon testing principle | Go | Python | Next.js | Flutter | Electron |
|---|---|---|---|---|---|
| 1 Honeycomb/trophy shape | FULL | FULL | FULL | FULL | FULL |
| 2 Real deps / contract | FULL | FULL | FULL | adapts (fakes) | adapts (fakes) |
| 3 Observability as test surface | FULL | FULL | FULL | N/A (noted) | N/A (noted) |
| 4 Name by behaviour (explicit template) | FULL | FULL | **PARTIAL** | **PARTIAL** | **PARTIAL** |
| 5 Mutation testing | FULL | FULL | FULL | N/A (noted) | FULL |
| 6 Tests part of the change | FULL | FULL | FULL | FULL | FULL |
| 7 Generate inputs (property/fuzz/Schemathesis) | **PARTIAL** | FULL | **MISSING** | **MISSING** | **MISSING** |

Topic-coverage parity beyond testing (dedicated reference = ●, scattered/inline = ◐, absent = ○):

| Concern | Go | Python | Next.js | Flutter | Electron |
|---|---|---|---|---|---|
| Observability/telemetry | ● | ● | ◐ (in testing only) | ○ | ○ |
| Security | ● `code-craft-security` | ◐ | ◐ | ◐ | ● `security` |
| Documentation discipline | ○ | ● | ● | ○ | ○ |
| Performance/Reliability | ● | ● | ● | ◐ | ◐ |
| Accessibility | n/a | n/a | ◐ (in `ux-principles`) | ● `accessibility` | defers→nextjs |

**Layer 2 — the per-stack generator principle files (`src/generators/*/docs/principles/stack/*/`).**
These are pinned by the skill `sync-anchor.md` files *and* ship into user projects as
`docs/principles/stack/`. They are **stale** and orphaned:
- `go/testing.md` body has **zero** honeycomb/exporter/mutation/property vocabulary (only in frontmatter).
- `python/testing.md` names the honeycomb but **lacks** the in-memory exporter, mutation, and property additions.
- Engineer skills pin these per-stack files, **not the central canon** — so the 2026-06-26 canon uplift
  forced *no* engineer-skill review. `scripts/check_sync_anchors.py` only enforces per-stack→skill;
  there is **no** canon→per-stack link. This is the recurring-drift root cause.

**Target model for the whole pass:** *every canon principle is consciously addressed in every skill* —
either covered (stack-adapted) or explicitly marked "not applicable on this stack, because X" (the way
Flutter already handles OTel traces). Parity is conscious coverage, not identical text. Python and Go
are the reference bars for backend depth; the surface skills adapt rather than copy.

## Workstreams

Sequenced spine-first. WS-A and WS-D are the core (testing parity + heal the chain); WS-B is the bulk
content; WS-C/E are SKILL.md edits; WS-F is gates/delivery.

### WS-A — Close the testing-canon gaps in skill references
- **Principle 7 (generate inputs):** add a stack-adapted property-based/fuzz section where it applies.
  - Next.js `references/testing.md`: add `fast-check` for pure logic (`lib/utils.ts`, schema validators)
    and **Schemathesis** against the app's route handlers / OpenAPI as the contract↔property bridge.
  - Go `references/testing.md`: strengthen from PARTIAL — promote property-based (`rapid`) and native
    `go test -fuzz` for parsers/decoders out of the bet-slice aside into a first-class section.
  - Flutter / Electron: add a short, honest section — name what *does* apply (Dart has property
    libraries for pure logic; Electron policy modules suit fast-check) and mark the rest N/A-with-reason.
- **Principle 4 (behaviour-naming):** add the explicit `should [outcome] when [condition]` template to
  the three surface skills' testing references (Go/Python already have it). Keep stack-idiomatic examples.
- Bar to copy: `groundwork-python-engineer/references/testing.md` (Hypothesis + mutmut + InMemorySpanExporter fixture).

### WS-B — Topic-parity references (the bulk)
Add or consolidate dedicated references so the topic matrix above is filled or consciously N/A. Pattern
per new file: distilled for the agent's decision-time lens, stack-adapted, ≤ the density of the existing
siblings, cross-linked from the SKILL.md routing table.
- **Security:** add `security.md` to Python, Next.js, Flutter (model on Go's `code-craft-security.md`
  and Electron's `security.md`). Pull the currently-scattered guidance into one checklist each.
- **Documentation:** add `documentation.md` to Go, Flutter, Electron (model on Python's `documentation-mcp.md`
  and Next.js's `documentation.md`).
- **Performance/Reliability:** add a dedicated `performance-and-reliability.md` to Flutter and Electron
  (consolidate the guidance currently scattered across architecture/state/ipc references).
- **Observability:** add an observability reference (or section) to the three surface skills — Next.js
  (web-vitals/RUM + server-span instrumentation), Flutter (client telemetry + crash reporting), Electron
  (main+renderer telemetry) — or, where genuinely thin, a conscious N/A-with-reason note. Do **not** force
  backend OTel idiom onto clients.
- **Accessibility:** standardize the surface family — promote Next.js a11y out of `ux-principles.md` into a
  dedicated `accessibility.md` (parity with Flutter), keep Electron's documented defer-to-nextjs.

### WS-C — SKILL.md spine consistency
- Backend (Go, Python): the Operating Contract omits the canonical-docs routing the surface skills have.
  Add a contract point routing durable policy to `docs/principles/stack/{go,python}/`, and surface
  observability as a first-class contract concern (today it's only a routing-table row).
- All five: add a routing-table row for every new WS-A/WS-B reference so it is discoverable.
- Confirm each skill still conforms to its family spine (Backend vs Surface) after edits.

### WS-D — Heal the canon→skill propagation chain
- **Re-pin:** extend each engineer skill's `sync-anchor.md` to also pin the central-canon files it embeds
  (`foundations/testing.md`, `quality/observability.md`, `quality/security.md`, `foundations/documentation.md`,
  `quality/performance.md`, `quality/reliability.md` — as applicable per skill), *in addition to* the
  per-stack files. This makes a future canon edit fail `./dev test contracts` until the skill is reviewed.
- **Refresh:** bring the stale per-stack generator principle files current with the canon (honeycomb +
  exporter + mutation + property where stack-applicable), then recompute hashes. These ship to users as
  `docs/principles/stack/`, so the refresh also fixes user-facing doc staleness.
- Re-hash both per-stack and canon pins; bump `last_reviewed` in the sync-anchors.
- *Recommendation (not forced):* keep the per-stack files (they serve the human reading project docs, a
  different audience than the agent reading skill references) — but note the now-three-way duplication
  (canon / per-stack / skill reference) as a future-simplification candidate, out of scope here.

### WS-E — Make repo-map / Serena actually get used (the user's flag)
- Root cause: identical advisory section in all five, positioned *outside* the Operating Contract and
  Required First Checks, framed "Orient before reading widely" — easy to skip.
- Fix: wire orientation into the **mandatory** flow. Make "refresh the repo-map, read centrality, navigate
  hubs with Serena" a Required First Check (backend) / first How-to-Use step (surface), and reference it
  from Operating Contract point 2 ("inspect the repository") so the contract *points at the tool* rather
  than describing the goal abstractly. Keep the graceful-degradation fallback.
- Honestly bound the claim: whether they then get *used* is empirical — add it as an explicit thing to
  observe in the next flow simulation (`./dev sandbox --simulate`) rather than asserting the edit fixes it.

### WS-F — Gates, delivery, release
- `./dev test contracts` (sync-anchor gate + migration-coverage + changelog↔registry cross-check),
  `./dev test generation` (per-stack docs ship via generators), `./dev ci` for the full local==CI run.
- Per-stack principle files are generator-produced (tier 3): refreshing them is a shipped-surface change —
  add a `CHANGELOG.md` line (likely `[no-migration]`, since it's a doc-content refresh the update reconcile
  carries) and confirm the migration-coverage gate is satisfied.
- Verify engineer-skill reference additions propagate: new files auto-ship via `promoteEngineerSkill`
  (whole-dir copy, confirmed in `scaffold-helpers.ts`); confirm existing installs pick them up on `update`.
- No operating-contract `version` bump (no protocol change). Package version bump deferred to the release act.

## Files touched (representative — pattern repeats per skill)
- Skill references: `src/engineer-skills/<skill>/references/{testing,security,documentation,performance-and-reliability,observability,accessibility}.md` (add/edit per the WS-A/WS-B matrix).
- Skill routers: `src/engineer-skills/<skill>/SKILL.md` (WS-C routing rows + WS-E orientation step; backend Operating Contract additions).
- Sync anchors: `src/engineer-skills/<skill>/sync-anchor.md` (WS-D canon pins + rehash + last_reviewed).
- Per-stack principle docs: `src/generators/<gen>/docs/principles/stack/<lang>/testing.md` (+ siblings where canon-relevant) — WS-D refresh.
- `CHANGELOG.md` — WS-F entry.
- Reference bars to model from (do not edit as templates): `groundwork-python-engineer/references/{testing,documentation-mcp}.md`, `groundwork-go-engineer/references/code-craft-security.md`, `groundwork-flutter-engineer/references/accessibility.md`.

## Verification
1. `./dev test contracts` — sync-anchor hashes match (proves WS-D re-pin is internally consistent), migration/changelog gates green.
2. `./dev test generation` — per-stack doc refresh produces the expected files in a scaffold.
3. Re-run the coverage matrix from this plan against the edited references — every canon principle is either FULL or N/A-with-reason in every skill; every topic-parity cell is ● or a conscious ○-with-reason.
4. Negative test for the healed chain: make a trivial edit to `src/docs/principles/foundations/testing.md`, run `./dev test contracts`, confirm it now **fails** (forcing skill review) — then revert. This proves WS-D closed the bypass.
5. `./dev ci` — full local==CI parity before commit.
6. WS-E is observational: flag repo-map/Serena usage as a thing to watch in the next `./dev sandbox --simulate` run; do not claim the edit alone proves adoption.

## Sequencing & delivery
- Order: WS-D (chain + refresh) and WS-A (testing parity) first — they define the spine and the enforcement
  that keeps WS-B honest. Then WS-B (bulk references), WS-C (SKILL.md), WS-E (salience), WS-F (gates) last.
- Size: this is a large, cross-cutting change (~10 new/edited reference files + 5 SKILL.md + 5 sync-anchors +
  several per-stack refreshes). It matches the repo's "Design Plan" convention — on approval, commit this as
  a `docs/plans/` entry and execute in lettered workstreams, updating the Status header per slice.
- Commit at stable checkpoints per workstream (per the commit-at-milestones convention); push only when asked.

## Open considerations (resolved with defaults; flag if you disagree)
- **Per-stack files kept, not collapsed.** Fixing the chain ≠ deleting the layer; collapse is a separate future plan.
- **Observability on clients is adapted, not forced.** Flutter/Electron get client-telemetry guidance or a conscious N/A, never backend OTel idiom.
- **WS-E is a salience fix with an empirical tail.** The edit raises the floor; the simulation tells us if it worked.
