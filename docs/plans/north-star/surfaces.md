# Part 5: The Queue and the Map

## One data model, two views, honest sources

Plans are authored and sealed: programs, ladders, intents. State is derived from git: commits, tags, trailers, test naming. The Map renders both and labels which is which. Nothing self-reported enters either view. An agent's assertion of done is not state. A green probe is.

## The derivation contract

The Map and Queue are parsers. What they parse is a kept, explicit contract of about two pages plus templates: the field shapes of a bet's planning files (the per-milestone and per-slice files that name each proof), commit trailers (`Lane:`, `Tests:`, `Visual:`, `Notes:`), test naming, the write-the-failing-test-first sequence, and the seal-tag ceremony. Every kept parser names its write contract. Read and write ship together. Keeping a parser while deleting the prose that makes agents produce what it parses is how surfaces go dead.

## The Queue

What needs you now. Ranking is computed from lane, diff size, probe coverage of touched paths, age, and a small human-sealed critical-paths list. Never an agent-asserted risk score. Each entry is a two-minute capsule with three outcomes: accept, bounce with a reason, escalate. Bounce reasons persist in the findings ledger and feed the standards.

## The Map

Where everything stands: program → bet → milestone → slice, with drill-down at each level. Every parallel worktree and branch sits on one page, with position and last-activity age, so stalled lines are loud. Unstarted work is visible because the sealed program artifact names it.

Delivered work keeps its rendered view forever. Completed bets are exactly what you survey later. Each lane declares its decision budget — the number of human decisions work in that lane is expected to cost — and the Map reports actuals against it. Acceptance debt renders loudly. So do the two bypass signals: unlaned work (commits with no lane trailer) and repeat-waived checks (a check overridden again and again is a broken check nobody has fixed).

## Surfacing

A host-side checkpoint hook emits a three-line delta and a deep link to the exact page. This is mechanical, not an instruction competing for kernel space. A link resolves when the site is up and degrades to rendered markdown in chat when it isn't. Committed pages stamp their commit. In-flight pages stamp "working tree as of <time>."
