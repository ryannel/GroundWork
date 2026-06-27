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

- **Discovery** establishes the *what* and the *why*. It produces the pitch — the problem, the appetite, the solution sketch, the success signal, and the explicit no-gos. Without it, design has nothing to anchor against.
- **Design Foundations** establishes the *contract*. It produces the technical design — UI design first (one subsection per in-scope surface), then the headless core beneath it: data flows and business logic, API design, and schema & data design, surface-neutral. Without a locked design, decomposition produces milestones and tests that contradict each other.
- **Decomposition** establishes *the order of work and the proof*. With the design locked, it authors the full **milestone ladder** — thin, user-visible steps ordered to front-load risk, each carrying a headline Proof-of-work proof that **drives the real product through its real front door** (no stub, double, or scripted stand-in can satisfy it; any fake it leans on needs a real test behind it; this is the success signal made executable) — but slices only the **first milestone**; later rungs are sliced on arrival in Delivery, from what the milestones before them taught. Every milestone names a consumer who observes its outcome at their real surface; the first user-visible milestone lands the design system in the running app; the ladder must sum to a complete, well-rounded experience. Every shape traces to the prose API/data design. No test code is written here. The user reviews proof by proof and approves; the approved prose is committed as the recorded baseline, and changing *what a milestone proves* afterwards is an owner-approved amendment recorded in git history with a reason — steering how slices break down is free. The tests are generated red at Delivery start from this approved prose. Without this Proof of Work, delivery has no proof to satisfy and no sequence to follow.
- **Delivery** materializes the red board from the approved prose, then drives it green as an orchestration. The agent is the *driver* — it holds the thin spine (the board, the milestone order, the granularity the user chose, the triage judgement) and dispatches a fresh slice-worker subagent per slice (`briefs/slice-worker.md`) so the heavy implementation context stays disposable. It reviews each worker's diff through independent lenses, commits the slice, proves each milestone at the front door (folding in the visual checks and a polish pass, with the experience-auditor lens judging the assembled milestone), and at every milestone boundary runs a postmortem that confirms the milestone honestly proved its intent, re-checks the remaining ladder, and authors the next milestone's slices from what this one taught (introducing a new rung when the ladder is missing one, within appetite) — recording each authored rung as it goes, course-correcting through the Amendment Protocol or Change Navigation when an approved proof or the design is wrong, never editing approved prose around without a recorded amendment. Delivery is offered at three cadences — slice by slice, milestone by milestone (default), or whole bet — which set where the driver pauses; hard stops pause regardless. The suite is the board (`./dev bet status`, derived not stored) and each slice's commit is its record, so progress is visible and resumable. As each slice completes, permanent best-practice tests are rolled out, and a per-slice reconciliation checks that the approved prose has not silently moved. Without the Decomposition contract, every design question becomes a mid-implementation conversation made under coding pressure.
- **Validation** confirms the delivered bet behaves as designed, captures each touched service's served contract into the canonical `docs/architecture/api/` record, writes the bet's capability-ledger rows (when the project keeps a surface registry), archives the **whole bet** (docs and tests), runs the bet retrospective, and folds what the bet learned back into upstream documents for every subsequent bet.

The lifecycle is sequential because each phase's output is the next phase's input. The order is structural, not procedural — gating design before decomposition is not a rule to follow but the only way the artifacts compose.

Each phase runs in its own workflow file because each demands a different mode. Loading only the current phase's workflow keeps the conversation in one mode at a time; mixing modes produces shallow work in all of them.

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

---

## Operating Contract

Standard assistant behaviour — covering too much ground per turn, rushing to draft before the conversation has earned its conclusions, and treating documents as static after committing them — undermines collaborative design. These are the failure modes this process is built to prevent.

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) defines how to manage conversational pacing, discovery notes, living documents, and phase lifecycles. Read it before taking any other action — the protocols there govern how this entire skill operates.

---

## Activation

Check `docs/bets/` for pitches (`<slug>/pitch.md`) and route on the pitch's `status` frontmatter.

`docs/bets/` accumulates one pitch per bet, so several may exist. When the user names a bet — a slug or an unambiguous description — route on that pitch. Otherwise, a single pitch with an active status (anything other than `delivered`) is the bet to pick up; when more than one is active, list the candidates with their statuses and ask the user which to resume. Delivered pitches are the project's history, never resume candidates.

- **`status: discovery`** — the pitch is committed but the bet has not entered Design Foundations. Read the pitch and proceed to Design Foundations.

  ➡️ Read and follow: `.groundwork/skills/groundwork-bet/workflows/02-design.md`

- **`status: design`** — the MVP handoff just completed; discovery is done. Read the pitch and proceed directly to Design Foundations.

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
