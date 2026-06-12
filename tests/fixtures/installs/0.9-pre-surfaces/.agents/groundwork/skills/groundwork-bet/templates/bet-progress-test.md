# Bet-Progress Test Guidance

*This document explains how to write bet-progress tests — the red, up-front proof-of-work suite written during Decomposition. It is guidance for the agent authoring tests, not a runnable test file. The actual test stubs live under `tests/bets/<bet-slug>/`.*

---

## What bet-progress tests are

Bet-progress tests are **temporary, black-box proof-of-work** written before any implementation exists. They assert what a user would observe in the product if the feature were complete. Red means the work is not done. Green means it is proven.

Two complementary layers form each milestone's proof:

**Interface-level tests** assert the user-visible outcome in the product's interface medium. The medium comes from `docs/design-system.md`'s interface track — never hardcode an assumption:
- `graphical-ui` — a browser-driven test that navigates to the feature and verifies what the user sees
- `cli` — a test that invokes the command and verifies the output, exit code, or side-effect
- `agentic-protocol` — a test that sends a protocol request and verifies the response structure

**API-level system tests** exercise the running services end-to-end over HTTP. When an interface test goes red, the API test localizes the failure: frontend problem vs API problem. They use the shared service-discovery fixtures from `tests/conftest.py`.

Slice tests prove the vertical capability a slice contributes toward its parent milestone. They are **informed by and bounded by** the parent milestone's tests — a slice test proves a specific capability; the milestone test proves the user-visible outcome those capabilities enable.

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
Where `<N>` is the slice number within the milestone, `<service>` is the owning service name (from `docs/infrastructure.md`), and `<slice-slug>` is the kebab-case slice name.

**Archive path (Phase 5 — after delivery):**
```
tests/bets/_archive/<bet-slug>/
```

---

## Fixtures and service discovery

Bet-progress tests reuse the shared fixtures from `tests/conftest.py`:
- `cluster` — boots and health-checks all services; provides the running topology
- `api_client` — an HTTP client configured with the discovered service base URLs
- `pure_state_reset` — truncates all service data stores before each test (autouse)
- `frontend_base_url` — the base URL of the graphical-ui service, if the project has one

Declare the fixtures you need as test-function parameters; pytest resolves them from the parent conftest automatically.

For interface-level tests against a `graphical-ui` project, the `page` fixture (from pytest-playwright) drives a real browser. For `cli` projects, use `subprocess` or `pexpect` to invoke the binary directly.

---

## Placeholder structure for red tests

When the implementation does not exist yet, a test stub must be **explicitly red** — it must fail, not skip. Use the pattern appropriate to the test language:

- Python: `pytest.fail("bet-progress test not yet implemented — <describe target state>")`
- Go: `t.Fatal("bet-progress test not yet implemented — <describe target state>")`
- TypeScript: `throw new Error("bet-progress test not yet implemented — <describe target state>")`

Comment the stub with the two layers it will eventually assert, so the Delivery agent knows exactly what to implement:
```
# Layer 1 — interface: [what the user should observe in the product]
# Layer 2 — API: [what the service should return end-to-end over HTTP]
```

---

## What makes a good bet-progress test

A bet-progress test is good when:
- It asserts a **falsifiable, user-visible outcome** — not an internal state
- It would fail if the feature shipped incomplete
- It would pass without any special knowledge of how the feature is implemented internally
- A reviewer can read it and confirm it matches the milestone's acceptance criteria in `decomposition.md`
