---
name: groundwork-plan
description: Plan a cross-team change in Groundwork and write it as an overlay on the system model (<workspace>/plans/<plan>/plan.yaml) - changes as ops on system ids (including handlers), and the plan's own reasoning (why, decisions, risks, tests, work, milestones). Use when someone brings a feature idea and asks to plan it, to see what it touches, to extend an existing plan, or to split a large discovery into a programme of stacked plans. Fills gaps in the system model with groundwork-explore first, confirms facts with the people in plain language, validates.
---

# Plan a change

First run `npm run --silent workspace -- list --json` in the Groundwork checkout and resolve the person's workspace.
Use its registered folder and `--workspace <ws>`, not `workspaces/`; see [workspace discovery](../README.md#find-the-workspace-first).

A Groundwork plan is an **overlay**. The system model in `<workspace>/domains/` already says how everything
runs today; a plan names the snapshot it was written against, lists what changes as ops on the model's ids, and
adds the reasoning the teams need to agree to it. The app projects today from the model onto what the plan touches (its
changes, one hop around them, and the flows that pass through), so **a plan never copies today**.

A plan is the smallest change-set teams can approve and land, with one walking skeleton. Larger work is several
plans: each may **build on** others (`builds_on`), so the same system changes in increments, and plans that serve
one outcome join a **programme** (`programmes/<id>/programme.yaml`) that holds their shared context. Every team,
partners included, gets the same work items and milestones; what each team has promised and what has happened
live in `plans/<plan>/progress.yaml`, never in the plan.

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
- which teams will do the work, partners included, and how much time it is worth (appetite);
- whether it serves a programme, or follows on from another plan.

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
   - `context`: ids the plan relies on but does not change and names nowhere else (a flow it must not break, a
     consumer of a message it alters). Everything the ops and prose name is drawn from today already.
   - Why (`problem`): the press-release paragraph, evidence, metrics with today → target in plain words a product
     manager could read aloud (no parameter names, status codes or store names), non-goals, two scenarios.
   - The change ledger: `changes[]`, each a reviewable delta, ideally one owning team, as ops on system ids.
   - Tests, milestones, work items, decisions, risks and open questions.

   Technical facts come from the model and the code; product facts come from the people; every design choice with an
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

- **Every op targets an id in the system model** as it stands today, or one the plan (or a plan it builds on) adds. `add` brings in something
  new; `modify` with `set`, `append` or `drop` changes something that exists; `deprecate … replaced_by` and
  `remove` retire. Recipes in [the cookbook](../groundwork-schema/cookbook.md).
- **Handlers change like anything else**: `add: handler` for a new endpoint's or consumer's logic,
  `modify: h:…` to append steps or replace them with `set: { steps: [...] }`. Write the whole tree when the
  logic is reshaped, so the "before and after" reads well; keep the step kinds and plain-words conditions of
  [handlers.md](../groundwork-explore/handlers.md). A new call between components is a `call` step in a handler,
  plus the endpoint if it is new.
- **Never copy today.** No `services`, `stores`, `schemas`, `interfaces`, `messages`, `flows`, `screens` or
  `handlers` at the top level of a plan: those live in the model, and the app reads an open plan onto today
  live. `teams` lists the teams with work in the plan; a team the plan does not list is drawn from today.
- **Lock what the plan fitted.** `npm run plan:base -- check <plan>` validates the plan on its base and writes
  `base.lock.json`: a fingerprint of everything its `modify`, `remove` and `after` ops target, the hash of each
  plan it builds on and of its programme, and of what those plans make, and the hash of the plan itself. When any
  of them moves, or the plan is edited, the plan's cover says so and names it. Re-read them, fix the ops, and run
  `check` again to move the lock forward. Run it after every edit to a plan and commit the lock with it: the
  workspace's pre-commit hook refuses a plan whose lock does not hold the check of what it says now.
- **Land it when it ships.** `npm run plan:base -- land <plan>` freezes today's part of the model into
  a frozen `base/` with its `base.yaml` marker, and drops the lock, so a shipped plan keeps reading against the system it changed, not today. Plans
  land in order: it refuses while a plan this one builds on has not landed.

## Conventions

- **Ids by meaning**, never numbered: `chg:billing-skip-paused`, `flow:cancel#publish`, `sch:subscription#status`.
  Quote ids with `#`, and dates.
- **One change per reviewable delta**, ideally one owning team. Versioning is `add` + `supersedes` and
  `deprecate` + `replaced_by`; one change per consumer migrated; retirement last.
- **Status, before and after, edges, coverage, blockers and build waves are derived**; never author them.
- **Owners are teams** (`risks[].owner`, `questions[].decider`, `tests[].owner`); Product is a team. A design
  choice that hangs on an open question stays `status: proposed`, and the question `blocks` it.
- **Names follow the code**; people's words go in `name`, `summary` and the glossary.
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
  the version people can repeat.
- **One contract test per new or changed cross-component call**, owned by the consumer team. An e2e proves only the
  changes whose steps it walks.
- **Questions `block` the change or work item they gate**; `decide_by` falls before the milestone that needs the
  answer.
- **Story headlines** say what is true, with a number or a name; recaps are two or three sentences.

- **A change may wait for its shape.** When the capability is known but the contract is not (often a partner's),
  write `requires` (`req:` ids, what must be true) and no ops, and name the open question in `blocked_by`. Add the
  ops once the shape is agreed. A test may prove a requirement.
- **Partners are teams.** A partner (`partner: true` in `workspace.yaml`) gets work items, milestones and tests like
  anyone; its items are never filed as our issues. Put `needed_by` (our need) on the item; what the team promises
  and when is a `commitment` event in `progress.yaml` (`npm run progress -- add`), so our need is never shown as
  their promise. Nothing in a plan is a placeholder team or a planned flag: anything a plan adds is planned.
- **Work that implements no change** (recovery, operations) leaves out `implements`. `blocked_by` on a work item
  names the decisions or questions it waits on.

Every question a newcomer asks of a plan, and where its answer lives: [checklists/newcomer-questions.md](checklists/newcomer-questions.md).

## Plans that build on others

- `builds_on` lists the plans this one reads on top of today: their ops are applied first, in dependency order, so
  this plan's before is "after those plans" and its diff shows only its own increment. It is about what the plan
  reads, never about when work happens: order work with `depends_on` (which may name `<plan>/wi:…`) and milestones
  with `after`.
- Two open plans that change the same thing, neither building on the other, **overlap**: a warning on both. A plan
  that builds on both is an error: make one build on the other, or build on one plan that holds the change.
- When a base plan is revised, this plan says so on its cover until someone re-checks it. When a base plan is
  abandoned, absorb what you need, pick another base, or abandon this plan too. Nothing lands by halves: if part
  shipped, split it into its own plan, land that, and build the rest on it.
- Cite another plan's or the programme's items with a qualified id: `[[care-se/dec:reservation-length]]`. Nothing is
  inherited.

## Split a large discovery into a programme

When a discovery covers more than one walking skeleton, more than one landing, or teams that cannot all start at
once, write a programme and a stack of plans instead of one large plan:

1. **The programme** (`programmes/<id>/programme.yaml`): the outcome, the problem and glossary, the scenarios
   every plan shares (above all the unhappy paths), the decisions and questions that cut across plans, and the
   milestones as outcomes. It has no ops; plans join it with `meta.programme` and serve its milestones with
   `serves: <programme>/ms:…`.
2. **The plans**: one per change-set that lands on its own, ordered by what each reads. Start from the plan
   everything else needs, and let each later plan build on the ones whose additions it changes or calls.
3. **Shared unhappy paths** stay programme scenarios; each plan cites the ones it handles and proves them with its
   own tests.

The Care by Volvo Sweden discovery splits like this:

| Plan              | Delivers                                                                                                               | Builds on                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| financing-status  | sales channel on every application; FAE events update the same Opportunity; early CRM release; the shared status rules | —                                   |
| stock-reservation | reserve, renew, release; recovery; reservations in Sweden                                                              | financing-status                    |
| online            | Care on stock cars in the listing page; reservation time in checkout; online recovery                                  | financing-status, stock-reservation |
| sales-tool        | the new Connect app; TACDIS and Digital Business Proposal changes; checkout reuses the Opportunity; walk-in            | financing-status, stock-reservation |
| order-change      | revision tracking and contract replacement; Ziklo and TACDIS work; Vista execution; partial-completion recovery        | sales-tool, financing-status        |

Repeated or late statuses, a decline after signing and no automatic rollback are programme scenarios, cited by the
plans and proven by their tests. Most of what order-change needs from Ziklo is changes with `requires` and no ops
yet, blocked by open questions, and Ziklo work items with `needed_by` dates.

## Talking to people

- Lead with what you found, not what you need. Show a flow as "A calls B to do X, then B tells C", with a link per
  hop.
- Ask product questions only: why now, for whom, what is success, what is out of scope, what worries you. Keep
  each round to three questions.
- When the code and the people disagree, the code is what runs; write their belief as an open `question` with a
  `decider`. Every acronym or team word you hear goes in `problem.glossary`.

## Validating

The app does not validate plans when it shows them: it trusts the check each plan passed when it was written, and
flags a plan edited since. So validate as you write. `npm run plan:base -- check <plan>` checks a plan against
`schema/plan.schema.json` and the whole model, and `npm run workspace -- check <workspace>` checks every plan;
the workspace repo's pre-commit hook runs both. Check a plan by:

```bash
npm run workspace -- check <workspace>       # the workspace, its model and every plan, checked through
npm run dev                                  # then open /<ws>/plans/<plan>/ and walk every chapter
npm run map -- show <id> --workspace <ws>    # verify current facts and their citations
npm run plan:base -- check <plan>            # fits its base; writes base.lock.json
npm run progress -- show <workspace> <plan>  # where each work item, milestone and team stands
```

`check` also lists overlaps between open plans.

## Done when

The plan validates; every op targets an id in the model or one the plan or its bases add; every component, endpoint, store,
message and handler it touches cites code in the model; every change has a test and a work item; a change without ops has
`requires` and an open question; every partner work item has `needed_by`; every open question has a team and a date;
every overlap is ordered or understood; the driver has read the digest and said "yes, that's us".
