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

## D7 — 2026-08-22 — Bet 0 closes

All four done conditions were checked against evidence. CI failed the on-purpose red test (run 222) and went green on its removal. Legacy's CI ran green on the legacy branch (run 220). The port list landed after register review. The ledgers hold the settled decisions.

One deviation from the ladder's wording, on purpose: the ladder expected the port list and its review to be two commits. Here the review ran before anything landed, so the list is one commit and F6 is the review's record. Stricter, not looser.

Why closing is right: a bet closes when its done conditions hold and no open question it owns remains. O34 was ruled in D4.

## D8 — 2026-08-22 — Ruling on O17: the journal's event schema

One event is one JSON object on one line. Each line is its own blob. It lives in the ref `refs/groundwork/journal`, at path `events/<session-id>/<sha256-of-the-line>.json`.

Why: appending to one shared file conflicts on every parallel branch. One path per line, named by content, lets two journals merge as a tree union. Nothing needs resolving. Replays land on the same path.

Order comes from the `ts` field, not the tree. Writes go through git plumbing. A journal write never touches the working tree.

Every line carries an envelope: `v`, `ts` (RFC3339 UTC), `kind`, `session`, `seq`, `commit` (HEAD at write time, may be empty), `branch`.

This bet has three kinds:

- `dispatch` — adds role, tier, tokens in/out/total, tokens_source, duration_ms, outcome.
- `dial` — adds from, to, scope, reason.
- `seal` — adds seal_kind, tag, target, action.

Here is one example line, for `dispatch`:

```
{"v":1,"ts":"2026-08-22T14:03:11Z","kind":"dispatch","session":"s-4f2a","seq":7,"commit":"a1b2c3d","branch":"claude/v2-clean-slate-tkuacl","role":"worker","tier":"execution","tokens":{"in":18422,"out":3110,"total":21532},"tokens_source":"host-report","duration_ms":184000,"outcome":"delivered"}
```

Two vocabularies are closed. A write outside them is rejected at write time, not warned.

Role: driver, worker, adversary, blind-author, capsule-writer, advisor, sim.

Tier: frontier, execution.

The session id comes from `GROUNDWORK_SESSION`. If that is unset, the tool generates one, and the line says so.

Later bets add kinds. The envelope does not change.

## D9 — 2026-08-22 — Ruling on O10: finding attribution and archival layout

The catcher vocabulary is closed: blind-review, battery, ci, driver, worker, owner-in-review, owner-in-use.

Every finding also carries a free detail line. That line names the specific review or check. The field is required at write time. The tool refuses an entry without it.

Why: the old world had this field optional. It was filled 0 times in 114 findings. An optional field is a field nobody fills.

Review outputs commit under `docs/evidence/<bet>/<slice>/`. They are never deleted.

This is ruled now. Slice 6 enforces it. The archive step itself belongs to later bets.

## D10 — 2026-08-22 — Ruling on O12: defect classes and the recurrence threshold

Nine classes, seeded from the evidence mining:

- green-but-wrong
- parallel-definition
- unrun-proof
- coverage-gap
- front-door-hollow
- record-not-written
- friction-waived
- register
- other

`other` needs a one-line reason. Heavy use of `other` is a sign to add a class.

Threshold: three findings of one class inside one bet, or five across two bets, forces an upstream change. That change is a rule, a check, a template, or a walk step. It gets recorded here, named from the class.

Why: in the mining, the dominant class appeared three times before anyone named it. Two is coincidence.

The count is mechanical. CI fails while a class is over threshold with no linked decision.

## D11 — 2026-08-22 — Bet 1 designed: the slice cut and small rulings

Bet 1 runs on the host-fixed branch, like bet 0. See D5.

Six slices:

1. The CLI skeleton and the dispatch writer.
2. The dial and seal verbs, plus vocabulary rejection.
3. The spend query, read from the ref alone.
4. The journal merge verb. Two branches, both lines survive.
5. The token cross-check against the host's reported usage.
6. Attribution and class tags on the findings ledger, checked in CI.

Small rulings from the design read:

Recurrence counting parses `docs/findings.md`, not the ref. The ref gains a finding kind in a later bet.

A journal line's `commit` field is HEAD at write time. It may be empty.

"Git discipline" in the ladder's Lands line means the per-slice backup push. That push carries the journal ref.

The findings backfill — adding Caught by and Class lines to F1–F6 — is a one-time format upgrade. It touches no entry's prose. Append-only is not violated.

The token cross-check includes one human step: the driver transcribes the host's reported figure. That is accepted for this bet.

Why this cut: the writer lands first because every later slice reads what it wrote. Verification of the ref's content (spend, merge, cross-check) follows the verbs that fill it. The findings check is last because it gates CI and needs the backfill.

## D12 — 2026-08-22 — tokens_source defaults to "unset"

A dispatch line's `tokens_source` says where its token figures came from. The CLI's default was `host-report`, which records a provenance claim the caller never made. That defeats the field. The default is now `unset`.

Why: a provenance field that lies by default is worse than none. The slice 1 blind review caught this.

## D13 — 2026-08-22 — Slice 2 rulings: rungs, seal actions, dial-chain scope, timestamps

Four rulings from building the dial and seal verbs.

The rung vocabulary is closed: slice, milestone, bet, program — the spec's own four, floor slice. The seal action vocabulary is closed: granted, revoked. The spec also names a seal being moved; until the amendment protocol lands in a later bet, a move is recorded as two lines — revoked, then granted.

The dial chain is repo-global and branch-blind. A scope's rung belongs to the work, not to a branch or a session, so the chain reads the whole ref. Consequence, accepted: after journals merge, replaying the chain can disagree with recorded from values. The merge slice must say this where it lands.

Timestamps are RFC3339 with nanoseconds. Ordering is ts, then seq within a session. A true same-instant tie across sessions falls to tree order — the session id that sorts first. The chain is best-effort under clock skew, and says so.

Why: the blind review proved second-granularity timestamps let an alphabetically earlier session win a from-chain race. Nanoseconds shrink the tie to practical impossibility; the residual rule makes the outcome stated instead of accidental.

## D14 — 2026-08-22 — Slice 3 rulings: what the spend query does with what it reads

Four rulings for the spend query, all from its blind review.

A line of an unknown kind is skipped, not an error. Later bets add kinds, and an old binary must keep counting what it understands.

A line the query cannot parse fails the whole report, loudly, naming the object. A spend figure that silently omitted part of the record would be worse than no figure.

Rows sort by total tokens descending, ties broken by key, alphabetically. The summary row is labelled (total) and an empty key renders (none) — parentheses sit outside the session charset, so neither can collide with real data.

Exit codes split by where a bad value is caught: a bad --by is a usage error, exit 2, caught in the CLI; a bad --role reaches the writer and is a write error, exit 1. The split is stated here so it reads as chosen, not accidental.
