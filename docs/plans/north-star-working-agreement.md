# Working agreement

*Draft. Everything above the line is stripped when bet 0's reset commit installs this as the repo's always-on instruction file. It is the exemplar: every other page in the rebuild is written to match its register, so it must stay plain and short.*

---

This is the whole process for building this repo, until we build the real machinery. It is temporary. It should shrink, not grow. A missing or wrong rule on this page is a defect like any other: write it in `docs/findings.md` and let the fix earn its place.

## Where truth lives

Five files, all in git:

- `docs/spec/` — what to build.
- `docs/ladder.md` — what to build next, and what done means for it.
- `docs/execution-plan.md` — how we deliver, including how judgment work is proved.
- `docs/carried-over.md` — what was worth keeping from the legacy branch.
- `docs/findings.md` and `docs/decisions.md` — the ledgers, below.

Chat is not on that list. A decision that matters tomorrow goes in a file today, or it is gone.

## Never look behind the legacy tag

The old GroundWork lives in this same repo — behind the `legacy-final` tag and on the `legacy` branch. It is not a reference. Do not read it, check it out, or install its package. This rebuild exists to replace its prose. Reading it changes how you write.

Everything worth keeping from it was extracted into `docs/carried-over.md`. Read that instead.

The rule is about prose, because prose is what changes your register. Mechanical facts — a file path, a lint config, a CI workflow — carry no register and may be extracted when a bet needs them. But never by you, mid-slice. Extraction is always its own dispatch, with one job, reviewed before it lands. If you think you need something from behind the tag, that is a finding, not a detour.

## A slice

One coherent change, small enough that a reviewer can judge it in a single sitting. If it does not fit, split it. One slice, one commit.

A slice is done when its tests pass, a reviewer has read it, and any findings are written down.

## Briefs carry the work, not directions to it

When you dispatch a worker, copy what it needs into the brief and name where that came from. Do not send a list of files to go read.

A worker sent to a page loads the whole thing to find the one paragraph that applies to it. That wastes context. Worse, the record then shows "see the spec" instead of the real instruction. Send the extract. Name the source.

A bare pointer is only right when you cannot predict what the worker needs. Then it carries one line saying what it points to.

## Tests first, and red

Write the test before the code, and commit it failing. A test written afterwards tends to assert whatever the code already does. Tests live beside the code they prove, as Go does by default, and `go test ./...` runs them.

Most of this rebuild is ordinary code and gets ordinary tests. Judgment work — whether prose steers an agent, whether a walk reads well — is proved differently, in three layers: observable events first, then a rubric proven to catch real failures, then a human seal. `docs/execution-plan.md` has the detail.

Never delete or weaken a test to make a slice pass. If a test is wrong, say so in `findings.md` and fix it as its own change.

## Review is blind

The agent that wrote a slice never reviews it. Dispatch a fresh reviewer with the diff and the slice's brief, and nothing else from the building session. Ask it to find what is wrong, not to confirm what is right.

Every finding goes in the ledger. A slice cannot close over an open finding.

## Committing

One slice per commit. Bets run on their own branch. Push after every slice, so no work is only on one machine. Push tags too — a seal that exists on one machine only is not a seal.

Each commit message ends with trailers that say what it was:

```
Bet: <bet name>
Tests: <what proves it>
```

## Ledgers

`docs/findings.md` holds defects: what it is, what caught it, and what happened to it. `docs/decisions.md` holds rulings: what was decided, and why. Add to them at the moment the thing happens, not later.

Both are append-only, so two branches will sometimes conflict on them. Resolve by keeping both entries. Never drop one to make a merge clean.

## Write plainly

Short sentences. One idea each. Everyday words. This applies to every file, commit message, and report in this repo.

The reason is mechanical: agents copy the style of what they read. Dense prose here produces denser prose next time, and that is how the old corpus grew. If a sentence needs reading twice, rewrite it.

After reading anything long or dense, expect your own writing to drift. Have a fresh agent read what you wrote before it lands.

## Stop and ask the driver

Stop for these:

- The spec is wrong, unclear, or silent on something you need.
- The change would be hard to undo. Deleting data, rewriting history, and publishing are examples, not the whole list.
- You are stuck and about to guess.

Everything else: take the sensible option, write it in `docs/decisions.md`, and keep going. A decision recorded can be reversed later. A question asked stops the work.
