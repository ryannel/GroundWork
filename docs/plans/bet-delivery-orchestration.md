# Plan: Bet Delivery Orchestration

**Status:** EXECUTED 2026-06-24. Skills + repo-docs landed (slice-worker brief, delivery driver rewrite, bet framing, `briefs/` convention, this record). Owed: a live `./dev sandbox --simulate` delivery run on a top model to exercise the driver → slice-worker → review → postmortem path end-to-end and confirm a real course-correction fires.

**Audience:** GroundWork contributors working on the bet lifecycle.

**Scope owner:** delivery (`groundwork-bet` Phase 4).

---

## §0 Mental model — driver + workers, with milestone checkpoints

Delivery was a single linear loop run inline in the orchestrator's one context:
assemble capsule → implement → review → roll out tests → commit, slice after slice.
Two costs followed. Every slice's implementation reasoning accumulated in one window,
so the context that is supposed to reason about the whole bet got steadily worse at
it. And nothing re-examined a milestone once green — the only retrospective was at
the very end (Validation), too late to change a plan the rest of the bet was already
built against.

The reframe: Delivery is a **driver + workers** orchestration.

- **The driver** (the orchestrator, run on a top reasoning model) holds only the thin
  spine — the board, the milestone order, the chosen granularity, and the triage and
  course-correction judgement. It never holds a slice's implementation reasoning.
- **A slice-worker** is a fresh subagent dispatched per slice. It loads a
  self-contained brief, gets a tight context capsule, implements that one slice to
  green inside the locked design, self-reconciles, and returns a small structured
  report. Its heavy reasoning dies with its context — the compression the driver needs.
- **The independent review** (the three existing lenses) stays as isolated subagents
  (Protocol 9): the worker authored the diff and cannot judge it.
- **The milestone postmortem** is the new proactive checkpoint at every milestone
  boundary: did this milestone honestly prove its intent, and does what we learned
  change the remaining plan? A needed change routes through the existing Amendment
  Protocol / Change Navigation (edit prose → re-tag `bet/<slug>/approved`), so
  "adjust as we go" stays integrity-preserving, never a silent edit.

The whole point: keep the implementation context disposable so the driver's context
stays clear enough to course-correct — the judgement that catches a milestone which
went green against a mock where its intent was a real dependency.

---

## Findings

| ID | Finding | Where |
|---|---|---|
| F1 | Slice loop ran inline; no subagent-per-slice; context accumulated | `workflows/04-delivery.md` "The Slice Loop" (pre-rework) |
| F2 | No delivery-granularity choice — delivery ran straight through | `workflows/04-delivery.md` (absent) |
| F3 | No per-milestone postmortem/course-correction; only end-of-bet retro | `workflows/04-delivery.md` "Milestone close"; retro lives in `05-validation.md` Step 7.5 |
| F4 | Amendment / Change Navigation were reactive only (agent-noticed mid-slice) — nothing scheduled a proactive plan re-check | `workflows/04-delivery.md` Amendment + Change Navigation |
| F5 | Mental Model / Lifecycle Overview described Delivery as a flat loop | `instructions.md` Mental Model + Lifecycle Overview |
| F6 | `briefs/` was not a documented skill-layout convention | `.agents/skills/groundwork-contributor/SKILL.md` layout table |

---

## Workstreams

### WS-A — Slice-worker brief *(addresses F1)*
**New:** `src/hidden-skills/groundwork-bet/briefs/slice-worker.md`. Self-contained
dispatched brief modeled on `groundwork-review`'s isolated-subagent shape: inputs +
context capsule, implement-to-green inside the locked design, build-the-real-thing
discipline (no mock where the proof named a real dependency — report it as a blocking
concern instead), mechanical self-reconcile (prose-integrity + honest-green), a small
structured report, and an explicit "does not commit" rule.
**Acceptance:** a worker dispatched with `bet_slug` + slice file + capsule can deliver
one slice and return a report the driver can review, triage, and commit. New `briefs/`
dir ships via the recursive `src/hidden-skills/*` copy.

### WS-B — Rework the delivery driver *(addresses F1–F4)*
**Rewrite:** `src/hidden-skills/groundwork-bet/workflows/04-delivery.md`. Kept all
integrity machinery (seal constraint, Step 0 readiness gate, Step 0.5 red board,
the three review lenses, prose-integrity + honest-green reconciliation, triage
buckets, permanent-test rollout, commit-as-record, visual verification, Amendment
Protocol, Change Navigation, Transition). Added: a "You are the delivery driver"
framing; **Step 0.7 granularity choice** (slice / milestone-default / whole-bet, with
always-on hard stops and a top-model recommendation); restructured the flat loop into
a **Milestone Loop** whose Slice Loop dispatches a slice-worker subagent then runs the
independent review; and a **Milestone postmortem & course-correction** step (four
questions, the deferred-to-mock catch, routing changes through Amendment / Change
Navigation, pausing per mode).
**Acceptance:** the file reads as a driver that dispatches workers and checkpoints at
milestones; the seal, Amendment, Change Navigation, and both reconciliation checks all
survive the restructure.

### WS-C — Bet skill framing *(addresses F5)*
**Edit:** `src/hidden-skills/groundwork-bet/instructions.md` — the Delivery Mental
Model bullet and the Lifecycle Overview row now describe the driver + slice-workers +
milestone postmortem + offered granularity. No status/routing change.
**Acceptance:** a reader of the bet skill's overview learns Delivery is an
orchestration, not a flat loop.

### WS-D — Document the `briefs/` convention *(addresses F6)*
**Edit:** `.agents/skills/groundwork-contributor/SKILL.md` — the Multi-phase skill
layout section now defines `briefs/` as dispatched subagent instruction sets, with the
slice-worker as the example.
**Acceptance:** the repo's self-description accounts for the new directory.

### WS-E — This plan record
**New:** `docs/plans/bet-delivery-orchestration.md` (this file). Not shipped to users.

---

## Decisions

**Settled:**

| Decision | Rationale |
|---|---|
| Rework Phase 4 in-place, not a new standalone skill | Keeps status routing, the `bet/<slug>/approved` seal, Amendment Protocol, and Change Navigation where they already work; a separate skill would fragment that machinery and add a dead routing entry. (User confirmed.) |
| Default granularity = milestone-by-milestone | The natural checkpoint: a milestone's slices run autonomously, the user weighs course-corrections at each boundary. (User confirmed.) |
| Slice-worker is a `briefs/` file inside the bet skill, not a hidden skill | Delivery-only, never dispatched elsewhere — a new top-level skill + routing entry would be dead weight. Contrast `groundwork-review`, shared across many phases, which earns its own dir. |
| Slice-worker does **not** commit; the driver reviews → patches → commits | Preserves "a slice closes only with zero open decision-needed/patch findings" — the gate stays after the independent review, not inside the author. |
| No worktree isolation for slice-workers | Slices are sequential, one working tree; isolation would cost setup for no parallelism benefit. |
| Milestone postmortem is distinct from Validation's end-of-bet retro | Scoped to one milestone, proactive, and wired to Amendment / Change Navigation so a fix lands while it is still cheap. |
| Hard stops (decision-needed, Amendment, Change Navigation) pause in every mode | Autonomy speeds the path between gates; it never lets the driver decide one of these alone. |

**Open:**

| Question | Lean |
|---|---|
| Persist the granularity choice vs. re-ask on resume | Re-ask — session-scoped, cheap, no new state shape (avoids a migration). |

---

## Sequencing & gates

**Sequence:** WS-A → WS-B → WS-C → WS-D → WS-E.

**Gates (done = all green):**
- `./dev test generation && ./dev test contracts` green — skills-only change, no
  structural or bundle regression expected.
- Structural read-through: the reworked `04-delivery.md` still carries the seal
  constraint, Amendment Protocol, Change Navigation, and both the prose-integrity and
  honest-green reconciliation checks.
- `groundwork-writer` voice across all new prose (declarative, zero-hedging).

**Not required by this change:** no migration (skills are clean-copied on `update`),
no `./dev` bundle rebuild (no CLI change — subagents dispatch via the host's `Task`
tool, the same idiom Protocol 9 already uses), no standalone version bump (carry on the
next release with the other owed bumps).

**Owed (live-sim debt, not blocking):** a `./dev sandbox --simulate` delivery run on a
top model to exercise the driver → slice-worker → review → postmortem path end-to-end
and confirm a real course-correction (e.g. a deferred-to-mock catch firing the
Amendment Protocol).
