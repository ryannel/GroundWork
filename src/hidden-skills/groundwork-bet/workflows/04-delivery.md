# Phase 4: Delivery

**Goal:** Turn bet-progress tests green, slice by slice, while rolling out permanent best-practice tests as each slice completes — and leave a delivery record behind that the next slice, the validation phase, and the next bet can learn from.

## Restrictions

⚠️ **CRITICAL CONSTRAINT — the suite is sealed.** The bet-progress tests in `tests/bets/<bet-slug>/` were reviewed assertion-by-assertion and signed by the user; they are the bet's fixed definition of done. Never edit, delete, or add to them during delivery — a red test that looks wrong is a stop-and-escalate through the Amendment Protocol below, not an edit. `./dev test bet` verifies the suite against `.groundwork/bets/<bet-slug>/test-manifest.json` and refuses a tampered suite.

⚠️ **CRITICAL CONSTRAINT — scope.** Write only the code required to make the bet-progress tests pass and satisfy the contracts in `docs/bets/<bet-slug>/contracts/`. Stay within the milestones and slices in `decomposition.md`. Do not perform large refactors or touch unrelated subsystems. If reality contradicts the locked design, follow Change Navigation below.

## Operating Contract

This workflow operates under the protocols defined in `.agents/groundwork/skills/operating-contract.md` (contract v1; Continuous Bet mode). Implementation rarely surfaces phase-crossing signals — but when it does, capture it under the matching section in `.groundwork/cache/discovery-notes.md` and continue. The full Living Documents scan happens in Validation (Phase 5). Do not interrupt delivery to apply upstream updates mid-flight.

## Step 0: Implementation Readiness Gate

Before any slice work, verify the bet is actually executable. Load `.agents/groundwork/skills/groundwork-review/checklists/implementation-readiness.md` and check every item against the bet's artifacts — the document chain, the contracts, the test scaffolding, and currency. If the checklist file is absent, stop and report it — the install is broken and `npx groundwork-method update` restores it; do not improvise the gate from memory. These are mechanical existence and consistency checks; run them inline (no review subagent — the artifacts were already authorship-gated when their phases committed them, and there is nothing here to be biased about).

The gate is fail-closed: any 🔴 item blocks delivery. Report each failed item by name with what is missing, route back to the owning phase (a missing contract → Design Foundations; missing tests or an unsigned suite → Decomposition; an unreconciled discovery note → resolve it with the user now), and do not begin implementation until the item passes. 🟡 items are surfaced to the user with your read on whether they touch this bet; the user decides whether to proceed.

When every 🔴 item passes, state so in one line, update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: delivery`, and inform the user you are entering Developer Mode.

The scaffold and the `./dev` CLI are a starting point you keep shaping as the product grows. When a repeated delivery task earns it, or shipped tooling does not fit the work, adapt the tooling rather than scripting around it — add a project command under `.dev/commands/`, register a runner, or extend the relevant scaffold. Never leave a shipped command inert and never build a parallel tool beside it (the *no empty capabilities* rule, `docs/principles/delivery/day-2-operational-baseline.md`).

## The Slice Loop

Work through the milestone order in `decomposition.md`, slice by slice. Each slice runs the same loop; the manifest at `.groundwork/bets/<bet-slug>/decomposition.json` records where the loop stands, so a fresh context resumes from the manifest instead of re-deriving progress.

When the decomposition types its slices (`surface: core` or a surface slug — registry projects), core slices merge before the surface slices that consume them. A surface slice wires a contract that must already be proven green, not one being built beneath it in parallel — the milestone order already encodes this (the capability milestone opens the bet); hold it at slice granularity too.

The slice context capsule for a surface slice includes the capability milestone's test file — the contract proof the slice builds on. Reading those green assertions tells the surface slice exactly what the core guarantees, so its own work stays bounded to wiring, rendering, and interaction instead of re-deriving core behaviour.

### 1. Assemble the slice context capsule

Most implementation failures are context failures — the agent that breaks an existing behaviour usually never read the file it was changing. Before writing any code for a slice:

- **Read the previous slice's record** in `decomposition.json` (`files`, `notes`) — the patterns it established, the review findings it ate, the approaches that worked. Repeat its lessons, not its mistakes.
- **Read every existing file this slice modifies, in full.** For each, hold three things: what it does today, what this slice changes, and what must keep working. A slice must leave the system working end-to-end — behaviour required for the feature to work correctly is a requirement whether or not the decomposition spells it out.
- **Scan recent git history** for the conventions in play — naming, error handling, test placement — so the slice reads like the codebase it lands in.
- **Verify library specifics just-in-time** when the slice pins behaviour on a dependency — current API shape and breaking changes, from the web when training knowledge is likely stale.

### 2. Open the slice

Mark the slice `in-progress` in `decomposition.json` and record `baseline_commit` (`git rev-parse HEAD`). The baseline ties the slice's diff to the exact code state it was built against.

### 3. Implement to green

Run the slice's bet-progress tests (`tests/bets/<bet-slug>/test_slice_<n>_*`) — red, because the implementation does not exist. Implement until they pass, staying inside the contracts: generate or derive clients from `docs/bets/<bet-slug>/contracts/` for cross-service calls; a hand-written request shape or side-channel schema is a contract violation even when the test passes.

### 4. Review the slice

Dispatch the slice diff for review through three parallel, independent lenses (Protocol 9 mechanics — isolated subagents; the three lenses catch different failure classes and none substitutes for another):

- **Blind reviewer** — receives only the diff, no bet context. Familiarity hides bugs; this lens has none.
- **Edge-case tracer** — receives the diff plus repo read access. Walks every branch and boundary the diff introduces and reports only unhandled paths: null/empty inputs, failure timing, races, off-by-ones.
- **Acceptance auditor** — receives the diff, the slice's Required Capabilities, and `contracts/`. Verifies the implementation does what the contract says and nothing more: undeclared endpoints, fields beyond the spec, and silently skipped error cases are findings even when tests pass.

**Triage every finding** into exactly one bucket, deduplicating across lenses:

| Bucket | Meaning | Handling |
|---|---|---|
| decision-needed | A real choice the design does not settle | Blocks the slice — put it to the user now |
| patch | Unambiguous fix within the slice's scope | Fix before closing the slice |
| defer | Real, but pre-existing — not caused by this slice | Append as a row to `docs/maturity.md` with severity; do not fix mid-slice |
| dismiss | False positive or noise | Drop; do not persist |

A slice closes only with zero open decision-needed and patch findings.

### 5. Roll out permanent tests

Once the slice's bet-progress tests are green and the review is clear, roll out that slice's **permanent best-practice tests** — interface tests, HTTP API system tests, honeycomb service-perimeter tests, and unit tests for complex logic, per the project's testing strategy. For a `graphical-ui` slice, this includes **component render tests** across the states the design system names — default, loading, empty, error, long-content — so a component that throws on a prop or state combination is caught in isolation before any page integrates it (the scaffold ships the pattern at `components/render-smoke.test.tsx`); and adding any new route to `tests/system/routes.json` so the permanent render-smoke, geometry, and a11y gates sweep it. These live in the service repos and `tests/system/`, not in `tests/bets/`, and stay in the codebase after the bet is archived.

### 6. Record and close the slice

Update the slice's manifest entry: `status: delivered`, `delivered_commit`, `files` (every file added, modified, or deleted, repo-relative), and `notes` — one or two sentences on what the next slice should know: a pattern established, a deviation taken and why, a struggle worth not repeating. The record is what makes Step 1's capsule and Validation's retrospective possible; an empty `notes` field on a slice that fought you is a record that lies.

### Milestone close

After all of a milestone's slices are delivered, run the milestone's bet-progress tests (`test_milestone_<n>_*`) to confirm the milestone's full demonstrable outcome, then mark the milestone `delivered` in the manifest. `./dev bet status` renders the board from the manifest at any point — keep it true.

**Visual verification — graphical surface milestones only.** A behavioural test asserting a selector exists passes while the rendered page is blank, throwing, unstyled, or showing an error-boundary fallback — the bug class assertion tests cannot see. Before a milestone that closed a `graphical-ui` surface is marked `delivered`, run the ladder against the *running* app; skip this entirely for `core`/`cli`/`agentic-protocol` milestones, which pay nothing.

1. **Tier 1 — the deterministic floor is green.** The permanent `tests/system/test_render_smoke.py`, `test_a11y_smoke.py`, and `test_token_conformance.py` run as part of the suite: navigation returns 2xx/3xx, zero `error`-level console output, zero uncaught exceptions, no failed same-origin requests, no error overlay, a non-blank render across the viewport × theme matrix, the axe gate at the design system's accessibility baseline, and — the new layer — the specified atmosphere actually landed (surface treatments render with backdrop blur and multi-layer elevation, the projected tokens resolve, no degradation to a flat default). A red layer blocks the milestone — it is a real defect, not a flaky test.
2. **Tier 2 — confirm the build matches the micro-polish spec.** Read the screenshots Tier 1 captured (`.groundwork/cache/visual/_smoke/<surface>/<route>__<viewport>__<theme>.png`, plus any per-state captures written by interface tests to `.groundwork/cache/visual/<bet-slug>/<surface>/<state>.png`). Adopt the designer persona (`.agents/groundwork/skills/groundwork-designer/SKILL.md`, reference `design-review.md`) and judge each screen against the **per-surface micro-polish spec** in `technical-design.md` and the design system. The question is conformance to the written spec, not "is it as good as a leader": did the specified surface treatment, motion, elevation, and type tokens land; do empty/loading/error states read as designed rather than as a failure; and — the dimensions Tier 1 cannot compute — is alignment optically correct, is the atmosphere restrained, does the composition read as considered? Surface what diverges from the spec; do not recite a fixed checklist. Record a one-line spec-conformance verdict per screen in the milestone's manifest notes — a milestone cannot close without it.

A coherence defect the inspection spots is fixed in this same delivery phase, where it is cheapest. A finding genuinely deferred is logged as a discovery note or a `docs/maturity.md` row, never silently dropped. Tier 1 asserts the tokens landed; this Tier-2 judgement covers what computation cannot — optical alignment, restraint, and whether the whole reads as considered against the spec.

## Amendment Protocol — when a sealed test is wrong

A signed test can still be wrong: it can assert a shape the contract never defined, encode a misread capability, or fail for a reason no implementation can fix. The seal does not make the test right — it makes changing it a decision the user takes, not a convenience the implementing agent reaches for.

1. **Stop work on the affected slice.** Do not edit the test, and do not implement toward an assertion you believe is wrong.
2. **State the case:** what the test asserts, what you believe it should assert, and which artifact is the source of the error — the test alone, or the contract/design behind it.
3. **Route by depth.** A wrong test against a correct contract is a test amendment: on the user's explicit approval, fix the test, re-render its `test-review.md` entry, and re-seal (`./dev bet sign <bet-slug> --amend`, or rewrite the manifest hashes directly). A wrong contract is deeper — follow Change Navigation below.
4. **Record the amendment** in the slice's `notes` so Validation's retrospective sees how the suite moved after signing.

## Change Navigation — when reality contradicts the locked design

Mid-delivery discoveries that invalidate the design are not failures of the process; pushing through them silently is. When implementation reveals the design committed to something wrong:

1. **Pause the slice** and write a change proposal at `docs/bets/<bet-slug>/change-proposal-<n>.md` using the template at `.agents/groundwork/skills/groundwork-bet/templates/change-proposal.md`: the discovery and its evidence, the impact across pitch / technical design / contracts / decomposition / signed tests (name each affected section), the before/after of every proposed edit, and the severity.
2. **Route by severity.** *Minor* — contracts and milestones survive; specific tests and design sections need correction: on user approval, apply the edits, re-review mutated docs (Protocol 9), amend and re-seal affected tests, resume the slice. *Structural* — a contract, milestone, or the appetite itself is wrong: on user approval, revert to Design Foundations (`status: design`), rework the design with the proposal as input, and re-run Decomposition for the affected scope; unaffected delivered slices stand.
3. The proposal stays in the bet directory either way — it is the audit trail Validation and the retrospective read.

## Transition

Once all bet-progress tests are green, every slice's manifest entry is `delivered` with its record filled, and the permanent best-practice tests for every slice are in place, you are ready for validation.

➡️ Read and follow: `.agents/groundwork/skills/groundwork-bet/workflows/05-validation.md`
