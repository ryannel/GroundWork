# Decomposition: [Bet Name]

*This document defines the order of work for this bet and serves as the reviewable record of the decomposition decisions. The runnable bet-progress tests (the actual proof of work) live alongside this document under `tests/bets/<bet-slug>/`. This document links to those test files and explains the sequencing reasoning a reviewer needs to verify the breakdown is sound.*

*Milestone typing (`Type:`), the capability milestone's `Consumer:` line, and the slice `Surface:` field apply only when the project carries a surface registry (`docs/surfaces.md`). With no registry, omit all three — milestones are user-visible states in the product's single interface medium, exactly as before.*

---

## Test Plan

This bet uses two populations of tests with distinct lifecycles:

**Bet-progress tests** (`tests/bets/<bet-slug>/`) — written red, up front, during this Decomposition phase. One file per milestone and one file per slice. These are the single source of truth for "is this milestone/slice done?" Red means work to do; green means proven. Archived to `tests/bets/_archive/<bet-slug>/` when the bet is delivered.

**Permanent best-practice tests** (service repos / `tests/system/`) — written during Delivery as each slice completes. Interface tests, HTTP API system tests, service-perimeter tests, and unit tests for complex logic. These remain in the codebase permanently and are what covers the feature after the bet-progress tests are archived.

---

## Milestone Map

### Milestone 1: [Milestone Name]

**Type:** capability

**Consumer:** [who exercises this contract — the bet's in-scope surfaces that build on it in later milestones, or the latent agentic surface for a headless delivery]

**Demonstrable goal:** [the contract behaviour provable end-to-end against the running services (or the embedded core's public API) when this milestone is complete — curl-able, scriptable, observable]

**Why this comes first:** [sequencing rationale — a bet introducing new capability opens with its capability milestone, because every surface milestone consumes the contract it proves]

**Acceptance criteria:**
- [ ] [specific, falsifiable criterion at the contract — e.g. "POST to the endpoint returns 202 and the record is queryable within 2 seconds"]
- [ ] [specific, falsifiable criterion]

**Milestone test file:** `tests/bets/<bet-slug>/test_milestone_1_<milestone-slug>.<ext>`

---

#### Slice 1.1: [Slice Name]

**Owner service:** [service name from `docs/infrastructure.md`]

**Surface:** core | [surface-slug from `docs/surfaces.md`]

**Complexity:** S / M / L

**Prerequisite:** (none, or "Slice 1.N merged")

[One paragraph linking this slice to Milestone 1 — what vertical capability it contributes and how that capability demonstrably moves the milestone forward.]

**Required Capabilities:**
- [Falsifiable capability statement tracing to a contract/schema in `technical-design.md`]
- [Falsifiable capability statement]

**Test Cases:**

| Test | Location | Assertion |
|------|----------|-----------|
| [test description] | `tests/bets/<bet-slug>/test_slice_1_<service>_<slice-slug>.<ext>` | [specific, falsifiable assertion] |

---

*(Add a Slice section for each slice under Milestone 1)*

---

### Milestone 2: [Milestone Name]

**Type:** surface ([surface-slug])

**User-visible goal:** [what a user of this surface can demonstrably do or observe — in that surface's medium, bounded to wiring, rendering, and interaction]

**Why this comes after Milestone 1:** [sequencing rationale — surface milestones depend on the capability milestone whose contract they wire; this milestone's tests never re-prove the rules Milestone 1 settled]

**Acceptance criteria:**
- [ ] [specific, falsifiable criterion in this surface's medium]

**Milestone test file:** `tests/bets/<bet-slug>/test_milestone_2_<milestone-slug>.<ext>`

---

#### Slice 2.1: [Slice Name]

**Owner service:** [service name]

**Surface:** [surface-slug]

**Complexity:** S / M / L

**Prerequisite:** (Milestone 1 delivered, or "Slice 2.N merged")

[One paragraph linking this slice to Milestone 2.]

**Required Capabilities:**
- [Falsifiable capability statement]

**Test Cases:**

| Test | Location | Assertion |
|------|----------|-----------|
| [test description] | `tests/bets/<bet-slug>/test_slice_2_<service>_<slice-slug>.<ext>` | [specific, falsifiable assertion] |

---

*(Add a Slice section for each slice under Milestone 2. Repeat the Milestone block for every milestone in this bet — 2–5 milestones is the healthy range. A bet may legitimately end at the capability milestone with every surface milestone deferred — a headless delivery; validation records the deferral in the capability ledger.)*

---

## Document Chain Integrity

Before the Decomposition gate, verify the chain is intact:

| Document | Upstream check | Downstream check |
|----------|---------------|-----------------|
| Pitch | Solves the stated problem within appetite | Design covers the pitched solution |
| Technical Design | Every interface element/flow traces to the pitch | Milestones can be derived from it |
| Milestones | Each goal is consumer-visible value — at the contract (capability) or in the surface's medium (surface) — traceable to the design | Every slice belongs to exactly one milestone |
| Slices | Capabilities trace to contracts/schemas in `technical-design.md` | Test cases trace to milestone acceptance criteria |
