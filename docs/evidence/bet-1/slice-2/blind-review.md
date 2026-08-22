# Blind review — Bet 1, slice 2: the dial and seal verbs

Reviewer: a fresh session, no contact with the builder. Method: diff read, then mutation checks and scratch-repo experiments through the built CLI. Verdict: **lands after fixes**. Date: 2026-08-22.

## Findings

HIGH:

1. Revision syntax in a tag name defeated the seal's invariant. `--tag 'v1~1'` sealed the parent of the commit `v1` points at — no tag of that name exists, and rev-parse applied the `~` suffix anyway. Fix: verify the literal ref exists before peeling; test `v1~1` and `v1^`.
2. The from-chain picked the wrong dial when two sessions wrote in the same second. Timestamps were second-granularity, and seq is per-session, so a cross-session tie fell to whichever session id sorts first. Deterministically reproduced. Fix: nanosecond timestamps; the residual tie ruled in D13.

MED:

3. The dial chain is repo-global and branch-blind, and nothing ruled that. Demonstrated across branches. Ruled in D13: global by design; the merge slice must state the replay consequence.
4. The retry was not required to recompute `from` — mutation-proven: caching a stale rung left the suite green, because the concurrency test gave every writer its own scope. Fix: one shared scope, assert the chain.
5. Ordering by ts was untested — mutation-proven: seq-only ordering passed, because every test dial landed inside one second. Fix: a cross-second case.
6. No ruling recorded for the slice's new closed vocabularies and ordering. Fixed as D13.
7. The tests pinned `moved` as an invalid seal action, but the spec names a seal being moved. Ruled in D13: revoked-then-granted until the amendment protocol lands.

LOW:

8. The `kind != dial` guard was untested; a decoy test added.
9. Two comments overstated the ordering; rewritten to say what actually happens.
10. `rungOf` lacked a cost comment; it reads every event on every dial.
11. `WriteSeal`'s early repo check was unexplained; the per-kind error-precedence difference is accepted and now stated.
12. A help string read wrong; fixed.
13. The dial concurrency test asserted less than its dispatch twin; matched.
14. Vocabulary accessors were asymmetric. Settled: one exported accessor per closed vocabulary — `Roles()` and `Tiers()` added — and every closed-vocabulary flag names its list in the help.

## What held up under mutation

Slice 1's behavior is fully protected — both test files are pure appends, and the shared write path stays pinned: dropping the duplicate guard, the `refs/tags/` prefix, the scope filter, the seq tie-break, or the slice floor each fails a named test. Nothing-written-on-rejection is pinned against a non-empty journal for both new kinds. Annotated, lightweight, and nested tags resolve correctly; tags on blobs and trees refuse correctly.
