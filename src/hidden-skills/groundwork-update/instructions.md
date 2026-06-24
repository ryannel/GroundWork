---
name: groundwork-update
description: >
  The single call to bring a project up to the current GroundWork framework — files,
  structure, and docs site. Works the residual upgrade-brief items `npx groundwork-method
  update` compiles (merging framework improvements into edited docs, reconciling
  regenerated scaffold output), then reconciles every artifact family against the live
  current canonical shape, advancing legacy structure forward. One family, one explained
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

You execute both conversationally and leave the project as if it had been set up at the
current version all along.

Apply the `groundwork-writer` skill when modifying any document.

---

## Operating Contract

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1)
governs this skill in **Maintenance** mode: Protocols 1 (Discovery Notes), 2 (Living
Documents), and 4 (Pacing) apply, and Protocols 8 and 9 (Review Gate, Review Invocation)
apply whenever a brief item or a reconcile advance mutates a canonical doc. There is no
phase cache beyond the brief itself.

Run **Phase A first** — it clears the brief the CLI staged — then **Phase B**, which
reconciles what no brief can see. A run that finds no brief skips straight to Phase B.

---

## Phase A — Work the brief (framework files)

Read `.groundwork/cache/upgrade-brief.json`. If it does not exist, there is no brief-lane
work; go to Phase B.

The brief carries `from` (the version this install was stamped at), `to` (the version it is
being raised to), and `items[]`, each with a stable `id`, a `type`, a `status`, and
pointers to payloads the CLI staged under `.groundwork/cache/upgrade/` — you never need the
npm package itself.

Open the session with the shape of the work: the version jump and a one-line list of
pending items. Then walk the items **top to bottom** — the CLI ordered them. For each:

1. **Verify it applies.** Every item type has a detect step (below). An item that is
   already done or not applicable is checked off with a note, not performed.
2. **Propose, then act.** Explain what will change and why in two or three sentences, show
   the concrete diff or plan, and get the user's approval. Never batch approvals across
   items.
3. **Commit.** One item, one commit, referencing the item id —
   `chore(groundwork): <what changed> (<id>)`. Nothing outside the item's scope goes into
   its commit.
4. **Record completion** (bookkeeping contract below) before moving on.

Stop at any point the user asks; the brief survives across sessions and `update` re-runs
merge into it without duplicating items.

### Item types

#### `tier2-merge`

A framework-seeded doc the user edited, where the framework has since improved its copy.
`path` is the user's file, `incoming` is the new package content (staged in the cache),
`base_hash` is the manifest's record of what was originally deployed (null means unknown
ancestry).

Reason over both versions: what did the user change, and what did the framework improve?
Produce a merge that **preserves the user's intent and adopts the framework's
improvements** — never a mechanical overwrite in either direction, never conflict markers.
When user edits and framework improvements collide on the same passage, show both and let
the user pick. `AGENTS.md` deserves extra care: it routes every agent session, so a broken
merge breaks the project's tooling.

#### `tier1-custom`

A framework-owned file (typically the `dev` launcher) the user customized, blocking the
clean replace. Show what the customization does, show the `incoming` framework version, and
either port the customization onto the new version or — if the customization is obsolete —
adopt the framework file. The user decides.

#### `regenerate`

Generator output whose generator has moved since it was deployed. Re-run the recorded
generator in a scratch workspace and reconcile:

1. Create `.groundwork/cache/upgrade/regen/<artifact>/` with minimal Nx markers
   (`package.json` `{"name":"regen"}`, empty `nx.json`) and copy
   `.groundwork/config/brand-tokens.json` in if the generator themes from it.
2. Run the generator there with the item's recorded `options`, via the project's
   `.groundwork/config/generators.json` registration
   (`npx nx g <generators.json-path>:<generator> …`). If `options` is null (adopted output,
   unknown ancestry), reconstruct them from the artifact — e.g. `.dev/dev.config.json`
   carries the app name and colors — and confirm with the user.
3. Diff the regenerated files against the project, walking the provenance file list.
   Propose framework-section changes; leave user-section changes alone (a docker-compose
   service the user added is theirs; the generator's infra block is the framework's). An
   empty diff is a clean check-off.

This is also the mechanism the **generator-owned families** in Phase B advance through — a
docs site or a Next.js token layer behind its generator is regenerated and reconciled here.

---

## Phase B — Reconcile to the current canonical (structure)

The brief only knows about files the framework seeds or generates. It cannot see that a
project's *structures* — how its bets are laid out, where its architecture docs live, what
its published docs may contain — were authored against an older shape. There is no change
log to replay and none is needed: the framework now sitting in `.groundwork/skills/` **is**
the definition of the current shape, and it cannot drift, because it is the source. So you
reconcile the project to it.

For each family in the **Family Index** below:

1. **Locate** the project's instances of the family.
2. **Read the current canonical** — the owner named in the Owner column. That is the worked
   example of the target shape; it is never restated here.
3. **Detect divergence** by the legacy signal. A family whose instances already match
   canonical is checked off untouched — and left no ledger entry, because the next run
   re-derives the same answer from the artifacts themselves. Phase B is idempotent by
   construction; detect-first *is* the bookkeeping.
4. **Advance** divergent instances to the current shape using the approach noted, with the
   canonical as your reference. Compare against the live canonical directly; reach for the
   framework's own git history only to disambiguate a genuinely ambiguous transform.

One family, one explained proposal, one commit (`chore(groundwork): advance <family> to
current shape`). Any canonical doc an advance mutates passes the review gate (Protocols
8–9) before that commit, with the matching `document_type`. Pause where an advance would
imply a product decision the code does not already prove — a removal that might be
temporary, a capability that might be an experiment — and surface it rather than assume it.

### Family Index

The artifact families that drift as the framework evolves. Each row is a *pointer to the
owner* (the canonical shape — read it there, it is never duplicated here), the *legacy
signal* that flags an old instance, and the *advance* that carries it forward. This index
is ownership, not change history: it grows only when a genuinely new family appears, not on
every change. When a structure changes again, its owning skill changes (as it must) and
this pass picks the drift up for free.

| Family | Owner — current canonical | Legacy signal → advance |
|---|---|---|
| **Bets** | `.groundwork/skills/groundwork-bet/` workflows `03-decomposition.md` + `04-delivery.md` and its templates | A bet under `docs/bets/<slug>/` carrying `decomposition.json`, `decomposition.md`, a `contracts/` dir, or a `test-manifest.json`; or a `pitch.md` missing `status` frontmatter → restructure to the prose `decomposition/` tree, infer and stamp `status`, drop the dead machine-readable artifacts (the suite + git are the record), take the approval baseline from the git tag `bet/<slug>/approved`. Restructure in-flight bets; leave shipped/archived ones as historical record, removing only stray obsolete files. |
| **Architecture docs** | The nested `docs/architecture/` layout the `groundwork-architecture` skill builds + its `meta.json` ordering | Flat architecture docs at the `docs/` root (`docs/architecture.md`, `docs/infrastructure.md`, `docs/domain/`, `docs/services/`, `docs/api/`, `docs/decisions/`) → relocate under `docs/architecture/` (`architecture.md` → `index.md`), rewrite `docs/meta.json` and seed `docs/architecture/meta.json`, carry every live cross-reference forward. Leave historical records alone. |
| **Doc contracts** | `.groundwork/skills/operating-contract.md` + the `groundwork-writer` skill | A published `docs/*.md` (outside `docs/bets/`) carrying a `## Summary for Downstream` section, or a code-coupled doc missing `last_reviewed` / `source_of_truth` frontmatter → graduate each still-binding Key Decision / Binding Constraint into a `docs/architecture/decisions/` ADR (or confirm it already lives in the body), strip the section, and stamp the drift-tracking frontmatter so `groundwork-check` can see the doc. |
| **Naming** | The `groundwork-design-system` skill; the structural-design principle (`code-structure`) | `docs/ux-design.md` or a `hexagonal-architecture.md` present → rename to `docs/design-system.md` / `code-structure.md` and carry every live cross-reference forward; remove the orphaned old file. |
| **Surfaces registry** | `.groundwork/skills/templates/surfaces.md` (its `version` field) + the `groundwork-surface-activation` skill | No `docs/surfaces.md` / `.groundwork/surfaces.json` on a multi-surface product → bootstrap the registry and capability ledger via `groundwork-surface-activation`. A runner-less `dev.config.json` whose surfaces/sidecars are invisible to `./dev` → register them as runners, without touching the db/jaeger compose. |
| **Docs site** | The `docs-site` generator (`.groundwork/config/generators.json`) | A docs site behind the current generator — no `app/brand.css`, unordered nav, unrendered `mermaid`, a redirect instead of a landing page → for a generator-produced site, **regenerate** through Phase A's `regenerate` path with its recorded options; for a hand-built site, refactor in place to match the generator's output (brand projection, the mermaid remark transform, `docs/meta.json` ordering, the two-audience landing hero). Keep the unbranded fallback intact: a project with no `brand-tokens.json` stays on the stock theme. |
| **Next.js token layer** | The Next.js app generator (`.groundwork/config/generators.json`) | A Next.js app with a hardcoded `globals.css` and no per-app `brand.css` / token-conformance gate → regenerate the token layer from `brand-tokens.json` via Phase A's `regenerate` path, reconcile any hand-edited `globals.css`, and add the conformance test. |

Generator-owned families (**Docs site**, **Next.js token layer**) advance through Phase A's
`regenerate` mechanism — the index names them so one framing covers every family, and does
not duplicate the generator's reconcile steps. The prose families advance through this
phase's reconcile.

---

## Bookkeeping — Phase A items, exact, every item

This contract is what keeps `update`, `check`, and future sessions honest about brief-lane
work. (Phase B needs none — detect-first re-derives a family's state from its artifacts
every run.) After each brief item is committed (or checked off as done / n-a):

- **Brief:** set the item's `status` to `"done"` in `.groundwork/cache/upgrade-brief.json`.
- **Manifest** (`tier2-merge` and `tier1-custom` items): in
  `.groundwork/config/manifest.json`, set the file's entry to the merged reality — `hash` =
  SHA-256 of the file now on disk, `base` = SHA-256 of the `incoming` package content you
  merged against, `version` = the brief's `to`. (Compute with `shasum -a 256 <file>`.) This
  is what stops the same merge being queued forever.
- **Manifest** (`regenerate` items): set `generated[<artifact>].version` to the brief's
  `to`, and record the `options` you used if the entry had none.

Include the bookkeeping edits in the item's commit.

When every brief item is done, delete the brief and the staged payloads
(`.groundwork/cache/upgrade-brief.json`, `.groundwork/cache/upgrade/`) — cache lifecycle
rules — in a final tidy commit. Then close by naming the version the project now stands at
and confirming Phase B is reconciled, and suggest `npx groundwork-method check` as the
proof.
