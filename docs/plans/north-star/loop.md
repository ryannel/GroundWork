# Part 3: The Loop

## Units of work

A **slice** is the atomic unit of delivered work: one coherent change that an agent asserts is done, and that the system must then prove. A slice stays unaccepted until the battery, the adversary, and (per lane) the human agree. One vocabulary across all lanes: a patch's single commit is a slice; a bet milestone is delivered as slices; a scaffold capability landing green is a slice.

A slice consists of:
- **The change** — landing as one commit carrying the derivation-contract trailers.
- **The capsule** — a short note the reviewer reads in two minutes: what changed, why, risk inputs (paths touched, blast radius, revert cleanliness), and how it was verified. This is what makes review trust-calibration instead of rationale reconstruction.
- **Its proof** — the battery results attached, plus any doc-update obligations discharged or waived.

Hard properties: a slice is capped at reviewable-in-one-sitting, so an oversized slice must split. The author's context never grades it. It enters the Queue unless a prior seal covers it.

A **bet** is a goal reached through milestones. Each milestone is a user-visible step with a front-door proof. A milestone is delivered as slices. A **program** is a goal reached through bets.

## Programs are first-class

A program is authored and sealed: a goal, a falsifiable definition of done, and an ordered ladder of bets, including bets not yet started. Only the next bet is designed in full. Later rungs are one line and a proof sketch, designed on arrival with what delivery taught.

The program walk is the same discipline as the bet walk: the ladder is reviewed as a diagram first, sequencing argued, then sealed. Program acceptance is driving the goal's front door, not summing bet statuses. This mirrors bet→milestone exactly, one level up. It is what makes "is this program done?" answerable from a rendered page.

## Lanes

Triage puts each piece of work in one of three lanes. Ties resolve lighter. A post-hoc lane audit compares diff size and blast radius against the declared lane. A mis-lane is a rendered fact on the Map.

| Lane | Design depth | Seals | Verification |
|---|---|---|---|
| Patch | None | None — checks only | Battery + trailer-stamped commit, mined later for clustering |
| Standard | Intent paragraph | Intent, acceptance | Battery + adversary + drive artifact |
| Complex | Full design walk: UI → flows → API → schema | Design-walk seal, acceptance | Everything above + design docs merge into the Record |

## The design walk

Diagram first: sequencing and flows are reviewed as pictures. Propose, don't interrogate. Consequential decisions get their own turn. What's already ruled gets a one-line recap; full density only on what's new.

Per-discipline conventions (system design, data flows, DB schema, API schema, UI/UX) each state the artifact shape, the walk, and where the seal lands. They are identical across bets and programs. The ways-of-working layer carries these conventions and the loop's philosophy, kept short. The philosophy must be taught to the agent. No check conveys it.

## Writes

Every ruling writes to the decisions ledger. Every bounce writes its reason to the findings ledger. The amendment protocol is the seal's only write path: stop, show before and after, re-point the tag only on the owner's explicit words, record the amendment. Every seal records the battery version it was granted under.

## The delivery pipeline

The loop today costs a 3-milestone bet roughly 35–45 subagent dispatches, six bookkeeping writes per slice, and 10–15 waiting-on-you moments. The revised pipeline keeps what makes it safe and cuts what doesn't. The cost history is in [evidence.md](evidence.md).

**Per slice:**
1. The frontier driver assembles a pointer capsule. Ripple slices get a driver-computed caller list against committed code.
2. A fresh execution-tier worker implements to green and hands off unstaged. Blocking-concern escalations are counted. That number tunes the tier policy.
3. The battery runs: seal verify, the scans, and the deletion test. Coverage is proven mechanically, not judged by a prose lens.
4. **One** fresh-context adversary reviews, blind and correctness-focused. The three-lens-per-slice battery is retired: coverage went mechanical, and edge-case and honesty judgment move to milestone sum.
5. Findings land in the four buckets in the ledger. Fixes run the fix-in-place ladder, kept as measured: re-deriving context from scratch costs about 41% of the original build.
6. The slice commits with its trailers. Backup push. Total writes: the commit and two ledger entries. Board, memlog, and hand-refreshed status and proofs pages are retired. The Map derives them.
7. A fresh-context subagent writes the capsule. The slice enters the Queue unless a prior seal covers it.

**Per milestone close:**
- Battery rows: the visual smoke set (render, a11y, token conformance) and a red-for-the-right-reason check on the next rung's stubs. Stub honesty is a check now, because stubs have shipped with their assertions commented out.
- Three frontier reads, no more: the designer's screenshot read, the milestone-sum adversary, and the experience audit of the running product. The screenshot read includes the polish verdict; the separate polish stage is merged in. The adversary read covers the tell catalog plus edge-case judgment over the assembled diff.
- The postmortem's four questions are written to the ledger, exceptions-first. There is no walkthrough subagent. The Map's milestone page carries the narrative. Nothing blocks unless the dial says so.
- The next rung is sliced before close, from what delivery taught.

**Per bet close:**
- Battery rows, not ceremony steps: full suite, whole-bet seal verify, contract verification, served-spec capture into the Record, ledger fill, the visual gate.
- Acceptance: you drive the agreed front-door cases. The drive artifact is recorded. Batching follows the dial, with debt rendered on the Map.
- The retrospective mines the ledgers mechanically: finding patterns, escalation counts, the previous bet's action items. It also runs the cross-bet invalidation check against the sealed program ladder, as a Map-level signal, not a prose question.
- Archive, merge on your go-ahead, teardown.

Target arithmetic for the same 3-milestone, 8-slice bet: frontier dispatches drop from about 35 to about 20 (one per slice, three per milestone, three doc reviews). Slice bookkeeping drops from six writes to two. Waiting-on-you moments drop from 10–15 to the seals plus whatever rungs the dial chooses.

## Continuous delivery

A lined-up bet or program runs to completion without pausing for company. This is a core capability, and the battery earns it. The old system paused everywhere because prose was the only guard. Here every slice still passes probes, the adversary, and the scans before the run moves on.

- **The dial: four rungs, picked per piece of work.** The rungs are `slice`, `milestone`, `bet`, and `program`. Each means "run continuously up to this boundary, then pause for me." Slice mode is the most careful. Program mode pushes a whole ladder of bets autonomously. You pick the rung at the seal and can change it mid-run by command. Project policy sets per-lane defaults. Sensitive paths can force a lower rung.
- **Run mode is recorded state, not conversation.** Every would-be pause consults the recorded mode mechanically. A chat instruction decays: it loses to skill prose and erodes across compaction. A recorded mode survives both. The proving failure is in [evidence.md](evidence.md): an explicit "deliver as many bets as possible" instruction still stopped after one milestone, because the workflow's default mode outranked the chat.
- **The default rises with model capability, on evidence.** At each model generation, the measured record justifies raising the per-lane default. That record is escapes, bounce rates, and waiver counts per mode, from the ledgers. The raise runs under the same review discipline as every other `dated` setting.
- **The stopping rule is a short, mechanical list.** A genuine stop is only: an amendment (the sealed design or proof is wrong); a destructive or one-way action; a red row that needs a waiver; a permission-boundary crossing; or a blocking-concern escalation the frontier driver cannot resolve. Everything else takes the best-practice call, records it as default-plus-veto, and continues.
- **Checkpoints are non-blocking.** Milestone close still runs the full battery, writes the postmortem, updates the Map, and emits the three-line delta with a deep link. It does not wait. Ratifications batch to the next genuine stop or to bet close.
- **Acceptance seals batch.** Your drive of the product queues. The run continues. The Map renders acceptance debt loudly. The one exception: work that depends on an unaccepted contract change is a genuine stop.
- **Context economics during the run.** Milestone boundaries are hand-off points, not compaction points. A fresh frontier driver context resumes from the ledgers. Execution-tier workers deliver the slices. Frontier review batches per milestone.
