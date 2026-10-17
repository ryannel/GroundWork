---
name: groundwork-review
description: Review a Groundwork plan (<workspace>/plans/<plan>/plan.yaml) and the part of the system model it rests on before a room sees it. Use when asked to review, audit, check, QA or "get ready for the session" a plan. Validates, checks that every fact the plan touches cites code and is fresh, that the plan is a true overlay (no copy of today), walks the newcomer questions and every chapter on screen, and returns findings with exact YAML paths and fixes written as YAML.
---

# Review a plan

Goal: a room follows the plan from cover to commitment and never hits an empty screen, an unexplained word, a
claim they cannot check, or a change without a test, an owner and an issue.

References: [groundwork-schema](../groundwork-schema/SKILL.md) (rules) and its [cookbook](../groundwork-schema/cookbook.md)
(fixes as ops); validator messages carry their fix;
[newcomer questions](../groundwork-plan/checklists/newcomer-questions.md) (what a newcomer asks, per chapter, and
where the answer lives).

## Run

```bash
npm run workspace -- check <workspace>        # the workspace, its model and every plan, as the app reads them
node tools/sources.ts <workspace> --missing   # extracted facts without sources; add --check to ask GitHub
npm run map -- repos --workspace <ws>         # the commit each repo was read at
npm run dev                                   # then walk /<ws>/plans/<plan>/ chapter by chapter
```

The app shows validator errors and warnings, and the plan's health (untested changes, coverage gaps, overdue
questions), on the plan's pages. There is no screenshot tool yet; take screenshots in the browser when a finding
needs one.

Health: an untested change is a Blocker; a test that proves a change but walks no step it touches, and a new or
changed cross-component call with no contract test, are Major; overdue open questions are Major; every added flow
needs an e2e that walks it; a change touching a message, API or store proven only by unit tests is Major; compare
the critical path with `meta.appetite`.

## Look for

- **Overlay purity.** A new plan with its own `services`, `stores`, `schemas`, `interfaces`, `messages`, `flows`,
  `screens` or `handlers`: Blocker; today lives in the model, and planned behaviour is an op.
- **Lock and drift.** An open plan without `base.lock.json`, or one whose cover says today has changed under it
  (an op whose target changed or vanished since the lock): Major; re-read the targets, fix the ops, run
  `npm run plan:base -- check <plan>`. A shipped plan without `base.yaml`: Minor; land it.
- **Attribution and freshness.** Every component, endpoint, store, message and handler the plan touches cites code
  in the model, and the citation points at the thing it claims (a controller for an endpoint, a migration for a
  record). A repo behind its branch tip, or never scanned, under a change: Major; run
  [groundwork-scan](../groundwork-scan/SKILL.md) `--since` before the room.
- **Handlers.** A change to what runs (a new call, a new rule, a new branch) with no op on the `h:` handler, or a
  handler op whose conditions are code (`if: cfg.x > 0`) rather than plain words: Major.
- **Empty chapters.** No flow through the footprint; no added flow and no `story.chapters.new.headline` saying
  why; a team with ops but no work item; a milestone without `exit`.
- **Honest coverage.** An e2e whose `proves` lists changes it never walks; a milestone that is a layer rather than
  a thin end-to-end slice, or named by calendar slot; a milestone without `due`; a question whose `decide_by` is
  after the milestone it blocks.
- **Build order.** A `depends_on` that is not a real prerequisite; a wave holding one large item that blocks
  everything after it and could be split.
- **Newcomer gaps.** An acronym without a glossary entry; a component with no lines; a record without a store; a
  consumer reading another team's table instead of its own projection; an open question without decider, date and
  `blocks`; a risk without a team owner.
- **UI journeys.** A flow a person drives with no `screen:` on its user-facing steps; a changed screen with no new
  picture or design link; region boxes on the wrong part of the picture; a mockup whose hotspots lead nowhere.
  Apply [granular journeys](../groundwork-mockup/journey-granularity.md): wrong starting screen or control,
  premature result UI, hidden backend steps or collapsed distinct interactions are Major.
- **On screen.** "undefined" or raw ids, fan-out that looks sequential, whole-list diffs where one item changed
  (`set` instead of `append`/`drop`), headlines that read as labels rather than say what is true, clipped names.

## Findings

One row each, most severe first; the fix as YAML, not advice. Severity: Blocker (validator error, today copied or
changed in place, empty chapter), Major (unattributed or stale fact, newcomer question unanswered, change without
owner, e2e or rollout), Minor (wording, glossary, story polish).

```markdown
| #   | Sev     | Path                    | Finding                                     | Fix                                                                                                                               |
| --- | ------- | ----------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Blocker | services[2]             | The plan copies svc:billing from the model. | Delete it; `{ modify: svc:billing, set: { does: "…" } }` in chg:billing-skip-paused if it changes.                                |
| 2   | Major   | changes[0].ops[1]       | The new pause rule has no handler op.       | `{ modify: h:billing-run-invoice, append: { steps: [{ if: the subscription is paused, then: [{ return: skipped }] }] } }`         |
| 3   | Major   | api:subs-cancel (model) | No source.                                  | Re-scan acme/subscriptions, or `sources: [{ repo: acme/subscriptions, path: src/api/cancel.kt, lines: [20, 58], commit: <sha> }]` |
```

End with the validator status, counts by severity, and the one fix that most improves the room's experience.
After fixes, check again.
