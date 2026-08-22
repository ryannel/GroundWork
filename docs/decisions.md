# Decisions

This file is the decisions ledger. It holds rulings: what was decided, and why. It is append-only.

## D1 — 2026-08-22 — Toolchain and repo shape

Decided 2026-08-08. Recorded 2026-08-22.

The rebuild is Go. It ships as a single binary. There is one repository, not two. Main was blanked by a single reset commit.

Why: the tool runs all the time. A single binary means nothing else has to be installed to run it. Consumer repos get the framework without Node. One source tree builds for every platform. So we can pick a platform later.

The execution plan carries this. It was ratified in PR #31.

## D2 — 2026-08-22 — Ratification executed

PR #31 merged as 275a2a7. The `legacy` branch was cut at that commit. The reset commit is 75fbd5b.

The driver flipped the Status headers of the ladder and the execution plan to ratified. The driver also fixed two stale counts in the ladder. See F2.

Why: the record of the act belongs in the ledger it created.

## D3 — 2026-08-22 — Module path

The Go module is `github.com/ryannel/groundwork`.

Why: it matches the repo address. It is lowercase, by Go convention.

## D4 — 2026-08-22 — Ruling on O34

O34 asks two things: how do we sequence execution, and which repos serve as proving grounds.

Sequencing is the ladder as ratified. There is no separate sequencing artifact.

Proving grounds: wordloop and magpie calibrate the Record's doc checks. Staycurrent is the held-out third repo. Magpie is the leading candidate for first real consumer. The final call on that is deferred to Bet 15.

Why: the spec's own evidence already names these repos for these roles. Deferring the consumer call costs nothing until Bet 15.

This ruling is reversible by a later decision.

## D5 — 2026-08-22 — Bet 0's branch

Bet 0 runs on branch `claude/v2-clean-slate-tkuacl`. The host fixed that branch name for this session. It lands on main by pull request.

Future bets name their branches `bet-N-<short-name>`, when the host allows.

Why: the host fixed the branch name for this session. Fighting it buys nothing.

## D6 — 2026-08-22 — Legacy CI pin

On the `legacy` branch, ci.yml's push filter moves from `[main]` to `[legacy]`. Release tags on that branch use a `legacy-v*` prefix.

Scheduled runs of integration.yml stop on legacy, because GitHub runs schedules only from the default branch. Manual dispatch still works.

Why: legacy must keep building on its own line without firing on main, which no longer holds its code.
