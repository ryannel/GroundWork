# Part 3: The Loop

## Units of work

A **slice** is the atomic unit of delivered work: one coherent change that an agent asserts is done, and that the system must then prove. A slice stays unaccepted until the battery, the adversary, and (per lane) the human agree. One vocabulary across all lanes: a patch's single commit is a slice; a bet milestone is delivered as slices; a scaffold capability landing green is a slice.

A slice consists of:
- **The change** — landing as one commit that carries the machine-readable trailers the Map parses (the derivation contract, [surfaces.md](surfaces.md)).
- **The capsule** — a short note the reviewer reads in two minutes: what changed, why, risk inputs (paths touched, blast radius, how cleanly it reverts), and how it was verified. The capsule exists so review is a trust decision — "do I believe this?" — instead of the reviewer reconstructing the rationale from a bare diff.
- **Its proof** — the battery results attached, plus any doc-update obligations discharged or waived.

Hard properties: a slice is capped at reviewable-in-one-sitting, so an oversized slice must split. The agent context that wrote a slice never reviews it. Every slice enters the Queue for human review unless a seal already covers it — a green scaffold row bulk-accepts under the birth seal, and the dial can batch acceptance.

A **bet** is a goal reached through milestones. Each milestone is a user-visible step, proved at the front door: the shipping build, driven the way a user drives it. A milestone is delivered as slices. A **program** is a goal reached through bets.

## Programs are first-class

A program is authored and sealed: a goal, a falsifiable definition of done, and an ordered ladder of bets — including bets not yet started. Only the next bet is designed in full. Later bets are one line and a proof sketch, designed on arrival with what delivery taught.

The program walk is the same discipline as the bet walk: the ladder is reviewed as a diagram first, sequencing argued, then sealed. Program acceptance is driving the goal's front door, not summing bet statuses. This mirrors bet→milestone exactly, one level up. It is what makes "is this program done?" answerable from a rendered page.

## Lanes

Triage puts each piece of work in one of three lanes. When two lanes could both fit, the lighter one wins. A post-hoc lane audit compares diff size and blast radius against the declared lane. A mis-lane is a rendered fact on the Map.

| Lane | Design depth | Seals | Verification |
|---|---|---|---|
| Patch | None | None — checks only | Battery. The commit's trailers feed a patch ledger; a cluster of patches in one area is the signal that the area deserves a bet |
| Standard | Intent paragraph, including the proof cases | Intent, acceptance | Battery + adversary + drive artifact |
| Complex | Full design walk: UI → flows → API → schema → proof plan | Design-walk seal, acceptance | Everything above + design docs merge into the Record |

Work that bypasses the lanes still shows: a commit landing with no lane trailer renders on the Map as unlaned work. The bypass is recorded because bypasses happened — one 11 MB session delivered seven bet-labeled commits almost entirely outside the machinery, invisibly.

## The design walk

The walk reviews pictures before prose: sequencing and flows are argued as diagrams. The agent proposes options with a recommendation instead of asking open-ended questions. Each consequential decision gets its own turn instead of arriving in a bundle. What's already ruled gets a one-line recap; full detail is spent only on what's new.

On the complex lane the walk ends with the proof plan ([proof.md](proof.md)): the cases, fixture axes, and real-versus-faked choices that will prove the work. Arguing what would prove the design is part of arguing the design, and the human seals both together. This is the upstream half of the defense against the mining's dominant defect class — tests green while behavior was wrong.

Per-discipline conventions (system design, data flows, DB schema, API schema, UI/UX) each state the artifact shape, the walk, and where the seal lands. They are identical across bets and programs. These conventions, plus the loop's philosophy, live in a short ways-of-working section of the shipped docs. That section is kept because the philosophy must be taught to the agent; no check can convey it.

## Writes

Every ruling writes to the decisions ledger. Every bounce writes its reason to the findings ledger. Every finding records what caught it — which review, which check, which human — and a defect-class tag. (Today's ledger has exactly the catcher field, and across 114 recorded findings it was never filled in once; the mining that found this is in [evidence.md](evidence.md).) The class tag feeds the learning loop: a class that recurs triggers a change to the process that generates it — a rule, a check, a template, or a walk — not another layer of catching.

A seal is a git tag, and the amendment protocol is the only way it moves: stop, show before and after, move the tag only on the owner's explicit words, record the amendment. Every seal records the battery version it was granted under.

Nothing that proves or attributes work is deleted at archive time. The old process deleted the raw per-slice review files when a bet closed, which destroyed most of its own attribution evidence — that is why "which parts earn their keep" took forensics to answer.

**The journal.** Alongside the ledgers, the CLI keeps an append-only journal: one machine-readable line per operational event, written automatically at the moment the CLI acts. The events: a battery run and each row's outcome; a dispatch with its tier, token count, and whether it escalated; a seal granted or moved; a waiver; a dial change; a lane triage; an archive. No human or agent ever writes it — anything that needs remembering doesn't get recorded, and 0-of-114 proved it. Lines cost bytes, ride the commits they describe, and stamp the session id, so any journal entry can be traced back to its full transcript when depth is needed. This is what turns answered-by-forensics into answered-by-query: auditing the method for this spec took four subagents mining 400 MB of transcripts, because check outcomes existed only as terminal output. The journal is also where the spec's promised numbers actually come from — the sunset regime's re-justifications, the dial's default raises, the repeat-waiver flags, and governance's tool-measured numbers all read from it. A debug switch widens journal lines to full check output and worker-report summaries; it is off by default and costs nothing when off. The host's own session transcripts remain the deep archive of last resort.

## The delivery pipeline

The loop today costs a 3-milestone bet roughly 35–45 subagent dispatches, six bookkeeping writes per slice, and 10–15 waiting-on-you moments. The revised pipeline keeps what makes it safe and cuts what doesn't. The cost history is in [evidence.md](evidence.md).

**Per slice:**
1. The frontier driver assembles the worker's task brief, which carries the slice's proof plan — the sealed statement of which cases prove this capability and what runs real. When a slice exists to update the callers of a changed contract or signature, the driver computes the caller list from committed code and puts it in the brief, so the worker works a full list instead of grepping and hoping.
2. A fresh execution-tier worker implements to green and hands its changes off unstaged, for the driver to inspect before anything commits. Blocking-concern escalations are counted; that count tunes the tier policy.
3. The battery runs: seal verify (the work still matches what was sealed), the three scans (honesty, wiring, tokens — [proof.md](proof.md)), and the deletion test. Test coverage is proven by the deletion test, not judged from a reviewer's read.
4. **One** fresh-context adversary reviews the diff, blind, for correctness — and reviews the tests against the sealed proof plan, not against the implementation's own claims. Today's loop dispatches three review agents per slice — a blind reviewer, an edge-case tracer, and a coverage auditor, together called the lenses. This collapses to one because coverage judgment went mechanical in step 3, and edge-case plus honesty judgment moved to milestone close, where the assembled diff gives them more to bite on.
5. Findings land in the findings ledger, each in one of four buckets — decision-needed (a real choice the design does not settle; blocks), fix-now, defer (real but pre-existing), dismiss (with the reason kept) — and each stamped with what caught it. A slice cannot close over an open finding. Fixes run in the worker's existing context where possible: re-deriving context in a fresh window measured about 41% of the original build cost, so fixing in place is the default and a fresh dispatch is the escalation.
6. The slice commits with its trailers, and a backup push to the bet branch runs so no work is ever only local. Total bookkeeping: the commit and two ledger entries. Today's loop also writes a board file, a memory log, and hand-refreshed status and proofs pages every slice — six writes. Those pages are now derived by the Map from the commits and ledgers.
7. A fresh-context subagent writes the capsule. The slice enters the Queue unless a prior seal covers it.

**Per milestone close:**
- Battery rows: the visual smoke set (render, a11y, token conformance) and the board reconciliation ([proof.md](proof.md)) — every proof on the next milestone red for the right reason, every proof on claimed-done slices green. The right-reason half exists because stubs have shipped with their key assertions commented out: red-looking, proving nothing.
- Three frontier reads, no more: a screenshot review against the design system, which also carries the polish verdict (today's separate polish stage folds in here); the milestone-sum adversary — the honesty audit with its tell catalog plus edge-case judgment over the assembled diff ([proof.md](proof.md)); and an experience audit of the running product.
- The postmortem answers four questions, written to the ledger, one line each unless there is a real finding: did the milestone honestly prove its intent at the front door; what did building it teach that the remaining plan does not know; were plan changes routed through amendments rather than made silently; what must the next milestone or validation remember. No narrator subagent is dispatched to present this — the Map's milestone page carries it. Nothing blocks unless the dial says so.
- The next milestone is sliced before close, from what delivery taught. Slicing is checked in both directions: every slice's proof traces to the sealed design, and everything the design names as user-facing lands in some slice's proof or a recorded deferral. The second direction exists because it failed once — a sealed, spec'd Undo pattern belonged to no slice, every slice was individually correct, and the gap surfaced only at the whole-bet gate.

**Per bet close:**
- Battery rows, not ceremony steps: full suite, whole-bet seal verify, contract verification, capture of the served API spec into the Record, every capability-ledger cell filled, the visual smoke set.
- Acceptance: you drive the agreed front-door cases and the drive artifact is recorded. Batching follows the dial, with acceptance debt rendered on the Map.
- The retrospective mines the ledgers mechanically — recurring defect classes and the upstream changes they demand, escalation counts, the previous bet's action items — and checks the sealed program ladder for later bets this delivery has invalidated. That check exists because it has happened: a sibling bet shipped and voided a sealed milestone's whole premise mid-bet. It is a Map signal now, not a question someone must remember to ask.
- Archive, merge on your go-ahead, teardown. Archival keeps the proofs, the findings, and the review outputs — and deletes no tests, because there is no separate bet suite to delete ([proof.md](proof.md)); only proofs the plan marked retire-at-close go.

Target arithmetic for the same 3-milestone, 8-slice bet: frontier dispatches drop from about 35 to about 20 (one per slice, three per milestone, three doc reviews). Slice bookkeeping drops from six writes to two. Waiting-on-you moments drop from 10–15 to the seals plus whatever pauses the dial chooses.

## Continuous delivery

A lined-up bet or program runs to completion without stopping just to show someone. This is a core capability, and the battery is what earns it: the old system paused everywhere because prose review was its only guard; here every slice passes probes, the adversary, and the scans before the run moves on.

- **The dial: four rungs, picked per piece of work.** `slice`, `milestone`, `bet`, `program` — each means "run continuously up to this boundary, then pause for me." Slice is the most watchful; program pushes a whole ladder of bets autonomously. You pick the rung at the seal and can change it mid-run by command. Project policy sets per-lane defaults. Sensitive paths can force a lower rung.
- **Run mode is recorded state, not conversation.** Every would-be pause consults the recorded mode mechanically. A chat instruction decays: it loses to skill prose and erodes across compaction. A recorded mode survives both. The proving failure is in [evidence.md](evidence.md) — an explicit "deliver as many bets as possible" instruction still stopped after one milestone, because the workflow's own default pause outranked the chat.
- **The default rises with model capability, on evidence.** At each model generation, the measured record — escapes, bounce rates, and waiver counts per mode, from the ledgers — justifies raising the per-lane default, under the same review discipline as every other `dated` setting.
- **The stopping rule is a short, mechanical list.** A genuine stop is only: an amendment (the sealed design or proof is wrong); a destructive or one-way action; a red row that needs a waiver; a permission-boundary crossing; or a blocking concern the frontier driver cannot resolve. Everything else takes the best-practice call, records it in the decisions ledger as a default the owner can later veto, and continues.
- **Checkpoints are non-blocking.** Milestone close still runs the full battery, writes the postmortem, updates the Map, and emits the three-line delta with a deep link. It does not wait. Your ratification of the recorded default decisions batches to the next genuine stop or to bet close.
- **Acceptance seals batch.** Your drive of the product queues; the run continues; the Map renders the acceptance debt loudly. The one exception: work that depends on a contract change you have not yet accepted is a genuine stop.
- **Context economics during the run.** Milestone boundaries are hand-off points, not compaction points: a fresh frontier driver resumes from the ledgers. Execution-tier workers deliver the slices. Frontier review batches per milestone.
