# Phase 4: Delivery

**Goal:** Turn the bet-progress board green, milestone by milestone, by driving a fresh worker through each slice, reviewing its work, and pausing at each milestone to confirm the milestone honestly proved what it set out to prove, that the remaining ladder still holds, and to author the next milestone's slices from what this one taught — leaving a delivery record behind that the next slice, the validation phase, and the next bet can learn from.

## You are the delivery driver

Delivery is an orchestration, not a single linear loop you run in one context. You are the **driver**: you hold the thin spine — the board, the milestone order, the delivery granularity the user chose, and the triage and course-correction judgement — and keep that context small enough to reason about the bet as a whole.

You do not implement slices in your own context. Each slice is delivered by a **fresh slice-worker subagent** (`briefs/slice-worker.md`) you dispatch with a tight context capsule; it implements to green, rolls out the slice's permanent tests, returns a short report, and its implementation reasoning dies with its context. You review every worker's diff through independent lenses, triage the findings, commit the slice, and at each milestone boundary run the postmortem that decides whether the plan needs to change. This division keeps the heavy implementation context disposable and your own clear enough to course-correct.

**A note on voice.** This phase is dense with reading — the board, the git log, the approved prose — and it is tempting to narrate each read as a discovery. Don't: you are guiding the user through *their* delivery, not reporting your way through this file. Tell them where the bet stands and what is next, and state routine checks as plain fact (groundwork-persona, *Speak as the Guide, Not the Tourist*).

## Restrictions

⚠️ **CRITICAL CONSTRAINT — the approved prose is the definition of done.** The decomposition and technical design were reviewed proof by proof and approved by the user (the `bet(<bet-slug>): approve decomposition` commit). Building the tests and implementation from it, authoring each later milestone's slices on arrival, and steering the slice breakdown freely as delivery teaches you are all free — they need no special ceremony. **Changing what a milestone proves** — dropping an agreed front-door case, weakening a Proof-of-work proof, loosening an API shape — is not: that is an owner-approved **Amendment** (below), never a silent edit.

⚠️ **CRITICAL CONSTRAINT — scope.** Each slice writes only the code required to make its bet-progress tests green and satisfy the technical design. Stay within the milestones and slices in the decomposition tree — no large refactors, no touching unrelated subsystems. If reality contradicts the locked design, follow Change Navigation below.

## Operating Contract

This workflow operates under the protocols defined in `.groundwork/skills/operating-contract.md` (contract v1; Continuous Bet mode). Implementation rarely surfaces phase-crossing signals — when it does, capture it under the matching section in `.groundwork/cache/discovery-notes.md` and continue; the full Living Documents scan happens in Validation. Do not interrupt delivery to apply upstream updates mid-flight.

Subagent dispatch follows Protocol 9's mechanics throughout — the slice-worker and every review lens run as isolated subagents, and only their reports flow back. A host with no subagent mechanism cannot run this phase as designed; surface that before starting rather than collapsing the workers into your own context.

## Git workflow: a branch per bet, a commit per slice

Delivery's unit of git isolation is the **bet**, not the slice. The bet rides one short-lived branch — `bet/<bet-slug>`, the line of history the approved decomposition commit already sits on — worked inside one **worktree** isolated from `main` and from any other bet in flight. Every slice-worker for this bet operates in that one worktree, in order; you commit each slice onto the branch as you close it. The branch merges to trunk once, at bet close (Validation, `05-validation.md`).

Slices are sequential by construction — each reads the previous slice's delivery commit and wires onto a contract already proven green — so there is no parallelism to win by giving each slice its own worktree, and real hazard in trying: worktrees share one object store, and a second writer racing `.git/index.lock` is how agent runs lose work undetected. Parallelism belongs across bets (each its own worktree and branch) and across the read-only review lenses. The worker-leaves-it-unstaged, driver-reviews-then-commits handoff (Slice Loop below) works *because* worker and driver share this one serial worktree.

**Open the isolation before the red board.** The worktree and branch must exist before Step 0.5 commits the red board into them. If the bet is not already on its own branch and worktree from its earlier phases, open them now: branch `bet/<bet-slug>` from a clean `origin/<trunk>`, in a worktree under a gitignored path. One branch lives in one worktree — never check the same branch out twice.

**Bootstrap the worktree once, before the first worker.** A fresh worktree shares the object store but not the working tree. Before dispatching slice one: install dependencies, copy in the gitignored env/secret files the services need, run `git submodule update --init --recursive` if the project uses submodules, assign isolated ports / a scratch database if the bet boots services, and **warm code intelligence for the worktree** so each worker's Step-1 orientation has live structure, not a cold tool it skips — build the repo map (`npx groundwork-method repo-map`) and, where Serena is registered, index its symbol cache (`serena project index`). This is the working-directory contract every worker capsule then points at (Slice Loop §1). Getting Serena's worktree scoping right matters — it is where the symbol tools silently go dark; `.groundwork/skills/code-intelligence.md` (Degraded mode) is the canonical home for that scoping and the graceful-degradation contract, so read it as part of bootstrap rather than assuming the tools are live.

**Slice = one commit on the branch; milestone = a checkpoint, not a merge.** You commit each slice as you close it (Slice Loop §3) — one Conventional Commit per slice, history preserved, never squashed. A milestone closing is a green, reviewed, postmortem'd checkpoint *on the branch* — nothing merges to trunk yet.

**Push the bet branch as you go — off-machine backup, not integration.** Push right after each slice's delivery commit (`git push -u origin bet/<bet-slug>` the first time, plain `git push` after), or at a minimum at every milestone close, so a disk failure never loses more than the current slice. An isolated `bet/<bet-slug>` branch publishes nothing into trunk, so it carries none of the user gate the trunk merge does — run it routinely without asking. These are fast-forward pushes (the branch only grows until the bet-close rebase); a no-op on a project with no remote.

**Bet close = the single merge to trunk, run at Validation.** Merging to a shared branch is a push-class, user-gated action, never the driver's alone. The full mechanics — rebase onto trunk, fast-forward merge, worktree and branch teardown — live at `05-validation.md`, Step 8.5, the step that executes them.

### Recording a cross-service slice, by repository topology

A slice can span more than one service; how it commits depends on the project's repository layout. The scaffold produces a **monorepo**, the path the rest of this workflow assumes; the other two are supported with the deltas below.

| Topology | Unit of record | Key rule |
|---|---|---|
| **Monorepo** *(scaffold default)* | One atomic commit spanning the service directories — the slice itself (Slice Loop §3). Consumer client and producer contract land in the same commit. | A backwards-incompatible change slices as expand → migrate → contract, never one mega-commit. |
| **Submodules** *(each service a superrepo submodule)* | A **gitlink-bump commit in the superrepo**, referencing the child SHAs. | Each touched submodule is edited on a real branch — never detached HEAD — and pushed before the bump; bootstrap must run `submodule update --init`. Prefer the monorepo unless already committed. |
| **Polyrepo** *(each service its own repository)* | A **change-set id** recorded as a manifest binding the N commits in the bet's home repo. | Gate integration on producer-before-consumer ordering or a contract check (Pact, `buf breaking`) — there is no shared green build. Reach for it only when services must ship separately. |

## Step 0: Implementation Readiness Gate

Before any slice work, verify the bet is actually executable. Load `.groundwork/skills/groundwork-review/checklists/implementation-readiness.md` and check every item against the bet's artifacts — the document chain, the API and data design, the approved decomposition commit, and currency. If the checklist file is absent, stop and report it; do not improvise the gate from memory. These are mechanical existence and consistency checks; run them inline (no review subagent — there is nothing here to be biased about). This is the delivery-side counterpart of Decomposition Step 6's review: that gate judged the prose's authorship against `groundwork-review/checklists/decomposition.md`; this one only confirms the same artifacts still exist, are current, and agree with each other now.

The gate is fail-closed: any 🔴 item blocks delivery. Report each failed item by name, route back to the owning phase (a missing interface design → Design Foundations; an unapproved decomposition tree → Decomposition; an unreconciled discovery note → resolve it now), and do not begin implementation until it passes. 🟡 items are surfaced to the user with your read on whether they touch this bet; the user decides.

When every 🔴 item passes, state so in one line, update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: delivery`, and inform the user you are entering Developer Mode. Write the active-lane sentinel — `printf '%s\n' '<bet-slug>' > .groundwork/cache/active-lane` — so the capture reminder hook stays silent while this lane drives edits; Validation removes it at bet close.

**Quick-bet depth.** When the pitch carries `track: quick`, this is a quick bet — a single-milestone delivery (see `00-quick.md`). It runs the *same* slice loop, review lenses, and honest-green discipline as any bet; what scopes down is the milestone-close ceremony built for assembled multi-screen milestones (the experience-auditor subagent and the Tier-3 polish pass), noted at *Milestone close* below. The deterministic floor and the visual spec check (Tiers 1–2) hold in full — a quick bet that ships UI still cannot ship broken or off-spec.

## Step 0.5: Materialize the red board

The approved decomposition is prose; Delivery's first act is to render it into the runnable red board it tracks progress against. From the approved Proof-of-work prose, generate one red stub per **milestone** (the whole ladder) and one per **slice of the first milestone** — the board the rest of this phase turns green. A later milestone's slice stubs are materialized when Delivery opens that milestone; until then it carries only its headline stub. This is deliberate: the milestone stubs make the ladder legible from the first run — `./dev bet status` shows Milestone 1 going green while Milestones 2+ stay red.

For each milestone `index.md` and each slice file of the first milestone, materialize its named `Test file:` as a red stub that fails explicitly (never skips), commenting it with what the Proof-of-work prose says it must eventually assert. Discover the project's test language and service names from the scaffold — never assume. Use `./dev new milestone <bet-slug> <milestone-slug>` and `./dev new slice <bet-slug> <milestone-slug> <service> <slice-slug>` when they exist; write the files directly otherwise. Either way the paths match the prose exactly:

```
tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.<ext>
tests/bets/<bet-slug>/test_slice_<N>_<service>_<slice-slug>.<ext>
```

Consult `.groundwork/skills/groundwork-bet/references/bet-progress-tests.md` for the placeholder pattern and quality criteria. Run the suite once and confirm **every stub is red** — because the implementation does not exist, not an import or fixture error. Commit the red board (e.g. `bet(<bet-slug>): materialize red board`) before opening the first slice — it is the build artifact the slice loop fills in, free to change.

The scaffold and the `./dev` CLI are a starting point you keep shaping as the product grows: when a repeated delivery task earns it, or shipped tooling does not fit the work, adapt the tooling rather than scripting around it — never leave a shipped command inert and never build a parallel tool beside it (the *no empty capabilities* rule, `docs/principles/delivery/day-2-operational-baseline.md`).

## Step 0.7: Choose delivery granularity

Delivery can run at three cadences. The cadence sets where you pause for the user; it never relaxes the gates. Offer the choice in one turn and recommend the default:

| Mode | Runs autonomously | Pauses for the user |
|---|---|---|
| **Slice by slice** | one slice | after every slice closes, and at every milestone postmortem |
| **Milestone by milestone** *(default)* | all of a milestone's slices | at every milestone postmortem |
| **Whole bet** | all milestones | only on a hard stop, and at a postmortem that flags a course-correction |

**Hard stops pause in every mode, the autonomy choice notwithstanding:** a `decision-needed` review finding, an Amendment Protocol trigger (an approved proof looks wrong), or a Change Navigation trigger (reality contradicts the locked design). Autonomy speeds the path between gates; it never lets the driver decide one of these alone.

Recommend the user pin a **`frontier`**-tier model for this driver session (Model Tiers, operating contract) — subagent tiers are the dispatch defaults applied below (Slice Loop §1, §2). Also recommend a **`frontier`**-class **advisor** (Claude Code: `/advisor opus` or `advisorModel`) so an `execution`-tier worker can escalate mid-slice instead of grinding toward a forced green (Model Tiers — *Runtime escalation*).

State the chosen mode back in one line, then begin the milestone loop. The choice is a session preference — on a fresh-context resume, re-confirm the mode before continuing; it is one cheap question.

## The Milestone Loop

Work through the milestone ladder in order. For each milestone: if its slices are not yet authored (every milestone after the first), **open it** — author and record its slices (*Opening a milestone* below) — then drive its slices to green (the Slice Loop), close the milestone, and run the milestone postmortem before moving on. The first milestone's slices were authored and approved at decomposition, so it opens straight into the Slice Loop. A fresh context resumes by reading the board (`./dev bet status`) and the git log of delivery commits, not a manifest — the first red slice is where to pick up; a milestone whose headline stub is red but with no slice files yet is the next one to open.

Slices run in sequence, each built on the proven state of the one before it — the slice order encodes this, not parallelism. When a slice builds on a prior slice's proven contract, the slice-worker capsule includes that prior slice's green test file.

### Opening a milestone — authoring the next rung

Every milestone after the first is *unsliced* until Delivery reaches it: decomposition approved its headline proof in the ladder, not its slices. Opening it is where those slices are authored — deferred so they are written from what the milestones before them *actually taught*, not an up-front guess. This is *plan just enough* in motion.

For milestone 1 there is nothing to open — roll straight into the Slice Loop. For every later milestone, open it at the end of the previous milestone's postmortem:

1. **Author the milestone's slices** following Decomposition Step 4–5 (`workflows/03-decomposition.md`) — vertical slices, falsifiable Required Capabilities tracing to the design, a headline Proof of work per slice, all consistent with the milestone's approved headline proof. Apply what the delivered milestones taught: a foreseen slice may now be redundant, a boundary may now need one the design missed. This is the freshest place to set a slice's **Model tier** lift — a slice now visibly challenging or vague from ground truth flags `frontier` (Decomposition Step 4).
2. **Review them** — run the Decomposition Gate scoped to this milestone, then the Protocol 9 decomposition review on the new slice files (fail-closed, exactly as Decomposition Step 6). Revise to a clean verdict.
3. **Record the authored slices** — on the user's approval, commit the new slice files (`bet(<bet-slug>): author milestone <N>`). This is additive authoring — it adds this rung's slices and changes no existing proof.
4. **Materialize this milestone's slice stubs** (Step 0.5's procedure, scoped to the new slices) and commit the extended red board before the Slice Loop opens its first slice.

If opening the milestone reveals the *headline proof itself* is now wrong — not just its slices — route it through the Amendment Protocol or Change Navigation below.

### Introducing a milestone — a ladder amendment

The ladder is fluid: a postmortem can reveal that a milestone is *missing* — a demonstrable state the bet needs that the up-front ladder did not foresee. Introducing a new rung is a supported, first-class move. Because downstream milestones are unsliced, inserting or re-ordering one is cheap — there are no authored slices to unwind.

1. **Appetite check first.** Confirm the new rung fits the bet's **appetite** and is derivable from the locked design. If it would exceed the appetite, or needs capability the design never covered, stop — that is Change Navigation, not a ladder amendment. Never grow the ladder silently to absorb scope the bet did not bet on; the "2–5 milestones; more is a roadmap" rule (`workflows/03-decomposition.md`) still bounds it.
2. **Author the new milestone's `index.md`** with a **front-door headline proof**, placed and numbered at the right rung (re-numbering unopened downstream folders is cheap — they are unsliced).
3. **Review it** — the Decomposition Gate scoped to the new milestone, then the Protocol 9 decomposition review (fail-closed). Revise to a clean verdict.
4. **User approval is a hard stop** — adding a success-signal rung changes the definition of done.
5. **Record the new rung** additively (`bet(<bet-slug>): add milestone <N>`) and **materialize its headline stub**. Its slices are authored when Delivery reaches it, via *Opening a milestone* above.

### The Slice Loop — the driver's per-slice sequence

For each slice in the milestone, in order:

#### 1. Dispatch the slice-worker

Assemble the context capsule and dispatch a fresh slice-worker subagent (Protocol 9 mechanics — an isolated subagent loading `.groundwork/skills/groundwork-bet/briefs/slice-worker.md`) at the **`execution`** tier — or `frontier` if the slice's **Model tier** flags it (Model Tiers, operating contract). The capsule is **pointers and slice-specifics, not a paraphrase of the brief** — the worker reads the brief for its process; restating that here only bloats the capsule and drifts when the brief changes. Pass:

- `bet_slug` and the slice's `slice_file` path.
- The **working directory & isolation contract** — the bet's worktree path, run every command from it, leave changes **unstaged**, and **do not re-isolate** (no new worktree, branch, or `EnterWorktree`).
- The **previous slice's delivery commit** (hash, message) to read for its established patterns, eaten review findings, and `Notes:` line.
- The **exact existing files this slice modifies**, named, to read in full, and — when the slice **builds on a prior slice's proven contract** — that slice's **green test file**.
- The slice's materialized red `Test file:` path(s).
- The **stack's testing strategy** (`.agents/skills/groundwork-<stack>-engineer/references/testing.md`) — its **Bet Slice Rollout** section defines the permanent tests owed; name the right stack when a slice spans more than one.
- Any **slice-specific constraints** the brief cannot know — a frozen signature, an off-limits subsystem, a guardrail, required fixtures — stated as hard constraints.
- Any **prior proof of concept or proven recipe** that de-risks this slice; reuse rather than re-prove, relocating anything ephemeral to a durable path first **and never depending on the ephemeral path at runtime**.
- Facts the next slice should inherit, so the worker's `NOTES:` captures them.

The worker implements to green inside the locked design, rolls out the slice's permanent tests, self-reconciles, and returns a short report (files touched, `COVERAGE:`, `NOTES:`, self-reconcile result, any `BLOCKING CONCERN`). It does not commit. A tight capsule keeps the worker bounded.

**Act on a `BLOCKING CONCERN` before reviewing.** A worker reporting an approved proof looks wrong, reality contradicting the locked design, or a real dependency that cannot be reached has hit a hard stop — route it through the Amendment Protocol or Change Navigation below before any further slice work.

#### 2. Review the slice

A worker's green report is the author's account of its own work; it is not the gate. Review the slice's uncommitted diff before closing it — the test files are *built* this phase and are *supposed* to change; what is fixed is the approved prose.

**First, reconcile against the approved prose (mechanical — run it yourself, no subagent).** The worker's self-reconcile is a first pass; confirm it.

- **Prose integrity.** Confirm the decomposition tree and technical design have not silently moved: `git log --oneline -- docs/bets/<bet-slug>/decomposition/ docs/bets/<bet-slug>/technical-design/` since the approval commit shows only recorded amendments. A proof, acceptance criterion, or API shape changed without one — weakened, dropped, or loosened — is a `decision-needed` finding (most slices change no prose, so this is often a one-line no-op).
- **Honest green.** The implementation must satisfy the proof for the right reason, against the real product — the gaming tells are canonical in `briefs/acceptance-auditor.md`'s Honesty check and apply unchanged here as `decision-needed` findings, plus one delivery-specific check: **the proof runs against the shipping build** — the artifact a user actually launches (the packaged app, the embedded worker), not a test target that runs code the shipping build never includes. A worker's `SELF-RECONCILE` flag here is a lead to confirm, not a verdict to trust.

**Then dispatch the slice diff for review** through four parallel, independent lenses (Protocol 9 mechanics — isolated subagents, each loading its brief under `.groundwork/skills/groundwork-bet/briefs/`; none substitutes for another, and none is the slice-worker, which authored the diff). Every lens dispatches at the **`frontier`** tier — the review is the gate that makes cheap execution safe (Model Tiers, operating contract):

- **Blind reviewer** (`briefs/blind-reviewer.md`) — the diff only, no bet context; familiarity hides bugs, and this lens has none.
- **Edge-case tracer** (`briefs/edge-case-tracer.md`) — the diff plus repo read access; walks every branch and boundary and reports only unhandled paths (null/empty inputs, failure timing, races, off-by-ones).
- **Acceptance auditor** (`briefs/acceptance-auditor.md`) — the diff, the slice's Required Capabilities, and the prose API/data design; verifies the implementation does what the design says and nothing more, and honestly — undeclared endpoints, fields beyond the design, skipped error cases, and gamed implementations are findings even when tests pass.
- **Coverage auditor** (`briefs/coverage-auditor.md`) — the diff, the slice's Required Capabilities, and the stack's testing strategy; judges the permanent tests rolled out against it: error/boundary cases at the rigour of the happy path, a unit test for complex logic, a trace assertion on an observable path, named states for a `graphical-ui` slice. A sociable test that executes a branch without asserting on it is a gap even on a green board.

**Triage every finding** into exactly one bucket, deduplicating across lenses and the reconciliation:

| Bucket | Meaning | Handling |
|---|---|---|
| decision-needed | A real choice the design does not settle | Blocks the slice — put it to the user now (a hard stop) |
| patch | Unambiguous fix within the slice's scope | Fix before closing the slice |
| defer | Real, but pre-existing — not caused by this slice | Append as a row to `docs/maturity.md` with severity |
| dismiss | False positive or noise | Drop; do not persist |

Apply `patch` fixes yourself when small and bounded, or re-dispatch a worker for a larger one. A slice closes only with zero open decision-needed and patch findings.

#### 3. Record and close the slice

Commit the slice — that commit **is** the record, and the driver writes it (the worker left the changes unstaged). Use a structured message: a `bet(<bet-slug>): slice <N.M> <slice-slug>` subject, a body listing every file added, modified, or deleted, and a `Notes:` line — one or two sentences the next slice should know (a pattern established, a deviation and why, a struggle worth not repeating; carry the worker's `NOTES:` forward). An empty `Notes:` on a slice that fought us is a record that lies. The slice flips green on the board the moment its tests pass. Then push the branch (`git push`) — backup, not integration (Git workflow above); skip only on a project with no remote.

**In slice-by-slice mode, pause here** — show the user the closed slice (what it proved, what the review found, the commit) and confirm before dispatching the next worker. In milestone and whole-bet modes, continue to the next slice without pausing.

### Milestone close — prove it at the front door

A milestone is done when its **agreed front-door test cases pass against the real product** — the shipping build, on real data — not when its slices are each individually green. Run the milestone's bet-progress tests (`test_milestone_<n>_*`); the milestone shows green on the board (`./dev bet status`) once its proof passes. Green at the suite is the floor, not the finish: closing the milestone is confirming the consumer's outcome actually holds at their surface.

**Prove it in the consumer's medium.** A behavioural test asserting a selector exists passes while the rendered page is blank, throwing, or unstyled — a bug class assertion tests cannot see. For a milestone whose consumer is at a screen (`graphical-ui`), drive the *running* app and verify what they see; a `cli` or `agentic-protocol` milestone proves at its own front door and pays nothing for the pixel tiers below.

1. **Tier 1 — the deterministic floor is green.** The permanent `tests/system/test_render_smoke.py`, `test_a11y_smoke.py`, and `test_token_conformance.py` run as part of the suite: navigation returns 2xx/3xx, zero `error`-level console output, no error overlay, a non-blank render across the viewport × theme matrix, the axe gate at the design system's accessibility baseline, and the specified atmosphere actually landed (surface treatments render, no degradation to a flat default). A red layer blocks the milestone — it is a real defect, not a flaky test. When the surface's platform has no check that can run, that is a fail-closed block, not a skip (the test tooling emits a failing placeholder naming the gap, never silently passes — see the runner's `NATIVE-CHECK-CONTRACT.md`).
2. **Tier 2 — confirm the build matches the micro-polish spec.** Read the screenshots Tier 1 captured (`.groundwork/cache/visual/_smoke/<surface>/<route>__<viewport>__<theme>.png`, plus any per-state captures under `.groundwork/cache/visual/<bet-slug>/<surface>/<state>.png`). Adopt the designer persona (`.groundwork/skills/groundwork-designer/SKILL.md`, reference `design-review.md`) and judge each screen against the **per-surface micro-polish spec** in `technical-design/01-ui-design.md` and the design system: did the specified treatment, motion, elevation, and type tokens land; do empty/loading/error states read as designed; is alignment optically correct and the composition considered — the dimensions Tier 1 cannot compute. Record a one-line spec-conformance verdict per screen in the closing slice's commit message (a `Visual:` line) — a graphical milestone cannot close without it.
3. **Tier 3 — the polish pass.** With a running milestone to look at, run a deliberate pass over what was actually delivered against the design and the agreed cases: what does the consumer still need that is missing (no progress indicator, no empty state, no way back), and what considered touches would make this genuinely good to use — build those in. The boundary is concrete: elevate what *this milestone* delivers to match its own design and complete its own flows; a net-new capability is its own milestone, and the no-gos hold. AI-assisted coding makes this cheap, so the bar is high — "it renders" is not the finish line. *(Quick-bet depth: `track: quick` scopes this deliberate Tier-3 sweep down to fixing what Tier 2 flagged on the one screen — there is no assembled multi-screen milestone to polish, and the no-empty-state / no-way-back gaps are caught by Tier 2 against the micro-polish spec the quick bet authored.)*

**Then the experience-auditor reviews the milestone.** Dispatch it (`briefs/experience-auditor.md`, the designer persona) at the **`frontier`** tier over the assembled, running milestone — distinct from the per-slice coverage review, because design fidelity and flow completeness need the whole surface, not one slice. It judges, against `01-ui-design.md`, the design system, and the `## Design References` record in `docs/design-system.md`: best-in-class patterns implemented in full, no dead-end flows, the named states present, design-system match, and the joy-to-use bar. Its findings triage like any other review — a dead-end flow or a design-system miss is `decision-needed` and blocks the milestone. *(Quick-bet depth: for `track: quick`, skip this dedicated subagent pass — a single-milestone, single-screen change has no assembled cross-screen surface for it to judge that the Tier-2 designer inspection has not already covered. The Tier-1 floor and the Tier-2 spec-conformance verdict still gate the close.)*

A coherence or experience defect the review spots is fixed in this same delivery phase, where it is cheapest; a finding genuinely deferred is logged as a discovery note or a `docs/maturity.md` row, never silently dropped. There is no "done for function now, polish later" split.

### Milestone postmortem & course-correction

A green milestone is not a finished milestone. The board going green proves the suite passes; it does not prove the milestone proved *what it set out to prove*, nor whether what it taught us should change the rest of the plan. Validation's retrospective is too late for that — by then the whole bet is built against assumptions a mid-bet milestone may already have disproved. This checkpoint is the proactive one: at every milestone boundary, before the next one opens, run a focused pass over four questions, then open the next rung — a facilitated conversation, not a ceremony, and where the next milestone is sliced from what this one taught while it is still cheap.

1. **Did this milestone honestly prove its intent, at the front door?** Read the milestone's Proof-of-work prose against what was actually built. The board is green — but is it green for the right reason, driven through the real product (the honest-green tells, `workflows/03-decomposition.md` Step 3)? The failure this catches is the *quietly hollowed proof* — the per-slice honest-green check does not see a milestone-level intent erode across slices, so a real dependency the milestone meant to prove can end up faked by the time the last slice closes while the suite stays green. When you find it, work the real thing in and re-prove it through the shipping build now — not roll forward and discover at validation that the bet never proved its core premise. Treat a deferred-to-mock-where-the-real-thing-was-meant as a finding, every time, even on a fully green board.

2. **What did building this milestone teach that the remaining plan does not yet know?** Implementation reveals what design could only assume. Re-read the remaining ladder in light of what is now built: an assumption that broke, a downstream slice now redundant, a slice now missing because a real boundary needed wiring the design did not foresee, a downstream proof that reads wrong now its premise is concrete, or a whole milestone the ladder is missing. The question is not "is the plan still perfect" — it is "does what we learned change what we should build next." Route by weight: (a) only *how the next rung should be sliced* → carry it into *Opening a milestone*; (b) the ladder is *missing a rung* → *Introducing a milestone* (within appetite); (c) an approved *rung, design, or the appetite* is wrong → an Amendment or Change Navigation (Q3).

3. **Route any needed change through the integrity machinery — never a silent edit.** A change to *what the plan proves* (a milestone's or slice's Proof of work, an acceptance criterion) is an **Amendment** (below, with its commit format). A change to the *design itself* (an API/data shape, a milestone's existence, the appetite) is **Change Navigation** (below): write the change proposal and route by severity — though a *missing rung that fits the appetite and the locked design* is the lighter **ladder amendment** handled in-delivery (*Introducing a milestone* above), with no revert. Either way the trail — the recorded amendment commit, or a change-proposal file — is what lets the next slice's prose-integrity reconciliation tell an approved change from a silent one. "Adjust as we go" is a feature of this process precisely because it leaves that trail.

4. **Where does the delivered work actually stand?** Note anything the milestone surfaced that the next milestone or the final validation needs — a readiness caveat, a discovery-note signal for a future bet (`.groundwork/cache/discovery-notes.md`), a `docs/maturity.md` row. Capture it now while it is fresh; do not bank on remembering it at validation.

**Pause per the chosen mode.** In slice-by-slice and milestone-by-milestone modes, always pause here: present the postmortem and get the user's decision before opening the next milestone. In whole-bet mode, surface the postmortem summary and proceed automatically *unless* it found a course-correction (a hollowed proof, a remaining-plan change, an amendment, a new milestone, or a Change Navigation) — that is the user's call and pauses even in whole-bet mode. Routinely authoring the next rung's slices is *not* a course-correction; a clean postmortem rolls straight on, the scoped Protocol 9 review gating the new slices.

**Then open the next milestone.** With this milestone's lessons in hand, the user's go-ahead (or whole-bet autonomy), and any ladder amendment or Change Navigation already routed, run *Opening a milestone* above. (The final milestone has no next rung; its postmortem closes into Validation.)

## Amendment Protocol — when an approved proof is wrong

An approved proof can still be wrong: its Proof-of-work prose can describe a shape the design never defined, encode a misread capability, or demand an outcome no implementation can reach. Approval does not make the prose right — it makes changing it a decision the user takes, not a convenience the worker or driver reaches for. This protocol fires from three places: a slice-worker's `BLOCKING CONCERN`, a `decision-needed` review finding, or the milestone postmortem.

1. **Stop work on the affected slice or milestone.** Do not edit the prose, and do not implement toward a proof you believe is wrong.
2. **State the case:** what the proof says, what you believe it should say, and whether the error is in the proof alone or the technical design behind it.
3. **Route by depth.** A wrong proof against a correct design is a proof amendment: on the user's explicit approval, edit the slice's (or milestone's) Proof-of-work prose and **commit it beside the decomposition with a reason** (`bet(<bet-slug>): amend milestone <N> proof — <reason>`), then change the built test and code to match. **Re-point the `bet/<bet-slug>/approved` tag at this amendment commit** — the tag names the current sealed baseline, and the readiness gate and the prose-integrity reconciliation both read it as *the* baseline, not the original approval commit. That recorded amendment commit and the re-pointed tag are the trail the reconciliation reads. Editing an *unopened* milestone's headline proof is the cheapest amendment of all — correct the ladder rung, commit, and re-point the tag the same way; because its slices were never authored, nothing downstream unwinds. A wrong API/data design is deeper — follow Change Navigation below.
4. **Record the amendment** in the slice's delivery commit `Notes:` (and in the postmortem record when it surfaced there) so Validation's retrospective sees how the contract moved after approval.

## Change Navigation — when reality contradicts the locked design

Mid-delivery discoveries that invalidate the design are not failures of the process; pushing through them silently is. When implementation reveals the design committed to something wrong — surfaced by a slice-worker, a review, or the milestone postmortem:

1. **Pause the slice** and write a change proposal at `docs/bets/<bet-slug>/change-proposal-<n>.md` (template: `.groundwork/skills/groundwork-bet/templates/change-proposal.md`): the discovery and its evidence, the impact across pitch / technical design / decomposition / built artifacts, the before/after of every proposed edit, and the severity.
2. **Route by severity.** *Minor* — the API/data design and milestones survive, specific proofs or design sections need correction: on approval, apply the edits, re-review mutated docs (Protocol 9), amend affected proofs through the Amendment Protocol, resume the slice. *Ladder amendment* — the design holds and the ladder is simply missing a rung that fits the appetite: not a design contradiction at all — handle it in-delivery via *Introducing a milestone* above, no revert. *Structural* — an API/data design, a milestone, or the appetite itself is wrong: on approval, revert to Design Foundations (`status: design`), rework the design with the proposal as input, and re-run Decomposition for the affected scope; unaffected delivered slices stand.
3. The proposal stays in the bet directory either way — the audit trail Validation and the retrospective read.

## Transition

Once all bet-progress tests are green, every slice is committed with its record filled, every milestone postmortem has run, and the permanent best-practice tests for every slice are in place, you are ready for validation.

➡️ Read and follow: `.groundwork/skills/groundwork-bet/workflows/05-validation.md`
