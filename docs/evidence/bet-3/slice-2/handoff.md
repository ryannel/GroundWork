# Handoff — bet-3 slice 2 (hash-chained journal, envelope v2, `chain` row)

Builder session. Working tree only, no commits. Base: 9d8963d on claude/v2-clean-slate-tkuacl.

## Status

Done. Working tree only, nothing committed. `go test ./...` green, gofmt clean,
go vet clean, and the full verify ends:

```
9 rows: green 9, red 0, waived 0, quarantined 0, unrunnable 0
```

at `7.0+r5a8f33c`. Full output: `scratchpad/verify-b3s2.txt`. The chain row's
own line on that run:

```
chain  green  371 lines across 183 sessions in refs/groundwork/journal: every
              chain holds, and 353 lines came before the chain and went unchained
```

The battery's own journal writes of that run are chained v2 lines. Session b3s2
holds seq 1 to 20, every one `"v":2`, seq 1 with an empty prev and every later
one carrying the hash of the line before it.

## What I read, and what it settled

- `docs/plan/rebuild/bet_3/b3s2.md` — the slice, its proof marker, its fixtures.
- `internal/journal/journal.go` — the write path. `write()` fills the envelope,
  `nextSeq` reads every blob of the session to find the highest seq. `prev` hooks
  in there.
- No reader in the journal package reads `v` at all. Every reader decodes only
  the fields it needs (`spend.go`, `verify.go`, `merge.go`, `battery.go`,
  `drive.go`, `flake.go`, `waiver.go`). So v1 and v2 lines are both already
  accepted by construction. What was missing was a test saying so — risk 1.
- `Spend` returns `hasRef bool` rather than erroring on a missing ref. That is the
  landed posture for "the ref is not there", so `CheckChain` copies it.
- This repo's own ref: 353 lines, 182 sessions, every seq contiguous, every line
  v1. So the chain row on this repo is green with the unchained prefix named.

## Red set (fails at 9d8963d)

New test files:

- `internal/journal/chain_test.go`
- `internal/battery/chainrow_test.go`

One-line pin edits:

- `internal/journal/battery_test.go:46,83` — `wantNumber(t, event, "v", 1)` -> 2
- `internal/journal/drive_test.go:22` — same
- `internal/journal/flake_test.go:34` — same
- `internal/journal/waiver_test.go:46` — same
- `internal/journal/journal_test.go:189,908,1149` — same
- `internal/journal/journal_test.go:233,921,1162` — the key lists gain `prev`
- `internal/battery/planrow_test.go` — the row-kind pin gains `chain` (pending)
- `cmd/groundwork/battery_test.go` — 8 rows -> 9 rows, both summary pins (pending)

Red observed, journal side, in two runs:

1. With `chain.go` and `chain_test.go` away and `journal.go` reverted, the pin
   edits fail as real failures: `field "v" is 1, want 2` in five test files, and
   `the event is missing field "prev"` on all three key lists.
   Log: `scratchpad/red-journal.txt` holds the first run.
2. With `chain_test.go` back and `chain.go` still away, the package does not
   build: `undefined: ChainResult`, `undefined: CheckChain`.

## What landed

Journal:

- `internal/journal/chain.go` (new) — `CheckChain`, `ChainResult`, `ChainBreak`,
  `walkSession`, `eachLine`, `sessionOfPath`.
- `internal/journal/journal.go` — `version` 1 -> 2; the envelope gains `Prev`
  after `Seq`; `nextSeq`/`highestSeq` become `sessionTip`/`highestLine`, which
  return the previous line's sha256 alongside the seq; `treeOIDs` is now a thin
  call on a new `treeEntries` that keeps the paths too.

Battery:

- `internal/battery/chainrow.go` (new) — the row, `countedBreaks`,
  `clipSession`.
- `internal/battery/rows.go` — registers it, and the package doc says nine rows.
- `internal/battery/battery.go` — the row-kind vocabulary gains `chain`.
- `.groundwork-battery.json` — 6.0+ra8c0ca9 -> 7.0+r5a8f33c. The digest came
  from the tool: `/tmp/gw verify version` printed the computed one in its drift
  error, and the same value went into the file.

## Blank-the-rule proofs

Each rule was blanked one at a time, the targeted tests were run, and the rule
was put back. Script and raw output: `scratchpad/blank.py`, `blank-out.txt`,
`blank-out2.txt`, `blank-out3.txt`.

| rule blanked | test that died |
| --- | --- |
| the writer computes prev | TestEveryLineCarriesTheHashOfTheOneBeforeIt, TestASessionCarriesItsV1PrefixIntoTheChain, TestCheckChainHoldsOnAnHonestSession |
| the envelope is at version 2 | TestEveryLineCarriesTheHashOfTheOneBeforeIt, TestWriteDispatchWritesEveryField |
| a gap in seq is a break | TestCheckChainFindsABreakAndLeavesTheV1PrefixAlone/a_deleted_line, TestOnlyTheSessionThatBrokeIsNamed, TestBreaksComeBackSortedBySessionAndSeq |
| a prev that does not match is a break | TestCheckChainFindsABreakAndLeavesTheV1PrefixAlone/a_forged_line |
| a v1 line after the chain began is a break | TestALineThatDropsOutOfTheChainIsABreak |
| a first line carrying a prev is a break | TestAFirstLineThatCarriesAPrevIsABreak |
| one seq held twice is a break | TestAMergeOfOneSessionFromTwoClonesIsABreak |
| a line that is not JSON is a break | TestALineThatIsNotJSONIsABreak |
| the v1 lines are counted | TestASessionCarriesItsV1PrefixIntoTheChain, TestCheckChainFindsABreak.../a_session_written_before_the_chain |
| the session comes off the line, not the path | TestALineIsGroupedByWhatItSaysNotWhereItSits |
| the row is registered | TestChainRowIsRegistered, TestDefaultHoldsExactlyTheShippedRows |
| the green line names the unchained prefix | TestTheChainRowsGreenLineSaysWhatItRead, TestChainRowIsGreenOnThisRepo, TestProof_b3s2.../the_lines_written_before_the_chain_are_never_blamed |
| a repo with no journal ref is green and plain | TestChainRowIsGreenAndPlainOnARepoWithNoJournal |
| a ref holding no event is unrunnable | TestChainRowIsUnrunnableOnARefThatHoldsNoEvent |
| the count of breaks goes first | TestTheChainRowsRedLineLeadsWithTheCount |
| one break reads as one | TestTheChainRowsRedLineCountsOneBreakAsOne |
| a session id is clipped | TestALongSessionIdIsClippedNotLeftToFillTheLine |
| the Go adapter names its stack | TestTheGoAdapterNamesItsStack |
| ChangedFiles reports what changed | TestChangedFilesNamesEachWayAFileDisagreesWithTheCommit |

Two of these needed a second pass, and both are worth the reviewer's eye:

- Blanking `prev` first failed to compile rather than failing a test. The
  blanking was moved one level down, into `sessionTip`'s return, so it compiles
  and three tests die.
- Blanking "group by the line's own session, not by its path" SURVIVED on the
  first pass: no test proved that rule. `TestALineIsGroupedByWhatItSaysNotWhereItSits`
  was added, and the rule now dies alone. The test asserts the honest verdict:
  moving a blob between session directories is green, because the line still
  says what it said and is still there. Grouping by the path would call that
  journal broken twice over.

## The mutate row, at the 7.0 bump

The bump rotated the sample and two mutants survived. Both were pre-existing
gaps in other packages, and both were fixed the F29/F34 way — a pinning test in
the survivor's own package, never a weakened scan.

- `internal/adapter/goadapter.go:35 (*Go).Name` -> `TestTheGoAdapterNamesItsStack`
  in `internal/adapter/adapter_test.go`.
- `internal/journal/git.go:168 ChangedFiles` -> `TestChangedFilesNamesEachWayAFileDisagreesWithTheCommit`
  in `internal/journal/git_test.go`, beside the two F29 tests already there.

Finding the second survivor took instrumenting `mutaterow.go`'s `result()` to
print the whole names list, because the row's evidence line is cut at 200 bytes
and said only "and 3 more". The instrumentation was reverted; `git diff` on
`internal/battery/mutaterow.go` is empty. Note for the driver: `runRow` builds a
`Context` with no `Digest`, so a row run that way hashes its sample against "7.0"
rather than "7.0+r5a8f33c" and picks a different ten. That cost one wasted run.

## Log

- Wrote `internal/journal/chain_test.go` (red), then the pin edits (red), then
  `internal/journal/chain.go` and the writer change. Journal package green.
- Wrote `internal/battery/chainrow_test.go` (red: "the default battery holds no
  chain row"), then `chainrow.go` and the registration. Battery green.
- Bumped the lock file to 7.0 with the recomputed digest, moved the cmd pins.
- `go test ./...` green everywhere. gofmt clean, go vet clean.
- First full verify: 8 green, mutate red with 2 survivors. Found both, fixed both
  with pinning tests, re-ran. Second full verify: 9 green.

## Candidate ledger entries

I did not touch `docs/findings.md` or `docs/decisions.md`. These are for the
driver to land.

### Decisions

1. **A v1 line at a seq above a chained line is a break.** The unchained prefix
   is a prefix. Once a session's chain begins, a line that drops out of it is the
   cheapest forgery there is: nothing has to hash. R7 says a v1 line is never
   called forged, and that holds for the prefix; it does not license a downgrade
   afterwards.
2. **A journal line that is not JSON is a break, not an error.** An error would
   leave the row unrunnable, and unrunnable never fails a run. That is F43's
   shape exactly: one corrupted line would silence the whole check.
3. **A repo with no journal ref is green; a ref that exists and holds no event is
   unrunnable.** The plan row set the precedent for both halves: no subject at
   all is green because nothing can be misstated, and a subject that is there and
   empty is D17's "a verifier may never pass on nothing".
4. **Every error out of `CheckChain` makes the row unrunnable, including
   `ErrNotARepo`.** The row could not reach the thing it checks. This diverges
   from the plan row, which turns red when `RepoRoot` fails — named here so the
   driver can rule the other way if it prefers one posture across rows.
5. **`prev` is written even when empty, so every v2 line carries the field.** The
   key's presence then means "this line is chained", and the field-order pins stay
   the same on every line. An `omitempty` prev would make a chained first line
   indistinguishable from a v1 line by shape.
6. **A line is grouped by the session it names, not the directory it sits in.**
   Moving a blob between session directories changes nothing about what the line
   says, and the record is still whole. Grouping by the path would call an intact
   journal broken twice over.
7. **Past a gap or a repeated seq, the walk names that seq and stops checking that
   session's prevs.** Which line should have followed which is exactly what is
   missing. Reporting every link after it as broken would bury the one fact the
   reader acts on.
8. **When two lines share the highest seq, the writer points the next line at the
   lower hash.** Deterministic, so both clones land in the same place. The chain
   row names the doubled seq either way.
9. **The chain row is registered last, so inside a battery run it reads the lines
   the earlier rows just wrote.** That is why the hostile-repo summary pin moved
   from one green to two.

### Findings

1. `runRow` (internal/battery/scan_test.go) builds a `Context` with no `Digest`.
   The mutate row hashes its sample against the battery version, both halves, so
   a row run through `runRow` picks a different ten mutants than a real verify
   run does. Caught by: this slice, at the cost of one 5-minute run against the
   wrong sample. Not fixed here — it is the mutate row's own test seam and a fix
   belongs in its own change.
2. `(*Go).Name` had no test in `internal/adapter`. Caught by: the deletion test,
   when the 7.0 bump rotated the sample. Fixed here with
   `TestTheGoAdapterNamesItsStack`.
3. `ChangedFiles` had no test in `internal/journal`, beside the two functions
   F29 already caught the same way. Caught by: the deletion test at 7.0. Fixed
   here with `TestChangedFilesNamesEachWayAFileDisagreesWithTheCommit`.

## Left open

- The chain row reads every event blob in the ref on every verify run: 371 today,
  in one `git cat-file --batch`. It grows with the ref. The same note already
  stands over `highestLine` and `rungOf` — a journal large enough to feel this
  wants an index.
- R7's own limit stands: the chain cannot stop an agent with write access from
  rewriting the chain forward. Only R4's signature, with the key outside, can.
  That is slice 3's ground.
- `TestSummaryCountsAndPluralisesRows` still builds an 8-row result by hand. It
  is a renderer test, not a pin on the shipped battery, so it was left alone.
- The proof marker `TestProof_b3s2_chain_a_break_is_named_and_never_blamed` lives
  once, in `internal/battery/chainrow_test.go`, at the level a person reads. The
  journal-level version of the same three shapes is
  `TestCheckChainFindsABreakAndLeavesTheV1PrefixAlone`.

---

# Fix round — after the blind review bounced slice 2

Driver's dispatch: F48–F52, D49's four rulings (committed at a1ba6b5). Eight
items, in the review's suggested order. Working tree only, still no commits.

## Fix-round status

All eight items done. `go test ./...` green, gofmt clean, go vet clean, every new
rule blanked and proven. Final verify below.

The digest does not move: no row's id, kind or severity changed, so
`.groundwork-battery.json` stays at 7.0+r5a8f33c.

## What each item did

**1. HIGH-2 / F49 — printable before the clip.** `clipSession` is now
`cutTo(printable(session), most)`. Test:
`TestNothingTheChainRowSaysCarriesAControlCharacter`, built on the reviewer's own
planted name `"a\nseal\tgreen\tthe seal holds"`, in the shape of
`TestNothingARunSaysAboutAWaiverCarriesAControlCharacter`. It asserts three
things: no unprintable rune survives, no newline or tab survives, and the session
is still named — a row that dropped the name would tell the reader nothing.

On D49.2's "every value": the red branch is the only one that carries a value
off a journal line, and clipSession is its one gate. The green and no-event lines
carry counts and the ref's own name. The unrunnable branch carries git's words
about a ref it could not walk, which is not a value from a journal line — so it
keeps `cut`. I tried `say` (cut+printable) there first and took it back out,
because no test can reach a control character in git's own error text, and an
unprovable rule is what F50 is about.

**2. HIGH-1 / F48 / D49.1 — one session per process.** `sessionID` now takes its
generated id from `sync.OnceValues(newSessionID)`. `newSessionID` is split out so
a test can ask it twice: that is what says a second process gets a different id,
without a test having to start one.

- `TestWritesShareOneGeneratedSessionForTheWholeProcess` (journal) — two writes
  with the variable silent land in one session, at seq 1 and 2, the second
  carrying the first's hash. This **replaces**
  `TestWriteDispatchGeneratesADifferentSessionEachTime`, which asserted the
  behaviour D49.1 rules against. Flagged for the reviewer: it is the one existing
  test this round inverts, and the inversion is the ruling, not a weakening.
- `TestAGeneratedSessionIsFreshEveryTimeItIsMade` (journal) — the generator never
  repeats, so two runs never share an id and the merge's independence stands.
- `TestADeletionIsFoundWithNoSessionInTheEnvironment` (battery) — the reviewer's
  probe J, through the real row: five writes with the variable unset are one
  session of five lines and green; delete one blob and the row is red on seq 3.

Every existing test that assumed per-write ids: only the one above. Nothing else
in the tree reads a `gen-` id. `go test ./...` is green, and the cmd row-count and
summary pins did not move — each test uses its own temp repo, so sharing one
process-wide id changes nothing across them.

**3. MED-3 / F50 — the doubled-seq tie-break.**
`TestADoubledSeqPointsTheNextLineAtTheLowerHash`, adapted from probe K.

**4. MED-4 / F50 — the error branch.** A ref pointed at a **blob** is the way in:
`rev-parse` resolves it and `ls-tree` will not walk it, so `CheckChain` returns
git's error. `TestCheckChainFailsOnARefThatIsNotACommit` (journal) and
`TestChainRowIsUnrunnableWhenTheRefCannotBeRead` (battery, D48.4's divergence).

**5. MED-7 / F50 — the arithmetic bound.**
`countedBreaks` now takes the count rather than reading it off a slice, so a test
can hand it the widest count an int prints.
`TestTheChainRowsRedLineFitsTheJournalCapOnTheWidestBreak` builds the widest line
out of four caps: a 20-byte count, a 20-byte seq, the 40-byte session clip and
`journal.MaxWhyBytes`. The old assertion measured a line the row had already cut
and could never fire; this one fires when any of the four grows, and both
widening mutations kill it. `TestTheChainRowsGreenLineFitsTheJournalCapOnTheWidestCounts`
does the same sum for the green head. `cut()` came off both lines: with the bound
proven it was dead code that m17 could remove unnoticed.

`journal.MaxWhyBytes` (76) is new, and `breakAt` holds every reason to it — the
cap is true by construction, not by hope, so the arithmetic above stands whatever
a later reason says.

**6. MED-5 / F51 / D49.3 — the path check.** The walk compares each line's
computed sha256 to the hash its path is named for, and a mismatch is a break
naming the session and the seq. Probe B goes red:
`TestALineRewrittenInPlaceIsABreak`. What stays open is written into the row's
own comment in D49.3's terms — a tip rewritten and refiled, and a whole session
invented in the v1 shape.

**7. MED-6 / F51 / D49.3 — wholly unchained sessions.**
`ChainResult.UnchainedSessions` counts sessions holding nothing but v1 lines.
`unchainedClause` carries both numbers — "353 lines came before the chain and
went unchained, in 180 sessions with nothing chained" — and both the green and
the red line carry it, through `addIfItFits`. The break count still leads the red
line; the clause is the part that gives way when there is no room, which is D33's
order applied to a line with two counts on it.

**8. LOWs / F52 / D49.4 — the message smalls.**
- A not-JSON break names the byte reading stopped at, and carries no seq. The row
  prints no "at seq" for a break whose seq is below 1.
- A seq below 1 is its own break, checked before the run of seqs. That is what
  makes the gap message provably honest: every line before the one that breaks
  the run carries exactly its own place, so a line that is neither a repeat nor
  its own place sits above a seq nothing holds. The comment in `walkSession` says
  that argument.
- A line naming no session is a break, not a group under `""`. It is placed by
  where it sits, or as "an unnamed session" when even the path says nothing.

## Fix-round blank-the-rule proofs

Seventeen rules, each blanked alone, targeted tests run, rule restored. Script
`scratchpad/blank2.py`; output `blank2-out.txt` and `blank2-out2.txt`.

| rule blanked | test that died |
| --- | --- |
| a session id goes through printable | TestNothingTheChainRowSaysCarriesAControlCharacter |
| one generated session for the whole process | TestWritesShareOneGeneratedSessionForTheWholeProcess |
| a generated session is fresh each time | TestAGeneratedSessionIsFreshEveryTimeItIsMade |
| a doubled seq points at the lower hash | TestADoubledSeqPointsTheNextLineAtTheLowerHash |
| a ref that cannot be read is unrunnable | TestChainRowIsUnrunnableWhenTheRefCannotBeRead |
| a line must hash to the path it sits at | TestALineRewrittenInPlaceIsABreak |
| a line with no session is a break | TestALineWithNoSessionIsABreak |
| a seq below one is its own break | TestASeqBelowOneIsItsOwnBreakAndNeverBlamesThePresentSeq |
| a line nobody can read names the byte | TestALineThatIsNotJSONIsABreak |
| a reason is held to the cap | TestNoBreakReasonIsWiderThanTheCap |
| the wholly unchained sessions are counted | TestAWhollyUnchainedSessionIsCounted |
| both lines carry the unchained clause | TestBothLinesCountTheWhollyUnchainedSessions |
| the clause gives way and the count does not | TestTheUnchainedClauseGivesWayAndTheCountNeverDoes |
| no seq is printed for a break that has none | TestTheRowNamesNoSeqForALineItCannotRead |
| a break with no session is still placed | TestTheRowPlacesABreakOnALineWithNoSession |
| the red line's width is bounded by the clip (most 40 -> 400) | TestTheChainRowsRedLineFitsTheJournalCapOnTheWidestBreak |
| the red line's width is bounded by the reason cap (76 -> 176) | TestTheChainRowsRedLineFitsTheJournalCapOnTheWidestBreak |

Three of these first came back "SURVIVED (build failed)" — the blanking did not
compile, so it proved nothing. Each was rewritten to compile (blank the call, not
the declaration; keep the unused import used) and re-run. A build failure is not
a survivor and it is not a kill, and the first table said so rather than hiding it.

## Fix-round red/green split

New test-only files: none. Every new test joins an existing file.

New tests that fail at 9d8963d (they name code that does not exist there), so
they join the red set: the fourteen named in the table above, plus
`TestCheckChainFailsOnARefThatIsNotACommit`,
`TestADeletionIsFoundWithNoSessionInTheEnvironment`,
`TestTheChainRowsGreenLineFitsTheJournalCapOnTheWidestCounts`,
`TestALineIsGroupedByWhatItSaysNotWhereItSits` (from the first round).

One existing test inverted, and it is green either side of the change — the
sessionID change is source, not a pin:
`TestWriteDispatchGeneratesADifferentSessionEachTime` became
`TestWritesShareOneGeneratedSessionForTheWholeProcess`.

## Fix-round log

- Item 1: clipSession through printable, control-character test. Green.
- Item 2: sync.OnceValues on the generated id, three tests, one inverted. Green.
- Item 3: probe K adapted. Green.
- Item 4: the blob-ref way into the error branch, two tests. Green.
- Items 5-8 together, since they all touch the walk and both evidence lines:
  chain.go rewritten around breakAt/MaxWhyBytes, the path check, the no-session
  break, the seq-below-one break; chainrow.go rewritten around countedBreaks,
  brokenAt, unchainedClause and addIfItFits.
- Seventeen blank-the-rule proofs, three re-run after they failed to compile.

## Fix-round verify

`scratchpad/verify-b3s2-fix.txt`, one run, `GROUNDWORK_SESSION=b3s2`:

```
mutate  green  ... killed 8 (2 by crash), 2 did not compile
plan    green  docs/plan holds 1 program, 1 bet and 8 slices ...
chain   green  381 lines across 183 sessions in refs/groundwork/journal: every
               chain holds, and 353 lines came before the chain and went
               unchained, in 182 sessions with nothing chained
9 rows: green 9, red 0, waived 0, quarantined 0, unrunnable 0
```

At 7.0+r5a8f33c — the digest did not move, because no row's id, kind or severity
changed. The mutate row stayed green: same sample, and both survivors from the
last round are still pinned.

The chain line is 169 bytes, inside the journal's 200, and it now ends with the
number D49.3 asks a reader to watch: 182 of 183 sessions hold nothing but
unchained lines. That is this repo's own history — every session before this
slice. One session is chained, and it is this run's.

The run's own writes are chained: session b3s2 now runs seq 1 to 30, every line
v2, each carrying the hash of the one before it.

## Fix-round candidate ledger entries

Still no ledger edits from me. For the driver:

### Decisions

1. **The unrunnable branch keeps `cut`, not `printable`.** D49.2 is about values
   a line takes off a journal line. Git's words about a ref it could not walk are
   not one, and no test can reach a control character in them — an unprovable
   rule is the thing F50 names. The red branch is the only one carrying a forged
   value, and `clipSession` is its gate.
2. **`cut()` came off the green and red lines.** Both are now bounded by
   arithmetic, so the cut was dead code that a mutation could remove unnoticed —
   which is exactly what the reviewer's m17 did. The bound is the guarantee.
3. **`journal.MaxWhyBytes` is enforced in `breakAt`, not asserted about the
   literals.** A cap held by construction stays true when someone writes a longer
   reason; a cap held by a list of strings drifts from the code.
4. **A ref pointing at a blob is how the error branch is reached.** It is the
   plainest shape git allows: `update-ref` takes it, `rev-parse` resolves it, and
   `ls-tree` refuses to walk it. No file permissions, no corrupt objects, nothing
   that behaves differently as root.
5. **A line rewritten in place produces two breaks, not one** — the path no
   longer fits its content, and the next line's prev no longer fits either. The
   count leads the line, so a reader sees two and acts on the first.

### Findings

1. Three of the seventeen blanking patches did not compile on the first pass and
   came back as "SURVIVED (build failed)". A build failure is neither a kill nor
   a survivor, and reading one as a survivor would send the next round chasing a
   rule that is in fact proven. Caught by: this round's own table, which prints
   the build failure rather than folding it into "SURVIVED". Not fixed in code —
   it is a note about how to read a blanking table.
