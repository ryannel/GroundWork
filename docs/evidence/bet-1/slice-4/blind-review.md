# Blind review — Bet 1, slice 4: the merge verb

Reviewer: a fresh session, no contact with the builder. Method: diff read, mutation checks, and hostile commits built with plumbing, driven through the real Merge API. Verdict: **lands after fixes**. Date: 2026-08-22.

## Findings

HIGH:

1. The union could silently drop and silently rewrite local lines, reporting success. An incoming blob at events/<session> — a file where this side has a directory — deleted the whole local session subtree; a forged blob at an existing content-addressed path replaced the real line. Both proven through the real API: outcome merged, no error, lines gone. The same-path-same-content assumption holds for lines this tool writes, but was asserted, never checked, for a fetched ref — and accepting fetched refs is the verb's whole job. Fix: after the union, every local entry must survive unchanged or the merge refuses, naming the path (D15).
2. The merge's compare-and-swap was claimed, not proven — the force-update mutation left the suite green. A scratch race (one merge against six concurrent dispatches) lost a line in four of five runs under the mutation and passed clean against the real code. Fix: that race becomes a committed test.

MED:

3. The output sentence was effectively unasserted — three mutations of the counts and wording survived. Fix: complete-sentence assertions for all three outcomes.
4. --end-of-options was an untested claim (harmless on current git, since ^{commit} is appended). Pinned via the CLI dash-argument case.
5. Three rulings were unrecorded — the positional argument, the whole-tree union (a fetched ref carrying a foreign file lands it in the journal ref, uncounted), and the no-events acceptance test. Recorded as D15.
6. The unrun-proof defect class tripped D10's threshold: seven findings of that class in bet 1 across all four slices. The upstream change is D16 — builders now run their own mutations before handoff.
7. One sentence of the D13-consequence comment did not parse; rewritten.

LOW:

8. Merge from a subdirectory and the ordinary shared-ancestor three-way were correct but unpinned; both got tests.
9. Three copies of the retry policy and temp-index dance existed across write and merge — the parallel-definition class. Deduplicated to one.
10. The other side's count skipped the singular/plural helper the other counts use; aligned.
11. mergeSentence used default: for the merged case, so a fourth outcome would render silently; made explicit.
12. A helper re-implemented slices.Contains; replaced.
13. Red-then-green is cut at landing time by the driver, as with every slice.

## What held up

The union is recursive and correct for everything the tool itself writes — wholesale-preference mutations and dropping the recursive overlay each failed four to five tests. Parent order pinned. Already-merged is genuine reachability, not equality. Fast-forward moves the ref with no merge commit. All reject paths hold with the ref unmoved. The clause test uses real clones and real fetches in both packages. The working tree and every other ref are proven untouched.
