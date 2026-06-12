---
name: operating-contract
version: "1"
description: >
  Shared behavioral protocols every GroundWork methodology skill loads and enacts:
  discovery notes, living documents, lifecycle modes, phase lifecycle, pacing,
  summaries, hand-off cache, cache isolation, the review gate, and review
  invocation.
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
2. Append the signal as a new bullet under the appropriate section header in `.groundwork/cache/discovery-notes.md`. Use file editing tools — shell commands (echo, sed) corrupt markdown formatting. If the file does not exist, create it with all section headers listed below.
3. Continue with the next discovery question in the same turn so the user's flow is not interrupted.

### Section Headers

The discovery notes file uses these five sections. Every skill that writes or reads discovery notes uses exactly these headers — drift between writers and readers turns notes into orphans neither side can find.

| Section | What goes here |
|---|---|
| `## Product Brief` | Vision-level signals surfaced during later phases — new user types, missing capabilities, refined success criteria. Captured for in-flight batched application to `docs/product-brief.md`. |
| `## Design System` | Design preferences, aesthetic instincts, interaction patterns surfaced outside the Design System phase. |
| `## Architecture` | Infrastructure preferences, scaling instincts, technology opinions surfaced outside the architecture phase. |
| `## Design Details` | Implementation details from capability and boundary conversations — async flows, callback patterns, job lifecycles, data ownership decisions, contract format choices, resiliency patterns. Feeds the Bet's Design Foundations phase when producing API contracts and data schema. |
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
- **Refresh the summary.** If the change touches a Key Decision, Binding Constraint, or Deferred Question, update the doc's `## Summary for Downstream` section (Protocol 5) in the same edit. A summary that drifts from the body it summarises is worse than no summary.
- **State the current design declaratively.** Write the body and summary as if the current design were always the design. Never leave `~~strikethrough~~` of the old choice, "(was X, now Y)" parentheticals, or "superseded by…" notes in the body or summary — that hedging belongs in the superseding ADR alone. A doc that names both the old and the new design reads as contradictory to a downstream consumer and to the review.
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

1. **Reconcile the whole body, not just the summary.** Rewrite every sentence the reversal makes false, in every section of the doc — not only the `## Summary for Downstream`. The summary and the body must describe the same single design.
2. **Reconcile every dependent doc that cites the reversed decision.** A reversal rarely lives in one file. Trace it into the docs that consumed it and fix them too: domain entities (`Owner:`, fields, lifecycle, events), service docs, infrastructure, and any doc whose summary references the reversed decision. Domain entity docs are especially easy to miss — they carry no summary, so nothing flags them automatically.
3. **Record the supersession in an ADR.** The old design lives *only* in the superseding ADR (Context / Decision / what it cost), never as a residue in the body or summary.
4. **Re-gate: re-invoke `groundwork-review` on every mutated canonical doc.** This is the safety net the reversal exists to trip. For each doc you changed, run the review with the matching `document_type` (a mutated `docs/domain/<entity>.md` uses `document_type: domain-entity`). Apply 🔴 findings and re-review until `PRESENT`.
   - **Domain docs are re-reviewed unconditionally on a structural reversal.** When the reversal supersedes an accepted ADR or changes an architecture `### Key Decision` / `### Binding Constraint`, re-review **every** `docs/domain/*.md` (`document_type: domain-entity`), not only the ones you remembered to edit. Domain stubs carry no summary, so nothing flags them when they drift — and "the facilitator forgot the domain docs were dependents" is the exact failure this protocol exists to prevent. The set is small and the re-review is cheap; do not gate it on your own judgement of which entities the reversal touched.
   - **Cap and fail-closed handling:** the revise cap and the rule for a reviewer that cannot run are defined once in Protocol 8 (Review Gate), and the dispatch and failure procedure once in Protocol 9 (Review Invocation); both apply here unchanged — a re-gate that errors blocks the commit exactly as a drafting-phase review does.

**Accepted residual:** a *refinement* that introduces a body-only inconsistency while leaving the summary accurate is not re-gated — downstream phases read the summary first (Protocol 3.2.2, Protocol 5), so the drift is low-impact and is caught later by `groundwork-check`. Reversals are gated because they corrupt the summary's own contract and the dependent docs; refinements are not, to keep the common case cheap.

---

## Lifecycle Modes

GroundWork operates in two distinct lifecycle modes. Skills must know which mode they operate in — it determines which protocols apply.

### Sequential Setup

**Skills:** `groundwork-product-brief`, `groundwork-design-system`, `groundwork-architecture`, `groundwork-scaffold`, `groundwork-mvp`, `groundwork-product-brief-extract`, `groundwork-design-system-extract`, `groundwork-architecture-extract`, `groundwork-infra-adopt`

All protocols apply: 1, 2, 3, 4, 5, 6, 7, 8, 9. The brownfield extract and adopt skills are Sequential Setup phases that reverse-engineer their artifacts from an existing codebase rather than building them through greenfield discovery — the lifecycle, cache, hand-off, summary, and review obligations are identical to their greenfield counterparts.

- Each phase writes a cache file in `.groundwork/cache/` at init and deletes it on commit.
- Each phase writes a hand-off file to `.groundwork/cache/handoff/<phase>.md` on commit (Protocol 6).
- Every output document written to `docs/` opens with a `## Summary for Downstream` section (Protocol 5).
- A fresh context is recommended between phases (Protocol 3.4.8).

### Brownfield Scan (carve-out)

**Skill:** `groundwork-scan`

`groundwork-scan` is the Phase 0 preparation step of the brownfield track. It reads an existing codebase and writes a **scan baseline** — a resumable progress file and concern-split findings — into `.groundwork/cache/`, which the brownfield extract phases distil into canonical docs. It produces no `docs/` artifact, so three Sequential Setup obligations do not apply to it:

- **No Summary for Downstream and no hand-off file** (Protocols 5 and 6) — it writes no `docs/` artifact and no `handoff/<phase>.md`. Its structured findings files *are* the hand-off, and they fan out to three readers rather than a single next phase.
- **No review gate** (Protocol 8) — there is no canonical doc to gate. The review gate fires on each downstream extract when it commits its `docs/` artifact.
- **Findings persist past commit, not deleted at commit** (inverting Protocol 3.4.3) — the findings are the durable input the extract phases consume. `groundwork-infra-adopt`, the last setup phase that reads the baseline, deletes the shared scan cache at its commit.

Scan completion is tracked as a durable `scan` marker in `state.json`, not inferred from a `docs/` artifact, because the scan cache is purged before setup ends. Protocols 1 and 4 still apply: the scan captures out-of-phase signals into `discovery-notes.md` and paces its one scope-confirmation interview.

### Continuous Bet

**Skills:** `groundwork-bet` (all five phases: discovery, design, decomposition, delivery, validation)

Protocols 1, 2, 4, 8, and 9 apply. Protocols 3, 5, 6, and 7 do **not** apply.

- The pitch frontmatter `status` field is the state machine. No *per-phase* cache file is created at init and deleted at commit the way Sequential Setup phases do — the only cache files in play are the shared `discovery-notes.md` and transient drafts such as `bet-pitch-draft.md`.
- No hand-off files are written. Context is shared across all five phases — a fresh context is not recommended between bet phases.
- Bet documents (`docs/bets/<slug>/*`) do not include a `## Summary for Downstream` section. The pitch's `status` field and the shared context serve the same function.
- Protocol 7 cache isolation rules apply to the `.groundwork/cache/discovery-notes.md` file only.

This divergence is intentional. The bet's tightly coupled five-phase flow benefits from shared context; the one-shot setup phases benefit from clean isolation. A skill that looks non-conformant against the setup protocols may be correctly implementing the continuous-bet mode.

### Maintenance (anytime)

**Skills:** `groundwork-update`, `groundwork-upgrade`, `groundwork-check`, `groundwork-patch`, `groundwork-surface-activation`

Maintenance skills run on demand at any point after setup — they keep the committed doc set true, rather than producing new phase artifacts. For `groundwork-update`, Protocols 1, 2, 4, 8, and 9 apply; Protocols 3, 5, and 6 do not — a maintenance run has no phase cache, no hand-off file, and no fresh-context recommendation. Under Protocol 7 it reads only `discovery-notes.md` and `repo-map.json` from the cache. When a maintenance run *creates* a doc (a new domain entity, a superseding ADR), the new file follows the same template and contract as its setup-phase counterpart.

`groundwork-upgrade` runs under the same protocol set as `groundwork-update` (1, 2, 4; 8 and 9 when a brief item mutates a canonical doc). Its additional obligation is the upgrade brief: it executes only the items `npx groundwork-method update` compiled into `.groundwork/cache/upgrade-brief.json`, in the brief's order — there is no phase cache beyond the brief itself.

`groundwork-patch` runs under the same protocol set as `groundwork-update` (1, 2, 4; 8 and 9 when a reversal re-gate fires). Its additional obligation is the patch ledger: every patch appends a row to `docs/bets/patch-ledger.md`, and its scope test routes contract-touching or clustering work to the bet lifecycle instead of absorbing it.

`groundwork-surface-activation` runs under the same protocol set as `groundwork-update` (1, 2, 4; 8 and 9 when a reversal re-gate fires — typically a contract-compatibility stance overturning an architecture Key Decision). Its additional obligation is the registry twins: every change to `docs/surfaces.md` updates `.groundwork/surfaces.json` in the same edit, and its ledger triage leaves no cell of the new surface's column empty.

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
2. **Summary headers** — for each upstream `docs/*.md` the phase depends on, read only the `## Summary for Downstream` section (Protocol 5). Use the summary as the working context.
3. **Full upstream sections — lazy** — read the body of an upstream doc only when a specific decision in the current phase requires detail the summary does not carry. Do not pre-load entire upstream docs into context.
4. **Discovery notes** — check `.groundwork/cache/discovery-notes.md` for entries under your phase's section header (Protocol 1).

Skills must name their upstream chain explicitly — which prior phases the hand-off and summaries are read from. Do not infer the chain from project state.

### 3. Execute Stages

Work through the phase's stages as defined in its instructions. Update the cache file as each stage completes.

Do not mark a phase complete until the user explicitly confirms — premature completion commits artifacts the user may not endorse.

### 4. Commit

When the user gives explicit final approval:

1. Write the final artifact to `docs/`. The artifact must lead with a `## Summary for Downstream` section as defined in Protocol 5 — this is enforced by the `groundwork-writer` skill.
2. Write the hand-off file to `.groundwork/cache/handoff/<current-phase>.md` as defined in Protocol 6.
3. Delete the phase's cache file from `.groundwork/cache/`.
4. If a hand-off file from the previous phase exists at `.groundwork/cache/handoff/<previous-phase>.md`, delete it — this phase has now consumed it.
5. **Apply the Living Documents protocol**: scan the conversation for insights that refine any existing `docs/` artifact. Apply surgical updates and refresh affected summary headers. Report what changed. If any update is a **reversal** (Protocol 2 — it supersedes an ADR or overturns a prior Key Decision / Binding Constraint), follow the Reversal Protocol: reconcile the full body and every dependent doc, then re-invoke `groundwork-review` on each mutated doc before committing.
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

## Protocol 5: Summary for Downstream

Every canonical document under `docs/` opens with a `## Summary for Downstream` section. Downstream phases consume the summary first; they read the body only when a specific decision requires detail the summary does not carry. A summary that fails to capture every binding decision forces every downstream phase to re-read the full doc, which defeats the purpose of writing one.

### Structure

The summary contains exactly four subsections, in this order:

| Subsection | What goes here |
|---|---|
| `### Key Decisions` | The decisions this phase committed to that downstream phases must respect. Bulleted, one decision per bullet, ≤15 words each. State the decision; do not justify it. |
| `### Binding Constraints` | The constraints — hard rules, performance budgets, data residency, compliance, vendor limits — that any downstream phase must work within. Bulleted, one constraint per bullet. |
| `### Deferred Questions` | Decisions intentionally left open at this stage, with the phase that will resolve them. Format: `- <question> — resolved in <phase>`. |
| `### Out of Scope` | What this phase deliberately did not address. Different from deferred (which will be answered later); this is permanent absence. |

### Length Budget

The entire summary section is ≤200 words. Bullets, not prose. If a decision cannot be stated in 15 words, the decision itself is incomplete — finish the decision before writing the bullet.

### What the Summary Does Not Contain

- **No rationale.** Why a decision was made belongs in the body or in an ADR. The summary states the decision only.
- **No rejected options.** Rejected options belong in the hand-off file (Protocol 6) so the next phase can see what was considered.
- **No marketing or framing.** The summary is for an agent reading the doc cold. State facts, not narrative.

### Author and Reconcile It Last

Write the body first, then derive the summary from it as the **final** drafting action — never maintain the two in parallel. Before handing the draft to the review gate, do a single deliberate pass: walk every binding decision, constraint, deferred question, and permanent exclusion in the body and confirm each one is reflected in the summary, and that the summary asserts nothing the body does not. A summary hand-maintained alongside the body desyncs on every edit, and the review gate then surfaces those omissions one at a time — each costing a full revise cycle. Reconciling the summary from the finished body in one pass is what keeps the review loop short.

### Enforcement

The `groundwork-writer` skill enforces this contract. Every commit step that writes a `docs/` artifact loads `groundwork-writer` and produces the summary header alongside the body.

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

Single-hop only. A hand-off file from phase N is consumed by phase N+1 and then deleted. Phase N+2 reads its context from N+1's hand-off and from the summary headers in the canonical docs, not from a chain of stale hand-offs. Long-range context flows through summary headers in `docs/*.md`, not through hand-off files.

### Template

The shared template lives at `.agents/groundwork/skills/templates/handoff.md`. Skills copy it on commit and fill in only the sections that have content — empty sections may be omitted entirely.

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
| `repo-map.json` | The deterministic code map. Durable past setup — `groundwork-infra-adopt` preserves it at cleanup as a first-class artifact | Brownfield extract and adopt phases during setup; `groundwork-check`, `groundwork-update`, and the bet loop thereafter, for impact analysis |
| `scan/<own-slice>.md` | The brownfield findings slice this phase consumes (`product-findings.md`, `design-findings.md`, or `architecture-findings.md`) | Init and execute, **the one owning extract phase only** |

### What a phase must not read from `.groundwork/cache/`

- Any other phase's `<phase>-cache.md` — that state is internal to the writing phase and is deleted at commit.
- Any other phase's `<phase>-draft.md` or `<phase>-draft/` — drafts are working artifacts; the committed `docs/*.md` is the authoritative version.
- Any hand-off file other than the previous phase's. Cross-phase context from older phases flows through summary headers, not through hand-off chains.

### Enforcement at init

Each phase's init step verifies its own caches are clean — no stale draft directory, no orphan cache file from a previous run that did not commit. If foreign state is found, the phase asks the user to confirm a clean restart before proceeding.

---

## Protocol 8: Review Gate

A review checkpoint is a gate, not a formality. A phase passes only on a positive, parseable verdict from the isolated reviewer — every other outcome blocks. Gating on the *presence of a pass* rather than on *detecting a failure* is what keeps the gate safe: an unrecognised error, a dropped connection, and a truncated response all read as "not a pass" and stop the phase, instead of slipping through as a silent success.

This protocol governs every place a skill invokes `groundwork-review` — the Sequential Setup drafting phases, the Reversal Protocol re-gate (Protocol 2), and the Continuous Bet validation reviews.

### The gate

Presenting a draft as reviewed, or committing it, is permitted only when the reviewer returns a parseable `VERDICT: PRESENT`. Every other outcome blocks:

- `VERDICT: REVISE` — apply the 🔴 findings and re-invoke, subject to the cap below.
- A `REVIEW_UNAVAILABLE` sentinel, any error string, an empty response, or output carrying no parseable `VERDICT:` line — the review did not run. This is a hard failure, never a pass.

### Fail closed when the review cannot run

When a positive verdict cannot be obtained because the reviewer errored or returned nothing, the phase must not commit and must not state or imply that the review passed. Report to the user that the independent review failed to run, include the error, and pause. Each Sequential Setup phase already pauses for explicit user approval before committing (Protocol 3.4) — fold the failure into that pause rather than proceeding around it.

The author reviewing its own draft is not a substitute. The reviewer runs in an isolated context precisely so the agent that wrote the draft does not judge it — running the checks inline destroys that guarantee and re-introduces the blind spots the gate exists to catch. An adversarial self-review is permitted only when the user explicitly authorises it as a fallback, and only when the output labels it loudly as a self-review that does not satisfy the independent-review gate. It never counts as a passed gate, silently or otherwise. Protocol 9 (Review Invocation) turns this rule into the operational procedure a phase follows when the reviewer cannot run.

### The revise cap

A reviewer that keeps returning `REVISE` on a draft the agent cannot improve further would loop forever. After 3 REVISE verdicts on a single document, stop revising and treat that pass as the stopping point: surface every remaining 🔴 Critical finding to the user as 🟡 Advisory, and state plainly that the review did not reach PRESENT and how many critical findings remain unresolved. The user weighs them before approving the commit. This cap applies at every review checkpoint, so the escape hatch behaves identically everywhere.

Hitting the cap is a disclosed, user-visible outcome, not a silent downgrade. It differs from the fail-closed case above by when it fires: the cap fires after the review *ran* and could not be satisfied; fail-closed fires when the review *could not run at all*. Both block a silent pass, and both surface to the user.

---

## Protocol 9: Review Invocation

Protocol 8 defines what the reviewer's verdict means; this protocol defines how the review runs. Every invocation of `groundwork-review` — drafting-phase gates, Reversal Protocol re-gates (Protocol 2), bet validation re-reviews — follows this one procedure. Calling skills state what they pass and when in their phase the review fires; the dispatch mechanics and the failure procedure live here and are never restated per skill.

### Dispatch

The reviewer runs as an independent subagent with a fresh context, dispatched through the host's subagent mechanism — the `Task` tool in Claude Code. The dispatch prompt loads the `groundwork-review` skill and passes `document_path` (the draft under review) and `document_type` (which checklist the reviewer applies). Only the verdict and findings return to the caller; the reviewer's deliberation stays in its own context, which keeps the calling conversation's window clean and the judgement independent of the author.

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
