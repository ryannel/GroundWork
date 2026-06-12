---
name: decomposition-checklist
description: >
  Type-specific failure modes for reviewing a bet's decomposition — the
  milestone map, slice specs, and test plan the bet executes against.
---

# Decomposition Checklist

This checklist checks a draft `docs/bets/<slug>/decomposition.md`. It answers one question:
**does every milestone name user-visible value, every slice cut vertically, and every capability
trace to the technical design with a falsifiable test?**

Each item names a violation. Match it against the document text and
`docs/bets/<slug>/technical-design.md`. Bet documents carry no `## Summary for Downstream` — do
not flag its absence.

## Milestone Shape

- [ ] 🔴 **Horizontal milestone**: a milestone names a layer of the stack ("Backend", "Build all
  the schemas", "Integration") rather than a demonstrable state in the product's interface — it
  is invisible to the user and proves nothing end-to-end.
- [ ] 🔴 **Goal not traceable to the Interface Design**: a milestone's user-visible goal
  corresponds to nothing in the Interface Design section of `technical-design.md` — the
  milestone proves something the design never committed to.
- [ ] 🔴 **No acceptance criteria**: a milestone carries no concrete, observable acceptance
  criteria a reviewer could check against the running product.
- [ ] 🟡 **No sequencing rationale**: a milestone does not state why it sits where it does — what
  the first milestone proves architecturally, why the next can only follow it.
- [ ] 🟡 **Milestone count outside 2–5**: one milestone suggests the bet is not scoped in
  user-visible increments; six or more suggests it is a roadmap, not a bet.

## Slice Verticality

- [ ] 🔴 **Horizontal slice**: a slice is a horizontal pass ("all schemas", "all APIs", "all UI")
  rather than a vertical column delivering a testable capability end-to-end.
- [ ] 🔴 **Slice that needs the future**: a slice cannot be deployed and verified without a later
  slice existing — it fails the vertical-slice test and must be merged up or reframed.
- [ ] 🟡 **Orphan slice or empty milestone**: a slice belongs to no milestone, or a milestone
  decomposes into no slices.
- [ ] 🟡 **Anatomy incomplete**: a slice spec is missing one of its six parts — Owner service,
  Complexity (S/M/L), Prerequisite, one-paragraph intro, Required Capabilities, Test Cases
  table.
- [ ] 🟡 **Vague prerequisite**: a prerequisite does not name the exact prior merge gate (e.g.
  "Slice 1.2 merged") — "after the backend work" sequences nothing.

## Capabilities and Tests

- [ ] 🔴 **Unfalsifiable capability**: a Required Capability cannot fail — "The endpoint exists"
  is not falsifiable; "POST `/api/sessions` returns 201 with a `session_id` field when given a
  valid request body matching the API contract" is.
- [ ] 🔴 **Capability without a contract anchor**: a Required Capability traces to no contract or
  schema section in `technical-design.md` — the slice commits to behaviour the design never
  specified.
- [ ] 🔴 **Missing test file link**: a milestone or slice has no linked bet-progress test file at
  `tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.<ext>` or
  `tests/bets/<bet-slug>/test_slice_<N>_<service>_<slice-slug>.<ext>`.
- [ ] 🟡 **Assertion-free test case**: a Test Cases table row lacks a specific, falsifiable
  assertion — "verify it works" gives the reviewer nothing to check against the milestone's
  acceptance criteria.
- [ ] 🟡 **Test Plan header missing**: the document does not open with the Test Plan header
  describing the two test populations and their lifecycles.

## Test Semantics

Open the actual test files — these checks cannot be made from the decomposition document alone.
A structurally perfect suite that asserts the wrong things sends Delivery to the wrong
destination with a green light.

- [ ] 🔴 **Assertion does not match the capability**: a test's assertion proves something other
  than the Required Capability it is linked to — the capability says 202-and-idempotent, the
  test asserts 200-and-exists. Delivery will satisfy the test and miss the capability.
- [ ] 🔴 **Shape not in the spec**: a test hand-rolls a request body, response field, or table
  shape that `docs/bets/<slug>/contracts/` does not define — the test is asserting a contract
  that does not exist.
- [ ] 🔴 **Tautological test**: a test that cannot fail once any implementation exists — asserting
  a response is received without asserting its content, or catching the failure it should
  surface.
- [ ] 🔴 **White-box assertion**: a bet-progress test imports application code, mocks internals,
  or asserts module structure — these tests are black-box proof at the interface and API level
  only.
- [ ] 🔴 **Red for the wrong reason**: a test fails on an import error, fixture error, or typo
  rather than on the feature's absence — it will not flip green when the feature works.
- [ ] 🟡 **Error path untested**: a capability whose contract defines error cases has tests only
  for the happy path — the error contract ships unverified.
- [ ] 🟡 **Test-review surface stale or incomplete**: `docs/bets/<slug>/test-review.md` is missing
  an entry for a test function, or quotes an assertion block that no longer matches the file.

## Chain Integrity

The Document Chain Integrity table in the decomposition workflow defines the full chain; these
are its decomposition-side checks.

- [ ] 🔴 **Design not covered**: a contract, flow, or interface element in `technical-design.md`
  maps to no milestone or slice and is not explicitly cut — the bet will end with designed
  behaviour nobody built.
- [ ] 🔴 **Scope beyond the design**: a milestone or slice delivers behaviour
  `technical-design.md` never specified — decomposition has silently grown the bet.
- [ ] 🟡 **Test outside the acceptance criteria**: a slice's test cases assert behaviour that
  traces to no milestone acceptance criterion — proof of work the milestone never asked for.
