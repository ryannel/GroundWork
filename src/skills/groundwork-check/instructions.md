---
name: groundwork-check
description: >
  Detects drift between the committed documentation and the system it describes — code
  changes after a doc's last_reviewed, maturity-roadmap rows that disagree with observed
  state — and reports it with recovery routes. Read-only: it mutates nothing. The
  deterministic core also runs without an agent as `npx groundwork-method check`, which is
  CI-safe and exits non-zero on critical drift; this skill ends its report with a failing
  status on the same conditions instead of a process exit code.
---

# groundwork-check

You are the project's drift detector. The canonical docs claim to describe the system as it is; your job is to test that claim mechanically and report honestly. You run non-interactively when needed (CI), mutate nothing, and never soften a finding — a doc you cannot assess is reported as unassessed, not skipped.

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) defines your mode: **Maintenance**, read-only and diagnostic. From `.groundwork/cache/` you read only `repo-map.json`.

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
  waiting: report the pending count with the route `groundwork-update`.
- No `.groundwork/config/manifest.json` on an otherwise current install means the
  project predates install manifests — one `npx groundwork-method update` bootstraps it.

Framework staleness is a **warning**, not a build failure — the project's docs may be
perfectly current while the framework trails. Report it first so the reader knows which
tooling vintage produced the rest of the report.

## Step 1: Staleness baseline

Find every code-coupled doc: the files under `docs/architecture/services/`, `docs/architecture/api/`, and `docs/architecture/domain/`, plus `docs/architecture/index.md`. From each doc's frontmatter take `last_reviewed`, `source_of_truth`, and `generation_mode`.

For each doc with both fields, run `git log --since="<last_reviewed>" --oneline -- <source_of_truth paths>`. Commits found → the doc is **STALE**, with the commit list as evidence. A doc missing the fields is **UNASSESSED** — report it as such; an unassessable doc that silently passes is the failure mode this skill exists to prevent.

## Step 2: Reference-graph reach (Serena)

Path-filtered git history misses drift by construction: a contract doc goes stale when a type it references moves in a file outside its `source_of_truth`. When the Serena MCP server is available, run impact analysis with `find_referencing_symbols` on the symbols changed since each doc's `last_reviewed` and add any doc whose sources depend on changed code through the reference graph. `.groundwork/cache/repo-map.json` serves the same purpose offline. Without either, the Step 1 baseline stands alone — say so in the report rather than implying graph coverage.

## Step 3: Maturity re-assessment

If `docs/maturity.md` exists, re-evaluate the mechanical signals of the maturity model (`.groundwork/skills/maturity-model.md`, dimensions D1–D6 plus D8's registry and ledger signals — D7 is judgement-based and D9 is re-assessed by bet validation, so both are out of scope for a check run):

- For each assessment row, test its signal now: do the canonical docs exist with summaries (D1)? does each service have a referenced contract (D2)? does `./dev` exist (D3)? is the system-test runner present (D4)? is Serena registered with a code map (D5)? does CI invoke the check (D6)? do the registry twins agree with every ledger cell filled (D8 — `n/a` when no registry exists)?
- Flag every **disagreement** between observed state and the doc: a dimension marked ✅ whose signal now fails (regression — critical), a roadmap row `closed` whose gap is observably back (critical), and a row `open` whose signal now passes (good news — propose closing it via `groundwork-doc-sync`).
- Rows marked `accepted` are settled; verify nothing, report nothing, unless the underlying severity escalated to `blocks-delivery`.

Do not edit `docs/maturity.md` — you are read-only. Disagreements are findings for `groundwork-doc-sync` to apply.

## Step 4: Doc-type judgement

Different doc types have different drift semantics. Apply these rules when scanning `docs/`:

### `docs/principles/**` and `docs/ways-of-working/**`

These are project-stable docs not derived from code. Do **not** flag them for code drift. Do surface a low-severity advisory (not a build failure) for any file whose `last_reviewed` date is more than 12 months old. Advisory format: "Advisory: `<path>` has not been reviewed in over 12 months — consider a manual review pass."

### `docs/architecture/domain/<entity>.md`

Entity docs should reflect the domain as it appears in code. When discoverable (schema migration files, model definitions), compare entity names found in code against the names of files in `docs/architecture/domain/`. Flag two conditions as warnings:

- An entity file exists in `docs/architecture/domain/` but no corresponding code definition can be found — possible deletion or rename.
- A code definition exists but no entity file exists in `docs/architecture/domain/` — the architecture phase may have missed it, or a bet added it without documentation.

Do not fail the build on domain mismatches — these are advisory warnings requiring human judgement.

### `docs/architecture/decisions/NNNN-*.md`

ADRs are append-only historical records. Do **not** check for code drift. Do check:

- Numbering is sequential with no gaps (0001, 0002, 0003, ... with no missing integers).
- Every file's `status` frontmatter field is either `accepted` or begins with `superseded by`.

Report numbering gaps and invalid statuses as build failures — they indicate a corrupted ADR history.

### `docs/surfaces.md` and `.groundwork/surfaces.json`

The surface registry and capability ledger are twins: the prose doc and the JSON are projections of the same decisions, written by the same commits (contract: `.groundwork/skills/surfaces-contract.md`). Exclude `retired` surfaces from every staleness and backlog count below — a retired column is frozen history, never backlog.

Report as build failures:

- **Twin drift** — the doc and the JSON disagree on the surface set, a surface's status, or a cell's state. The twin rule exists so machine checks can stand in for the prose; a disagreement means a commit updated one projection and not the other, and neither can be trusted until they are reconciled.
- **Empty ledger cells** — a capability row missing a cell for a registry surface (retired columns included — they carry frozen history or auto-`n/a`), or a cell with no recognised state. An empty cell is the only illegal ledger state: bet validation fills every column or the bet does not close, so an empty cell means a bet closed past its gate.

Report as warnings:

- **Stale planned intent** — a `planned` cell older than three closed bets with no referencing pitch. Date the cell from the commit that introduced it in `.groundwork/surfaces.json`, count closed bets — the directories under `docs/bets/_archive/` — whose pitch was created after that date (date each from the commit that first added its `docs/bets/<slug>/pitch.md`), and search `docs/bets/` for a pitch that references the capability key or names the surface in its `surfaces:` frontmatter. The threshold is bets, not months, because ledger intent ages at the betting table: each closed bet is a table that passed on the cell, and three passes mark intent that no longer reflects a plan. The other staleness heuristics in this skill are calendar-based; capability work is not scheduled by the calendar.
- **Untested active surface** — an `active` surface absent from the system-test conftest's `surfaces` fixture mapping (`_SURFACE_SPECS` in `tests/conftest.py`), or carrying `testMedium: null`. `active` means shipped and tested; an active surface no test can reach is a claim without proof.

Report as an advisory (not a build failure):

- **No registry** — GroundWork docs exist but neither `docs/surfaces.md` nor `.groundwork/surfaces.json` does. Every install writes the registry at setup commit, so a missing one is damage, not a pending adoption step. Route to the `groundwork-update` lane's Surfaces registry family to re-derive it.

### `docs/architecture/services/**`

Out of scope for the current check implementation.

## Step 5: Report

Group findings by service, severity first:

1. **Critical** — stale contract-bearing docs (API, schema, events), ADR corruption, surface-ledger corruption (twin drift, empty cells), maturity regressions, `closed` rows whose gap is back. These fail the build: end with a failing status.
2. **Warnings** — other stale docs, domain cross-check mismatches, unassessed docs, stale `planned` ledger cells, untested active surfaces.
3. **Advisory** — aging stable docs, `open` roadmap rows whose signal now passes, GroundWork docs with no surface registry (damage — route to the `groundwork-update` Surfaces registry family).

For every finding name the recovery route: `generation_mode: generated` → re-run the generator that produced it; `extracted` or prose docs → run the `groundwork-doc-sync` skill; maturity disagreements → `groundwork-doc-sync` with this report as the change-set anchor. If nothing drifted, say exactly that — and state which steps ran (with or without Serena, with or without a maturity doc), so a clean report is auditable.
