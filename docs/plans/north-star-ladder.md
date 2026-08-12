# The rebuild ladder

**Status:** DRAFT, hardened by six independent reviews. Seventeen bets, with every commitment in the spec assigned to one. Firms up at ratification.
**Audience:** The owner ratifying the sequence, and the driver running it.
**Scope:** Order and coverage. How we deliver is [the execution plan](north-star-execution.md); what we build is [the spec](north-star/index.md).

---

## How to read this

The spec commits to 113 things: 37 to build, 23 to keep, 17 to delete, and 36 questions it deferred. §2 assigns every one to exactly one bet. That is the point of this document. A commitment with no bet is work nobody has agreed to do, and the tables make that visible before anyone starts.

Each item carries an ID — `B0`–`B36` for build, `K0`–`K22` for keep, `D0`–`D16` for delete, `O0`–`O35` for open. The IDs are positions in [changes.md](north-star/changes.md)'s lists, so the coverage check is a script, not an eye.

**Terms.** The bets use the spec's vocabulary — kernel, dial, lane, seal, socket, blessed module, front door. All are defined in [index.md](north-star/index.md)'s vocabulary section. Read that first if any are unfamiliar. Magpie and staycurrent are two existing products built with the old framework; wordloop is a fourth repo that predates it. All three appear as test fixtures.

**Deletions work differently on a clean slate.** Most of the delete list happens by not porting. An item earns a bet only when something must actively happen: a replacement lands first, or a gate passes before the old thing goes.

**Done conditions are meant to be attempted and watched fail.** "The battery works" is not one. "Point it at a repo it was never tuned against, and it correctly calls the hollow suite red" is. Several conditions require a fixture *held out* from the thing's own tuning, because a checker calibrated on two cases and then proved against those same two cases has proved nothing.

---

## 1. The ladder

The ladder starts on an already-blank repo. The reset commit — tag `legacy-final`, cut the `legacy` branch, blank main down to the spec, the working agreement, this ladder, and the execution plan — is part of ratification itself, not of any bet. The [execution plan](north-star-execution.md) has the sequence.

### Bet 0 — The floor

First work on the blank repo. No framework code.

**Done when:** main's CI fails the build on a failing Go test, shown by writing one that fails and then removing it. Legacy's Node CI is pinned to the `legacy` branch and green there. `docs/carried-over.md` was produced by the port-pass dispatch and reviewed for register in a separate session, with both commits visible in history. The settled decisions — Go, one repo, the reset — are recorded in `docs/decisions.md`.

**Lands:** CI on both lines, the test runner, the port list, the first ledger entries.

### Bet 1 — The CLI and the journal

The meter. Everything after this is measured while it is built.

**Done when:** three structurally different verbs each write a journal line to the journal ref, carrying role, tier, tokens, duration, and session id. Spend by role is queried from the ref rather than a fixture, and one token figure is cross-checked against the host's own reported usage. Two branches that both wrote lines merge with both surviving. Every finding in the ledger records what caught it.

**Lands:** the journal, the ledgers with attribution and class tags, the CLI skeleton, git discipline.

### Bet 2 — The battery

The anti-cheat floor, so everything built after it is protected by it.

**Done when:** `verify` correctly classifies two repos it was not tuned against — red where the tests survive the implementation being deleted, red where a suite compiles but never runs, red where assertions are vacuous, green where the work is honest. It runs clean against this repo's own history with no false red. A wrong check can be waived, and the waiver is recorded and counted. A flaky row quarantines instead of blocking.

**Lands:** the battery behind one `verify`, the three scans, the deletion test, run evidence, topology profiles and the capability manifest, waivers and drive artifacts, the flake policy.

### Bet 3 — Planning and the board

A goal becomes proofs that cannot be edited into looking done.

**Done when:** a two-milestone bet decomposes to a board that is red for the right reason, and the stub check catches three stub styles it was not tuned against — commented assertion, always-true assertion, empty body. Three slices land in sequence, each turning exactly its own row green from the test run, with no file edited to move the board.

**Lands:** program and bet artifacts, the derivation contract, proof plans, board derivation, test markers, two-direction traceability, seals and the amendment protocol.

### Bet 4 — The project board

The planning record for the repo you are in stops being invisible.

**Done when:** the Map's rendered position matches a position computed by hand from the repo's git log, checked with the daemon running and again after a new commit lands. Stop the daemon and `groundwork where` gives the same answer from the same derivation, not a cached copy. A session opened here receives its position without being asked.

**Lands:** the tower serving one repo, the Map and board pages, the Queue, known gaps, committed-doc rendering, the checkpoint and session-start hooks.

### Bet 5 — The method rig

The instrument that proves the parts of the spec that are judgment, not logic.

**Done when:** the slice scenario runs end to end and passes three times in five. A rubric returns red against a known-bad transcript held out from its own authoring, not only the ones it was calibrated on. Scenarios for machinery that does not exist yet are committed red, and the shelf reports which are waiting on which bet.

**Lands:** the rig on subagent transport, the scenario shelf, judge-only replays over the real archives, the scripted owner, calibration fixtures.

### Bet 6 — The Record

Documentation that is mechanically checked rather than hoped about.

**Done when:** the doc checks are calibrated on wordloop and magpie, then pass unchanged on a third repo's docs held out from that tuning. A doc whose anchors do not parse reports unassessed rather than green. Magpie's docs are brought green.

**Lands:** the doc lint, the citation-overlap mechanic, staleness rows, the cold-reader eval, the reversal rule, ratchets, the module graph.

### Bet 7 — The corpus

The claim the whole spec rests on: a small body of prose does the work of a large one.

**Done when:** the word target is written into this bet's brief before any corpus is written. An agent given only the kernel and what it loads on demand correctly delivers three slices of different shapes in the rig, scored by a rubric authored before the corpus existed. The published count sits inside the pre-stated target.

**Lands:** the kernel, the adoption sheets and stack seeds, ways-of-working, design conventions, the worker contract and tier rule, the boundary-linter configs.

### Bet 8 — Review at human pace

The slice-review loop, usable on its own at dial `slice`.

**Done when:** a reviewer correctly answers fixed comprehension questions about a slice using only its capsule. On the complex lane, the accepting suite's author has no implementation in its transcript and no implementation-derived specifics in its brief — no names, no line numbers, no algorithm choices beyond what the design states. Bet 5's blind-author cheat scenario goes green.

**Lands:** lanes and the lane audit, capsules, the adversary, the blind author and the test auditor, fix-in-place, the ripple caller list, patch-trailer mining, the bypass signals.

### Bet 9 — Autonomy and the dial

Work that runs without company, and an owner who stays caught up.

**Done when:** a bet runs at dial `bet` to completion unattended. Every pause matches an item on the stopping rule and is journaled with its reason; a run that ends with no journaled stop and no completed work fails. A flake quarantines and the run continues. The launch gate refuses a plan seeded with an unanswered decision, and admits it once the decision is ruled. A two-bet program runs at dial `program` with a blocking concern seeded into the first bet: the run parks that bet, delivers the second, and stops only when nothing unblocked remains, every park journaled. A scripted question whose answer already sits in the ledger is answered from the record, and the would-be repeat is journaled as a driver defect. The teach-back covers every decision the run recorded, and the next design walk's opening questions are checked against what it covered.

**Lands:** run modes as recorded state, the dial above `slice` including `program`, the stopping rule, the launch gate, standing rulings, park-and-resume, non-blocking checkpoints, the teach-back.

### Bet 10 — The portfolio

One address for everything, and a seam for a second host.

**Done when:** two registered projects render correct positions from one address, each checked against a hand-computed expectation. A moved repo renders flagged rather than breaking the view. The host adapter contract is written, and a second host's adapter is stubbed against it showing which capabilities degrade and how.

**Lands:** the registry, cross-project Queue ranking, the portfolio Map, the host adapter contract.

### Bet 11 — Front-door proofs

User-facing work proven where the user stands.

**Done when:** a user-facing capability is proven by a UI-driver case asserting what the user sees. Break the screen deliberately: the UI case fails while its headless twin still passes. The board's headline row shows the UI result.

**Lands:** the UI-driver toolchains per topology, the headless-plus-UI pairing rule, the board's UI headline row, release probes for deploying topologies.

### Bet 12 — The greenfield door

Describe intent, get a working product.

**Done when:** one intent conversation takes a product carrying at least one real design ambiguity to its first green capability, with the human sealing once. The ambiguity is settled by a recorded decision, not by template matching.

**Lands:** the intent artifacts with output contracts and depth gates, the birth seal, manifest build-out.

### Bet 13 — The brownfield door

Wrap an existing system without a rewrite.

**Done when:** installing into a real multi-language repo the framework has never seen runs the day-one checks, maps its sockets under human approval, and reaches an adoption seal with a nominated blessed module. At least one socket is left unmapped and renders as a red row rather than passing quietly.

**Lands:** day-one checks, the repo adapter, the adoption seal, incremental manifest and doc extraction, `add-capability`.

### Bet 14 — Operating what shipped

The life of software after the merge.

**Done when:** a break-glass patch ships on its touched-path probes, and the specific check it skipped fails on the specific gap it left when the next normal slice runs. A half-delivered bet withdraws with its board frozen and its evidence readable after teardown. A release stamps a version, derives a changelog, and passes a deploy probe against the same target already serving bet 11's front-door proof.

**Lands:** the break-glass path, production-signal intake, withdraw and revert, the release step, dependency intake, and the opt-in flag lane — registry, scan, Map rendering, flip events.

### Bet 15 — Updates and migration

Moving what exists onto the new thing. **This is the fallback resting point** (§4).

**Done when:** an update reconciles framework-owned files and touches nothing project-authored, proved against three collision shapes — the same filename, a framework file the project renamed, and a project file inside a framework-reserved directory. Hooks and CI stanzas arrive as proposals, never auto-written. Magpie and staycurrent cross the boundary release, verify green, and a diff review confirms no project-authored content changed.

**Lands:** the update engine, blast-radius classes, ratchet arrival for new and changed checks, signed provenance, the boundary release, and the handoff from npm package to installed binary.

### Bet 16 — Retirement and cutover

The old thing goes; the new thing stands on its own.

**Done when:** the battery passes against a repo built by at least three of the retired generators used together, and the generators are deleted. The bet after this one is delivered by the new framework with the hand-rolled harness removed, and it includes at least one rubric-scored proof rather than only deterministic tests.

**Lands:** generator retirement, dev mode, the harness's removal, the cutover.

---

## 2. Coverage

### Build (37)

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

**Seventeen bets, not twelve.** A first draft had twelve. Six reviews found that five of them each held two independently useful capabilities, which by the spec's own definition makes them programs rather than bets: a bet should be usable when it lands. The battery split from the UI-driver proofs, the project board from the portfolio, the Record from the corpus, review from autonomy, and greenfield from brownfield. Smaller bets deliver value earlier and fail more cheaply.

**The kernel now has its own bet.** In the first draft it was one row inside a twenty-item bet, sharing a close-out gate with doc tooling. It is the spec's central claim, so it gets bet 7 to itself, proved by a rubric written before the corpus exists and a target fixed before the writing starts. Both guards exist because the same team setting the target after the fact proves nothing.

**Row counts still mislead, in both directions.** Bet 14 has two rows and holds five separable mechanisms. Bet 15 has two rows and holds a real migration of three live installs. Bet 11's single pairing row hides three different UI-automation stacks. Bets 0 and 5 are the honest counts. Judge by what must be built, not by row height.

**Three bets gate what follows.** Bet 2 protects everything built after it. Bet 5 is the only instrument that can prove bets 7 through 14. Bet 16 cannot start until the battery passes generator-built output.

**Nothing is unassigned.** 113 of 113 items have exactly one bet, checked by script against [changes.md](north-star/changes.md).

---

## 4. Rules for running the ladder

- **Only the next bet is designed in full.** The rest stay at this depth until they are next.
- **A bet cannot close over an open question it owns.** §2 is its checklist.
- **Slices are cut at the start of each bet, not now.**
- **A failed done condition produces a decision, never a silent retry.** After a genuine attempt, the bet stops and takes one of three shapes: redesign, descope with a stated new target, or fork the ladder. Bet 7 is the one most likely to need this, because it tests the spec's founding claim.
- **The amendment protocol applies to any landed bet, not only the current one.** Reopening a sealed bet re-runs the cross-bet invalidation check against every bet built after it.
- **The harness is counted like the corpus.** CI publishes the word count of the working agreement, this ladder, and the execution plan. Growth without a stated reason is a finding, the same rule the corpus lives under.
- **Real product work outranks the rebuild.** When both want the same quota window, the product wins and the day is logged as rebuild-idle rather than quietly absorbed.
- **Bet 15 is the fallback resting point.** If the ladder stops before bet 16, the three live installs are already migrated and verified. Bet 16 retires the old generators and makes the framework self-hosting, which matters for tidiness, not for whether real projects are served.
- **The rig's shelf fills as the ladder advances.** Scenarios for machinery not yet built are committed red at bet 5 and go green in the bet that builds them.
- **Re-check the ladder at every bet close.** A delivered bet can invalidate a later one.
- **The harness shrinks as the ladder advances.** When a bet lands the real version of something the harness fakes, delete the fake in the same bet.
