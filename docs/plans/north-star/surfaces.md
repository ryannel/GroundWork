# Part 5: The Queue and the Map

## One data model, two views, honest sources

Plans are authored and sealed: programs, ladders, intents. State is derived from git: commits, tags, trailers, test naming. The Map renders both and labels which is which. Nothing self-reported enters either view. An agent's assertion of done is not state. A green probe is.

**State is read from git, never from the checkout.** Plans and state live across branches, worktrees, and the archive, so the renderer reads git refs directly — committed files on any branch, tags, trailers — without needing any branch checked out. Whatever you happen to be on, the whole picture is available. Working-tree content appears only as "in flight as of <time>" annotations, labeled as such.

## The derivation contract

The Map and Queue are parsers. What they parse is a kept, explicit contract of about two pages plus templates: the field shapes of a bet's planning files (the per-milestone and per-slice files that name each proof), commit trailers (`Lane:`, `Tests:`, `Visual:`, `Notes:`), test naming including each proof's bet and slice marker, the write-the-failing-test-first sequence, and the seal-tag ceremony. Every kept parser names its write contract. Read and write ship together. Keeping a parser while deleting the prose that makes agents produce what it parses is how surfaces go dead.

## The registry and the tower

Every `init` and `update` registers the project's path in `~/.groundwork/registry.json`. The registry is what makes the cross-project view possible. A registered repo that has moved or vanished renders as a flagged row, never a crash.

The Queue and the Map are served by **the tower**: one small, always-on, read-only local service covering every registered project. It starts at login and is managed by the CLI — its health is one command away, and so is a restart. One stable local address, one bookmark, for everything. It reads each repo's state from git as above, so there is no per-project server and no repo needs its checkout in any particular position. It also renders each repo's committed docs, so drilling from a bet row into its pitch and design docs needs no other server either.

Why this shape: the old model required being on the right branch, hand-starting a per-project docs server, and navigating to the right page — so the planning record, the thing that should be front and center, was effectively invisible. Each coupling is removed by construction: reading decoupled from the checkout (git refs), serving decoupled from the project (one tower), surfacing decoupled from agent discipline (the hooks below).

## The Queue

What needs you now — across every project. The tower's Queue is the portfolio view: every item waiting on you from every registered repo, ranked. Ranking is computed from lane, diff size, probe coverage of touched paths, age, and a small human-sealed critical-paths list. Never an agent-asserted risk score. Each entry is a two-minute capsule with three outcomes: accept, bounce with a reason, escalate. Bounce reasons persist in the findings ledger and feed the standards.

## The Map

Where everything stands: portfolio → program → bet → milestone → slice, with drill-down at each level. Every project is a row. Every parallel worktree and branch sits on one page, with position and last-activity age, so stalled lines are loud. Unstarted work is visible because the sealed program artifact names it. A bet's page is its board: every sealed proof red or green from the battery's last recorded run, stamped with that run's time ([proof.md](proof.md)). And each project's known gaps stay visible: deferred findings render there until closed or promoted into a bet — deferral is a decision, not a disposal.

Delivered work keeps its rendered view forever. Completed bets are exactly what you survey later. Each lane declares its decision budget — the number of human decisions work in that lane is expected to cost — and the Map reports actuals against it. Acceptance debt renders loudly. So do the two bypass signals: unlaned work (commits with no lane trailer) and repeat-waived checks (a check overridden again and again is a broken check nobody has fixed).

The tower also renders a method-health page, read from the journals ([loop.md](loop.md)) across every registered project: per-mechanism catch and fire counts, waiver repeats, escalation rates, decision-budget actuals. The question this whole spec needed forensics to answer — which parts earn their keep — becomes a page.

## Surfacing

The position comes to you; you never go get it.

- **The checkpoint hook** emits a three-line delta and a deep link to the exact page. Mechanical, not an instruction competing for kernel space. Links always resolve because the tower is always up; if the daemon is down, the same pages exist as committed markdown, so the fallback is a file path, never a dead end.
- **The session-start hook**: opening a session in any registered repo injects a two-line position snapshot — which bet, which milestone, what is in flight in which worktree, what waits on you. Injected by the host hook, not by agent goodwill: chat instructions decay; hooks do not.
- **CLI parity**: `groundwork where` prints the portfolio in any terminal, and inside a repo prints the position snapshot. Same derivation, third rendering.
- Committed pages stamp their commit. In-flight pages stamp "working tree as of <time>."
- An ambient layer — a menubar count of waiting-on-you items, native notifications on genuine stops — is optional and deliberately undecided; the tower and hooks stand without it ([changes.md](changes.md)).
