# Blind review of slice 7

The first review. Verdict: lands after fixes — three highs led by the hollow close, and the round that solved F100: the host's signing shim was failing fixtures under load. It caught the driver's ledger twice. Its findings are F104 through F112.


Review complete. The real repo is untouched: `git status` matches the start (26 entries), the journal ref is still `fcd482a`, no stashes, 9 tags, nothing committed by me. HEAD moved from `fd8f6f2` to `815f1f5` while I worked — that is the driver's own F103/D63 commit at 05:10, not this session. Everything below ran on copies under my scratchpad.

---

# Blind review — bet 3, slice 7

**VERDICT: lands after fixes.** Three HIGH must be fixed. The three rows' core logic is sound — 22 of 26 planted mutations died against a clean baseline — but the `--close` flag does not do the one job it was added for, the record row's shallow posture is the opposite of what the page claims, and the staleness rule can be switched off on every clone this project has without a test noticing.

---

## HIGH

### H1 — `verify --close` reports a close as done when the close-scope rows never ran

`cmd/groundwork/verify.go:63`, `internal/battery/scope.go`.

`refuseClose` asks `reg.holds(id)` — whether the row is **registered**. Nothing asks whether it **ran**.

Reproduced. A repo where `board`, `trace` and `record` are all unrunnable, everything else green:

```
close scope, beside the full suite: seal-verify, board, trace, record
board         unrunnable  docs/plan is there and holds no plan file...
trace         unrunnable  docs/plan is there and holds no plan file...
record        unrunnable  docs/plan is there and holds no plan file...
16 rows: green 11, red 0, waived 0, quarantined 0, unrunnable 5
exit=0
```

Three of the four rows a close is for did not run, and the tool printed the scope heading and exited 0. `RunResult.Failed()` (`internal/battery/battery.go:294`) counts only reds and unreadable waivers, so unrunnable never fails a close. scope.go's own words: "a close that skipped what a close checks is the ceremony step going missing all over again." That is what this does.

Two more halves make it worse:

- The refusal **can never fire on the shipped tool**. `TestTheShippedBatteryHoldsEveryCloseScopeRow` proves the battery always holds all four, and the builder's comment says so. So "the whole of what the flag adds today" is a check that is unreachable in production.
- The refusal is **not wired**. Mutation `m22`: delete the `refuseClose` call from `runVerify` entirely — the whole `cmd/groundwork` package still passes. `close_test.go:79` calls `refuseClose` as a function, never through `--close`. That is D53 ruling 1's front-door-hollow class exactly.

Fix: fail the close when a scope row came back anything but green or waived, and drive the refusal through `call(t, "verify", "--close")`.

### H2 — On a shallow clone the record row's miss is a silent pass, not "unjudged"

`internal/battery/recordrow.go:161-179`.

A slice whose landing commit is out of the shallow clone reads as **unlanded**, so its records are never judged, and it is counted as `waiting` — which the page defines as "Not owed yet".

Reproduced, same repo, same tree contents, one declared record that does not exist:

```
full clone   : red   1 record read: 1 missing, 0 uncommitted, 0 stale, 0 unjudged, 0 waiting
depth-1 clone: green 0 records read (shallow): 0 missing, 0 uncommitted, 0 stale, 0 unjudged, 1 waiting
```

Nothing is missing, nothing is unjudged, and the row is green. The line is byte-identical to a genuinely unlanded slice's line but for the `(shallow)` marker.

This is live on this repo now. Only `b3s4`, `b3s5`, `b3s6` carry a readable `Slice` trailer in this clone; `b3s1` and `b3s3` landed long ago but their commits are past the edge. I changed b3s1's `records` to a path that does not exist and the row stayed green with "0 missing".

Contract page 5.5 says the opposite, in the sentence that carries D62.5's whole reasoning:

> "The `record` and `history` rows **name the short history and keep judging** ... what they cannot see leaves things unjudged rather than misjudged, and the count of what went unjudged is in the head."

And "One case had to be closed for that to be true of the `record` row" — there are two, and the second is not closed and not counted. On the landed tree the honest tail's "3 waiting" is two blind spots and one real one.

Fix: count a slice whose landing this clone cannot see apart from a slice that has not landed, in the head, and say so on the page.

### H3 — The shallow-edge exemption can be widened to turn the staleness rule off, and no test notices

`internal/battery/recordrow.go:224`. Mutation `m06`: `if len(parents) == 0` → `if len(parents) >= 0`. **Survived the whole suite.**

Under that mutant every record in a shallow clone is unjudged — and every clone on this host is shallow. On this repo the mutant prints:

```
shipped: 3 records read (shallow): 0 missing, 0 uncommitted, 0 stale, 0 unjudged, 4 waiting
mutant : 3 records read (shallow): 0 missing, 0 uncommitted, 0 stale, 3 unjudged, 4 waiting
```

Both green, and `TestRecordRowIsGreenAndHonestOnThisRepo` only asserts "0 missing" and "0 stale", both still zero. `TestRecordRowLeavesARecordItCannotDateUnjudged` proves the guard fires; nothing proves it stays narrow.

The missing fixture is one commit deeper. Plan at c1, filler at c2, record at c3, land at c4, clone `--depth 3`: the record's commit has a parent in reach, so the guard must not fire. Shipped code reds it correctly ("1 stale"); the mutant calls it unjudged and goes green. That fixture is the test.

This is F102's own class — the fix is there, nothing defends it — and it contradicts the "41 rules, 41 killed" claim.

---

## MED

**M1 — Two rows, one fact, opposite answers, and D62.1 cites the ruling that was reversed.**
`recordrow.go:151-159` walks `history.Claims` forward (git's newest-first) and credits the **newest** claim as the slice's landing. `internal/board/board.go:222` walks `slices.Backward` and credits the **oldest**, with this comment: *"Oldest first, because history lands a thing once and what comes after is commentary (D57 ruling 4) ... crediting the newest claim would name the real landing commit as the stray and send whoever chased it to the wrong commit."* D62.1 cites "D56.4's precedent"; D57.4 is the ruling that settled this and it says oldest. Reproduced: two commits claim `demo_s1`; the record row's line says "before the slice's own 1a61fac", the newer one, which the board calls a stray. `TestRecordRowDatesARecordAgainstTheNewestClaim` pins the wrong reading. The record row also skips the four validity checks the board applies to the same trailer (alone, non-empty, id charset, declared slice).

**M2 — The finding-clears gate is already open for 9 of 16 rows in this repo, by ordinary prose.**
Run through the real `findings.Names` over the real parsed titles of `docs/findings.md`: `version, honesty, wiring, plan, chain, board, stub, trace, record` all match. `record` matches 8 titles, and the first is *"The spend query pinned a false statement about the record"* — not about the row. Reproduced: three grants of `record` in one bet, against this repo's real ledger copied into a fixture → **green**, "1 named". Whole-word matching only stops `honesty` inside `dishonesty-check`; it does nothing about row ids that are ordinary English words, which most of them are. The threshold cannot bite for those rows in this repo, ever.

**M3 — `git mv` on a waiver resets its grant count while the waiver stays in force.**
`TrailersFor` uses `git log -- <path>` with no `--follow`. Reproduced: a waiver with 3 grants in one bet (red) → one `git mv` in a commit of its own → `1 waiver file, 0 unread: 1 grant ... 0 rows at a threshold`, green. D62.9 and page 5.2 name **deletion** as the limit; a rename is not deletion, the waiver is still there and still working, and its history is gone. One `--follow` closes the simple case.

**M4 — The bet a grant is attributed to is checked against nothing.**
Reproduced twice. (a) Four grants of one row, each commit naming an invented bet (`bet_3a`…`bet_3d`) → green. (b) Three grants that all really landed in `bet_x`, each commit carrying two `Bet:` trailers with a different first value → `3 grants, 0 rows at a threshold`, green. D56.4 reds four shapes on the board — a doubled trailer, an empty value, a bad charset, a value naming nothing declared — because they are "misstatements in the one input landed-ness is read from". This is the one input the threshold turns on, and none of the four is checked. The plan reader knows the real bet ids.

**M5 — The mutate row still seeds from the working-tree lock; one run prints two battery versions.**
`internal/battery/mutaterow.go:509` is the last `ReadLock` outside the version row. Reproduced in one run: HEAD carries 0.1, the working tree carries 7.7 —

```
battery 0.1+ra48a79a
version  red     the working tree's ... declares 7.7+ra48a79a and HEAD declares 0.1+ra48a79a ...
mutate   green   ... sampled 1 of 1 target at 7.7+ra48a79a: killed 1
```

R15 says "the battery lock file is read from the HEAD blob". The label moved, the row moved, `verify version` moved, the sample seed did not — so the deletion sample rotates on a bump nobody committed.

**M6 — The history row reds an honest commit that quotes a `Slice:` line in prose, and names the wrong slice.**
`isTrailerLine` counts any line whose trimmed form starts with `Slice:`, anywhere in the message. Reproduced with a message of exactly the shape this repo writes:

```
Record the review: F103 and F104
...
F103 says the board misreads a commit that writes

Slice: demo_s1

in prose. F104 is smaller.

Bet: demo_bet
Slice: demo_s2
Tests: yes
```

→ `red ... 1 squashed: 4e3011d writes 2 Slice lines that git reads as 1, which is what a squash leaves behind: demo_s1`. Not a squash; the named slice is the quoted one, not the commit's own. History is immutable, so this red is permanent — the only escape is a waiver, and three waivers of `history` trip the counter, which then clears trivially because "history" is an ordinary word (M2). Page 5.3 says the check is "wider than squashes by one step" and names one extra shape; this is a third. `git revert` alone is safe — I checked.

**M7 — The gap-read misses the squash R14 actually names.**
`git merge --squash` followed by `git commit -m "close bet_3"` — SQUASH_MSG discarded — erases both `Slice` trailers and reads **green**: `2 commits read, 0 merges not read: 0 squashed`. A squash of commits that carried no trailers is likewise invisible. The only squash fixture (`closeABet(t, dir, true)`) keeps SQUASH_MSG, so `TestProof_b3s7_history_a_bet_closed_on_a_squash_is_red` proves one flavour and the page's table cell "A bet closed on a squash | yes" and its summary line "A bet closes on a merge commit, never a squash" both overclaim. GitHub's squash style **is** caught — I checked that too.

**M8 — The counter's line leads with a row that is fine and hides the row that made it red.**
`judge` walks row ids sorted, and appends cleared and uncleared hits in the same list. Reproduced: `board` cleared by a finding, `trace` at the limit with none —

```
red  ... 2 rows at a threshold, 1 named: board has 3 grants inside bet_x, at the limit of 3, and a finding names it and 1 more
```

The row a reader must act on is inside "and 1 more". D57 ruling 6 and F61's head discipline both point the other way. Ordering reds first is the whole fix.

**M9 — Fixture commits go through the host's signing shim: 42% of the clock, and the channel behind F100.**
`newRepo` sets `user.name` and `user.email` and nothing else, so every fixture commit inherits the global config F62 already recorded: `commit.gpgsign=true`, `gpg.ssh.program=/tmp/code-sign`.

F100 reproduced on my copy on **all four** verify runs — `board red ... 10 behind ... b3s4_position is expected green and failed in the run`. I ran the board's own filter by hand and got 0 fails, then 19, then 59 on an unchanged tree. The failure text is not an assertion:

```
boardrow_test.go:168: git commit -m first failed: exit status 128:
  Error: signing failed: ... too many open files
  fatal: failed to write commit object
```

So F100's open hunt lands here: a host failure inside a fixture becomes a failed proof, and the board reads that as `expected green and failed in the run` — D56.1's "work regressing", red. D58 ruling 3 already ruled for the stub row that a surface that broke stays unrunnable; the board applies no such rule, and the flake machinery cannot fire because both attempts meet the same broken host.

Adding `{"config", "commit.gpgsign", "false"}` to `newRepo` in both packages: `internal/battery` goes from **138s to 80s**, repeatably, and the suite stays green. This slice adds a lot of new fixture commits (`commitAll`, `land`, `grant`, `regrant`, `commitFile`, `commitLock`, `writeFindings`, `closeABet`), so it makes both the clock and the exposure worse.

**M10 — D60 ruling 5's deferral passed unclosed and unrecorded.**
"Design files are read from the working tree until R15's slice moves committed reads onto their own ground." R15's slice is this one. `internal/trace/trace.go:462` still uses `os.Open`, and `internal/plan/plan.go:606` still uses `os.ReadFile`. Only the lock file moved. Nothing in D62 or the findings says that was the call.

**M11 — The new prose is drifted against the baseline D63 pinned today.**
D63 ruling 1 landed at 05:10, mid-review: "A reviewer checks new prose against a mean near 15 words per sentence, and drift from there is drift, even when the file next door already drifted." Measured: the four new Go files' comments run **19.2** mean words per sentence with 18 sentences of 35+ words; contract page section 5 runs **19.5** with 7. The existing battery rows run 20.2 — which is the defence D63 explicitly refuses. The same shallow-postures paragraph is written out five times (three row files, the page, D62.5).

---

## LOW

- `BlobAt`'s comment says the revision is pinned "with `^{tree}`" and "the path is passed after a `--`". The code uses `^{commit}` and embeds the path in `commit+":"+path`. Neither claim is true (`internal/journal/git.go`).
- A record path declared twice in one slice is accepted, counted twice and named twice: `2 records read: 2 missing ... docs/the-record.md for demo_s1 is not a file in this tree; docs/the-record.md for demo_s1 is not a file in this tree`. D61 ruling 3 put doubled declarations in the plan reader's refusal.
- A record committed with the slice and then edited in the working tree reads green with "0 uncommitted". The count means "no commit holds this path at all"; a reader who just edited a record will read it the other way.
- `--close` leaves no trace in the journal. The run's lines are identical to a plain verify, so nothing durable says a close happened.
- Mutation `m26`: `os.Lstat` → `os.Stat` **survived**. The comment says following a symlink "would judge a file the plan never named"; nothing pins it. Shipped behaviour is right (symlink → "is not a file in this tree", red).
- The record row copies the waiver authority's parentless-in-shallow rule (`waiver.go:549-564`) rather than sharing it, with prose claiming "the same test for it". Two copies, no structural pin — D54 ruling 1.
- `journal.Messages` reads every commit's whole message with no cap on count or bytes (203KB here). Consistent with the existing readers, so not a regression, but it is F94's class amplified.
- "this repo waives nothing, and its whole history is here to say so" is printed in exactly the state where D62.9's blind spot lives — after every waiver has been deleted.

---

## Mutation sweep — 26 rules, clean baseline before each

Baselines green for `internal/battery`, `cmd/groundwork`, `internal/journal` immediately before the sweep. Run on a tree with signing disabled in the fixtures, so a host failure could not be mistaken for a kill (my first sweep did exactly that and I threw it away).

**Killed (22):** staleness ancestry off; same-commit exemption dropped; missing off; uncommitted off; shallow-edge guard removed; record reads merges as landings; record takes the oldest claim; record judges unlanded slices; bet threshold 3→4 *(host-noisy but the right proof is in its fail list)*; repo threshold 5→6; finding always clears; counter counts merges; counter shallow gate off; history gap-read off; history reads merges; history no-commit green; version row reads the working tree; `verify version` drift check off; close scope shrunk; run label reads the working tree; trailer line without trim; tree-vs-HEAD drift not red *(re-run alone → killed)*.

**Survived (3):** shallow-edge widened (H3); close refusal unwired (H1); `Lstat`→`Stat` (LOW).

**Invalid (1):** substring match — my edit left an unused variable and would not build.

---

## What held up

- The record row's core rules all die under mutation, each naming exactly the right proof. Ancestry-not-clock-time, the same-commit exemption, merges-never-govern, declared-records-only, the missing/uncommitted/stale split — all defended.
- The waiver counter's thresholds, the finding-clears rule, whole-word matching, merges-not-counted and the shallow-unrunnable gate all die under mutation. My fixture probes confirmed each: 3-in-one-bet red, 5-across-repo red, 2 quiet, 4 quiet, merge counted-not-read, shallow unrunnable with an honest why, a stray file named.
- F102's fix bites. Depth-1 and depth-2 clones both report the edge and leave the record unjudged; a full clone reds the same fixture; a repo's own first commit is still dated.
- F101's fix is right — the seal pin asks git for the tag and holds the row to whichever green is honest.
- `contract_test.go` is genuinely cell-driven both directions: `drive` fails if a page row is undriven, if a driven case has no page row, if the middle cell's words change, or if a verdict cell is rewritten into prose. That is what F97 asked for.
- R15's honest answer works through both verbs. On the uncommitted tree the version row is red — `the working tree's .groundwork-battery.json declares 12.0+ra48a79a and HEAD declares 11.0+rffb3f30` — and `verify version` exits 1 saying the same. On my landed copy both are green. I swept the fixtures: `cmd/groundwork`'s `writeLock` now commits, `internal/battery` grew `commitLock` beside it, and the whole suite is green.
- Mechanics: digest `ra48a79a` confirmed via the drift error on a copy; version floors run unbroken 2→12 across the row files, one bump for three rows per R16; `record`, `waiver-count`, `history` registered after `trace` with their own kinds in the closed vocabulary; 17 chained journal lines under one run id; `go test -p 1 ./...` green in 4m34s; `gofmt -l` clean; `go vet` clean; `internal/battery` 138.0s (claim: 141.9s); four proof markers, one definition each; `b3s7.md` records the page; record paths are constrained at load — no absolute, no `..`, no colon, no backslash — and a symlink is refused.

## Claims that did not reproduce

- **The honest tail.** Claimed `16 rows: green 15, red 0, waived 0, quarantined 0, unrunnable 1`. I got `green 14, red 1 ... unrunnable 1` on **four** runs, the board red every time. Cause is M9, not the slice. But the landing gate is verify-green plus suite-green on one tree (D55), and on this host verify's result is a coin flip.
- Everything else matched: `4 records read (shallow): 0 missing, 0 uncommitted, 0 stale, 0 unjudged, 3 waiting` byte for byte; history `271` on my landed copy against the claimed `270` on the uncommitted one, which is the extra commit; `12.0+ra48a79a`; 17 chained lines.

## One note on the artifact

The slice is one uncommitted blob. Nothing in it shows the tests were written first and committed red — the new test files do not compile against `fd8f6f2`, so the red set cannot be re-derived from the artifact alone. That is inherent to reviewing before the commit, not a finding, but the driver should confirm the red commit exists before the pair lands.