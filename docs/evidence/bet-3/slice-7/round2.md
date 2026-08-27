# Handoff — bet-3 slice 7, fix round

Builder session, round 2. Working tree only; the driver lands. Base HEAD `790186a` (D64 recorded).
Round-1 handoff: `handoff-b3s7.md`.

## What each ruling turned into

**F104 / D64.9 — signing off in every fixture.** `commit.gpgsign=false` in nine repo makers, across
`cmd/groundwork`, `internal/battery`, `internal/board`, `internal/journal`, `internal/manifest`,
`internal/seal` and `internal/trace`. `internal/battery` fell from **141.9 s to 76.8 s**, and the
board's false red has not come back in any run since.

**F105 / D64.1 — a close asks what the rows came back as.** `MissingAtClose` is gone;
`battery.UnmetAtClose(RunResult)` names every scope row that did not come back green or waived, and
the verb refuses on it after the table. The fixture is a plan directory holding no plan file: an
ordinary verify exits 0 there, and the close fails naming board, trace and record. Waived counts,
because D24 already rules what a waiver is worth; nothing else does. A close also records its scope
on the run's own journal line — a close is a property of a run, not a second event beside it, so
`journal.Battery` gained an optional `scope` field rather than the kind vocabulary gaining a word.

**F106 / D64.2 — the unseen state, and the narrow guard.** A slice this row found no claim for reads
`waiting` on a whole clone and `unseen` on a shallow one. It is one count with two words, because in
a shallow clone nothing in git tells "never landed" from "landed past the edge" — so the word says
the weaker thing. Seven counts do not fit the journal's 200 bytes; six do. The page says which is
which. The depth-three fixture pins the guard narrow: the record's commit sits one inside the graft,
so it is datable and stale, and a guard widened to every commit turns that green.

**F107 / D64.3 — the oldest claim, through the board's machinery.** `board.Landings(set, history)` is
exported and returns the commit that landed each slice, oldest claim first, merges unread, four
validity shapes applied. `Derive` calls it, so there is one reading. `board.JudgeValue` exports the
four shapes with a `Shape` result, so each caller writes its own sentence and none writes its own
rule. The old newest-claim test inverted into
`TestRecordRowDatesARecordAgainstTheOldestClaim`.

**F108 / D64.4 — the phrase.** A threshold clears only on a title carrying `<id> row`. The probe
picks its own row: it walks the shipped rows against this repo's real ledger and takes the first
whose id appears bare in a title and never as a row. Today that is `version`; when the ledger grows
a `version row` entry the probe moves on by itself rather than rotting.

**F109 / D64.5 — attribution held to something.** Bet trailers go through `board.JudgeValue` against
the bets the plan declares. Anything that fails pools into one unattributed bucket, and that bucket
shares the per-bet limit. A repo with no plan declares no bets, so everything pools there — the same
rule, not an exception. The counter fixtures now declare their bets, which is what makes the tests
mean anything.

Renames are followed by naming every path the file has had, not by `git log --follow` on the read
itself. Two reasons, both measured: `--follow` drops merges, and the merge-not-read rule needs them;
and `--follow` folds in a *copy* — it linked two waivers that merely looked alike. `journal.PathsOf`
follows R records only, and `TestWaiverCountRowDoesNotFoldTwoLookalikeWaivers` pins the difference.

**F110 / D64.6 — one version per run.** `mutateVersion` reads `ReadLockAtHead`. The only working-tree
lock reads left are the two that exist to compare the tree against HEAD. Pinned twice: the seed is
the committed version, and the seed equals the run's own label.

**F111 / D64.7+8 — the cluster, the limit, the order.** A quoted `Slice` line counts only inside two
or more adjacent trailer-shaped lines. A lone quoted line in prose — this repo's own ledger commits —
is green; a quoted trailer block is red. The flavour that discards its trailers is invisible and the
page says so as the limit it is. Counter hits are ordered reds, then cleared, then unreadable files.

**F112 and the lows.** The shallow posture is written once, on `checkWaiverCount`, and referenced
from the other two rows and once on the page. `BlobAt`'s comment now describes what the code does.
Doubled record paths are refused at load, beside every other doubled declaration. `journal.Messages`
caps a message at 64 KiB and says `Cut`, which the history row counts. `Lstat` is pinned by a
symlink fixture. `atTheEdge` is one function both readers call, with a table pin and a two-row pin on
one clone. The proud waives-nothing sentence is gone.

The `uncommitted` count is **renamed to `never committed`** rather than redefined. That is my call:
"uncommitted" reads as "has uncommitted edits", which is a different question this row does not ask,
and a word that has to be defined away is a word to change. The row's comment and the page both say
that a record edited since it landed is neither counted there nor red.

## Register

New files' comment prose: **15.3 mean words per sentence** against D63's baseline near 15, down from
19.2. Section 5 of the contract page runs **16.5**, down from 19.4; what is left is mostly rule text
that does not shorten without losing a clause.

## Proofs

**Blanking: 31 rules, 31 killed, 0 survivors.** Every baseline green, no build breaks. Two rounds:
the first found one survivor and one build break, both fixed and re-run. The survivor was my own
plan test — it replaced `faked: []` and so wrote a second `records:` key, which the parser refuses as
a doubled *key*. It passed on the wrong rule. It now doubles the path inside the one list and asks
for the row's own sentence.

F104's rule is pinned by shape rather than by a mutation: blanking it fails no assertion, it makes
the suite slow and flaky, which is what F100 was. `TestEveryFixtureRepoMakerTurnsSigningOff` walks
this repo's own test sources and names any file that inits a repo without turning signing off.

**`gofmt -l` clean, `go vet ./...` clean. `go test -p 1 -count=1 ./...` green alone**, 2m38s in all,
down from 4m33s. `internal/battery` **81.2 s**, down from 141.9 s. `cmd/groundwork` 18.5 s, down
from 30.4 s.

**One full verify, alone, on a committed copy — green on the first attempt:**

```
battery 12.0+ra48a79a
16 rows: green 15, red 0, waived 0, quarantined 0, unrunnable 1
```

7m51 wall clock, down from 13m44. The board row is green first time, with `0 behind`: F104's channel
is closed, and the false red has not come back. The one unrunnable row is the waiver counter on this
clone's shallowness, which is R14's own rule, and verify exits 0.

The three rows on this repo:

```
record        green       4 records read (shallow): 0 missing, 0 never committed, 0 stale,
                          0 unjudged, 3 unseen: every record read is in the tree and no older
                          than the work it describes
waiver-count  unrunnable  this clone is shallow, so the grant history behind .groundwork/waivers
                          is not all here: grants nobody can see would count as zero and pass a
                          threshold. Fetch the full history to run this row
history       green       273 commits read (shallow), 25 merges not read: 0 squashed, 0 cut:
                          every commit read keeps the Slice trailers its own message quotes
```

`3 unseen`, not `3 waiting` — b3s1, b3s3 and b3s8 declare records and their landings sit past this
clone's edge, which is F106's whole point.

The run wrote 17 chained journal lines: 16 `battery-row` and one `battery`, seq 1 to 17, every prev
present. The battery line carries no `scope`, because this was an ordinary verify — which is the
other half of what the close's journal trace has to prove.

**The version row stays red on the uncommitted tree.** The working tree carries 12.0 and HEAD carries
11.0. That is R15's honest state for an unlanded bump, and the driver's landing commit resolves it.
The digest is unchanged at `ra48a79a`: the fix round moved no row's id, kind or severity, so R16 asks
for no second bump.

## Status

- [x] gofmt, vet.
- [x] Blanking sweep with clean-tree baselines: 31 rules, 31 killed, 0 survivors.
- [x] `go test -p 1 ./...` green alone.
- [x] One full verify alone, green tail on the first attempt.
- [x] Nothing committed. No ledger edits.
