# Handoff — bet-3 slice 5 (the stub check)

Builder session. Base 6db5dc2, branch claude/v2-clean-slate-tkuacl. Working tree only, no commits.

## Status

- [x] Read CLAUDE.md, b3s5 plan, design.md R10, holdout.md.
- [x] Survey: board derivation, honesty scan vacuous code, adapter result states.
- [x] Tests first (red) — confirmed failing at 6db5dc2: `vet: stubrow_test.go: undefined: readTests`.
- [x] Implementation (green).
- [x] Blanking table — 21 of this slice's rules, all killed.
- [x] gofmt and vet clean, `go test -p 1 ./...` green alone.
- [x] Full verify alone, green at 10.0+r0a7f797, under session b3s5.

## What the survey found

- `board.Derive` gives `Row{Expected, Actual, Flag, Landed, Proof, Marker, Slice, Milestone}`.
  Actual is one of passed / failed / skipped / never ran. That is the population the
  stub row judges — it re-derives nothing.
- The honesty scan's vacuous judgment is `vacuousShape(file, fn, src, fset)` in
  internal/battery/honestyrow.go. The stub row lives in the SAME package, so it calls
  it directly. No export needed, no second definition.
- A build failure, a crash and a timeout never reach a per-test result. The Go adapter
  drops the whole run log and returns an error: `ErrBuildFailed`, `ErrTimedOut`, or a
  bare "go test crashed" / "left N tests unfinished" with no sentinel. `board.RunProofs`
  hands those back as `Blocked{Surface, Err}`.
- This repo's board at 6db5dc2 (`groundwork board`): 24 proofs, every one expected red.
  15 passed (b3s1-b3s4, flagged ahead of plan), 9 never ran (b3s5-b3s8).
- `docs/evidence/bet-3/holdout.md` — the committed record, read; not the branches.
  `holdout3-go-sift` lands milestone 1 whole and leaves milestone 2 unlanded, so every
  expected-red proof there fails at a real assertion. `holdout3-go-gauge` expects three
  green and six red and shows six passing and three failing, so its six reds are three
  planted stubs that pass beside three honest twins that fail. Both grade the same under
  the ruling below.

## Rulings made (candidates for docs/decisions.md)

### 1 — A passing expected-red proof is red only when its test cannot fail

R10 holds two sentences that pull against each other. Paragraph 1: "Green ahead of plan
is flagged, not silently accepted." Paragraph 2: "Passing ... fail[s] the row."

Read the second strictly and the row is red on every repo whose work runs ahead of its
plan. This repo is one: 16 proofs pass while expected red, because b3s1-b3s3 landed
before the Slice trailer existed and b3s4 sits on a milestone that is not finished. It
is not a state a repo can commit its way out of, either: every mid-bet repo has a landed
slice on an unfinished milestone.

D56 ruling 1 already settled that direction: "Expected-red-actually-green is the plan
lagging the work — the state of every honest slice between its test going green and its
commit landing, and of every repo whose history predates the trailer."

So the two sentences are reconciled by what R10's fourth paragraph makes load-bearing:
the honesty scan's vacuous judgment. The passing that fails the row is the stub passing —
the design's own example: "An empty body, a commented-out assertion, and an always-true
assertion all pass when the plan says they must fail." Those three shapes are the three
the honesty scan names, in its own words: "asserts nothing", "asserts nothing: the only
assertion is commented out", "only asserts under a condition that compares a value to
itself".

The rule: an expected-red proof that passed is red when the honesty scan says its test
cannot fail, with the scan's own reason named. One that passed with a test that can fail
is counted on the row's line and never red.

The cost, stated plainly: a stub the honesty scan cannot see — a `t.Fatal` under `if
false`, an assertion library the scan will not follow — passes this row. That is the same
precision-over-recall stance the honesty row already ships under, and it is the price of
not firing on every slice in flight. See finding F-a.

### 2 — A proof whose test does not exist is red only when its slice landed

R10's fixture list is a proof that passes, skips, fails to build, or dies. A test nobody
has written yet is on none of those, and the board reads it as on plan. A plan names the
proofs of slices 6, 7 and 8 before their tests exist; that is what a plan is for, and a
red there fires on every plan that looks ahead of its work.

But a slice that landed and left its proof with no test claimed work it never wrote.
Nothing else in the battery sees that. So: never-ran is counted; it is red, named, only
when the proof's own slice has landed.

### 3 — Build failure, crash and timeout are named at the surface

The adapter reports these for a whole run, never per test, so the row names the surface
and the reason rather than inventing a proof to blame. It is its own line, with its own
count in the head, because a run that could not compile makes every count on the ordinary
line a count of nothing. A red found this way outranks a surface the row could not read
at all; any other reason leaves the row unrunnable, which is the board row's rule.

It is answered after the expected-red count, not before: expected state comes from plan
position, and nothing a run did can move it. A repo with no red to judge owes this row
nothing whatever its surfaces did — and what they did is the run-evidence row's own red.

### 4 — The adapter gains one sentinel

`adapter.ErrCrashed` ("crashed before its tests finished"), wrapped where the Go adapter
reports a crash and where it reports tests left behind. Without it the stub row would
match the adapter's own sentences as strings, which is the parallel-definition class. It
sits beside ErrBuildFailed and ErrTimedOut, which exist for exactly this reason.

### 5 — Green ahead of plan is counted here and named by the board row

The stub row carries the count in its head, where no cut reaches it. The proofs are named
by the board row, whose subject they are. One list under two headings leaves a reader
hunting for a difference that is not there.

### 6 — The journal needs no new kind

The journal's kinds are line kinds, and a row's line is already `battery-row`. A row kind
rides as a field and reaches `journal.checkKind` never — it feeds the digest and the
`verify --list` table. So D28's battery kinds list gains `stub`, and
`internal/journal/kinds.go` is untouched. Same shape as `seal-verify`.

### 7 — The derivation is written once and read by two rows

`derivation`/`derived` in boardrow.go. Each row keeps its own sentences and its own
verdict, and each runs the proofs itself: a verify now runs the proofs twice, which is the
honest cost of a battery whose rows hold no shared state. A row handed another row's
answer is a row that proved nothing of its own.

## Findings candidates (docs/findings.md)

### F-a — The stub check can only see the stubs the honesty scan can see

What it is: ruling 1 makes the honesty scan's vacuous judgment the line between a stub and
green ahead of plan. The scan is precision-over-recall by design, so a test that passes
while it can never fail — `if false { t.Fatal(...) }`, an assertion helper in another file,
an assertion library — reads as honest and the stub row lets it through. The ladder's three
named styles are all caught; a fourth spelling of "always true" is not.

Why it is not fixed here: widening the scan's judgment changes a landed row's behaviour
mid-slice, and the fix belongs where the definition lives. A constant condition is as
vacuous as a self-comparison, and `selfComparison` could learn it in a slice of its own.

Class: coverage-gap. Caught by: the builder, reading R10 against D56 ruling 1.

### F-b — This repo's own record lags its work, and no commit can catch all of it up

What it is: the board reads 16 of this repo's 24 proofs as green ahead of plan. Twelve are
b3s1-b3s3's, whose commits predate the Slice trailer and cannot be amended; three are
b3s4's, whose milestone is not finished; one is b3s5's own. The last two kinds are the
ordinary state of a bet in flight and resolve when m_b3_board lands whole. The first kind
does not resolve at all unless a later commit carries the three trailers.

Class: record. Caught by: the builder, deriving this repo's own board.

## Red / green split

Red commit — fails at 6db5dc2 by construction (internal/battery does not build):

- internal/battery/stubrow_test.go (new)
- internal/battery/battery_test.go — the shipped-row pin gains stub/stub/blocking
- internal/battery/planrow_test.go — the row-kind pin gains "stub"
- internal/battery/boardrow_test.go — countTuples takes its width, so two searches share
  one justified sampling
- cmd/groundwork/battery_test.go — 11 rows to 12, in three places

Green commit:

- internal/battery/stubrow.go (new)
- internal/battery/boardrow.go — the derivation both rows start from, extracted
- internal/battery/honestyrow.go — judged/sourceRead/readTests, extracted
- internal/battery/rows.go, battery.go — registration, the kind, the doc comments
- internal/adapter/adapter.go, goadapter.go — ErrCrashed
- internal/adapter/adapter_test.go — the ErrCrashed assertions and the walked-out case
- internal/seal/verify_test.go — the survivor pin from the sample rotation
- docs/derivation-contract.md — section 3.5
- .groundwork-battery.json — 10.0+r0a7f797

The adapter and seal test files sit on the green side because both prove code that only
exists there: the sentinel and the pin land in the same commit as the behaviour they
hold.

### The hostile-repo split arithmetic

`TestVerifyRedPrintsTheWholeSummary` runs against a repo with no manifest and no plan. It
was `11 rows: green 4, red 2, unrunnable 5`. The stub row answers no-plan green before it
ever looks for a manifest, the same way the board row does, so the green count is the one
that moves: `12 rows: green 5, red 2, waived 0, quarantined 0, unrunnable 5`.

### Survivor pins from the sample rotation at 10.0

The bump rotated the deletion test's sample and it found one real survivor, exactly as
R16 says to budget for. It is not this slice's code, and the pin lands in the package that
owns it:

- `internal/seal/verify.go:99 (Result).Authority` survived, and the 59 tests of
  internal/seal stayed green. R4's whole control — only a good signature by a listed key
  is a person's sign-off — was proved on its false side only. Every case in
  `TestProof_b3s3_unsigned_never_reads_as_human_authority` walks a state that is not
  verified, because this container has no ssh-keygen: git's signing program is a shim that
  signs and cannot verify, so no test in the package can make a verified tag.
- The pin: `TestOnlyAVerifiedSignatureIsHumanAuthority` in internal/seal/verify_test.go,
  asking the rule directly over the whole signature vocabulary and two spellings that are
  not in it. Blanking `Authority` to `return *new(bool)` now fails that test; checked in a
  copy of the tree (`scratchpad/blankseal.py`, `blankseal.txt`).

The row's other two non-answers are F55's kind and not survivors: 1 mutant did not
compile, and 1 file was left out of the build.

## Blanking table

One rule blanked at a time in a copy of the tree, run against a filter that includes
this slice's proof markers (D56's harness lesson). F55's four answers are kept apart:
killed, survived, did not build, and can-never-fail. The script is
`scratchpad/blank.py`; the raw output is `blanking.txt`, `blanking2.txt`, `blanking3.txt`.

| # | The rule blanked | Answer |
|---|---|---|
| M1 | a passing proof whose test cannot fail is red | killed |
| M2 | a skipped proof is red | killed |
| M3 | a missing test on a landed slice is red | killed |
| M4 | a missing test on an unlanded slice is not red | killed |
| M5 | a failing proof whose test cannot fail is red | killed |
| M6 | a passing proof whose test can fail is not red | killed |
| M7 | the outcome is red when something is not red for the right reason | killed |
| M8 | a build failure is named | killed |
| M9 | a clock that fired is named | killed |
| M10 | a binary that died is named | killed |
| M11 | a broken surface turns the row red | killed |
| M12 | a surface broken some other way leaves the row unrunnable | killed, after the fix below |
| M13 | the scan's judgment reaches the proof by its marker | killed |
| M14 | only the proofs the plan expects red are judged | killed |
| M15 | a plan expecting no proof red says so | killed |
| M16 | the head carries the count of proofs with no test | killed |
| M17 | the line says which way it came out | killed |
| M18 | the row is registered | killed |
| M19 | the honesty scan's own judgment is what the shape comes from | killed |
| M20 | a crashed go test carries the seam's own marker | killed |
| M21 | tests left behind carry the seam's own marker | killed, after the fix below |

Two mutations needed a second pass, and both are recorded rather than hidden:

- M21 SURVIVED on the first sweep. The `len(started) > 0` branch of the Go adapter — a
  test binary that walked out — carried the new sentinel and nothing drove it.
  `TestGoAdapterRunRefusesARunWhoseBinaryWalkedOut` now does, with a fixture that sends
  itself SIGKILL. `os.Exit` does not reach that branch: the testing package catches it
  and turns it into a panic, which is the crash path.
- M12 DID NOT BUILD on the first two passes (`if false` left `named` unused). Re-run as
  `if !named && false`. `TestStubRowIsUnrunnableWhenItCannotReachTheBoard/a surface that
  broke some other way` was added to drive it.

One mutation outside this slice's rules is recorded because it was tried and survived:

| M22 | the crash marker needs a goroutine dump beside it (`crash != "" && running != ""`) | SURVIVED |

That guard is landed adapter code this slice did not touch, and F22 already names its
class. It is reported, not fixed: widening or narrowing a landed seam's crash detection
is its own slice.

## Verify tail

`GROUNDWORK_SESSION=b3s5 go run ./cmd/groundwork verify`, run alone, 13 minutes.
Full output at `scratchpad/verify-b3s5.txt`; the earlier run that found the survivor is at
`scratchpad/verify-b3s5-unnamed.txt`.

```
board   green  24 proofs, 1 landed (shallow): 16 ahead of plan, 0 behind, 0 trailers misstated, 0 unread: b3s1_shapes is expected red and passed in the run and 15 more
stub    green  24 proofs expected red: 0 red at an assertion, 0 not, 16 ahead of plan, 8 with no test: none of them is a stub, a skip or a red that proves nothing
12 rows: green 12, red 0, waived 0, quarantined 0, unrunnable 0
```

The stub row's line is this repo's honest state: every proof is expected red, because no
milestone has landed whole; 16 of them pass with tests that can fail, which is the plan
lagging the work; 8 have no test because slices 6, 7 and 8 are not built. Nothing is red
for the wrong reason, and nothing claims to be red for the right one.

The run's 13 journal lines sit under session `b3s5`, seq 1 to 13, each carrying the hash
of the one before it. The chain row read them and holds.

---

# Round 2 — the fix round after the blind review

Driver's list: F87/H1 (the sentences and the three-styles proof), F88/M1 (five survivors),
F89/M3 (a broken surface rides as a clause and the row still judges the rest), F90 (nine
smalls). Base for the round: 65f6af4 plus the round-1 working tree.

## Progress

- [x] F87 — the green sentence says what was checked; the seven scan-escaping plants read ahead of plan
- [x] F87/M2 — the three styles each assert their own reason, no "more" escape
- [x] F88 (a) duplicate-name guard  (b) clauses on the green branch  (c) blocked clause
      (d) broke-some-other-way clause  (e) the first-wins comment
- [x] F89 — broken surfaces named beside the stubs, counts lead
- [x] F90 (a)-(j)
- [x] blanking (31 killed, 1 can-never-fail), suite green alone, one full verify green

## What changed, item by item

**F87, the sentences.** `stubTotals.say()` now reads "the honesty scan found no stub
among them" — who looked, and what they found. The old line named a state of the world
that a precision-over-recall scan cannot establish.
`TestStubRowReadsAScanEscapingStubAsAheadOfPlan` plants seven tests that pass while
nothing in them can fail — `if false`, `if 1 == 2`, `if 2 < 1`, `if len("") > 0`, a
`switch` on false, a no-op helper in another file, a fake recorder — and pins all seven
as green ahead of plan under the honest sentence. It also fails if the old wording comes
back. The row's own doc comment loses its track-record claim and names the escape set
(F83, F86) instead.

**F87/M2, the three styles.** The headline proof now runs one fixture per style, so the
whole hit fits and each style's own reason is asserted by name: "asserts nothing", "the
only assertion is commented out", "compares a value to itself". Each case also fails if
the line carries "more" — the escape that made two of the three a tautology. A fourth
case keeps all three in one repo and asserts only the count, which is what one line can
honestly carry.

**F88, the five survivors.**
- (a) `TestAStubInOneSuiteIsNotMaskedByAnHonestTestOfTheSameName`: alpha holds an honest
  test, beta a stub of the same name, and the row stays red. Blanking the honest-reading
  skip lets alpha's empty judgment win and the case dies.
- (b) The clauses ride the quiet branch, pinned by
  `TestACleanStubRowStillSaysWhatItCouldNotRead` on a green row.
- (c) Same test: a node surface the scan cannot read is named on the line.
- (d) `TestStubRowSaysWhenItCouldNotRunASurface`: a Go surface with no module of its own,
  which no marker in R10's list explains, is named as a clause and reddens nothing.
- (e) The comment now describes the code: honest readings never enter the map, so every
  shape in it is a vacuous one and any of them turns the row red.

**F89, the broken surface.** `brokenSurfaces` no longer answers on its own. It hands back
hits for the surfaces R10 names, a clause for the ones it cannot name, and the fact that
some surface went unrun. The row reads and judges every surface that did run, and the
counts lead on that branch like any other. The stack's own words about a named surface
moved to a clause, so the hit itself is short enough that a stub and a broken surface both
fit on one line — which the two-surface case now pins.

One consequence, taken deliberately: a proof with no result is blamed only when every
surface ran. Otherwise a broken surface would turn every landed slice's proof red out of
missing data, which is the board row's own refusal.

**F90.** (a) b3s5.md declares `docs/derivation-contract.md` under `records`. (b) the stub
section is now 3.4 and the chapter closer 3.5, with the stub row's own sentence added to
the closer. (c) the prose names all five shapes the scan knows and says the ladder's three
are among them. (d) the pin drives the middle column through a name-to-judgment map, so a
stub described as the good red fails. (e) `board.Actuals()` is exported and pinned, and
`TestJudgeRedAnswersEveryStateTheRunCanReport` walks it — a fifth state fails there rather
than falling into a default arm. (f) the sentence reads "no test of it ran on any declared
surface" and the head count reads "with no result". (g) the unreachable red arm is gone;
a red always names something, and the search no longer builds a state the row cannot be
in. (h) `brokenSurfaces` says `d.name`. (i) the clock arm's comment says why it is
unreachable under default clocks. (j) the scan-stance sentence is split and its track
record dropped.


## Round-two blanking

The harness gained one correction of its own. The first pass called a live mutant dead:
its did-not-build detector read the test output for compiler words, and the row now
prints a compiler's own words on purpose. F55 says did-not-build is a non-answer, so it
is now asked for on its own — `go vet ./...` on the mutant — rather than guessed at from
what the tests printed.

| # | The rule blanked | Answer |
|---|---|---|
| M1 | a passing proof whose test cannot fail is red | killed |
| M2 | a skipped proof is red | killed |
| M3 | a missing result on a landed slice is red | killed |
| M4 | a missing result on an unlanded slice is not red | killed |
| M5 | a failing proof whose test cannot fail is red | killed |
| M6 | a passing proof whose test can fail is not red | killed |
| M7 | a stub turns the row red | killed |
| M7b | a broken surface turns the row red | killed |
| M8 | an honest reading never enters the map | killed |
| M8b | the first vacuous shape read is the one named | can never fail — see below |
| M9 | a build failure is named | killed |
| M10 | a clock that fired is named | killed |
| M11 | a binary that died is named | killed |
| M12 | a named broken surface becomes a hit | killed |
| M13 | an unnameable surface becomes a clause | killed |
| M14 | the scan's judgment reaches the proof by its marker | killed |
| M15 | only the proofs the plan expects red are judged | killed |
| M16 | a plan expecting no proof red says so | killed |
| M17 | the head carries the count with no result | killed |
| M18 | the quiet line says what was checked | killed |
| M19 | the row is registered | killed |
| M20 | the shape comes from the honesty scan's own judgment | killed |
| M21 | a crashed go test carries the seam's own marker | killed |
| M22 | tests left behind carry the seam's own marker | killed |
| M23 | no proof is blamed while a surface went unrun | killed |
| M24 | the broken surfaces are named before the proofs | killed |
| M25 | the stack's own words about a broken surface ride a clause | killed |
| M26 | the surfaces the scan cannot read ride a clause | killed |
| M27 | the unnameable surfaces ride a clause | killed |
| M28 | the run's vocabulary is four states | killed |
| M29 | a state the row does not know is not the good red | killed |
| M31 | the end of the stack's words is what is kept | killed |
| M32 | the machine's own directories come out | killed |

Thirty-one killed, one non-answer, and two rules removed rather than left unproved:

- **M8b can never fail, and the code now says so.** With the honest-reading skip in
  place, only vacuous shapes reach the map, so first-wins decides nothing but which of
  two equally-red readings gets named. Blanking it changes no verdict, and the comment
  states that rather than implying a rule.
- **M25 survived the first pass** because the clause it guards never fitted: it carried
  the seam's message from the front, which is the package path, and 70 bytes of that plus
  a head plus a named surface is over the journal's cap. The clause now carries the end of
  what the stack said — where a compiler puts the thing to fix — inside 50 bytes, and the
  build-failure case asserts the compiler's own word on the line. M31 and M32 are the two
  rules that reach it.
- **M30, the seam-marker trim, was removed.** Keeping the end of the message already drops
  the marker, so the trim decided nothing. Rather than record a second can-never-fail, the
  line went.
- **M26 (the pre-existing goroutine-dump guard in the adapter) is F88's sixth entry and
  stays as it is** — landed adapter territory, on the record rather than in a report.

## Round-two verify tail

`GROUNDWORK_SESSION=b3s5r2 go run ./cmd/groundwork verify`, run alone, 13 minutes.
Full output at `scratchpad/verify-b3s5.txt`.

```
board  green  24 proofs, 1 landed (shallow): 16 ahead of plan, 0 behind, 0 trailers misstated, 0 unread: b3s1_shapes is expected red and passed in the run and 15 more
stub   green  24 proofs expected red: 0 red at an assertion, 0 not, 16 ahead of plan, 8 with no result: the honesty scan found no stub among them
12 rows: green 12, red 0, waived 0, quarantined 0, unrunnable 0
```

The digest is unchanged at r0a7f797: nothing in the round moved a row's id, kind or
severity. `go test -p 1 ./...` is green alone, and internal/battery's suite is 142
seconds against the mutate row's 180-second per-mutant clock — seven seconds of the
headroom spent, on eleven new cases.

No cmd summary pin needed changing: the summary line carries counts, not row evidence,
and the hostile-repo split is still `12 rows: green 5, red 2, unrunnable 5` — the stub
row still answers no-plan green before it looks for a manifest.
