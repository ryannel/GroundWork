# Blind review — Bet 1, slice 3: the spend query

Reviewer: a fresh session, no contact with the builder. Method: diff read, nine mutations, four scratch repos driven through the built binary. Verdict: **lands after fixes**. Date: 2026-08-22.

## Findings

HIGH:

1. The command printed "the journal is empty" over a journal that was not empty — a ref holding dial and seal lines but no dispatches got the empty message, and a test pinned the false statement, making the lie load-bearing. Fix: split the messages; a ref with lines but no dispatches says "the journal holds no dispatch lines".
2. No test planted a line. Every spend test read back only what the same package's writer had just written, so "queried from the ref itself, not from a fixture" was only half shown. The code was in fact correct on all four hand-probed cases — unknown kinds, partial old envelopes, huge numbers, corrupt blobs — but none was proven. Fix: planted-line tests for each.

MED:

3. One unparseable blob kills the whole report, and the policy was undocumented. Ruled in D14: fail loud, naming the object. Pinned by a planted corrupt blob.
4. An empty group key rendered as an unlabelled row — real spend attributed to nothing. Fix: render "(none)".
5. Four rulings were unrecorded. Fixed as D14.
6. No red commit yet — cut at landing time, as with every slice.

LOW:

7. The TOTAL summary label collided with a legal session id (uppercase is allowed). Fix: "(total)" — parentheses sit outside the session charset.
8. Sums were int, not int64 — an exported API promise that wraps silently on a 32-bit build. Widened.
9. The read-only test did not watch the object store; a write that moved no ref would have slipped through. Strengthened with count-objects and for-each-ref.
10. The --full-tree claim was unproven; a subdirectory test added.
11. The --by validation hand-rolled an existing helper, and the exit-code split (usage 2 vs write 1) was unrecorded. Helper called; split ruled in D14.
12. TokensTotal is trusted as written from the line and is also the sort key; now stated in the doc comment.

## What held up

Read-only was the strongest part of the slice: proven byte-identical loose objects, refs, HEAD, and index across all three groupings, on a dirty tree. Arithmetic was honest — every expected value an independent literal; eight of nine mutations caught, and no summing mutation survived. Grouping, sorting, and the closed --by list behaved as the clause requires.
