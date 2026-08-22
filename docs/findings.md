# Findings

This file is the defects ledger. For each finding it records what it is, what caught it, and what happened. It is append-only.

## F1 — 2026-08-22 — The `legacy-final` tag exists only locally

What it is: the ratification sequence requires a `legacy-final` tag on origin. The session's git proxy rejects tag pushes with a 403. The `legacy` branch is on origin at that same commit, 275a2a7. The tag is not.

What caught it: the push failure during ratification.

What happened: open. The owner will push the tag from their own machine.

Resolved 2026-08-22: the owner pushed the tag. Verified on origin, pointing at 275a2a7.

Caught by: driver — the ratification push failure
Class: host-limit — a host proxy limitation, not a code defect

## F2 — 2026-08-22 — Stale counts in the ladder at ratification

What it is: the ladder's table of items to delete was headed "(17)" over 18 rows. Its coverage line said "118 of 118 items" after amendments had raised the total to 122.

What caught it: the driver's read during ratification.

What happened: fixed in the reset commit (75fbd5b).

Caught by: driver — the ratification read of the ladder
Class: record-not-written

## F3 — 2026-08-22 — Register and format defects in the first ledger drafts

What it is: the blind review of slice 0.1 found 16 defects. These were dense sentences, unexplained jargon, format drift, one ambiguous claim, and one overclaim.

What caught it: the slice's blind review.

What happened: 14 fixed before the slice landed. 2 overridden by the driver, because the review brief omitted facts the build brief carried: a named workflow file, and the exact branch pattern.

Caught by: blind-review — slice 0.1's register review
Class: register

## F4 — 2026-08-22 — Two defects in the legacy CI pin, caught in review

What it is: the pin's first draft left a bare `pull_request` trigger, so legacy's CI would still run on pull requests that target main. And legacy's release job strips a bare `v` from the tag name, so a `legacy-v*` tag would never match the package version and no release could publish.

What caught it: the slice's blind review. The reviewer flagged the second one as a suspicion; checking the job body confirmed it.

What happened: both fixed in the pin commit before it was pushed (f078a83).

Caught by: blind-review — slice 0.4's review of the CI pin diff
Class: green-but-wrong

## F5 — 2026-08-22 — A ledger commit landed on the wrong branch

What it is: the F4 entry was first committed to the local `legacy` branch. The driver's shell was still in the worktree that held legacy checked out.

What caught it: the commit output named the wrong branch.

What happened: the unpushed commit was reset away, and the entry was recommitted on the bet branch.

Caught by: driver — the commit output naming the wrong branch
Class: other — a git-discipline slip, no code involved

## F6 — 2026-08-22 — The port list needed two rounds of register review

What it is: the first draft of docs/carried-over.md had 21 register defects. The worst: evidence lines that were bare commit hashes no worker is allowed to look up, one circular evidence line, and about ten private terms used with no definition.

What caught it: the register review the execution plan requires, run in a separate session.

What happened: the port worker fixed the list and dropped two rules it could not evidence. The re-read cleared it after two one-line fixes. The file gained a glossary section the original brief did not name; the driver confirmed the addition.

Caught by: blind-review — the port list's register review
Class: register

## F7 — 2026-08-22 — The journal writer's first build had three real defects

What it is: the blind review of Bet 1 slice 1 found 20 items. Three were real defects in the writer: seq reset to 1 when the CLI ran from a subdirectory, an identical line could vanish while the CLI reported success, and concurrent writes dropped events with no retry. Two more were test-suite holes proven by mutation: the compare-and-swap and the session sanitizer were claimed but not tested — the suite stayed green with either removed.

What caught it: the slice's blind review, which ran mutation checks instead of reading for style.

What happened: all mandatory fixes were applied before the slice landed. Two low nits were skipped on driver ruling. The full review is archived at docs/evidence/bet-1/slice-1/blind-review.md.

Caught by: blind-review — slice 1's mutation review
Class: green-but-wrong
Class: unrun-proof

## F8 — 2026-08-22 — The dial and seal verbs had two real defects at review

What it is: a tag name carrying revision syntax could seal a commit the named tag does not hold — `v1~1` sealed the parent of v1. And the dial's from-chain broke on same-second writes from two sessions, falling back to alphabetical session order. Two mutation-proven test holes let the second defect through.

What caught it: the slice's blind review, through the built CLI in scratch repos.

What happened: both fixed before the slice landed, with pinning tests. The vocabulary and ordering rulings the review demanded are D13. The full review is archived at docs/evidence/bet-1/slice-2/blind-review.md.

Caught by: blind-review — slice 2's mutation review
Class: green-but-wrong
Class: unrun-proof

## F9 — 2026-08-22 — The spend query pinned a false statement about the record

What it is: a journal holding dial and seal lines but no dispatches printed "the journal is empty", and a test asserted that false message. Also: no spend test planted a line the package's own writer had not written, so the query's tolerance of foreign lines was argued, not shown.

What caught it: the slice's blind review — nine mutations and four scratch repos through the built binary.

What happened: the message split, the planted-line tests, and four rulings (D14) landed before the slice closed. The archive is docs/evidence/bet-1/slice-3/blind-review.md.

Caught by: blind-review — slice 3's mutation review
Class: green-but-wrong
Class: unrun-proof

## F10 — 2026-08-22 — The merge trusted a fetched ref it had no reason to trust

What it is: a hostile or corrupted journal commit could make the merge silently drop a local session's lines (a file where this side has a directory) or rewrite a line in place (a forged blob at an existing path) — while reporting success. And the merge's compare-and-swap, like the writer's before it (F7), was claimed but not proven: the force-update mutation left the suite green.

What caught it: the slice's blind review, building hostile commits with plumbing and driving them through the real API.

What happened: the merge now refuses any union in which a local entry does not survive unchanged, with the path named (D15). The concurrency race became a committed test. The unrun-proof recurrence this completes is ruled on in D16. Archive: docs/evidence/bet-1/slice-4/blind-review.md.

Caught by: blind-review — slice 4's hostile-commit review
Class: green-but-wrong
Class: unrun-proof

## F11 — 2026-08-22 — The first bounce: a verifier that could pass on nothing

What it is: the token cross-check could print ok and exit 0 in three ways that meant nothing was verified — a wrapped subtraction accepted any figure against the minimum int64, an empty or key-less sidecar passed with checked 0, and a post-merge seq collision was silently resolved by blob order.

What caught it: the slice's blind review, aimed where the builder's own D16 mutations would not reach — adversarial sidecar shapes and post-merge journal shapes.

What happened: the review returned bounce, the first of the rebuild. Two rulings (D17) resolved what a collision means and whether checked 0 may pass. The rework landed with new mutations named per claim. Archive: docs/evidence/bet-1/slice-5/blind-review.md.

Caught by: blind-review — slice 5's adversarial review, the first bounce
Class: green-but-wrong
Class: unrun-proof

## F12 — 2026-08-22 — The journal ref cannot reach origin from this session

What it is: the per-slice backup push must carry the journal ref (D11), but the host's git proxy rejects pushes to refs outside refs/heads — the same limitation that blocked the legacy-final tag (F1). The journal existed on one machine only.

What caught it: the driver's failed push during the live cross-check, and slice 6's blind review naming the gap at bet close.

What happened: the journal now backs up to the branch groundwork-journal, which the proxy allows. Any clone can restore the real ref from it with one update-ref. The driver records the mechanism as D20.

Caught by: driver — the failed push during the live cross-check
Class: host-limit — a host proxy limitation, the same as F1

## F13 — 2026-08-22 — The spec requires a hash-chained journal that no bet builds

What it is: proof.md requires a hash-chained journal, signed seal tags, and verify checking chain continuity. No build item carries it, no bet owns it, and bet 1 shipped the journal without a chain.

What caught it: the bet 2 design read, checking the spec against the ladder's coverage.

What happened: open — the chain work joins bet 3 with the seal machinery, by driver ruling in D26. The coverage gap itself is the finding: a ratified requirement had no owner, and the coverage check counted commitments, not requirements.

Caught by: worker — the bet 2 design dispatch, reading proof.md against the ladder
Class: coverage-gap

## F14 — 2026-08-22 — The spec's web profile has no probe list

What it is: proof.md names six topology profiles and lists universal probes for five of them. The web profile has no probe bullet. A web project's battery would have no ruled floor to stand on.

What caught it: the slice 2 builder, reading the profile list out of the spec.

What happened: open. The gap costs nothing until a web project exists; the bet that first serves one inherits it. Recorded so the spec's silence reads as known, not missed.

Caught by: worker — the slice 2 build, reading proof.md's profile table
Class: coverage-gap

## F15 — 2026-08-22 — The second bounce: the seam's two headline promises were fail-open

What it is: a capability was proven by any test file that existed — empty, unparseable, or never-built. A mutator that damaged nothing passed conformance. And discover and run agreed on one name out of seven across hostile shapes, with nothing reconciling them. All three passed the builder's own tables, which probed JSON shapes while these were filesystem and semantics shapes.

What caught it: the slice's blind review, running probes through the real row and the real conformance reporter.

What happened: bounce, the second of the rebuild. The discover-semantics silence went to the driver and came back as D30. The rework closes the fail-open set first. Archive: docs/evidence/bet-2/slice-2/blind-review.md.

Caught by: blind-review — slice 2's adversarial review of the seam
Class: green-but-wrong
Class: coverage-gap

## F16 — 2026-08-22 — A ledger test pinned a moving value

What it is: bet 1's findings tooling shipped a test asserting the live ledger's exact class counts — green-but-wrong at six. The ledger is append-only and the counts grow, so the test breaks on every new finding of a pinned class. It asserted the record's current state, not an invariant.

What caught it: slice 2's rework, when appending F15 broke the test from a package the slice never touched.

What happened: fixed as its own change, per the working agreement's rule for wrong tests. The test now asserts the invariant — every class at or over the threshold has a decision heading answering it — and floors, not exact counts.

Caught by: worker — the slice 2 rework, tripping over the pinned counts
Class: unrun-proof — the test proved the ledger's shape at one moment, not the property it claimed
