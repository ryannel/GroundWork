# The rebuild ladder

**Status:** DRAFT. Twelve bets, and every commitment in the spec assigned to one of them. Firms up at ratification; the six veto points in the spec may move items between bets, but not many.
**Audience:** The owner ratifying the sequence, and the driver running it.
**Scope:** Order and coverage. How we deliver is [the execution plan](north-star-execution.md); what we build is [the spec](north-star/index.md).

---

## How to read this

The spec commits to 108 things: 33 to build, 23 to keep, 17 to delete, and 35 questions it deferred. §2 assigns every one of them to exactly one bet. That is the point of this document. A commitment with no bet is work nobody has agreed to do, and the tables make that visible before anyone starts rather than after something ships without it.

Each item carries an ID — `B0`–`B32` for build, `K0`–`K22` for keep, `D0`–`D16` for delete, `O0`–`O34` for open. The IDs are positions in [changes.md](north-star/changes.md)'s lists, so the coverage check is mechanical.

**Deletions work differently in a new repo.** Most of the delete list happens by not porting: nothing gets carried, so nothing needs removing. An item only earns a bet when something must actively happen — a replacement has to land first, or a gate has to pass before the old thing can go. §2's delete table names that event.

**Done conditions are falsifiable on purpose.** Each one is a thing you can attempt and watch fail. "The battery works" is not a done condition. "Point it at a suite that passes with the implementation deleted, and it goes red" is.

---

## 1. The ladder

### Bet 0 — The floor

Get a repo that can hold work. No framework code.

**Done when:** CI runs on every push and fails the build when a test fails — proved by a deliberately failing test, not by assertion. `docs/carried-over.md` exists, was produced by the single quarantined port pass, and has been register-reviewed. The working agreement is in place as the always-on file.

**Lands:** the repo, CI, the test runner, the working agreement, the port list, this ladder.

### Bet 1 — The CLI and the journal

The meter. Everything after this bet is measured while it is built.

**Done when:** running any CLI verb writes one journal line to the repo's journal ref, carrying role, tier, tokens, and duration. Asking for spend by role over a window returns numbers. Two branches that both wrote journal lines merge without conflict. Findings and decisions ledgers accept entries and every finding records what caught it.

**Lands:** the journal, the ledgers with attribution and class tags, the CLI skeleton, git discipline.

### Bet 2 — The battery

The anti-cheat floor, so everything built after it is protected by it.

**Done when:** `verify` goes red against a repo whose tests still pass with the implementation deleted; red against a suite that compiles but never runs; red against a probe that claims a capability the product does not have; and green against an honest repo. Every row's outcome appears in the journal.

**Lands:** the battery behind one `verify`, the scans, the deletion test, run evidence, topology profiles and the capability manifest, paired front-door proofs.

### Bet 3 — Planning and the board

Turn a goal into proofs that cannot be edited into looking done.

**Done when:** decomposing a two-milestone bet produces a board where every proof is red for the right reason — including the check that catches a stub whose assertion is commented out. Delivering one slice turns exactly one row green, derived from the test run, with no file edited to make it so. A proof on an unreached rung that goes green is flagged.

**Lands:** program and bet artifacts, the derivation contract, proof plans, board derivation, test markers, two-direction traceability, seals and the amendment protocol.

### Bet 4 — The surfaces

The planning record stops being invisible.

**Done when:** from one address, with no server started by hand and no particular branch checked out, you can see every registered project's position and drill into any bet's docs. Stop the daemon, and `groundwork where` still answers from the same derivation. A session opened in a registered repo receives its position without anyone asking.

**Lands:** the registry, the tower, the Queue, the Map, the board page, known gaps, bypass signals, both hooks, the host adapter contract.

### Bet 5 — The method rig

The instrument that proves the parts of this spec that are judgment, not logic.

**Done when:** the slice scenario runs end to end and passes three times in five. A rubric scored against a transcript already known to be bad returns red — proving the rubric can fail before it grades anything new. The blind-author cheat scenario catches a runner briefed to cut corners.

**Lands:** the rig on subagent transport, the scenario shelf, judge-only replays over the real archives, the scripted owner, calibration fixtures.

### Bet 6 — The corpus

The claim this whole spec rests on: a small body of prose does the work of a large one.

**Done when:** an agent given only the kernel plus what it loads on demand delivers a slice correctly in the rig. The shipped word count is published with its trend and sits in target range. The doc checks are calibrated — wordloop's data-flow doc passes content and fails anchors, magpie's docs do the reverse — and then magpie's docs are brought green.

**Lands:** the kernel, the adoption sheets and stack seeds, ways-of-working, design conventions, the doc lint and citation-overlap mechanic, the cold-reader eval, ratchets, the module graph, the boundary-linter configs.

### Bet 7 — The review loop

Delivery at human pace: the lanes, the reviewers, and the dial.

**Done when:** a bet runs at dial `bet` to completion without company, stops only for items on the stopping rule, and every stop is journaled with its reason. A slice arrives in the Queue as a capsule you can judge in two minutes. On the complex lane, the accepting suite is written by an agent whose transcript shows it never read the implementation.

**Lands:** lanes and the lane audit, capsules, run modes and the dial, the adversary, the blind author and the test auditor, drive artifacts, waivers, the teach-back, fix-in-place, the ripple caller list.

### Bet 8 — The doors

Both ways in.

**Done when:** one intent conversation takes a new product to its first green capability with the human sealing once. And installing into a repo the framework has never seen runs the day-one checks, maps its sockets under human approval, and reaches an adoption seal with a nominated blessed module.

**Lands:** greenfield intent through birth seal and manifest build-out, brownfield day one, the repo adapter, the adoption seal, incremental manifest and doc extraction, output contracts and depth gates, `add-capability`.

### Bet 9 — Operating what shipped

The life of software after the merge.

**Done when:** a break-glass patch ships on its touched-path probes alone and the checks it skipped block the next normal slice. A half-delivered bet can be withdrawn with its evidence surviving teardown. A release stamps a version, derives a changelog, and passes a deploy probe against a real target. A flaky proof quarantines instead of stopping an unattended run.

**Lands:** the break-glass path, production-signal intake, withdraw and revert, the release step, the flake policy, dependency intake.

### Bet 10 — Updates and migration

Moving what exists onto the new thing.

**Done when:** updating a project reconciles framework-owned files and touches nothing the project authored — proved against a repo carrying an app-authored file with a colliding name. Hooks and CI stanzas arrive as proposals, never auto-written. Magpie and staycurrent both cross the boundary release and verify green afterwards.

**Lands:** the update engine, blast-radius classes, ratchet arrival for new and changed checks, signed provenance, the boundary release.

### Bet 11 — Retirement and cutover

The old thing goes, and the new thing stands on its own.

**Done when:** the battery passes against a repo the old generators built, and the generators are deleted. The new framework delivers its own next bet with the hand-rolled harness removed.

**Lands:** generator retirement, dev mode, the harness's removal, the cutover.

---

## 2. Coverage

Every commitment, and the bet that owns it.

### Build (33)

| ID | Item | Bet |
|---|---|---|
| B0 | The doc lint and the citation-overlap mechanic | 6 |
| B1 | The cold-reader doc eval | 6 |
| B2 | The program artifact | 3 |
| B3 | Run modes as recorded state | 7 |
| B4 | The journal | 1 |
| B5 | Finding attribution and durable evidence | 1 |
| B6 | Defect-class tags on findings | 1 |
| B7 | Two-direction decomposition traceability | 3 |
| B8 | Fresh-context capsule generation | 7 |
| B9 | The cross-bet invalidation signal | 3 |
| B10 | The teach-back | 7 |
| B11 | Operating what shipped | 9 |
| B12 | The battery | 2 |
| B13 | Topology profiles and the capability manifest | 2 |
| B14 | Ratchet infrastructure | 6 |
| B15 | The proof plan | 3 |
| B16 | The blind author and the test auditor | 7 |
| B17 | Paired front-door proofs | 2 |
| B18 | Evidence-of-execution rows | 2 |
| B19 | The red-for-the-right-reason stub check | 3 |
| B20 | Drive artifacts and waivers | 7 |
| B21 | The Queue and the Map | 4 |
| B22 | The project registry | 4 |
| B23 | The tower | 4 |
| B24 | The session-start position snapshot hook | 4 |
| B25 | The board derivation | 3 |
| B26 | The bypass signals on the Map | 4 |
| B27 | The known-gaps view | 4 |
| B28 | The checkpoint host hook | 4 |
| B29 | The adoption seal flow | 8 |
| B30 | Dev mode | 11 |
| B31 | The method rig rebuilt on subagents | 5 |
| B32 | The host adapter contract | 4 |

### Keep (23)

| ID | Item | Bet |
|---|---|---|
| K0 | The 9 verification verbs under `verify` | 2 |
| K1 | The approved tag with its amendment protocol | 3 |
| K2 | The derivation contract | 3 |
| K3 | Lanes with ties lighter, plus the lane audit | 7 |
| K4 | Programs and bets as sealed artifacts | 3 |
| K5 | Patch-trailer mining | 7 |
| K6 | The design-doc shape and per-discipline conventions | 6 |
| K7 | Doc freshness, citations, the reversal rule | 6 |
| K8 | Two render surfaces survive | 4 |
| K9 | Adoption sheets and stack seeds | 6 |
| K10 | Setup output contracts and depth gates | 8 |
| K11 | The ways-of-working pages | 6 |
| K12 | The worker contract and the tier rule | 6 |
| K13 | Fix-in-place as the default fix path | 7 |
| K14 | Whole-ladder red materialization | 3 |
| K15 | The proofs board read row by row at acceptance | 3 |
| K16 | The ripple-slice caller list | 7 |
| K17 | The per-slice backup push | 1 |
| K18 | The simulation rig, kept small | 5 |
| K19 | `add-capability` | 8 |
| K20 | The update engine, permanently | 10 |
| K21 | The boundary-linter configs | 6 |
| K22 | The manifest-derived module graph | 6 |

### Delete (17)

Most of these need no work: the new repo simply never has them. The bet named is where the *replacement* lands, or where a gate must pass first.

| ID | Item | Bet | Why it needs an event |
|---|---|---|---|
| D0 | The 13-protocol operating contract | 6 | The kernel and ways-of-working replace it |
| D1 | The 4 personas as personas | 6 | Their surviving duties move into the corpus |
| D2 | The 7 review-lens briefs | 7 | The contracts they carry land with the reviewers |
| D3 | The three-lens-per-slice review | 7 | One adversary replaces three |
| D4 | The checkpoint-walkthrough subagent | 4 | The Map's milestone page carries the narrative |
| D5 | The six-writes-per-slice bookkeeping | 4 | The Map derives those pages |
| D6 | The separate polish stage | 7 | Merged into the screenshot read |
| D7 | Bet-close validation as a ceremony list | 3 | Its steps become battery rows |
| D8 | The explanatory ~75% of the engineer skills | 6 | Stack seeds replace them |
| D9 | The principles corpus as essays | 6 | Adoption sheets replace them |
| D10 | Setup conversation scripts and hand-off ceremony | 8 | The door's artifact shapes replace the script |
| D11 | Most of the 45k-word bet lifecycle prose | 6 | The corpus is written fresh |
| D12 | The sim harness's scenario backlog | 5 | The shelf is authored deliberately |
| D13 | repo-map, the whole verb | 6 | The module graph covers its one real use |
| D14 | The docs-site generator | 4 | The tower renders committed docs |
| D15 | The 10 Nx generators | 11 | Gated: the battery must pass against a generator-built repo |
| D16 | The separate bet-progress suite | 3 | The board becomes a derived view |

### Open questions (35)

The bet that must answer each before it can close.

| ID | Question | Bet |
|---|---|---|
| O0 | The capsule format | 7 |
| O1 | Queue ranking weights and critical-paths list format | 4 |
| O2 | Per-lane decision-budget numbers | 7 |
| O3 | The battery version format and where seals record it | 2 |
| O4 | Brownfield socket-mapping mechanics and cost per repo | 8 |
| O5 | Citation syntax and diagram-lint scope | 6 |
| O6 | Cold-reader eval rubric and sample rate | 6 |
| O7 | Waiver record shape and expiry | 7 |
| O8 | Checkpoint hook implementation | 4 |
| O9 | Per-lane dial defaults and sensitive-paths format | 7 |
| O10 | Finding-attribution vocabulary and archival layout | 1 |
| O11 | Proof plan format and seal composition | 3 |
| O12 | Defect-class vocabulary and recurrence threshold | 1 |
| O13 | Tower address and daemon lifecycle | 4 |
| O14 | Cross-project Queue ranking | 4 |
| O15 | Whether the ambient layer ships | 4 |
| O16 | Test-marker syntax per stack | 3 |
| O17 | The journal's event schema | 1 |
| O18 | Update engine ownership-manifest format | 10 |
| O19 | The always-on kernel's contents | 6 |
| O20 | Dev mode's thresholds and issue template | 11 |
| O21 | The teach-back's return trigger | 7 |
| O22 | Rig scenario rubrics, fixtures, cost budgets | 5 |
| O23 | Blind author extraction and fix-loop visibility | 7 |
| O24 | UI-driver toolchain per topology | 2 |
| O25 | The auditor's source-citation format | 7 |
| O26 | Host adapter capability list and first other host | 4 |
| O27 | The per-stack battery adapter | 2 |
| O28 | Break-glass scope, withdraw cascade, flake thresholds | 9 |
| O29 | One trend publisher, two sources | 1 |
| O30 | One check-health signal | 2 |
| O31 | One staleness checker | 6 |
| O32 | Critical-paths and sensitive-paths: one list or two | 4 |
| O33 | One seal mechanism parameterized by kind | 3 |
| O34 | Execution sequencing and proving grounds | 0 |

---

## 3. What the tables show

**Load is uneven, and that is information.** Bets 6 and 7 carry the most — the corpus and the review loop — which is right, because those are the parts that are prose and judgment rather than code, and they are the parts the old framework got wrong. Bets 0 and 1 are small on purpose: the floor should be quick to reach.

**The kernel is one row and should worry us.** `O19` — the roughly 500 always-on words — is a single line in a table, and it is the spec's central claim. It sits in bet 6 because it needs the rig (bet 5) to prove it steers an agent. Everything before bet 6 runs on the hand-rolled working agreement instead, which is the honest interim answer, but it means the claim goes untested for six bets.

**Three bets gate the ones after them.** Bet 2 protects everything built later, so it comes before the bulk of construction. Bet 5 is the only instrument that can prove bets 6 through 9. Bet 11 cannot start until the battery passes against a generator-built repo.

**Nothing is unassigned.** 108 of 108 items have exactly one bet, checked by script against [changes.md](north-star/changes.md) rather than by eye. Distribution: bet 0 has 1 item, bet 1 has 8, bet 2 has 9, bet 3 has 16, bet 4 has 19, bet 5 has 4, bet 6 has 20, bet 7 has 19, bet 8 has 5, bet 9 has 2, bet 10 has 2, bet 11 has 3.

**The tail is thin, and that is a warning.** Bets 9 through 11 carry seven items between them, but they hold the whole operational life of the product, the migration of three live installs, and the retirement of the generators. The spec described those areas late and briefly, so they have fewer named commitments — not less work. Expect them to grow when they are designed in full, and do not read their short rows as small bets.

---

## 4. Rules for running the ladder

- **Only the next bet is designed in full.** The rest stay at this depth until they are next. Delivery teaches things the plan cannot know.
- **A bet cannot close over an open question it owns.** The tables in §2 are its checklist.
- **Slices are cut at the start of each bet, not now.** Cutting all of them today would guess at what the previous bet teaches.
- **Re-check the ladder at every bet close.** A delivered bet can invalidate a later one. That is the cross-bet invalidation signal, run by hand until `B9` makes it mechanical.
- **The harness shrinks as the ladder advances.** When a bet lands the real version of something the harness fakes, delete the fake in the same bet.
