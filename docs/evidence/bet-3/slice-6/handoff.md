# Handoff — bet 3 slice 6: two-direction traceability and the invalidation signal

Builder's running record, written as the work happened. Nothing is committed by me; the
driver lands after blind review.

Base: branch `claude/v2-clean-slate-tkuacl` at 63c4189, clean tree.

## What I read first

- CLAUDE.md, `docs/plan/rebuild/bet_3/b3s6.md`, `docs/evidence/bet-3/design.md` (R4, R12, R13, R15, R16, R17).
- `internal/plan/{plan,resolve,bind}.go` — what the plan row already enforces at load time.
- `internal/seal/{seal,verify,amend,grant,mirror}.go`, `internal/journal/seals.go`.
- `internal/battery/{battery,rows,planrow,boardrow,stubrow,sealrow,scan}.go` — the row idiom.
- `docs/decisions.md` D17, D23, D28, D33, D45, D49, D51, D52, D53, D54, D56, D57, D58, D59.
- `docs/findings.md` F35, F41, F53, F55, F61, F74, F75, F81, F87, F88, F90.
- `docs/derivation-contract.md` sections 1 to 3.

## What the plan row already reds, so this row must not

At 63c4189, `plan.Load` already refuses:

- the `from:` shape — one `#`, both halves non-empty, path charset, no space in the anchor (`checkFrom`);
- a `from:` path that is not a file in the repo (`resolveSlice` → `mustExist`);
- a slice `facing` id its bet does not declare (`resolveSlice`);
- a `deferred` id the bet does not declare as facing (`resolveBet`);
- repeated ids, repeated markers, milestones and slices that do not resolve.

Not enforced anywhere at 63c4189, and therefore this slice's:

- whether an anchor resolves to a heading anybody wrote (F41 records this as slice 6's job);
- whether every facing id is claimed exactly once or deferred — neither direction;
- anything at all about `premises` — parsed as ids, resolved to nothing.

The row is **unrunnable** (never red) on a plan that will not load, so one fault draws one red.
A test pins that: `TestTraceRowIsUnrunnableOnAPlanThatWillNotRead` asserts the plan row is red on
the same repo. Both headline proofs also assert the plan row is **green** on their red fixtures,
so the reds they measure are this row's own catch.

## What was built

New package `internal/trace` (the derivation) and `internal/battery/tracerow.go` (the row).

- `trace.Check(root, set)` returns a `Report`: `Proofs`, `Facing`, `Premises` counts, plus
  `Dangling`, `Unclaimed`, `Twice` (the three reds), `Marked` (loud), and `UnsealedDesign` /
  `UnsealedPremise` (loud, counted apart because their causes differ — D52.3).
- The slug computation lives in ONE place, `anchorsIn` in `internal/trace/trace.go`. Nothing else
  in the repo computes a heading anchor.
- `seal.SubjectOf(tag)` is new and exported from `internal/seal/mirror.go` — the inverse of
  `TagName`, reusing `checkTagName`, so there is one rule about what a seal tag is called (D54.1).
  The row never cuts a tag name apart itself.
- Seals are read through `seal.Verify` and `journal.Seals`, not through a second walk of refs.

Row: id `trace`, kind `trace` (new, joins D28's closed list under R16), blocking, thirteenth and
last in registration order. Battery 10.0 → **11.0**, digest `r0a7f797` → `rffb3f30`.

## The rulings I took (candidates for docs/decisions.md — I did not touch the ledgers)

**1. The unsealed posture: loud, never blocking, and it flips with R4's.**
R12 says the row fails when the anchor does not resolve "inside a sealed design file". Two
questions are folded into that sentence, and they get different answers.

- The anchor resolving is the red. That is the check's own subject, and it is decidable from the
  files.
- Whether a seal covers the design file is a state, not a fault. R4 already ruled this ground: in
  this environment there is no key the agents cannot read, so a rule that blocked on a missing
  seal would either put the key inside their reach or stop every run. D51.5 and D45 say the
  matching thing about subjects nobody sealed: no seal, nothing to misstate, and the line never
  claims one held.

So: a design file no seal covers, and a premise naming an artifact no seal names, are counted,
named on the line, and never red. The head carries `(unsealed)` whenever either is so — in the
head, where no cut reaches it, which is F61's lesson about a loud clause going silently
conditional at scale. The flip is named with R4's: when the owner's key signs seals, unsealed
becomes blocking, and that is a major bump.

This is what makes this repo's own verify honest rather than falsely red over three bets of
unsealed history. Its actual line today:

```
green  24 proofs: 0 dangling; 14 facing ids: 0 unclaimed, 0 claimed twice; 0 marked (unsealed): docs/evidence/bet-3/design.md carries no seal in this repo
```

**2. I did not grant the design seal, and I recommend the driver does it as its own dispatch.**
The machinery exists and an unsigned seal is grantable, but:

- a seal is a sign-off, and the builder of a slice granting the seal its own new row then reads is
  the self-graded shape this repo avoids everywhere else (review is blind);
- it makes repo state outside the commit the driver lands — a tag this host cannot push (F1, F12)
  and a mirror branch this host cannot delete (F31). CLAUDE.md says to stop and ask before a change
  that is hard to undo;
- the grant gate needs a green battery run in the journal (D51.2). Mid-slice the tree is
  uncommitted, so the seal would cover HEAD blobs that do not yet include this slice;
- nothing in the row's red path needs a real seal, because sealed-ness is never red. Both headline
  proofs walk the shipped path (D53.1) either way, and the premises proof grants and amends real
  seals through the real verb in scratch repos.

After landing, `groundwork seal grant --kind design --subject b3_design --path docs/evidence/bet-3/design.md`
on a green run flips this repo's own line from `(unsealed)` to a clean one. That is a one-command
follow-up the driver owns.

**3. A mark is loud, never red.** R13 says amending or withdrawing an artifact *marks* every later
bet whose premises name it. It never says red, and nothing in this bet gives a marked bet a way to
answer — the answer is a person re-reading the bet. A red nobody can clear is the friction-waived
class the design's own risk 5 names. So a marked bet is counted in the head and named among the
hits. R12's three failures, which R12 does spell "red", are the row's only reds.

**4. R13's "a battery row plus a journal line" is satisfied by the row's own line.**
Every row's verdict is journalled as a `battery-row` line under the run id, and this row's line
names the marked bets. A second journal kind would need the journal's closed `kind` vocabulary
opened, which is a D28-shaped ruling and the driver's, not a builder's. If the driver reads R13 as
asking for a distinct kind, that is a finding on this slice and a small follow-up.

**5. An item both claimed and deferred is claimed twice.** R12 says "claimed by exactly one slice's
proof, **or** listed under deferred with a reason". Both at once is two answers to one question:
the bet says it does not deliver the item and a slice says it does. It reds under the
claimed-twice count, and the hit says exactly which two records disagree.

**6. The design file is read from the working tree, not from HEAD.** D28's standing deferral says
the committed-content read arrives with R15, which is slice 7. Reading design docs from HEAD now
would front-run that ruling and leave one row reading two repos at once — the plan it is holding
them against comes from the working tree. Stated on the contract page (§4.1). If the driver wants
the HEAD read, slice 7 is where both moves land together.

**7. The mark does not clear.** The record holds the amendment forever, so a bet keeps its mark
until somebody rules on what clears one. Named on the page (§4.3) rather than left implicit.
Candidate finding below.

## Red / green split

The red set is exactly what fails at 63c4189 with no implementation. Verified by running the full
suite before any non-test file was written — output kept at `scratchpad/red-b3s6.txt`.

**Red at 63c4189 (test files and pins):**

| File | Why it is red at 63c4189 |
|---|---|
| `internal/trace/trace_test.go` (new) | names `Check`, `Report`, `Note`, `anchorsIn` — the package does not exist, so it does not build |
| `internal/trace/contract_test.go` (new) | same, plus it wants contract page section 4 |
| `internal/battery/tracerow_test.go` (new) | names `traceTotals` — undefined, so the package does not build |
| `internal/battery/planrow_test.go` | the kind vocabulary pin wants `trace` in the closed list |
| `internal/battery/battery_test.go` | the shipped-row pin wants a thirteenth row `trace/trace/blocking` |
| `cmd/groundwork/battery_test.go` | three summary pins want 13 rows: `13 rows`, `green 13`, and the hostile-repo split |

The hostile-repo split, justified: `TestVerifyRedPrintsTheWholeSummary` drives a repo with a bad
lock file and no manifest and no plan. It was `12 rows: green 5, red 2, unrunnable 5`. The trace
row on a repo with no `docs/plan` is green on the plan row's own D45 shape — it traces nothing, so
it can misstate nothing — so the split becomes `13 rows: green 6, red 2, waived 0, quarantined 0,
unrunnable 5`. Nothing else moves: the row never runs a suite, never reads a manifest, and reaches
git only through `journal.RepoRoot`, which that fixture has.

**Green at 63c4189 (survivor pins — they pass before and after, and they are here because the
slice touches what they guard):**

| File | What it pins |
|---|---|
| `internal/plan/plan_test.go` | unchanged; the contract's §1 pin still passes with §4 appended |
| `internal/board/contract_test.go` | unchanged; §3's pin is unaffected by the new section |
| `cmd/groundwork/*_test.go` (rest) | unchanged |

**The green commit's non-test files:** `internal/trace/trace.go`, `internal/battery/tracerow.go`,
`internal/battery/rows.go` (register), `internal/battery/battery.go` (kind vocabulary),
`internal/seal/mirror.go` (`SubjectOf`), `.groundwork-battery.json` (11.0+rffb3f30),
`docs/derivation-contract.md` (§4), `docs/plan/rebuild/bet_3/b3s6.md` (the `records:` line).

## The contract page and the records line

`docs/derivation-contract.md` gains section 4, "Two-direction traceability and premises": what an
anchor is (with the slug rule and its two worked examples), what a claim is, what the record says
about an artifact, and a twelve-row verdict table.

F90a: the slice declares what it touches. `b3s6.md`'s `records:` moves from `[]` to
`docs/derivation-contract.md`, so slice 7's record row will check the obligation.

The pin is structure-reading and verdict-driving (D54.1, D57.3):
`TestProof_b3s6_contract_the_page_and_the_row_agree_on_every_verdict` builds all twelve table rows
as real reports and holds each page verdict against what the code does. A flipped cell fails it, a
gutted table fails it, and a row on the page nothing drives fails it. `TestThePageSpellsTheSlugTheCodeComputes`
holds the page's two worked anchors to what `anchorsIn` actually computes.

## Candidate ledger entries

I did not touch `docs/findings.md` or `docs/decisions.md`. These are for the driver.

### Decisions

1. **The unsealed posture.** An anchor resolving is the red; whether a seal covers the file is a
   state, counted and named and never blocking, on R4's ground and D51.5's precedent. Same answer
   for a premise naming an artifact no seal names. The head carries `(unsealed)` whenever either
   is so, and the flip is R4's flip.
2. **A mark is loud, never red**, and it does not clear. R13 says "marks", never "red", and this
   bet gives a marked bet no way to answer.
3. **R13's journal line is the row's own battery-row line**, which names the marked bets. A
   distinct journal kind would need D28's closed vocabulary opened, which is the driver's ruling.
4. **An item both claimed and deferred is claimed twice.** R12's "or" is exclusive: two records
   answering one question.
5. **Design files are read from the working tree** until R15's slice moves committed reads onto
   the seal machinery, per D28's standing deferral.
6. **The builder does not grant the design seal.** It is a sign-off, it makes state outside the
   landed commit that this host can neither push nor delete, and no red of this row depends on it.
7. **The unsealed things are named as hits, not as a clause.** Each is one file or one artifact
   somebody can act on, and hits are what a line gives its bytes to first.

### Findings

1. **A mark never clears.** Once the record holds an amendment, every bet whose premises name that
   artifact stays marked forever. The answer — a person re-reading the bet, and something written
   down when they have — has no mechanism in this bet. Class: coverage-gap. Named on the contract
   page §4.3 rather than left implicit.
2. **This repo's own design is unsealed, so R12's "inside a sealed design file" is half enforced
   here.** The anchor half is enforced; the sealed half is a loud state until the driver grants
   `seal/design/b3_design`. Class: host-limit (it is R4's environment again). Closing action is one
   command on a green run.
3. **A proof's `from:` path is not held to its bet's `design:` list.** R2 calls that list "the paths
   of the sealed design docs", and R12 says the anchor resolves "inside a sealed design file" — but
   nothing refuses a proof that points at any other markdown file in the repo and resolves there.
   The unsealed count catches it loudly rather than redly. Class: coverage-gap. I left it out
   because R12 does not say it and a builder inventing obligations is the friction-waived class.
4. **A journal line nobody can parse leaves this row unrunnable even when no bet declares
   premises.** `journal.Seals` is read whether or not the record has anything to say to this row.
   The chain row owns that red; this row's unrunnable is honest but wider than it needs to be.
   Class: other. Low.
5. **An underlined (setext) heading makes no anchor here.** A design file that uses one has
   anchors this row calls dangling. The page states it (§4.1) and says to write the heading with
   `#`s. Class: coverage-gap. Low.

## The blanking table

Fifty rules, one blank each, four answers per F55: killed, survived, did-not-build, and
can-never-fail. A did-not-build is a non-answer, so every one of them was re-blanked until the
mutation was the rule and not the compiler. The sweep script and its three passes are kept at
`scratchpad/sweep.py`, `sweep2.py`, `sweep3.py`, with the raw output in `sweep-1.txt` to
`sweep-3.txt`.

Each pass ran `go test ./internal/trace/` whole and `go test ./internal/battery/ -run 'Trace|b3s6'`
— the filter carries the proof markers, which is the harness lesson D56 records.

**Final: 48 killed, 0 survivors, 2 declared can-never-fail.**

| Pass | Rules | Killed | Survived | Did not build |
|---|---|---|---|---|
| 1 | 50 | 37 | 6 | 7 |
| 2 | 11 (7 re-blanked, 4 with new tests) | 8 | 3 | 0 |
| 3 | 3 | 3 | 0 | 0 |

What the survivors bought — each is a test this slice would not otherwise have had:

1. **A seal with no journal line behind it read as unsealed and nothing said so.** That is R5's
   restored seal in a fresh clone: the tag travelled, the journal did not. The code was right and
   nothing drove it. `TestASealWithNoJournalLineBehindItStillCountsAsSealed` now does.
2. **Seven hashes, and a `#` with no space after it.** Two `headingOf` guards nothing drove.
   `TestALineThatIsNotAHeadingMakesNoAnchor` drives both.
3. **The row's `printable` on a hit.** Nothing carried a control character. An anchor is where one
   gets in — the plan reader refuses a space and a tab in one and says nothing about the rest — so
   `TestATraceLineNeverCarriesAControlCharacter` drives a real plan file with two control bytes in
   its anchor, through the row, and asserts the plan row took it.
4. **`anchorsOf`'s path unwrap.** Nothing asserted the machine's own directory stays off the note.
5. **`SubjectOf`'s refusal.** Nothing drove a name that is not a seal tag's.
   `TestSubjectOfReadsASealTagAndRefusesEverythingElse` in `internal/seal` does, over all four kinds
   and eight bad names.
6. **The from:-shape guard.** Unreachable through a plan file, because the plan reader refuses that
   shape. It is the contract of `Check` itself, and
   `TestAProofWhoseFromHoldsNoAnchorIsSkipped` drives it with the four shapes a caller could hand in.

The two can-never-fail rules, declared rather than left implied (F88's own rule):

- `readSeals` skipping a journal line whose tag is not a seal tag's. What a premise reads is
  `tagsOf`, which only ever holds real seal tag names, so an action filed under any other name
  would never be looked up. The comment in the code says so.
- `claim` filing one tag once. `stateOf` answers the same for a list that repeats a tag. The
  comment says so.

## The proofs, run

**gofmt clean, `go vet ./...` clean.**

**`go test -p 1 ./...` green alone** (`scratchpad/green-2.txt`). `internal/battery` took **136.9 s**,
inside the 180 s clock — the trace row adds no suite run of its own, so the package's cost is the
new fixtures only.

**One full verify alone**, `GROUNDWORK_SESSION=b3s6 go run ./cmd/groundwork verify`, kept whole at
`scratchpad/verify-b3s6.txt`:

```
run run-20260826T213350Z-dc00
battery 11.0+rffb3f30
ROW           OUTCOME  EVIDENCE
version       green    .groundwork-battery.json declares 11.0+rffb3f30, and the rows compute the same digest
manifest      green    .groundwork/manifest.json declares 7 capabilities on 1 surface, and a discovered suite proves every one
honesty       green    the honesty scan read 923 tests in 11 suites, and every one can fail
wiring        green    the wiring scan read 81 exported functions in 64 files, and a non-test file names every one
token         green    the token scan is not applicable to profile cli, by declaration
run-evidence  green    the run-evidence row reconciled 923 discovered tests in 11 suites on 1 surface, and the run log names every one
mutate        green    the deletion test killed every one of 9 mutants it judged: sampled 10 of 118 targets at 11.0+rffb3f30: killed 9 (1 by crash), 1 did not compile; 1 file was left out of this build
plan          green    docs/plan holds 1 program, 1 bet and 8 slices, and every id and reference in them resolves
chain         green    546 lines across 190 sessions in refs/groundwork/journal: every chain holds, and 353 lines came before the chain and went unchained, in 182 sessions with nothing chained
seal-verify   green    this repo holds no seal tag, so nothing is sealed and no covered path can have moved
board         green    24 proofs, 2 landed (shallow): 19 ahead of plan, 0 behind, 0 trailers misstated, 0 unread: b3s1_shapes is expected red and passed in the run and 18 more
stub          green    24 proofs expected red: 0 red at an assertion, 0 not, 19 ahead of plan, 5 with no result: the honesty scan found no stub among them
trace         green    24 proofs: 0 dangling; 14 facing ids: 0 unclaimed, 0 claimed twice; 0 marked (unsealed): docs/evidence/bet-3/design.md carries no seal in this repo
13 rows: green 13, red 0, waived 0, quarantined 0, unrunnable 0
```

The trace line is honest about this repo's actual state: 24 proofs traced and none dangling, 14
facing ids and none unclaimed or claimed twice, no bet marked — and `(unsealed)`, naming the one
file the row read that no seal covers.

**The journal chains under session b3s6.** Fourteen lines: thirteen `battery-row` lines and the
run's own `battery` line, seq 1 to 14, each `prev` the sha256 path of the line before it, the
first with none. The trace row's own line:

```
{"v":2,"kind":"battery-row","session":"b3s6","seq":13,
 "prev":"481a4e9f…","run":"run-20260826T213350Z-dc00","row":"trace","outcome":"green",
 "evidence":"24 proofs: 0 dangling; 14 facing ids: 0 unclaimed, 0 claimed twice; 0 marked (unsealed): docs/evidence/bet-3/design.md carries no seal in this repo",
 "duration_ms":52}
```

That line is R13's journal line for a marked bet, and it is where a mark would be named.

## Left open

- The design seal is ungranted. The row says so on every line until the driver grants it.
- The five candidate findings above, the mark that never clears first among them.
- `docs/findings.md` and `docs/decisions.md` are untouched, per the dispatch.
