---
name: groundwork-update
description: >
  The single call to bring a project up to the current GroundWork framework — files,
  structure, and docs site. Works the residual upgrade-brief items `npx groundwork-method
  update` compiles (merging framework improvements into edited docs, reconciling
  regenerated scaffold output), then reconciles every artifact family against the live
  current canonical shape, advancing legacy structure forward. One unit, one explained
  proposal, one commit. Route here for "upgrade groundwork", "bring this project up to
  date", or whenever `.groundwork/cache/upgrade-brief.json` exists. Distinct from
  groundwork-doc-sync, which syncs project docs to the project's own code.
---

# groundwork-update

You bring a project to the current framework's canonical shape. The CLI has already done
everything mechanical — refreshed the skills under `.groundwork/skills/`, replaced the
framework-owned `./dev` bundle, copied pristine seeded docs, run the scripted CLI
migrations. Two kinds of work remain, and both need eyes:

- **Residual brief items** — the user edited a doc the framework also improved, customized
  the launcher, or runs a generator whose output drifted from its template. The CLI
  compiled these into the **upgrade brief**.
- **Structural drift** — the project's bets, architecture docs, or contracts were authored
  against an older *shape* of the framework. Nothing tracked that, and nothing needs to:
  you detect it by comparing the project's own artifacts against the framework's current
  canonical — already sitting in `.groundwork/skills/` after the CLI refresh — and advance
  the divergent ones forward.

## You are the driver

You hold the **thin spine** — the brief, the Family Index, the detection, the user pacing,
the review gate, and the commits — and you keep that context small so you can reason about
the update as a whole. You **do not** read canonical templates and rewrite project files in
your own context. Each unit of work — one brief item, or one family — is advanced by a fresh
**`reconcile-worker` subagent** (`.groundwork/skills/groundwork-update/briefs/reconcile-worker.md`)
you dispatch with a tight capsule; it reads the canonical and the project's instances, makes
the change, and returns a short report, and its transform reasoning dies with its context.

Running the whole catch-up inline piles every family's transform — the canonical, the
instances, the diff judgement — into one window until you can no longer pace, gate, and
commit well. Farming each unit to a disposable worker is what keeps you thin enough to do
the work only the driver can do.

You leave the project as if it had been set up at the current version all along.

### The `fan_out` hint

The orchestrator passes a `fan_out` hint (`parallel` when a sub-agent dispatch tool is
available in this environment, `sequential` otherwise; default `sequential` if none reached
you) — honour it rather than probing your own tool set, since a runtime that misjudges its
capabilities and calls a dispatch tool that does not exist breaks the run.

- `parallel` → dispatch each unit to a `reconcile-worker` subagent at the **`execution`**
  tier (Model Tiers, operating contract — gated, not trusted; you review every mutated doc
  at `frontier` before committing). This is the context-lean path the driver is built for.
- `sequential` → no dispatch tool exists; advance each unit **inline, one at a time** — do
  the worker's read-and-transform yourself, gate and commit it, then purge that unit's
  detail from context before the next.

---

## Operating Contract

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1)
governs this skill in **Maintenance** mode: Protocols 1 (Discovery Notes), 2 (Living
Documents), and 4 (Pacing) apply, and Protocols 8 and 9 (Review Gate, Review Invocation)
apply whenever a brief item or a reconcile advance mutates a canonical doc — the driver runs
that gate, never the worker that authored the change. There is no phase cache beyond the
brief itself.

---

## The driver loop

Run **Phase A first** — it clears the brief the CLI staged — then **Phase B**, which
reconciles what no brief can see. A run that finds no brief skips straight to Phase B. Every
unit of work in either phase — one brief item, one family — runs the same loop:

1. **Propose.** One unit, one explained proposal in two or three sentences — never batch
   approvals across units.
2. **Dispatch or inline.** Under `parallel`, hand a `reconcile-worker` subagent the unit's
   capsule (`unit_kind`, the canonical + instance pointers, the advance approach) at the
   `execution` tier; it reads the canonical and instances in its own context, makes the
   change, and returns a report. Under `sequential`, do the worker's read-and-transform
   yourself for this one unit — the recipes live in
   `.groundwork/skills/groundwork-update/briefs/reconcile-worker.md`'s "The work" section;
   do not duplicate them here.
3. **Resolve.** Any `COLLISIONS/AMBIGUITY` the report raises — a passage where a user edit
   and a framework improvement collide, a customization that may be obsolete, reconstructed
   generator options, an advance that implies a product decision the code does not prove —
   is a **user** decision: surface it and let the user pick before committing. A `BLOCKING
   CONCERN` stops the unit; route it as the report describes.
4. **Gate.** For every doc named under `REVIEW-NEEDED`, run the review subagent (Protocol 9)
   with the matching `document_type`. Proceed only on a parseable `VERDICT: PRESENT`; the
   gate is fail-closed. On `REVISE`, apply the 🔴 findings and re-invoke, to the 3-revise cap.
5. **Stage and commit.** The worker left its changes unstaged; the driver stages and commits
   them — one unit, one commit: `chore(groundwork): <what changed> (<id>)` for a brief item,
   `chore(groundwork): advance <family> to current shape` for a family. Nothing outside the
   unit's scope goes into its commit.
6. **Record** (Phase A only — Phase B's detect-first re-derives state every run, so there is
   nothing to record). The Bookkeeping contract below.

Units run **serially, in the order they appear** — families overlap on files and carry
ordering dependencies (graduate ADRs before nesting the architecture docs), so they are
advanced one at a time, not concurrently.

---

## Phase A — Work the brief (framework files)

Read `.groundwork/cache/upgrade-brief.json`. If it does not exist, there is no brief-lane
work; go to Phase B.

The brief carries `from` (the version this install was stamped at), `to` (the version it is
being raised to), and `items[]`, each with a stable `id`, a `type` (`tier2-merge`,
`tier1-custom`, or `regenerate`), a `status`, and pointers to payloads the CLI staged under
`.groundwork/cache/upgrade/` — the worker never needs the npm package itself.

Open the session with the shape of the work: the version jump and a one-line list of pending
items. Then walk the items **top to bottom** — the CLI ordered them — running the driver
loop above for each. The capsule is the item verbatim: `unit_kind: brief-item:<type>`, the
staged `incoming`/`options`/`base_hash` pointers, and the project path it touches.

Stop at any point the user asks; the brief survives across sessions and `update` re-runs
merge into it without duplicating items.

---

## Phase B — Reconcile to the current canonical (structure)

The brief only knows about files the framework seeds or generates. It cannot see that a
project's *structures* — how its bets are laid out, where its architecture docs live, what
its published docs may contain — were authored against an older shape. There is no change
log to replay and none is needed: the framework now sitting in `.groundwork/skills/` **is**
the definition of the current shape, and it cannot drift, because it is the source. So you
reconcile the project to it.

**Detect in the driver; advance in a worker.** For each family in the **Family Index** below:

1. **Detect cheaply, yourself.** The legacy signal is a structural check — `ls`/`grep`-level
   (is there a flat `docs/architecture.md`? a `## Summary for Downstream` section? a
   `pitch.md` without `status`? no `app/brand.css`?). This is cheap; keep it in the driver so
   you only spin a worker for a family that has actually drifted. A family already matching
   canonical is checked off untouched — and leaves no ledger entry, because the next run
   re-derives the same answer from the artifacts. Detect-first *is* the bookkeeping.
2. **Pause, then run the driver loop above.** Pause where an advance would imply a product
   decision the code does not prove — a removal that might be temporary, a capability that
   might be an experiment — and surface it rather than assume it. Otherwise run the loop for
   the family: the capsule is `unit_kind: family:<slug>`, the **Owner** column path(s) as
   the canonical to read, the project instance paths you found, and the row's **Advance**
   column as the approach.

### Family Index

A **detection table**, not change history: each row names the family and its capsule slug,
the canonical **Owner** the worker reads in full (never duplicated here), the **Legacy
signal** that flags an old instance for the driver to detect cheaply, and the **Advance** —
a recipe name from `.groundwork/skills/groundwork-update/briefs/reconcile-worker.md`'s
"The work" section plus this family's own parameters. The recipe mechanics live solely in
the worker; do not restate them here. The
index grows only when a genuinely new family appears, not on every change — when a
structure changes again, its owning skill changes (as it must) and this pass picks the
drift up for free.

| Family (slug) | Owner — current canonical | Legacy signal | Advance |
|---|---|---|---|
| **Bets** (`bets`) | `.groundwork/skills/groundwork-bet/` workflows `00-quick.md` + `03-decomposition.md` + `04-delivery.md` and its templates | A bet under `docs/bets/<slug>/` carrying `decomposition.json`, `decomposition.md`, a `contracts/` dir, or a `test-manifest.json`; a `pitch.md` missing `status` frontmatter; or an in-flight bet (`status: delivery` or later) with an approved `decomposition/` tree but no `bet/<slug>/approved` git tag. | **Restructure** — in-flight bets only to the prose `decomposition/` tree (leave shipped/archived as historical record, removing only stray obsolete files). A `pitch.md` carrying `track: quick` is a legitimate quick bet, not a malformed one — its single-milestone `decomposition/` tree is correct by design; leave it intact, never pad or restructure it. Approval baseline = git tag `bet/<slug>/approved`; if it predates the tag-writer fix and is missing, back-fill it — find the decomposition-approval commit (`git log --oneline --grep='bet(<slug>): approve decomposition' --grep='bet(<slug>): approve quick bet' -- docs/bets/<slug>/decomposition/`) and tag that commit; if none is identifiable, tag `HEAD` and note the approximation in the bet's `pitch.md`. |
| **Architecture docs** (`architecture-docs`) | The nested `docs/architecture/` layout the `groundwork-architecture` skill builds + its `meta.json` ordering | Flat architecture docs at the `docs/` root (`docs/architecture.md`, `docs/infrastructure.md`, `docs/domain/`, `docs/services/`, `docs/api/`, `docs/decisions/`). | **Relocate** — `architecture.md` → `index.md`; rewrite `docs/meta.json` and seed `docs/architecture/meta.json`. |
| **Doc contracts** (`doc-contracts`) | `.groundwork/skills/operating-contract.md` + the `groundwork-writer` skill | A published `docs/*.md` (outside `docs/bets/`) carrying a `## Summary for Downstream` section, or a code-coupled doc missing `last_reviewed` / `source_of_truth` frontmatter. | **Graduate + stamp.** |
| **Naming** (`naming`) | The `groundwork-design-system` skill; the structural-design principle (`code-structure`); the published package name `groundwork-method`; the current install layout (hidden methodology skills live at `.groundwork/skills/`) | Three independent signals: `docs/ux-design.md` or `hexagonal-architecture.md` present → **Rename + carry refs**. A project-owned script, CI step, or doc invoking `npx groundwork ` (trailing space + subcommand) → **Reference rewrite** (`npx groundwork-method `; flags/args unchanged). A project-owned doc, script, or CI step referencing `.agents/groundwork/skills/` → **Reference rewrite** (prefix only → `.groundwork/skills/`). | See Legacy signal — each maps to the named recipe. Leave the user-owned `config.toml` (never written) and historical records alone. |
| **Surfaces registry** (`surfaces-registry`) | `.groundwork/skills/surfaces-contract.md` (its `version` field) + the `groundwork-surface-activation` skill | A runner-less `dev.config.json` whose surfaces/sidecars are invisible to `./dev`. Not a legacy signal: a missing `docs/surfaces.md` / `.groundwork/surfaces.json` — every install writes one at commit; that case routes to `groundwork-surface-activation`'s fail-safe, not this family. | **Register** — register the missing runners, without touching the db/jaeger compose. |
| **Docs site** (`docs-site`) | The `docs-site` generator (`.groundwork/config/generators.json`) | A docs site behind the current generator — no `app/brand.css`, unordered nav, unrendered `mermaid`, a redirect instead of a landing page. | Generator-produced site: **regenerate** with the recorded options. Hand-built site: refactor in place to match the generator's output. Keep the unbranded fallback intact — no `brand-tokens.json` stays on the stock theme. |
| **Next.js token layer** (`nextjs-tokens`) | The Next.js app generator (`.groundwork/config/generators.json`) | A Next.js app with a hardcoded `globals.css` and no per-app `brand.css` / token-conformance gate. | **Regenerate** the token layer from `brand-tokens.json`, reconcile any hand-edited `globals.css`, add the conformance test. |
| **Engineer skills** (`engineer-skills`) | `src/engineer-skills/<stack>-engineer/` in the installed package — resolve the package root from any generator's `factory` path in `.groundwork/config/generators.json` | A promoted skill under `.agents/skills/groundwork-<stack>-engineer/` with provenance recorded in `manifest.json` `generated[<generator>[:<name>]].files` whose on-disk file hashes no longer match canonical. A directory with **no** `manifest.generated` entries at all is project-authored (e.g. `groundwork-swift-engineer`) — not this family, never touched. | **Re-promote from canon, honoring edits** — for files whose disk hash still matches recorded provenance, clean-replace from canonical (dropping a stale `sync-anchor.md` a pre-M6 promotion left). A file matching neither provenance nor canonical is user-edited — leave it, surface the diff, never clobber. |

Generator-owned families (**Docs site**, **Next.js token layer**) advance through the
worker's `regenerate` recipe — the index names them so one framing covers every family, and
does not duplicate the generator's reconcile steps. The prose families advance through the
worker's relocate / rename / graduate / restructure / bootstrap / re-promote recipes.

---

## Bookkeeping — Phase A items, exact, every item

This contract is what keeps `update`, `check`, and future sessions honest about brief-lane
work. (Phase B needs none — detect-first re-derives a family's state from its artifacts
every run.) The driver records it as part of each item's commit, reading the worker's `FILES`
report for what landed. After each brief item is committed (or checked off as done / n-a):

- **Brief:** set the item's `status` to `"done"` in `.groundwork/cache/upgrade-brief.json`.
- **Manifest** (`tier2-merge` and `tier1-custom` items): in
  `.groundwork/config/manifest.json`, set the file's entry to the merged reality — `hash` =
  SHA-256 of the file now on disk, `base` = SHA-256 of the `incoming` package content the
  worker merged against, `version` = the brief's `to`. (Compute with `shasum -a 256 <file>`.)
  This is what stops the same merge being queued forever.
- **Manifest** (`regenerate` items): set `generated[<artifact>].version` to the brief's
  `to`, and record the `options` used if the entry had none.

Include the bookkeeping edits in the item's commit.

When every brief item is done, delete the brief and the staged payloads
(`.groundwork/cache/upgrade-brief.json`, `.groundwork/cache/upgrade/`) — cache lifecycle
rules — in a final tidy commit.

Before closing, capture any stray signal the user voiced during the catch-up that this run
did not act on — record it under its matching header in `.groundwork/cache/discovery-notes.md`
(Protocol 1); do not let it evaporate with the session.

Then close by naming the version the project now stands at
and confirming Phase B is reconciled, and suggest `npx groundwork-method check` as the
proof.
