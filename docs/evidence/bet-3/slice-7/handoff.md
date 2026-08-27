# Handoff — bet-3 slice 7

The record row, the waiver counter, history shape, the close scope, and the lock's read source.

Builder session. Working tree only; the driver commits. Base HEAD `0a29858`, tree clean at start.

## Status

- [x] Read CLAUDE.md, `docs/plan/rebuild/bet_3/b3s7.md`, design R14/R15/R16.
- [x] Rulings settled (below).
- [x] Tests written, then the code.
- [x] `gofmt -l` clean, `go vet ./...` clean.
- [x] `go test -p 1 -count=1 ./...` green alone. `internal/battery` **141.9 s** against the 180 s clock.
- [x] Blanking sweep: 41 rules, 41 killed, 0 survivors, every baseline green.
- [x] One full verify, alone: `16 rows: green 15, red 0, waived 0, quarantined 0, unrunnable 1`.
- [x] Journal chain: 17 lines under `b3s7r2`, seq 1 to 17, every prev present.
- [x] Nothing committed. The driver lands after blind review.

## The repo's own state, measured

| Question | Answer | How |
|---|---|---|
| shallow? | yes | `git rev-parse --is-shallow-repository` → true |
| commits visible | 269 | `git rev-list --count HEAD` |
| merge commits visible | 25 | script over `%P` |
| commits whose body holds a `Slice:` line git's parser does not read | 0 | script comparing `%B` against `%(trailers:key=Slice,...)` |
| slices declaring records | b3s1, b3s3, b3s4, b3s5, b3s6, b3s7 — all `docs/derivation-contract.md` | grep of the plan |
| last commit of `docs/derivation-contract.md` | `0a29858`, the same commit b3s6 landed in | `git log -1 -- <path>` |
| seal tags | `seal/design/bet_3` now exists | `git tag --list 'seal/*'` |

So on this repo: **record green**, **history green**, **waiver-count unrunnable** (shallow).

## Rulings taken (candidates for docs/decisions.md — I do not edit the ledgers)

**1. "The slice's last code commit" is the newest commit carrying that slice's `Slice:` trailer.**
One slice is one commit, so a sound history holds exactly one, and the board row already reds a slice
two commits claim (D56.4). Merges are not read, on the same rule.

**2. "Predates" is ancestry, not clock time.** A record's last commit predates the slice's when it is
an ancestor of it. Commit dates are writable and run backwards on any rebased history. A commit is
reachable from itself, so a record landed in the slice's own commit is not stale — which is how every
slice of this bet has landed.

**3. The record row judges landed slices only.** A slice with no `Slice:` trailer owes nothing yet;
it is counted as waiting so "0 missing" is never read as a claim about it.

**4. A bet closed on a squash is read from the trailers git cannot see.** Measured, not assumed: a
`git merge --squash` plus commit produces ONE single-parent commit quoting every swallowed message,
and git's trailer parser returns none of them. So the fingerprint is a non-merge commit whose message
holds more `Slice:` lines than git reads on it. Merges are counted and not read (D38, D40, D56.4).

**5. Two shallow postures, and the line between them.** The waiver counter is unrunnable on a shallow
clone, unconditionally, per R14's letter. The record and history rows name the short history and keep
judging. The line: the counter's verdict is a threshold over a count of every grant, so a partial
history makes the count *wrong*, and wrong toward the pass. The other two judge each record and each
commit on its own, so a partial history leaves things *unjudged*, never misjudged, and the count of
what went unjudged is in the head. D56.3 ruled the board's side; this extends the same reasoning.

**6. "A finding names it" means an entry title in `docs/findings.md` naming the row id as a whole
word.** Parsed with `internal/findings`, matched with `findings.Names` — the same word-edge rule that
decides whether a decision is named from a defect class, exported so there is one rule and not two
(D54.1). A repo with no ledger names nothing, which is the safe direction.

**7. The close scope is a declared row list, and `--close` refuses a battery missing one of them.**
"Full suite" is every row — per-slice scoping of suites does not exist yet, so every row already runs
every time. What `--close` adds is the list, checked. The project's own `go test` stays D55's manual
line until F70's row lands, and both the code and the page say so instead of implying it is covered.

**8. Missing and uncommitted records share one line of the head, not one count.** They are counted
apart in the report and printed apart in the head; what could not fit was the count of landed slices,
which nothing turns on. The journal's cap is 200 bytes and six counts at 19 digits plus the words is
193 — a seventh count would not fit. D52.3 is obeyed where it bites: the three red causes are apart.

**9. The lock is read twice, and the difference is the drift.** `ReadLock` still reads the working
tree — it is the file a person edits, and this repo's own bump pins read it there. `ReadLockAtHead`
reads `HEAD:.groundwork-battery.json`. The version row reads HEAD, and reds when the working tree
declares something else, naming it as the uncommitted bump it usually is. The run's version label
comes from HEAD too, because that is the version anybody can be held to (R15).

## What that does to this repo during the build

The working tree carries the 12.0 bump; HEAD still carries 11.0. So an in-tree `groundwork verify`
during the build goes **red on the version row** — an uncommitted battery version, which is exactly
what R15 says should read as drift. That is the honest state of an unlanded bump, not a fault, and
the driver's landing commit resolves it.

The tail to judge the slice by is therefore taken on a **committed copy** of the tree, the way slices
2, 3 and 6 took theirs. On that copy the tail reads with **unrunnable 1**: the waiver counter, because
this clone is shallow. That is the first non-all-green tail this repo has printed, and it is by
design. Verify still exits 0 — only red fails a run (`RunResult.Red`) — and D55's landing gate pairs
the run with `go test ./...`, which is green.

## A pre-existing failure I had to touch, and did not cause

`TestSealRowIsGreenOnThisRepo` in `internal/battery/sealrow_test.go` asserted that this repo holds no
seal tag. The driver granted `seal/design/bet_3` after `0a29858`, so that assertion is false on the
current tree, whatever this slice does. The row itself is right — green, "1 seal over 10 paths, 1
unsigned, 0 unverified: every hash still matches at HEAD".

I did not weaken it. It now asks git for the fact and holds the row to whichever green is honest: no
seal tag means the line must say "no seal"; N seal tags mean the line must name N and say every hash
still matches. That is stricter than what it replaced, which could not tell the two greens apart.

**This is a finding candidate against the seal grant, not against this slice.** The driver should
decide whether it lands here or as its own change.

## Version

`.groundwork-battery.json` bumped to **12.0** with the digest **ra48a79a**, which the shipped rows
compute. R16: one major bump for the slice, however many rows it adds.

## Files

New: `internal/battery/recordrow.go`, `waivercountrow.go`, `historyrow.go`, `scope.go`,
`contract_test.go`, `recordrow_test.go`, `waivercountrow_test.go`, `historyrow_test.go`,
`scope_test.go`, `lockhead_test.go`; `internal/journal/messages_test.go`;
`cmd/groundwork/close_test.go`.

Changed: `internal/battery/battery.go` (kinds, the run's version label), `rows.go` (registration, the
version row), `lock.go` (`ReadLockAtHead`, one parser), `internal/journal/git.go` (`TrailersFor`,
`Messages`, `IsAncestor`, `BlobAt`), `internal/findings/findings.go` (`Names` exported),
`cmd/groundwork/verify.go` and `main.go` (`--close`), `docs/derivation-contract.md` (section 5),
`.groundwork-battery.json`, and the pins in `battery_test.go`, `planrow_test.go`, `sealrow_test.go`,
`cmd/groundwork/battery_test.go`.

## Ledger candidates (I do not edit the ledgers — these are for the driver)

### docs/decisions.md — slice 7 rulings, taken by the builder

1. The slice's last code commit is the newest commit carrying that slice's `Slice` trailer; merges
   are not read. A sound history holds exactly one, and the board row already reds a slice two
   commits claim (D56.4).
2. "Predates" is ancestry, not clock time. A record landed in the slice's own commit is not stale.
3. The record row judges landed slices only. An unlanded slice is counted as waiting.
4. A squash is read from the gap between the `Slice` lines a message writes and the ones git's
   trailer parser reads on it. Measured: a squash leaves one single-parent commit quoting every
   message, and git reads no trailer from it.
5. Two shallow postures. The waiver counter is unrunnable, unconditionally (R14's letter): its
   verdict is a threshold over a count of every grant, so a partial history makes the count wrong,
   toward the pass. The record and history rows name the short history and keep judging: they judge
   each record and each commit whole, so a partial history leaves things unjudged, never misjudged.
6. A finding names a row when an entry title in `docs/findings.md` holds the row id as a whole word,
   matched with `findings.Names` — the same rule that decides whether a decision names a class.
7. The close scope is a checked list, not prose. `verify --close` runs every row and refuses a
   battery that does not hold `seal-verify`, `board`, `trace` or `record`. The project's own test
   suite stays D55's manual line until F70's row lands, and the page says so.
8. The record row's head carries six counts, not seven: missing, uncommitted and stale stay apart
   (D52.3), and the count of landed slices was dropped, because 200 bytes holds six.
9. `ReadLock` still reads the working tree and `ReadLockAtHead` reads HEAD. The version row reads
   HEAD and reds on a working-tree difference, naming it as an uncommitted bump (R15).
10. The waiver counter counts the waiver files the directory holds now. A waiver deleted after it
    expired takes its grants with it. Named as a limit on the row and on the page rather than left
    implied.

### docs/findings.md — one candidate, against the seal grant and not this slice

`TestSealRowIsGreenOnThisRepo` asserted this repo holds no seal tag. The driver's grant of
`seal/design/bet_3` after `0a29858` made that false, and the test failed on the tree before this
slice touched anything. Caught by: worker — the slice 7 build's first full suite run. Class:
green-but-wrong is wrong here; it is closer to `record-not-written` or `other` — a state flip nobody
wrote down, anticipated by D60.6 and not carried into the test that asserted the old state. The test
now asks git for the fact and holds the row to whichever green is honest.

## Blanking sweep

**41 rules, 41 killed, 0 survivors, every one against a baseline that was green.**

The sweep ran in a committed copy of the tree, so each mutation is reverted with `git checkout` and
the tree is checked clean between rules. A rule the filtered set did not kill was re-run against its
whole package before it could be called a survivor.

Rules covered, by group: record (9), waiver counter (9), history (4), lock and version (6), close
scope (3), the contract page (6), the git readers (4).

**The harness itself had the defect the discipline is for.** Its first run filled two cells of F55's
four-way table and not the other two: it called a rule killed whenever the filtered set went red,
without ever asking whether that set was green on the clean tree. One test *was* red on the clean
tree — the shallow-clone record test, see below — and every rule whose filter reached it read as
killed by a mutation that changed nothing. The rewritten harness runs each filter on the clean tree
first and records that answer beside the mutant's. With the baselines checked, two rules that had
read as killed came back as real survivors.

**Three real gaps the sweep found, each now closed by a test.**

1. *A merge claiming a slice.* Nothing distinguished dating a record against the slice's own commit
   from dating it against a merge that claimed the slice again — D56 ruling 4's whole point.
   `TestRecordRowDoesNotDateARecordAgainstAMerge` makes the two answers differ: the code lands on a
   branch, the record is written on the trunk after the branch parted, and the merge claims the
   slice. Against the branch commit the record is current; against the merge it would be stale.
2. *The newest claim.* Nothing distinguished the newest commit claiming a slice from the oldest.
   `TestRecordRowDatesARecordAgainstTheNewestClaim` puts the record between two claims, where it is
   stale against the newer and current against the older.
3. *The shallow clone's edge.* This one was a defect in the row, not just a missing test — see the
   next section.

**Two mutations killed the build rather than an assertion, and a build break proves nothing.**
Blanking the word-edge test to `if true` left `unicode` unused; blanking `Messages`' body to `""`
left its local variable unused. Both were re-run in forms that compile (`|| true` on the same
condition, and `body[:0]`), and both are killed by assertions in those forms.

## The shallow-clone record defect, found by the sweep and fixed

The row's first shape claimed that a shallow clone leaves records unjudged and never misjudges one.
That was false, and the test written for it failed on the clean tree.

git dates every file in a shallow clone whether or not it can. At the edge the whole tree hangs off
one grafted commit, so git reads that commit as having added every file — the same fact the waiver
authority already names about the same edge. A record whose last commit reads as the graft therefore
has a real last commit out of reach, and believing the graft would call a record older than its work
current: a miss in the direction that passes.

The fix is the waiver authority's own test, applied here: a record dated to a parentless commit
inside a shallow clone is left unjudged and counted. The guard is on `Shallow`, because a repo's own
first commit is parentless too and is a commit somebody really made —
`TestRecordRowDatesARecordFromTheRepositorysFirstCommit` holds that, and the sweep is what asked for
it. The row comment and the contract page were both corrected; the claim they make now is the one the
code keeps.


## The closing runs

The tree was frozen first, and each ran alone.

**`gofmt -l` clean. `go vet ./...` clean. `go test -p 1 -count=1 ./...` green**, 4m33s in all, with
`internal/battery` at **141.9 s** against the 180 s clock.

**One full verify, on a committed copy of that tree.** The tail:

```
battery 12.0+ra48a79a
16 rows: green 15, red 0, waived 0, quarantined 0, unrunnable 1
```

The one unrunnable row is the waiver counter, on this clone's shallowness, which is R14's own rule.
Verify exits 0: only red fails a run.

The three new rows' lines on this repo:

```
record        green       4 records read (shallow): 0 missing, 0 uncommitted, 0 stale, 0 unjudged,
                          3 waiting: every record read is in the tree and no older than the work it
                          describes
waiver-count  unrunnable  this clone is shallow, so the grant history behind .groundwork/waivers is
                          not all here: grants nobody can see would count as zero and pass a
                          threshold. Fetch the full history to run this row
history       green       270 commits read (shallow), 25 merges not read: 0 squashed: every commit
                          read keeps the Slice trailers its own message writes
```

Seven slices declare a record; four have landed in the copy and three have not, which is the waiting
count. Only three slice trailers are inside this clone's history — b3s4, b3s5 and b3s6 — so b3s1,
b3s3 and b3s8 read as unlanded here.

**The journal.** That run wrote 17 chained lines under the session `b3s7r2`: 16 `battery-row` and one
`battery`, seq 1 to 17, every line from seq 2 on carrying a prev. The chain row read them green in
the same run.

**A board red on the first attempt, not reproducible.** The very first verify on the freshly copied
tree came out `16 rows: green 14, red 1, unrunnable 1`, with the board row red: `10 behind`, naming
`b3s4_position is expected green and failed in the run`. Everything else was green, including all
three new rows and the version row.

It does not reproduce. The same binary on the same copy, run again, gives the board green with `0
behind` — that is the run reported above. The board row is also green when run on that tree directly.
Every proof passes under `go test -run TestProof_`, with and without the battery's own run guard set.
And a full verify on a pristine `0a29858` tree — the tree before this slice — is `13 rows: green 13`,
with the board green.

So this is the board's proof run reporting proofs as failed under a squeezed first run, not a state
this slice's rows introduced. It is a **finding candidate against the board row, not against this
slice**: a false red the flake machinery did not catch, because both of that row's attempts inside
the one run came out the same way. Both verify outputs are kept, in `scratchpad/verify-final.txt`
and `scratchpad/verify-final2.txt`, and the baseline in `scratchpad/verify-base.txt`.


## Left open for the driver

- The version row is red on the working tree during the build, by design (R15). The driver's
  landing commit is what resolves it: the landed tree agrees with HEAD.
- The waiver counter reports unrunnable on this clone, by design (R14). Verify still exits 0.
- `TestSealRowIsGreenOnThisRepo` was failing before this slice, because of the seal grant. Fixed
  here, honestly and more strictly; the driver decides whether that rides with this slice.
- The close scope does not run the project's own test suite. D55's manual line still applies, and
  F70's row is where it closes. Named in the code and on the page, not implied.
- The waiver counter reads the waiver files the directory holds now. A waiver deleted after expiry
  takes its grants with it. Named as a limit rather than left implied; nobody has ruled on it.

## Evidence files in the scratchpad

| File | What it holds |
|---|---|
| `final.log` | the closing `go test -p 1 ./...` and the first verify, with timings |
| `verify-final.txt` | verify run 1 on the committed copy — the board red that does not reproduce |
| `verify-final2.txt` | verify run 2 on the same copy — the tail this slice is judged by |
| `verify-base.txt` | a full verify on a pristine `0a29858`, for comparison |
| `sweep.log`, `sweep.json` | the 41-rule blanking sweep with baselines |
| `sweep4.json` | the three rules re-run after their tests were written |
| `blank.log`, `blank2.log`, `blank3.json` | the earlier sweep runs, kept because the first one was wrong |
| `sweep.py`, `sweep4.py`, `blank*.py` | the harnesses |
