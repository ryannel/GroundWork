---
name: groundwork-schema
description: Ground rules for Groundwork's YAML - the system model (system.yaml, contracts.yaml, handlers.yaml, flows, journeys) and plans as overlays on it - what is authored and what is derived, and an op cookbook for every kind of change, including ops on handlers. Use when writing or fixing any workspace file or plan, writing add/modify/deprecate/remove ops (add a field, insert a step, add a branch to a handler, version a message, migrate a consumer, retire, grant store access), or resolving validator errors and warnings.
---

# Groundwork's model: the rules, not the fields

Fields and enums: read `schema/plan.schema.json` (`$defs`); the system model and plans share it. Do not guess a
key; objects are closed. One example per entity: `workspaces/alder-finch/domains/*/systems/*/` for the model, and
`workspaces/alder-finch/plans/delivery-promise/plan.yaml` (large) or `invoice-vat-number/plan.yaml` (small) for
plans. Copy-paste ops for every kind of change: [cookbook.md](cookbook.md). Every validator message ends with its
fix, so read the message. Types for the app are generated from the schema with `npm run generate`.

## Where things live

```
workspaces/<ws>/
  workspace.yaml                         teams, name                                        people
  story.yaml                             summary, stages, concepts                          people
  flows/<flow>.yaml                      one curated walk across components per file        people
  journeys/<journey>.yaml                user journeys and interactions                     people
  domains/<d>/domain.yaml                name, purpose                                      people
  domains/<d>/systems/<s>/system.yaml    name, team, repos, components (names, does)        people
  domains/<d>/systems/<s>/contracts.yaml stores, interfaces, schemas, messages, screens     the scan
  domains/<d>/systems/<s>/handlers.yaml  what runs on each endpoint, message, job, action    the scan
  scans/<org>/<name>.yaml                each repo's high-water mark                        tools/scan-mark.ts
  plans/<plan>/plan.yaml                 baseline, changes, reasoning                       people
  MAP.md                                 the agents' map                                    npm run map -- md
```

The levels are workspace › domain › system › component, and nothing else. A component is a service, website,
app, job or external party (`svc:`), or a store (`st:`).

## Ground rules

1. **The model is today; a plan is an overlay.** The system model describes production as it runs now, with no
   plan present. A plan names its `baseline` (the Groundwork commit it read the model at) and lists what changes
   as ops in `changes[].ops`. It never copies today: the app projects today onto the plan's footprint. The four
   older plans still carry their own copy of today; new plans must not.
2. **Ops**: `add`, `modify` (`set` / `append` / `drop`), `deprecate` (+ `replaced_by`), `remove`. They apply in
   ledger order (changes top to bottom, ops top to bottom). An op may target any id in the model at the baseline,
   or one added earlier in the ledger. An op that targets an id added later is an error.
3. **Ids**: `<prefix>:<kebab-slug>`; flow steps `flow:<slug>#<slug>`; fields `sch:<slug>#<field_name>`. Unique
   across the workspace, meaningful, never numbered, never renamed. Quote ids containing `#`. Extracted ids
   follow the natural-key rules in [groundwork-explore](../groundwork-explore/SKILL.md#stable-ids) so a re-scan
   keeps them.
4. **Every object is closed** (`additionalProperties: false`): an unknown key is an error. There is no colour,
   position, order, status or count field; those are derived.
5. **Markdown fields** may cite `[[id]]`; the validator checks the id exists. Dates are quoted `"YYYY-MM-DD"`.
6. **Every fact says where it came from.** `origin: extracted | seeded | curated`. Extracted facts carry
   `sources: [{ repo, path, lines: [from, to], commit, symbol? }]`; the permalink is derived, never stored alone
   (the older `{ url }` form still reads, with a warning). Handlers carry sources per handler and per significant
   step. `node tools/sources.ts workspaces/<ws>` checks it. Ops carry no sources: put them in the `add` value or
   on the change.
7. **Draft is forgiving.** While `meta.status: draft`, missing tests, work items and store access are warnings
   prefixed `draft:`. At `review` and `approved` they are errors.
8. **Handlers are step trees.** `handlers: [{ id: h:…, on, component, summary, sources, origin, steps, fails }]`.
   `on` is `api:…`, `msg:…`, `ui:…` or `job:<cron or name>`. Steps are `does`, `call` (an `api:` id), `publish`
   (a `msg:` id), `read`/`write` (a schema or field, `from`/`to` a store), `if`/`then`/`else`, `each`/`do`,
   `parallel`, `retry`/`times`/`do`, `try`/`catch`, `return` and `wait`, each optionally with `does`, `when`,
   `async`, `sources` and `origin`. Conditions are plain words. Full guide:
   [handlers.md](../groundwork-explore/handlers.md). Connections (who calls whom, when, from which entrypoint) and
   call trees are derived from handlers.
9. **Flows are the curated story; handlers are the truth beneath.** A flow step `from A to B via api:x` should
   match a `call: api:x` in one of A's handlers; the scan report lists the ones that do not.
10. **Implementation narrative is optional, not derived.** `execution.summary`, `execution.paths[]` (`name`,
    optional `summary`, `steps: [{ label, detail }]`) and `execution.caveats[]` explain the proposed mechanism
    before the build order. Link entities with `[[id]]`; never invent a second copy of today.
11. **Every call the plan rests on is a decision.** If prose treats something as chosen (a store, a default, a
    rollout order, what is out of scope), record it in `decisions[]` with `status` (`proposed` · `accepted` ·
    `deferred` · `rejected` · `superseded`), `decider` (a team), `decided_on` once accepted or `decide_by` while
    open, `reversibility` (`one-way` records `options` with `why_not`), `consequences`, and `supersedes` when it
    replaces another. Point each change at its decisions with `changes[].decisions`. A question a decision
    settles takes `answered_by: dec:…`; a risk the plan lives with is `roam: accepted` with `accepted_by: dec:…`.
12. **Components and stores say what they are for.** `does` is the role in plain words (at most ten words,
    sentence case, no code names), shown under the name. `system.yaml` may override the scan's `does`. One
    component per independently owned unit: split a shared host (a federation monorepo's subgraphs) per owner.
    Libraries are never components.
13. **Every topic says what goes on it, every component has a line.** A `kind: topic|queue` store needs a
    `messages[]` entry with `topic:` pointing at it. A component must call, be called, or share a topic or store
    with another.
14. **Screens are entities; the new look is an op.** Today's screens live in the model with their screenshot and
    `regions[]` (`shows`, `reads`, an `at` box in percent). A change sets the new look
    (`modify: scr:x set: { image, figma, mockup }`) and adds, modifies or removes regions. Before and after are
    derived. Pictures are files, never data URIs; the walking mockup is `plans/<plan>/mockups/walking.html`. See
    [groundwork-mockup](../groundwork-mockup/SKILL.md) and the
    [granular journeys](../groundwork-mockup/journey-granularity.md) rules for user-facing flows.
15. **A graph is three arrays, a schema kind and a cache layer**: `graphs`, `subgraphs`, `operations`, types as
    `schemas` with `kind: graph-type`, and caches as stores with a `layer`. See
    [groundwork-graph](../groundwork-graph/SKILL.md).
16. **Say what a field is when the code says so**: `key: true`, `ref: sch:other[#field]`, `default`, `unique`; a
    message takes `key:`. Write them from the schema, migration or producer code, never to fill a table.

## What is derived (never author it)

| Derived                                                          | From                                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| status per entity, before and after, the to-be system            | ops applied in ledger order over the model at the baseline                                   |
| a plan's today                                                   | the model projected onto what the plan's ops touch, one hop around, and the flows through it |
| drift                                                            | ops whose targets changed or vanished since the baseline                                     |
| connections, call trees, who calls whom and when                 | handler steps (`call`, `publish`, `read`, `write`, their guards and loops)                   |
| edges, the components × stores grid, layout, lanes, team colours | flow steps, handlers, store `owner` and `access`                                             |
| migration ladder (expand, migrate, deprecate, retire)            | `supersedes`, `deprecate`, `remove`, implementing work items                                 |
| coverage and gaps                                                | `tests[].proves`, `level`, `walks`, step `via`                                               |
| critical path, build waves, milestone-order violations           | `depends_on`, `size`, `milestone`                                                            |
| blockers, overdue questions, the decision register               | `questions[].blocks`, `decide_by`, decisions and their citations                             |
| done ticks and milestone progress                                | `plans/<plan>/status.json`, never the plan                                                   |
| query plans, fan-out, cache paths, blast radius                  | operation documents, graph-type fields, subgraphs, caches                                    |
| journey strips, before and after pictures, screens that change   | screens, step `screen`, ops on `scr:` ids                                                    |
| staleness ("as of 3f9c2e1, 37 commits behind")                   | `scans/<org>/<name>.yaml` against the repo's branch                                          |

Never write `status: new`, `seq`, colours, positions, "changed" flags, counts, a "before" copy of a step, or a copy
of something the model already holds.

## What the validator checks

The app validates on load (`src/infrastructure/plan-validator.ts` and `src/application/plan/check-*.ts`; the
model through `src/domain/workspace-check.ts`), and `npm test` reads every workspace. In short:

1. Schema shape; id pattern per kind; ids unique; step ids start with their flow id.
2. No dangling references, including `[[id]]`, op targets, and every id in a handler (`on`, `component`, `call`,
   `publish`, `read`, `write`, `from`, `to`).
3. `add` ids are new; `modify`, `deprecate` and `remove` targets exist at that point in the ledger.
4. `kind: record` needs `store`; `field`, `endpoint`, `step` and `region` adds need `into`.
5. Reads and writes need store ownership or access for the acting component (draft: warning).
6. Every change has a test and a work item (draft: warning); work items implement changes and their tests prove
   them; `depends_on` is acyclic and never into a later milestone.
7. Decisions, questions and risks have deciders, dates and options as rule 11 says.
8. Screens: regions inside the picture; a step's `screen` belongs to its `from` or `to`; pictures exist on disk.
9. Revisions (`meta.revisions`): versions ascend, only the last may be `proposed`; revise through
   [groundwork-revise](../groundwork-revise/SKILL.md).
10. Graphs, subgraphs, operations and caches compose (see [groundwork-graph](../groundwork-graph/SKILL.md)).
11. Attribution: an extracted fact without sources is an error (`node tools/sources.ts`).
