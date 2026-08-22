# Findings

This file is the defects ledger. For each finding it records what it is, what caught it, and what happened. It is append-only.

## F1 — 2026-08-22 — The `legacy-final` tag exists only locally

What it is: the ratification sequence requires a `legacy-final` tag on origin. The session's git proxy rejects tag pushes with a 403. The `legacy` branch is on origin at that same commit, 275a2a7. The tag is not.

What caught it: the push failure during ratification.

What happened: open. The owner will push the tag from their own machine.

## F2 — 2026-08-22 — Stale counts in the ladder at ratification

What it is: the ladder's table of items to delete was headed "(17)" over 18 rows. Its coverage line said "118 of 118 items" after amendments had raised the total to 122.

What caught it: the driver's read during ratification.

What happened: fixed in the reset commit (75fbd5b).

## F3 — 2026-08-22 — Register and format defects in the first ledger drafts

What it is: the blind review of slice 0.1 found 16 defects. These were dense sentences, unexplained jargon, format drift, one ambiguous claim, and one overclaim.

What caught it: the slice's blind review.

What happened: 14 fixed before the slice landed. 2 overridden by the driver, because the review brief omitted facts the build brief carried: a named workflow file, and the exact branch pattern.

## F4 — 2026-08-22 — Two defects in the legacy CI pin, caught in review

What it is: the pin's first draft left a bare `pull_request` trigger, so legacy's CI would still run on pull requests that target main. And legacy's release job strips a bare `v` from the tag name, so a `legacy-v*` tag would never match the package version and no release could publish.

What caught it: the slice's blind review. The reviewer flagged the second one as a suspicion; checking the job body confirmed it.

What happened: both fixed in the pin commit before it was pushed (f078a83).

## F5 — 2026-08-22 — A ledger commit landed on the wrong branch

What it is: the F4 entry was first committed to the local `legacy` branch. The driver's shell was still in the worktree that held legacy checked out.

What caught it: the commit output named the wrong branch.

What happened: the unpushed commit was reset away, and the entry was recommitted on the bet branch.

## F6 — 2026-08-22 — The port list needed two rounds of register review

What it is: the first draft of docs/carried-over.md had 21 register defects. The worst: evidence lines that were bare commit hashes no worker is allowed to look up, one circular evidence line, and about ten private terms used with no definition.

What caught it: the register review the execution plan requires, run in a separate session.

What happened: the port worker fixed the list and dropped two rules it could not evidence. The re-read cleared it after two one-line fixes. The file gained a glossary section the original brief did not name; the driver confirmed the addition.
