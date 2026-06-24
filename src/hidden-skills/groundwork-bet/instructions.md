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
- **Decomposition** establishes *the order of work and the proof*. With the design locked, it breaks the bet into milestones (demonstrable states ordered by integration value — capability milestones proven at the contract, surface milestones proven in each surface's medium) and slices (vertical capability units), and authors the decomposition tree as **prose**: each milestone and slice carries a Proof-of-work proof — what it proves and how — with every shape tracing to the prose API/data design. No test code is written here. The user reviews proof by proof and approves; the approved prose is then committed and **tagged** (`bet/<slug>/approved`) — the tag is the user's signature and the frozen baseline that makes the prose the bet's fixed definition of done. The tests are generated red at Delivery start from this approved prose. Without this Proof of Work, delivery has no proof to satisfy and no sequence to follow.
- **Delivery** materializes the red board from the approved prose, then turns it green slice by slice. The suite is the board (`./dev bet status`, derived not stored) and each slice's commit is its record, so progress is visible and resumable. As each slice completes, permanent best-practice tests are rolled out. A proof that looks wrong mid-delivery is amended via the Amendment Protocol with the user's approval, never edited around — and a per-slice reconciliation checks that the frozen prose has not silently moved. Without the Decomposition contract, every design question becomes a mid-implementation conversation made under coding pressure.
- **Validation** confirms the delivered bet behaves as designed, captures each touched service's served contract into the canonical `docs/architecture/api/` record, writes the bet's capability-ledger rows (when the project keeps a surface registry), archives the **whole bet** (docs and tests), runs the bet retrospective, and folds what the bet learned back into upstream documents for every subsequent bet.

The lifecycle is sequential because each phase's output is the next phase's input. The order is structural, not procedural — gating design before decomposition is not a rule to follow but the only way the artifacts compose.

Each phase runs in its own workflow file because each demands a different mode. Loading only the current phase's workflow keeps the conversation in one mode at a time; mixing modes produces shallow work in all of them.

---

## Lifecycle Overview

| Phase | Workflow | Status | Output |
|---|---|---|---|
| 1. Discovery | `workflows/01-discovery.md` | `discovery` | `docs/bets/<slug>/pitch.md` |
| 2. Design Foundations | `workflows/02-design.md` | `design` | `docs/bets/<slug>/technical-design/` (`01-ui-design.md`, `02-data-flows.md`, `03-api-design.md`, `04-data-design.md`) |
| 3. Decomposition | `workflows/03-decomposition.md` | `decomposition` | `docs/bets/<slug>/decomposition/` prose tree, approved and tagged (`bet/<slug>/approved`) |
| 4. Delivery | `workflows/04-delivery.md` | `delivery` | Red board materialized from the approved prose, then turned green slice by slice; each slice committed as its record |
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
