# Blind review — Bet 1, slice 5: the token cross-check

Reviewer: a fresh session, no contact with the builder. The builder had run twelve mutations under D16 and reported all caught, so the review spent its effort where a builder's own list would not reach: adversarial sidecar shapes, post-merge journal shapes, and arithmetic edges. Verdict: **bounce**, reworked, then landed. Date: 2026-08-22.

## Findings

HIGH:

1. A post-merge duplicate seq was collapsed last-wins. Two clones sharing a session id both wrote seq 1; the merge rightly kept both lines; the verifier compared only whichever blob hashed later and said ok — while spend reported the sum of both. Which line won was blob order, invisible to the reader. Ruled in D17: a seq with more than one journal line is ambiguous, prints both figures, and fails.
2. The tolerance subtraction wrapped. A sidecar claiming the minimum int64 verified as ok against any journal figure — one edit to a driver-written file made every check pass. Fixed with non-wrapping comparison and negative figures rejected at parse.
3. A sidecar that claimed nothing passed. Absent key, null, and empty list all printed checked 0 and exited 0 — a truncated sidecar was a clean pass. Ruled in D17: checked 0 never exits 0.

MED:

4. The exit-code doc was not widened for the sidecar-missing case, and two comments contradicted the code. Fixed.
5. The session guard on --session was unproven — deleting it survived the suite (the unrun-proof class again, caught same-slice this time). Pinned.
6. The slice's rulings were unrecorded; D17 now holds them.
7. Never-journaled rows were counted as mismatched in the summary, hiding a distinct fault. Separate count added.

LOW:

8. A duplicate seq in the sidecar produced accidental behaviour; now malformed.
9. The journal=- placeholder was unpinned; asserted whole-line.
10. The sort comparator wrapped on extreme seqs; cmp.Compare.
11. Token figures were int where spend uses int64; widened.
12. The read-only test checked the sidecar weakly; now byte-compared.
13. Red/green cut at landing, as every slice.
14. One two-idea sentence split.

## What held up

The builder's twelve D16 mutations were all genuine — the reviewer re-ran a sample and found the coverage real. The subdirectory, tolerance-boundary, malformed, wrong-session, and negative-tolerance cases were honest, with independent literals. The negative-tolerance test's own history (its first version passed for the wrong reason, caught by the builder's mutation run) is D16 doing its work at build time.

## Re-review after the rework

The reviewer re-ran all three original reproductions cold: each now fails correctly through the real API. Two new blockers surfaced and were fixed before landing: the ambiguous status had no CLI test — a one-word bucket edit resurrected the bounced defect while the suite stayed green — and ruling A fired only when the sidecar claimed the colliding seq, so an unclaimed collision passed silently. The ruling was amended (any collision fails, claimed or not), the summary gained its own ambiguous bucket on the reviewer's recommendation, and the reviewer's exact mutation is now killed by a named test.
