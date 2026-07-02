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

---

## Operating Contract

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1)
governs this skill in **Maintenance** mode: Protocols 1 (Discovery Notes), 2 (Living
Documents), and 4 (Pacing) apply, and Protocols 8 and 9 (Review Gate, Review Invocation)
apply whenever a brief item or a reconcile advance mutates a canonical doc — the driver runs
that gate, never the worker that authored the change. There is no phase cache beyond the
brief itself.

Run **Phase A first** — it clears the brief the CLI staged — then **Phase B**, which
reconciles what no brief can see. A run that finds no brief skips straight to Phase B.

### The `fan_out` hint

The orchestrator passes a `fan_out` hint when it invokes this skill: `parallel` when a
sub-agent dispatch tool is available in this environment, `sequential` otherwise. Honour it
rather than probing your own tool set — a runtime that misjudges its capabilities and calls
a dispatch tool that does not exist breaks the run. If no hint reached you, default to
`sequential`.

- `parallel` — **dispatch** each unit to a `reconcile-worker` subagent, as above, at the
  **`execution`** tier (Model Tiers, operating contract — a gated worker, not trusted; the
  driver reviews every mutated doc at `frontier` before committing). This is the context-lean
  path the driver is built for.
- `sequential` — no dispatch tool exists, so advance each unit **inline, one at a time**:
  do the worker's read-and-transform yourself for a single unit, gate and commit it, then
  **purge that unit's detail from context** before the next. Slower and heavier, but still
  bounded — never load the whole catch-up into one window at once.

Either way the units run **serially, in the order below** — families overlap on files and
carry ordering dependencies (graduate ADRs before nesting the architecture docs), so they
are advanced one at a time, not concurrently.

---

## Phase A — Work the brief (framework files)

Read `.groundwork/cache/upgrade-brief.json`. If it does not exist, there is no brief-lane
work; go to Phase B.

The brief carries `from` (the version this install was stamped at), `to` (the version it is
being raised to), and `items[]`, each with a stable `id`, a `type` (`tier2-merge`,
`tier1-custom`, or `regenerate`), a `status`, and pointers to payloads the CLI staged under
`.groundwork/cache/upgrade/` — the worker never needs the npm package itself.

Open the session with the shape of the work: the version jump and a one-line list of pending
items. Then walk the items **top to bottom** — the CLI ordered them. For each, run the
driver loop:

1. **Propose.** Explain what this item will change and why in two or three sentences. Never
   batch approvals across items.
2. **Dispatch the worker** (at the `execution` tier). Hand a `reconcile-worker` the item verbatim as the capsule —
   `unit_kind: brief-item:<type>`, the staged `incoming`/`options`/`base_hash` pointers, and
   the project path it touches. The worker produces the merged / ported / regenerated change
   and returns its report. (Under `sequential`, do the worker's recipe inline — the item-type
   recipes live in the worker brief's "the work" section; do not duplicate them here.)
3. **Resolve what the worker flagged.** Any `COLLISIONS/AMBIGUITY` the report raises — a
   passage where a user edit and a framework improvement collide, a customization that may be
   obsolete, reconstructed generator options — is a **user** decision: surface it and let the
   user pick before committing. A `BLOCKING CONCERN` stops the item; route it as the report
   describes.
4. **Gate.** For every doc named under `REVIEW-NEEDED`, run the review subagent (Protocol 9)
   with the matching `document_type`. Proceed only on a parseable `VERDICT: PRESENT`; the gate
   is fail-closed. On `REVISE`, apply the 🔴 findings and re-invoke, to the 3-revise cap.
5. **Commit.** One item, one commit, referencing the item id —
   `chore(groundwork): <what changed> (<id>)`. The worker left its changes unstaged; the
   driver stages and commits them. Nothing outside the item's scope goes into its commit.
6. **Record completion** (bookkeeping contract below) before moving on.

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
2. **Propose.** One family, one explained proposal. Pause where an advance would imply a
   product decision the code does not prove — a removal that might be temporary, a capability
   that might be an experiment — and surface it rather than assume it.
3. **Dispatch the worker** (at the `execution` tier). Hand a `reconcile-worker` the capsule: `unit_kind: family:<name>`,
   the **Owner** column path(s) as the canonical to read, the project instance paths it found,
   and the row's advance approach. The worker reads canonical + instances *in its own
   context*, advances them, and returns its report. (Under `sequential`, do the advance inline
   for this one family, then purge the detail.)
4. **Resolve, gate, commit.** Resolve any `COLLISIONS/AMBIGUITY` with the user. Run the review
   subagent (Protocol 9) on every `REVIEW-NEEDED` canonical doc with its `document_type`,
   fail-closed, to the 3-revise cap. Then commit — one family, one commit
   (`chore(groundwork): advance <family> to current shape`); the worker left its changes
   unstaged.

### Family Index

The artifact families that drift as the framework evolves. Each row is a *pointer to the
owner* (the canonical shape — the worker reads it there, it is never duplicated here), the
*legacy signal* that flags an old instance, and the *advance* that carries it forward. This
index is ownership, not change history: it grows only when a genuinely new family appears,
not on every change. When a structure changes again, its owning skill changes (as it must)
and this pass picks the drift up for free.

| Family | Owner — current canonical | Legacy signal → advance |
|---|---|---|
| **Bets** | `.groundwork/skills/groundwork-bet/` workflows `00-quick.md` + `03-decomposition.md` + `04-delivery.md` and its templates | A bet under `docs/bets/<slug>/` carrying `decomposition.json`, `decomposition.md`, a `contracts/` dir, or a `test-manifest.json`; or a `pitch.md` missing `status` frontmatter → restructure to the prose `decomposition/` tree, infer and stamp `status`, drop the dead machine-readable artifacts (the suite + git are the record), take the approval baseline from the git tag `bet/<slug>/approved`. Restructure in-flight bets; leave shipped/archived ones as historical record, removing only stray obsolete files. **A `pitch.md` carrying `track: quick` is a legitimate quick bet, not a malformed bet** — its single-milestone `decomposition/` tree is correct by design; recognize the shape and leave it intact (never pad its ladder toward 2–5 milestones or restructure its one milestone away). **An in-flight bet (`status: delivery` or later) with an approved `decomposition/` tree but no `bet/<slug>/approved` git tag** predates the tag-writer fix in `03-decomposition.md`'s Transition — under git, back-fill it: find the decomposition-approval commit (`git log --oneline --grep='bet(<slug>): approve decomposition' --grep='bet(<slug>): approve quick bet' -- docs/bets/<slug>/decomposition/`) and tag that commit `bet/<slug>/approved`; if none is identifiable, tag `HEAD` and add a one-line `<!-- approval tag backfilled at HEAD by groundwork-update; decomposition-approval commit not identifiable -->` note to the bet's `pitch.md` so a later reader knows the baseline is approximate. |
| **Architecture docs** | The nested `docs/architecture/` layout the `groundwork-architecture` skill builds + its `meta.json` ordering | Flat architecture docs at the `docs/` root (`docs/architecture.md`, `docs/infrastructure.md`, `docs/domain/`, `docs/services/`, `docs/api/`, `docs/decisions/`) → relocate under `docs/architecture/` (`architecture.md` → `index.md`), rewrite `docs/meta.json` and seed `docs/architecture/meta.json`, carry every live cross-reference forward. Leave historical records alone. |
| **Doc contracts** | `.groundwork/skills/operating-contract.md` + the `groundwork-writer` skill | A published `docs/*.md` (outside `docs/bets/`) carrying a `## Summary for Downstream` section, or a code-coupled doc missing `last_reviewed` / `source_of_truth` frontmatter → graduate each still-binding Key Decision / Binding Constraint into a `docs/architecture/decisions/` ADR (or confirm it already lives in the body), strip the section, and stamp the drift-tracking frontmatter so `groundwork-check` can see the doc. |
| **Naming** | The `groundwork-design-system` skill; the structural-design principle (`code-structure`); the published package name `groundwork-method`; the current install layout (hidden methodology skills live at `.groundwork/skills/`) | `docs/ux-design.md` or a `hexagonal-architecture.md` present → rename to `docs/design-system.md` / `code-structure.md` and carry every live cross-reference forward; remove the orphaned old file. A project-owned script, CI step, or doc invoking `npx groundwork ` (trailing space + subcommand) → rewrite to `npx groundwork-method ` — flags and arguments unchanged, lockfiles and any unrelated tool that merely contains the word untouched. A project-owned doc, script, or CI step referencing the relocated hidden-skills path `.agents/groundwork/skills/` → rewrite the prefix to `.groundwork/skills/`, the rest of the path unchanged — the move is real and these references dangle. Leave the user-owned `config.toml` (never written) and historical records alone. |
| **Surfaces registry** | `.groundwork/skills/surfaces-contract.md` (its `version` field) + the `groundwork-surface-activation` skill | No `docs/surfaces.md` / `.groundwork/surfaces.json` on a multi-surface product → bootstrap the registry and capability ledger via `groundwork-surface-activation`. A runner-less `dev.config.json` whose surfaces/sidecars are invisible to `./dev` → register them as runners, without touching the db/jaeger compose. |
| **Docs site** | The `docs-site` generator (`.groundwork/config/generators.json`) | A docs site behind the current generator — no `app/brand.css`, unordered nav, unrendered `mermaid`, a redirect instead of a landing page → for a generator-produced site, **regenerate** through the worker's `regenerate` recipe with its recorded options; for a hand-built site, refactor in place to match the generator's output (brand projection, the mermaid remark transform, `docs/meta.json` ordering, the two-audience landing hero). Keep the unbranded fallback intact: a project with no `brand-tokens.json` stays on the stock theme. |
| **Next.js token layer** | The Next.js app generator (`.groundwork/config/generators.json`) | A Next.js app with a hardcoded `globals.css` and no per-app `brand.css` / token-conformance gate → regenerate the token layer from `brand-tokens.json` via the worker's `regenerate` recipe, reconcile any hand-edited `globals.css`, and add the conformance test. |
| **Engineer skills** | `src/engineer-skills/<stack>-engineer/` in the installed package — resolve the package root from any generator's `factory` path in `.groundwork/config/generators.json` (already an absolute path into the installed package) | A promoted skill under `.agents/skills/groundwork-<stack>-engineer/` whose provenance is recorded in `manifest.json` `generated[<generator>[:<name>]].files` (the scaffold call that promoted it — `promoteEngineerSkill` runs inside the service generator before its provenance snapshot) but whose on-disk file hashes no longer match the canonical → clean-replace the promoted tree from canonical, dropping a stale `sync-anchor.md` a pre-M6 promotion left (current canon never ships it). A file whose disk hash matches neither its recorded provenance hash nor canonical is user-edited → leave it and surface the diff, never clobber. A skill directory with **no** `manifest.generated` entries at all is project-authored (e.g. `groundwork-swift-engineer`), not this family — never touched. |

Generator-owned families (**Docs site**, **Next.js token layer**) advance through the
worker's `regenerate` recipe — the index names them so one framing covers every family, and
does not duplicate the generator's reconcile steps. The prose families advance through the
worker's relocate / rename / graduate / restructure recipes.

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
