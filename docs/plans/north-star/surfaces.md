# Part 5: The Queue and the Map

## One data model, two views, honest sources

Plans are authored and sealed: programs, ladders, intents. State is derived from git: commits, tags, trailers, test naming. The Map renders both and labels which is which. Nothing self-reported enters either view. An agent's assertion of done is not state. A green probe is.

**State is read from git, never from the checkout.** Plans and state live across branches, worktrees, and the archive, so the renderer reads git refs directly — committed files on any branch, tags, trailers — without needing any branch checked out. Whatever you happen to be on, the whole picture is available. Working-tree content appears only as "in flight as of <time>" annotations, labeled as such. Pages also stamp their sync horizon — how far the local clones sit behind or ahead of their remotes — so a laptop's tower never quietly presents local-only truth as the whole picture.

## The derivation contract

The Map and Queue are parsers. What they parse is a kept, explicit contract of about two pages plus templates: the field shapes of a bet's planning files (the per-milestone and per-slice files that name each proof), commit trailers (`Lane:`, `Tests:`, `Visual:`, `Notes:`), test naming including each proof's bet and slice marker, the write-the-failing-test-first sequence, and the seal-tag ceremony. Every kept parser names its write contract. Read and write ship together. Keeping a parser while deleting the prose that makes agents produce what it parses is how surfaces go dead.

History shape is part of the contract. A bet closes with a merge commit, never a squash — a squash collapses every slice into one trailer-less commit and erases the record — and a check enforces it. Backup pushes carry tags as well as branches. At archive, the bet's final board and capsule index are committed as files, so the frozen view survives the teardown that deletes the branch refs it was derived from.

## The registry and the tower

Every `init` and `update` registers the project's path in `~/.groundwork/registry.json`. The registry is what makes the cross-project view possible. A registered repo that has moved or vanished renders as a flagged row, never a crash. Registration carries a visibility flag — registered, local-only, or excluded — chosen at init and honored by the tower, the method queue, and dev mode, so an NDA-bound project can use everything and appear nowhere.

The Queue and the Map are served by **the tower**: one small, always-on, read-only local service covering every registered project. It starts at login and is managed by the CLI — its health is one command away, and so is a restart. One stable local address, one bookmark, for everything. That concentration is treated as the attack surface it is: the tower binds to the loopback interface only, requires a per-install token, and checks request origins; it renders markdown sanitized with scripts stripped, and projects are isolated from each other's pages. It reads each repo's state from git as above, so there is no per-project server and no repo needs its checkout in any particular position. It also renders each repo's committed docs, so drilling from a bet row into its pitch and design docs needs no other server either.

Why this shape: the old model required being on the right branch, hand-starting a per-project docs server, and navigating to the right page — so the planning record, the thing that should be front and center, was effectively invisible. Each coupling is removed by construction: reading decoupled from the checkout (git refs), serving decoupled from the project (one tower), surfacing decoupled from agent discipline (the hooks below).

## The Queue

What needs you now — across every project. The tower's Queue is the portfolio view: every item waiting on you from every registered repo, ranked. Ranking is computed from lane, diff size, probe coverage of touched paths, age, and a small human-sealed critical-paths list. Never an agent-asserted risk score. Each entry is a two-minute capsule with three outcomes: accept, bounce with a reason, escalate. The tower only renders the Queue; the outcomes are enacted by the CLI — accept, bounce, and escalate are verbs that write the ledgers and move the tags, and each page links its verb. Bounce reasons persist in the findings ledger and feed the standards.

## The Map

Where everything stands: portfolio → program → bet → milestone → slice, with drill-down at each level. Every project is a row. Every parallel worktree and branch sits on one page, with position and last-activity age, so stalled lines are loud. Unstarted work is visible because the sealed program artifact names it. A bet's page is its board: every sealed proof red or green from the battery's last recorded run, stamped with that run's time ([proof.md](proof.md)). And each project's known gaps stay visible: deferred findings render there until closed or promoted into a bet — deferral is a decision, not a disposal.

Delivered work keeps its rendered view forever. Completed bets are exactly what you survey later. Each lane declares its decision budget — the number of human decisions work in that lane is expected to cost — and the Map reports actuals against it. Acceptance debt renders loudly. So does teaching debt: the count of decisions made for you that no teach-back has walked you through ([loop.md](loop.md)). So do the two bypass signals: unlaned work (commits with no lane trailer) and repeat-waived checks (a check overridden again and again is a broken check nobody has fixed).

The tower also renders a method-health page, read from the journals ([loop.md](loop.md)) across every registered project: per-mechanism catch and fire counts, waiver repeats, escalation rates, decision-budget actuals, and token spend by role — the priciest parts of the loop are a sorted column, not a forensic project. The question this whole spec needed forensics to answer — which parts earn their keep — becomes a page.

## Dev mode — the method watches itself

For maintainers of the method only: a flag in the registry, off by default. Consumer projects never see it. It exists because method defects kept surfacing inside consumer projects and reaching the framework repo only by forensics — magpie's own notes documented a gate's false-reds for weeks before anyone fixed the gate.

- **Observations are journal events, nothing heavier.** The mechanical triggers cost zero because the journal already records them: a repeat-waived check, a defect class recurring against a framework-owned generator, a battery row that never fires, an escalation resolved as "the skill prose was wrong." The one judgment trigger: when the driver had to *work around* the method, it writes a one-line method-friction event, class-tagged. There is no meta-review dispatch and no per-slice critique of the framework — delivery gains one optional line, nothing else.
- **The tower routes, because the method is a registered project like any other.** Method-classed signals from every project cluster on the method-health page into the **method queue**, deduplicated by class and mechanism — ten occurrences are one cluster with a count, not ten items.
- **Formalization is an issue, never a PR.** A cluster files as one GitHub issue in the framework repo, carrying its evidence: the journal lines, the project and session ids, the counts. Filing always redacts first — paths become project aliases, journal excerpts are minimized, debug-captured content never leaves the machine — and the maintainer sees the exact issue body before it ships. Auto-file exists only for the framework repo itself; evidence from any other project is never published unattended. An existing issue is updated, never re-filed. Method changes themselves run through the method's own loop in the framework repo, with their own proof plans and adversary; dev mode supplies evidence, it does not write changes. Host conveniences (suggested-task chips in the framework workspace) are adapters over the method queue, never the record.

## Surfacing

The position comes to you; you never go get it.

- **The checkpoint hook** emits a three-line delta and a deep link to the exact page. Mechanical, not an instruction competing for kernel space. Links always resolve because the tower is always up; if the daemon is down, `groundwork where` renders the same derivation in any terminal, and the planning files and ledgers remain readable in the repo — the fallback is the CLI, never a dead end.
- **The session-start hook**: opening a session in any registered repo injects a two-line position snapshot — which bet, which milestone, what is in flight in which worktree, what waits on you. When work landed since you last looked, the snapshot ends by offering the teach-back ([loop.md](loop.md)). Injected by the host hook, not by agent goodwill: chat instructions decay; hooks do not. (Hook installation is the host adapter's job — [index.md](index.md).)
- **CLI parity**: `groundwork where` prints the portfolio in any terminal, and inside a repo prints the position snapshot. Same derivation, third rendering.
- Committed pages stamp their commit. In-flight pages stamp "working tree as of <time>."
- An ambient menubar layer is optional and deliberately undecided — but native notification of genuine stops is required at dial `bet` and above ([loop.md](loop.md)): an unattended run must be able to reach you when it stops. Hook firings are journal events, and a registered repo whose hooks have gone silent across recent sessions is flagged by `verify` and the tower — a dead hook must not quietly return the system to the old invisible model.
