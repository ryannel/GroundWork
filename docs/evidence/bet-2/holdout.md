# The held-out set

Bet 2's done condition is graded against two repos the battery was never tuned on. D26 rules the discipline; D27 rules where they live. This file is the record D26 names.

## The repos

- `holdout-go-fieldkit` — a Go repo, authored by a separate dispatch that never saw the battery code. Branch tip at sealing: 93801c2.
- `holdout-ts-tallysheet` — a TypeScript repo, same discipline. Branch tip at sealing: 8d1790f.

Both live as branches on origin, because the host proxy refuses tag pushes (F1, F12's host-limit). The answer-key commit is the tip of each branch, named "Add the sealed capability answer key", holding ANSWER-KEY.json.

## The rules

- The answer keys are sealed. No battery builder reads them, and the driver does not read them either. Only the slice 7 grading dispatch opens them, after the verify runs are recorded.
- A run burns the repo. Once verify has been run against a holdout repo and graded, any later tuning of the battery bumps the major version and needs a fresh holdout — D26.
- magpie and staycurrent are reachable and serve the no-false-reds direction only.

## The grading record

Written by the slice 7 grading dispatch. Empty until then.
