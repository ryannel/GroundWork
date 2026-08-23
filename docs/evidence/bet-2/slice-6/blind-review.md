# Blind review — Bet 2, slice 6: waivers, drive artifacts, and the flake policy

Reviewer: a fresh session, no contact with the builder. Method: attacked the waiver machinery as a privilege system enforced by git forensics — hijack commits, forged content, clock edges, clone shapes — and timed the flake state machine on real fixtures. Verdict: **bounce**, the fifth of the rebuild; then a second bounce at the closure check; closed on the third round. Date: 2026-08-23.

## Round one findings

HIGH:

1. A committed waiver rewritten inside any feature diff still stood. The own-commit check bound to the commit that created the file, but HEAD's content governs — so a feature commit could swap the row, the reason and the expiry, renewable forever. The mutation carrying the correct rule (bind to the last commit that touched the file) survived the whole suite: no test distinguished the two. Ruled in D38: the waiver's authority is its last commit.
2. A quarantined row with long evidence killed the whole run — a 63-byte prefix on already-cap-cut evidence overflowed the journal, and the one outcome that exists so a flake cannot fail a run became a hard failure with no table, no summary, and an orphan journal line. D38 makes the bound rule general: no new journaled line without an arithmetic bound test.
3. D37's ci.yml ruling had not landed — the ruling postdated the builder's handoff. CI still fetched depth 1, where every waiver no-ops.
4. Control characters in a committed reason or file name forged rows in the printed table. Reasons and file names now get the row-id charset discipline: printable only, refused at grant and at verify.

MED: the shallow-clone refusal blamed the whole tree instead of saying the clone was shallow, and journal.Shallow had no test. The unused-waiver line shipped a blank why, and its test hand-built the struct it claimed to prove — testing its own fixture.

LOW: the waive verb printed a path unusable from a subdirectory; a flag error printed a second, untrue line; the loud block rendered as extra table rows (which is what made the forgery in H4 invisible); a stray file in the waivers directory blanked the entire run (ruled in D38: the run renders, the file is named, exit 1); the ignored-waiver naming question went to the driver (ruled in D38: the loud block satisfies it).

## Round two — the closure check

Nine of ten closed. The tenth came back through a merge: git's diff reader prints nothing for a merge commit, so when the last-touching commit was a merge, the strays check saw an empty diff and a hijacked waiver stood — row swapped, expiry renewed, run green, reachable without malice through two branches re-granting and resolving the conflict. The mutation teaching the reader merge diffs survived the suite. Ruled in D40: a merge never governs a waiver — extending D37's "a merge is not a granting act" from introduction to governance. Also found: the no-abort promise for unreadable waiver files had no test that could fail alone (every fixture leaned on an already-red row), and one comment still described the reversed behaviour.

## Round three — the final fix

A waiver whose governing commit has more than one parent is ignored, naming the merge. The clean side-branch grant stays honoured — the last toucher there is the side commit, not the merge — and a re-grant after a merge stands, so the rule does not over-refuse. The no-abort promise is pinned by a run with nothing red at all. The builder also caught its own charset test passing for the wrong reason — the rendered file name made git turn the file away as uncommitted before the charset check ever ran — and rebuilt it to assert the refusal reason.

## What held up

The forensics beyond the governing commit were strong from round one: edit-on-disk ignored (committed content governs, proven against a byte-identical semantic rewrite), staged-not-committed named as such, amend caught, expiry boundaries exact to the day at both ends, duplicates refused both ways, case tricks refused at both ends. The flake state machine held every probe across all three rounds: one flake line, one quarantined row line, seq unbroken, the rerun scoped to the disagreeing row and proven on the clock, the waiver short-circuiting the rerun proven the same way. The drove verb held every edge. Exit codes honest throughout: waived-only exits 0, quarantined never blocks alone, red always exits 1.
