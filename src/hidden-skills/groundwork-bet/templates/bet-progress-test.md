# Bet-Progress Test Guidance

*This document explains how to write bet-progress tests — the red proof-of-work suite generated at Delivery start from the bet's approved prose decomposition. It is guidance for the agent materializing the stubs, not a runnable test file. The actual test stubs live under `tests/bets/<bet-slug>/`.*

---

## What bet-progress tests are

Bet-progress tests are **temporary, black-box proof-of-work** materialized from the approved prose before any implementation exists. Each one renders the Proof-of-work prose of a milestone or slice — the proof the user already reviewed and approved in the decomposition tree — into a runnable red stub. At Delivery start the board is materialized for the whole **milestone ladder** plus the **first milestone's slices**; each later milestone's slice stubs are added when Delivery opens that milestone (its slices are authored then). So the board shows progress at milestone granularity before the later rungs are sliced. They assert what the milestone's consumer would observe if the feature were complete. Red means the work is not done. Green means it is proven. Running the suite is the bet's live progress board.

**A milestone test drives the real product through its consumer's front door.** It exercises the shipping build the way the milestone's consumer would, on the real pipeline and real data, and asserts what the consumer observes — in their surface's medium:
- `graphical-ui` — a browser-driven (or platform-driven) test that navigates to the feature and verifies what the user sees on the running app
- `cli` — a test that invokes the command and verifies the output, exit code, or side-effect
- `agentic-protocol` — a test that sends a protocol request and verifies the response structure

The milestone test resolves its consumer's surface through the surfaces fixture (slug → entry point). It is the front-door proof: it runs the whole path end to end, not a back-channel against an internal contract with no consumer in the loop. Proving a backend contract directly is real work, but it belongs to a *slice* test, not a milestone test — the milestone proves the consumer's outcome.

Slice tests prove the vertical capability a slice contributes toward its parent milestone, at that slice's service edge. They are **informed by and bounded by** the parent milestone's front-door proof — a slice test proves a specific capability; the milestone test proves the consumer-visible outcome those capabilities enable. A slice that builds a screen proves the screen renders and behaves through the pattern it implements in full.

---

## The target-state principle

Write every test as if the feature already exists. The test describes the desired reality, not the current state. A test that asserts "endpoint returns 501" is not a bet-progress test — it describes the absence of implementation. Assert the presence of the delivered capability.

---

## System-level only

Bet-progress tests hit the running services from the outside. They:
- Do not import application code
- Do not mock services or fake data layers
- Do not depend on implementation details (database schemas, internal module structure)

If a test requires knowledge of an internal module, it is not a bet-progress test — it belongs in the permanent per-service test suite.

---

## File naming convention

All bet-progress tests live under `tests/bets/<bet-slug>/`. The `<bet-slug>` is the kebab-case slug of the bet (the `docs/bets/<bet-slug>/` directory name).

**Milestone test files:**
```
tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.<ext>
```
Where `<N>` is the milestone number (1, 2, 3...), `<milestone-slug>` is the kebab-case milestone name, and `<ext>` is the project's test language extension (`.py`, `.go`, `.ts`) — discovered from the scaffold, never assumed.

**Slice test files:**
```
tests/bets/<bet-slug>/test_slice_<N>_<service>_<slice-slug>.<ext>
```
Where `<N>` is the slice's ordinal across the whole bet — not reset per milestone — assigned in authoring order (the shipped `./dev new slice` counts existing slice stubs in `tests/bets/<bet-slug>/` and assigns the next one); `<service>` is the owning service name (from `docs/architecture/infrastructure.md`), and `<slice-slug>` is the kebab-case slice name.

**Archive path (Phase 5 — after delivery):**
```
tests/bets/_archive/<bet-slug>/
```

---

## Fixtures and service discovery

Bet-progress tests reuse the shared fixtures from `tests/conftest.py`:
- `cluster` — boots and health-checks all services; provides the running topology
- `api_client` — an HTTP client configured with the discovered service base URLs; slice tests use this to exercise a service edge directly
- `pure_state_reset` — truncates all service data stores before each test (autouse)
- `surfaces` — the mapping from registry slug to that surface's entry point (base URL for a web surface, binary path for a CLI, protocol endpoint for an agentic surface); milestone front-door tests resolve their consumer's surface here
- `frontend_base_url` — the legacy alias for the single graphical surface's base URL; present when exactly one graphical surface exists, for suites written before the surfaces fixture

Declare the fixtures you need as test-function parameters; pytest resolves them from the parent conftest automatically.

For a front-door test against a `graphical-ui` surface, the `page` fixture (from pytest-playwright) drives a real browser. For `cli` surfaces, use `subprocess` or `pexpect` to invoke the binary directly.

## Capturing screenshots for the visual verification loop

For `graphical-ui` interface tests, capture a screenshot of each key state of the screen under test — default, hover, focus, empty, loading, error — written to `.groundwork/cache/visual/<bet-slug>/<surface>/<state>.png` (create the directory first). These are the states where "renders broken" and "looks unfinished" both live, and the captures are what the delivery agent reads (Tier 2 inspection) and the experience-auditor review judges at milestone close and over the whole bet. Capture after the state is reached and assertions pass — the screenshot records the proven state, it does not replace the assertion. Capture nothing for `cli` and `agentic-protocol` surfaces; their observable output is text, asserted directly.

**What capture sees, and what it does not.** A static screenshot verifies render correctness, coherence, and composition. It does *not* see motion (easing, durations, press physics) or perceived latency — both committed in the design system — so those stay behaviour-tested, asserted on timing and state, never on a frame. Do not treat a captured screen as proof of an animation or a latency budget.

**Declare the routes the bet touched.** The permanent route-driven gates (render-smoke, geometry, visual-regression) sweep the screens listed in `tests/system/routes.json` (a JSON array of paths), defaulting to the app root when absent. When a bet adds or changes a `graphical-ui` route, add it to that manifest so the permanent suite covers it — the same promotion shape as the bet's other best-practice tests.

---

## Placeholder structure for red tests

When the implementation does not exist yet, a test stub must be **explicitly red** — it must fail, not skip. Use the pattern appropriate to the test language:

- Python: `pytest.fail("bet-progress test not yet implemented — <describe target state>")`
- Go: `t.Fatal("bet-progress test not yet implemented — <describe target state>")`
- TypeScript: `throw new Error("bet-progress test not yet implemented — <describe target state>")`

Comment the stub with what it will eventually assert, so the Delivery agent knows exactly what to implement. For a milestone stub, name the consumer's front-door outcome:
```
# Front door (<consumer> via <surface>): [what the consumer observes when they drive the real product — the action, what they see, on real data]
```
For a slice stub, name the capability at its service edge:
```
# Slice capability: [the behaviour at this slice's edge the milestone's front-door proof builds on]
```

---

## What makes a good bet-progress test

A bet-progress test is good when:
- It asserts a **falsifiable, consumer-visible outcome** — what the consumer observes at their front door, never an internal state
- It would fail if the feature shipped incomplete
- For a **milestone headline**, it **drives the real product through the real front door** — the consumer's action runs the shipping build on the real pipeline and real data, so a stub, mock, scripted driver, or hardcoded return cannot turn it green. A milestone proof a double can satisfy proves plumbing, not the milestone (`workflows/03-decomposition.md`). Seeded inputs are fine; faking the work in the middle is not
- **Any fake it leans on has a real test behind it** — if the proof uses a fixture for work a real stage should do, another test exercises the real producer; a fixture nothing real ever generates is a green light wired to nothing (`docs/principles/foundations/testing.md`)
- It would pass without any special knowledge of how the feature is implemented internally
- It is a **headline proof, not a permutation** — it proves the milestone's outcome or the slice's capability, not every input variant or error code
- A reviewer can read it and confirm it matches the milestone's acceptance criteria and Proof-of-work prose in its `decomposition/NN-<milestone-slug>/index.md`

**Keep the suite lean.** Bet-progress tests render the high-impact proofs the user reviewed and signed as prose — a milestone's consumer-visible outcome and each slice's vertical capability, typically one to three assertions apiece. If an assertion is an edge case, a permutation, or an error variant rather than the headline outcome, it does not belong here; it is part of the slice's permanent best-practice tests, written when the slice is built in Delivery (`workflows/04-delivery.md`, the Slice Loop). A wall of assertions is unreviewable upstream and front-loads coverage the delivery suite is meant to carry.
