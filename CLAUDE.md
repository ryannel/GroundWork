# Working agreement

This page is the whole process for building this repo — until we build the real machinery. It is temporary. It should shrink over time, not grow. If a rule here is missing or wrong, that is a defect like any other. Write it in `docs/findings.md`. Let the fix earn its place.

## Where truth lives

Five files hold the truth about this project. All live in git.

- `docs/spec/` — what to build.
- `docs/ladder.md` — what to build next, and what "done" means for it.
- `docs/execution-plan.md` — how we deliver, including how we prove judgment work.
- `docs/carried-over.md` — what was worth keeping from the legacy branch.
- `docs/findings.md` and `docs/decisions.md` — the ledgers. More on these below.

Chat is not on this list. If a decision matters tomorrow, put it in a file today. Otherwise it is gone.

## Never look behind the legacy tag

The old GroundWork lives in this same repo, behind the `legacy-final` tag and on the `legacy` branch. It is not a reference. Do not read it. Do not check it out. Do not install its package. This rebuild exists to replace its prose, and reading that old prose will change how you write.

Everything worth keeping from the old repo is already in `docs/carried-over.md`. Read that file instead.

This rule is about prose, because prose is what changes your register — your writing tone and style. Mechanical facts do not carry that risk: a file path, a lint config, a CI workflow.

A bet may pull one of those out when it needs it. But never mid-slice, and never by the agent doing the slice. Pulling something out is always its own dispatch: one job, reviewed before it lands.

If you think you need something from behind the tag, write a finding instead of going to get it.

## A slice

A slice is one coherent change, small enough for a reviewer to judge in a single sitting. If it does not fit in one sitting, split it. One slice equals one commit.

A slice is done when three things are true: its tests pass, a reviewer has read it, and any findings from that review are written down.

## Briefs carry the work, not directions to it

When you dispatch a worker, copy what it needs straight into the brief. Name where that text came from. Do not just send a list of files for the worker to go read.

If you send a worker to a page instead, it has to load the whole page to find the one paragraph that applies. That wastes context. It is worse for the record too: the record then shows "see the spec" instead of the real instruction. So send the extract, and name the source.

Sometimes you cannot predict what the worker will need. Only then is a bare pointer the right call — and even then, it should carry one line saying what it points to.

## Tests first, and red

Write the test before you write the code. Commit the test while it still fails. A test written after the code tends to just assert whatever the code already does. Tests live beside the code they prove — this is Go's default layout — and `go test ./...` runs them.

Most of this rebuild is ordinary code, and ordinary code gets ordinary tests.

Judgment work is different — whether a piece of prose steers an agent well, or whether a walk reads well. (A walk is the step-by-step design review a change goes through before it is built.) That kind of work is proved in three layers:

1. Observable events.
2. A rubric — a scored checklist — proven to catch real failures.
3. A human seal: a person's sign-off, recorded as a tag.

`docs/execution-plan.md` has the detail.

Never delete or weaken a test to make a slice pass. If a test is wrong, say so in `findings.md`, and fix the test as its own separate change.

## Review is blind

The agent that wrote a slice never reviews it. Dispatch a fresh reviewer instead. Give it only the diff and the slice's brief — nothing else from the building session. Ask it to find what is wrong, not to confirm what is right.

Every finding goes in the ledger. A slice cannot close while a finding on it is still open.

## Committing

One commit per slice. Each bet runs on its own branch. Push after every slice, so no work exists on only one machine. Push tags too, not just commits. Some of those tags are seals — a person's sign-off, recorded as a tag — and a seal that exists on only one machine is not yet proof of anything.

Each commit message ends with trailers: structured lines that state what the commit was.

```
Bet: <bet name>
Tests: <what proves it>
```

## Ledgers

`docs/findings.md` holds defects. For each one, record what it is, what caught it, and what happened to it. `docs/decisions.md` holds rulings: what was decided, and why. Add to both the moment the thing happens — not later.

Both files are append-only. That means two branches will sometimes conflict on them. When that happens, keep both entries. Never drop one just to make the merge clean.

## Write plainly

Write short sentences. Cover one idea per sentence. Use everyday words. This applies to every file, commit message, and report in this repo.

The reason is mechanical: agents copy the style of what they read. Dense prose here produces even denser prose next time — that is how the old corpus grew so large. If a sentence needs a second reading, rewrite it.

Reading anything long or dense will make your own writing drift toward that style. So after you do, have a fresh agent read what you wrote before it lands.

## Stop and ask the driver

Stop and ask the driver — the person or lead agent directing this work — when:

- The spec is wrong, unclear, or silent on something you need.
- The change would be hard to undo. Deleting data, rewriting history, and publishing are examples, not the whole list.
- You are stuck and about to guess.

For everything else, keep going: take the sensible option, and write it in `docs/decisions.md`. A recorded decision can be reversed later. A question stops the work — so ask only when you must.
