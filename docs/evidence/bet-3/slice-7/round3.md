# Handoff — bet-3 slice 7, micro-round

Builder session, round 3. Working tree only; the driver lands. Base HEAD `d68025a` (D65 recorded).
Earlier rounds: `handoff-b3s7.md`, `handoff-b3s7-round2.md`.

This session was killed at 08:36 UTC with exit 137 while launching the final gate script — the suite
and a verify would have shared the machine. Every edit below was already in the tree. The gate was
re-run strictly serially: gofmt and vet, then the suite alone to completion, then the verify alone.

## Per item

**F113 / D65.1 — the incarnation boundary.** `journal.PathsOf` became `journal.FileHistory`, which
returns the names a file has had *and* what each commit did to it. The counter walks a waiver's
commits newest first and stops at the one that made the file. A copy counts as a birth too: git
reports a file made out of another as `C`, not `A`, and a boundary that only knew adds would reach
past a deletion into a dead file's history.

Probes: a new wiring waiver at a dead honesty waiver's path keeps 1 grant and does not inherit the
dead file's four; and a waiver made as a copy at a dead one's path starts at its own commit.

**F113 / D65.2 — a pure rename decides nothing.** A commit whose status for the file is git's `R100`
is counted, named on the line, and never read as a grant. Two honest grants plus a tidy-up move stay
at 2 and the move is named. The page cell now drives its own words: its fixture is two grants plus
the move, so reading the move as a grant would trip the limit — which is the whole difference.

Only an exact move decides nothing, and the predicate is driven directly. A waiver file is a hundred
or so bytes, so an edit big enough to matter is a large fraction of it and git calls the result a new
file rather than a scored rename. That is F116's recorded cost, and it has its own test.

**F114 / D65.3 — one repo, one line.** The buckets are read in sorted order, and a tie breaks toward
the named bet. Two probes: three grants in a bet against three unattributed, and three in each of two
named bets. Both run the row twelve times and hold every line identical.

The record row now leads with its reds too. A stale record is somebody's next move; one this clone
could not date is not, so it follows.

**F115 / D65.4 — the cluster keys.** `trailerShaped` asks whether the key is one this repo writes as
a trailer, not whether the line has a word before a colon. The set lives in `internal/board` beside
`TrailerKey`, as `TrailerKeys()`, and a structure pin holds it to the pages: the working agreement's
own commit-message block, plus the contract page's spelling of this package's key.

The reviewer's two probes behave as the driver expected. `Notes:` over a sentence starting `Slice:`
is green — a prose label is not a trailer key. Two real trailer keys quoted together stay red.

**I confirm the second expectation rather than arguing it.** `Bet:` and `Slice:` on adjacent lines
are exactly what a squash quotes, and the board cannot read either of them, so the commit's own
slices are unlanded as far as anything here can tell. The red is about what is readable, not about
what the author meant. A rule that let a real trailer block off because the prose above it looked
honest would be reading intent, which no other row here does.

**F115 smalls.**

- (a) The `--close` usage text says what the check is: every row runs, and the close is refused unless
  seal-verify, board, trace and record came back green or waived.
- (b) The signing pin counts. `signingOff` compares repo makers against config calls per file, so a
  second maker in a blessed file and a different init spelling both fail it. The rule is driven on
  sources written for it, because the tree has no bad maker — that is the point.
- (c) The page's sentence now says a slice with no claim is not judged *and its records are not read
  at all*, which is what the code does.
- (d) Each head-byte constant is held under `journal.MaxTextBytes` as well as over the searched
  widest line. A constant that only certified itself would pass a comment claiming 500 bytes.
- (e) The close's journal line carries `close_met` beside `scope`. Both are pinned: a close records
  them, an ordinary run records neither, and a refused close records the close as unmet.
- (f) `TrailersFor` refuses a path list that is all empty. Narrowing to nothing and reading everything
  are opposite answers, and the caller asked for the first.

## Blanking

**18 rules, 18 killed, 0 survivors**, every baseline green on the clean tree, no build breaks. Three
passes: the first left five survivors and one build break, the second two survivors, the third clean.

What the survivors taught, all folded in:

- The copy-as-birth branch and the exact-rename rule were unreachable through repo fixtures, so both
  are driven on the predicates directly, beside end-to-end tests for the shapes a repo really meets.
- The sorted bucket read was not load-bearing on a two-bucket tie, because the tie-break settles that
  case whatever the order. It takes three buckets — two named — to need the sort, and that fixture
  now exists.
- The signing pin's own rule sat inline in the walk, where no test could reach it. It is a function
  now, and the walk and the test call the same one.
- One mutation broke the build rather than an assertion, which proves nothing; it was re-run in a
  form that compiles.

## The gate, run serially

`gofmt -l` clean. `go vet ./...` clean.

`go test -p 1 -count=1 ./...` green alone, **3m38s**, `internal/battery` **121.3 s**. That is up from
81 s in the fix round: the micro-round added the twelve-run ordering probes and eight other tests,
and this machine is slower under the memory pressure that killed the last session. It is inside the
180 s clock.

One verify, alone, on a committed copy — green on the first attempt:

```
battery 12.0+ra48a79a
16 rows: green 15, red 0, waived 0, quarantined 0, unrunnable 1
```

8m49 wall clock, exit 0. The three rows:

```
record        green   4 records read (shallow): 0 missing, 0 never committed, 0 stale, 0 unjudged,
                      3 unseen: every record read is in the tree and no older than the work it
                      describes
waiver-count  unrunnable  this clone is shallow, so the grant history behind .groundwork/waivers is
                      not all here: grants nobody can see would count as zero and pass a threshold.
                      Fetch the full history to run this row
history       green   274 commits read (shallow), 25 merges not read: 0 squashed, 0 cut: every
                      commit read keeps the Slice trailers its own message quotes
```

The run wrote 17 chained journal lines under `b3s7micro`: 16 `battery-row` and one `battery`, seq 1
to 17, every prev present. That line carries no `scope` and no `close_met`, because it was not a
close — which is the other half of what the close's journal trace has to prove.

**The version row stays red on the uncommitted tree.** HEAD declares `11.0+rffb3f30`, the working
tree `12.0+ra48a79a`. R15's honest state for an unlanded bump, resolved by the landing commit. The
digest is unchanged at `ra48a79a`: no row's id, kind or severity moved in either fix round, so R16
asks for no second bump.

## Status

- [x] gofmt, vet.
- [x] Blanking: 18 rules, 18 killed, 0 survivors, baselines green.
- [x] `go test -p 1 ./...` green alone.
- [x] One verify alone, honest tail on the first attempt.
- [x] Nothing committed. No ledger edits.

Evidence: `suite-final.log`, `verify-micro.txt`, `sweep6.json` and `sweep6.log`, harness `sweep4.py`.
