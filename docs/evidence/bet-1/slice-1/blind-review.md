# Blind review — Bet 1, slice 1: the CLI skeleton and the dispatch writer

Reviewer: a fresh session with no contact with the builder. Method: read the five new files, then mutation checks and live experiments in throwaway repos. Verdict: **lands after fixes**. Date: 2026-08-22.

## Findings

HIGH:

1. seq reset to 1 when the CLI ran from a subdirectory. `ls-tree` without `--full-tree` scopes to the current directory. Proven end to end: three dispatches, two from a subdir, all got seq 1. Fix: `--full-tree`, plus a subdir test — the suite could not see this bug.
2. An identical line could vanish while the CLI reported success. The blob path is the sha256 of the line; nothing checked whether the path already existed. Two commits, one blob, both runs exited 0. Fix: fail when the path already exists in the tip tree.
3. Concurrent writes dropped events. Eight parallel dispatches: one succeeded, seven exited 1 with a raw lock error, no retry. A comment claimed the compare-and-swap prevented dropped events; from the caller's side they were dropped, just loudly. Fix: bounded retry, recompute seq and line each attempt; correct the comment.
4. Test honesty: the compare-and-swap was untested. Deleting the old-tip argument from `update-ref` left the whole suite green. Fix: a stale-tip test.
5. Test honesty: the session sanitizer was untested. Removing it left the suite green — the one test case (`../escape`) was rejected by git itself, not by the code under test. The sanitizer itself held up against a probe set (`a/b`, `.hidden`, spaces, newlines, unicode, shell metacharacters). Fix: table cases asserting the journal's own error.

MED:

6. No length cap on session ids: a 5,000-character id produced a tree no filesystem can check out. Fix: cap at 128 bytes, reject empty.
7. Generated session ids carried 32 bits; collisions merge two sessions' seq spaces in the permanent record. Fix: 16 random bytes.
8. Detached HEAD and packed refs worked but were unproven by the suite.
9. No test ran from a subdirectory — the suite was blind to finding 1.
10. `--tokens-source` defaulted to `host-report`, a provenance claim the caller never made, and the choice was recorded nowhere. Fix: default `unset`; ruled as D12.
11. Process: nothing was committed, so red-then-green could not be reconstructed. Driver note: the red commit is cut at landing time, by design — the review runs before anything lands.

LOW:

12. A comment claimed the seq read's cost does not grow with the journal; it grows linearly per write.
13. Blobs written before the compare-and-swap leave unreachable objects on failed writes; harmless, gc collects them.
14. `missing()` treats any exit 1 as "not there" — fine for its two callers, a trap for a third. Skipped on driver ruling.
15. `t.Errorf` then use of the zero value on a failed time parse; should be fatal.
16. `newBareStartRepo` made a repo that is not bare; renamed.
17. A test read `.git/index` as a path, which breaks in a linked worktree. Skipped on driver ruling.
18. Rejection tests only proved "nothing written" against an empty journal.
19. `outcome` and `tokens_source` were unbounded free text. Fix: 200-byte cap.
20. Raw git plumbing errors reached the user outside a repo. Fix: plain message.

## What held up under mutation

The temp-index isolation (dropping `GIT_INDEX_FILE` fails three tests), commit parenting, token totals, and per-session seq at the repo root are all genuinely proven. Detached HEAD, packed refs, unborn HEAD, and linked worktrees behave. No style drift beyond the two false comments.

## Builder's note at fix time

The retry makes a write safe under contention, not idempotent across processes: two identical dispatches get different seq and ts, so they are two events. The duplicate guard catches a replayed store, not a repeated dispatch. "Record this dispatch once" would need a caller-supplied id, which the ruled schema does not have. Left for the bet that first needs replays.
