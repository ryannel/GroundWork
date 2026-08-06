# GroundWork north star

**Status:** PROPOSED. Nothing here is executed. This set is the decision artifact. If it is ratified, an execution plan follows in the repo's standard plan format.
**Audience:** The owner, and any agent executing the rebuild later.
**Scope:** The whole framework.

## What this set is

A specification for what GroundWork becomes. It is grounded in the 2026 research survey (`docs/research/ai-developer-workflows-2026-07.md`) and in what this framework's own use has proven and disproven. The supporting numbers, sources, and history live in [evidence.md](evidence.md). The build, keep, and delete lists live in [changes.md](changes.md).

How to read it: this file carries the vision, the goals, and the rules. One file per part carries the mechanics:

1. [The Record](record.md) — living documentation with typed truth anchors and freshness checks.
2. [The Standards](standards.md) — the conventions we adopt, stated as imperatives, enforced by checks.
3. [The Loop](loop.md) — programs, bets, and slices, with ceremony priced by risk.
4. [The Proof](proof.md) — a verification battery agents cannot argue with or edit.
5. [The Queue and the Map](surfaces.md) — the only two review surfaces: what needs you now, and where everything stands, across every project.
6. [Two doors](doors.md) — greenfield and brownfield entry into the same system.

## The words this set uses

Each part defines its own machinery in full. These one-line meanings are here so every file reads on first pass:

- **Slice** — the atomic unit of work: one coherent change plus its proof. **Bet** — a goal reached through milestones, each milestone delivered as slices. **Program** — a goal reached through an ordered ladder of bets.
- **Lane** — the ceremony tier a piece of work is triaged into: patch, standard, or complex.
- **Seal** — a human sign-off, recorded as a git tag. Different moments have different seals: design, acceptance, birth (greenfield), adoption (brownfield).
- **Battery** — the shipped set of mechanical checks, run by one `verify` command. A **probe** is one runnable check in it that drives the real product.
- **Adversary** — a review agent that shares no context with the agent that wrote the work.
- **Blind test author** — on the complex lane, the agent that writes a slice's accepting tests after the build: given the sealed design, the proof plan, and the code's public interface, never its bodies. **Test auditor** — the milestone-close pass that assumes the tests hide something and writes what is missing.
- **Proof plan** — the sealed statement of what will prove a piece of work: the cases, the fixture axes that must vary, and what runs real versus faked. Written before the implementation.
- **The board** — a bet's live view of its sealed proofs, each red or green from the battery's last run. Derived from the one permanent test suite, not a separate copy of it.
- **The journal** — the append-only record the CLI writes automatically as it acts: check outcomes, dispatches, seals, waivers, one line per event. How the method learns from real work without anyone keeping notes.
- **Capsule** — the short note a reviewer reads before judging a slice: what changed, why, risk, how it was verified.
- **The ledgers** — the committed files that hold findings (defects raised) and decisions (rulings made). Chat is never the system of record; these are.
- **The dial** — the recorded setting for how far work runs before pausing for a human: slice, milestone, bet, or program.
- **Teach-back** — the driver teaching the owner in chat what changed while they were away: new capabilities, decisions made by default, complexity added and why. Drawn from the record; never a retelling of it.
- **The tower** — the one always-on local service that serves the Queue and the Map for every registered project, reading state from git rather than from any checkout.
- **Front door** — the product's real entry point, used the way a user uses it. A front-door proof drives the shipping build, not a test harness.

## What GroundWork will be

GroundWork lets one human direct serious software. The human's judgment goes only where it is irreplaceable: saying what to build, shaping the design of complex work, and accepting the result. Every other step is either a mechanical check or agent work that a separate verifier proves. Nothing ships on an agent's own word.

## The track record this builds on

The method has shipped real products. Magpie, a native macOS app in Swift, was built through it: 23 bets taken from pitch to archive, plus a program of four bets run deep. Staycurrent, a TypeScript content platform, delivered a 4-milestone, 15-slice bet through it and is mid-flight on a second. The framework repo builds itself with its own process. (Wordloop, the family's fourth repo, predates the method and was largely hand-built — which is exactly what makes it a useful comparison case in [record.md](record.md).)

We mined the delivery records and session transcripts of those projects for this spec, and the record attributes real catches to specific parts — quotes and counts in [evidence.md](evidence.md):

- The per-slice review agents caught over a dozen "tests green, behavior wrong" bugs that would have shipped silently — including data corruption that re-stamped its own ledger so the loss looked reconciled, and a schema hole that magpie's own mechanical gate missed twice.
- The milestone-level checks caught a class per-slice review structurally cannot see: a missing Undo pattern every slice was individually correct about, a capability that turned out hollow at the front door.
- The mechanical checks earned fewer but real catches — `seal verify` flagged approval tags never re-pointed after amendments — and the findings ledger genuinely blocked slices from closing over open defects.
- The human, driving the real app during validation, found live bugs no agent had caught. That is the strongest argument for keeping the human's drive as a required proof.
- The biggest failure predates the machinery: magpie's first bet went "green" across six milestones while the product did not actually work on real data. The front-door proof discipline exists because of that bet.

The same mining showed which parts never earned their keep, on the framework's own evidence: a per-slice honesty audit that rubber-stamped and was demoted, a re-review step that found zero critical findings and was turned off, a deletion-test verb with no logged runs, a doc-freshness check that ran 106 times in one project and never caught anything. And attribution has a real limit we hit while mining: the archive step deletes the raw review files at bet close, and the findings ledger's "what caught this" field was never filled in once — the framework destroyed much of its own fine-grained evidence. The rebuild fixes that: every finding records what caught it, and review evidence survives archival.

Cost is documented by the framework's own plans: the review-fatigue finding, and the upkeep of 344k words of shipped instruction prose. So the verdict is not "the method failed." It is: keep what demonstrably catches, shed what demonstrably doesn't, stop destroying the evidence that tells them apart — and treat what the catchers keep catching as the pointer to what must change upstream.

## Goals

These are the acceptance criteria for everything in this set.

1. Real, useful documentation for humans and agents, kept current as the system evolves.
2. Human time goes to design, where leverage is high and complexity deserves it.
3. Greenfield: describe intent and get a working product for little input, without sacrificing quality.
4. Brownfield: wrap existing systems in a better way of working.
5. Uniform, high-quality code across sessions; existing code pulled toward the same style.
6. Proof of work: agents cannot cheat.
7. Easy review at both altitudes and across every project: what needs me now, and where the whole program stands — including planned and unstarted work — with zero setup: no server to start, no branch to be on, no page to hunt for.
8. Right-sized ceremony: light by default, heavy only where stakes demand it.
9. Durable memory: decisions, findings, and state live in git, never in a chat window.
10. Human ownership: everything that shipped was accepted by you, and everything complex was designed with you.
11. Autonomy scales with verification: how long work runs unattended is set by how well probes cover the touched area, not by the task's label.
12. Everything reads plainly: docs, capsules, chat, and status that a tired human gets on the first pass.
13. Effective use of context: lean windows, tiered models, distilled hand-offs. The loop is economical by design.
14. Continuous delivery: a lined-up bet or program runs to completion unattended, stopping only for decisions that genuinely need a human and cannot wait.
15. The loop learns: a defect class that recurs changes the upstream process that produces it, not only the check that catches it.
16. The owner stays taught: what was built while you were away, what was decided for you, and where complexity was added and why reach you in chat, paced to your return — the docs hold it, the teach-back delivers it.

## Core principle: effective use of attention

Attention is the scarcest human resource. The framework asks for yours in few moments — intent, complex design, acceptance, and the genuine stops between — and treats each ask as spend. Four rules:

- **Prepared.** A slice arrives as a capsule you can judge in two minutes. A checkpoint is three lines of what changed plus a link; the link is for when you want more, never homework. Reports lead with exceptions. The writer does the reading work, so your attention goes to the judgment itself.
- **Brought to you.** The Queue carries everything waiting on you, across every project, ranked. The Map shows where everything stands. The hooks put your position in front of you at session start and at every checkpoint. If you have to go hunting for the state of your own work, the framework has failed this principle — and that failure is exactly how the old model worked: the right branch, a hand-started server, the right page.
- **Priced.** The dial records how far work runs before it may pause for you. Checkpoints never block. Acceptance batches to moments you choose. A genuine stop is a short mechanical list ([loop.md](loop.md)); everything else records a decision you can veto later and keeps moving.
- **Measured.** Every lane declares how many human decisions it should cost, and the Map reports actuals against that budget — the same way token spend is recorded per dispatch.

Plain writing (content rules, below) serves the same principle: text that must be read twice spends attention twice.

## Core principle: effective use of context

Context is the scarcest machine resource, the way attention is the scarcest human one — the same economy for the other reader. Two disciplines, both enforced.

**In conversation.** Two rules work together. Anything worth keeping — plans, decisions, findings, status — lives on a committed page, because chat is a bad home for it: the transcript is re-sent on every turn, gets cut down at compaction, and a later session cannot see it at all. But a message still carries the part the reader needs, copied straight in, and says which page it came from. A bare link is not a message. It sends the reader off to load a whole page, written for everyone, to find the one paragraph that applies to them — which costs more context than the paragraph itself, and the transcript ends up saying "see the page" where the actual instruction should be. A link on its own is fine only when the writer cannot know what the reader will need; then it carries one line saying what is behind it, so the reader can decide whether to open it. The always-on instruction set stays near 500 words; everything else loads when the task needs it. These are checks and budgets, not habits.

**In execution.** The loop is an orchestrator-worker economy:

- One frontier-class driver (today: the Opus/Fable tier) owns the full picture. It plans, triages, dispatches, and never implements.
- Execution-class workers (today: the Sonnet tier) do the building in fresh, disposable windows. Each receives a short task brief holding what the slice needs — the cases to prove, the paths it will touch, the rules that apply — copied in by the driver, with sources named. Not the conversation so far, and not a list of pages to go read. Each returns a distilled report, not its context.
- Review and gates run at the frontier tier. Judgment is where the higher model pays for itself.
- Workers escalate instead of guessing. A worker that hits a decision it cannot settle stops and raises a blocking concern to the driver. This is in the worker's contract because cheap models measurably fail at judging their own limits; a stuck worker that pushes on produces a dishonest green.
- Tiers are named capability classes, not model names, so the policy survives model churn. Every dispatch states its tier; leaving it off is an error. If a named tier is unavailable, substitute a stronger model, never a weaker one.
- State lives in files and git, not in long windows. A window nearing its limit writes its state to the ledgers, and a fresh window resumes from them. Compaction is treated as lossy.
- Token spend is recorded per dispatch, along with the dispatch's role — worker build, adversary, capsule writer, and kin — so cost rolls up by mechanism as well as by tier. Which parts of the loop eat the quota is a query against the journal, not a guess.

## Core principle: catches point upstream

A defect caught downstream is two findings, not one: the defect, and the upstream process that produced it. The second is worth more.

The mining made this concrete. Review caught over a dozen "tests green, behavior wrong" bugs — which proves the review works, and also proves the process that authors tests kept producing suites blind to the behavior they claimed to prove. Catching more is the wrong lesson. The right lesson is to change how tests are born so there is less to catch.

So every guard in this spec has two halves. The downstream half catches: the adversary, the scans, the gates. The upstream half prevents: the proof plan that shapes tests before they are written ([proof.md](proof.md)), the checker that shares its consumer's real code path, the field that is required at write time instead of hoped for later. And the halves are connected by a loop: every finding in the ledger carries a defect-class tag, and a class that recurs triggers a change to whatever generates it — a rule, a check, a template, or a walk — never just another layer of catching. [evidence.md](evidence.md) traces each defect class the mining found to its generator and names the upstream fix.

## Content rules

**The editorial rule.** Never teach what agents already know and will only get better at. State the conventions we have adopted and the shape they take in this project. Nudge toward modern choices; never lecture. Don't teach how to write good code. Teach how to write code in this project.

Three content classes follow: general knowledge (cut it); our adoptions and their project shapes (keep them); and depth-forcers (keep them, with an expiry date). A depth-forcer is a template or gate that pushes an agent to go deep where today's models otherwise produce thin, surface-level artifacts — the failure that originally grew this framework's biggest files.

**One sunset regime.** Every shipped rule, check, template, and forcer is marked `architectural` or `dated`.
- `architectural`: survives model generations (externalized state, hostile verification, review as the constraint). Justified once, in writing.
- `dated`: works around a current model weakness. Carries a review-by date, six months maximum. At the date: re-justify with evidence or delete — and the evidence is the journal's counts: how often the rule's check fired, caught, or got waived since the last review.
- The re-test happens in real work. After a model-generation bump, the next real project runs with one designated forcer switched off. If the output stays deep without it, the forcer dies; if the output thins, the forcer earned six more months. The small simulation rig — a test harness that replays delivery scenarios against the framework — is the fallback instrument when no real project is at hand.

**Budgets.** The goal is the smallest corpus that gives up nothing real. Words are a cost — but so are cuts that remove working guidance, and hitting a number is never a reason to cut. We believe the right size is somewhere near 20–35k words of shipped instruction prose, down from 344k today, with the always-on set near 500. Those figures are aspirations that set the direction, not limits that gate a change; the honest instrument for shrinking the corpus is the sunset regime above, which deletes by evidence, rule by rule. What is enforced is visibility: CI counts the words on every change and publishes the total and its trend, so growth is always a deliberate act with a stated reason — never an accident, and never a wall. Product documentation has no word target at all; its bound is freshness, not size.

**Plain writing.** Models copy the register of what they read. That is our working hypothesis for why style rules kept losing to our own dense corpus — twice in one session, writing degraded right after ingesting dense material. It is observed, not proven, and the fixes are cheap either way:

- The corpus cut removes the densest thing agents here read: the framework's own prose.
- Shipped prose is itself the exemplar, so it must be plain.
- About five style imperatives live in the always-on set.
- Authored docs get a plain-language edit from a fresh-context agent before commit.
- A jargon lint — a maintained blocklist of house terms — runs on committed docs and on rendered capsules and status pages.
- Capsules are written by a fresh-context subagent, because runtime text is where a style-contaminated author does the most damage. Fresh context is not a license to forage: the writer is handed the facts it renders — the diff, the proof plan, the findings — copied in like any dispatch. Fresh means no accumulated register, not re-deriving the work.

## Governance

With one user, gates that user administers cannot be hard guarantees. They are tripwires: they make growth deliberate and visible instead of silent. Seven:

1. The instruction-word count, published by CI with its trend on every change. The tripwire is silent growth: words added without a stated reason.
2. The sunset regime. Mechanical: an expired `dated` item fails CI until re-justified or deleted.
3. The always-on set's size, published the same way. These are the most expensive words in the system — paid in every session.
4. Quarterly host-absorption review: if the host platform (Claude Code or its successors) ships a capability we built, ours is deleted. A checklist on a calendar; honestly not CI-checkable.
5. Rules become checks. A rule that cannot become a check must earn its place in the ways-of-working pages, in writing.
6. Publish only numbers the tool itself measured. Never productivity claims.
7. Shipped prose passes its own plain-language checks.

Only the sunset regime is a hard CI fail — and what it demands is evidence, not a word count. The two counts are published, never enforced. The rest are discipline made visible: the tripwire fires in public, but a person still has to not step over it.

## Risks

- Checks can harden in place the way the prose did — kept long after their reason expired. The sunset regime binds checks too, and waivers give a wrong check a legitimate exit.
- The person who administers the tripwires can step over them. Tripwires make that visible; they cannot make it impossible.
- Rubber-stamping: nothing can force real attention at a seal. Requiring a recorded drive of the product raises the floor for acceptance, and the adversary review raises it for design seals. Mitigations, not cures.
- The battery is new construction, and it gates the deletion of the generators. Pressure to delete early must not outrun the thing that makes deletion safe.
- Over-broad or stale citations can game the doc-freshness mechanic. Doc approval reviews the citation set, and the lint enforces one citation per diagram step.
- Extracted brownfield docs can be confidently wrong. Citations and freshness checks are the defense.
- Model-built scaffolds trade deterministic sameness for up-to-date choices. Topology probes keep the trade honest: whatever the model chose, the product must boot, serve, and pass its rows.
- The Queue can fill with work nobody acts on. Queue age and per-lane decision-count overruns render loudly on the Map.
- The tower is a daemon, and a dead daemon hides everything it exists to surface. Its health is one CLI command away, the session-start hook says when it cannot reach the tower, and committed markdown remains the no-daemon fallback.
- Dev mode can recreate the upkeep treadmill — 384 commits of framework work came from self-observation with no brakes. The method queue makes improvement cheap to see, never mandatory to do; the word budget and the sunset regime bind method changes the same as ever.

## Out of scope

No code changes, no deletions, no migrations, no release. This set is the proposal. If it is ratified, the next artifact is the execution plan: workstreams, slices, acceptance checks. [changes.md](changes.md) lists what that plan must decide.
