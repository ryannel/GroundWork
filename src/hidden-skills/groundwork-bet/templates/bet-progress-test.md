# Bet-Progress Test Guidance

*This document explains how to write bet-progress tests — the red proof-of-work suite generated at Delivery start from the bet's approved prose decomposition. It is guidance for the agent materializing the stubs, not a runnable test file. The actual test stubs live under `tests/bets/<bet-slug>/`.*

---

## What bet-progress tests are

Bet-progress tests are **temporary, black-box proof-of-work** materialized from the approved prose before any implementation exists. Each one renders the Proof-of-work prose of a milestone or slice — the proof the user already reviewed and approved in the decomposition tree — into a runnable red stub. They assert what the milestone's consumer would observe if the feature were complete. Red means the work is not done. Green means it is proven. Running the suite is the bet's live progress board.

A milestone's proof follows its type:

**Capability-level tests** prove a capability milestone — they hit the contract directly, end-to-end against the running services over HTTP (or against the embedded core's public API), with no surface in the loop. Every business rule the bet introduces is proven here, exactly once.

**Interface-level tests** prove a surface milestone — they assert what that surface's users observe, in that surface's medium:
- `graphical-ui` — a browser-driven test that navigates to the feature and verifies what the user sees
- `cli` — a test that invokes the command and verifies the output, exit code, or side-effect
- `agentic-protocol` — a test that sends a protocol request and verifies the response structure

Interface-level tests resolve their target surface through the surfaces fixture (slug → entry point) and are bounded to wiring, rendering, and interaction. **They never re-prove core logic** — a business rule already proven at the contract re-asserted in a surface test is a review finding, because it multiplies the test pyramid by the surface count for nothing. When an interface test goes red against green capability tests, the failure is in the surface's adapter layer by elimination.

When the project has no surface registry, the two layers pair up per milestone exactly as they always have: an interface-level test in the project's single medium, plus an API-level system test that localizes failures.

Slice tests prove the vertical capability a slice contributes toward its parent milestone. They are **informed by and bounded by** the parent milestone's tests — a slice test proves a specific capability; the milestone test proves the consumer-visible outcome those capabilities enable. A slice's `surface` field names the discipline that applies: `core` slices prove contract behaviour; surface slices prove wiring in their surface's medium.

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
Where `<N>` is the slice number within the milestone, `<service>` is the owning service name (from `docs/architecture/infrastructure.md`), and `<slice-slug>` is the kebab-case slice name.

**Archive path (Phase 5 — after delivery):**
```
tests/bets/_archive/<bet-slug>/
```

---

## Fixtures and service discovery

Bet-progress tests reuse the shared fixtures from `tests/conftest.py`:
- `cluster` — boots and health-checks all services; provides the running topology
- `api_client` — an HTTP client configured with the discovered service base URLs; capability-level tests use this to hit the contract directly
- `pure_state_reset` — truncates all service data stores before each test (autouse)
- `surfaces` — the mapping from registry slug to that surface's entry point (base URL for a web surface, binary path for a CLI, protocol endpoint for an agentic surface); interface-level tests resolve their target surface here
- `frontend_base_url` — the legacy alias for the single graphical surface's base URL; present when exactly one graphical surface exists, for suites written before the surfaces fixture

Declare the fixtures you need as test-function parameters; pytest resolves them from the parent conftest automatically.

For interface-level tests against a `graphical-ui` surface, the `page` fixture (from pytest-playwright) drives a real browser. For `cli` surfaces, use `subprocess` or `pexpect` to invoke the binary directly.

## Capturing screenshots for the visual verification loop

For `graphical-ui` interface tests, capture a screenshot of each key state of the screen under test — default, hover, focus, empty, loading, error — written to `.groundwork/cache/visual/<bet-slug>/<surface>/<state>.png` (create the directory first). These are the states where "renders broken" and "looks unfinished" both live, and the captures are what the delivery agent reads (Tier 2 inspection) and the validation fidelity critique grades (Tier 3). Capture after the state is reached and assertions pass — the screenshot records the proven state, it does not replace the assertion. Capture nothing for `cli` and `agentic-protocol` surfaces; their observable output is text, asserted directly.

**What capture sees, and what it does not.** A static screenshot verifies render correctness, coherence, and composition. It does *not* see motion (easing, durations, press physics) or perceived latency — both committed in the design system — so those stay behaviour-tested, asserted on timing and state, never on a frame. Do not treat a captured screen as proof of an animation or a latency budget.

**Declare the routes the bet touched.** The permanent route-driven gates (render-smoke, geometry, visual-regression) sweep the screens listed in `tests/system/routes.json` (a JSON array of paths), defaulting to the app root when absent. When a bet adds or changes a `graphical-ui` route, add it to that manifest so the permanent suite covers it — the same promotion shape as the bet's other best-practice tests.

---

## Placeholder structure for red tests

When the implementation does not exist yet, a test stub must be **explicitly red** — it must fail, not skip. Use the pattern appropriate to the test language:

- Python: `pytest.fail("bet-progress test not yet implemented — <describe target state>")`
- Go: `t.Fatal("bet-progress test not yet implemented — <describe target state>")`
- TypeScript: `throw new Error("bet-progress test not yet implemented — <describe target state>")`

Comment the stub with what it will eventually assert, so the Delivery agent knows exactly what to implement. For a capability milestone stub:
```
# Contract: [the end-to-end behaviour the core should prove — request, response, persisted effect]
```
For a surface milestone stub:
```
# Surface <slug>: [what the user should observe in this surface's medium — wiring and rendering only]
```
For an untyped milestone (no surface registry), comment both layers:
```
# Layer 1 — interface: [what the user should observe in the product]
# Layer 2 — API: [what the service should return end-to-end over HTTP]
```

---

## What makes a good bet-progress test

A bet-progress test is good when:
- It asserts a **falsifiable, consumer-visible outcome** — at the contract or in a surface's medium, never an internal state
- It would fail if the feature shipped incomplete
- It would pass without any special knowledge of how the feature is implemented internally
- It proves each business rule exactly once — at the contract; surface tests assert only wiring, rendering, and interaction
- It is a **headline proof, not a permutation** — it proves the milestone's outcome or the slice's capability, not every input variant or error code
- A reviewer can read it and confirm it matches the milestone's acceptance criteria and Proof-of-work prose in its `decomposition/NN-<milestone-slug>/index.md`

**Keep the suite lean.** Bet-progress tests render the high-impact proofs the user reviewed and signed as prose — a milestone's consumer-visible outcome and each slice's vertical capability, typically one to three assertions apiece. If an assertion is an edge case, a permutation, or an error variant rather than the headline outcome, it does not belong here; it is part of the slice's permanent best-practice tests, written when the slice is built in Delivery (`workflows/04-delivery.md` Step 5). A wall of assertions is unreviewable upstream and front-loads coverage the delivery suite is meant to carry.
