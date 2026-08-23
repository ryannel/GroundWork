# Blind review — Bet 2, slice 1: the verify verb and the run record

Reviewer: a fresh session, no contact with the builder. The builder had run twenty mutations and a lock-file hostile table, so the review hunted elsewhere: digest preimage injection, mid-run journal failure shapes, the exported-identifier refactor, and output honesty. Verdict: **lands after fixes**. Date: 2026-08-22.

## Findings

HIGH:

1. CI never ran the drift check — D23's gate did not exist. A moved digest with a stale lock file kept CI green. Fixed: a gating `verify version` step.
2. "Rows first, battery line last" was stated, not pinned — inverting the order left the suite green, and an interrupted run could leave a battery line with counts and no rows: a half-recorded run that looks complete. Fixed: a seq-ordering assertion.
3. The run summary was substring-asserted only — the same class as bet 1's merge sentence. Skipping zero counts survived the suite, breaking the printed promise that an absent outcome reads as zero, never as absence. Fixed: exact-line assertions plus a multi-row case.

MED:

4. The lock file accepted trailing garbage and a second JSON object — both verified green. Fixed: reject when the decoder has more.
5. `verify version` outside a repo leaked raw git plumbing, bypassing the ErrNotARepo convention every other verb follows. Fixed at RepoRoot.
6. The evidence cap destroyed a row's whole evidence on one invalid UTF-8 byte — a red row could journal a verdict with no readable evidence. Fixed: sanitize before cutting.
7. The lock file needed no commit — a working-tree edit passed. Ruled in D28: working-tree read stays, CI is the enforcement point, HEAD-blob read revisited with bet 3's seal machinery.

LOW:

8. Four new vocabularies were unrecorded; D28 holds them.
9. D23's seal fields were deferred with no owner named; D28 names bet 3.
10. The digest's injection safety rested on Register unstated; the coupling is now asserted, and a zero-value Registry gets a plain message instead of a nil-map panic.
11. The plural row count was never exercised; folded into finding 3's fix.
12. Red/green cut at landing, as every slice.

## What held up

The digest canonicalization is sound — dropping severity from the preimage fails five tests, and the committed literal reproduces by hand. The D17 zero-row refusal, the D8 envelope discipline, the evidence cap at the write boundary, and the outcome-vocabulary coupling test all survived the reviewer's own mutations. The refactor left no stale references and no import cycle. CLI edges and hostile sessions all fail closed before the first journal line. No style drift.
