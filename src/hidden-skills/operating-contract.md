# GroundWork Operating Contract

**This document is mandatory. Every GroundWork methodology skill MUST load and follow these protocols. They are non-negotiable and apply in every phase, every bet, and every conversation.**

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

- **Surgical and targeted.** Change only what new information warrants. Do not rewrite sections that are still accurate.
- **Refresh the summary.** If the change touches a Key Decision, Binding Constraint, or Deferred Question, update the doc's `## Summary for Downstream` section (Protocol 5) in the same edit. A summary that drifts from the body it summarises is worse than no summary.
- **Do not ask for permission.** These are refinements consistent with the user's own words and decisions, not new product choices.
- **Report what changed.** After committing, briefly list any upstream documents that were updated and what specifically shifted.
- If no updates are warranted, skip silently.

---

## Lifecycle Modes

GroundWork operates in two distinct lifecycle modes. Skills must know which mode they operate in — it determines which protocols apply.

### Sequential Setup

**Skills:** `groundwork-product-brief`, `groundwork-design-system`, `groundwork-architecture`, `groundwork-scaffold`, `groundwork-mvp`

All protocols apply: 1, 2, 3, 4, 5, 6, 7.

- Each phase writes a cache file in `.groundwork/cache/` at init and deletes it on commit.
- Each phase writes a hand-off file to `.groundwork/cache/handoff/<phase>.md` on commit (Protocol 6).
- Every output document written to `docs/` opens with a `## Summary for Downstream` section (Protocol 5).
- A fresh context is recommended between phases (Protocol 3.4.8).

### Continuous Bet

**Skills:** `groundwork-bet` (all five phases: discovery, design, decomposition, delivery, validation)

Protocols 1, 2, and 4 apply. Protocols 3, 5, 6, and 7 do **not** apply.

- The pitch frontmatter `status` field is the state machine. No *per-phase* cache file is created at init and deleted at commit the way Sequential Setup phases do — the only cache files in play are the shared `discovery-notes.md` and transient drafts such as `bet-pitch-draft.md`.
- No hand-off files are written. Context is shared across all five phases — a fresh context is not recommended between bet phases.
- Bet documents (`docs/bets/<slug>/*`) do not include a `## Summary for Downstream` section. The pitch's `status` field and the shared context serve the same function.
- Protocol 7 cache isolation rules apply to the `.groundwork/cache/discovery-notes.md` file only.

This divergence is intentional. The bet's tightly coupled five-phase flow benefits from shared context; the one-shot setup phases benefit from clean isolation. A skill that looks non-conformant against the setup protocols may be correctly implementing the continuous-bet mode.

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
5. **Apply the Living Documents protocol**: scan the conversation for insights that refine any existing `docs/` artifact. Apply surgical updates and refresh affected summary headers. Report what changed.
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

### What a phase must not read from `.groundwork/cache/`

- Any other phase's `<phase>-cache.md` — that state is internal to the writing phase and is deleted at commit.
- Any other phase's `<phase>-draft.md` or `<phase>-draft/` — drafts are working artifacts; the committed `docs/*.md` is the authoritative version.
- Any hand-off file other than the previous phase's. Cross-phase context from older phases flows through summary headers, not through hand-off chains.

### Enforcement at init

Each phase's init step verifies its own caches are clean — no stale draft directory, no orphan cache file from a previous run that did not commit. If foreign state is found, the phase asks the user to confirm a clean restart before proceeding.
