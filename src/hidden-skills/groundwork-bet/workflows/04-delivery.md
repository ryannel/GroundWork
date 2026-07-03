# Phase 4: Delivery

**Goal:** Turn the bet-progress board green, milestone by milestone, by driving a fresh worker through each slice, reviewing its work, and pausing at each milestone to confirm the milestone honestly proved what it set out to prove, that the remaining ladder still holds, and to author the next milestone's slices from what this one taught — leaving a delivery record behind that the next slice, the validation phase, and the next bet can learn from.

This file is the **delivery spine**: the driver's mental model, the restrictions, the git workflow, and the step router. It holds no per-step procedure — each step lives in its own file under `delivery/`, loaded one at a time. Read this spine fully, then let the router send you to the right step.

## You are the delivery driver

Delivery is an orchestration, not a single linear loop you run in one context. You are the **driver**: you hold the thin spine — the board, the milestone order, the delivery granularity the user chose, and the triage and course-correction judgement — and keep that context small enough to reason about the bet as a whole.

You do not implement slices in your own context. Each slice is delivered by a **fresh slice-worker subagent** (`briefs/slice-worker.md`) you dispatch with a tight context capsule; it implements to green, rolls out the slice's permanent tests, returns a short report, and its implementation reasoning dies with its context. You review every worker's diff through independent lenses, triage the findings, commit the slice, and at each milestone boundary run the postmortem that decides whether the plan needs to change. This division keeps the heavy implementation context disposable and your own clear enough to course-correct.

**A note on voice.** This phase is dense with reading — the board, the git log, the approved prose — and it is tempting to narrate each read as a discovery. Don't: you are guiding the user through *their* delivery, not reporting your way through this file. Tell them where the bet stands and what is next, and state routine checks as plain fact (groundwork-persona, *Speak as the Guide, Not the Tourist*).

## Restrictions

⚠️ **CRITICAL CONSTRAINT — the approved prose is the definition of done.** The decomposition and technical design were reviewed proof by proof and approved by the user (the `bet(<bet-slug>): approve decomposition` commit). Building the tests and implementation from it, authoring each later milestone's slices on arrival, and steering the slice breakdown freely as delivery teaches you are all free — they need no special ceremony. **Changing what a milestone proves** — dropping an agreed front-door case, weakening a Proof-of-work proof, loosening an API shape — is not: that is an owner-approved **Amendment** (`delivery/on-amendment.md`), never a silent edit.

⚠️ **CRITICAL CONSTRAINT — scope.** Each slice writes only the code required to make its bet-progress tests green and satisfy the technical design. Stay within the milestones and slices in the decomposition tree — no large refactors, no touching unrelated subsystems. If reality contradicts the locked design, follow Change Navigation (`delivery/on-change-navigation.md`).

## Operating Contract

This workflow operates under the protocols defined in `.groundwork/skills/operating-contract.md` (contract v1; Continuous Bet mode). Implementation rarely surfaces phase-crossing signals — when it does, capture it under the matching section in `.groundwork/cache/discovery-notes.md` and continue; the full Living Documents scan happens in Validation. Do not interrupt delivery to apply upstream updates mid-flight.

Subagent dispatch follows Protocol 9's mechanics throughout — the slice-worker and every review lens run as isolated subagents, and only their reports flow back. A host with no subagent mechanism cannot run this phase as designed; surface that before starting rather than collapsing the workers into your own context.

## Git workflow: a branch per bet, a commit per slice

Delivery's unit of git isolation is the **bet**, not the slice. The bet rides one short-lived branch — `bet/<bet-slug>`, the line of history the approved decomposition commit already sits on — worked inside one **worktree** isolated from `main` and from any other bet in flight. Every slice-worker for this bet operates in that one worktree, in order; you commit each slice onto the branch as you close it. The branch merges to trunk once, at bet close (Validation, `05-validation.md`).

Slices are sequential by construction — each reads the previous slice's delivery commit and wires onto a contract already proven green — so there is no parallelism to win by giving each slice its own worktree, and real hazard in trying: worktrees share one object store, and a second writer racing `.git/index.lock` is how agent runs lose work undetected. Parallelism belongs across bets (each its own worktree and branch) and across the read-only review lenses. The worker-leaves-it-unstaged, driver-reviews-then-commits handoff (`delivery/step-02-slice-loop.md`) works *because* worker and driver share this one serial worktree.

**Open the isolation before the red board.** The worktree and branch must exist before Step 0.5 commits the red board into them. If the bet is not already on its own branch and worktree from its earlier phases, open them now: branch `bet/<bet-slug>` from a clean `origin/<trunk>`, in a worktree under a gitignored path. One branch lives in one worktree — never check the same branch out twice.

**Bootstrap the worktree once, before the first worker.** A fresh worktree shares the object store but not the working tree. Before dispatching slice one: install dependencies, copy in the gitignored env/secret files the services need, run `git submodule update --init --recursive` if the project uses submodules, assign isolated ports / a scratch database if the bet boots services, and **make the code map current for the worktree** (`npx groundwork-method repo-map` — the map cache is per-working-tree). The map's `module_graph` is load-bearing this phase, not orientation garnish: the ripple rule (`delivery/step-02-slice-loop.md`, §1) reads it to name consumer modules, and the honest-green review reads it to check they compiled. Serena's index, by contrast, is warmed when something needs it — the ripple rule — not as a bootstrap ritual; `.groundwork/skills/code-intelligence.md` (Degraded mode) carries its worktree scoping and the graceful-degradation contract.

**Slice = one commit on the branch; milestone = a checkpoint, not a merge.** You commit each slice as you close it (`delivery/step-02-slice-loop.md`, §3) — one Conventional Commit per slice, history preserved, never squashed. A milestone closing is a green, reviewed, postmortem'd checkpoint *on the branch* — nothing merges to trunk yet.

**Push the bet branch as you go — off-machine backup, not integration.** Push right after each slice's delivery commit (`git push -u origin bet/<bet-slug>` the first time, plain `git push` after), or at a minimum at every milestone close, so a disk failure never loses more than the current slice. An isolated `bet/<bet-slug>` branch publishes nothing into trunk, so it carries none of the user gate the trunk merge does — run it routinely without asking. These are fast-forward pushes (the branch only grows until the bet-close rebase); a no-op on a project with no remote.

**Bet close = the single merge to trunk, run at Validation.** Merging to a shared branch is a push-class, user-gated action, never the driver's alone. The full mechanics — rebase onto trunk, fast-forward merge, worktree and branch teardown — live at `05-validation.md`, Step 8.5, the step that executes them.

When a slice spans more than one service, how it records depends on the project's repository topology — the monorepo the scaffold produces needs no delta; submodule and polyrepo layouts are covered in `delivery/topologies.md`, loaded only off-monorepo.

## Working state: the board and the memlog

Delivery keeps a small per-bet working state under `.groundwork/cache/bets/<bet-slug>/` — gitignored, driver-written, created at Step 0 and removed when the bet is archived. **It never gates.** Git and the suite are the record; the board and memlog are a resume convenience that reconciles *against* them, and on any divergence tests and git win. Absent or corrupt, the working state costs nothing — today's resume path (read `./dev bet status` and the delivery git log) *is* the bootstrap path, so an in-flight bet self-heals with no migration.

**`board.yaml` (schema v1)** — the driver's map of the bet, rewritten whole and atomically after every transition (never patched in place):

```yaml
bet: <bet-slug>
track: full | quick            # the lane (quick bets carry track: quick)
mode: slice | milestone | whole-bet   # the Step 0.7 granularity choice, persisted
step: step-01-readiness | step-02-slice-loop | step-03-milestone-close | step-04-postmortem
approved: bet/<bet-slug>/approved@<sha>   # the sealed baseline the tag points at
updated: <iso-8601>
milestones:
  - n: 1
    slices:
      - key: 1.1-<service>-<slug>   # derives from the decomposition tree path — a stable id
        status: pending | in-progress | review | patching | done | blocked
        commit: <sha>               # the delivery commit once closed
        tier: execution | frontier
        review-pointer: reviews/<slice-key>/   # where the lens files landed
```

The `step` field is the step-router pointer (the spine's router reads it); it holds zero proof text, zero capabilities, and zero API shapes — anything of that kind belongs in the decomposition prose, not here. Slice `key`s derive from the decomposition tree paths so postmortems, amendments, and memlog lines all reference the same stable identifiers.

**`memlog.md`** — append-only, one timestamped line per event: a slice closed (sha + Notes gist), an amendment (sha + reason — the commit and re-pointed tag stay canonical; the line is an index entry), a postmortem gist, the mode choice or its re-confirmation, a blocked/unblocked, a change proposal filed. A deep bet runs ~60–100 lines — the resume read that replaces replaying `git log -p` and the postmortem prose. Append with `./dev bet log <bet-slug> -- "<line>"` (documented fallback where the CLI is unavailable: `printf '%s\n' "- <ts> — <line>" >> .groundwork/cache/bets/<bet-slug>/memlog.md`).

## The Milestone Loop

Work through the milestone ladder in order. For each milestone: if its slices are not yet authored (every milestone after the first), **open it** — author and record its slices (`delivery/step-04-postmortem.md`, *Opening a milestone*) — then drive its slices to green (the Slice Loop), close the milestone, and run the milestone postmortem before moving on. The first milestone's slices were authored and approved at decomposition, so it opens straight into the Slice Loop.

Slices run in sequence, each built on the proven state of the one before it — the slice order encodes this, not parallelism. When a slice builds on a prior slice's proven contract, the slice-worker capsule includes that prior slice's green test file.

### The step router

Each step is a separate file under `delivery/`. **Read one step file fully, execute it, and load the next only at that file's transition line** — never load two steps at once. The `board.yaml: step` field is the pointer to the current step; the table below maps it to a file. A fresh context resumes by reading `board.yaml` and `memlog.md`, then **reconciling against `./dev bet status` and the git log of delivery commits** — the board is a convenience, tests and git are the truth, so on any divergence the git/suite state wins and the board is rewritten to match. With no board (or a corrupt one), resume the old way: the first red slice is where to pick up, and a milestone whose headline stub is red but with no slice files yet is the next one to open.

| When `board.yaml: step` (or the reconciled state) is | Load |
|---|---|
| Entering delivery — readiness not yet passed, red board not yet materialized, mode not yet chosen | `delivery/step-01-readiness.md` (Steps 0 / 0.5 / 0.7) |
| A milestone is open with red slices to drive | `delivery/step-02-slice-loop.md` |
| A milestone's slices are all green, its front-door proof not yet driven | `delivery/step-03-milestone-close.md` |
| A milestone just closed — postmortem not yet run, next rung not yet opened | `delivery/step-04-postmortem.md` |
| **Triggered, any time:** a slice-worker `BLOCKING CONCERN` or `decision-needed` finding says an approved proof is wrong | `delivery/on-amendment.md` |
| **Triggered, any time:** implementation reveals the locked design is wrong | `delivery/on-change-navigation.md` |
| **Triggered:** recording a slice on a submodule or polyrepo layout | `delivery/topologies.md` |

The `on-*` and `topologies` files are loaded only when their trigger fires and return to the step that invoked them; the numbered steps run in order and each names its own transition.

## Transition

Once all bet-progress tests are green, every slice is committed with its record filled, every milestone postmortem has run, and the permanent best-practice tests for every slice are in place, you are ready for validation.

➡️ Read and follow: `.groundwork/skills/groundwork-bet/workflows/05-validation.md`
