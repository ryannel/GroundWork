# What changes

The complete build, keep, and delete lists, the migration path, and what the execution plan must still decide. Where an item names old machinery, a one-line description rides with it — the reader should never need the old corpus to judge a deletion.

## What gets built (new)

### Documentation and the Record

- **The doc lint and the citation-overlap mechanic**; machine-validated `source_of_truth`; staleness as battery rows.
- **The cold-reader doc eval.**

### The delivery loop

- **The program artifact** and the program-level design walk.
- **Run modes as recorded state**, the mechanical stopping rule, and non-blocking checkpoints.
- **The journal**: one machine-written line per operational event — battery rows and outcomes, dispatches with role/tier/tokens/escalation, seals, waivers, dial changes, triages, archives — kept in a per-repo journal ref pushed with the work, session-id stamped ([loop.md](loop.md)). The tower's method-health page reads it. A debug switch widens lines to full check output; off by default, free when off.
- **Finding attribution and durable evidence**: every finding records what caught it, and review outputs survive archival. Both exist because the old process had the field and never filled it, and deleted the review files at bet close ([evidence.md](evidence.md)).
- **Defect-class tags on findings**, and the recurrence trigger: a class that recurs changes its upstream generator, not just its catcher.
- **Two-direction decomposition traceability**: every slice proof traces to the sealed design, and everything the design names as user-facing traces to a slice or a recorded deferral.
- **Fresh-context capsule generation**; render-time style linting.
- **The cross-bet invalidation signal** against the sealed program ladder.
- **The teach-back**: the walk-up brief at acceptance, the return offer in the session-start snapshot, and the journal's taught-decisions line with its Map count ([loop.md](loop.md)).
- **Operating what shipped** ([loop.md](loop.md)): the break-glass patch, production-signal intake, the withdraw verb, `remove-capability`, the release step with per-topology deploy probes, and the flake policy with its quarantine state ([proof.md](proof.md)).

### The verification battery

- **The battery** as a shipped component behind one `verify` command. This is new construction: today's test harness is unshipped pytest that tests the generators inside this repo — users never get it. What carries over is what those tests assert, not their code.
- **Topology profiles and the capability manifest**, with per-profile universal probes ([proof.md](proof.md)).
- **Ratchet infrastructure**: diff-scoped lint plus per-rule-per-module violation baselines.
- **The proof plan** as a per-slice artifact — the cases, fixture axes, and real-versus-faked choices, authored before implementation and sealed with the design on the complex lane ([proof.md](proof.md)).
- **The blind author and the test auditor** ([proof.md](proof.md)): complex-lane accepting suites written after handoff from the sealed design and the mechanically extracted public interface — never the code bodies; and a milestone-close audit that assumes the tests hide something and extends the suite with what they fail to prove.
- **Paired front-door proofs** ([proof.md](proof.md)): every user-facing case carries a UI-driver twin that asserts what the user sees; the board's headline row is the UI result, and milestone close drives the headline cases through the UI.
- **Evidence-of-execution rows**: suites discovered by pattern and reconciled against suites run; a slice's new tests must appear by name in the run log; a run that executes zero tests is red.
- **The red-for-the-right-reason stub check.**
- **Drive artifacts** and **waivers**.

### Cross-project surfaces

- **The Queue and the Map**, cross-project, with computed ranking, per-lane decision budgets, and acceptance-debt rendering.
- **The project registry** (`~/.groundwork/registry.json`, written by `init` and `update`).
- **The tower**: one always-on, read-only local service for all registered projects — reads state from git refs and worktrees without any checkout, serves the Queue, the Map, and each repo's committed docs at one stable address; health and restart via the CLI.
- **The session-start position snapshot hook** and `groundwork where` (the CLI rendering of the same data).
- **The board derivation**: the bet/slice test marker in the derivation contract, and the expected-state reconciliation — plan position against test state, red for the right reason on unreached rungs, green on claimed-done slices.
- **The bypass signals on the Map**: unlaned commits, mis-laned commits, and repeat-waived checks.
- **The known-gaps view**: deferred findings rendered per project on the Map until closed or promoted, with patch clustering able to promote a cluster into a bet.
- **The checkpoint host hook** (three-line delta plus deep link, emitted mechanically).

### The doors, the host, and the method's own loop

- **The adoption seal flow** for brownfield.
- **Dev mode** (a maintainer flag, off by default): the method-friction journal event, cross-project routing of method-classed signals into the tower's method queue, and the issue-filing adapter — one evidence-carrying issue per cluster, maintainer-triggered by default. Dev mode proposes; method changes run through the method's own loop ([surfaces.md](surfaces.md)).
- **The method rig rebuilt on subagents** ([proof.md](proof.md)): the scenario shelf (two doors, slice/bet/program, the blind-author cheat, escape replays), judge-only replays over the real bet archives, the scripted owner, and sim dispatches journaled with role `sim`. Today's `./dev sim` harness carries over; its background-session transport becomes in-session subagent fan-out.
- **The host adapter contract** ([index.md](index.md)): surfacing, dispatch, and run-id capabilities per host; Claude Code as the reference adapter; instruction files emitted per host convention; visible degradation for missing capabilities.

## What stays

- The 9 verification verbs, consolidated under `verify`.
- The approved tag with its amendment protocol.
- The derivation contract: the templates, trailers, naming, and sequence rules that make agent output parseable ([surfaces.md](surfaces.md)).
- Lanes with ties resolving lighter, plus the post-hoc lane audit.
- Programs and bets as sealed artifacts.
- Patch-trailer mining: patches carry trailers, and a ledger clusters them to show which areas keep needing fixes.
- The design-doc shape and the per-discipline design conventions.
- Doc freshness, citations, and the reversal rule.
- Of today's several render surfaces (docsite, status pages, proofs pages, board files), two survive: the tower and the in-chat three-line delta. The rest are derived or absorbed — the docs-site generator itself is deleted below.
- The universal adoption sheets and stack seeds, with ratchets and blessed modules.
- Setup output contracts and depth gates, `dated` ([doors.md](doors.md)).
- The ways-of-working pages: the loop's philosophy, the design conventions, and a one-page register of rules born from real incidents — the worker hand-off rules, the never-mock-what-the-proof-names rule, the commented-out-assertion check and their kin — each `dated` so every scar rule must periodically re-justify itself.
- The worker contract and the tier rule ([proof.md](proof.md), [index.md](index.md)).
- Fix-in-place as the default fix path, with a fresh dispatch as the escalation (measured: re-deriving context costs ~41% of the original build).
- Whole-ladder red materialization: every milestone's headline test written and committed failing up front, so the plan's proofs exist before any implementation. Delivery transcripts show this actually practiced — committed red boards, stubs going green one by one. The ritual stays; its container changes: proofs are now born in the permanent suite, and the board becomes a derived view ([proof.md](proof.md)).
- The proofs board — the generated page listing each sealed proof and its status — read row by row at acceptance, as the seal ceremony.
- The ripple-slice caller list: when a slice updates callers of a changed contract, the driver computes the list from committed code.
- The per-slice backup push.
- The simulation rig, kept small — rebuilt on the in-session subagent transport, under the cost ladder that spends model calls last ([proof.md](proof.md)).
- `add-capability` (mid-life manifest additions).
- The update engine, permanently — the migration registry slimmed to a version cursor, ownership manifest, and idempotent steps (see Migration and updates below).
- The boundary-linter configs the generators already carry — depguard for Go, import-linter for Python, ESLint boundary rules for the TypeScript stacks — transcribed into the stack seeds.
- The manifest-derived module graph (a 30 KB file recording which modules depend on which) — `dated`, with its retention test named: its consumers are the ripple caller list and the doc-staleness reach check ([record.md](record.md)); if the journal shows neither consuming it by the review date, the graph goes too.

## What gets deleted

- **The 13-protocol operating contract as choreography.** Today: a 543-line mandatory-reading contract of numbered protocols scripting how sessions behave — checkpoint formats, decision batching, translation rules for the owner's chat. Each protocol becomes a check, a line in the ways-of-working pages, or nothing.
- **The 4 personas as personas** — architect, designer, product, writer: skills that scripted a role's voice and conversation. The designer's visual judgment survives as the milestone screenshot read and visual battery rows. The architect's ADR discipline survives in the Record. The scripted conversations die.
- **The 7 review-lens briefs**, except the contracts they carry (the worker contract, the tell catalog, the affordance floor). The value was fresh context, not the briefing prose.
- **The three-lens-per-slice review** — today every slice is reviewed by three separate agents: a blind reviewer, an edge-case tracer, and a coverage auditor. One blind adversary per slice remains; coverage judgment goes mechanical (the deletion test); edge-case and honesty judgment move to milestone close.
- **The checkpoint-walkthrough subagent** — a narrator dispatched at each milestone to present status. The Map's milestone page carries the narrative now. The teach-back ([loop.md](loop.md)) is not this coming back: the narrator retold status on a schedule; the teach-back addresses the owner at their own moments and carries only deltas.
- **The six-writes-per-slice bookkeeping** ([loop.md](loop.md)) — the Map derives those pages from the commits and ledgers.
- **The separate polish stage** — merged into the designer's screenshot read at milestone close.
- **Bet-close validation as a ceremony list** — its steps become battery rows ([loop.md](loop.md)).
- **The explanatory ~75% of the engineer skills** — the idiom tutorials and worked examples. The project-shape content becomes the stack seeds.
- **The principles corpus as essays** — 36 documents teaching why. The adoptions survive as the one-page sheets ([standards.md](standards.md)).
- **Setup conversation scripts and hand-off ceremony.**
- **Most of the 45k-word bet lifecycle prose.**
- **The sim harness's scenario backlog** — the debt of unwritten simulation scenarios it carries as TODOs. The rig survives small; the obligation to write them all does not.
- **repo-map, the whole verb** — the CLI's code-intelligence index, whose 28 MB of tree-sitter grammars is 82% of the npm package. The record shows it invoked 73 times in one project without its artifact ever appearing on disk. The module graph covers the one load-bearing use at 30 KB, and it is `dated` (keep list above).
- **The docs-site generator** — the tower renders every repo's committed docs, so the per-project docs site leaves the spine ([doors.md](doors.md)). A public product docs site, where a product wants one, is product work owned by the product.
- **The 10 Nx generators**, after the battery passes against at least one generator-built repo ([doors.md](doors.md)).
- **The separate bet-progress suite** — the per-bet copy of the tests, authored all-red and deleted at archive. Proofs are born in their permanent home instead; the board becomes a derived view; only proofs marked retire-at-close are ever deleted ([proof.md](proof.md)).

## Migration and updates

The rebuild ships as migrations: one final release on the old registry carries every install across the rebuild boundary, and the three live installs — magpie, staycurrent, and this repo's own — move through it.

After the boundary, updates are permanent, because the sunset regime guarantees churn. The update engine is the old registry slimmed down: a version cursor in project state, an ownership manifest, and idempotent steps. Every update classifies its changes by blast radius:

- **Package-internal** (CLI, battery, skills): a plain package update. Seals record the battery version they were granted under, so a behavior change is visible and old seals keep their meaning.
- **Framework-owned project files**: reconciled automatically, ownership-scoped — the update never touches files the project authored (written in blood: the old update lane deleted app-authored skills twice). Executable surfaces are the exception: hook configs and CI stanzas — code that runs at session start or with CI credentials — are never auto-written; they arrive as Queue proposals like project-owned artifacts. And the update engine verifies the package's signed provenance before reconciling anything, because auto-writing into every registered repo is exactly the blast radius a compromised release would want.
- **Project-owned artifacts the framework only seeded** (standards sheets, templates in use): never auto-edited. The update proposes — a Queue entry with a capsule, accepted or bounced like any other change. Updates ride the system instead of running beside it.

**New checks arrive as ratchets.** When an update adds a check, existing violations are baselined and may only decrease — the same mechanism as brownfield adoption. Changed checks get the same treatment: the update re-runs the battery against claimed-done proofs, and rows newly red under a stricter check are baselined or filed as Queue proposals, never flipped red on a live board mid-run. A release that turns projects red teaches people not to update.

The journal records every update event.

## Size targets

Targets, not measurements — and aspirations, not gates: the goal is the smallest size that gives up nothing real, and nothing is cut just to hit a number ([index.md](index.md)). Current-state numbers (344k words and the rest) are measured and listed in [evidence.md](evidence.md).

- Core method prose: about 10k words, with the always-on set about 500.
- Universal adoptions plus optional per-stack seed sheets: 2–4k words each.
- Total shipped instruction prose: about 20–35k words, roughly a 90% cut.
- About 10–12 top-level CLI verbs (the nine anti-cheat verbs consolidate under `verify`).
- Package a few MB, from 34 MB.
- A project's own standards live in the project, not the package. Product documentation is bound by freshness, not words.
- Per-bet targets: token cost per delivered slice, published from the journal as a trend — no dispatch-count target, because tokens are the scarce resource and dispatches are not. Two slice writes (from six). Pauses equal to the seals plus the dial's chosen rungs; decisions measured against each lane's decision budget.

## Open items for the execution plan

Deliberately not decided here. The execution plan must specify:

- The capsule format (fields, length cap, where it lives in the commit or ledger).
- The Queue ranking weights and the critical-paths list format.
- The per-lane decision-budget numbers.
- The battery version format and where seals record it.
- The brownfield adapter's socket-mapping mechanics and its cost per repo.
- The citation syntax (paths vs symbols, glob rules) and which doc types the diagram-presence lint covers.
- The cold-reader eval rubric and sample rate.
- The waiver record shape and expiry handling.
- The checkpoint host hook implementation (hook type, what it reads).
- Per-lane dial defaults and the sensitive-paths escalation list format.
- The finding-attribution field's vocabulary (which catchers can be named) and the archival layout that preserves review outputs.
- The proof plan's format (fields, length, where it lives per lane) and how its seal composes with the design-walk seal.
- The defect-class vocabulary (seeded from the mining's classes) and the recurrence threshold that triggers an upstream change.
- The tower's address and daemon lifecycle (launch mechanism, health surface, restart path — macOS first) and the registry's handling of moved or deleted repos.
- Cross-project Queue ranking: how project priority weighs against lane, age, and coverage.
- Whether the ambient layer ships (menubar count, native notifications) — optional; decide at execution.
- The test-marker syntax per stack (naming convention vs annotations) and the just-this-bet filter recipes.
- The journal's event schema (including the dispatch-role vocabulary), its file layout, and the debug switch's exact scope.
- The update engine's ownership-manifest format and the Queue shape of update proposals.
- The always-on kernel's contents — the ~500 words themselves.
- Dev mode's clustering thresholds, its issue template, and the auto-file opt-in.
- The teach-back's return trigger (how much landed work or elapsed time counts as "away") and how a taught decision is marked covered.
- The method rig's scenario rubrics, fixture-repo shapes, per-scenario cost budgets, and the smoke/full/deep trigger list.
- The blind author's interface-extraction mechanics per stack, the fix-loop visibility rules, and how scaffolding tests are curated into or out of the suite.
- The UI-driver toolchain per topology (web, desktop, mobile) for the paired front-door cases.
- The auditor's source-citation format — how a test names the design section, plan case, or invariant its expected outcome came from.
- The host adapter contract's exact capability list, and the first non-Claude adapter's target host.
- The per-stack battery adapter (marker filtering, run-log parsing, interface extraction) as a named extension point with a conformance checklist.
- The break-glass command's exact scope, the withdraw verb's cascade, and the flake policy's rerun and quarantine thresholds.
- One trend publisher, two sources: a CI file-set counter (corpus, kernel, sheets) and a journal aggregator (spend share, wall-clock, token cost, decision actuals) — built once, not seven times.
- One check-health signal (a thresholded, journal-derived rate) instantiated for repeat-waivers, flake rate, and hook silence; the remedies stay distinct.
- One staleness checker (time or commits since a recorded date, over a named scope) parameterized for docs, dated rules, and the blessed module.
- Whether the critical-paths list and the sensitive-paths list are one sealed list with two effects (lane floor, rung cap) or genuinely two.
- One seal mechanism parameterized by kind (design, acceptance, birth, adoption) — shared plumbing even where the names differ.
- Execution sequencing: which parts land first, and which existing repos are the proving grounds (the Record calibration names wordloop and magpie; continuous delivery names magpie).

## Delivering the rest

This set is the decision artifact. On ratification: the execution plan is authored in the repo's standard plan format (workstreams, slices, acceptance checks), starting from the open items above and the calibration tests named in each part. Nothing is deleted, migrated, or released before that plan exists and is approved.
