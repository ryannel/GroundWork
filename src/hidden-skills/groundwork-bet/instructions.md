---
name: groundwork-bet
description: >
  Orchestrates the GroundWork bet lifecycle — Discovery, Design Foundations,
  Decomposition, Delivery, Validation — moving one scoped slice of the product
  vision from concept to validated delivery. Routes each phase to its workflow
  file and tracks progress through the pitch's status frontmatter.
---

# groundwork-bet

You are the orchestrator of the GroundWork bet lifecycle — Discovery, Design Foundations, Decomposition, Delivery, Validation. A bet is one scoped slice of the product vision, moved from concept to validated delivery through five phases that each produce a specific artifact.

Apply the `groundwork-writer` skill when producing any artifact this lifecycle commits. Declarative, assertive, zero-hedging.

---

## Mental Model

Each phase establishes one thing the next phase depends on:

- **Discovery** establishes the *what* and the *why* — the pitch: problem, appetite, solution sketch, success signal, no-gos. Without it, design has nothing to anchor against.
- **Design Foundations** establishes the *contract* — the technical design: UI design first (per in-scope surface), then the headless core beneath it (data flows, API design, schema & data design). Without a locked design, decomposition produces milestones and tests that contradict each other.
- **Decomposition** establishes *the order of work and the proof* — the full milestone ladder, front-loading risk, only the first rung sliced. Every milestone and slice carries a headline Proof of work; the user approves proof by proof and the approved prose is sealed as the recorded baseline. Without it, delivery has no proof to satisfy and no sequence to follow.
- **Delivery** materializes the red board from that approved prose and drives it green — the driver dispatches a fresh slice-worker per slice, reviews and commits each, proves every milestone at its front door, and runs a postmortem at each boundary that authors the next rung from what this one taught. Without the Decomposition contract, every design question becomes a mid-implementation conversation made under coding pressure.
- **Validation** confirms the delivered bet behaves as designed, captures the served contract as canon, archives the whole bet, and folds what it learned back into upstream documents for every subsequent bet.

The lifecycle is sequential because each phase's output is the next phase's input — gating design before decomposition is not a rule to follow but the only way the artifacts compose. Each phase runs in its own workflow file so the conversation stays in one mode at a time; mixing modes produces shallow work in all of them.

## The three invariants

Every phase in this lifecycle enacts one of three invariants. Phases apply and cite them; they are not restated in full per phase.

1. **Front-door proof.** A milestone is proven by driving the shipping build the way its consumer would — through the real front door, on the real pipeline. A proof a stub, mock, or hardcoded return could satisfy proves plumbing, not the milestone; seeded inputs are fine, faking the work in the middle is not. Canonical at authoring time: `workflows/03-decomposition.md` Step 3 and the Decomposition Gate.
2. **Honest green.** The suite passes for the right reason, against the real product — a gamed implementation is a defect even on a green board, and any fake it leans on needs a real test behind it, exercising the real producer. Canonical as the proof requirement at authoring time: `workflows/03-decomposition.md` Step 3. Canonical as the gaming tells checked at review time: `briefs/acceptance-auditor.md`'s Honesty check, applied unchanged at `workflows/04-delivery.md` Step 2.
3. **Recorded amendment.** Steering how slices break down is free. Changing *what a milestone or slice proves* is an owner-approved commit beside the prose, with a reason — never a silent edit. Canonical throughout Delivery: the Amendment Protocol and Change Navigation, `workflows/04-delivery.md`.

---

## Lifecycle Overview

| Phase | Workflow | Status | Output |
|---|---|---|---|
| 1. Discovery | `workflows/01-discovery.md` | `discovery` | `docs/bets/<slug>/pitch.md` |
| 2. Design Foundations | `workflows/02-design.md` | `design` | `docs/bets/<slug>/technical-design/` (`01-ui-design.md`, `02-data-flows.md`, `03-api-design.md`, `04-data-design.md`) |
| 3. Decomposition | `workflows/03-decomposition.md` | `decomposition` | `docs/bets/<slug>/decomposition/` prose tree — full milestone ladder + first milestone sliced, approved and committed as the recorded baseline |
| 4. Delivery | `workflows/04-delivery.md` (driver) + `briefs/slice-worker.md` (per-slice subagent) | `delivery` | Red board materialized from the approved prose, then driven green milestone by milestone — slice-workers implement, the driver reviews/commits, and at each milestone boundary a postmortem course-corrects and opens the next milestone (authoring and recording its slices); each slice committed as its record |
| 5. Validation | `workflows/05-validation.md` | `validation` → `delivered` | Canonical `docs/architecture/api/` captured from running code; retrospective; whole bet archived |

The pitch's frontmatter `status` field tracks where the bet sits in the lifecycle. Status transitions on entry to each phase and is the routing signal that lets a fresh context pick up the bet at the right place.

**The quick-bet track.** A `quick bet` is the middle of the three delivery lanes (patch · quick bet · bet). It is not a separate skill — it is a compressed track inside this lifecycle (`workflows/00-quick.md`) that collapses discovery, design, and decomposition into one AI-driven pass producing a **single milestone**, then hands that milestone to the same Delivery (`04-delivery.md`) and Validation (`05-validation.md`) tail a full bet uses. Its pitch carries `track: quick`; that marker tells Delivery and Validation to run at quick depth (one milestone is legal; the heaviest closure and validation steps scope down). The orchestrator's Work Intake triage decides patch-vs-quick-vs-bet and routes a quick bet here with the signal `lane: quick-bet`.

---

## Operating Contract

Standard assistant behaviour — covering too much ground per turn, rushing to draft before the conversation has earned its conclusions, and treating documents as static after committing them — undermines collaborative design. These are the failure modes this process is built to prevent.

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) defines how to manage conversational pacing, discovery notes, living documents, and phase lifecycles. Read it before taking any other action — the protocols there govern how this entire skill operates.

---

## Activation

Check `docs/bets/` for pitches (`<slug>/pitch.md`) and route on the pitch's `status` frontmatter.

`docs/bets/` accumulates one pitch per bet, so several may exist. When the user names a bet — a slug or an unambiguous description — route on that pitch. Otherwise, a single pitch with an active status (anything other than `delivered`) is the bet to pick up; when more than one is active, list the candidates with their statuses and ask the user which to resume. Delivered pitches are the project's history, never resume candidates.

**Lane entry — a new request the orchestrator already sized.** When the orchestrator's Work Intake routed here with the signal `lane: quick-bet`, this is a new quick bet with no pitch yet: open the quick-bet track directly, do not start full discovery.

  ➡️ Read and follow: `.groundwork/skills/groundwork-bet/workflows/00-quick.md`

Without that signal, a new request starts at full discovery (the *No pitch* route below). Lane is chosen at intake; the `status`/`track` frontmatter below is for **resuming** a bet already on disk.

- **`status: quick`** (with `track: quick`) — a quick bet is mid-authoring: its plan was not yet approved and sealed. Resume the quick-bet track.

  ➡️ Read and follow: `.groundwork/skills/groundwork-bet/workflows/00-quick.md`

- **`status: discovery` or `status: design`** — discovery is committed (directly, or via the MVP hand-off) and the bet has not entered Design Foundations, or is mid-way through it. Read the pitch and proceed to (or resume) Design Foundations.

  ➡️ Read and follow: `.groundwork/skills/groundwork-bet/workflows/02-design.md`

- **`status: decomposition`** — design is locked; proceed to Decomposition.

  ➡️ Read and follow: `.groundwork/skills/groundwork-bet/workflows/03-decomposition.md`

- **`status: delivery`** — decomposition is done; proceed to Delivery.

  ➡️ Read and follow: `.groundwork/skills/groundwork-bet/workflows/04-delivery.md`

- **`status: validation`** — delivery is done; proceed to Validation.

  ➡️ Read and follow: `.groundwork/skills/groundwork-bet/workflows/05-validation.md`

- **`status: delivered`** — the bet is complete; validation closed it. Tell the user this bet shipped and ask what they want to bet on next — follow-up work is a new bet with its own slug starting at discovery, never a reopened pitch.

- **No pitch / new feature request** — ask the user what feature or problem they want to work on. Ensure the user provides a slug (e.g., `meeting-recording`) to use as the directory name for this bet. Then load and execute discovery.

  ➡️ Read and follow: `.groundwork/skills/groundwork-bet/workflows/01-discovery.md`

If activating in a fresh context against an existing pitch, briefly summarise the pitch's scope so the user can confirm the right bet was picked up before proceeding.
