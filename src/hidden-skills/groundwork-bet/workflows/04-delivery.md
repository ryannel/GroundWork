# Phase 4: Delivery

**Goal:** Turn the bet-progress board green, milestone by milestone, by driving a fresh worker through each slice, reviewing its work, and pausing at each milestone to confirm the milestone honestly proved what it set out to prove, that the remaining ladder still holds, and to author the next milestone's slices from what this one taught — leaving a delivery record behind that the next slice, the validation phase, and the next bet can learn from.

## You are the delivery driver

Delivery is an orchestration, not a single linear loop you run in one context. You are the **driver**: you hold the thin spine — the board, the milestone order, the delivery granularity the user chose, and the triage and course-correction judgement — and you keep that context small so you can reason about the bet as a whole.

You do not implement slices in your own context. Each slice is delivered by a **fresh slice-worker subagent** (`briefs/slice-worker.md`) you dispatch with a tight context capsule; it implements to green and returns a short report, and its implementation reasoning dies with its context. You review every worker's diff through independent lenses, triage the findings, commit the slice, and at each milestone boundary you run the postmortem that decides whether the plan needs to change. This division is what keeps the heavy implementation context disposable and your own context clear enough to course-correct.

## Restrictions

⚠️ **CRITICAL CONSTRAINT — sealed prose is the fixed definition of done; the ladder advances by ratchet.** The decomposition (`docs/bets/<bet-slug>/decomposition/`) and the technical design were reviewed proof by proof, at assertion-grade scrutiny, approved by the user, and sealed at the `bet/<bet-slug>/approved` git tag — which at delivery start covers the full milestone ladder (every rung's headline proof) plus the first milestone's slices. That sealed **prose** is frozen — Delivery builds *against* it, never edits it. Two things are *not* edits to it and are expected: (1) the tests and the implementation are *built* this phase — Step 0.5 materializes the red board from the approved Proof-of-work prose, and the milestone loop turns it green; and (2) each later milestone's slices are **authored on arrival** (and a missing rung may be **added**), with the tag *ratcheting forward* to add them — additive, recorded (`bet(<bet-slug>): author milestone <N>` / `add milestone <N>`), and gated by the same decomposition review. What is forbidden is *changing an already-sealed proof*: a sealed Proof-of-work proof that looks wrong is a stop-and-escalate through the Amendment Protocol below, not a quiet prose edit. The seal holds because the prose is under git from the tag forward — `git diff bet/<bet-slug>/approved.. -- docs/bets/<bet-slug>/` shows additive next-rung authoring or rung-addition (legitimate) versus a modification to sealed prose (a defect unless it carries an approved amendment trail), and the prose-integrity reconciliation in the slice review tells them apart.

⚠️ **CRITICAL CONSTRAINT — scope.** Each slice writes only the code required to make its bet-progress tests green and satisfy the API and data design in `docs/bets/<bet-slug>/technical-design/`. Stay within the milestones and slices in the decomposition tree. No large refactors, no touching unrelated subsystems. If reality contradicts the locked design, follow Change Navigation below.

## Operating Contract

This workflow operates under the protocols defined in `.groundwork/skills/operating-contract.md` (contract v1; Continuous Bet mode). Implementation rarely surfaces phase-crossing signals — but when it does, capture it under the matching section in `.groundwork/cache/discovery-notes.md` and continue. The full Living Documents scan happens in Validation (Phase 5). Do not interrupt delivery to apply upstream updates mid-flight.

Subagent dispatch follows Protocol 9's mechanics throughout this phase — the slice-worker and every review lens run as isolated subagents (the `Task` tool in Claude Code), and only their reports flow back. A host with no subagent mechanism cannot run this phase as designed; surface that to the user before starting rather than collapsing the workers into your own context.

## Step 0: Implementation Readiness Gate

Before any slice work, verify the bet is actually executable. Load `.groundwork/skills/groundwork-review/checklists/implementation-readiness.md` and check every item against the bet's artifacts — the document chain, the API and data design, the approval tag, and currency. If the checklist file is absent, stop and report it — the install is broken and `npx groundwork-method update` restores it; do not improvise the gate from memory. These are mechanical existence and consistency checks; run them inline (no review subagent — the artifacts were already authorship-gated when their phases committed them, and there is nothing here to be biased about).

The gate is fail-closed: any 🔴 item blocks delivery. Report each failed item by name with what is missing, route back to the owning phase (a missing interface design → Design Foundations; an absent approval tag or incomplete decomposition tree → Decomposition; an unreconciled discovery note → resolve it with the user now), and do not begin implementation until the item passes. 🟡 items are surfaced to the user with your read on whether they touch this bet; the user decides whether to proceed.

When every 🔴 item passes, state so in one line, update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: delivery`, and inform the user you are entering Developer Mode.

## Step 0.5: Materialize the red board

The approved decomposition is prose; Delivery's first act is to render it into the runnable red board it tracks progress against. From the approved Proof-of-work prose, generate one red stub per **milestone** (the whole ladder) and one per **slice of the first milestone** — the board the rest of this phase turns green. A later milestone's slice stubs are materialized when Delivery opens that milestone and its slices are authored; until then the milestone carries only its headline stub. This is deliberate: the milestone stubs make the ladder legible from the first run — `./dev bet status` shows Milestone 1 going green while Milestones 2+ stay red — so progress is visible at milestone granularity long before the later rungs are sliced.

For each milestone `index.md` (the full ladder) and each slice file of the first milestone under `docs/bets/<bet-slug>/decomposition/`, materialize its named `Test file:` as a red stub that fails explicitly (never skips), commenting the stub with what the Proof-of-work prose says it must eventually assert so the slice worker knows exactly what to implement. Discover the project's test language and service names from the scaffold (`docs/architecture/infrastructure.md`, the generated `docker-compose.yml`) — never assume. Use `./dev new milestone <bet-slug> <milestone-slug>` and `./dev new slice <bet-slug> <milestone-slug> <service> <slice-slug>` when they exist to scaffold the stubs at the correct paths; write the files directly otherwise. Either way the paths match the prose exactly:

```
tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.<ext>
tests/bets/<bet-slug>/test_slice_<N>_<service>_<slice-slug>.<ext>
```

Consult `.groundwork/skills/groundwork-bet/templates/bet-progress-test.md` for the placeholder pattern and quality criteria. Run the suite once and confirm **every stub is red** — red because the implementation does not exist, not because of an import or fixture error. That red board is the bet's live progress display: `./dev bet status` reads it, and red→green is "see how far we've come." Commit the red board (e.g. `bet(<bet-slug>): materialize red board`) before opening the first slice — it is the build artifact the slice loop fills in, generated *from* the sealed prose and free to change, never the tamper target.

The scaffold and the `./dev` CLI are a starting point you keep shaping as the product grows. When a repeated delivery task earns it, or shipped tooling does not fit the work, adapt the tooling rather than scripting around it — add a project command under `.dev/commands/`, register a runner, or extend the relevant scaffold. Never leave a shipped command inert and never build a parallel tool beside it (the *no empty capabilities* rule, `docs/principles/delivery/day-2-operational-baseline.md`).

## Step 0.7: Choose delivery granularity

Delivery can run at three cadences. The cadence sets where you pause for the user; it never relaxes the gates. Offer the choice in one turn and recommend the default:

| Mode | Runs autonomously | Pauses for the user |
|---|---|---|
| **Slice by slice** | one slice | after every slice closes, and at every milestone postmortem |
| **Milestone by milestone** *(default)* | all of a milestone's slices | at every milestone postmortem |
| **Whole bet** | all milestones | only on a hard stop, and at a postmortem that flags a course-correction |

**Hard stops pause in every mode, the autonomy choice notwithstanding:** a `decision-needed` review finding, an Amendment Protocol trigger (an approved proof looks wrong), or a Change Navigation trigger (reality contradicts the locked design). Autonomy speeds the path between gates; it never lets the driver decide one of these alone.

Recommend the user pin a top reasoning model for this driver session — the driver carries the triage and course-correction judgement, which is the hardest reasoning in the bet. The slice-workers run as subagents and may use a cheaper tier; their correctness is gated by the independent review, not taken on trust.

State the chosen mode back in one line, then begin the milestone loop. The choice is a session preference, not a stored artifact — on a fresh-context resume (the board and git log tell you where delivery stands), re-confirm the mode before continuing; it is one cheap question.

## The Milestone Loop

Work through the milestone ladder in order. For each milestone: if its slices are not yet authored (every milestone after the first), **open it** — author its slices and ratchet the seal (see *Opening a milestone* below) — then drive its slices to green (the Slice Loop), close the milestone, and run the milestone postmortem before moving to the next. The first milestone's slices were authored and sealed at decomposition, so it opens straight into the Slice Loop. A fresh context resumes by reading the board (`./dev bet status` renders red/green per milestone and slice from the suite) and the git log of delivery commits, not a manifest — the first red slice is where to pick up; a milestone whose headline stub is red but which has no slice files yet is the next one to open.

When the decomposition types its slices (`surface: core` or a surface slug — registry projects), core slices merge before the surface slices that consume them. A surface slice wires a contract that must already be proven green, not one being built beneath it in parallel — the milestone order already encodes this (the capability milestone opens the bet); hold it at slice granularity too. The slice-worker capsule for a surface slice includes the capability milestone's green test file — the contract proof the slice builds on.

### Opening a milestone — authoring the next rung

Every milestone after the first is *unsliced* until Delivery reaches it: decomposition sealed its headline proof in the ladder, not its slices. Opening it is where those slices are authored — and the reason they were deferred is that they are now written from what the milestones before them *actually taught*, not from an up-front guess. This is *plan just enough* in motion: the rung you are about to climb gets detailed using ground truth.

For milestone 1 there is nothing to open — its slices were authored and sealed at decomposition; roll straight into the Slice Loop. For every later milestone, open it at the end of the previous milestone's postmortem (the postmortem is the look-up; this is the act it produces):

1. **Author the milestone's slices** following Decomposition Step 4–5 (`workflows/03-decomposition.md`) — vertical slices, falsifiable Required Capabilities tracing to the design, a headline Proof of work per slice, all consistent with the milestone's sealed headline proof. Apply what the delivered milestones taught: a slice the design foresaw may now be redundant, a boundary may now need a slice the design missed.
2. **Review them** — run the Decomposition Gate scoped to this milestone, then the Protocol 9 decomposition review on the new slice files (fail-closed, exactly as Decomposition Step 6). Revise to a clean verdict.
3. **Ratchet the seal** — on the user's approval (the postmortem already pauses for them in slice and milestone modes), commit the new slice files and advance the tag: `git tag -f bet/<bet-slug>/approved`, message `bet(<bet-slug>): author milestone <N>`. The ratchet is additive — it adds this rung's slices and never reopens a sealed proof.
4. **Materialize this milestone's slice stubs** (Step 0.5's procedure, scoped to the new slices) and commit the extended red board before the Slice Loop opens its first slice.

If opening the milestone reveals the *headline proof itself* is now wrong — not just its slices — that is not authoring: route it through the Amendment Protocol or Change Navigation below.

### Introducing a milestone — a ladder amendment

The ladder is fluid: a postmortem can reveal that a milestone is *missing* — a demonstrable state the bet needs that the up-front ladder did not foresee. Introducing a new rung is a supported, first-class move, not a process failure. Because downstream milestones are unsliced, inserting or re-ordering a rung is cheap — there are no authored slices to unwind.

1. **Appetite check first.** Confirm the new rung fits the bet's **appetite** and is derivable from the locked design. If it would *exceed* the appetite, or needs capability the technical design never covered, stop — that is Change Navigation (re-scope the appetite, or carve the work to a future bet / no-go), not a ladder amendment. Never grow the ladder silently to absorb scope the bet did not bet on. The "2–5 milestones; more is a roadmap" rule (`workflows/03-decomposition.md`) still bounds the grown ladder.
2. **Author the new milestone's `index.md`** with an **un-mockable headline proof**, placed and numbered at the right rung (re-number unopened downstream milestone folders as needed — cheap, they are unsliced).
3. **Review it** — the Decomposition Gate scoped to the new milestone, then the Protocol 9 decomposition review (fail-closed). Revise to a clean verdict.
4. **User approval is a hard stop** — adding a success-signal rung changes the definition of done, so it is the user's call, surfaced at the postmortem.
5. **Ratchet the seal** additively (`git tag -f bet/<bet-slug>/approved`, message `bet(<bet-slug>): add milestone <N>`) and **materialize the new milestone's headline stub**. Its slices are authored when Delivery reaches it, via *Opening a milestone* above. The new rung never reopens a sealed proof.

### The Slice Loop — the driver's per-slice sequence

For each slice in the milestone, in order:

#### 1. Dispatch the slice-worker

Assemble the context capsule and dispatch a fresh slice-worker subagent (Protocol 9 mechanics — an isolated subagent loading `.groundwork/skills/groundwork-bet/briefs/slice-worker.md`). Pass it:

- `bet_slug` and the slice's `slice_file` path under `docs/bets/<bet-slug>/decomposition/`.
- The **previous slice's delivery commit** — hash, message, and the instruction to read the diff. Its established patterns, eaten review findings, and `Notes:` line are how this slice repeats lessons instead of mistakes.
- The **exact existing files this slice modifies**, named, to read in full.
- For a **surface** slice, the **capability milestone's green test file** — the contract it wires onto.
- The slice's materialized red `Test file:` path(s).

The worker implements to green inside the locked design, runs its mechanical self-reconcile, and returns a short report (files touched, `NOTES:`, self-reconcile result, and any `BLOCKING CONCERN`). It does not commit. Keeping the capsule tight is what keeps the worker bounded: it reads what it needs to change and the contract it builds on, not the whole bet.

**Act on a `BLOCKING CONCERN` before reviewing.** A worker that reports an approved proof looks wrong, that reality contradicts the locked design, or that a real dependency the proof names cannot be reached has hit a hard stop — route it through the Amendment Protocol or Change Navigation below (and pause for the user) before any further slice work. Do not let a worker that could not honestly reach green be reviewed as if it did.

#### 2. Review the slice

A worker's green report is the author's account of its own work; it is not the gate. Review the slice's uncommitted diff before closing it — and note the inversion from the sealed-up-front model: the test files are *built* this phase and are *supposed* to change; what is sealed is the prose.

**First, reconcile against the approved prose (mechanical — run it yourself, no subagent).** The worker's self-reconcile is a first pass; confirm it.

- **Prose integrity.** The approved contract is the decomposition tree and the technical design, sealed at the `bet/<bet-slug>/approved` tag. Confirm it has not silently moved: `git diff bet/<bet-slug>/approved.. -- docs/bets/<bet-slug>/decomposition/ docs/bets/<bet-slug>/technical-design/` shows no change except an approved amendment (the Amendment Protocol's commit trail). A Proof-of-work proof, an acceptance criterion, or an API shape changed without that trail — a weakened proof, a dropped case, a loosened shape — is a `decision-needed` finding. (Most slices change no prose at all; then this is a one-line no-op.) The built test must also still honestly prove what its slice's Proof-of-work prose describes — a stub filled in to assert less than the prose promised is the same finding.
- **Honest green.** The implementation must satisfy the proof for the right reason. A return value hardcoded to the test's expected output, an input special-cased to the fixture, a `if TEST_MODE`-style branch, or a mocked-out unit of real work is a `decision-needed` finding even though the suite is green — *a weak suite that generated code passes is worse than no suite* (`docs/principles/foundations/testing.md`). A worker's `SELF-RECONCILE` flag here is a lead to confirm, not a verdict to trust.

**Then dispatch the slice diff for review** through three parallel, independent lenses (Protocol 9 mechanics — isolated subagents; the three lenses catch different failure classes and none substitutes for another; none is the slice-worker, which authored the diff and cannot judge it):

- **Blind reviewer** — receives only the diff, no bet context. Familiarity hides bugs; this lens has none.
- **Edge-case tracer** — receives the diff plus repo read access. Walks every branch and boundary the diff introduces and reports only unhandled paths: null/empty inputs, failure timing, races, off-by-ones.
- **Acceptance auditor** — receives the diff, the slice's Required Capabilities, and the prose API/data design (`technical-design/03-api-design.md`, `04-data-design.md`). Verifies the implementation does what the design says and nothing more — and that it does so honestly: the service's generated contract matches the prose shapes; undeclared endpoints, fields beyond the design, silently skipped error cases, and implementation gamed to the test (hardcoded returns, special-cased inputs, test-only branches) are findings even when tests pass.

**Triage every finding** into exactly one bucket, deduplicating across lenses and the reconciliation:

| Bucket | Meaning | Handling |
|---|---|---|
| decision-needed | A real choice the design does not settle | Blocks the slice — put it to the user now (a hard stop) |
| patch | Unambiguous fix within the slice's scope | Fix before closing the slice |
| defer | Real, but pre-existing — not caused by this slice | Append as a row to `docs/maturity.md` with severity; do not fix mid-slice |
| dismiss | False positive or noise | Drop; do not persist |

Apply `patch` fixes yourself when small and bounded, or re-dispatch a worker for a larger one. A slice closes only with zero open decision-needed and patch findings.

#### 3. Roll out permanent tests

Once the slice's bet-progress tests are green and the review is clear, roll out that slice's **permanent best-practice tests** — interface tests, HTTP API system tests, honeycomb service-perimeter tests, and unit tests for complex logic, per the project's testing strategy. For a `graphical-ui` slice, this includes **component render tests** across the states the design system names — default, loading, empty, error, long-content — so a component that throws on a prop or state combination is caught in isolation before any page integrates it (the scaffold ships the pattern at `components/render-smoke.test.tsx`); and adding any new route to `tests/system/routes.json` so the permanent render-smoke, geometry, and a11y gates sweep it. These live in the service repos and `tests/system/`, not in `tests/bets/`, and stay in the codebase after the bet is archived.

#### 4. Record and close the slice

Commit the slice — that commit **is** the record, and the driver writes it (the worker left the changes unstaged). Use a structured message: a `bet(<bet-slug>): slice <N.M> <slice-slug>` subject, then a body listing every file added, modified, or deleted, and a `Notes:` line — one or two sentences on what the next slice should know: a pattern established, a deviation taken and why, a struggle worth not repeating (carry the worker's `NOTES:` forward here). The commit is what makes the next slice's capsule and Validation's retrospective possible; an empty `Notes:` on a slice that fought us is a record that lies. The slice flips green on the board the moment its tests pass — no status field to maintain.

**In slice-by-slice mode, pause here** — show the user the closed slice (what it proved, what the review found, the commit) and confirm before dispatching the next worker. In milestone and whole-bet modes, continue to the next slice without pausing.

### Milestone close

After all of a milestone's slices are delivered, run the milestone's bet-progress tests (`test_milestone_<n>_*`) to confirm the milestone's full demonstrable outcome. The milestone shows green on the board (`./dev bet status`) once its proof passes — the board is derived from the suite, so there is nothing to mark.

**Visual verification — graphical surface milestones only.** A behavioural test asserting a selector exists passes while the rendered page is blank, throwing, unstyled, or showing an error-boundary fallback — the bug class assertion tests cannot see. Before a milestone that closed a `graphical-ui` surface is marked `delivered`, run the ladder against the *running* app; skip this entirely for `core`/`cli`/`agentic-protocol` milestones, which pay nothing.

1. **Tier 1 — the deterministic floor is green.** The permanent `tests/system/test_render_smoke.py`, `test_a11y_smoke.py`, and `test_token_conformance.py` run as part of the suite: navigation returns 2xx/3xx, zero `error`-level console output, zero uncaught exceptions, no failed same-origin requests, no error overlay, a non-blank render across the viewport × theme matrix, the axe gate at the design system's accessibility baseline, and — the new layer — the specified atmosphere actually landed (surface treatments render with backdrop blur and multi-layer elevation, the projected tokens resolve, no degradation to a flat default). A red layer blocks the milestone — it is a real defect, not a flaky test.
2. **Tier 2 — confirm the build matches the micro-polish spec.** Read the screenshots Tier 1 captured (`.groundwork/cache/visual/_smoke/<surface>/<route>__<viewport>__<theme>.png`, plus any per-state captures written by interface tests to `.groundwork/cache/visual/<bet-slug>/<surface>/<state>.png`). Adopt the designer persona (`.groundwork/skills/groundwork-designer/SKILL.md`, reference `design-review.md`) and judge each screen against the **per-surface micro-polish spec** in `technical-design/01-ui-design.md` and the design system. The question is conformance to the written spec, not "is it as good as a leader": did the specified surface treatment, motion, elevation, and type tokens land; do empty/loading/error states read as designed rather than as a failure; and — the dimensions Tier 1 cannot compute — is alignment optically correct, is the atmosphere restrained, does the composition read as considered? Surface what diverges from the spec; do not recite a fixed checklist. Record a one-line spec-conformance verdict per screen in the closing slice's commit message (a `Visual:` line) — a graphical milestone cannot close without it.

A coherence defect the inspection spots is fixed in this same delivery phase, where it is cheapest. A finding genuinely deferred is logged as a discovery note or a `docs/maturity.md` row, never silently dropped. Tier 1 asserts the tokens landed; this Tier-2 judgement covers what computation cannot — optical alignment, restraint, and whether the whole reads as considered against the spec.

### Milestone postmortem & course-correction

A green milestone is not a finished milestone. The board going green proves the suite passes; it does not prove the milestone proved *what it set out to prove*, and it does not ask whether what the milestone taught us should change the rest of the plan. The retrospective in Validation (Phase 5) is too late for that — by then the whole bet is built against assumptions a mid-bet milestone may already have disproved. This checkpoint is the proactive one: at every milestone boundary, before the next milestone opens, run a focused pass over four questions, then open the next rung. It is a facilitated conversation, not a ceremony — it is where course-correction happens, and where the next milestone is sliced from what this one taught, while it is still cheap.

1. **Did this milestone honestly prove its intent?** Read the milestone's Proof-of-work prose against what was actually built. The board is green — but is it green for the right reason? The failure this catches is the *quietly hollowed proof*: a milestone whose intent was to exercise a real dependency — a live model call, a real external service, an actual queue — delivered instead against a light mock or a stub, so the suite passes while proving nothing the milestone existed to prove. The honest-green check runs per slice, but a milestone-level intent can erode across slices in a way no single slice review sees. When you find it, that is a course-correction: the milestone did not prove its intent, and the fix is to work the real thing in and re-prove it now — not to roll forward and discover at validation that the bet never proved its core premise. Treat a deferred-to-mock-where-the-real-thing-was-meant as a finding, every time, even on a fully green board.

2. **What did building this milestone teach that the remaining plan does not yet know?** Implementation reveals what design could only assume. Re-read the remaining ladder in light of what is now built: an assumption that broke, a downstream slice now redundant because this milestone subsumed it, a slice now missing because a real boundary turned out to need wiring the design did not foresee, a proof downstream that reads wrong now that its premise is concrete, or a whole milestone the ladder is missing. The question is not "is the plan still perfect" — it is "does what we learned change what we should build next." Route the answer by weight: (a) it changes only *how the next rung should be sliced* → carry it straight into *Opening a milestone* (that is exactly the slicing-from-ground-truth this deferral exists to enable); (b) the ladder is *missing a rung* → *Introducing a milestone* (a ladder amendment, within appetite); (c) a sealed *rung, design, or the appetite* is wrong → an Amendment or Change Navigation (Q3).

3. **Route any needed change through the integrity machinery — never a silent edit.** A change to the *plan prose* (a milestone's or slice's Proof of work, an acceptance criterion) is an **Amendment** (below): on the user's approval, edit the prose, move the `bet/<bet-slug>/approved` tag to a commit that includes the edit, then adjust the affected board and code. A change to the *design itself* (an API/data shape, a milestone's existence, the appetite) is **Change Navigation** (below): write the change proposal and route by severity. Either way the trail — edited prose + re-tag, or a change-proposal file — is what lets the next slice's prose-integrity reconciliation tell an approved change from a silent one. "Adjust as we go" is a feature of this process precisely because it leaves that trail.

4. **Where does the delivered work actually stand?** Note anything the milestone surfaced that the next milestone or the final validation needs — a readiness caveat, a discovery-note signal for a future bet (`.groundwork/cache/discovery-notes.md`), a `docs/maturity.md` row. Capture it now while it is fresh; do not bank on remembering it at validation.

**Pause per the chosen mode.** In slice-by-slice and milestone-by-milestone modes, always pause here: present the postmortem — what the milestone proved, anything that did not hold, and any course-correction you recommend — and get the user's decision before opening the next milestone. In whole-bet mode, surface the postmortem summary and proceed automatically *unless* it found a course-correction (a hollowed proof, a remaining-plan change, an amendment, a new milestone / ladder amendment, or a Change Navigation): a course-correction is the user's call and pauses even in whole-bet mode. Routinely authoring the next rung's slices is *not* a course-correction — in whole-bet mode a clean postmortem rolls straight on, the scoped Protocol 9 review gating the new slices. A clean postmortem in whole-bet mode carries its summary onto the record.

**Then open the next milestone.** The postmortem is the look-up; authoring the next rung is what it produces. With this milestone's lessons in hand, the user's go-ahead given (or autonomy in whole-bet mode), and any ladder amendment or Change Navigation already routed, author the next milestone's slices — the *Opening a milestone* procedure above — and ratchet the seal. Doing it here, now, is the whole point of deferring it: the next rung is sliced from ground truth, not from a guess made before the first line of code. (The final milestone has no next rung to open; its postmortem closes into Validation.)

## Amendment Protocol — when an approved proof is wrong

An approved proof can still be wrong: its Proof-of-work prose can describe a shape the design never defined, encode a misread capability, or demand an outcome no implementation can reach. Approval does not make the prose right — it makes changing it a decision the user takes, not a convenience the implementing worker or driver reaches for. The amendment leaves a trail (the edited prose + a re-tag) precisely so the prose-integrity reconciliation can tell an approved change from a silent one. This protocol fires from three places: a slice-worker's `BLOCKING CONCERN`, a `decision-needed` review finding, or the milestone postmortem.

1. **Stop work on the affected slice or milestone.** Do not edit the prose, and do not implement toward a proof you believe is wrong.
2. **State the case:** what the Proof-of-work proof (or the API shape behind it) says, what you believe it should say, and which artifact is the source of the error — the proof alone, or the technical design behind it.
3. **Route by depth.** A wrong proof against a correct design is a proof amendment: on the user's explicit approval, edit the slice's (or milestone's) Proof-of-work prose, **move the `bet/<bet-slug>/approved` tag to a commit that includes the edit** (`git tag -f`, or record the amended commit in the bet record when re-tagging is undesirable), then change the built test and code to match. That edited-prose commit is the amendment trail the reconciliation reads. Editing an *unopened* milestone's headline proof is the cheapest amendment of all — correct the ladder rung and re-tag; because its slices were never authored, nothing downstream unwinds. A wrong API/data design is deeper — follow Change Navigation below.
4. **Record the amendment** in the slice's delivery commit `Notes:` (and in the postmortem record when it surfaced there) so Validation's retrospective sees how the contract moved after approval.

## Change Navigation — when reality contradicts the locked design

Mid-delivery discoveries that invalidate the design are not failures of the process; pushing through them silently is. When implementation reveals the design committed to something wrong — surfaced by a slice-worker, a review, or the milestone postmortem:

1. **Pause the slice** and write a change proposal at `docs/bets/<bet-slug>/change-proposal-<n>.md` using the template at `.groundwork/skills/groundwork-bet/templates/change-proposal.md`: the discovery and its evidence, the impact across pitch / technical design / decomposition / built artifacts (name each affected section), the before/after of every proposed edit, and the severity.
2. **Route by severity.** *Minor* — the API/data design and milestones survive; specific proofs and design sections need correction: on user approval, apply the edits, re-review mutated docs (Protocol 9), amend affected proofs through the Amendment Protocol (edit the prose, re-tag, change the built test and code), resume the slice. *Ladder amendment* — the design holds and the ladder is simply missing a rung that fits the appetite and is derivable from the locked design: this is not a design contradiction at all — handle it in-delivery via *Introducing a milestone* above (author the new rung's headline, review, ratchet the seal), no revert. *Structural* — an API/data design, a milestone, or the appetite itself is wrong, or a needed new rung requires capability the design never covered or would exceed the appetite: on user approval, revert to Design Foundations (`status: design`), rework the design with the proposal as input, and re-run Decomposition for the affected scope; unaffected delivered slices stand.
3. The proposal stays in the bet directory either way — it is the audit trail Validation and the retrospective read.

## Transition

Once all bet-progress tests are green, every slice is committed with its record filled, every milestone postmortem has run, and the permanent best-practice tests for every slice are in place, you are ready for validation.

➡️ Read and follow: `.groundwork/skills/groundwork-bet/workflows/05-validation.md`
