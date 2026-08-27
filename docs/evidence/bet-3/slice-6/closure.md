# Closure re-check

After the fix round. Nine of ten closed; the symlink defense's escape half reopened as F98, with the record claiming the path it had not closed.


Closure re-check done. Real repo untouched — tree byte-identical to when I started, HEAD still `368ed9d`, and everything ran on copies.

---

# Closure re-check — bet 3, slice 6 fix round

**VERDICT: LANDS after two fixes.** Nine of my ten findings are closed, several of them closed harder than I asked for. One half of H1 is still open, and the fix round introduced one new instance of the exact defect class it was fixing. Neither is a crash.

---

## Per finding

### H1 — the crash is CLOSED; the escape is REOPENED

**Closed half.** Every probe that used to kill `verify` now comes back as a named verdict with the battery alive, under a 2 GB address-space cap:

```
400 MB regular file   red   ... was not read for demo_s1_p: is 400000049 bytes, over the limit of 262144 bytes
symlink to /dev/zero  red   ... is a symlink, and a design file is read as a file
symlink outside repo  red   ... is a symlink, and a design file is read as a file
named pipe            red   ... is not a regular file
directory             unrunnable (the plan row catches it first)
```

The boundary is right: 262144 bytes reads, 262145 is refused with the true size. The false comment is gone and replaced with an accurate one. Mutations V7 (cap→4 GiB), V8 (`LimitReader` loses its `+1`, i.e. silent truncation), V10 (symlink gate), V11 (regular-file gate), V14 (`reasonOnly`) and V15 (size from the read, not the stat) were all killed. V11 is killed by a hang rather than an assertion — with the gate gone, `io.ReadAll` on the fifo blocks and Go's test timeout panics. That is the right signal, just slow.

**Open half — MED.** `os.Lstat` refuses a symlink only at the *last* path element. A committed symlink at an intermediate directory is followed:

```
$ ln -s /tmp/claude-0/outside docs/sub      # git stores it: 120000 blob … docs/sub
$ # slice's from: docs/sub/secret.md#a-secret-ruling
plan   green
trace  green  1 proof: 0 dangling; 1 facing id: 0 unclaimed, 0 claimed twice;
              0 marked (unsealed): docs/sub/secret.md carries no seal in this repo
```

The row read a file outside the repo, resolved an anchor in it, and went green. The blast radius is bounded — the other two gates still hold through a symlinked directory (`docs/sub -> /dev` with `docs/sub/zero` gives "is not a regular file"; a 400 MB file behind one gives "over the limit") — so this is an escape, not a crash, and no content reaches the evidence.

What makes it worth blocking on is the comment, `internal/trace/trace.go`, `anchorsOf`:

> "A committed symlink sits at a path that passes every one of those rules and points wherever it likes — at /dev/zero, at a file on the machine nobody reviewed — **so a symlink is refused here rather than followed.** That is the honesty scan's own rule, applied where this row reads."

And `docs/derivation-contract.md` §4.1 repeats it: "A symlink. The plan reader keeps the written path inside the repo, and a committed symlink sitting at such a path still points wherever it likes." Both state a guarantee the code does not give. F94's own text is "the comment claiming the plan reader's path check protects the read is false" — the fix for it carries a narrower version of the same false claim. Fix the read (walk each element, or `EvalSymlinks` plus a containment check), or narrow both sentences to what one `Lstat` actually does.

### N2 — NEW, MED: the page's new numbers and rules are pinned by nothing

Three mutations of prose the fix round added all survived a full suite:

| mutation | result |
|---|---|
| `- A file over 256 KiB` → `512 KiB` | **SURVIVED** |
| delete the whole link paragraph | **SURVIVED** |
| delete the symlink bullet | **SURVIVED** |

The cap is the one that will bite. `MaxDesignBytes` and the page now state one number in two places with nothing holding them together — and the repo already has the machinery for exactly this. `internal/plan/plan_test.go:1446`, `TestTheContractWritesEveryCapTheParserHolds`, pins every plan-parser cap number to the same contract page:

```go
{"an id", fmt.Sprintf("%d bytes", maxIDBytes)},
```

Shrinking `maxIDBytes` kills it. The trace row's new cap skipped that pattern. This is F95's class — record states what code does not — re-entered at a new spot, in the round that fixed F95. Adding `MaxDesignBytes` to that existing test is a one-line fix.

### M2 / F95 — CLOSED

§4.4 now says the unsealed things are "named beside the row's other findings" and gives the head-arithmetic reason for not counting them. Matches the nil clauses and D60.7. `b3s6.md`'s `real:` now reads "the plan and the design docs this repo commits, read from the working tree" plus "real seals, granted and amended through the seal verb" — matching D60.5 and the sealed fixtures.

### M3 / F96 — CLOSED

D61 rulings 1 and 2 are recorded with their reasoning, and §4.2 and §4.3 carry them. The two new table rows are genuinely driven: flipping the cross-program row's verdict and gutting the first-bet row's middle cell both die on `TestTheContractPageAndTheRowAgreeOnEveryVerdict`.

### M4 / F97 — CLOSED

```
plan   red         1 problem: docs/plan/demo/demo_bet/demo_s1.md claims the facing item f_one twice
trace  unrunnable  the trace row has no plan to read: 1 problem: …
```

Refused at load, and the refusal lands in `TestProof_b3s1_references_resolve_or_the_reader_names_them` beside its siblings — both V16 (the case never fires) and V17 (the `claimed` set never fills) die there. The trace row's two-claims line survives for the genuinely-two-slices case, which I re-confirmed end to end. An id both undeclared and doubled reports two problems; both are true of the file, so I would leave it.

### M5 — CLOSED (see M2).

### L1 — CLOSED, and this is the part I pushed hardest on

`traceTotals.outcome()` is gone. The row's verdict is `traceOutcome(rep)`, which is `rep.Sound()`. The structure now makes disagreement impossible rather than merely tested: `totals` and `traceOutcome` read the same `trace.Report`, in the same function, with nothing between them.

I drove all 64 report shapes — every subset of the six note lists — through `traceVerdict` and checked both the outcome and the head:

```
--- PASS: TestReviewEveryReportShapeVerdictsThroughTheRow
```

Every shape verdicts red exactly when one of R12's three lists is non-empty, every outcome is red or green and never a third thing, and no line ever says a red count on a green verdict or the reverse. Mutations V1 (always green), V2 (always red), V4 (the hits branch ignoring its argument), V5 (`Sound` drops `Twice`) and V6 (`Sound` counts marks as red) were all killed, several of them by the new row-level tests.

**V3 survived and is correct.** Hardcoding `Green` in the no-hits branch is an equivalent mutant: no hits implies the three red lists are empty implies `Sound()`. Provable, not a coverage gap. Worth knowing that the `outcome` argument is only load-bearing on one of `verdict`'s two paths.

The three states that never reached the row now do: the unreadable design file through `TestProof_b3s6_backward_a_design_file_the_row_will_not_read_is_named` (two cases, each asserting the plan row is green first, so the case really arrives), the withdrawn premise through `TestTheTraceRowNamesABetStandingOnAWithdrawnArtifact`, and claimed-and-deferred through its own row subtest.

### L2 — CLOSED

`| The anchor names a heading in the file | Traced | no |` → `| … | Bananas | no |` now dies. The `holds` assertions are the better half of that fix: a row can no longer pass by producing nothing.

### L3 — CLOSED, with N4 traded in

The reported case works: `## The [spec](docs/spec.md) page` now slugs `the-spec-page`, which is what GitHub makes and what a person copying the heading link gets. V12 and V13 both die.

**N4 — NEW, LOW.** `linkText` also fires inside a code span, which is new divergence in the other direction. GitHub keeps `` `[label](target)` `` literally:

```
## Writing a `[label](target)` link
  writing-a-labeltarget-link   red     ← what GitHub makes
  writing-a-label-link         green   ← what this makes
```

The right trade — a real link in a heading is far likelier than quoted link syntax — but the code comment and the page both say "Inline links only. A reference-style link and an image are not read", and neither mentions code spans. I checked the other two: images and reference-style links do diverge, and the page's claim that such a heading "makes an anchor this cannot resolve" is accurate for both. Add code spans to that sentence.

### L4 — CLOSED

`TestAPremiseIdIsSpelledTheWayASealSubjectIs` holds `plan.CheckID` and `seal.SubjectOf` together across nine ids including both sides of the 64-byte boundary. Shrinking `maxIDBytes` to 63 kills it. `CheckID` was already exported and already called from `internal/board`, so no new wiring debt.

### L5, L6 — CLOSED

Both red subtests now assert the plan row is green on the same repo. The dense sentences in `tracerow.go` are split, and I found no new ones in the fix diff.

### N3 — NEW, LOW: the cap's boundary is undriven

`if len(raw) > MaxDesignBytes` → `>=` **SURVIVED**. My probe shows the boundary is where it should be, but nothing pins it. A file of exactly `MaxDesignBytes` reading, and one byte more being refused, is two lines in the test that already exists.

---

## Gate

I reproduced every claim. `gofmt -l` and `go vet ./...` clean. `go test -p 1 ./...` green alone. `internal/battery` 124.8 s against the claimed 130.0. `verify` alone on a copy:

```
battery 11.0+rffb3f30
trace  green  24 proofs: 0 dangling; 14 facing ids: 0 unclaimed, 0 claimed twice;
              0 marked (unsealed): docs/evidence/bet-3/design.md carries no seal in this repo
13 rows: green 13, red 0, waived 0, quarantined 0, unrunnable 0
```

Digest unchanged from the pre-fix round, as it should be — the row set did not move. The journal holds 14 chained lines under `b3s6r2`, seq 1 to 14, and its recorded summary is `{green: 13, red: 0, …}` at `11.0+rffb3f30`. The honesty row now reads 929 tests, up from 923, and every one can fail.

My own sweep this round: 23 mutations planted, four-way, each verified against a content hash of the whole tree before and after. 18 killed, 5 survived — one equivalent (V3), four real gaps (V9 and the three page mutations, which are N2 and N3).

One process note. Midway through, a `timeout` killed the harness between mutating and restoring, and my `git status` guard did not catch it because `internal/trace/` is untracked and status compares names, not content. Every result from that point was contaminated by a live mutation and I re-ran all of them on a rebuilt copy under a content hash. The numbers above are the clean ones.