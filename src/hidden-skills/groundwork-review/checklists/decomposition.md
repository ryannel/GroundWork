---
name: decomposition-checklist
description: >
  Type-specific failure modes for reviewing a bet's decomposition — the
  milestone map, slice specs, and prose proofs the bet executes against.
---

# Decomposition Checklist

This checklist checks a bet's decomposition tree under `docs/bets/<slug>/decomposition/`. It
answers one question: **does every milestone name consumer-visible value — proven once at the
contract, then per surface — every slice cut vertically, and every capability trace to the
technical design with a falsifiable prose proof?**

Each item names a violation. Match it against the tree's milestone `index.md` and slice files and
the design under `docs/bets/<slug>/technical-design/`. Bet documents carry no Downstream Context
file and no summary section — do not flag the absence of either.

**Two-gate split:** Proof-of-work *authorship* — does the prose prove the right thing — is judged
here, at this review. Whether that same prose still exists, is current, and is mutually
consistent immediately before delivery starts is `checklists/implementation-readiness.md`'s job,
not a re-review of authorship.

## Milestone Shape

- [ ] 🔴 **Horizontal milestone**: a milestone names a layer of the stack ("Backend", "Build all
  the schemas", "Integration") rather than a demonstrable state in the product's interface — it
  is invisible to the user and proves nothing end-to-end.
- [ ] 🔴 **Goal not traceable to the design**: a milestone's goal corresponds to nothing in
  `technical-design/` — a surface milestone's user-visible goal traces to no UI Design
  subsection, or a capability milestone's contract state traces to no API Design interface or
  Schema & Data Design store. The milestone proves something the design never committed to.
- [ ] 🔴 **No acceptance criteria**: a milestone carries no concrete, observable acceptance
  criteria a reviewer could check against the running product.
- [ ] 🟡 **No sequencing rationale**: a milestone does not state why it sits where it does — what
  the first milestone proves architecturally, why the next can only follow it.
- [ ] 🟡 **Milestone count outside 2–5**: one milestone suggests the bet is not scoped in
  user-visible increments; six or more suggests it is a roadmap, not a bet. Exception: a
  headless delivery legitimately carries a single capability milestone with every surface
  milestone deferred — when the pitch's surface no-gos say so, do not flag it. Exception: a
  **quick bet** (`track: quick` in the pitch) is *defined* as a single milestone — never flag a
  one-milestone count for it; two or more milestones is instead the signal it should have been a
  full bet.

## Milestone and Slice Typing

These items apply only when the project carries a surface registry (`docs/surfaces.md`). A
project with no registry decomposes against its single implicit surface — untyped milestones,
no slice `Surface` field — and none of these items fire.

- [ ] 🔴 **Milestone untyped or mistyped**: a milestone carries no `Type:`, or its type
  contradicts its content — a milestone whose demonstrable state is a contract exercised
  headless is a capability milestone; one asserting in a surface's medium is a surface
  milestone, and the surface slug it names must exist in the registry.
- [ ] 🔴 **Capability proof not first**: the bet introduces new capability but does not open
  with the capability milestone proving it at the contract — surface milestones are sequenced
  before the contract proof they depend on.
- [ ] 🔴 **Surface milestone asserting business outcomes**: a surface milestone's goal or
  acceptance criteria assert business rules rather than wiring, rendering, and interaction —
  the milestone is re-litigating what the capability milestone proves at the contract.
- [ ] 🟡 **Consumer unnamed**: a capability milestone does not record who its consumer is — the
  in-scope surfaces that build on it, or the latent agentic surface for a headless delivery.
- [ ] 🔴 **Slice surface missing or invalid**: a slice file carries no `Surface` field, or its
  value is neither `core` nor a registry slug — delivery cannot sequence core-before-surface, and
  the slice's test discipline is undeclared.

## Slice Verticality

- [ ] 🔴 **Horizontal slice**: a slice is a horizontal pass ("all schemas", "all APIs", "all UI")
  rather than a vertical column delivering a testable capability end-to-end.
- [ ] 🔴 **Slice that needs the future**: a slice cannot be deployed and verified without a later
  slice existing — it fails the vertical-slice test and must be merged up or reframed.
- [ ] 🟡 **Orphan slice or empty milestone**: a slice belongs to no milestone, or a milestone
  decomposes into no slices.
- [ ] 🟡 **Anatomy incomplete**: a slice file is missing one of its parts — Owner service,
  Surface (`core` or a registry slug; registry projects only), Complexity (S/M/L),
  Prerequisite, Scope (one-paragraph intro plus Required Capabilities), Design, Proof of work.
- [ ] 🟡 **Vague prerequisite**: a prerequisite does not name the exact prior merge gate (e.g.
  "Slice 1.2 merged") — "after the backend work" sequences nothing.

## Capabilities and Proofs

- [ ] 🔴 **Unfalsifiable capability**: a Required Capability cannot fail — "The endpoint exists"
  is not falsifiable; "POST `/api/sessions` returns 201 with a `session_id` field when given a
  valid request body matching the API design" is.
- [ ] 🔴 **Capability without a design anchor**: a Required Capability traces to no interface in
  `technical-design/03-api-design.md` or store in `04-data-design.md` — the slice commits to
  behaviour the design never specified.
- [ ] 🔴 **Missing test file link**: a milestone `index.md` or slice file names no `Test file:`
  path in its Proof of work at `tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.<ext>`
  or `tests/bets/<bet-slug>/test_slice_<N>_<service>_<slice-slug>.<ext>`. The path is named at
  decomposition; Delivery materializes the red stub from it.
- [ ] 🟡 **Proof without an observable condition**: a Proof of work's `How we prove it` states no
  specific, falsifiable observation — "verify it works" gives the reviewer nothing to check
  against the milestone's acceptance criteria.
- [ ] 🔴 **Decomposition tree incomplete**: the tree is missing a piece — `meta.json`, a milestone
  `index.md`, or a slice file the milestone links — so the bet has no complete plan to execute
  against.

## Proof Semantics

Tests do not exist at decomposition — they are materialized red at Delivery start (Step 0.5)
from this approved prose. So these checks read the **Proof of work** prose, not test code: a
proof that describes the wrong thing sends Delivery to the wrong destination with a green light.
The purely code-level failures are enforced at Delivery — Step 0.5 confirms each materialized
stub is red for the feature's absence, and Step 4's honest-green reconciliation catches
white-box assertions and gamed implementations — so here the review checks the prose.

- [ ] 🔴 **Proof does not match the capability**: a Proof of work proves something other than the
  Required Capability it rests on — the capability says 202-and-idempotent, the proof shows
  200-and-exists. Delivery will satisfy the proof and miss the capability.
- [ ] 🔴 **Shape not in the prose design**: a proof references a request body, response field, or
  table shape that `technical-design/03-api-design.md` / `04-data-design.md` does not define — the
  proof rests on a contract that does not exist.
- [ ] 🔴 **Tautological proof**: a Proof of work that cannot fail once any implementation exists —
  observing that a response is received without observing its content, or describing the failure
  it should surface as the success it checks for.
- [ ] 🔴 **Core logic re-proven at a surface**: a surface milestone's or surface slice's Proof of
  work re-asserts a business rule the capability milestone already proves at the contract —
  prove-once is the principle that keeps surface count from multiplying the test pyramid; surface
  proofs cover wiring, rendering, and interaction only. (Registry projects only; an untyped
  decomposition pairs interface and API layers per milestone as before.)
- [ ] 🟡 **Headline error case missing**: a milestone whose demonstrable outcome depends on an
  error case (e.g. the dependency being unavailable) proves only the happy path. Exhaustive
  error-matrix coverage is not expected here — it lands in Delivery's permanent tests — but an
  error the milestone's proof rests on belongs in the headline Proof of work.
- [ ] 🟡 **Proof of work missing or stale**: a milestone `index.md` or slice file in
  `decomposition/` lacks its Proof of work, or its proof no longer matches the design or the
  Required Capability it rests on — the user would approve a definition of done that drifted from
  what the bet builds.

## Chain Integrity

The Document Chain Integrity table in the decomposition workflow defines the full chain; these
are its decomposition-side checks.

- [ ] 🔴 **Design not covered**: a contract, flow, or interface element in `technical-design/`
  maps to no milestone or slice and is not explicitly cut — the bet will end with designed
  behaviour nobody built.
- [ ] 🔴 **Scope beyond the design**: a milestone or slice delivers behaviour the
  `technical-design/` never specified — decomposition has silently grown the bet.
- [ ] 🟡 **Proof outside the acceptance criteria**: a slice's Proof of work proves behaviour that
  traces to no milestone acceptance criterion — proof of work the milestone never asked for.
