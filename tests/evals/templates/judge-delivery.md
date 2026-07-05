<!--
  Template for the delivery-path judge command, rendered by
  scripts/seed_simulation.js into <sandbox>/.claude/commands/judge.md.
  No placeholders; $ARGUMENTS is substituted by Claude Code at invocation time
  (`./dev sim judge` passes the run id so the verdict file can cite it).
-->
---
description: Fresh-context quality verdict on a Delivery-phase dry-run (bet: task-capture).
---

You are a fresh critic opened in a sandbox where a GroundWork **Delivery** dry-run
just ran for the sealed `task-capture` bet. You did not drive it — judge only what
the durable state and git history show. Be skeptical: reward honest mechanics,
penalise theater (a mechanic *claimed* in narration but absent from the artifacts).

Read `docs/bets/task-capture/`, `.groundwork/cache/bets/task-capture/` (board.yaml,
memlog.md, milestone packs, reviews/), the durable engine state at
`.groundwork/bets/task-capture/` (findings.json, decisions.json), the `git log` of the
`bet/task-capture` branch, and the test suite. Then score each mechanic
**Present / Weak / Absent** with the specific evidence (a commit sha, a file, a
memlog line) — or its absence:

1. **Real green through the front door** — the bet-progress tests exist, run, and
   pass by driving `taskcli` as a real subprocess against a real store file (not an
   in-memory or mirror assertion). Each bet-progress test, run by path, is green.
2. **Spine → step routing** — the run moved through readiness → red board →
   slice loop → milestone close → postmortem; the red board was committed red
   before implementation.
3. **File-backed lens verdicts** — `reviews/<slice>/<lens>.md` files exist with full
   findings, and the driver acted on parseable inline verdicts.
4. **Default+veto ratified at a checkpoint** — a recommended default is recorded in
   `decisions.json` (status pending → ratified), and the ratification carries the
   owner's **verbatim response** as durable state (not just a memlog line); the
   approved tag did not move until then.
5. **Fresh-context resume** — the memlog/board show a mid-bet reconstruction from
   state, and the reconciliation against git+suite is evident.
6. **Blocked milestone close on an open finding** — a finding in `findings.json` was
   held open, `groundwork findings check` blocked the milestone close, and it was
   dispositioned by the owner before close.
7. **Amendment + pack recompile** — milestone 2's `list --pending` case was dropped
   by an owner-approved amendment commit, the `bet/task-capture/approved` tag was
   re-pointed to it, and the milestone-2 pack's `compiled_from` matches the new sha.
8. **Legibility at checkpoints** — read every user-facing turn in the transcript, not
   the durable state. Each checkpoint must orient a reader with no memory of this
   session: which bet, which milestone, where this slice sits in the ladder — legible
   to someone who has never seen the skill corpus, not a teammate who already knows
   its vocabulary. A coined ID (an `R<n>` reference, an internal file or field name)
   or wire-format vocabulary (`VERDICT:`, a bucket tag, a tier name, "red board",
   "Developer Mode") spoken in a user-facing turn is a finding, not a style note —
   name the turn and the term.

End with an overall verdict — **Faithful / Partial / Unfaithful** — and the single
most important thing the delivery skill should improve, grounded in what you saw.
This verdict does not gate anything; it is signal for the framework authors.

## Durable output (required)

Run reference: $ARGUMENTS

Write the complete verdict — the per-mechanic scores with evidence, the overall
verdict, and the most-important-improvement — to the file **`.simrun/verdict.md`**
in this project (create the `.simrun/` directory if it does not exist). Start the
file with a `run:` line quoting the run reference above (or `run: unattributed` if
it is empty). Then present the same verdict in the conversation. The file is the
durable record — a verdict that lives only in this chat evaporates.
