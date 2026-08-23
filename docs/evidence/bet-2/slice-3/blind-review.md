# Blind review — Bet 2, slice 3: the three scans

Reviewer: a fresh session, no contact with the builder. Method: independent digest recomputation, a module-wide grep of the dead-API cleanup, a replay of the wiring row against a materialised pre-slice tree, three re-run mutations, and about thirty fixture probes. Verdict: **bounce**, the third of the rebuild; reworked. Date: 2026-08-22.

## Findings

MAJOR — the false-red set, in the slice whose done condition is no false reds:

1. The wiring scan walked only the declared surfaces for references, so a caller in tools/ outside the surface root left a function "dead" — and the evidence sentence claimed no file in the module names it, which was false. Fixed: references sweep from the module root; candidates stay inside surfaces.
2. A same-file harness holding the test's own t read as asserting nothing, against the row's own header promise. Fixed: an escaping handle marks the test unknown, never red.
3. The token scan reported green after reading zero files — the D17 class, guarded in both sibling rows and missed here. Fixed: unrunnable with the reason.
4. Issue references like #404 and non-colour hex like #deadbeef read as raw colours. Fixed: colour context required; residue documented.

MED:

5. The skip-first rule fell to `t.Parallel(); t.Skip()` — now any unconditional top-level skip fires.
6. Any X.Error() call counted as an assertion; ruled in D32 as an accepted, stated false-negative this bet.
7. Panic-as-assertion read as "cannot fail"; ruled honest in D32 — panics and Must calls are failure paths.
8. Unrunnable evidence leaked absolute paths and broke the journal cap; rendered relative, reason-only.
9. F17 miscounted its own cleanup (four deleted, three unexported) and missed an eighth test-only export surviving on a shared name; the entry now says so.
10. The slice's defaults were unrecorded; D32 holds them.

LOW: a one-hit evidence line could still cut mid-word (count-only fallback added); a found red was thrown away by a later surface's unrunnable (precedence fixed); the token green sentence overclaimed (now says hex); the linkname blind spot contradicted a "never invents" claim (softened); one stale citation and four stale identifier mentions in comments.

## What held up

The digest recomputed independently to the committed value, and 1.0→2.0 honours D23. The seven removals were proven safe by module-wide grep and a pre-slice replay confirming F17's count. No test was weakened — the adaptations were checked against their pre-slice intent, and one got stronger. Contract cases all held: defers, two-file helper chains, testify, table-driven helpers, build-tagged callers, struct-field references, name collisions — green; another package's test-only caller — red with a fair message. The reviewer's own verify run journaled itself: six lines on the ref, from the review, exactly as the record should show.
