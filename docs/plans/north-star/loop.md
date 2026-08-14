# Part 3: The Loop

## Units of work

A **slice** is the smallest unit of delivered work. It is one coherent change that an agent claims is done. The system must then prove that claim.

A slice stays unaccepted until the battery, the adversary, and — depending on the lane — the human all agree.

The same word covers every lane: a patch's single commit is a slice. A bet milestone is delivered as a set of slices. A scaffold capability landing green is a slice.

A slice has three parts:

- **The change.** It lands as one commit. The commit carries machine-readable trailers that the Map reads (the derivation contract, [surfaces.md](surfaces.md)).
- **The capsule.** A short note the reviewer can read in two minutes. It covers:
  - what changed and why
  - risk inputs — paths touched, blast radius, how cleanly it reverts
  - how it was verified

  The capsule exists so review is a trust decision — "do I believe this?" — instead of the reviewer having to reconstruct the rationale from a bare diff.
- **Its proof.** The battery results, plus any doc-update obligations that were discharged or waived.

Three rules hold regardless of lane:

- A slice must be reviewable in one sitting. An oversized slice has to split.
- The agent context that wrote a slice never reviews it.
- Every slice enters the Queue for human review, unless a seal or its lane already covers it. A green scaffold row bulk-accepts under the birth seal. The dial can batch acceptance. A patch ships on the battery alone — the Queue still shows the patch as landed, but as visibility, not as a gate.

A **bet** is a goal reached through milestones. Each milestone is a user-visible step. It is proved at the front door — the shipping build, driven the way a user drives it. A milestone is delivered as a set of slices.

A **program** is a goal reached through bets.

## Programs

A program is authored and sealed. It has a goal, a falsifiable definition of done, and an ordered ladder of bets — including bets that have not started yet.

Only the next bet is designed in full. Later bets get one line and a proof sketch. They are designed on arrival, using what delivery has taught by then.

The program walk follows the same discipline as the bet walk. The ladder is reviewed as a diagram first. Sequencing is argued. Then it is sealed.

Program acceptance means driving the goal's front door — it is not a sum of bet statuses. This mirrors bet→milestone exactly, one level up. It is what makes "is this program done?" answerable from a rendered page.

At dial `program`, the walk does two more things.

First, it triages every bet on the ladder. A standard bet will be designed on arrival by the driver, under the standing rulings. A complex bet will need a walk with you. The output is the appointment list: before the run starts, you know which human moments the program holds, and roughly when they arrive. Unattended, here, means only these named appointments.

Second, the walk seeds the standing rulings with the cross-cutting calls every bet would otherwise ask about one at a time — naming, contract shapes, UX patterns, library policy. Ruling them once here is what makes design-on-arrival safe.

## Lanes

Triage puts each piece of work into one of three lanes. When two lanes could both fit, the lighter one wins.

One override: a change touching the human-sealed critical-paths list takes the standard lane, no matter how small. (This is the same list Queue ranking uses — [surfaces.md](surfaces.md).) The reason: the worst small change on record was a one-liner that passed every gate and killed a site build.

A post-hoc lane audit compares diff size and blast radius against the declared lane. A mis-lane shows up as a rendered fact on the Map.

The patch lane is review-free by design, so it needs its own watch: the milestone-sum adversary samples recently landed patches at milestone close. That keeps the lane cheap without leaving it completely unwatched.

| Lane | Design depth | Seals | Verification |
|---|---|---|---|
| Patch | None | None — checks only | Battery. The commit's trailers feed a patch ledger; a cluster of patches in one area is the signal that the area deserves a bet |
| Standard | Proof plan, including the proof cases. Inside a bet, intention is inherited from the pitch; outside one, the plan opens with a why-line | Acceptance | Battery + adversary + drive artifact |
| Complex | Full design walk: journeys → pages → data flows → business logic → API → schema → proof plan | Design-walk seal, acceptance | Everything above + design docs merge into the Record |

Work that bypasses the lanes still shows up. A commit that lands with no lane trailer renders on the Map as unlaned work. This is recorded because bypasses have happened before — one 11 MB session delivered seven bet-labeled commits almost entirely outside the machinery, invisibly.

Two intake rules keep the world's own changes from jamming the loop.

First: a red dependency-audit row auto-files into intake. Routine bumps go to the patch lane; breaking upgrades get promoted toward a bet. Work intake stays the one front door for proposed work — this is a fast-path triage rule inside that front door, not a second door.

Second: a row that turns red because the world changed — a new CVE, a deprecation — renders as environment-red, not you-broke-it red. That distinction means it never blocks unrelated slices.

## The design walk

The walk reviews pictures before prose. Sequencing and flows are argued as diagrams first.

The agent proposes options with a recommendation, instead of asking open-ended questions. Each consequential decision gets its own turn — decisions don't arrive bundled together. What's already been ruled gets a one-line recap; full detail is spent only on what's new.

Both design tracks start with a walkthrough, and the walkthrough is argued first.

**For UI/UX, the walkthrough is the user journey.** It happens in order:

1. The journey map comes first. Every capability sits on a named journey that starts at a real entry point.
2. Then each page on the journey is designed.
3. Then each page gets its information architecture — what lives on it, what it links to, and which current best-practice pattern it uses, implemented fully.

Placement is a design decision made at this step: new work must say where it lives on the map, next to what, and how it's reached.

The map itself is a living, sealed artifact. It merges into the Record at bet close, and every later bet that adds UI amends it.

This order exists because its absence is a recorded failure class: working screens nobody could reach, journeys that dead-ended, capabilities scattered across the app.

**For system design, the walkthrough is the data flow.** It also happens in order:

1. Data flows come first.
2. Business logic gets its own step — the rules, invariants, and state transitions. This is what the product decides, not just where data moves.
3. API and schema come after, shaped to serve the logic.

The old walk led with API and repository design and downplayed the logic. That was backwards: endpoints and tables are consequences of the rules, not the other way around.

On the complex lane, the walk ends with the proof plan ([proof.md](proof.md)) — the cases, fixture axes, and real-versus-faked choices that will prove the work. Arguing what would prove the design is part of arguing the design itself, and the human seals both together.

This is the upstream half of the defense against the mining's dominant defect class: tests green while behavior was wrong.

Per-discipline conventions — system design, data flows, business logic, DB schema, API schema, UI/UX — each state the artifact shape, the walk, and where the seal lands. They are identical across bets and programs.

These conventions, plus the loop's philosophy, live in a short ways-of-working section of the shipped docs. That section is kept because the philosophy must be taught to the agent. No check can convey it.

## Writes

Every ruling writes to the decisions ledger. Every bounce writes its reason to the findings ledger.

Every finding records what caught it — which review, which check, which human — plus a defect-class tag. (Today's ledger already has the catcher field, but across 114 recorded findings it was never filled in once. The mining that found this is in [evidence.md](evidence.md).)

The class tag feeds the learning loop: a class that recurs triggers a change to the process that generates it — a rule, a check, a template, or a walk — not another layer of catching.

A defect found in real use, after acceptance, enters the same ledger, with catcher "the owner, in use" and a class tag attached. This way escapes feed the same loop instead of living only in patch commit messages.

A seal is a git tag. The amendment protocol is the only way it moves: stop, show before and after, move the tag only on the owner's explicit words, then record the amendment.

Every seal records the battery version it was granted under.

Nothing that proves or attributes work is deleted at archive time. The old process deleted the raw per-slice review files when a bet closed. That destroyed most of its own attribution evidence — which is why "which parts earn their keep" took forensics to answer.

## The journal

Alongside the ledgers, the CLI keeps an append-only journal. It is one machine-readable line per operational event, written automatically the moment the CLI acts.

The events it logs:
- a battery run and each row's outcome
- a dispatch, with its role, tier, token count, wall-clock duration, and whether it escalated
- a seal granted or moved
- a waiver
- a dial change
- a lane triage
- an archive
- a teach-back and the decisions it covered
- a hook firing
- a run heartbeat
- a flake event
- an update event
- a break-glass ship
- a flag flip
- in dev mode, a method-friction note ([surfaces.md](surfaces.md))

The CLI writes every line. There are no free-form writes: anything that relies on someone remembering doesn't get recorded, and 0-of-114 proved it. The one named exception is dev mode's method-friction note, which is entered through a CLI verb, structured and class-tagged.

Lines cost bytes. They live outside the work's commit graph, in a dedicated journal ref per repo, keyed by commit hash and session id. This is because an event stream stored in branching history goes bad: parallel bets would merge-conflict it, rebases would double-count it, reverts would delete from an append-only record, and many events — a dial change, a red run on a slice later reworked — have no work commit to ride at all. The ref pushes with the backup push.

Every line stamps its session id, so any entry traces back to its full transcript when depth is needed. This is what turns answered-by-forensics into answered-by-query: auditing the method for this spec took four subagents mining 400 MB of transcripts, because check outcomes existed only as terminal output.

The journal is also where the spec's promised numbers actually come from: the sunset regime's re-justifications, the dial's default raises, the repeat-waiver flags, and governance's tool-measured numbers all read from it.

A debug switch captures full check output and worker-report summaries to a local, uncommitted sidecar keyed by session id. It never writes into the journal ref and never leaves the machine, because full output can carry the very secrets the scans hunt. The secrets scan's own journal line never includes matched content. This switch is off by default, and free when off.

The host's own session transcripts remain the deep archive of last resort.

## The delivery pipeline

The loop today costs a 3-milestone bet roughly 35–45 subagent dispatches, six bookkeeping writes per slice, and 10–15 waiting-on-you moments. The revised pipeline keeps what makes it safe and cuts what doesn't. The cost history is in [evidence.md](evidence.md).

**Per slice:**

1. The frontier driver assembles the worker's task brief. The brief carries the slice's proof plan — the sealed statement of which cases prove this capability and what runs real.

   When a slice exists to update the callers of a changed contract or signature, the driver computes the ripple caller list: every caller the change reaches, computed from committed code (the module graph extends its reach — [record.md](record.md)). This list goes into the brief, so the worker works from a full list instead of grepping and hoping.

   The brief also carries the standing rulings that apply to this slice, copied in the same way as everything else in the brief. A fresh worker cannot honor a ruling it never saw.

2. A fresh execution-tier worker implements the change and hands it off unstaged, so the driver can inspect it before anything commits.

   On the standard lane, this worker writes the slice's tests too, red first. On the complex lane, whatever tests it writes are just scaffolding — the accepting suite comes next, from an author it never meets.

   Blocking-concern escalations are counted; that count tunes the tier policy.

3. On the complex lane, the blind author (execution tier) writes the accepting suite ([proof.md](proof.md)). Its inputs are: the driver-scoped design extract for this slice, the proof plan, and the public interface of the handed-off code — names, signatures, endpoints, extracted mechanically. It never sees the code bodies, and never sees the implementer's tests.

   The scans and seal verify run while the author writes. The new suite runs once it lands. Failures triage through the driver under the laundering rule in [proof.md](proof.md).

4. The battery runs: seal verify (confirms the work still matches what was sealed), the three scans (honesty, wiring, tokens — [proof.md](proof.md)), and the deletion test. Test coverage is proven by the deletion test, not judged from a reviewer's read.

5. **One** fresh-context adversary reviews the diff, blind, for correctness. It also reviews the tests against the sealed proof plan, not against the implementation's own claims.

   Today's loop dispatches three review agents per slice — a blind reviewer, an edge-case tracer, and a coverage auditor, together called the lenses. This collapses to one, because coverage judgment went mechanical in step 4, and edge-case plus honesty judgment moved to milestone close, where the assembled diff gives them more to work with.

6. Findings land in the findings ledger. Each one goes into one of four buckets:
   - **decision-needed** — a real choice the design does not settle; this blocks
   - **fix-now**
   - **defer** — real but pre-existing; it stays rendered on the Map's known-gaps view until closed or promoted into a bet
   - **dismiss** — with the reason kept

   Each finding is also stamped with what caught it. A finding is open until it has a disposition; deferred and dismissed both count as dispositions. A slice cannot close while any finding lacks a disposition, or while any fix-now stays open.

   Fixes run in the worker's existing context where possible. Re-deriving context in a fresh window measured about 41% of the original build cost, so fixing in place is the default, and a fresh dispatch is the fallback.

7. The cleanup pass ([standards.md](standards.md)) runs on the standard and complex lanes: narration comments get stripped, structure gets simplified.

   Then the slice commits with its trailers. A backup push to the bet branch runs right after, so no work is ever only local — the push carries tags and the journal ref along with the branch. Every git write in a repo goes through one CLI writer queue, one at a time; this is the built answer to the worktree lock failures the evidence file warns about.

   Total bookkeeping: the commit plus two ledger entries. Today's loop also writes a board file, a memory log, and hand-refreshed status and proofs pages every slice — six writes in all. Those pages are now derived by the Map from the commits and ledgers instead.

8. A fresh-context subagent (execution tier) writes the capsule. It is handed the facts it needs — the diff, the proof plan, the findings — so it only has to render them into plain prose, never go researching.

   The slice then enters the Queue, unless a prior seal already covers it.

**Per milestone close:**
- Battery rows: the milestone's headline cases driven end to end through the UI ([proof.md](proof.md)), the visual smoke set (render, a11y, token conformance), and the board reconciliation ([proof.md](proof.md)). Every proof on the next milestone must be red for the right reason; every proof on claimed-done slices must be green. The right-reason check matters because stubs have shipped before with their key assertions commented out — red-looking, but proving nothing.
- Three kinds of frontier read, no more (the milestone-sum read may split across windows when the assembled diff outgrows one):
  - A screenshot review against the design system. This also carries the polish verdict — today's separate polish stage folds in here.
  - The milestone-sum adversary: the honesty audit with its tell catalog, edge-case judgment over the assembled diff, the test audit that extends the suite with what the tests fail to prove, and a sample of recently landed patches checked for lane mis-triage ([proof.md](proof.md)).
  - An experience audit of the running product. It walks each journey the milestone touched, end to end, cold. It audits the journey, not the diff, because a broken journey is exactly what per-slice review cannot see.
- Known-gaps entries opened this milestone go through one mechanical triage row. Each is classified as still cheap, now expensive, or promote — based on how much has come to depend on it since it was deferred. Deferral stays honest only while its price is watched.
- The postmortem answers four questions, written to the ledger, one line each unless there's a real finding:
  1. Did the milestone honestly prove its intent at the front door?
  2. What did building it teach that the remaining plan does not know?
  3. Were plan changes routed through amendments, rather than made silently?
  4. What must the next milestone or validation remember?

  No narrator subagent is dispatched to present this — the Map's milestone page carries it. Nothing blocks unless the dial says so.
- The next milestone is sliced before close, using what delivery taught. Slicing is checked in both directions: every slice's proof traces back to the sealed design, and everything the design names as user-facing lands in some slice's proof or a recorded deferral. The second direction exists because it failed once — a sealed, spec'd Undo pattern belonged to no slice. Every slice was individually correct, and the gap surfaced only at the whole-bet gate.

**Per bet close:**
- Battery rows, not ceremony steps: full suite, whole-bet seal verify, contract verification, capture of the served API spec into the Record, every capability-ledger cell filled, and the visual smoke set.
- Acceptance: you drive the agreed front-door cases, and the drive artifact is recorded. Batching follows the dial; acceptance debt renders on the Map.
- Release: the close stamps a product version, derives a user-facing changelog from the capsules, and — where the topology deploys — runs the release probe against the real target ([proof.md](proof.md)).

  Staged exposure, where a product needs it, lives at the deploy layer (channels, percentages) or behind feature flags. Flags are opt-in ([proof.md](proof.md)) and carry one hard rule: branches isolate unfinished work, flags control exposure of proven work. A flag gates who sees a capability — never whether it is proven. A red row is never excused by a flag.
- The retrospective mines the ledgers mechanically: recurring defect classes and the upstream changes they demand, escalation counts, and the previous bet's action items. It also checks the sealed program ladder for later bets this delivery has invalidated. That check exists because it has happened before — a sibling bet shipped and voided a sealed milestone's whole premise mid-bet. It is a Map signal now, not a question someone must remember to ask.
- Archive, merge on your go-ahead, teardown. Archival keeps the proofs, the findings, and the review outputs. It deletes no tests, because there is no separate bet suite to delete ([proof.md](proof.md)) — only proofs the plan marked retire-at-close go.

**The cost frame is tokens, not dispatches.** Many small dispatches are fine. What matters is total token consumption per delivered slice.

So this spec publishes no dispatch-count target. Counted honestly, with every role this spec adds included, dispatches go up, not down — the count was never the point.

What the design actually claims is that the big token costs all move down: every window carries the cut corpus (about 500 always-on words instead of today's skill stack), bulk work runs at the execution tier, briefs replace transcripts, one adversary replaces three per slice, and derived pages replace six hand-written ones.

The additions — the blind author, the capsule writer, the auditor's larger mandate — are hypotheses that must earn their spend. The instrument is the journal: token cost per delivered slice, by role and tier, with the driver session included (recorded as role `driver`), published as a trend the way the word count is. Expected bounce rounds are part of the cost model, not an exception to it — the old measured cost included rework, so the new one does too.

Slice bookkeeping still drops from six writes to two. Pauses drop to the seals plus whatever rungs the dial chooses. Decisions per sitting are counted against each lane's decision budget ([surfaces.md](surfaces.md)), instead of being asserted low.

## Continuous delivery

A lined-up bet or program runs to completion without stopping just to show someone. This is a core capability, and the battery is what earns it. The old system paused everywhere, because prose review was its only guard. Here, every slice passes probes, the adversary, and the scans before the run moves on.

The promise is zero *unscheduled* stops, not zero stops. Every moment that will need the owner can be named before the run starts.

- **The dial has four rungs, picked per piece of work.** They are `slice`, `milestone`, `bet`, and `program`. Each means "run continuously up to this boundary, then pause for me." Slice is the most watchful; program pushes a whole ladder of bets autonomously.

  You pick the rung at the seal, and can change it mid-run by command. Project policy sets per-lane defaults. Sensitive paths can force a lower rung. Probe coverage also caps the rung mechanically: the effective rung cannot exceed what coverage of the touched paths supports.

  Autonomy is bought with verification, not granted by a task label. This enforces goal 11 ([index.md](index.md)), and it is why a young brownfield install runs at a watchful rung no matter what the default says.

- **Run mode is recorded state, not conversation.** Every would-be pause consults the recorded mode mechanically.

  A chat instruction decays — it loses to skill prose and erodes across compaction. A recorded mode survives both. The proving failure is in [evidence.md](evidence.md): an explicit "deliver as many bets as possible" instruction still stopped after one milestone, because the workflow's own default pause outranked the chat.

- **The launch gate.** No run at dial `bet` or above starts on an unready plan.

  Before launch, a fresh-context agent reads the sealed artifacts and forecasts every decision the delivery will force. Each item must already be answered by the plan or a standing ruling, ruled now, or explicitly delegated — the agent's call, made on the record. An open item blocks the launch.

  The same gate also checks the ground: battery green where the run starts, the services and credentials the probes need actually present, the permission model ([doors.md](doors.md)) in place. A question surfaced at launch costs a minute; the same question at 2am costs the night.

  Inside a program run, the gate reruns at each bet boundary. That rerun is cheap — a fresh forecast of what the finished bets taught. Most new decisions it finds are the driver's to make under the decision discipline. One that needs a design walk parks its bet for the next appointment.

- **The default rises with model capability, on evidence.** At each model generation, the measured record — escapes, bounce rates, and waiver counts per mode, from the ledgers — justifies raising the per-lane default, under the same review discipline as every other `dated` setting.

  The count of found escapes falls as the dial rises, because humans are what find escapes, and higher rungs mean less human contact. So escape counts are read against how much driving happened — escapes per accepted drive, not per month — and a default raise requires a minimum number of sampled drives in the period its evidence comes from.

- **The stopping rule is a short, mechanical list.** A genuine stop is only one of these:
  - an amendment (the sealed design or proof is wrong)
  - a destructive or one-way action
  - a red row that needs a waiver
  - a permission-boundary crossing
  - a blocking concern the frontier driver cannot resolve
  - work that depends on a contract change you have not yet accepted

  Everything else takes the best-practice call and continues.

  The list is a reversibility test, not a mood: every entry costs real work or real trust to undo. That is the premise of the whole loop. Pattern and practice calls are the agent's to make. Working code never waits for someone to watch it being written.

- **What gets a ledger line.** Recording follows the same reversibility test.

  Below the significance line, a call is simply made: the code is the record, and the battery is the guard. Below the line means no public interface, no schema, no cross-bet reach in the module graph, and no touch on the critical-paths list.

  Above the line, the call is recorded as a default the owner can later veto, and the run continues.

  Two things widen the line beyond code topology. First, behavior a user will see sits above the line no matter how small the diff — a default, a message, an edge case the design never named. A product decision often dresses up as a pattern choice; it still gets decided, but always on the record, never silently. Second, the line is live: what makes a deferred call cheap is how little depends on it so far. If later slices start building on a below-the-line shape, it is promoted and recorded right then, not at the postmortem.

  One heuristic sits on top of the mechanics: a call the driver would not volunteer to explain is rendered loud, whatever its category.

- **Never ask the same question twice.** Every answer the owner gives — a walk ruling, a veto outcome, an amendment answer — lands in the decisions ledger as a standing ruling. The driver consults the rulings before escalating. An escalation that an existing ruling already covers is a driver defect, journaled like any other. A recurring escalation class promotes into project policy, the way bounce reasons feed the standards sheets.

  The measurable claim: escalations per delivered slice fall from one run to the next.

  A new ruling earns trust the way code does — through a canary. For the first few slices that lean on it, the adversary checks the ruling as well as the diff. This catches a wrong-but-consistent default while a handful of slices depend on it, not fifty.

- **Park, don't stop.** At dial `program`, a genuine stop scoped to one bet parks that bet. The run keeps delivering the work that does not depend on it, and truly stops only when nothing unblocked remains.

  Design-on-arrival is the scheduled case: a bet whose design walk has not happened yet parks for the walk, and the launch forecast named that moment in advance — an appointment, not a surprise. While the bet is parked, the driver drafts its walk artifacts from what delivery has taught so far, so your appointment is walking a prepared proposal, not designing from a blank page.

  One boundary: an amendment parks the bet it belongs to, but an amendment to the program ladder itself stops the run, because continuing would build on a broken premise.

  The Map renders parked items, and the push notification fires on a park as well as a stop.

- **Containment is mechanical too.** A slice still red after a capped number of fix rounds becomes a genuine stop instead of a loop. A per-run token ceiling, read from the journal, pauses the run cleanly when spent.

  The run writes a heartbeat the tower watches, so a dead run — crash, sleep, exhausted quota — is flagged rather than mistaken for a slow one. The worker's unstaged work, plus the journal position, make resumption cheap.

  At dial `bet` and above, a push notification on genuine stops is part of the deal, not an optional nicety: an unattended run that stops silently at hour one wastes the whole night.

  Debt throttles the dial the same way thin probe coverage does. Open known-gaps items, unratified defaults, and the age of acceptance debt are read from the journal. Past a threshold, the effective rung drops a notch. A bet cannot close over undisposed gaps it opened.

- **Checkpoints are non-blocking.** Milestone close still runs the full battery, writes the postmortem, updates the Map, and emits the three-line delta with a deep link. It does not wait. Your ratification of the recorded default decisions batches to the next genuine stop or to bet close.

- **Acceptance seals batch.** Your drive of the product queues; the run continues; the Map renders the acceptance debt loudly. Work that depends on an unaccepted contract change stops the run — it is on the stopping list above, not an exception to it.

- **Context economics during the run.** Milestone boundaries are hand-off points, not compaction points: a fresh frontier driver resumes from the ledgers. Execution-tier workers deliver the slices. Frontier review batches per milestone.

## The teach-back

The dial lets whole bets land while you are away. The attention principle keeps every message short. Together, these create a new debt: the product can move faster than your understanding of it.

That debt matters because your judgment is the one thing the loop treats as irreplaceable, and judgment runs on understanding. A design walk with an owner who no longer knows the system is a worse walk.

The teach-back is how understanding catches up. It is not an interruption to be minimized — it is what the saved attention is for.

**When.** It rides moments you are already spending, and it never blocks.

- At acceptance: before you drive the front door, a walk-up brief covers what was built, why, and what to try.
- At return: when work landed since you last looked, the session-start snapshot ends by offering it.
- On demand: "teach me what changed," any time.

**What.** Four things, exceptions-first, nothing else:

- New capabilities at the front door: what the product does now that it did not before.
- The decisions made for you — the recorded defaults you can still veto — taught first, because a veto you never heard about is not a veto.
- Where complexity was added, and the argument that it was worth it.
- New concepts and seams you will meet as vocabulary in the next design walk.

A patch-sized delta has nothing to teach, so its teach-back is empty. The teach-back scales with the delta, not the lane.

**How.** In chat, by the driver, as a conversation: you ask, it answers. Everything taught is drawn from the record with its sources named — the same copy-in rule every message follows ([index.md](index.md)).

The docs stay the home; the teach-back is just delivery and pacing.

It is not the deleted checkpoint narrator coming back ([changes.md](changes.md)). The narrator retold status on a schedule, to nobody in particular. A teach-back never retells — it carries only the delta that changes what you know or what you would decide.

**Two loops it feeds.** First, you are a live run of the cold-reader eval: a question you ask that the docs cannot answer becomes a doc finding, filed like any other ([record.md](record.md)).

Second, teaching debt is visible. The journal records each teach-back and the decisions it covered, so the Map can count the decisions made for you that nothing has walked you through yet ([surfaces.md](surfaces.md)).

The teach-back is `dated` like every other mechanism. It carries a falsifiable check: for a sample of design walks, record whether the owner's opening questions were about things the teach-back had already covered. A teach-back that leaves the next walk cold is not working, however many decisions it marked covered.

## Operating what shipped

The loop above covers building. Three operational moments after the merge get machinery of their own:

- **The break-glass patch.** A production incident cannot wait for a full battery. One command ships a patch after running only the probes for the paths it touches.

  It records itself loudly — a journal event and a Map banner — and auto-files the skipped checks as an open finding that blocks the next normal slice. This way the debt gets paid within a slice, instead of forgotten. The post-incident finding enters the ledger with class and catcher, like any escape.

- **Production signals reach the Queue.** The monitoring the standards ship gets read, not just emitted. Alerts and user reports enter work intake like any other captured item — so a 2am page and a bug email land in the same triage as planned work, not in a side channel no surface shows.

- **Backward moves are first-class.** There are two kinds.

  *Withdrawn*: an abort verb closes a half-delivered bet. The board freezes in a withdrawn state, the branch tip is tagged so its evidence survives teardown, each open finding gets a disposition or a new home, and the program ladder is amended.

  *Reverted*: un-shipping a capability cascades. Its proofs retire by recorded decision, `remove-capability` drops the manifest row, the reversal rule re-reviews dependent docs, and the Map annotates the bet's view rather than pretending it never shipped.

  Both exist because the record shows both happening — a milestone formally withdrawn, escapes reverted — with no machinery to receive them.
