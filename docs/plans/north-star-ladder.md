# The rebuild ladder

**Status:** DRAFT, hardened by six independent reviews. Seventeen bets, with every commitment in the spec assigned to one. Firms up at ratification.
**Audience:** The owner ratifying the sequence, and the driver running it.
**Scope:** Order and coverage. How we deliver is [the execution plan](north-star-execution.md); what we build is [the spec](north-star/index.md).

---

## How to read this

The spec commits to 119 things: 43 to build, 23 to keep, 17 to delete, and 36 open questions. §2 assigns each one to exactly one bet. That is the point of this document. A commitment with no bet is work nobody has agreed to do. The tables make that visible before anyone starts.

Each item has an ID: `B0`–`B42` for build, `K0`–`K22` for keep, `D0`–`D16` for delete, `O0`–`O35` for open. Each ID marks a position in [changes.md](north-star/changes.md)'s lists. That means the coverage check can run as a script — nobody has to check it by eye.

**Terms.** The bets use the spec's own words — kernel, dial, lane, seal, socket, blessed module, front door, and more. They're defined under "The words this set uses" in [index.md](north-star/index.md). Read that first if any are new to you. Magpie and staycurrent are existing products built with the old framework. Wordloop is a fourth repo that predates it. All three show up as test fixtures.

**Deletions work differently on a clean slate.** Most items on the delete list are handled simply by not porting them over. An item gets its own bet only when something must actively happen — a replacement has to land first, or a gate has to pass before the old thing goes.

**Done conditions should be tried and watched — including watched fail.** "The battery works" is not a real done condition. "Point it at a repo it was never tuned against, and it correctly calls the hollow suite red" is. Several conditions need a fixture *held out* from the thing's own tuning. A checker tuned on two cases and then tested against those same two cases has proved nothing.

---

## 1. The ladder

The ladder starts on an already-blank repo. The reset commit does several things at once: tag `legacy-final`, cut the `legacy` branch, and blank main down to the spec, the working agreement, this ladder, and the execution plan. That commit is part of ratification itself — it belongs to no bet. The [execution plan](north-star-execution.md) has the sequence.

### Bet 0 — The floor

The first commits on the blank repo, before any framework code.

**Done when:** main's CI fails the build when a Go test fails. Prove it by writing a failing test, watching CI fail, then removing the test. Legacy's Node CI stays pinned to the `legacy` branch, and stays green there. The port-pass dispatch produces `docs/carried-over.md`. A separate session reviews it for register. Both commits are visible in history. `docs/decisions.md` records the settled decisions: Go, one repo, the reset.

**Lands:** CI on both lines, the test runner, the port list, the first ledger entries.

### Bet 1 — The CLI and the journal

Builds the journal and CLI that measure every bet as it's built.

**Done when:** three structurally different verbs each write a journal line to the journal ref. Each line carries role, tier, tokens, duration, and session id. Spend by role is queried from the ref itself, not from a fixture. One token figure is cross-checked against the host's own reported usage. Two branches that both wrote journal lines can merge, and both lines survive. Every finding in the ledger records what caught it.

**Lands:** the journal, the ledgers with attribution and class tags, the CLI skeleton, git discipline.

### Bet 2 — The battery

Builds the battery — the anti-cheat checks that protect every bet built afterward.

**Done when:** `verify` correctly classifies two repos it was never tuned against. It calls a suite red when tests survive the implementation being deleted. It calls a suite red when tests compile but never run. It calls a suite red when assertions are vacuous. It calls honest work green. Run against this repo's own history, it produces no false reds. A wrong check can be waived; the waiver gets recorded and counted. A flaky row quarantines instead of blocking the run.

**Lands:** the battery behind one `verify`, the three scans, the deletion test, run evidence, topology profiles and the capability manifest, waivers and drive artifacts, the flake policy.

### Bet 3 — Planning and the board

Builds the planning system that turns a goal into proofs nobody can fake by editing.

**Done when:** a two-milestone bet decomposes into a board that starts red — red for the right reason. The stub check catches three stub styles it was never tuned against: a commented-out assertion, an always-true assertion, and an empty body. Three slices land in sequence. Each one turns exactly its own row green, driven by the test run. No file gets edited just to move the board.

**Lands:** program and bet artifacts, the derivation contract, proof plans, board derivation, test markers, two-direction traceability, seals and the amendment protocol.

### Bet 4 — The project board

Builds the project board, so the planning record for the repo you're in is visible instead of hidden.

**Done when:** the Map's rendered position matches a position computed by hand from the repo's git log. Check this with the daemon running, then again after a new commit lands. Stop the daemon: `groundwork where` still gives the same answer, computed fresh, not from a cache. A session opened in this repo receives its position without asking for it.

**Lands:** the tower serving one repo, the Map and board pages, the Queue, known gaps, committed-doc rendering, the checkpoint and session-start hooks.

### Bet 5 — The method rig

Builds the method rig — the tool that tests the parts of the spec that call for judgment, not logic.

**Done when:** the slice scenario runs end to end and passes three times out of five. A rubric returns red against a known-bad transcript that was held out from its own authoring — not just the transcripts it was calibrated on. Scenarios for machinery that doesn't exist yet are committed red. The shelf reports which scenarios are waiting on which bet.

**Lands:** the rig on subagent transport, the scenario shelf, judge-only replays over the real archives, the scripted owner, calibration fixtures.

### Bet 6 — The Record

Builds checks that verify documentation mechanically, instead of just hoping it's right.

**Done when:** the doc checks are calibrated on wordloop and magpie. Then they pass, unchanged, on a third repo's docs — one held out from that tuning. A doc whose anchors don't parse reports as unassessed, not as green. Magpie's docs are brought to green. The divergence row goes red on a fixture where two slices solved the same-shaped problem two different ways. It stays green on a consistent pair it was never tuned against.

**Lands:** the doc lint, the citation-overlap mechanic, staleness rows, the cold-reader eval, the reversal rule, ratchets, the divergence row, the module graph.

### Bet 7 — The corpus

Tests the spec's central claim: a small body of prose can do the work of a much larger one.

**Done when:** the word target is written into this bet's brief before any corpus text is written. An agent given only the kernel — plus what it loads on demand — correctly delivers three differently shaped slices in the rig. A rubric written before the corpus existed does the scoring. The published word count lands inside the pre-stated target.

**Lands:** the kernel, the adoption sheets and stack seeds, ways-of-working, design conventions including business logic and the journey-first walk order, the worker contract and tier rule, the boundary-linter configs.

### Bet 8 — Review at human pace

Builds the slice-review loop. It works on its own at dial `slice`.

**Done when:** a reviewer correctly answers fixed comprehension questions about a slice, using only its capsule. On the complex lane, the person who writes the accepting suite never sees the implementation. Their transcript has no implementation in it. Their brief has no implementation-derived specifics — no names, no line numbers, no algorithm choices beyond what the design already states. Bet 5's blind-author cheat scenario goes green.

**Lands:** lanes and the lane audit, capsules, the adversary, the blind author and the test auditor, fix-in-place, the ripple caller list, patch-trailer mining, the bypass signals.

### Bet 9 — Autonomy and the dial

Builds unattended runs, and keeps the owner caught up on what happened.

**Done when:**
- A bet runs at dial `bet` to completion, unattended.
- Every pause matches an item on the stopping rule and gets journaled with its reason. A run that ends with no journaled stop and no completed work fails.
- A flake quarantines, and the run continues.
- The launch gate refuses a plan seeded with an unanswered decision. It admits the plan once the decision is ruled.
- A two-bet program runs at dial `program` with a blocking concern seeded into the first bet. The run parks that bet, delivers the second, and stops only when nothing unblocked remains. Every park gets journaled.
- The program's launch forecast names its appointments before the run starts. A parked bet's walk artifacts exist before the owner arrives.
- A scripted question whose answer already sits in the ledger gets answered from the record. The would-be repeat gets journaled as a driver defect.
- A wrong default seeded into a run is caught by its canary before a third slice consumes it.
- The run's ledger holds no below-the-line entries — pattern and naming calls leave no paperwork.
- The teach-back covers every decision the run recorded. The next design walk's opening questions are checked against what it covered.

**Lands:** run modes as recorded state, the dial above `slice` including `program`, the stopping rule, the launch gate, standing rulings, the decision discipline, park-and-resume, non-blocking checkpoints, the teach-back.

### Bet 10 — The portfolio

Builds one address for everything, plus a seam that lets a second host plug in later.

**Done when:** two registered projects render correct positions from one address. Each position is checked against a hand-computed expectation. A moved repo renders flagged, instead of breaking the view. The host adapter contract gets written. A second host's adapter is stubbed against that contract, showing which capabilities degrade and how.

**Lands:** the registry, cross-project Queue ranking, the portfolio Map, the host adapter contract.

### Bet 11 — Front-door proofs

Proves user-facing work from where the user actually stands — inside the UI.

**Done when:** a user-facing capability is proven by a UI-driver case that asserts what the user actually sees. Break the screen on purpose: the UI case fails, while its headless twin still passes. The board's headline row shows the UI result. Seed an orphan screen — built, routed, but linked from nowhere. The reachability row turns red. The screen's UI proof fails too, because no navigation path reaches it from the entry point. The capability's page was sealed as a rendered mockup — pulled from the design canvas, or rendered locally on a host without canvas sync — and the UI review judged the shipped screen against that mockup.

**Lands:** the UI-driver toolchains per topology, the headless-plus-UI pairing rule, the walk-from-entry rule, the reachability row, the journey map, the design canvas lane, the board's UI headline row, release probes for deploying topologies.

### Bet 12 — The greenfield door

Turns a description of intent into a working product.

**Done when:** one intent conversation carries a product — one with at least one real design ambiguity — to its first green capability. The human seals once. The ambiguity gets settled by a recorded decision, not by template matching.

**Lands:** the intent artifacts with output contracts and depth gates, the birth seal, manifest build-out.

### Bet 13 — The brownfield door

Wraps an existing system without rewriting it.

**Done when:** install into a real multi-language repo the framework has never seen. It runs the day-one checks, maps its sockets under human approval, and reaches an adoption seal with a nominated blessed module. At least one socket is left unmapped on purpose. It renders as a red row — it doesn't pass quietly.

**Lands:** day-one checks, the repo adapter, the adoption seal, incremental manifest and doc extraction, `add-capability`.

### Bet 14 — Operating what shipped

Covers what happens to software after it merges — patches, releases, and production.

**Done when:** a break-glass patch ships on its touched-path probes. When the next normal slice runs, the specific check the patch skipped fails on the specific gap the patch left behind. A half-delivered bet withdraws: its board freezes, and its evidence stays readable after teardown. A release stamps a version, derives a changelog, and passes a deploy probe — against the same target already serving bet 11's front-door proof.

**Lands:** the break-glass path, production-signal intake, withdraw and revert, the release step, dependency intake, and the opt-in flag lane — registry, scan, Map rendering, flip events.

### Bet 15 — Updates and migration

Moves what already exists onto the new framework. **This is the fallback resting point** (§4).

**Done when:** an update reconciles framework-owned files and touches nothing project-authored. Prove this against three collision shapes: the same filename, a framework file the project renamed, and a project file inside a framework-reserved directory. Hooks and CI stanzas arrive as proposals — never auto-written. Magpie and staycurrent cross the boundary release and verify green. A diff review confirms no project-authored content changed.

**Lands:** the update engine, blast-radius classes, ratchet arrival for new and changed checks, signed provenance, the boundary release, and the handoff from npm package to installed binary.

### Bet 16 — Retirement and cutover

Retires the old framework. The new one stands on its own.

**Done when:** the battery passes against a repo built by at least three of the retired generators, used together. Then the generators are deleted. The bet after this one is delivered by the new framework, with the hand-rolled harness removed. It includes at least one rubric-scored proof, not only deterministic tests.

**Lands:** generator retirement, dev mode, the harness's removal, the cutover.

---

## 2. Coverage

### Build (43)

| ID | Item | Bet |
|---|---|---|
| B0 | The doc lint and the citation-overlap mechanic | 6 |
| B1 | The cold-reader doc eval | 6 |
| B2 | The program artifact | 3 |
| B3 | Run modes as recorded state | 9 |
| B4 | The journal | 1 |
| B5 | Finding attribution and durable evidence | 1 |
| B6 | Defect-class tags on findings | 1 |
| B7 | Two-direction decomposition traceability | 3 |
| B8 | Fresh-context capsule generation | 8 |
| B9 | The cross-bet invalidation signal | 3 |
| B10 | The teach-back | 9 |
| B11 | Operating what shipped (flake clause lands in bet 2) | 14 |
| B12 | The battery | 2 |
| B13 | Topology profiles and the capability manifest | 2 |
| B14 | Ratchet infrastructure | 6 |
| B15 | The proof plan | 3 |
| B16 | The blind author and the test auditor | 8 |
| B17 | Paired front-door proofs | 11 |
| B18 | Evidence-of-execution rows | 2 |
| B19 | The red-for-the-right-reason stub check | 3 |
| B20 | Drive artifacts and waivers | 2 |
| B21 | The Queue and the Map | 4 |
| B22 | The project registry | 10 |
| B23 | The tower | 4 |
| B24 | The session-start position snapshot hook | 4 |
| B25 | The board derivation | 3 |
| B26 | The bypass signals on the Map | 8 |
| B27 | The known-gaps view (clustering activates with K5 in bet 8) | 4 |
| B28 | The checkpoint host hook | 4 |
| B29 | The adoption seal flow | 13 |
| B30 | Dev mode | 16 |
| B31 | The method rig rebuilt on subagents | 5 |
| B32 | The host adapter contract | 10 |
| B33 | The flag lane, opt-in | 14 |
| B34 | The launch gate | 9 |
| B35 | Standing rulings | 9 |
| B36 | Park-and-resume | 9 |
| B37 | The decision discipline | 9 |
| B38 | The divergence row | 6 |
| B39 | The journey layer | 11 |
| B40 | Business logic as a walk discipline | 7 |
| B41 | The program autonomy contract | 9 |
| B42 | The design canvas lane | 11 |

### Keep (23)

| ID | Item | Bet |
|---|---|---|
| K0 | The 9 verification verbs under `verify` | 2 |
| K1 | The approved tag with its amendment protocol | 3 |
| K2 | The derivation contract | 3 |
| K3 | Lanes with ties lighter, plus the lane audit | 8 |
| K4 | Programs and bets as sealed artifacts | 3 |
| K5 | Patch-trailer mining | 8 |
| K6 | The design-doc shape and per-discipline conventions | 6 |
| K7 | Doc freshness, citations, the reversal rule | 6 |
| K8 | Two render surfaces survive | 4 |
| K9 | Adoption sheets and stack seeds | 7 |
| K10 | Setup output contracts and depth gates | 12 |
| K11 | The ways-of-working pages | 7 |
| K12 | The worker contract and the tier rule | 7 |
| K13 | Fix-in-place as the default fix path | 8 |
| K14 | Whole-ladder red materialization | 3 |
| K15 | The proofs board read row by row at acceptance | 3 |
| K16 | The ripple-slice caller list | 8 |
| K17 | The per-slice backup push | 1 |
| K18 | The simulation rig, kept small | 5 |
| K19 | `add-capability` | 13 |
| K20 | The update engine, permanently | 15 |
| K21 | The boundary-linter configs | 7 |
| K22 | The manifest-derived module graph | 6 |

### Delete (17)

The bet named is where the replacement lands, or where a gate passes first.

| ID | Item | Bet | The event |
|---|---|---|---|
| D0 | The 13-protocol operating contract | 7 | The kernel and ways-of-working replace it |
| D1 | The 4 personas as personas | 7 | Successor duties land across bets 7, 8, and 11 |
| D2 | The 7 review-lens briefs | 8 | The contracts they carry land with the reviewers |
| D3 | The three-lens-per-slice review | 8 | One adversary replaces three |
| D4 | The checkpoint-walkthrough subagent | 4 | The Map's milestone page carries the narrative |
| D5 | The six-writes-per-slice bookkeeping | 4 | The Map derives those pages |
| D6 | The separate polish stage | 8 | Merged into the screenshot read |
| D7 | Bet-close validation as a ceremony list | 3 | Its steps become battery rows |
| D8 | The explanatory ~75% of the engineer skills | 7 | Stack seeds replace them |
| D9 | The principles corpus as essays | 7 | Adoption sheets replace them |
| D10 | Setup conversation scripts and hand-off ceremony | 12 | Artifact shapes replace the script |
| D11 | Most of the 45k-word bet lifecycle prose | 7 | The corpus is written fresh |
| D12 | The sim harness's scenario backlog | 5 | The shelf is authored deliberately |
| D13 | repo-map, the whole verb | 6 | The module graph covers its one real use |
| D14 | The docs-site generator | 4 | The tower renders committed docs |
| D15 | The 10 Nx generators | 16 | Gated: the battery must pass generator-built output |
| D16 | The separate bet-progress suite | 3 | The board becomes a derived view |

### Open questions (36)

| ID | Question | Bet |
|---|---|---|
| O0 | The capsule format | 8 |
| O1 | Queue ranking weights and critical-paths list format | 4 |
| O2 | Per-lane decision-budget numbers | 8 |
| O3 | The battery version format and where seals record it | 2 |
| O4 | Brownfield socket-mapping mechanics and cost per repo | 13 |
| O5 | Citation syntax and diagram-lint scope | 6 |
| O6 | Cold-reader eval rubric and sample rate | 6 |
| O7 | Waiver record shape and expiry | 2 |
| O8 | Checkpoint hook implementation | 4 |
| O9 | Per-lane dial defaults and sensitive-paths format | 9 |
| O10 | Finding-attribution vocabulary and archival layout | 1 |
| O11 | Proof plan format and seal composition | 3 |
| O12 | Defect-class vocabulary and recurrence threshold | 1 |
| O13 | Tower address and daemon lifecycle | 4 |
| O14 | Cross-project Queue ranking | 10 |
| O15 | Whether the ambient layer ships | 10 |
| O16 | Test-marker syntax per stack | 3 |
| O17 | The journal's event schema | 1 |
| O18 | Update engine ownership-manifest format | 15 |
| O19 | The always-on kernel's contents | 7 |
| O20 | Dev mode's thresholds and issue template | 16 |
| O21 | The teach-back's return trigger | 9 |
| O22 | Rig scenario rubrics, fixtures, cost budgets | 5 |
| O23 | Blind author extraction and fix-loop visibility | 8 |
| O24 | UI-driver toolchain per topology | 11 |
| O25 | The auditor's source-citation format | 8 |
| O26 | Host adapter capability list and first other host | 10 |
| O27 | The per-stack battery adapter | 2 |
| O28 | Break-glass scope, withdraw cascade, flake thresholds | 14 |
| O29 | One trend publisher, two sources | 7 |
| O30 | One check-health signal | 4 |
| O31 | One staleness checker | 6 |
| O32 | Critical-paths and sensitive-paths: one list or two | 4 |
| O33 | One seal mechanism parameterized by kind | 3 |
| O34 | Execution sequencing and proving grounds | 0 |
| O35 | Flag registry format, scan mechanics, seeded backends | 14 |

---

## 3. What the tables show

**Seventeen bets, not twelve.** A first draft had twelve. Six reviews found that five of those bets each held two independently useful capabilities. By the spec's own definition, that makes them programs, not bets — a bet should be usable the moment it lands. So five bets each split in two: the battery split from the UI-driver proofs, the project board from the portfolio, the Record from the corpus, review from autonomy, and greenfield from brownfield. Smaller bets deliver value earlier, and fail more cheaply.

**The kernel now has its own bet.** In the first draft, the kernel was one row inside a twenty-item bet, sharing a close-out gate with doc tooling. It's the spec's central claim, so now it gets bet 7 to itself. It's proved by a rubric written before the corpus exists, against a target fixed before the writing starts. Both guards matter for the same reason: a team that sets its own target after the fact proves nothing.

**Row counts still mislead, in both directions.** Bet 14 has two rows but holds five separable mechanisms. Bet 15 has two rows but holds a real migration of three live installs. Bet 11's single pairing row hides three different UI-automation stacks. Bets 0 and 5 are the honest counts — their row height matches their real size. Judge each bet by what must be built, not by how many rows it has.

**Three bets gate what follows.** Bet 2 protects everything built after it. Bet 5 is the only instrument that can prove bets 7 through 14. Bet 16 cannot start until the battery passes generator-built output.

**Nothing is unassigned.** 118 of 118 items have exactly one bet, checked by script against [changes.md](north-star/changes.md).

---

## 4. Rules for running the ladder

- **Only the next bet is designed in full.** The rest stay at this depth until they are next.
- **A bet cannot close over an open question it owns.** §2 is its checklist.
- **Slices are cut at the start of each bet, not now.**
- **A failed done condition produces a decision, never a silent retry.** After a genuine attempt, the bet stops. It takes one of three shapes: redesign, descope with a stated new target, or fork the ladder. Bet 7 is the most likely to need this — it tests the spec's founding claim.
- **The amendment protocol applies to any landed bet, not only the current one.** Reopening a sealed bet re-runs the cross-bet invalidation check against every bet built after it.
- **The harness is counted like the corpus.** CI publishes the word count of the working agreement, this ladder, and the execution plan. Growth without a stated reason is a finding — the same rule the corpus lives under.
- **Real product work outranks the rebuild.** When both want the same quota window, the product wins. The day gets logged as rebuild-idle, not quietly absorbed.
- **Bet 15 is the fallback resting point.** If the ladder stops before bet 16, the three live installs are already migrated and verified. Bet 16 retires the old generators and makes the framework self-hosting. That matters for tidiness — not for whether real projects are served.
- **The rig's shelf fills as the ladder advances.** Scenarios for machinery not yet built are committed red at bet 5. Each one goes green in the bet that builds it.
- **Re-check the ladder at every bet close.** A delivered bet can invalidate a later one.
- **The harness shrinks as the ladder advances.** When a bet lands the real version of something the harness fakes, delete the fake in the same bet.
