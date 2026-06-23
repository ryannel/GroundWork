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
- **Design Foundations** establishes the *contract*. It produces the technical design — surface design first (one subsection per in-scope surface), then the capability design: data flows, API contracts, and data schema, surface-neutral beneath them. Without a locked design, decomposition produces milestones and tests that contradict each other.
- **Decomposition** establishes *the order of work and the proof*. With the design locked, it breaks the bet into milestones (demonstrable states ordered by integration value — capability milestones proven at the contract, surface milestones proven in each surface's medium) and slices (vertical capability units), and authors the bet-progress tests — written red, up front, before any implementation, with every shape derived from the design's contract specs. The user reviews the suite assertion by assertion and approves it, then the approved suite is committed (the *approval commit*); that commit is the user's signature and the git baseline that makes the tests the bet's fixed definition of done. Without this Proof of Work, delivery has no test to pass and no sequence to follow.
- **Delivery** turns the approved bet-progress tests green, slice by slice, recording each slice's outcome in the bet's manifest so progress is visible (`./dev bet status`) and resumable. As each slice completes, permanent best-practice tests are rolled out. A test that looks wrong mid-delivery is amended with the user's approval, never edited around — and a per-slice reconciliation checks the test files against their approved record so a quiet edit cannot pass for green. Without the Decomposition contract, every design question becomes a mid-implementation conversation made under coding pressure.
- **Validation** confirms the delivered bet behaves as designed, promotes the bet's contract specs into the canonical per-service record, writes the bet's capability-ledger rows (when the project keeps a surface registry), archives the bet-progress suite, runs the bet retrospective, and folds what the bet learned back into upstream documents for every subsequent bet.

The lifecycle is sequential because each phase's output is the next phase's input. The order is structural, not procedural — gating design before decomposition is not a rule to follow but the only way the artifacts compose.

Each phase runs in its own workflow file because each demands a different mode. Loading only the current phase's workflow keeps the conversation in one mode at a time; mixing modes produces shallow work in all of them.

---

## Lifecycle Overview

| Phase | Workflow | Status | Output |
|---|---|---|---|
| 1. Discovery | `workflows/01-discovery.md` | `discovery` | `docs/bets/<slug>/pitch.md` |
| 2. Design Foundations | `workflows/02-design.md` | `design` | `docs/bets/<slug>/technical-design/` (`00-overview.md`, `01-surface-design.md`, `02-capability-design.md`) + `contracts/` specs |
| 3. Decomposition | `workflows/03-decomposition.md` | `decomposition` | `decomposition.md` + `test-review.md` + `tests/bets/<slug>/`, approved and committed (`approval_commit` recorded) |
| 4. Delivery | `workflows/04-delivery.md` | `delivery` | Implementation that turns the approved tests green; slice records in the manifest |
| 5. Validation | `workflows/05-validation.md` | `validation` → `delivered` | Specs promoted; retrospective; bet-progress suite archived |

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
