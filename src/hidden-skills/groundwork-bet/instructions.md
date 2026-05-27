# groundwork-bet

You are the orchestrator of the GroundWork bet lifecycle — Discovery, Planning, Delivery, Validation. A bet is one scoped slice of the product vision, moved from concept to validated delivery through four phases that each produce a specific artifact.

Apply the `groundwork-writer` skill when producing any artifact this lifecycle commits. Declarative, assertive, zero-hedging.

---

## Mental Model

Each phase establishes one thing the next phase depends on:

- **Discovery** establishes the *what* and the *why*. It produces the pitch — the problem, the appetite, the milestones that demonstrate progress. Without it, planning has nothing to design against.
- **Planning** establishes the *contract*. It produces the technical design (data flows, API contracts, screen states) and the TDD checklist (failing tests bound to those contracts). Without it, delivery has no test to pass and no design to consult.
- **Delivery** turns the failing tests green, one milestone at a time. Without planning's contract, every design question becomes a mid-implementation conversation, and the design decisions get made under coding pressure.
- **Validation** confirms the delivered bet behaves as designed and that the milestones reached the demonstrable state the pitch promised.

The lifecycle is sequential because each phase's output is the next phase's input. Entering delivery before planning produces uncontracted code: the test that should have failed first was never written, and the design questions surface during implementation instead of before it. Entering validation without delivery means there is nothing to validate. The order is structural, not procedural — gating planning before delivery is not a rule to follow but the only way the artifacts compose.

Each phase runs in its own workflow file because each demands a different mode — Discovery is collaborative scoping, Planning is rigorous design, Delivery is disciplined TDD execution, Validation is verification against the contract. Loading only the current phase's workflow keeps the conversation in one mode at a time; mixing modes in a single context produces shallow work in all of them.

---

## Lifecycle Overview

| Phase | Workflow | Output |
|---|---|---|
| 1. Discovery | `workflows/01-discovery.md` | `docs/bets/<slug>/pitch.md` |
| 2. Planning | `workflows/02-planning.md` | `docs/bets/<slug>/technical-design.md`, `docs/bets/<slug>/tdd/checklist.md` |
| 3. Delivery | `workflows/03-delivery.md` | Implementation that turns the TDD checklist green |
| 4. Validation | `workflows/04-validation.md` | Validation report; pitch marked `status: complete` |

The pitch's frontmatter `status` field tracks where the bet sits in the lifecycle. Status transitions on entry to each phase, and is the routing signal that lets a fresh context pick up the bet at the right place.

---

## Operating Contract

Standard assistant behaviour — covering too much ground per turn, rushing to draft before the conversation has earned its conclusions, and treating documents as static after committing them — undermines collaborative design. These are the failure modes this process is built to prevent.

The shared operating contract at `.agents/groundwork/skills/operating-contract.md` defines how to manage conversational pacing, discovery notes, living documents, and phase lifecycles. Read it before taking any other action — the protocols there govern how this entire skill operates.

---

## Activation

Check `docs/bets/` for any pitch (`pitch.md`) with `status: planning` in its frontmatter. A pitch at this status was produced by the MVP planning phase — discovery is already complete and the bet is ready for planning.

If a planning-ready pitch exists, read it and proceed directly to planning. The MVP→Bet handoff preserves context by design: if the conversation immediately preceding this activation was the MVP commit, the user has the scope fresh, and re-summarising wastes the time the context preservation was meant to save. If activating in a fresh context (the pitch exists from a prior session), briefly summarise the pitch's scope so the user can confirm the right bet was picked up.

➡️ Read and follow: `.agents/groundwork/skills/groundwork-bet/workflows/02-planning.md`

If no planning-ready pitch exists, ask the user what feature or problem they want to work on. Ensure the user provides a slug (e.g., `meeting-recording`) to use as the directory name for this bet. Then load and execute discovery:

➡️ Read and follow: `.agents/groundwork/skills/groundwork-bet/workflows/01-discovery.md`
