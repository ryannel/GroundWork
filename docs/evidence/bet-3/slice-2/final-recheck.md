# Final re-check

Scope: the two reopens and the driver's trim. Both closed; verdict lands. Its two lows are F56, fixed at landing.


---

# Final re-check — bet-3 slice 2

**Both reopens are CLOSED. Slice 2 lands.** Two LOW notes below that should not gate it.

Worked on copies at `/tmp/claude-0/-home-user-GroundWork/a5b7b708-4ccf-5ae9-9ab1-41cce247b571/scratchpad/r3`. `git status` at `/home/user/GroundWork` is byte-identical to how I found it; HEAD `5cf4ade`; the journal ref was not touched.

This round's code diff is exactly two lines plus one subtest. I diffed it against my round-2 snapshot to confirm nothing else moved: `internal/journal/chain.go` (the guard), `internal/battery/chainrow_test.go` (the subtest and `MaxInt64`), `internal/battery/chainrow.go` (comments only).

## NEW-1 / F53 — the first-line-deletion panic — CLOSED

`i > 0 &&` is restored at `chain.go`'s duplicate-seq check. Probe P, through the real library:

```
breaks=[{s-alpha 1 this session stores no line at this seq}] lines=2
```

Probe P2, through the real row:

```
red  "1 break: session s-alpha at seq 1: this session stores no line at this seq; 0 lines came before…"
```

No panic. I also checked the three neighbouring shapes the restored guard has to keep right, since a guard put back in the wrong place is the usual way this class comes back:

| shape | result |
|---|---|
| first two lines deleted | one break at seq 1, "stores no line" |
| genuine doubled seq | one break at seq 2, **"holds this seq twice"** — dup detection intact |
| a session whose only line is at seq 7 | one break at seq 1, no panic |

**The guard is load-bearing.** Blanking it reproduces the exact fault, in the new subtest, by name:

```
--- FAIL: TestProof_b3s2_chain_a_break_is_named_and_never_blamed/a_deleted_first_line_is_a_gap,_never_a_crash
panic: runtime error: index out of range [-1]
```

## NEW-2 / F54 — the narrow bound — CLOSED

`Seq: math.MaxInt64` makes the fixture take the seq-printing branch. Probe Q re-measured:

```
committed fixture (seq printed): 192 bytes
other branch (seq omitted):      165 bytes
cap 200, slack 8
```

The committed test now measures the widest branch, and it is tight: a reason 9 bytes wider makes 201 bytes, so raising `MaxWhyBytes` from 76 to 85 would fail it. The test's comment — "fires the moment any of those four grows" — is now true. With that proven, D50.2's removal of `cut()` is sound; the bound is the guarantee and the bound is real.

## The two optional items

**Register trim — CLOSED.** `chainrow.go` comments now measure 18.0 mean / 17.0 median words per sentence (I had 20.3/20.0 before the trim; the driver's tooling read it slightly differently, same direction). It now sits below `planrow.go` (19.3/18) and inside the landed spread — `waiver.go` 16.9/15, `chain.go` 16.7/15.5, `journal.go` 13.8/12. Back in band.

**Unrunnable branch keeps `cut`, not `printable` — the ruling satisfies my concern; its stated mitigation did not land.**

On the substance I am satisfied. D50.1 takes the risk knowingly, gives a sound reason (an unprovable rule is F50's own lesson), and records the caveat in the ledger — which is the right home for a ruling. I re-ran probe R on the final tree and the branch still prints only git's own words:

```
unrunnable  "git ls-tree -r -z --full-tree <oid> -- events/: exit status 128: fatal: not a tree object"
```

and probe R2 confirms a hostile *path* (tab and newline in a session directory name) still lands in the red branch and comes out `"session ev il name"`.

But D50.1 says, as a statement of fact: *"that dependency is named in the code."* It is not. The comment at `chainrow.go:56–59` gives only the D49.2 reasoning — journal values versus git's words — and never says the branch's safety rests on `treeEntries` and `scanBatch` quoting with `%q`. Neither of those two functions carries a note that its `%q` is load-bearing for the row's unrunnable line; the only nearby comment (`journal.go:598`) is about `-z`, a different property. So the one thing that would stop a future editor changing `%q` to `%s` is absent. **LOW** — one sentence in either place makes the ruling true.

## Second LOW — the guard's only test lives one package up

With `i > 0 &&` blanked, `go test ./internal/journal/` stays **green** (37s, ok). The defect is in `internal/journal/chain.go`; its only committed guard is the subtest in `internal/battery`. Someone working in the journal package alone would not see the panic come back. CLAUDE.md: *"Tests live beside the code they prove."* The proof marker is the right home for the headline shape, so this is an addition, not a move — my probe P is four lines and would sit naturally in `chain_test.go`. Not blocking.

## What held up

- `go test ./...` green on a clean copy of the final tree, all nine packages.
- The diff is genuinely two lines of code plus one subtest — no drive-by changes.
- Dup-seq detection survived the guard restoration, which is the failure mode I most expected.
- The bound is now tight rather than merely true.
- Lock still `7.0`/`r5a8f33c`; row list untouched; digest unmoved.
- Tree as found.

## Verdict

**CLOSED on both reopens.** Every finding from my two earlier rounds is now closed, accepted under a named ruling, or carried as a LOW that does not gate landing. From my side slice 2 is ready to land, with the two LOW notes above worth a line in the ledger so they are not lost — the `%q` sentence in particular, since D50.1 already claims it exists.