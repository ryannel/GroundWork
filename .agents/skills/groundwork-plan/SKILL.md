---
name: groundwork-plan
description: Plan a cross-team change in Groundwork and write it as an overlay on the system model (workspaces/<ws>/plans/<plan>/plan.yaml) - a baseline, changes as ops on system ids (including handlers), and the plan's own reasoning (why, decisions, risks, tests, work, milestones). Use when someone brings a feature idea and asks to plan it, to see what it touches, or to extend an existing plan. Fills gaps in the system model with groundwork-explore first, confirms facts with the people in plain language, validates.
---

# Plan a change

A Groundwork plan is an **overlay**. The system model in `workspaces/<ws>/domains/` already says how everything
runs today; a plan names the snapshot it was written against, lists what changes as ops on the model's ids, and
adds the reasoning a room needs to say yes. The app projects today from the model onto what the plan touches (its
changes, one hop around them, and the flows that pass through), so **a plan never copies today**.

The app reads a plan as a story, in order: why → the system today → the new journey → what changes → how we prove
it → how we build it → decide and commit (`/<ws>/plans/<plan>/<chapter>/`). Screens are derived from the data, so
a missing entity is a missing screen.

The person driving this usually **does not know the code**. They know the product, the people and the outcome they
want. You read the map and the code; they correct you. Never ask them for ids, YAML or architecture.

Field reference and op recipes: [groundwork-schema](../groundwork-schema/SKILL.md). Facts about today:
[groundwork-ask](../groundwork-ask/SKILL.md), and [groundwork-explore](../groundwork-explore/SKILL.md) when the
map lacks them. Review: [groundwork-review](../groundwork-review/SKILL.md). Issues:
[groundwork-issues](../groundwork-issues/SKILL.md). Screens and the walking mockup:
[groundwork-mockup](../groundwork-mockup/SKILL.md).

## Inputs you need

Ask for these in one message, then start:

- the workspace, and the feature in a sentence: what ships, and for whom;
- where it starts (a screen, an endpoint, a system or a repo), if they know;
- who is in the room (teams), and how much time it is worth (appetite).

## The loop

1. **Find the footprint in the map.** From where it starts, walk the model: `npm run map -- find`, `show`,
   `calls` and `callers` (see [groundwork-ask](../groundwork-ask/SKILL.md)), the flows in `flows/` that pass
   through, and the handlers that would have to change. Note the systems, components, endpoints, messages, stores
   and handlers the feature touches, and their owning teams. Three to eight systems is typical; stop at the
   boundary the feature actually crosses.
2. **Fill the gaps before you plan.** If the model lacks something the plan needs (a repo never scanned, a
   handler missing, an endpoint whose body you need to change, facts `npm run map -- repos` shows as stale), run
   [groundwork-scan](../groundwork-scan/SKILL.md) on that system (`--since` for a stale one), or brief one
   [groundwork-explore](../groundwork-explore/SKILL.md) for that repo and merge it the same way. The facts go into
   the system model, never into the plan. A repo with no system yet is a proposal for `system.yaml`: ask the
   owning team, then scan.
3. **Confirm today with the people, in their words.** A short digest: "Here is what I found: these components,
   owned by these teams, talking like this. Does that match? What is missing?" Each claim links to its source
   (a permalink from `show`). Walk today's flows and handlers the feature will touch and ask "is this really how it
   works?" Corrections go to the model as `curated` entries or `system.yaml` edits, not to the plan.
4. **Write the plan with them** ([template](templates/plan.skeleton.yaml)):
   - `baseline`: the Groundwork repo commit the plan reads the system model at (`git rev-parse HEAD` after step 3).
   - Why (`problem`): the press-release paragraph, evidence, metrics with today → target in plain words a product
     manager could read aloud (no parameter names, status codes or store names), non-goals, two scenarios.
   - The change ledger: `changes[]`, each a reviewable delta, ideally one owning team, as ops on system ids.
   - Tests, milestones, work items, decisions, risks and open questions.

   Technical facts come from the model and the code; product facts come from the room; every design choice with an
   alternative becomes a `decision`. Where the feature touches what people see, the screens are in the model
   (`screens` in `contracts.yaml`, with today's screenshot); the new look is an op on the change: a wireframe or
   Figma link per changed screen, and a walking mockup when the journey crosses more than two screens.

5. **Validate and review.** See "Validating" below, then the [groundwork-review](../groundwork-review/SKILL.md)
   pass. Hand back the open questions and the TODOs.

Checkpoint with the driver after steps 1, 3 and 4. Facts before plans: do not write `changes` until today is
confirmed.

## Changes are ops on system ids

```yaml
changes:
  - id: chg:pricing-vat-by-market
    title: Price lookups return VAT per market
    why: Shoppers in Norway see prices without VAT ([[sc:oslo-shopper]]).
    decisions: [dec:vat-in-pricing]
    rollout: Behind the `vat-by-market` flag, Norway first.
    ops:
      - { add: field, into: sch:price, value: { name: vat_rate, type: decimal, required: true } }
      - {
          modify: api:pricing-get-price,
          append:
            { errors: [{ status: 422, code: no_vat_rule, when: the market has no VAT rule }] },
        }
      - modify: h:pricing-get-price
        append:
          steps:
            - read: sch:vat-rule
              from: st:pricing-db
              does: Loads the market's VAT rule
            - if: the market has no VAT rule
              then: [{ return: 422 no_vat_rule }]
```

- **Every op targets an id in the system model** at the baseline, or one the plan adds. `add` brings in something
  new; `modify` with `set`, `append` or `drop` changes something that exists; `deprecate … replaced_by` and
  `remove` retire. Recipes in [the cookbook](../groundwork-schema/cookbook.md).
- **Handlers change like anything else**: `add: handler` for a new endpoint's or consumer's logic,
  `modify: h:…` to append steps or replace them with `set: { steps: [...] }`. Write the whole tree when the
  logic is reshaped, so the "before and after" reads well; keep the step kinds and plain-words conditions of
  [handlers.md](../groundwork-explore/handlers.md). A new call between components is a `call` step in a handler,
  plus the endpoint if it is new.
- **Never copy today.** No `services`, `stores`, `schemas`, `interfaces`, `messages`, `flows`, `screens` or
  `handlers` at the top level of a new plan: those live in the model. `teams` lists the teams in the room.
  The four plans in `workspaces/alder-finch/plans/` predate the model and still carry their own today; do not
  copy them as examples for that part.
- If the model moved since the baseline, the app flags drift on ops whose targets changed or vanished. Re-read
  them, update the ops, and move `baseline` forward.

## Conventions

- **Ids by meaning**, never numbered: `chg:billing-skip-paused`, `flow:cancel#publish`, `sch:subscription#status`.
  Quote ids with `#`, and dates.
- **One change per reviewable delta**, ideally one owning team. Versioning is `add` + `supersedes` and
  `deprecate` + `replaced_by`; one change per consumer migrated; retirement last.
- **Status, before and after, edges, coverage, blockers and build waves are derived**; never author them.
- **Owners are teams** (`risks[].owner`, `questions[].decider`, `tests[].owner`); Product is a team. A design
  choice that hangs on an open question stays `status: proposed`, and the question `blocks` it.
- **Names follow the code**; the room's words go in `name`, `summary` and the glossary.
- **Milestones are walking skeletons**: M1 is the thinnest end-to-end slice behind a flag, not a layer. Name each by
  the outcome it demonstrates (`M1 · Walking skeleton: …`), never by calendar slot; dates belong in `meta.start`
  and each milestone's `due`.
- **Build waves come from `depends_on`.** An item's wave is one after its latest dependency. Make `depends_on`
  honest and minimal so independent work lands in the same wave; split a large item when only part of it blocks
  others. The build chapter's headline states the shape ("store first, then three in parallel, then …").
- **Explain the mechanism before the issue board.** When the change alters persistence, event handling or a read
  path, write `execution.summary` in plain language and `execution.paths` for the meaningful routes: short, ordered
  steps with a label and a sentence of detail, citing `[[id]]`. Say what stays, what is added, and what happens on
  failure; material limits go in `execution.caveats`. The changed handlers are the precise version; `execution` is
  the version a room can repeat.
- **One contract test per new or changed cross-component call**, owned by the consumer team. An e2e proves only the
  changes whose steps it walks.
- **Questions `block` the change or work item they gate**; `decide_by` falls before the milestone that needs the
  answer.
- **Story headlines** say what is true, with a number or a name; recaps are two or three sentences.

Every question a newcomer asks of a plan, and where its answer lives: [checklists/newcomer-questions.md](checklists/newcomer-questions.md).

## Talking to the room

- Lead with what you found, not what you need. Show a flow as "A calls B to do X, then B tells C", with a link per
  hop.
- Ask product questions only: why now, for whom, what is success, what is out of scope, what worries you. Keep
  each round to three questions.
- When the code and the room disagree, the code is what runs; write the room's belief as an open `question` with a
  `decider`. Every acronym or team word you hear goes in `problem.glossary`.

## Validating

The app validates plans against `schema/plan.schema.json` and the model when it loads them, and `npm test` reads
every workspace. Until `tools/validate-workspace.ts` exists (a TODO in
[groundwork-scan](../groundwork-scan/SKILL.md)), check a plan by:

```bash
npm test                                     # the plan and model tests read workspaces/
npm run dev                                  # then open /<ws>/plans/<plan>/ and walk every chapter
node tools/sources.ts workspaces/<ws>        # the model's facts still cite code
```

Overlay plans (a `baseline` and no copy of today) are being built in the app now. Until they land, the schema
may still ask for `services` and refuse `baseline`; keep the plan as an overlay anyway, note it in the hand-back,
and do not paste today into it to make it pass.

## Done when

The plan validates; every op targets an id in the model or one the plan adds; every component, endpoint, store,
message and handler it touches cites code in the model; every change has a test and a work item; every open
question has a team and a date; the driver has read the digest and said "yes, that's us".
