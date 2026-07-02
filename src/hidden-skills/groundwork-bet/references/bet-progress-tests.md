# Bet-Progress Test Guidance

*This document explains how to write bet-progress tests — the red proof-of-work suite generated at Delivery start from the bet's approved prose decomposition. It is guidance for the agent materializing the stubs, not a runnable test file. The actual test stubs live under `tests/bets/<bet-slug>/`.*

---

## What bet-progress tests are

Bet-progress tests are **temporary, black-box proof-of-work** materialized from the approved prose before any implementation exists. Each one renders the Proof-of-work prose of a milestone or slice — already user-approved in the decomposition tree — into a runnable red stub. At Delivery start the board is materialized for the whole **milestone ladder** plus the **first milestone's slices**; each later milestone's slice stubs are added when Delivery opens that milestone. Red means the work is not done; green means it is proven. Running the suite is the bet's live progress board.

A milestone test drives the real product through its consumer's front door — the front-door and honest-green discipline governing what it may assert is canonical in `workflows/03-decomposition.md` Step 3; this file covers only how to build the stub, in the consumer's surface medium:
- `graphical-ui` — a browser-driven (or platform-driven) test that navigates to the feature and verifies what the user sees on the running app
- `cli` — a test that invokes the command and verifies the output, exit code, or side-effect
- `agentic-protocol` — a test that sends a protocol request and verifies the response structure

The milestone test resolves its consumer's surface through the surfaces fixture (slug → entry point).

Slice tests prove the vertical capability a slice contributes toward its parent milestone, at that slice's service edge — **informed by and bounded by** the parent milestone's front-door proof, not a duplicate of it. A slice that builds a screen proves the screen renders and behaves through the pattern it implements in full.

---

## The target-state principle, and system-level only

Write every test as if the feature already exists — the desired reality, not the current state. A test that asserts "endpoint returns 501" is not a bet-progress test; assert the presence of the delivered capability.

Bet-progress tests hit the running services from the outside: no importing application code, no mocking services or fake data layers, no depending on implementation details (database schemas, internal module structure). A test that requires knowledge of an internal module belongs in the permanent per-service suite, not here.

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

For `graphical-ui` interface tests, capture a screenshot of each key state of the screen under test — default, hover, focus, empty, loading, error — written to `.groundwork/cache/visual/<bet-slug>/<surface>/<state>.png` (create the directory first), after the state is reached and assertions pass — the screenshot records the proven state, it does not replace the assertion. The captures are what the delivery agent reads (Tier 2 inspection) and the experience-auditor review judges at milestone close and over the whole bet. Capture nothing for `cli` and `agentic-protocol` surfaces; their observable output is text, asserted directly.

**What capture sees, and what it does not.** A static screenshot verifies render correctness, coherence, and composition — it does not see motion or perceived latency, which stay behaviour-tested (timing and state, never a frame).

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

- Falsifiable and consumer-visible, per the target-state principle above — never an internal state, and it would pass with no special knowledge of the internal implementation.
- Satisfies the front-door and honest-green tells canonical in `workflows/03-decomposition.md` Step 3.
- A **headline proof, not a permutation** — one to three assertions per milestone or slice. An edge case, a permutation, or an error variant belongs in the slice's permanent best-practice tests (`workflows/04-delivery.md`, the Slice Loop), not here.
- A reviewer can read it and confirm it matches the milestone's acceptance criteria and Proof-of-work prose in `decomposition/NN-<milestone-slug>/index.md`.
