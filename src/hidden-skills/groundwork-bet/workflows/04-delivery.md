# Phase 4: Delivery

**Goal:** Turn bet-progress tests green, slice by slice, while rolling out permanent best-practice tests as each slice completes — and leave a delivery record behind that the next slice, the validation phase, and the next bet can learn from.

## Restrictions

⚠️ **CRITICAL CONSTRAINT — the approved prose is the fixed definition of done.** The decomposition tree (`docs/bets/<bet-slug>/decomposition/`) and the technical design were reviewed proof by proof, at assertion-grade scrutiny, approved by the user, and sealed at the `bet/<bet-slug>/approved` git tag. That **prose** is frozen — Delivery builds *against* it, never edits it. The tests and the implementation are *built* this phase: Step 0.5 materializes the red board from the approved Proof-of-work prose, and the slice loop turns it green. What is forbidden is changing the approved prose contract: a Proof-of-work proof that looks wrong is a stop-and-escalate through the Amendment Protocol below, not a quiet prose edit. The seal holds because the prose is under git from the tag forward — any change to it shows in `git diff bet/<bet-slug>/approved.. -- docs/bets/<bet-slug>/` and is checked by the prose-integrity reconciliation in Step 4. A prose change that did not route through an approved amendment is a delivery defect.

⚠️ **CRITICAL CONSTRAINT — scope.** Write only the code required to make the bet-progress tests green and satisfy the API and data design in `docs/bets/<bet-slug>/technical-design/`. Stay within the milestones and slices in the decomposition tree. Do not perform large refactors or touch unrelated subsystems. If reality contradicts the locked design, follow Change Navigation below.

## Operating Contract

This workflow operates under the protocols defined in `.groundwork/skills/operating-contract.md` (contract v1; Continuous Bet mode). Implementation rarely surfaces phase-crossing signals — but when it does, capture it under the matching section in `.groundwork/cache/discovery-notes.md` and continue. The full Living Documents scan happens in Validation (Phase 5). Do not interrupt delivery to apply upstream updates mid-flight.

## Step 0: Implementation Readiness Gate

Before any slice work, verify the bet is actually executable. Load `.groundwork/skills/groundwork-review/checklists/implementation-readiness.md` and check every item against the bet's artifacts — the document chain, the API and data design, the approval tag, and currency. If the checklist file is absent, stop and report it — the install is broken and `npx groundwork-method update` restores it; do not improvise the gate from memory. These are mechanical existence and consistency checks; run them inline (no review subagent — the artifacts were already authorship-gated when their phases committed them, and there is nothing here to be biased about).

The gate is fail-closed: any 🔴 item blocks delivery. Report each failed item by name with what is missing, route back to the owning phase (a missing interface design → Design Foundations; an absent approval tag or incomplete decomposition tree → Decomposition; an unreconciled discovery note → resolve it with the user now), and do not begin implementation until the item passes. 🟡 items are surfaced to the user with your read on whether they touch this bet; the user decides whether to proceed.

When every 🔴 item passes, state so in one line, update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: delivery`, and inform the user you are entering Developer Mode.

## Step 0.5: Materialize the red board

The approved decomposition is prose; Delivery's first act is to render it into the runnable red board it tracks progress against. From the approved Proof-of-work prose, generate one red stub per milestone and per slice — the board the rest of this phase turns green.

For each milestone `index.md` and each slice file under `docs/bets/<bet-slug>/decomposition/`, materialize its named `Test file:` as a red stub that fails explicitly (never skips), commenting the stub with what the Proof-of-work prose says it must eventually assert so the slice loop knows exactly what to implement. Discover the project's test language and service names from the scaffold (`docs/infrastructure.md`, the generated `docker-compose.yml`) — never assume. Use `./dev new milestone <bet-slug> <milestone-slug>` and `./dev new slice <bet-slug> <milestone-slug> <service> <slice-slug>` when they exist to scaffold the stubs at the correct paths; write the files directly otherwise. Either way the paths match the prose exactly:

```
tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.<ext>
tests/bets/<bet-slug>/test_slice_<N>_<service>_<slice-slug>.<ext>
```

Consult `.groundwork/skills/groundwork-bet/templates/bet-progress-test.md` for the placeholder pattern and quality criteria. Run the suite once and confirm **every stub is red** — red because the implementation does not exist, not because of an import or fixture error. That red board is the bet's live progress display: `./dev bet status` reads it, and red→green is "see how far we've come." Commit the red board (e.g. `bet(<bet-slug>): materialize red board`) before opening the first slice — it is the build artifact the slice loop fills in, generated *from* the sealed prose and free to change, never the tamper target.

The scaffold and the `./dev` CLI are a starting point you keep shaping as the product grows. When a repeated delivery task earns it, or shipped tooling does not fit the work, adapt the tooling rather than scripting around it — add a project command under `.dev/commands/`, register a runner, or extend the relevant scaffold. Never leave a shipped command inert and never build a parallel tool beside it (the *no empty capabilities* rule, `docs/principles/delivery/day-2-operational-baseline.md`).

## The Slice Loop

Work through the milestone order in the decomposition tree, slice by slice. Each slice runs the same loop; there is no tracking file — the suite is the status and git is the record. A fresh context resumes by reading the board (`./dev bet status` renders red/green per milestone and slice from the suite) and the git log of delivery commits, not a manifest.

When the decomposition types its slices (`surface: core` or a surface slug — registry projects), core slices merge before the surface slices that consume them. A surface slice wires a contract that must already be proven green, not one being built beneath it in parallel — the milestone order already encodes this (the capability milestone opens the bet); hold it at slice granularity too.

The slice context capsule for a surface slice includes the capability milestone's test file — the contract proof the slice builds on. Reading those green assertions tells the surface slice exactly what the core guarantees, so its own work stays bounded to wiring, rendering, and interaction instead of re-deriving core behaviour.

### 1. Assemble the slice context capsule

Most implementation failures are context failures — the agent that breaks an existing behaviour usually never read the file it was changing. Before writing any code for a slice:

- **Read the previous slice's delivery commit** — its message (the files it touched, the notes it left for the next slice) and its diff. The patterns it established, the review findings it ate, the approaches that worked are all there. Repeat its lessons, not its mistakes.
- **Read every existing file this slice modifies, in full.** For each, hold three things: what it does today, what this slice changes, and what must keep working. A slice must leave the system working end-to-end — behaviour required for the feature to work correctly is a requirement whether or not the decomposition spells it out.
- **Scan recent git history** for the conventions in play — naming, error handling, test placement — so the slice reads like the codebase it lands in.
- **Verify library specifics just-in-time** when the slice pins behaviour on a dependency — current API shape and breaking changes, from the web when training knowledge is likely stale.

### 2. Open the slice

Note the slice's baseline commit (`git rev-parse HEAD`) — it ties the slice's diff to the exact code state it was built against, and is the reference the test-integrity check and the slice review read.

### 3. Implement to green

Run the slice's bet-progress tests (`tests/bets/<bet-slug>/test_slice_<n>_*`) — red, because the implementation does not exist. Implement until they pass, staying inside the design: build each interface to the shapes in `docs/bets/<bet-slug>/technical-design/03-api-design.md` and the stores in `04-data-design.md`, and generate the service's machine-readable contract (OpenAPI/AsyncAPI/proto) from the running code rather than hand-writing it. For a cross-service call, derive the client from the consumed service's canonical `docs/api/<service>/` contract; a hand-written request shape or side-channel schema is a design violation even when the test passes.

### 4. Review the slice

**First, reconcile against the approved prose (mechanical — no subagent).** A green suite proves nothing if the frozen prose was quietly altered or the implementation was gamed to pass. Two cheap checks catch both — and note the inversion from the sealed-up-front model: the test files are *built* this phase and are *supposed* to change; what is frozen is the prose.

- **Prose integrity.** The approved contract is the decomposition tree and the technical design, sealed at the `bet/<bet-slug>/approved` tag. Confirm it has not silently moved: `git diff bet/<bet-slug>/approved.. -- docs/bets/<bet-slug>/decomposition/ docs/bets/<bet-slug>/technical-design/` shows no change except an approved amendment (the Amendment Protocol's commit trail). A Proof-of-work proof, an acceptance criterion, or an API shape changed without that trail — a weakened proof, a dropped case, a loosened shape — is a `decision-needed` finding. (Most slices change no prose at all; then this is a one-line no-op.) The built test must also still honestly prove what its slice's Proof-of-work prose describes — a stub filled in to assert less than the prose promised is the same finding.
- **Honest green.** The implementation must satisfy the proof for the right reason. A return value hardcoded to the test's expected output, an input special-cased to the fixture, a `if TEST_MODE`-style branch, or a mocked-out unit of real work is a `decision-needed` finding even though the suite is green — *a weak suite that generated code passes is worse than no suite* (`docs/principles/foundations/testing.md`).

**Then dispatch the slice diff for review** through three parallel, independent lenses (Protocol 9 mechanics — isolated subagents; the three lenses catch different failure classes and none substitutes for another):

- **Blind reviewer** — receives only the diff, no bet context. Familiarity hides bugs; this lens has none.
- **Edge-case tracer** — receives the diff plus repo read access. Walks every branch and boundary the diff introduces and reports only unhandled paths: null/empty inputs, failure timing, races, off-by-ones.
- **Acceptance auditor** — receives the diff, the slice's Required Capabilities, and the prose API/data design (`technical-design/03-api-design.md`, `04-data-design.md`). Verifies the implementation does what the design says and nothing more — and that it does so honestly: the service's generated contract matches the prose shapes; undeclared endpoints, fields beyond the design, silently skipped error cases, and implementation gamed to the test (hardcoded returns, special-cased inputs, test-only branches) are findings even when tests pass.

**Triage every finding** into exactly one bucket, deduplicating across lenses and the reconciliation:

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

Commit the slice — that commit **is** the record. Use a structured message: a `bet(<bet-slug>): slice <N.M> <slice-slug>` subject, then a body listing every file added, modified, or deleted, and a `Notes:` line — one or two sentences on what the next slice should know: a pattern established, a deviation taken and why, a struggle worth not repeating. The commit is what makes Step 1's capsule and Validation's retrospective possible; an empty `Notes:` on a slice that fought you is a record that lies. The slice flips green on the board the moment its tests pass — no status field to maintain.

### Milestone close

After all of a milestone's slices are delivered, run the milestone's bet-progress tests (`test_milestone_<n>_*`) to confirm the milestone's full demonstrable outcome. The milestone shows green on the board (`./dev bet status`) once its proof passes — the board is derived from the suite, so there is nothing to mark.

**Visual verification — graphical surface milestones only.** A behavioural test asserting a selector exists passes while the rendered page is blank, throwing, unstyled, or showing an error-boundary fallback — the bug class assertion tests cannot see. Before a milestone that closed a `graphical-ui` surface is marked `delivered`, run the ladder against the *running* app; skip this entirely for `core`/`cli`/`agentic-protocol` milestones, which pay nothing.

1. **Tier 1 — the deterministic floor is green.** The permanent `tests/system/test_render_smoke.py`, `test_a11y_smoke.py`, and `test_token_conformance.py` run as part of the suite: navigation returns 2xx/3xx, zero `error`-level console output, zero uncaught exceptions, no failed same-origin requests, no error overlay, a non-blank render across the viewport × theme matrix, the axe gate at the design system's accessibility baseline, and — the new layer — the specified atmosphere actually landed (surface treatments render with backdrop blur and multi-layer elevation, the projected tokens resolve, no degradation to a flat default). A red layer blocks the milestone — it is a real defect, not a flaky test.
2. **Tier 2 — confirm the build matches the micro-polish spec.** Read the screenshots Tier 1 captured (`.groundwork/cache/visual/_smoke/<surface>/<route>__<viewport>__<theme>.png`, plus any per-state captures written by interface tests to `.groundwork/cache/visual/<bet-slug>/<surface>/<state>.png`). Adopt the designer persona (`.groundwork/skills/groundwork-designer/SKILL.md`, reference `design-review.md`) and judge each screen against the **per-surface micro-polish spec** in `technical-design/01-ui-design.md` and the design system. The question is conformance to the written spec, not "is it as good as a leader": did the specified surface treatment, motion, elevation, and type tokens land; do empty/loading/error states read as designed rather than as a failure; and — the dimensions Tier 1 cannot compute — is alignment optically correct, is the atmosphere restrained, does the composition read as considered? Surface what diverges from the spec; do not recite a fixed checklist. Record a one-line spec-conformance verdict per screen in the closing slice's commit message (a `Visual:` line) — a graphical milestone cannot close without it.

A coherence defect the inspection spots is fixed in this same delivery phase, where it is cheapest. A finding genuinely deferred is logged as a discovery note or a `docs/maturity.md` row, never silently dropped. Tier 1 asserts the tokens landed; this Tier-2 judgement covers what computation cannot — optical alignment, restraint, and whether the whole reads as considered against the spec.

## Amendment Protocol — when an approved proof is wrong

An approved proof can still be wrong: its Proof-of-work prose can describe a shape the design never defined, encode a misread capability, or demand an outcome no implementation can reach. Approval does not make the prose right — it makes changing it a decision the user takes, not a convenience the implementing agent reaches for. The amendment leaves a trail (the edited prose + a re-tag) precisely so the Step 4 prose-integrity reconciliation can tell an approved change from a silent one.

1. **Stop work on the affected slice.** Do not edit the prose, and do not implement toward a proof you believe is wrong.
2. **State the case:** what the Proof-of-work proof (or the API shape behind it) says, what you believe it should say, and which artifact is the source of the error — the proof alone, or the technical design behind it.
3. **Route by depth.** A wrong proof against a correct design is a proof amendment: on the user's explicit approval, edit the slice's (or milestone's) Proof-of-work prose, **move the `bet/<bet-slug>/approved` tag to a commit that includes the edit** (`git tag -f`, or record the amended commit in the bet record when re-tagging is undesirable), then change the built test and code to match. That edited-prose commit is the amendment trail the reconciliation reads. A wrong API/data design is deeper — follow Change Navigation below.
4. **Record the amendment** in the slice's delivery commit `Notes:` so Validation's retrospective sees how the contract moved after approval.

## Change Navigation — when reality contradicts the locked design

Mid-delivery discoveries that invalidate the design are not failures of the process; pushing through them silently is. When implementation reveals the design committed to something wrong:

1. **Pause the slice** and write a change proposal at `docs/bets/<bet-slug>/change-proposal-<n>.md` using the template at `.groundwork/skills/groundwork-bet/templates/change-proposal.md`: the discovery and its evidence, the impact across pitch / technical design / decomposition / built artifacts (name each affected section), the before/after of every proposed edit, and the severity.
2. **Route by severity.** *Minor* — the API/data design and milestones survive; specific proofs and design sections need correction: on user approval, apply the edits, re-review mutated docs (Protocol 9), amend affected proofs through the Amendment Protocol (edit the prose, re-tag, change the built test and code), resume the slice. *Structural* — an API/data design, a milestone, or the appetite itself is wrong: on user approval, revert to Design Foundations (`status: design`), rework the design with the proposal as input, and re-run Decomposition for the affected scope; unaffected delivered slices stand.
3. The proposal stays in the bet directory either way — it is the audit trail Validation and the retrospective read.

## Transition

Once all bet-progress tests are green, every slice is committed with its record filled, and the permanent best-practice tests for every slice are in place, you are ready for validation.

➡️ Read and follow: `.groundwork/skills/groundwork-bet/workflows/05-validation.md`
