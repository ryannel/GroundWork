---
name: operating-contract
version: "1"
description: >
  Shared behavioral protocols every GroundWork methodology skill loads and enacts:
  discovery notes, living documents, lifecycle modes, phase lifecycle, pacing,
  the downstream context store, setup graduation, hand-off cache, cache isolation,
  the review gate, and review invocation.
---

# GroundWork Operating Contract

**This document is mandatory. Every GroundWork methodology skill MUST load and follow these protocols. They are non-negotiable and apply in every phase, every bet, and every conversation.**

The `version` in this file's frontmatter is the contract's major version. Skills name the contract version they were written against; a skill that expects v1 running against a v2 contract is operating on assumptions the contract no longer makes — surface the mismatch to the user instead of proceeding silently.

---

## Protocol 1: Discovery Notes

Out-of-phase signals captured now save the user from repeating themselves in later phases — capture them immediately.

During any GroundWork conversation, the user will mention things that belong to a different phase — design preferences during a product brief, delivery priorities during architecture, architectural instincts during the design system phase. These signals are valuable and must be preserved.

### How It Works

During every turn, silently monitor for out-of-phase signals. When you hear one:

1. Acknowledge it naturally within the conversation if appropriate, then steer back to the current topic.
2. Append the signal as a new bullet under the appropriate section header in `.groundwork/cache/discovery-notes.md`. Use file editing tools — shell commands (echo, sed) corrupt markdown formatting. If the file does not exist, create it from `.groundwork/skills/templates/discovery-notes.md` — the section headers below are its calibration, not a second creation source.
3. Continue with the next discovery question in the same turn so the user's flow is not interrupted.

### Section Headers

The discovery notes file uses these five sections. Every skill that writes or reads discovery notes uses exactly these headers — drift between writers and readers turns notes into orphans neither side can find.

| Section | What goes here |
|---|---|
| `## Product Brief` | Vision-level signals surfaced during later phases — new user types, missing capabilities, refined success criteria. Captured for in-flight batched application to `docs/product-brief.md`. |
| `## Design System` | Anything about **what the user sees or does** — interaction patterns, search/browse/navigation flows, aesthetic instincts, look-and-feel preferences — surfaced outside the Design System phase. The bright line vs `## Design Details`: if the signal describes the user-facing experience it goes here, even when it names a concrete mechanism (e.g. "faceted pills alongside conversational search", "more-like-this pivots"). |
| `## Architecture` | Infrastructure preferences, scaling instincts, technology opinions surfaced outside the architecture phase. |
| `## Design Details` | **Internal mechanisms the user never sees directly** — async flows, callback patterns, job lifecycles, data ownership decisions, contract format choices, resiliency patterns — from capability and boundary conversations. Feeds the Bet's Design Foundations phase when producing API contracts and data schema. Not for user-facing interaction patterns; those go to `## Design System`. |
| `## Bets` | Delivery priorities, MVP scope instincts, feature sequencing for future bets. Read by `groundwork-mvp` and the Bet discovery workflow. |

### When to Check

At the start of any phase, check `.groundwork/cache/discovery-notes.md` for entries under your phase's header. Treat them as pre-discovered context. Re-asking signals that were already captured wastes the user's time and erodes trust in the process. Carry this context into the relevant stages.

### Distinction from Hand-off Cache

Discovery notes capture signals *during* a conversation that belong to a different phase. The Hand-off Cache (Protocol 6) captures post-commit context that did not fit in the canonical doc. The two patterns are complementary, not alternative — a single phase typically writes to both.

---

## Protocol 2: Living Documents

Documents that fall behind the conversation lose value. All `docs/` artifacts are living documents — update them as new information surfaces.

This is not restricted to a specific phase or direction. Any phase, any bet, any conversation: if new information surfaces that refines an existing document, update it immediately.

- A bet can update the product brief.
- Architecture can update the design system.
- Delivery can update architecture.
- A user interview can update everything.

### How to Apply Updates

- **Surgical and targeted.** Change only what new information warrants. Do not rewrite sections that remain accurate. But "surgical" is never licence to leave *inaccurate* text standing: any sentence the change makes false must be rewritten, not annotated around.
- **Refresh the Downstream Context if it is still live.** During setup, if the change touches a Key Decision, Binding Constraint, or Deferred Question of an upstream phase whose `.groundwork/context/<phase>.md` has not yet been torn down (Protocol 10), update that file in the same edit. After setup completes there is no context file to refresh — the published doc is the only living record.
- **State the current design declaratively.** Write the body as if the current design were always the design. Never leave `~~strikethrough~~` of the old choice, "(was X, now Y)" parentheticals, or "superseded by…" notes in the body — that hedging belongs in the superseding ADR alone. A doc that names both the old and the new design reads as contradictory to a downstream consumer and to the review.
- **Do not ask for permission.** These are refinements consistent with the user's own words and decisions, not new product choices.
- **Report what changed.** After committing, briefly list any documents that were updated and what specifically shifted. This change list is also the set of docs the reversal gate re-reviews (below) — keep it accurate.
- If no updates are warranted, skip silently.

### Refinements vs Reversals

Most Living Documents updates are **refinements**: they add detail, sharpen wording, or record a decision compatible with what the doc already commits to. Refinements need only the surgical edits above.

A **reversal** is different — it overturns a decision a prior doc already committed. Reversals are the dangerous case: they leave earlier docs describing a system that is no longer being built. A change is a **reversal** (not a refinement) if *either* of these is true:

- **(a)** you write, or mark, an ADR that *supersedes* an accepted ADR; or
- **(b)** your edit negates, removes, or replaces a bullet in any doc's `### Key Decisions` or `### Binding Constraints`.

When in doubt, treat it as a reversal — the cost of an unnecessary re-review is far lower than the cost of canonical docs that contradict each other.

### Reversal Protocol — reconcile, then re-gate

When a change is a reversal, before you commit:

1. **Reconcile the whole body.** Rewrite every sentence the reversal makes false, in every section of the doc. If the reversed phase's `.groundwork/context/<phase>.md` is still live, reconcile it too so it and the body describe the same single design.
2. **Reconcile every dependent doc that cites the reversed decision.** A reversal rarely lives in one file. Trace it into the docs that consumed it and fix them too: domain entities (`Owner:`, fields, lifecycle, events), service docs, infrastructure, and any doc that references the reversed decision.
3. **Record the supersession in an ADR.** The old design lives *only* in the superseding ADR (Context / Decision / what it cost), never as a residue in the body or summary.
4. **Re-gate: re-invoke `groundwork-review` on every mutated canonical doc.** This is the safety net the reversal exists to trip. For each doc you changed, run the review with the matching `document_type` (a mutated `docs/architecture/domain/<entity>.md` uses `document_type: domain-entity`). Apply 🔴 findings and re-review until `PRESENT`.
   - **Domain docs are re-reviewed unconditionally on a structural reversal.** When the reversal supersedes an accepted ADR or changes an architecture `### Key Decision` / `### Binding Constraint`, re-review **every** `docs/architecture/domain/*.md` (`document_type: domain-entity`), not only the ones you remembered to edit. Domain stubs carry no summary, so nothing flags them when they drift — and "the facilitator forgot the domain docs were dependents" is the exact failure this protocol exists to prevent. The set is small and the re-review is cheap; do not gate it on your own judgement of which entities the reversal touched.
   - **Cap and fail-closed handling:** the revise cap and the rule for a reviewer that cannot run are defined once in Protocol 8 (Review Gate), and the dispatch and failure procedure once in Protocol 9 (Review Invocation); both apply here unchanged — a re-gate that errors blocks the commit exactly as a drafting-phase review does.

**Accepted residual:** a *refinement* that introduces a minor body-only inconsistency while the live Downstream Context (if any) stays accurate is not re-gated — downstream setup phases read the Downstream Context first (Protocol 3.2.2, Protocol 5), so the drift is low-impact and is caught later by `groundwork-check`. Reversals are gated because they corrupt the cross-phase contract and the dependent docs; refinements are not, to keep the common case cheap.

---

## Lifecycle Modes

GroundWork operates in two distinct lifecycle modes. Skills must know which mode they operate in — it determines which protocols apply.

### Sequential Setup

**Skills:** `groundwork-product-brief`, `groundwork-design-system`, `groundwork-architecture`, `groundwork-scaffold`, `groundwork-mvp`, `groundwork-product-brief-extract`, `groundwork-design-system-extract`, `groundwork-architecture-extract`, `groundwork-infra-adopt`

All protocols apply: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. The brownfield extract and adopt skills are Sequential Setup phases that reverse-engineer their artifacts from an existing codebase rather than building them through greenfield discovery — the lifecycle, cache, hand-off, context, and review obligations are identical to their greenfield counterparts.

- Each phase writes a cache file in `.groundwork/cache/` at init and deletes it on commit.
- Each phase writes a hand-off file to `.groundwork/cache/handoff/<phase>.md` on commit (Protocol 6) — except the terminal phase of each track (`groundwork-mvp` for greenfield, `groundwork-infra-adopt` for brownfield), which writes none: there is no next setup phase left to consume one.
- Each phase writes a Downstream Context file to `.groundwork/context/<phase>.md` on commit (Protocol 5); the published `docs/` artifact carries no `## Summary for Downstream` section. `groundwork-mvp` is the one exception — its successor runs in Continuous Bet mode and reads the pitch and discovery notes directly, so it writes none.
- The setup→delivery transition runs Setup Graduation (Protocol 10): durable context graduates into `docs/`, then `.groundwork/context/` is torn down.
- A fresh context is recommended between phases (Protocol 3.4.8).

### Brownfield Scan (carve-out)

**Skill:** `groundwork-scan`

`groundwork-scan` is the Phase 0 preparation step of the brownfield track. It reads an existing codebase and writes a **scan baseline** — a resumable progress file and concern-split findings — into `.groundwork/cache/`, which the brownfield extract phases distil into canonical docs. It produces no `docs/` artifact, so three Sequential Setup obligations do not apply to it:

- **No Downstream Context file and no hand-off file** (Protocols 5 and 6) — it writes no `docs/` artifact and no `handoff/<phase>.md`. Its structured findings files *are* the hand-off, and they fan out to three readers rather than a single next phase.
- **No review gate** (Protocol 8) — there is no canonical doc to gate. The review gate fires on each downstream extract when it commits its `docs/` artifact.
- **Findings persist past commit, not deleted at commit** (inverting Protocol 3.4.3) — the findings are the durable input the extract phases consume. `groundwork-infra-adopt`, the last setup phase that reads the baseline, deletes the shared scan cache at its commit.

Scan completion is tracked as a durable `scan` marker in `state.json`, not inferred from a `docs/` artifact, because the scan cache is purged before setup ends. Protocols 1 and 4 still apply: the scan captures out-of-phase signals into `discovery-notes.md` and paces its one scope-confirmation interview.

### Continuous Bet

**Skills:** `groundwork-bet` (all five phases: discovery, design, decomposition, delivery, validation)

Protocols 1, 2, 4, 8, and 9 apply. Protocols 3, 5, 6, and 7 do **not** apply.

- The pitch frontmatter `status` field is the state machine. No *per-phase* cache file is created at init and deleted at commit the way Sequential Setup phases do — the only cache files in play are the shared `discovery-notes.md` and transient drafts such as `bet-pitch-draft.md`.
- No hand-off files are written. Context is shared across all five phases — a fresh context is not recommended between bet phases.
- Bet documents (`docs/bets/<slug>/*`) have no Downstream Context file and no `## Summary for Downstream` section. The pitch's `status` field and the shared context serve the same function.
- Protocol 7 cache isolation rules apply to the `.groundwork/cache/discovery-notes.md` file only.

This divergence is intentional. The bet's tightly coupled five-phase flow benefits from shared context; the one-shot setup phases benefit from clean isolation. A skill that looks non-conformant against the setup protocols may be correctly implementing the continuous-bet mode.

### Maintenance (anytime)

**Skills:** `groundwork-doc-sync`, `groundwork-update`, `groundwork-check`, `groundwork-patch`, `groundwork-surface-activation`

Maintenance skills run on demand at any point after setup — they keep the committed doc set true, rather than producing new phase artifacts. For `groundwork-doc-sync`, Protocols 1, 2, 4, 8, and 9 apply; Protocols 3, 5, and 6 do not — a maintenance run has no phase cache, no hand-off file, and no fresh-context recommendation. Under Protocol 7 it reads only `discovery-notes.md` and `repo-map.json` from the cache. When a maintenance run *creates* a doc (a new domain entity, a superseding ADR), the new file follows the same template and contract as its setup-phase counterpart.

`groundwork-update` (the framework front door — distinct from `groundwork-doc-sync`, which syncs docs to the project's own code) runs under the same protocol set as `groundwork-doc-sync` (1, 2, 4; 8 and 9 when a brief item or a reconcile advance mutates a canonical doc). Its additional obligation is the framework catch-up: Phase A executes the items `npx groundwork-method update` compiled into `.groundwork/cache/upgrade-brief.json`, in order; Phase B reconciles each artifact family to the current canonical that ships in `.groundwork/skills/` (its Family Index) — there is no phase cache beyond the brief itself.

`groundwork-patch` runs under the same protocol set as `groundwork-doc-sync` (1, 2, 4; 8 and 9 when a reversal re-gate fires). Its additional obligation is the stamped patch commit: every patch lands as a single commit carrying `Lane: patch` and `Area:` trailers so bet discovery can mine clusters from git history, and its scope test routes contract-touching or clustering work to the bet lifecycle instead of absorbing it.

`groundwork-surface-activation` runs under the same protocol set as `groundwork-doc-sync` (1, 2, 4; 8 and 9 when a reversal re-gate fires — typically a contract-compatibility stance overturning an architecture Key Decision). Its additional obligation is the registry twins: every change to `docs/surfaces.md` updates `.groundwork/surfaces.json` in the same edit, and its ledger triage leaves no cell of the new surface's column empty.

`groundwork-check` is read-only and diagnostic: it mutates nothing, so only Protocol 7's read rules bind it. Its obligation is reporting honesty — a doc it cannot assess is reported as unassessed, never as current.

---

## Protocol 3: Phase Lifecycle

Every methodology phase follows the same lifecycle. The sequence ensures artifacts are committed consistently — deviating risks orphaned cache files, lost discovery notes, or stale hand-offs that the next phase incorporates as if current.

### 1. Initialize

Check if the phase's cache file exists in `.groundwork/cache/`.

- If it **does not exist**, create it from the phase's template.
- If it **does exist**, read it. If work is in progress, summarise what has been completed and ask whether the user wants to resume or start fresh. If they choose to start fresh, reset the cache from the template. If they choose to resume, skip to the first incomplete stage.

### 2. Read Upstream Context

Read context from the prior phase in this exact order — the order minimises context consumption while preserving every cross-phase signal:

1. **Hand-off file** — `.groundwork/cache/handoff/<previous-phase>.md` if it exists. This is the previous phase's post-commit context drop (Protocol 6). Read it in full.
2. **Downstream Context files** — for each upstream phase this phase depends on, read `.groundwork/context/<upstream-phase>.md` (Protocol 5). Use it as the working context.
3. **Full upstream sections — lazy** — read the body of an upstream `docs/*.md` only when a specific decision in the current phase requires detail the context file does not carry. Do not pre-load entire upstream docs into context.
4. **Discovery notes** — check `.groundwork/cache/discovery-notes.md` for entries under your phase's section header (Protocol 1).

Skills must name their upstream chain explicitly — which prior phases the hand-off and summaries are read from. Do not infer the chain from project state.

### 3. Execute Stages

Work through the phase's stages as defined in its instructions. Update the cache file as each stage completes.

Do not mark a phase complete until the user explicitly confirms — premature completion commits artifacts the user may not endorse.

### 4. Commit

When the user gives explicit final approval:

1. Write the two setup artifacts. **(a)** Write the final document to `docs/` — a clean published document with **no** `## Summary for Downstream` section. **(b)** Write the Downstream Context file to `.groundwork/context/<current-phase>.md` (Protocol 5), derived from the finished doc as the final drafting action. Both are enforced by the `groundwork-writer` skill.
2. Write the hand-off file to `.groundwork/cache/handoff/<current-phase>.md` as defined in Protocol 6.
3. Delete the phase's cache file from `.groundwork/cache/`.
4. If a hand-off file from the previous phase exists at `.groundwork/cache/handoff/<previous-phase>.md`, delete it — this phase has now consumed it.
5. **Apply the Living Documents protocol**: scan the conversation for insights that refine any existing `docs/` artifact. Apply surgical updates; if a refined doc belongs to an upstream setup phase whose Downstream Context is still live, refresh that `.groundwork/context/<phase>.md` too. Report what changed. If any update is a **reversal** (Protocol 2 — it supersedes an ADR or overturns a prior Key Decision / Binding Constraint), follow the Reversal Protocol: reconcile the full body and every dependent doc, then re-invoke `groundwork-review` on each mutated doc before committing.
6. **Update discovery notes**: scan the conversation for out-of-phase signals not captured in real time. Append new signals to `.groundwork/cache/discovery-notes.md`. Remove entries that were incorporated into the committed artifact or the hand-off file.
7. Confirm completion with a brief, clear message.
8. **Recommend a fresh context** for the next phase — a clean context gives the next skill full working memory. This is a recommendation, not a requirement.
9. Hand off to the `groundwork-orchestrator` skill immediately. Do not ask the user to invoke it.

---

## Protocol 4: Conversational Pacing

The goal of pacing is to manage the user's cognitive load. Complex, structural decisions — the ones that shape the product, constrain the design space, or have downstream consequences — deserve focused attention. Rushing through them in a compound question produces shallow answers that collapse under implementation pressure.

Give important questions room to breathe. When a decision has real trade-offs or downstream consequences, present it on its own, explore it fully, and resolve it before moving on. When several questions are straightforward or closely related, grouping them keeps the conversation moving without overwhelming the user.

Converge toward proposals. Once you have enough signal to form a recommendation, propose it and let the user react — continued interrogation past the point of sufficient information wastes the user's time and energy. The conversation should feel like it's building toward something, not circling.

Confirm before advancing to the next phase. Summarise what was established and get explicit confirmation before moving on — premature advancement commits decisions the user may not endorse.

---

## Protocol 5: Downstream Context

Each Sequential Setup phase writes a **Downstream Context** file to `.groundwork/context/<phase>.md` at commit. This is the cross-phase contract the *flow* runs on: the next setup phases consume it first, and read an upstream doc's body only when a specific decision requires detail the context file does not carry. The context file is the **only** place this contract lives — the published `docs/` artifact carries none of it.

This separation is deliberate. A setup phase produces two different things for two different readers: the cross-phase machinery the *flow* needs to make its next decision, and the product documentation a reader who was never in the room needs. They have opposite shapes — the first is a terse decision ledger, the second is reference prose. Keeping the ledger out of `docs/` is what lets the published doc read as documentation rather than a report-out of the conversation that produced it.

The store is **scaffolding, not a durable ledger.** It persists through setup so each downstream phase reads its upstream contract, and it is torn down when setup completes (Protocol 10). Nothing in `.groundwork/context/` survives into delivery; everything durable graduates into `docs/` first.

### Location and naming

`.groundwork/context/<phase>.md` — one file per phase, named after the *writing* phase. Example: `groundwork-architecture` writes `.groundwork/context/architecture.md`. The file is persistent across setup phases (unlike the single-hop hand-off cache, Protocol 6) and is created on demand — write tools create the `context/` directory if absent.

### Structure

The context file contains exactly four subsections, in this order:

| Subsection | What goes here |
|---|---|
| `### Key Decisions` | The decisions this phase committed to that downstream phases must respect. Bulleted, one decision per bullet, ≤15 words each. State the decision; do not justify it. |
| `### Binding Constraints` | The constraints — hard rules, performance budgets, data residency, compliance, vendor limits — that any downstream phase must work within. Bulleted, one constraint per bullet. |
| `### Deferred Questions` | Decisions intentionally left open at this stage, with the phase that will resolve them. Format: `- <question> — resolved in <phase>`. |
| `### Out of Scope` | What this phase deliberately did not address. Different from deferred (which will be answered later); this is permanent absence. |

### Length Budget

The entire file is ≤200 words. Bullets, not prose. If a decision cannot be stated in 15 words, the decision itself is incomplete — finish the decision before writing the bullet.

### What the Context File Does Not Contain

- **No rationale.** Why a decision was made belongs in the published doc body or in an ADR. The context file states the decision only.
- **No rejected options.** Rejected options belong in the hand-off file (Protocol 6) so the next phase can see what was considered.
- **No marketing or framing.** The context file is for an agent making the next phase's decisions. State facts, not narrative.

### Derive It From the Finished Doc, Last

Write the published doc body first, then derive the context file from it as the **final** drafting action — never maintain the two in parallel. Do a single deliberate pass: walk every binding decision, constraint, deferred question, and permanent exclusion in the doc and confirm each is reflected in the context file, and that the context file asserts nothing the doc does not. A context file hand-maintained alongside the body desyncs on every edit.

### Enforcement

The `groundwork-writer` skill enforces this contract. Every commit step that writes a Sequential Setup `docs/` artifact loads `groundwork-writer`, writes the clean published doc to `docs/`, and writes the Downstream Context file to `.groundwork/context/<phase>.md`.

---

## Protocol 6: Hand-off Cache

The hand-off cache carries post-commit context from one phase to the next when that context did not fit in the canonical doc. It exists because the canonical doc must remain a clean, durable artifact — committee-readable, frontmatter-light, body-tight — but the next phase often needs the discarded surrounding context to make good decisions.

### File Location

`.groundwork/cache/handoff/<phase>.md` — one file per phase, named after the *writing* phase (not the consuming phase). Example: `groundwork-architecture` writes `.groundwork/cache/handoff/architecture.md` for `groundwork-mvp` (or whichever skill is next) to consume.

### Lifecycle

| Step | When | By whom |
|---|---|---|
| Created from template | At commit (Protocol 3.4.2) | The phase that just committed |
| Read | At init (Protocol 3.2.1) | The next phase in the chain |
| Deleted | At the consumer's commit (Protocol 3.4.4) | The phase that consumed it |

Single-hop only. A hand-off file from phase N is consumed by phase N+1 and then deleted. Phase N+2 reads its context from N+1's hand-off and from the Downstream Context files in `.groundwork/context/`, not from a chain of stale hand-offs. Long-range context flows through the Downstream Context files (Protocol 5), not through hand-off files.

### Template

The shared template lives at `.groundwork/skills/templates/handoff.md`. Skills copy it on commit and fill in only the sections that have content — empty sections may be omitted entirely.

### What the Hand-off File Captures

- **Rejected Options** — alternatives considered and ruled out, with the rationale. Lets the next phase avoid re-litigating decisions.
- **Deferred Decisions** — decisions explicitly left open, with the trigger that should reopen them. Distinct from Protocol 5's Deferred Questions: hand-off entries carry the conversational context behind the deferral.
- **User Instincts** — uncommitted signals the user voiced that the next phase should honour but the current phase did not formalise.
- **Context Drop** — anything else the next phase needs that does not fit the categories above.

### What the Hand-off File Does Not Capture

- Decisions the canonical doc already records — those belong in the doc.
- Out-of-phase signals — those belong in discovery notes (Protocol 1).
- General notes about the conversation — if the next phase does not need it, do not write it.

---

## Protocol 7: Cache Isolation

A phase reads from a strict, minimal set of cache locations. Reading from anywhere else risks pulling stale state from a prior phase's incomplete work.

### What a phase may read from `.groundwork/cache/`

| Path | Purpose | When |
|---|---|---|
| `<phase>-cache.md` | The current phase's own resume state | Init only, for resume detection |
| `<phase>-draft/` or `<phase>-draft.md` | The current phase's own draft state | During execute and revise stages |
| `discovery-notes.md` | Cross-phase signal capture (Protocol 1) | Init (check own section) and during execute (capture out-of-phase signals) |
| `handoff/<previous-phase>.md` | The previous phase's hand-off (Protocol 6) | Init only |
| `scan-state.json`, `scan/overview.md` | The brownfield scan baseline — shared classification and partition map | Init and execute, **brownfield extract and adopt phases only** |
| `repo-map.json` | The deterministic code map (build/refresh: `npx groundwork-method repo-map`). Durable past setup — `groundwork-infra-adopt` preserves it at cleanup as a first-class artifact. How to leverage it with Serena: `.groundwork/skills/code-intelligence.md` | Brownfield extract and adopt phases during setup; `groundwork-check`, `groundwork-doc-sync`, and the bet loop thereafter, for impact analysis |
| `scan/<own-slice>.md` | The brownfield findings slice this phase consumes (`product-findings.md`, `design-findings.md`, or `architecture-findings.md`) | Init and execute, **the one owning extract phase only** |

### What a phase must not read from `.groundwork/cache/`

- Any other phase's `<phase>-cache.md` — that state is internal to the writing phase and is deleted at commit.
- Any other phase's `<phase>-draft.md` or `<phase>-draft/` — drafts are working artifacts; the committed `docs/*.md` is the authoritative version.
- Any hand-off file other than the previous phase's. Cross-phase context from older phases flows through the Downstream Context files in `.groundwork/context/`, not through hand-off chains.

### Enforcement at init

Each phase's init step verifies its own caches are clean — no stale draft directory, no orphan cache file from a previous run that did not commit. If foreign state is found, the phase asks the user to confirm a clean restart before proceeding.

### The Downstream Context store is not cache

`.groundwork/context/` is a sibling of `.groundwork/cache/`, not part of it. Unlike a phase's transient cache (created at init, deleted at that phase's commit), a Downstream Context file persists across **all** downstream setup phases so each can read its upstream contract (Protocol 5). It is not bound by the per-phase read restrictions above — any setup phase may read the context file of any phase it declares as upstream. The whole store is torn down once, at setup completion (Protocol 10); nothing in it survives into delivery.

---

## Protocol 8: Review Gate

A review checkpoint is a gate, not a formality. A phase passes only on a positive, parseable verdict from the isolated reviewer — every other outcome blocks. Gating on the *presence of a pass* rather than on *detecting a failure* is what keeps the gate safe: an unrecognised error, a dropped connection, and a truncated response all read as "not a pass" and stop the phase, instead of slipping through as a silent success.

This protocol governs every place a skill invokes `groundwork-review` — the Sequential Setup drafting phases, the Reversal Protocol re-gate (Protocol 2), and the Continuous Bet validation reviews.

### The gate

Presenting a draft as reviewed, or committing it, is permitted only when the reviewer returns a parseable `VERDICT: PRESENT`. Every other outcome blocks:

- `VERDICT: REVISE` — apply the 🔴 findings and re-invoke, subject to the cap below.
- A `REVIEW_UNAVAILABLE` sentinel, any error string, an empty response, or output carrying no parseable `VERDICT:` line — the review did not run. This is a hard failure, never a pass.

### Fail closed when the review cannot run

The gate blocks on anything short of a parseable `VERDICT: PRESENT` — a reviewer that errors, hangs, or never runs has reviewed nothing, and the phase must not commit or imply otherwise. Protocol 9's *When the review cannot run* is the operational procedure for this case, including the narrow terms under which an authorised self-review may stand in; it never counts as a passed gate.

### The revise cap

A reviewer that keeps returning `REVISE` on a draft the agent cannot improve further would loop forever. After 3 REVISE verdicts on a single document, stop revising and treat that pass as the stopping point: surface every remaining 🔴 Critical finding to the user as 🟡 Advisory, and state plainly that the review did not reach PRESENT and how many critical findings remain unresolved. The user weighs them before approving the commit. This cap applies at every review checkpoint, so the escape hatch behaves identically everywhere.

A reviewer that keeps finding fresh contract↔body desyncs pass after pass is not asking for a sixth revision — the fault is usually an unreconciled Downstream Context file (Protocol 5: author it last, from the finished doc); reconcile that before revising the body again.

Hitting the cap is a disclosed, user-visible outcome, not a silent downgrade. It differs from the fail-closed case above by when it fires: the cap fires after the review *ran* and could not be satisfied; fail-closed fires when the review *could not run at all*. Both block a silent pass, and both surface to the user.

---

## Protocol 9: Review Invocation

Protocol 8 defines what the reviewer's verdict means; this protocol defines how the review runs. Every invocation of `groundwork-review` — drafting-phase gates, Reversal Protocol re-gates (Protocol 2), bet validation re-reviews — follows this one procedure. Calling skills state what they pass and when in their phase the review fires; the dispatch mechanics and the failure procedure live here and are never restated per skill.

### Dispatch

The reviewer runs as an independent subagent with a fresh context, dispatched through the host's subagent mechanism — the `Task` tool in Claude Code. The dispatch prompt loads the `groundwork-review` skill and passes `document_path` (the draft under review) and `document_type` (which checklist the reviewer applies). Only the verdict and findings return to the caller; the reviewer's deliberation stays in its own context, which keeps the calling conversation's window clean and the judgement independent of the author.

`groundwork-review` is a review role, so it dispatches at the **`frontier`** tier — the same gate-must-be-strong reasoning that puts the delivery review lenses there (Model Tiers, below). The host model is chosen at dispatch to match that class.

### The verdict gates the commit

The gate is fail-closed (Protocol 8): the phase presents the draft as reviewed, or commits it, only on a parseable `VERDICT: PRESENT`. On `VERDICT: REVISE`, apply the 🔴 findings to the draft and re-dispatch, subject to Protocol 8's revise cap.

### When the review cannot run

A dispatch that errors, returns `REVIEW_UNAVAILABLE`, or returns no parseable verdict has reviewed nothing. A subagent that has produced no output for an unreasonably long time is in the same state — treat the hang as a failure rather than waiting indefinitely, because a review that never returns gates nothing. A host with no subagent mechanism cannot dispatch at all; that is the same failure, known before the first attempt.

In every one of these cases the phase MUST NOT proceed as if reviewed and MUST NOT quietly run the review checks itself — the author judging its own draft re-introduces exactly the blind spots the isolated reviewer exists to catch (Protocol 8). Instead:

1. **Stop and report.** Tell the user plainly that the independent review could not run, and why — the error, the hang, or the missing dispatch mechanism.
2. **Offer exactly two paths, and take neither until the user chooses:**
   - **Retry the dispatch** (where a dispatch mechanism exists — transient failures usually clear on retry).
   - **An authorised self-review** — only with the user's explicit authorisation, run the review checks inline and label the output loudly as a self-review that does not satisfy the independent-review gate. This is Protocol 8's fallback rule as an operational procedure; it never counts as a passed gate.

There is no third path: committing, presenting the draft as reviewed, or self-reviewing without authorisation defeats the gate.

---

## Model Tiers

Every subagent GroundWork dispatches has a job whose reasoning demand is known in advance, so each role has a default **model tier**. The policy turns one long-standing belief into a default: *workers can run cheaply because the independent review is the gate* — which only holds if the gate itself runs strong. So planning and **all** review run at the top tier; gated execution runs a tier down.

### The two tiers, by role

| Tier | Dispatched for | Why |
|---|---|---|
| **`frontier`** | the delivery driver (recommended — see below), `groundwork-review`, and every delivery review lens (`blind-reviewer`, `edge-case-tracer`, `acceptance-auditor`, `coverage-auditor`, `experience-auditor`) | The hardest reasoning in the work, and the *gate*. Cheap execution is only safe when the review that catches it is strong, so the gate is never the weak link. |
| **`execution`** | `slice-worker`, `reconcile-worker` | Implementation under a frontier gate. Correctness is not taken on trust — the review re-derives it — so the worker runs a capable, cheaper tier. |

A third **`light`** tier (a fast, cheap model) is legal only for trivial, mechanical patch-lane fixes; `execution` is the default for all real implementation.

### Tiers are model *classes*, not model names

A tier names a **class of model by capability**, never a specific model id — ids churn, and the policy must hold across hosts and across releases. At dispatch the agent picks whatever concrete model its host actually offers that best fits the class:

- **`frontier` — "Opus-class".** The host's strongest reasoning and judgement model. *Exemplars:* Claude Opus · a Gemini Pro/Ultra-class model · a GPT-5 / o-series reasoning-class model.
- **`execution` — "Sonnet-class".** A strong, faster, cheaper workhorse used under a frontier gate. *Exemplars:* Claude Sonnet · a Gemini Flash-class model · a GPT-5-mini-class model.
- **`light` — "Haiku-class".** A fast, cheap model for trivial mechanical work only.

The exemplars are illustration, not a maintained mapping — there is no per-host table to keep current. Claude Code is the proven reference host; the policy is a host-agnostic abstraction other hosts realise with their own equivalents.

### Per-slice lift and runtime escalation

The role tier is a default, overridable **upward, one slice at a time**, never down. Both the authoring-time lift (a slice flagged *particularly challenging or vague* runs its worker at `frontier` instead of `execution`) and the mid-slice escalation (a worker that hits trouble above its weight consults a frontier advisor instead of grinding toward a forced green — distinct from handing the slice back as a `BLOCKING CONCERN`) are canonical in `groundwork-bet`, the one skill that authors and dispatches slices: the lift beside Decomposition Step 4's Model tier field, the escalation in `briefs/slice-worker.md`. This is what makes the cheaper `execution` tier safe in practice — a slice above its worker's weight is never left there un-lifted or unaided.

### Mechanism and degradation

Each brief's frontmatter carries its role default (`tier: frontier` or `tier: execution`); the dispatching workflow chooses a host model matching that class — lifted per the slice flag — and passes it through the host's subagent mechanism (the `Task` tool's `model` in Claude Code). The **driver's own tier is a recommendation**, not framework-enforced: the driver runs in the user's session, so the workflow recommends a frontier model and the user pins it. Subagent tiers are framework defaults the driver applies.

Where a host cannot set a per-subagent model (some harnesses pin one session model), the policy degrades to **running everything at `frontier`** — correct but pricier, never the reverse. The review is never silently downgraded; workers are framed as *may* run cheaper, so "cannot downgrade" is always safe.

---

## Protocol 10: Setup Graduation

The Downstream Context store (Protocol 5) is setup scaffolding. Left standing after setup, it becomes a second, stale source of truth alongside `docs/` — and a dangerous one, because it reads like a decision ledger but is no longer maintained. Setup Graduation is the single step that dismantles the scaffolding once the building stands: everything durable graduates into `docs/` as proper technical documentation, and everything left over from the green/brown setup process is removed.

### When it fires

Once, at the **setup→delivery transition** — after the last Sequential Setup phase commits (greenfield: `groundwork-scaffold`/`groundwork-mvp`; brownfield: `groundwork-infra-adopt`) and before the first bet. The **orchestrator** owns the trigger: on detecting that all setup phases are complete, it runs Graduation before routing into the Delivery Loop. It is not a methodology phase and writes no phase cache — it is a reconcile-and-teardown pass over artifacts the setup phases already produced.

### The three steps

1. **Graduate binding decisions into ADRs.** Walk every `.groundwork/context/*.md` file. Each Key Decision or Binding Constraint that still constrains future work and is not already captured in `docs/architecture/decisions/` becomes a proper ADR there (the architect's decision-record convention). A decision already recorded in an ADR or fully stated in a canonical doc body needs no new ADR — graduate, do not duplicate.
2. **Reconcile the rest into the docs.** Run a Living Documents pass (Protocol 2) so any remaining durable context — a constraint, a deferred question now answerable, a scope boundary — is reflected in the proper `docs/` technical documentation. After this step, `docs/` is the complete durable record; the context store holds nothing the docs do not.
3. **Tear down the setup residue.** Delete `.groundwork/context/` in full. Drain `.groundwork/cache/discovery-notes.md` of any remaining entries (apply or discard each, then remove the file). Remove any other setup-only residue — stray hand-off files, phase caches that did not clean up. The brownfield scan cache is already removed by `groundwork-infra-adopt` at its own commit.

### The invariant

By the end of the flow, everything durable lives in `docs/` as proper technical documentation; everything else is removed. A reader who opens the project after setup finds one source of truth — the docs — and no setup bookkeeping to mistake for it.

### Fail-safe

Graduation never deletes before it has graduated. If step 1 or 2 cannot complete — an ADR cannot be written, a doc reconciliation is ambiguous — stop and surface it to the user; do not run step 3. A torn-down store whose decisions never reached `docs/` is unrecoverable.
