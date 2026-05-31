# Phase 3: Decomposition (Milestones, Slices, Proof of Work)

**Goal:** With the design locked, break the bet into the order of work and author the tests that prove each step — agent-led, then reviewed. The agent proposes the breakdown and writes the tests; the user reviews sequencing and the tests. No implementation code.

This phase is where the bet becomes executable. Milestones define the user-visible checkpoints. Slices define the vertical units of work. Bet-progress tests define what "done" means for each — written red, up front, so the Delivery phase has a clear pass/fail signal for every increment.

## Restrictions
⚠️ **CRITICAL CONSTRAINT:** You are FORBIDDEN from writing implementation code during this phase. You may write test stubs, test scaffolding, and the decomposition document — nothing that a compiler or interpreter would run as application logic.

## Operating Contract

Standard assistant behaviour — covering too much ground per turn, rushing to propose milestones before the design has been absorbed, and treating the decomposition as settled after the first pass — undermines the collaborative process. These are the failure modes this phase is built to prevent.

The shared operating contract at `.agents/groundwork/skills/operating-contract.md` defines how to manage conversational pacing, discovery notes, living documents, and phase lifecycles. Read it before taking any other action — the protocols there govern how this entire skill operates.

## Step 1: Update pitch status

Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: decomposition`.

## Step 2: Propose milestones

Read `docs/bets/<bet-slug>/technical-design.md` in full. From the Interface Design, Data Flows, API Contracts, and Data Schema, decompose the bet into milestones — then present the breakdown for review before writing a single test.

**What a milestone is:** a point of user-visible value — a demonstrable state in the product's interface, ordered so each one is independently shippable. A user gets value from Milestone 1 even if Milestone 2 never ships.

**Decomposition constraints the agent must hold:**
- Order by integration value: the first milestone is the simplest end-to-end flow that proves the architecture works. Later milestones add richness to that proven foundation.
- Each milestone is independently shippable — dependencies flow forward only.
- Milestones are never horizontal. "Build all the schemas" is not a milestone; it is invisible to the user and produces no demonstrable state.
- 2–5 milestones is the healthy range. Fewer means the bet is probably not scoped in user-visible increments. More means it is probably not a bet — it is a roadmap.

Present the milestone list with the **sequencing rationale** for each: what architectural proof Milestone 1 provides, why Milestone 2 can only follow it, and so on. The review focuses on **ordering and whether each milestone names a user-visible outcome** — not implementation detail. Revise the ordering until the user is satisfied before proceeding.

## Step 3: Author milestone bet-progress tests

For each approved milestone, write its proof test file before moving to slices. Two complementary layers form each milestone's proof:

**Interface-level test** — asserts what the user observes in the product's interface medium. The medium comes from `docs/design-system.md`'s interface track — never assume:
- `graphical-ui` → browser-driven test using the `page` fixture
- `cli` → test that invokes the binary via `subprocess` or `pexpect`
- `agentic-protocol` → test that sends a protocol request and verifies the response

**API-level system test** — end-to-end HTTP against the running services, using the shared `api_client` and `cluster` fixtures from `tests/conftest.py`. When the interface test goes red, the API test localizes the failure: frontend problem vs API problem.

**Writing the tests:**

Discover the project's test language and service names from the scaffold — from `docs/infrastructure.md` and the generated `docker-compose.yml`. Do not hardcode a language or service name.

If `./dev new milestone <bet-slug> <milestone-slug>` exists in the project (added by Workstream F), run it to scaffold the stub at the correct path. If it does not exist (e.g. the eval sandbox), write the file directly. Either way the path and naming are identical:

```
tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.<ext>
```

where `<bet-slug>` is the bet directory name, `<milestone-slug>` is the kebab-case milestone name, `<N>` is the milestone number, and `<ext>` is the project's test extension.

Tests describe the **target state** — write each test as if the feature already exists. Tests are red because the implementation does not exist yet; a placeholder that fails explicitly is correct. Consult `.agents/groundwork/skills/groundwork-bet/templates/bet-progress-test.md` for the placeholder pattern and quality criteria.

## Step 4: Decompose milestones into slices

For each milestone, break it into **vertical slices** — the smallest units that are independently buildable, deployable, and verifiable. Work through all milestones before presenting the full slice breakdown.

**The vertical-slice test:** *Can this slice be deployed and verified without any future slice existing?* If yes, it is vertical. If it requires a downstream slice to be useful, it is too thin or horizontal — merge it up or reframe it as a capability of a larger slice.

Never slice horizontally: "all schemas, then all APIs, then all UI" is three horizontal passes. Each slice must cross whatever service boundaries are needed to deliver a testable capability end-to-end.

Each slice spec must contain:
- **Owner service** — the primary service this slice lives in (from `docs/infrastructure.md`)
- **Complexity** — S / M / L
- **Prerequisite** — the exact prior merge gate (e.g. "Slice 1.2 merged"), or none
- **One-paragraph intro** — links the slice to its parent milestone and states what vertical capability it contributes
- **Required Capabilities** — falsifiable behaviour statements, each tracing to a contract or schema section in `technical-design.md`. "The endpoint exists" is not falsifiable. "POST `/api/sessions` returns 201 with a `session_id` field when given a valid request body matching the API contract" is.
- **Test Cases table** — `Test | Location | Assertion` — with specific, falsifiable assertions that a reviewer can verify against the milestone's acceptance criteria

## Step 5: Author slice bet-progress tests

For each slice, write its proof test file. Slice tests are **informed by and bounded by** the parent milestone's tests — they prove the vertical capability that contributes to that milestone, not the full milestone outcome.

```
tests/bets/<bet-slug>/test_slice_<N>_<service>_<slice-slug>.<ext>
```

where `<N>` is the slice number within the milestone, `<service>` is the owning service name, and `<slice-slug>` is the kebab-case slice name.

As in Step 3: discover language and service names from the scaffold; use `./dev new slice <bet-slug> <milestone-slug> <service> <slice-slug>` when available; write directly otherwise. All paths and names are identical either way.

## Step 6: Write `decomposition.md`

Write the human-readable, reviewable artifact to `docs/bets/<bet-slug>/decomposition.md` using the template at `.agents/groundwork/skills/groundwork-bet/templates/decomposition.md`.

The document contains:
- **Test Plan header** — the two populations and their lifecycles (one short paragraph each)
- **Milestone map** — for each milestone: user-visible goal, sequencing rationale, acceptance criteria, link to the milestone test file
- **Per-milestone slice specs** — the six-part slice anatomy and Test Cases table for each slice, with links to the slice test files

Apply `groundwork-writer` when drafting this document — declarative, assertive, zero-hedging.

## Step 7: Independent review

The decomposition is the sequencing commitment this bet executes against. A milestone that is not user-visible, a slice that is horizontal, or a test that does not trace to the design compounds into every delivery decision. The review pass catches these before the plan hardens.

1. **Announce** the shift — the agent is moving from authoring into an independent review of the decomposition before presenting Proof of Work.
2. **Invoke the review subagent** with `document_path: docs/bets/<bet-slug>/decomposition.md` and `document_type: decomposition`. The subagent runs in an isolated context — via the `Task` tool in Claude Code or the `invoke_review` tool in the eval harness — and returns only `VERDICT: PRESENT | REVISE` and a findings list.
3. **Revise loop.** If the verdict is **REVISE**, apply every 🔴 Critical finding directly to the decomposition and the affected test files. Rewrite sections rather than annotating them. Run the review again. Repeat until the verdict is **PRESENT**.
4. **Carry advisory findings forward.** When the verdict is PRESENT, hold any 🟡 Advisory findings — they surface during the Proof of Work transition so the user can decide whether to act on them.

The review verifies document-chain integrity — see the **Document Chain Integrity** section below for the exact checks the reviewer applies.

## Decomposition Gate

Before presenting Proof of Work, verify every item:

- Every milestone has a user-visible goal that a reviewer can trace to the Interface Design in `technical-design.md`.
- Every milestone has a bet-progress test file at `tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.<ext>`.
- Every slice is vertical — it can be deployed and verified without any future slice existing.
- Every slice has falsifiable Required Capabilities, each tracing to a contract or schema in `technical-design.md`.
- Every slice has a bet-progress test file at `tests/bets/<bet-slug>/test_slice_<N>_<service>_<slice-slug>.<ext>`.
- Every bet-progress test is **red** — it fails because the implementation does not exist. A test that passes before any implementation is either testing nothing or testing existing code, which means it is not a bet-progress test.
- `docs/bets/<bet-slug>/decomposition.md` is complete: milestone map, slice specs, and test file links all populated.

A partial decomposition is not Proof of Work. Do not present it as such.

## Document Chain Integrity

The review subagent applies these checks. The agent authoring the decomposition should apply them during Step 7 as well — they catch drift before it reaches the reviewer.

| Document | Upstream check | Downstream check |
|----------|---------------|-----------------|
| Pitch | Solves the stated problem within appetite | Design covers the pitched solution |
| Technical Design | Every interface element/flow traces to the pitch | Milestones can be derived from it |
| Milestones | Each goal is user-visible value traceable to the Interface Design | Every slice belongs to exactly one milestone |
| Slices | Required Capabilities trace to contracts/schemas in `technical-design.md` | Test cases trace to milestone acceptance criteria |

## Transition

Present the milestone map and the red bet-progress suite together as Proof of Work:

- `docs/bets/<bet-slug>/decomposition.md` — the sequencing commitment
- `tests/bets/<bet-slug>/` — the runnable proof suite (all tests red)

Walk through the milestone map with the user — confirm the ordering rationale, confirm the test files exist, and confirm the suite is red. On approval:

➡️ Read and follow: `.agents/groundwork/skills/groundwork-bet/workflows/04-delivery.md`
