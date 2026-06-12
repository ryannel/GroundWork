---
name: groundwork-check
description: >
  Detects drift between the committed documentation and the system it describes — code
  changes after a doc's last_reviewed, maturity-roadmap rows that disagree with observed
  state — and reports it with recovery routes. Read-only and CI-safe: it mutates nothing
  and exits non-zero on critical drift.
---

# groundwork-check

You are the project's drift detector. The canonical docs claim to describe the system as it is; your job is to test that claim mechanically and report honestly. You run non-interactively when needed (CI), mutate nothing, and never soften a finding — a doc you cannot assess is reported as unassessed, not skipped.

The shared operating contract at `.agents/groundwork/skills/operating-contract.md` (contract v1) defines your mode: **Maintenance**, read-only and diagnostic. From `.groundwork/cache/` you read only `repo-map.json`.

The deterministic core of this skill also runs without an agent as `npx groundwork-method check` — that command covers Step 1's git-log baseline. You add what determinism cannot: dependency-graph reach (Step 2), maturity re-assessment (Step 3), and doc-type judgement (Step 4).

---

## Step 0: Framework staleness

Before doc drift, test whether the install itself has been left behind — the CLI's
framework section (`npx groundwork-method check`) covers this deterministically; mirror
its reading when you run instead of it:

- Compare `groundwork.version` in `.groundwork/config/state.json` against the installed
  package version. A gap means the mechanical lane is owed: report it with the route
  `npx groundwork-method update` (never attempt the refresh yourself — the CLI owns it).
- `.groundwork/cache/upgrade-brief.json` with pending items means judgment-lane work is
  waiting: report the pending count with the route `groundwork-upgrade`.
- No `.groundwork/config/manifest.json` on an otherwise current install means the
  project predates install manifests — one `npx groundwork-method update` bootstraps it.

Framework staleness is a **warning**, not a build failure — the project's docs may be
perfectly current while the framework trails. Report it first so the reader knows which
tooling vintage produced the rest of the report.

## Step 1: Staleness baseline

Find every code-coupled doc: the files under `docs/services/`, `docs/api/`, and `docs/domain/`, plus `docs/architecture.md`. From each doc's frontmatter take `last_reviewed`, `source_of_truth`, and `generation_mode`.

For each doc with both fields, run `git log --since="<last_reviewed>" --oneline -- <source_of_truth paths>`. Commits found → the doc is **STALE**, with the commit list as evidence. A doc missing the fields is **UNASSESSED** — report it as such; an unassessable doc that silently passes is the failure mode this skill exists to prevent.

## Step 2: Dependency-graph reach (depwire)

Path-filtered git history misses drift by construction: a contract doc goes stale when a type it references moves in a file outside its `source_of_truth`. When the depwire MCP server is available, run impact analysis on the symbols changed since each doc's `last_reviewed` and add any doc whose sources depend on changed code through the graph. `.groundwork/cache/repo-map.json` serves the same purpose offline. Without either, the Step 1 baseline stands alone — say so in the report rather than implying graph coverage.

## Step 3: Maturity re-assessment

If `docs/maturity.md` exists, re-evaluate the mechanical signals of the maturity model (`.agents/groundwork/skills/maturity-model.md`, dimensions D1–D6 — D7 is judgement-based and out of scope for a check run):

- For each assessment row, test its signal now: do the canonical docs exist with summaries (D1)? does each service have a referenced contract (D2)? does `./dev` exist (D3)? is the system-test runner present (D4)? is depwire registered with a code map (D5)? does CI invoke the check (D6)?
- Flag every **disagreement** between observed state and the doc: a dimension marked ✅ whose signal now fails (regression — critical), a roadmap row `closed` whose gap is observably back (critical), and a row `open` whose signal now passes (good news — propose closing it via `groundwork-update`).
- Rows marked `accepted` are settled; verify nothing, report nothing, unless the underlying severity escalated to `blocks-delivery`.

Do not edit `docs/maturity.md` — you are read-only. Disagreements are findings for `groundwork-update` to apply.

## Step 4: Doc-type judgement

Apply the Doc-Type Behaviours defined in this skill's `SKILL.md`: principles and ways-of-working docs get a 12-month advisory instead of code-drift checks; domain entity docs are cross-checked against code definitions in both directions (advisory); ADRs are checked for sequential numbering and valid `status` fields (build failure on corruption); the surface registry and capability ledger are cross-checked against their prose twin, the test fixtures, and the bet history (twin drift and empty cells are build failures; stale `planned` intent and untested active surfaces are warnings; a missing registry is an advisory); `docs/services/` deep integration is deferred.

## Step 5: Report

Group findings by service, severity first:

1. **Critical** — stale contract-bearing docs (API, schema, events), ADR corruption, surface-ledger corruption (twin drift, empty cells), maturity regressions, `closed` rows whose gap is back. These fail the build: end with a failing status.
2. **Warnings** — other stale docs, domain cross-check mismatches, unassessed docs, stale `planned` ledger cells, untested active surfaces.
3. **Advisory** — aging stable docs, `open` roadmap rows whose signal now passes, GroundWork docs with no surface registry (route: `groundwork-surface-activation` bootstraps it).

For every finding name the recovery route: `generation_mode: generated` → re-run the generator that produced it; `extracted` or prose docs → run the `groundwork-update` skill; maturity disagreements → `groundwork-update` with this report as the change-set anchor. If nothing drifted, say exactly that — and state which steps ran (with or without depwire, with or without a maturity doc), so a clean report is auditable.
