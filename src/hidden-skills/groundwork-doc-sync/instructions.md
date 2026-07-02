---
name: groundwork-doc-sync
description: >
  Applies surgical documentation updates after code changes — a delivered slice, a merged
  PR, or a groundwork-check staleness report. Maps the change set to the docs whose truth
  it touches, edits them under the Living Documents protocol, and gates every mutated
  canonical doc through review before committing.
---

# groundwork-doc-sync

You are the Living Documents protocol pointed at the code. The canonical docs describe the system as it is; the code has moved; your job is to close that gap and prove through review that the docs still hold together afterwards.

This skill runs in three situations: a bet slice or milestone just shipped, a PR or manual code change landed outside the bet loop, or `groundwork-check` reported stale docs. In every case the work is the same: establish the change set, map it to affected docs, edit, gate, report.

Apply the `groundwork-writer` skill when modifying any document. Updates must preserve GroundWork tone: declarative, assertive, zero-hedging.

---

## Operating Contract

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) governs this skill. Read it before taking any other action. This is a **Maintenance** skill (see Lifecycle Modes): Protocols 1 (Discovery Notes), 2 (Living Documents), 4 (Pacing), 8 (Review Gate), and 9 (Review Invocation) apply. There is no phase cache, no hand-off file, and no fresh-context recommendation — a maintenance run starts and finishes inside one conversation. From `.groundwork/cache/` it reads only `discovery-notes.md` and `repo-map.json`.

---

## Step 1: Establish the Change Set

Determine which code changed and over what range. The user's invocation usually carries the anchor:

| Invocation | Change set |
|---|---|
| A bet slug or slice name | Commits whose messages reference the slug, or the range since the pitch's `status` last advanced — confirm the range with the user if ambiguous. |
| A PR, branch, or commit range | `git diff --name-only <range>` |
| A `groundwork-check` report | The STALE docs it named; for each, `git log --since="<last_reviewed>" --name-only -- <source_of_truth>` recovers the commits behind the staleness. |
| No anchor given | Run `groundwork-check`'s staleness-baseline procedure (defined in its `instructions.md`, Step 1); the union of flagged commits is the change set. |

The output of this step is a list of changed code paths and the commits that changed them. If the change set is empty, report that the docs are current and stop.

---

## Step 2: Map Changes to Affected Docs

Build the update plan in three passes. Each pass catches drift the previous one cannot see.

**Pass 1 — path intersection (deterministic).** Intersect the changed paths with every code-coupled doc's `source_of_truth` frontmatter. A doc whose source paths contain a changed file is affected. This is the baseline and runs in every environment.

**Pass 2 — reference graph (Serena, when registered).** A doc can be stale because a type its source references moved in a file outside its `source_of_truth` — path intersection misses this by construction. When the Serena MCP server is available, run impact analysis with `find_referencing_symbols` on the changed symbols and add any doc whose sources depend on changed code through the reference graph. `.groundwork/cache/repo-map.json`, when present, serves the same purpose offline. Skip this pass without comment when neither exists.

**Pass 3 — semantic mapping (judgement).** Prose docs carry no `source_of_truth`, so read the diff and ask what each change *means* for the documentation set:

| Change in code | Doc to update |
|---|---|
| Endpoint added, removed, or reshaped | `docs/architecture/api/<service>.md`; `docs/architecture/services/<service>.md` if env vars or dependencies moved |
| Entity field, lifecycle state, or domain event changed | `docs/architecture/domain/<entity>.md` — and `docs/architecture/index.md` if the change crosses a service boundary |
| New entity introduced | New `docs/architecture/domain/<entity>.md` from `.groundwork/skills/templates/domain-entity.md` |
| Service added, removed, or rewired | `docs/architecture/index.md` topology and boundaries, `docs/architecture/infrastructure.md` service table |
| Port, boot command, or test command changed | `docs/architecture/infrastructure.md` |
| A committed decision visibly replaced (vendor swapped, persistence model changed) | New ADR from `.groundwork/skills/templates/adr.md` superseding the old one — this is a **reversal**, see Step 3 |
| User-visible capability added or removed | `docs/product-brief.md` capabilities |
| Design tokens or visual system changed | `docs/design-system.md` and `.groundwork/config/brand-tokens.json` |
| A maturity signal moved — a service shipped without a contract, a harness or CI hook added/removed, a `groundwork-check` maturity disagreement | `docs/maturity.md`: open a roadmap row, close one with the closing anchor, or correct an assessment row (per `.groundwork/skills/maturity-model.md`) |

Classify each planned edit as a **refinement** or a **reversal** using Protocol 2's test: superseding an accepted ADR, or negating a bullet in any doc's `### Key Decisions` or `### Binding Constraints`, makes it a reversal. When in doubt, treat it as a reversal.

Present the plan in one compact block — each affected doc, what changed in the code, which sections will move, and the refinement/reversal classification — then proceed. These are refinements consistent with code the user already shipped, not new product decisions; the plan is shown so the user can redirect, not to request permission (Protocol 2). Pause only when a mapped change implies a decision the code does not prove — a capability that might be an experiment, a removal that might be temporary.

---

## Step 3: Apply Surgical Edits

Edit each affected doc under the Living Documents protocol:

- **Touch only what the change made false — but all of what it made false.** Do not rewrite sections that remain accurate; never leave an inaccurate sentence standing because the edit was "surgical". The published doc body is the only living record — setup's Downstream Context store is long gone (Protocol 10), so there is nothing alongside the doc to keep in sync.
- **State the current design declaratively.** No strikethrough, no "(was X, now Y)", no supersession notes in the body — that history lives in ADRs alone.
- **Re-stamp frontmatter**: `last_reviewed` to today on every mutated doc; keep `generation_mode` and `source_of_truth` accurate — a doc whose sources moved gets its `source_of_truth` corrected in the same edit, or the next check run is blind.
- **Index new docs.** Any newly created doc gets a one-line entry in the project's `llms.txt`. Agents cannot find docs that are not indexed.

**Reversals get the full Reversal Protocol (Protocol 2) before anything commits:** reconcile every sentence the reversal falsifies across the whole body, trace it into every dependent doc (domain entity docs especially — nothing automated flags them stale), record the supersession in an ADR, and re-review every `docs/architecture/domain/*.md` unconditionally when the reversal is structural.

Edits land in place — git is the rollback boundary. Nothing is committed to git until the gate passes and the user approves.

---

## Step 4: Review Gate

Announce the review, then invoke the review subagent (Protocol 9) once per mutated canonical doc, with `document_path` set to the doc's path and `document_type` matched to it (`docs/architecture/domain/<entity>.md` → `domain-entity`, `docs/architecture/index.md` → `architecture`, and so on). The gate is fail-closed (Protocol 8): proceed only on a parseable `VERDICT: PRESENT` for every mutated doc; a review that errors, hangs, or returns no verdict follows Protocol 9's failure path.

On **REVISE**, apply all 🔴 Critical findings directly to the doc and re-invoke. After 3 REVISE verdicts on a single doc, apply the revise cap (Protocol 8): stop, surface remaining 🔴 findings as 🟡 Advisory, and disclose that the review did not reach PRESENT.

Bet documents under `docs/bets/` are working artifacts of their own lifecycle and are not re-gated here — only canonical docs pass through this gate.

---

## Step 5: Report and Commit

1. **Report what changed**: each doc updated and what specifically shifted, each STALE doc deliberately left alone and why, and any new docs or ADRs created. This list is the change record the user approves.
2. **Capture stray signals.** Anything the user voiced during the run that belongs to another phase goes under its header in `.groundwork/cache/discovery-notes.md` (Protocol 1).
3. **Commit on approval.** After explicit user approval, commit the documentation changes to git as a single docs-only commit naming the change-set anchor (the bet slug, PR, or range). If the user declines, leave the edits uncommitted and say so plainly.

If the run surfaced drift this skill cannot close — a `generation_mode: generated` doc whose generator must re-run, a topology change that needs the scaffold skill — name it in the report with the recovery route rather than approximating the fix by hand.
