---
name: reconcile-worker
description: >
  Advances one update unit — a single upgrade-brief item or one Family Index family — to
  the current GroundWork canonical, in an isolated subagent context, and returns a small
  structured report. Dispatched by the groundwork-update driver
  (groundwork-update/instructions.md) once per unit; the driver supplies the unit capsule,
  the worker reads the canonical and the project's instances, produces the proposed change,
  and only the report flows back — the transform reasoning stays in the worker's context.
tier: execution
---

# Reconcile Worker

## How This Brief Is Invoked

This brief runs in an **isolated subagent context** — never in the groundwork-update
driver's main conversation. The driver dispatches one worker per unit, hands it a tight
capsule, and receives back only a short structured report. The canonical reads, the
instance reads, the merge or relocation reasoning — all of it stays in the worker's context
and dies with it when the worker returns.

This isolation is the point. Running the whole catch-up inline piles every family's
transform reasoning — the canonical templates, the project's instances, the diff judgement —
into one window; the driver's context grows until it can no longer reason well about the
update as a whole. Farming each unit to a disposable worker keeps the driver thin enough to
hold the brief, the Family Index, the pacing, the review gate, and the commits — the work
only it can do.

### Invocation environments

| Environment | How the driver dispatches the worker |
|---|---|
| Claude Code | Via the `Task` tool with a general-purpose subagent. The prompt loads this file and supplies the capsule below. |
| Other environments | Any mechanism that runs this brief in an isolated context with file-read, file-write, and shell tools, and returns the final text. |

The contract is environment-agnostic — the capsule and the returned report are the same
regardless of how the isolated execution is realised.

### Model

The worker runs at the **`execution`** tier (Model Tiers, operating contract) — a capable,
cheaper class than the driver and the review. Its correctness is not taken on trust: the
driver gates every mutated canonical doc through an independent `frontier` review
(Protocol 9) before it commits the unit. The worker's job is to advance honestly and report
honestly, not to be the final judge of its own work.

---

## Inputs — the unit capsule

The driver passes one unit and the small set of pointers that let the worker advance it
without re-deriving the whole framework:

- `unit_kind` — one of:
  - `brief-item:tier2-merge`, `brief-item:tier1-custom`, `brief-item:regenerate` — a single
    item from `.groundwork/cache/upgrade-brief.json`, passed verbatim (its `path`,
    `incoming`, `base_hash`, `options`, `artifact`, … fields).
  - `family:<name>` — one row of the driver's Family Index (e.g. `family:architecture-docs`,
    `family:doc-contracts`, `family:bets`, `family:naming`, `family:surfaces-registry`,
    `family:docs-site`, `family:nextjs-tokens`).
- **Canonical owner path(s)** — the live current shape to read in full and treat as the
  worked example: the brief item's staged `incoming` payload, or the family's Owner column
  (a skill/template/generator under `.groundwork/skills/` or `.groundwork/config/`). The
  canonical is the source of truth for the target shape; it is never restated in the capsule.
- **Project instance path(s)** — the exact files/dirs this unit transforms, to read in full
  before changing anything.
- **Advance approach** — the one-line recipe from the Family Index row (or the item type's
  recipe below): what the legacy signal is and what advancing it means.
- **Scope boundary** — touch only this unit's files. Do not advance another family, refactor
  unrelated docs, or reach outside the named instances.

---

## The work

### 1. Read before you change

Most reconciliation failures are context failures — the agent relocates a doc and breaks
the cross-references it never read. Before editing anything:

- **Read the canonical owner in full.** It is the target shape. For a generator-owned family,
  read the generator's output contract; for a prose family, read the skill/template that
  defines the current layout.
- **Read every project instance this unit touches, in full** — and, for a relocation or
  rename, grep the project for live cross-references to the paths you will move.
- **Detect-first.** Confirm the legacy signal actually holds. If the instances already match
  canonical, make no change and return an `already-current` report — the driver checks the
  unit off untouched.

### 2. Advance to canonical — by unit kind

Apply the `groundwork-writer` skill whenever you edit a `docs/` document.

**`brief-item:tier2-merge`** — a framework-seeded doc the user edited, where the framework
improved its copy. Reason over both: what did the user change, what did the framework
improve? Produce a merge that **preserves the user's intent and adopts the framework's
improvements** — never a mechanical overwrite either way, never conflict markers. Where a
user edit and a framework improvement **collide on the same passage**, do not pick for the
user — leave the user's text in place and record the collision under `COLLISIONS/AMBIGUITY`
for the driver to resolve. `AGENTS.md` deserves extra care: it routes every agent session.

**`brief-item:tier1-custom`** — a framework-owned file (typically the `dev` launcher) the
user customized. Port the customization onto the `incoming` framework version. If the
customization looks obsolete, do not decide it — apply the framework version and record the
customization under `COLLISIONS/AMBIGUITY` so the driver confirms with the user.

**`brief-item:regenerate`** — generator output whose generator moved. Regenerate and
reconcile:
1. Create `.groundwork/cache/upgrade/regen/<artifact>/` with minimal Nx markers
   (`package.json` `{"name":"regen"}`, empty `nx.json`) and copy
   `.groundwork/config/brand-tokens.json` in if the generator themes from it.
2. Run the generator there with the item's recorded `options`, via
   `.groundwork/config/generators.json` (`npx nx g <generators.json-path>:<generator> …`).
   If `options` is null, reconstruct them from the artifact (e.g. `.dev/dev.config.json`
   carries app name and colours) and record the reconstruction under `COLLISIONS/AMBIGUITY`
   for the driver to confirm.
3. Diff the regenerated files against the project. Apply framework-section changes; leave
   user-section changes alone (a docker-compose service the user added is theirs; the
   generator's infra block is the framework's). An empty diff is a clean `already-current`.

   This is also how the **generator-owned families** (`family:docs-site`,
   `family:nextjs-tokens`) advance — regenerate from the recorded generator and reconcile.

**`family:<name>`** — advance the project's instances to the canonical the Owner defines,
following the row's advance approach. The common shapes:
- **Relocate** (e.g. flat `docs/architecture.md` → nested `docs/architecture/index.md`):
  move the files into the canonical layout, rewrite the affected `meta.json`(s), and carry
  every live cross-reference forward. Leave historical records alone.
- **Rename + carry refs** (e.g. `docs/ux-design.md` → `docs/design-system.md`): rename, carry
  every live cross-reference forward, remove the orphaned old file.
- **Reference rewrite** (no file moves — only dangling references): rewrite a stale token in
  place across project-owned docs, scripts, and CI — `npx groundwork ` → `npx groundwork-method `,
  or the relocated hidden-skills prefix `.agents/groundwork/skills/` → `.groundwork/skills/`.
  Touch only the changed token; leave the rest of each line intact. Stay off the user-owned
  `config.toml`, lockfiles, archived/historical records, and any unrelated string that merely
  contains the word. If a reference is genuinely ambiguous (it could name an unrelated thing),
  record it under `COLLISIONS/AMBIGUITY` rather than rewriting blindly.
- **Graduate + stamp** (doc-contracts): graduate each still-binding Key Decision / Binding
  Constraint out of a `## Summary for Downstream` section into a `docs/architecture/
  decisions/` ADR (or confirm it already lives in the body), strip the section, and stamp
  the drift-tracking frontmatter. Never delete a binding decision without first landing it
  in an ADR or the body — if a decision's disposition is genuinely unclear, record it under
  `COLLISIONS/AMBIGUITY` rather than dropping it.
- **Restructure** (bets): restructure an in-flight bet to the current prose shape, infer and
  stamp `status`, drop the dead machine-readable artifacts. Leave shipped/archived bets as
  historical record, removing only stray obsolete files.
- **Bootstrap / register** (surfaces): bootstrap the registry twins or register runners per
  the Owner skill, without touching db/jaeger compose.

**Scope discipline.** Make only the changes this unit's advance requires. Compare against the
live canonical directly; reach for the framework's own git history only to disambiguate a
genuinely ambiguous transform. Do not advance other families or refactor unrelated subsystems.

### 3. Do not commit

The worker advances the unit and stops. It does **not** commit, gate its own review, or
do the driver's bookkeeping — those are the driver's, after its independent review and the
user pacing only it holds. Leave the working tree with this unit's changes unstaged; return
the report.

---

## The report

Return a short structured report and nothing else — no narration of the transform, no
replay of files read. Keep it to what the driver needs to review, gate, and commit:

```
UNIT: <unit_kind> — <one-line what this unit is>
RESULT: advanced | already-current | blocked

FILES:
- added: <path>, ...
- modified: <path>, ...
- deleted: <path>, ...
- moved: <from> -> <to>, ...

REVIEW-NEEDED:
- <canonical doc path>  document_type: <product-brief|design-system|architecture|infrastructure|domain-entity|maturity|...>
- ...   (the canonical docs this unit mutated; none for a non-canonical change)

COLLISIONS/AMBIGUITY: none | <each decision the driver must take with the user — a tier2
  passage where a user edit and a framework improvement collide, a customization that may be
  obsolete, reconstructed generator options to confirm, an advance that implies a product
  decision the code does not prove>

BLOCKING CONCERN: none | <why this unit cannot be honestly advanced as scoped>
```

Set **BLOCKING CONCERN** when the unit cannot be honestly advanced:
- The canonical and the instance disagree in a way the advance approach does not cover.
- Advancing would require a decision the code does not prove (a removal that might be
  temporary, a capability that might be an experiment) — surface it; do not assume it.
- A generator or dependency the advance needs cannot be run or reached in this environment.

The report is the worker's entire output. Keep it tight: if it runs long, it is explaining
instead of reporting — cut the explanation.
