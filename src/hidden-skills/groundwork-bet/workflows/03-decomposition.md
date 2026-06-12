# Phase 3: Decomposition (Milestones, Slices, Proof of Work)

**Goal:** With the design locked, break the bet into the order of work and author the tests that prove each step — agent-led, then reviewed. The agent proposes the breakdown and writes the tests; the user reviews sequencing and the tests. No implementation code.

This phase is where the bet becomes executable. Milestones define the demonstrable checkpoints — capability proofs at the contract, surface proofs in each surface's medium. Slices define the vertical units of work. Bet-progress tests define what "done" means for each — written red, up front, so the Delivery phase has a clear pass/fail signal for every increment.

## Restrictions
⚠️ **CRITICAL CONSTRAINT:** You are FORBIDDEN from writing implementation code during this phase. You may write test stubs, test scaffolding, and the decomposition document — nothing that a compiler or interpreter would run as application logic.

## Operating Contract

This workflow operates under the protocols defined in `.agents/groundwork/skills/operating-contract.md` (contract v1; Continuous Bet mode: Protocols 1, 2, 4, 8, and 9 apply). Read it before taking any other action.

Protocol 1 applies throughout: milestone and slice discussions surface signals that belong elsewhere — future-bet instincts (`## Bets`), implementation details worth preserving (`## Design Details`). Capture them in `.groundwork/cache/discovery-notes.md` as they occur, then steer back to sequencing.

## Step 1: Update pitch status

Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: decomposition`.

## Step 2: Propose milestones

Read `docs/bets/<bet-slug>/technical-design.md` in full. From the Surface Design subsections and the Capability Design (data flows, API contracts, data schema), decompose the bet into milestones — then present the breakdown for review before writing a single test.

**What a milestone is:** a demonstrable state the product reaches, ordered so each one is independently shippable. Its consumer gets value from Milestone 1 even if Milestone 2 never ships. Milestones come in two types:

- **Capability milestone** — proves core behaviour headless. Its demonstrable state is a contract exercised end-to-end against the running services (or the embedded core's public API): curl-able, scriptable, observable, with no surface running. This amends the user-visible rule honestly rather than bending it: a capability milestone is *consumer-visible at the contract*, and the decomposition records who that consumer is — the bet's in-scope surfaces, whose milestones build on it; or, when the bet delivers headless, the latent agentic surface (the programmatic caller the promoted contract serves).
- **Surface milestone** — proves a named surface delivers the capability to its users. Its demonstrable state is asserted in that surface's medium and bounded to wiring, rendering, and interaction — the business behaviour beneath it was already proven at the contract.

**Degrade rule:** a project with no `docs/surfaces.md` has a single implicit surface — skip milestone typing and the slice `surface` field entirely; milestones are user-visible states in the product's interface medium, exactly as before this distinction existed. A single-surface registry types its milestones (one capability milestone, then surface milestones for the lone surface) with no extra questions to the user — the typing falls out of the design, not a conversation.

**Decomposition constraints the agent must hold:**
- A bet introducing new capability **opens with its capability milestone**; surface milestones follow and depend on it. The contract proof comes first because every surface milestone consumes it.
- A bet may legitimately **end at the capability milestone** with every surface milestone deferred — a headless delivery. The pitch's surface no-gos predicted this, and validation records the deferral in the capability ledger.
- Order by integration value: the first milestone is the simplest end-to-end flow that proves the architecture works. Later milestones add richness to that proven foundation.
- Each milestone is independently shippable — dependencies flow forward only.
- Milestones are never horizontal. "Build all the schemas" is not a milestone; it is invisible to every consumer and produces no demonstrable state. A capability milestone is not horizontal — its contract is demonstrable end-to-end, just at the API rather than on a screen.
- 2–5 milestones is the healthy range. Fewer means the bet is probably not scoped in demonstrable increments. More means it is probably not a bet — it is a roadmap.

Present the milestone list with the **sequencing rationale** for each: what architectural proof Milestone 1 provides, why Milestone 2 can only follow it, and so on. The review focuses on **ordering, typing, and whether each milestone names a demonstrable outcome for a named consumer** — not implementation detail. Revise the ordering until the user is satisfied before proceeding.

## Step 3: Author milestone bet-progress tests

For each approved milestone, write its proof test file before moving to slices. A milestone's proof follows its type:

**Capability milestone tests** hit the contract directly — end-to-end against the running services using the shared `api_client` and `cluster` fixtures from `tests/conftest.py`, or against the embedded core's public API when the core is embedded. Every assertion exercises the contract the design committed to: requests, responses, error cases, persisted effects. No surface is in the loop.

**Surface milestone tests** assert what that surface's users observe, in that surface's medium. The medium comes from the surface's registry entry (`docs/surfaces.md`) — never assume:
- `graphical-ui` → browser-driven test using the `page` fixture
- `cli` → test that invokes the binary via `subprocess` or `pexpect`
- `agentic-protocol` → test that sends a protocol request and verifies the response

Surface tests resolve their target through the surfaces fixture — the mapping from registry slug to that surface's entry point (base URL, binary, or protocol endpoint). **Surface milestone tests never re-prove core logic** — the capability milestone already proved every business rule at the contract, and a surface test that re-asserts one multiplies the test pyramid by the surface count for nothing. Surface tests assert wiring, rendering, and interaction; when one goes red, the capability milestone's green contract tests localize the failure to the surface's adapter layer.

**Degrade rule:** with no surface registry, write each milestone's proof as the two familiar layers — an interface-level test in the project's single medium plus an API-level system test that localizes failures — exactly as before milestone typing existed.

**Tests derive their shapes from the spec files.** Every request body, response assertion, and field name in a bet-progress test comes from `docs/bets/<bet-slug>/contracts/` (`openapi.yaml`, `asyncapi.yaml`, `schema.sql`) — load the spec and build the test's shapes from it, generating a client or validator where the project's toolchain supports it. A test that hand-rolls a shape the spec does not define is testing a contract that does not exist; the review blocks it.

**Writing the tests:**

Discover the project's test language and service names from the scaffold — from `docs/infrastructure.md` and the generated `docker-compose.yml`. Do not hardcode a language or service name.

If `./dev new milestone <bet-slug> <milestone-slug>` exists in the project, run it to scaffold the stub at the correct path. If it does not exist, write the file directly. Either way the path and naming are identical:

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
- **Surface** — `core` for a slice implementing capability-core behaviour, or the registry slug of the surface it wires (omit the field entirely when the project has no surface registry). The field drives delivery sequencing — core slices merge before the surface slices that consume them — and tells the reviewer which test discipline applies: contract proof for `core`, wiring-only for a surface.
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
- **Milestone map** — for each milestone: type and demonstrable goal (with the capability milestone's consumer named; type omitted on projects without a registry), sequencing rationale, acceptance criteria, link to the milestone test file
- **Per-milestone slice specs** — the six-part slice anatomy and Test Cases table for each slice, with links to the slice test files

Apply `groundwork-writer` when drafting this document — declarative, assertive, zero-hedging.

## Step 6.5: Write the decomposition manifest

The prose document is for humans; delivery tracking needs the same structure machine-readably, so `./dev bet status` can render progress and a resumed session can find the active slice without re-deriving it.

Write `.groundwork/bets/<bet-slug>/decomposition.json` mirroring the decomposition exactly:

```json
{
  "bet": "<bet-slug>",
  "created": "<YYYY-MM-DD>",
  "milestones": [
    { "id": "m1", "slug": "<milestone-slug>", "title": "<demonstrable goal>",
      "test_file": "tests/bets/<bet-slug>/test_milestone_1_<milestone-slug>.<ext>",
      "status": "pending",
      "slices": [
        { "id": "1.1", "slug": "<slice-slug>", "service": "<owner-service>",
          "surface": "core",
          "test_file": "tests/bets/<bet-slug>/test_slice_1_<service>_<slice-slug>.<ext>",
          "status": "pending", "baseline_commit": null, "delivered_commit": null,
          "files": [], "notes": null } ] } ]
}
```

Every milestone and slice in `decomposition.md` appears here with the same slugs and test paths — the two files describe one decomposition, and Delivery updates only the manifest's status fields. Each slice's `surface` value (`"core"` or a registry slug) matches its spec's **Surface** field; omit the key entirely when the project has no surface registry — the addition is additive, and consumers like `./dev bet status` ignore fields they do not read.

## Step 6.6: Render the test-review surface

The user is about to stake the bet's delivery on these tests — implementing to green *is* done. A review that confirms files exist and fail tells the user nothing about whether the assertions are the right ones. The test-review surface puts the actual assertions in front of the user with their full chain of justification, so approval means "I read what these tests prove and it is what I want proven."

Write `docs/bets/<bet-slug>/test-review.md` using the template at `.agents/groundwork/skills/groundwork-bet/templates/test-review.md`. For each milestone and slice test: the capability or acceptance criterion it proves, the contract operation it traces to (spec path and operation), the test file, the **verbatim assertion block** quoted from the test, and a one-line plain-language reading of what the assertion proves. Generate this from the real test files — a surface that paraphrases the tests can drift from them, and drift here defeats its purpose.

## Step 7: Independent review

The decomposition is the sequencing commitment this bet executes against. A milestone no consumer can observe, a slice that is horizontal, or a test that does not trace to the design compounds into every delivery decision. The review pass catches these before the plan hardens.

1. **Announce** the shift — the agent is moving from authoring into an independent review of the decomposition before presenting Proof of Work.
2. **Invoke the review subagent** (Protocol 9) with `document_path: docs/bets/<bet-slug>/decomposition.md` and `document_type: decomposition`. The gate is fail-closed (Protocol 8): proceed only on a parseable `VERDICT: PRESENT`; a review that errors, hangs, or returns no verdict follows Protocol 9's failure path.
3. **Revise loop.** If the verdict is **REVISE**, apply every 🔴 Critical finding directly to the decomposition and the affected test files. Rewrite sections rather than annotating them. Run the review again. The revise cap is a hard stop, not a target to push past: after 3 REVISE verdicts, stop, surface remaining 🔴 findings as 🟡 Advisory, and disclose that the review did not reach **PRESENT** (Protocol 8).
4. **Carry advisory findings forward.** When the verdict is PRESENT, hold any 🟡 Advisory findings — they surface during the Proof of Work transition so the user can decide whether to act on them.

The review verifies document-chain integrity — see the **Document Chain Integrity** section below for the exact checks the reviewer applies.

## Decomposition Gate

Before presenting Proof of Work, verify every item:

- Every milestone names a demonstrable goal a reviewer can trace to `technical-design.md`: a surface milestone's user-visible goal traces to its surface's Surface Design subsection; a capability milestone's contract state traces to the Capability Design, with its consumer named.
- When the project has a surface registry: every milestone is typed (`capability` or `surface (<slug>)`), the bet's new capability opens with its capability milestone, and every slice carries a `surface` value (`core` or a registry slug) in both `decomposition.md` and `decomposition.json`. With no registry, none of this applies — untyped milestones, no surface fields.
- Every milestone has a bet-progress test file at `tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.<ext>`.
- No surface milestone test re-asserts a business rule the capability milestone proves at the contract — surface tests are bounded to wiring, rendering, and interaction.
- Every slice is vertical — it can be deployed and verified without any future slice existing.
- Every slice has falsifiable Required Capabilities, each tracing to a contract or schema in `technical-design.md`.
- Every slice has a bet-progress test file at `tests/bets/<bet-slug>/test_slice_<N>_<service>_<slice-slug>.<ext>`.
- Every bet-progress test is **red** — it fails because the implementation does not exist. A test that passes before any implementation is either testing nothing or testing existing code, which means it is not a bet-progress test.
- Every request shape, response assertion, and field name in the tests traces to `docs/bets/<bet-slug>/contracts/` — no hand-rolled shapes the spec does not define.
- `docs/bets/<bet-slug>/decomposition.md` is complete: milestone map, slice specs, and test file links all populated.
- `.groundwork/bets/<bet-slug>/decomposition.json` mirrors the document — same milestones, slugs, and test paths.
- `docs/bets/<bet-slug>/test-review.md` quotes the current assertion blocks from every test file.

A partial decomposition is not Proof of Work. Do not present it as such.

## Document Chain Integrity

The review subagent applies these checks. The agent authoring the decomposition should apply them during Step 7 as well — they catch drift before it reaches the reviewer.

| Document | Upstream check | Downstream check |
|----------|---------------|-----------------|
| Pitch | Solves the stated problem within appetite | Design covers the pitched solution |
| Technical Design | Every surface element/flow traces to the pitch | Milestones can be derived from it |
| Milestones | Each goal is consumer-visible value — at the contract for capability milestones, in the surface's medium for surface milestones — traceable to the design | Every slice belongs to exactly one milestone |
| Slices | Required Capabilities trace to contracts/schemas in `technical-design.md` | Test cases trace to milestone acceptance criteria |

## Quality Standard: What Good Milestones and Slices Look Like

A milestone is a demonstrable state the product reaches for a named consumer — at the contract for a capability milestone, in a surface's medium for a surface milestone — not a layer of the stack, not a phase of implementation. A slice is a vertical column through one component, not a horizontal pass. If neither description produces a name that means something to its consumer, the decomposition is wrong.

**Shallow (insufficient):**

```markdown
## Milestones

1. **Backend** — Build the database schema and notification service
2. **Frontend** — Add notification UI components
3. **Integration** — Connect frontend to backend and end-to-end test
```

**Deep (required standard):**

```markdown
## Milestones

### Milestone 1: Notification lifecycle proven at the contract

**Type:** capability
**Consumer:** the `web-app` and `admin-cli` surfaces — Milestones 2 and 3 build on
this contract.

An operation lifecycle event posted to the notification service produces a queryable
notification record, and subsequent events update its status in place — provable
end-to-end against the running services with nothing but an HTTP client.

**Sequencing rationale:** This contract is what every surface consumes. Proving it
headless first makes Milestones 2 and 3 wiring exercises against a known-good core —
a red surface test can only mean a surface problem.

**Acceptance criteria:**
- `POST /internal/events` with a valid operation lifecycle event returns `202`, and
  `GET /api/notifications` returns the corresponding record within 2 seconds.
- A `completed` event for the same operation updates the existing record's status in
  place — no duplicate record.

**Test file:** `tests/bets/notifications/test_milestone_1_notification_contract.py`

---

### Milestone 2: Notification feed on web-app

**Type:** surface (`web-app`)

A web user sees their unread notifications in the feed, updating in real time as
operations progress, without a page refresh.

**Sequencing rationale:** Depends on Milestone 1's proven contract. This milestone
asserts only the web wiring — websocket subscription, rendering, dismissal — and
never re-proves the lifecycle rules Milestone 1 settled at the contract.

**Acceptance criteria:**
- Triggering an operation causes its notification to appear in the feed within
  2 seconds, without a page refresh.

**Test file:** `tests/bets/notifications/test_milestone_2_web_feed.py`

---

### Milestone 3: Notification status on admin-cli

**Type:** surface (`admin-cli`)

An operator running `notifications list` sees the same records with status and age
columns; `--failed` filters to failures and exits non-zero when any exist.

**Sequencing rationale:** Depends only on Milestone 1 — the two surface milestones
are independent of each other, and either could ship alone with the other deferred
to the ledger.

**Test file:** `tests/bets/notifications/test_milestone_3_cli_status.py`
```

**Slice example (deep):**

```markdown
### Slice 1.1 — notification-service: Operation event intake

**Owner service:** notification-service
**Surface:** core
**Complexity:** M
**Prerequisite:** none

Wires the notification service to receive operation lifecycle events from the
operations service and persist them as notification records. This is the
notification-service's data foundation — every other slice depends on this record
existing.

**Required Capabilities:**
- `POST /internal/events` accepts an operation lifecycle event matching the
  `OperationEvent` schema in `technical-design.md §API Contracts`; returns `202 Accepted`
- A notification record is created in the `notifications` table with status, message,
  and operation_id populated from the event payload
- Duplicate events for the same operation_id + status are idempotent; a second
  identical event produces no additional record

**Test Cases:**
| Test | Location | Assertion |
|------|----------|-----------|
| Event intake creates record | `test_slice_1_notification_service_event_intake.py` | `POST /internal/events` with valid payload → 202; `SELECT * FROM notifications WHERE operation_id = ?` returns one row |
| Duplicate event is idempotent | same | Second identical POST → 202; row count unchanged |
| Invalid payload rejected | same | Missing required field → 422; no row created |
```

The shallow decomposition has horizontal milestones invisible to every consumer, no acceptance criteria, no sequencing rationale, and no falsifiable test cases. Its "Backend" milestone is not a capability milestone wearing the wrong name — it names a build activity, not a contract state anyone can exercise. The deep version opens with the capability milestone that proves the contract headless for named consumers, follows with surface milestones bounded to wiring in each surface's medium, and carries slice capabilities that trace directly to the technical design contract.

## Transition

Present the milestone map and the red bet-progress suite together as Proof of Work:

- `docs/bets/<bet-slug>/decomposition.md` — the sequencing commitment
- `docs/bets/<bet-slug>/test-review.md` — what the tests actually assert, with the chain of justification
- `tests/bets/<bet-slug>/` — the runnable proof suite (all tests red)

Walk through the milestone map first — ordering rationale, milestone types, demonstrable goals. Then walk the test-review surface **assertion by assertion**: for each test, what it proves, where that traces in the design, and the verbatim assertion. The user is approving the definition of done — pace this walkthrough like the design decision it is (Protocol 4), not a confirmation formality. Where the user challenges an assertion, fix the test, re-render the affected test-review entry, and continue.

On approval, **seal the suite**: run `./dev bet sign <bet-slug>` if the project ships the dev CLI; otherwise write `.groundwork/bets/<bet-slug>/test-manifest.json` directly — `{"bet", "signed": <date>, "review_verdict": "PRESENT", "files": {<path>: <sha256> for every file under tests/bets/<bet-slug>/}}`, computing hashes with the shell's `shasum -a 256`. The manifest is the user's signature on the suite: from this point the tests are the bet's fixed contract, `./dev test bet` refuses a tampered suite, and changes route through the Amendment Protocol in `workflows/04-delivery.md`.

➡️ Read and follow: `.agents/groundwork/skills/groundwork-bet/workflows/04-delivery.md`
