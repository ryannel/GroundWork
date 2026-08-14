# What changes

This document has four parts: what we build, what we keep, what we delete, and what the execution plan still has to decide. It also covers the migration path.

When an item names old machinery, we describe it in one line. You should never need to know the old corpus to judge a deletion.

## What gets built (new)

### Documentation and the Record

- **The doc lint and the citation-overlap mechanic.**
  - `source_of_truth` is checked by machine, not by eye.
  - Staleness shows up as battery rows.
- **The cold-reader doc eval.**

### The delivery loop

- **The program artifact.** It comes with a program-level design walk.
- **Run modes as recorded state.**
  - A mechanical stopping rule.
  - Checkpoints that don't block the run.
- **The journal.** One machine-written line per operational event: battery rows and outcomes, dispatches (with role, tier, tokens, escalation), seals, waivers, dial changes, triages, archives.
  - It lives in a per-repo journal ref, pushed with the work and stamped with a session id ([loop.md](loop.md)).
  - The tower's method-health page reads it.
  - A debug switch widens lines to full check output. It's off by default, and free when off.
- **Finding attribution and durable evidence.** Every finding records what caught it. Review outputs survive archival.
  - Both exist because the old process had a field for this and never filled it in — and it deleted the review files when a bet closed ([evidence.md](evidence.md)).
- **Defect-class tags on findings**, plus a recurrence trigger. If a defect class keeps recurring, we fix its upstream generator — not just the check that catches it.
- **Two-direction decomposition traceability.**
  - Every slice proof traces back to the sealed design.
  - Everything the design calls user-facing traces forward to a slice, or to a recorded deferral.
- **Fresh-context capsule generation**, plus render-time style linting.
- **The cross-bet invalidation signal**, checked against the sealed program ladder.
- **The teach-back.**
  - A walk-up brief at acceptance.
  - A return offer in the session-start snapshot.
  - A taught-decisions line in the journal, with its Map count ([loop.md](loop.md)).
- **Operating what shipped** ([loop.md](loop.md)).
  - The break-glass patch.
  - Production-signal intake.
  - The withdraw verb.
  - `remove-capability`.
  - The release step, with per-topology deploy probes.
  - The flake policy, with its quarantine state ([proof.md](proof.md)).

### The verification battery

- **The battery**, shipped as one component behind a single `verify` command.
  - This is new. Today's test harness is pytest that isn't shipped — it tests the generators inside this repo, and users never see it.
  - What carries over is what those tests check, not the code that checks it.
- **Topology profiles and the capability manifest**, each profile with its own universal probes ([proof.md](proof.md)).
- **Ratchet infrastructure.** Lint runs scoped to the diff, with violation baselines kept per rule and per module.
- **The proof plan**, a per-slice artifact.
  - It covers the cases, the fixture axes, and the real-versus-faked choices.
  - It's written before implementation, and sealed with the design on the complex lane ([proof.md](proof.md)).
- **The blind author and the test auditor** ([proof.md](proof.md)).
  - On the complex lane, the accepting suite is written after handoff — from the sealed design and the mechanically extracted public interface, never from the code bodies.
  - At milestone close, an audit assumes the tests are hiding something, and extends the suite with whatever they fail to prove.
- **Paired front-door proofs** ([proof.md](proof.md)).
  - Every user-facing case has a UI-driver twin that checks what the user actually sees.
  - The board's headline row shows the UI result.
  - At milestone close, the headline cases run through the UI.
- **Evidence-of-execution rows.**
  - Suites found by pattern are checked against suites actually run.
  - A slice's new tests must appear by name in the run log.
  - A run that executes zero tests is marked red.
- **The red-for-the-right-reason stub check.**
- **Drive artifacts** and **waivers**.

### Cross-project surfaces

- **The Queue and the Map**, shared across projects.
  - Computed ranking.
  - Per-lane decision budgets.
  - Acceptance-debt rendering.
- **The project registry** — `~/.groundwork/registry.json`, written by `init` and `update`.
- **The tower.** One always-on, read-only local service for all registered projects.
  - It reads state from git refs and worktrees, with no checkout needed.
  - It serves the Queue, the Map, and each repo's committed docs at one stable address.
  - Health and restart are handled through the CLI.
- **The session-start position snapshot hook**, and `groundwork where` — the CLI command that renders the same data.
- **The board derivation.**
  - The bet/slice test marker, part of the derivation contract.
  - Expected-state reconciliation: plan position is checked against test state — red for the right reason on milestones not yet reached, green on slices claimed done.
- **The bypass signals on the Map.**
  - Unlaned commits.
  - Mis-laned commits.
  - Repeat-waived checks.
- **The known-gaps view.** Deferred findings show up per project on the Map until they're closed or promoted. Patch clustering can promote a cluster into a bet.
- **The checkpoint host hook.** It emits a three-line delta plus a deep link, mechanically.

### The doors, the host, and the method's own loop

- **The adoption seal flow**, for brownfield projects.
- **Dev mode** — a maintainer flag, off by default.
  - The method-friction journal event.
  - Cross-project routing of method-classed signals into the tower's method queue.
  - The issue-filing adapter: one evidence-carrying issue per cluster, maintainer-triggered by default.
  - Dev mode only proposes. Method changes still run through the method's own loop ([surfaces.md](surfaces.md)).
- **The method rig, rebuilt on subagents** ([proof.md](proof.md)).
  - The scenario shelf: two doors, slice/bet/program, the blind-author cheat, escape replays.
  - Judge-only replays over the real bet archives.
  - The scripted owner.
  - Sim dispatches, journaled with role `sim`.
  - Today's `./dev sim` harness carries over. Its background-session transport becomes in-session subagent fan-out.
- **The host adapter contract** ([index.md](index.md)).
  - Surfacing, dispatch, and run-id capabilities, defined per host.
  - Claude Code is the reference adapter.
  - Instruction files are emitted in each host's own convention.
  - Missing capabilities degrade visibly, not silently.

### Feature flags (opt-in)

- **The flag lane** ([loop.md](loop.md), [proof.md](proof.md)).
  - The committed flag registry.
  - The flag scan.
  - Map rendering of live flags, with age and exposure state.
  - Flag-flip journal events.
  - It turns on only when a project declares a flag backend. A flagless project never sees any of it.

### Unattended runs

- **The launch gate** ([loop.md](loop.md)). A run at dial `bet` or above can't start until two things are true:
  - A fresh-context forecast of the decisions the work will force comes back clean — every item is answered by the plan, ruled on at launch, or delegated on the record.
  - The ground is ready: the battery is green where the run starts, the services and credentials its probes need are present, and the permission model from [doors.md](doors.md) is in place.
- **Standing rulings** ([loop.md](loop.md)). Every answer the owner gives is recorded somewhere the driver has to check before escalating.
  - If an escalation is already covered by an existing ruling, that's a journaled driver defect.
  - A recurring escalation class gets promoted into project policy, the same way bounce reasons feed the standards sheets.
- **Park-and-resume** ([loop.md](loop.md)). At dial `program`, a stop scoped to one bet parks that bet — independent work keeps going. The run only truly stops when nothing unblocked remains, or the ladder itself needs amending.
- **The decision discipline** ([loop.md](loop.md)).
  - The significance line covers five things: public interface, schema, cross-bet reach, critical paths, and user-visible behavior that no ruling already names.
  - Below that line, calls go unrecorded.
  - Standing rulings get copied into worker briefs.
  - New rulings get a canary.
  - Debt throttles the dial.
- **The divergence row** ([proof.md](proof.md)). Same-shaped solutions are fingerprinted across slices.
  - The row turns red on divergence, never on taste.
  - When a divergence class keeps recurring, the decision itself is removed — turned into a check, a generator, or a standards line.

### The design walkthroughs

- **The journey layer** ([loop.md](loop.md), [proof.md](proof.md)).
  - The sealed journey map: every capability sits on a named journey that starts from a real entry point. Every bet that adds UI amends this map.
  - The reachability row.
  - UI proofs that start at the entry point and never deep-link.
- **Business logic as a walk discipline** ([loop.md](loop.md)). Rules, invariants, and state transitions get their own design step — after data flows, before API and schema.

### Program autonomy

- **The program autonomy contract** ([loop.md](loop.md)). At dial `program`:
  - The walk sorts every bet into self-designing or appointment, producing the appointment list.
  - It seeds the standing rulings.
  - The launch gate reruns at each bet boundary.
  - A parked bet's walk artifacts are drafted before the owner arrives.

### The design canvas

(This extends the design walkthroughs above; it sits last so existing IDs stay stable.)

- **The design canvas lane** ([loop.md](loop.md), [index.md](index.md)).
  - Page designs are rendered mockups, sealed as pictures. ASCII wireframes are gone.
  - The canvas (Claude Design on the reference host) is seeded from the repo: tokens and built components go up, finished page designs come back as mockup images in the bet's design docs.
  - Built components push back at bet close, so the canvas never holds truth the repo lacks.
  - A design doc's embedded images must be read by anyone consuming the doc.
  - Canvas sync lives in the CLI, so any host that runs the CLI gets it; the reference host's built-in sync is the interim path. Without sync the owner exports designs into the repo by hand; without the canvas the same mockups render locally from the same tokens.
- **The design system born on the canvas** ([doors.md](doors.md), [loop.md](loop.md)).
  - At greenfield birth, taste is explored on the canvas — type, color, and components rendered live — and the owner seals a look they saw, never token strings on faith.
  - The sealed system is pulled down and materialized as tokens and real components in code. That pull makes the repo the origin; the repo-originates rule applies from that moment on.
  - Without sync the owner exports from the canvas by hand; without the canvas the seal is granted on locally rendered sheets.

## What stays

- The 9 verification verbs, consolidated under `verify`.
- The approved tag, with its amendment protocol.
- The derivation contract — the templates, trailers, naming, and sequence rules that make agent output parseable ([surfaces.md](surfaces.md)).
- Lanes, with ties resolved toward the lighter lane, plus the post-hoc lane audit.
- Programs and bets as sealed artifacts.
- Patch-trailer mining. Patches carry trailers, and a ledger clusters them to show which areas keep needing fixes.
- The design-doc shape and the per-discipline design conventions.
- Doc freshness, citations, and the reversal rule.
- Today there are several render surfaces: the docsite, status pages, proofs pages, board files. Only two survive: the tower and the in-chat three-line delta.
  - The rest are derived or absorbed.
  - The docs-site generator itself is deleted (see below).
- The universal adoption sheets and stack seeds, with ratchets and blessed modules.
- Setup output contracts and depth gates, `dated` ([doors.md](doors.md)).
- The ways-of-working pages: the loop's philosophy, the design conventions, and a one-page list of rules born from real incidents.
  - Examples: the worker hand-off rules, the never-mock-what-the-proof-names rule, the commented-out-assertion check, and others like them.
  - Each rule is `dated`, so every scar rule has to periodically re-justify itself.
- The worker contract and the tier rule ([proof.md](proof.md), [index.md](index.md)).
- Fix-in-place as the default fix path, with a fresh dispatch as the escalation. (Measured: re-deriving context costs about 41% of the original build.)
- Whole-ladder red materialization. Every milestone's headline test is written and committed failing, up front — so the plan's proofs exist before any implementation.
  - Delivery transcripts show this actually happening: committed red boards, stubs turning green one by one.
  - The ritual stays. What changes is its container: proofs are now born in the permanent suite, and the board becomes a derived view ([proof.md](proof.md)).
- The proofs board. It's a generated page listing each sealed proof and its status, read row by row at acceptance — that reading is the seal ceremony.
- The ripple-slice caller list: when a slice updates callers of a changed contract, the driver computes the list from committed code.
- The per-slice backup push.
- The simulation rig, kept small. It's rebuilt on the in-session subagent transport, under the cost ladder that spends model calls last ([proof.md](proof.md)).
- `add-capability` (mid-life manifest additions).
- The update engine, permanently. The migration registry is slimmed down to a version cursor, an ownership manifest, and idempotent steps (see Migration and updates, below).
- The boundary-linter configs the generators already carry — depguard for Go, import-linter for Python, ESLint boundary rules for the TypeScript stacks. These get transcribed into the stack seeds.
- The manifest-derived module graph — a 30 KB file recording which modules depend on which. It's `dated`, and its retention test is named:
  - Its consumers are the ripple caller list and the doc-staleness reach check ([record.md](record.md)).
  - If the journal shows neither one consuming it by the review date, the graph goes too.

## What gets deleted

- **The 13-protocol operating contract, as choreography.**
  - Today it's a 543-line mandatory-reading contract: numbered protocols that script how sessions behave — checkpoint formats, decision batching, translation rules for the owner's chat.
  - Each protocol becomes a check, a line in the ways-of-working pages, or nothing at all.
- **The 4 personas, as personas** — architect, designer, product, writer. These were skills that scripted a role's voice and conversation.
  - The designer's visual judgment survives, as the milestone screenshot read and visual battery rows.
  - The architect's ADR discipline survives, in the Record.
  - The scripted conversations themselves go away.
- **The 7 review-lens briefs** — except for the contracts they carry: the worker contract, the tell catalog, the affordance floor. Their real value was fresh context, not the briefing prose.
- **The three-lens-per-slice review.** Today, every slice gets reviewed by three separate agents: a blind reviewer, an edge-case tracer, and a coverage auditor.
  - One blind adversary per slice remains.
  - Coverage judgment becomes mechanical — the deletion test.
  - Edge-case and honesty judgment move to milestone close.
- **The checkpoint-walkthrough subagent** — a narrator dispatched at each milestone to present status.
  - The Map's milestone page carries the narrative now.
  - This is not the same as the teach-back ([loop.md](loop.md)) coming back: the narrator retold status on a schedule, but the teach-back speaks to the owner at their own moments and carries only what changed.
- **The six-writes-per-slice bookkeeping** ([loop.md](loop.md)). The Map now derives those pages from the commits and ledgers instead.
- **The separate polish stage.** It's merged into the designer's screenshot read at milestone close.
- **Bet-close validation as a ceremony list.** Its steps become battery rows instead ([loop.md](loop.md)).
- **The explanatory ~75% of the engineer skills** — the idiom tutorials and worked examples. The project-shape content that's left becomes the stack seeds.
- **The principles corpus as essays** — 36 documents teaching why. What survives is the adoptions, as one-page sheets ([standards.md](standards.md)).
- **Setup conversation scripts and hand-off ceremony.**
- **Most of the 45k-word bet lifecycle prose.**
- **The sim harness's scenario backlog** — the debt of unwritten simulation scenarios it carries as TODOs. The rig survives, kept small. The obligation to write every one of them does not.
- **repo-map, the whole verb.** This is the CLI's code-intelligence index. Its tree-sitter grammars are 28 MB — 82% of the npm package.
  - The record shows it was invoked 73 times in one project, and its artifact never once appeared on disk.
  - The module graph covers the one use that actually mattered, at 30 KB, and it's `dated` (see the keep list above).
- **The docs-site generator.** The tower now renders every repo's committed docs, so the per-project docs site leaves the spine ([doors.md](doors.md)). If a product wants a public docs site, that's product work, owned by the product.
- **The 10 Nx generators** — once the battery passes against at least one generator-built repo ([doors.md](doors.md)).
- **The separate bet-progress suite** — the per-bet copy of the tests, authored all-red and deleted at archive.
  - Proofs are born in their permanent home instead.
  - The board becomes a derived view.
  - Only proofs marked retire-at-close are ever deleted ([proof.md](proof.md)).

## Migration and updates

The rebuild ships as migrations. One final release on the old registry carries every install across the rebuild boundary. The three live installs — magpie, staycurrent, and this repo's own — move through it.

After that boundary, updates are permanent, because the sunset regime guarantees ongoing churn. The update engine is the old registry, slimmed down: a version cursor in project state, an ownership manifest, and idempotent steps.

Every update classifies its changes by blast radius:

- **Package-internal** (CLI, battery, skills). This is a plain package update. Seals record the battery version they were granted under, so a behavior change stays visible and old seals keep their meaning.
- **Framework-owned project files.** These reconcile automatically, scoped to what the framework owns — the update never touches files the project authored. (This is written in blood: the old update lane deleted app-authored skills, twice.)
  - Executable surfaces are the exception. Hook configs and CI stanzas — code that runs at session start or with CI credentials — are never auto-written. They arrive as Queue proposals, like project-owned artifacts.
  - The update engine also verifies the package's signed provenance before reconciling anything. Auto-writing into every registered repo is exactly the blast radius a compromised release would want.
- **Project-owned artifacts the framework only seeded** (standards sheets, templates in use). These are never auto-edited. The update proposes instead — a Queue entry with a capsule, accepted or bounced like any other change. Updates ride the system instead of running beside it.

**New checks arrive as ratchets.** When an update adds a check, existing violations get baselined and may only decrease from there — the same mechanism brownfield adoption uses. Changed checks get the same treatment: the update re-runs the battery against claimed-done proofs, and any row that turns newly red under a stricter check gets baselined or filed as a Queue proposal. It's never flipped red on a live board mid-run. A release that turns projects red teaches people not to update.

The journal records every update event.

## Size targets

These are targets, not measurements, and aspirations, not gates. The goal is the smallest size that gives up nothing real — nothing gets cut just to hit a number ([index.md](index.md)). Current-state numbers, including the 344k-word baseline, are measured and listed in [evidence.md](evidence.md).

- Core method prose: about 10k words. Of that, the always-on set is about 500 words.
- Universal adoptions, plus optional per-stack seed sheets: 2 to 4k words each.
- Total shipped instruction prose: about 20 to 35k words — roughly a 90% cut.
- About 10 to 12 top-level CLI verbs. (The nine anti-cheat verbs consolidate under `verify`.)
- Package size: a few MB, down from 34 MB.
- A project's own standards live in the project, not the package. Product documentation is bound by freshness, not by a word count.
- Per-bet targets:
  - Token cost per delivered slice, published from the journal as a trend. There's no dispatch-count target — tokens are the scarce resource, dispatches are not.
  - Two slice writes, down from six.
  - Pauses equal to the seals plus the dial's chosen rungs.
  - Decisions measured against each lane's decision budget.

## Open items for the execution plan

These are deliberately left open. The execution plan has to nail them down:

- The capsule format — its fields, its length cap, and where it lives in the commit or ledger.
- The Queue's ranking weights, and the format of the critical-paths list.
- The per-lane decision-budget numbers.
- The battery version format, and where seals record it.
- The brownfield adapter's socket-mapping mechanics, and its cost per repo.
- The citation syntax — paths versus symbols, glob rules — and which doc types the diagram-presence lint covers.
- The cold-reader eval's rubric and sample rate.
- The waiver record's shape, and how expiry is handled.
- The checkpoint host hook's implementation — hook type, what it reads.
- Per-lane dial defaults, and the format of the sensitive-paths escalation list.
- The finding-attribution field's vocabulary — which catchers can be named — and the archival layout that preserves review outputs.
- The proof plan's format — fields, length, where it lives per lane — and how its seal composes with the design-walk seal.
- The defect-class vocabulary, seeded from the mining's classes, and the recurrence threshold that triggers an upstream change.
- The tower's address and daemon lifecycle — launch mechanism, health surface, restart path, macOS first — and how the registry handles moved or deleted repos.
- Cross-project Queue ranking: how project priority weighs against lane, age, and coverage.
- Whether the ambient layer ships at all — menubar count, native notifications. It's optional; decide this at execution.
- The test-marker syntax per stack — naming convention versus annotations — and the just-this-bet filter recipes.
- The journal's event schema, including the dispatch-role vocabulary, plus its file layout and the debug switch's exact scope.
- The update engine's ownership-manifest format, and the Queue shape of update proposals.
- The always-on kernel's contents — the ~500 words themselves.
- Dev mode's clustering thresholds, its issue template, and the auto-file opt-in.
- The teach-back's return trigger — how much landed work, or how much elapsed time, counts as "away" — and how a taught decision gets marked covered.
- The method rig's scenario rubrics, fixture-repo shapes, per-scenario cost budgets, and the smoke, full, and deep trigger list.
- The blind author's interface-extraction mechanics per stack, the fix-loop visibility rules, and how scaffolding tests are curated into or out of the suite.
- The UI-driver toolchain per topology — web, desktop, mobile — for the paired front-door cases.
- The auditor's source-citation format — how a test names the design section, plan case, or invariant its expected outcome came from.
- The host adapter contract's exact capability list, and the first non-Claude adapter's target host. With it: whether canvas sync can run as a CLI verb outside the reference host — the canvas API's auth and stability are unproven there.
- The per-stack battery adapter — marker filtering, run-log parsing, interface extraction — as a named extension point, with a conformance checklist.
- The break-glass command's exact scope, the withdraw verb's cascade, and the flake policy's rerun and quarantine thresholds.
- One trend publisher, with two sources: a CI file-set counter (corpus, kernel, sheets) and a journal aggregator (spend share, wall-clock, token cost, decision actuals). Build it once, not seven times.
- One check-health signal — a thresholded, journal-derived rate — used for repeat-waivers, flake rate, and hook silence. The remedies for each stay distinct.
- One staleness checker — time or commits since a recorded date, over a named scope — parameterized for docs, dated rules, and the blessed module.
- Whether the critical-paths list and the sensitive-paths list are one sealed list with two effects (lane floor, rung cap), or genuinely two separate lists.
- One seal mechanism, parameterized by kind — design, acceptance, birth, adoption. The plumbing is shared even where the names differ.
- Execution sequencing — which parts land first, and which existing repos serve as proving grounds. (The Record calibration names wordloop and magpie; continuous delivery names magpie.)
- The flag registry's format, the scan's detection mechanics per backend, and the seeded backend choices per stack — all opt-in, none present in a flagless project.

## Delivering the rest

This document is the decision artifact. The execution plan itself lives in [north-star-execution.md](../north-star-execution.md). Its delivery approach is already settled; its ladder firms up at ratification.

One decision from that plan matters here: the rebuild starts from a single reset commit on this repo's main. The old world is preserved behind the `legacy-final` tag and kept alive on the `legacy` branch until cutover. The rebuild carries none of the old corpus forward. This doesn't change the migration described above — that migration was always about consumer installs, not this repo's own history.

Nothing gets deleted, migrated, or released before the execution plan's ladder exists and is approved.
