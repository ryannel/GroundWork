# Final re-check

Scope: the micro-round's four items. All closed — the boundary sampling proved exact against the full thirty-two-million-tuple space — and the verdict is lands once F81 and F82 are written. They were, and the comment arithmetic was corrected at landing.


Tree as found — status identical, HEAD at e65c052, journal ref, tags, stashes and lock unchanged. All work on copies.

---

# Micro-round re-check — NEW-1..4

Micro-diff is 6 files, 175 insertions: `render.go`, `boardrow.go`, `contract_test.go`, `boardrow_test.go`, `render_test.go`, `findings.md`. Nothing else moved.

## Verdict: lands, once three findings are written down

All four items are closed on the code. The mechanisms are right and each one dies under blanking. Two things to hand back: an arithmetic correction in the new comment (small), and a gap in the record (the reason for the "once").

---

**NEW-1 — CLOSED on the mechanism.** Blanking `listed`'s cap now dies, and it dies at exactly my probe:

```
--- FAIL: TestTheWidestRenderedLineIsSomewhereInTheInputSpace
    render_test.go:211: a rendered line is 705 bytes, over the bound of 400: "10 tests were reported by..."
```

The `twice` axis reaching 200 with names built once outside the loops is the right shape — it costs nothing and it makes the cap load-bearing in the test rather than only in the code.

**The 288 arithmetic, audited.** Measured against the shipped code:

| line | comment | measured | note |
|---|---|---|---|
| multi-suite | 30 + 33 + 225 = **288** | 30 + **34** + 225 = **289** | `" reported by more than one suite: "` is 34 bytes, not 33 |
| table row | **242** | **242** | exact — three values at 64, columns at 6/8/9/15, six 2-byte gaps |
| note | **238** (reason at 85) | **247** (reason at **94**) | `%q` of a non-BMP unprintable rune is 12 characters, not 3 |
| git stamp | **181** | 165 at a 1-digit landed count | consistent with 181 at 19 digits; not contradicted |

So the spare under 400 is 111 bytes, not 112. Nothing is at risk — the true widest is 289 against a 400 bound — but two of the four numbers are low, and the note's is low for an interesting reason: 85 is what you get measuring `'A'`. The widest reason needs the widest rune escape. I confirmed it reaches a real line through real git, planting `Slice:` with U+E0001 (a non-printable, non-BMP rune):

```
  misstated trailer  <value>  <commit>  is not an id: it holds '\U000E0001', which is not a lowercase letter, a digit or an underscore
```

That is the same measure-one-shape-not-the-widest habit the whole F54 line is about, one layer down in the comment that bounds it. Worth correcting while the file is open.

**NEW-2 — CLOSED.** The split is the right call: a guard whose only exit is `t.Fatalf` genuinely cannot be driven through its caller. Blanking `readVerdict`'s refusal dies on five of the ten rejects at once:

```
--- FAIL: TestAVerdictCellIsYesOrNoAndNothingElse
    the verdict cell "" was read as a verdict
    the verdict cell "Yes" / "No" / "no " / " yes" was read as a verdict
```

`"not red"` and `"never"` — my by-luck prose cases — are in the list.

**NEW-3 — CLOSED.** Grammatical at one, and the bound stands:

```
n=0  0 proofs, 0 landed: 0 ahead of plan, 0 behind, 0 trailers misstated, 0 unread:
n=1  1 proof,  0 landed: 0 ahead of plan, 0 behind, 1 trailer misstated,  1 unread:
n=2  2 proofs, 0 landed: 0 ahead of plan, 0 behind, 2 trailers misstated, 2 unread:

widest head (plural) = 197 bytes   (cap 200)
same with singulars  = 159 bytes
```

`unread` borrowing the noun reads correctly at every count, and measuring the bound at the plural is right.

**NEW-4 — CLOSED, and the soundness question answered exhaustively.**

I did not want to take monotonicity on faith, so I ran the full cross product the sampling replaced — 11⁶ counts × shallow × 3 hit shapes × 3 tails, about 32 million tuples, 83 seconds:

```
full cross product widest = 200 bytes
was that tuple in the sample = true
widest tuple = {all counts 0, hits nil, one 120-byte clause}
tuples anywhere in the full space that lose a count = 0
```

The sampled search reports the same 200 bytes. So no widest point hides off the boundary, and the count-presence invariant holds everywhere, not merely on the sampled edge.

Why it is sound, for the record: the head is *additively separable* in the six counts — each contributes its own digits plus its own noun — so the head's maximum sits at the all-`most` corner, which the sampling includes. Every branch then caps the line at 200 through `cutTo` or `hitEvidence`, so the only way sampling could miss something is a count being cut, which needs a head wider than the line, and the head's own maximum is 197. The one tuple family the sampling does not reach — green (behind and misstated both zero) while the other four axes are wide — exists, is not the widest, and loses nothing, because the cut only ever eats the tail.

**Timings and the mutate row**, both confirmed:

```
TestTheBoardRowLineIsWidestSomewhereInTheCountSpace   74.60s -> 0.01s
internal/battery package                               199s  -> 137.6s
go test -p 1 ./...  green, 4m40s
verify green, 11m22s, exit 0, battery 9.0+r4326bda (digest untouched)
  mutate  green  the deletion test killed every one of 9 mutants it judged:
                 sampled 10 of 114 targets at 9.0+r4326bda: killed 9, 1 did not compile;
                 1 file was left out of this build
  board   green  24 proofs, 0 landed (shallow): 15 ahead of plan, 0 behind,
                 0 trailers misstated, 0 unread: b3s1_shapes is expected red and passed in the run and 14 more
```

No blocked clause. F80 is closed at its cause on this repo, not merely worked around. `gofmt`, `go vet`, `go build` clean.

---

## REOPENED — the record, not the code

F74–F79 now read "fixed in the fix round … Closure-checked", and F80 carries its closure. That is right, and it answers the ledger note from my last pass.

But **NEW-1, NEW-2 and NEW-3 have no ledger entry at all.** F80 covers NEW-4; the ledger goes F79 → F80 with nothing between. The working agreement is direct about this — "Every finding goes in the ledger", and a finding is recorded with what it is, what caught it, and what happened to it.

NEW-1 is the one that matters. It was a blanking mutation that survived the whole unfiltered suite, on a real D38.2 bound that nothing proved — the fourth entry in the class that already holds F54, F61 and F79, and the second time in this slice that a widest-line test measured a shape instead of searching for one. Two of the four class members are now in this slice alone. If it goes unwritten, the class stops counting, and D53 and D54 both exist because a class was allowed to reach its threshold and be seen.

NEW-2 and NEW-3 are small, and a single entry covering both would do.

Everything else is closed. On those entries landing, I have no objection to the commit.