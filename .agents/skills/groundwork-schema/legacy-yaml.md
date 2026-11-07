# Legacy production YAML

Historical reference for retained proof. For current workspace authoring, use the consolidated
[Groundwork schema](../groundwork-schema/SKILL.md) and [native scan](../groundwork-scan/SKILL.md).

Fields and enums: read `schema/plan.schema.json` (`$defs`); the system model and plans share it. Do not guess a
key; objects are closed. For a complete small plan, read `test/fixtures/mini.yaml`; for a federated graph,
`test/fixtures/shop.yaml`. Copy-paste ops for every kind of change: [cookbook.md](cookbook.md). Every validator message ends with its
fix, so read the message. Types for the app are generated from the schema with `npm run generate`.

## Where things live

```
<workspace>/
  workspace.yaml                         name, teams (handles; partner: true; contacts)      people
  story.yaml                             summary, stages, concepts                          people
  flows/<flow>.yaml                      one curated walk across components per file        people
  journeys/<journey>.yaml                user journeys and interactions                     people
  domains/<d>/domain.yaml                name, purpose                                      people
  domains/<d>/target.yaml                target architecture: summary, stages, shifts        people
  domains/<d>/systems/<s>/system.yaml    name, team (optional), repos, components           people
                                         and tier: channel|gateway|forward|backend|upstream;
                                         a component may say infrastructure: true
  domains/<d>/systems/<s>/contracts.yaml stores, interfaces, schemas, messages, screens     the scan
  domains/<d>/systems/<s>/handlers.yaml  what runs on each endpoint, message, job, action    the scan
  scans/<org>/<name>.yaml                each repo's high-water mark                        the historical scan mark writer
  programmes/<p>/programme.yaml          outcome, shared scenarios, decisions, questions,   people
                                         milestones of the plans that join it
  plans/<plan>/plan.yaml                 changes, context, reasoning, builds_on             people
  plans/<plan>/progress.yaml             what has happened: commitments, work, notes        npm run progress -- add
  plans/<plan>/base.lock.json            what an open plan fitted: today's targets, each    npm run plan:base -- check
                                         base plan's and the programme's hash, the result
  plans/<plan>/base.yaml                 a shipped plan's frozen today                      npm run plan:base -- land
  MAP.md                                 the agents' map                                    npm run map -- md
```

The levels are workspace › domain › system › component, and nothing else. A component is a service, website,
app, job or external party (`svc:`), or a store (`st:`).

## Ground rules

1. **The model is today; a plan is an overlay.** The system model describes production as it runs now, with no
   plan present. A plan lists what changes as ops in `changes[].ops`, and in `context` any ids it relies on but
   does not otherwise name. It never copies today: an open plan reads today live, drawing the part its ops,
   prose and `context` name, and a landed plan reads the `base.yaml` frozen when it shipped.
2. **Ops**: `add`, `modify` (`set` / `append` / `drop`), `deprecate` (+ `replaced_by`), `remove`. They apply in
   ledger order (changes top to bottom, ops top to bottom). An op may target any id in the plan's today,
   or one added earlier in the ledger. An op that targets an id added later is an error.
3. **Ids**: `<prefix>:<kebab-slug>`; flow steps `flow:<slug>#<slug>`; fields `sch:<slug>#<field_name>`. Unique
   across the workspace, meaningful, never numbered, never renamed. Quote ids containing `#`. Extracted ids
   follow the natural-key rules in [legacy natural keys](../groundwork-explore/legacy-fragment.md#stable-ids) so a re-scan
   keeps them. Another plan's or the programme's id is qualified with its folder, `care-se/dec:reservation-length`,
   in `depends_on`, `blocked_by`, `after`, `serves` and `[[…]]` citations.
4. **Every object is closed** (`additionalProperties: false`): an unknown key is an error. There is no colour,
   position, order, status or count field; those are derived.
5. **Markdown fields** may cite `[[id]]`; the validator checks the id exists. Dates are quoted `"YYYY-MM-DD"`.
6. **Every fact says where it came from.** `origin: extracted | seeded | curated | documented`. Extracted facts carry
   `sources: [{ repo, path, lines: [from, to], commit, symbol? }]`; the permalink is derived, never stored alone
   (the older `{ url }` form still reads, with a warning). Handlers carry sources per handler and per significant
   step. A partner's facts, read from its documents, are `documented` and cite
   `{ url, pointer or heading, version }`, even where the app cannot reach the url. `node tools/sources.ts
<workspace>` checks it. Ops carry no sources: put them in the `add` value or on the change.
7. **Draft is forgiving.** While `meta.status: draft`, missing tests, work items and store access are warnings
   prefixed `draft:`. At `review` and `approved` they are errors.
8. **Handlers are step trees.** `handlers: [{ id: h:…, on, component, summary, sources, origin, steps, fails }]`.
   `on` is `api:…`, `msg:…`, `ui:…` or `job:<cron or name>`. Steps are `does`, `call` (an `api:` id), `publish`
   (a `msg:` id), `read`/`write` (a schema or field, `from`/`to` a store), `if`/`then`/`else`, `each`/`do`,
   `parallel`, `retry`/`times`/`do`, `try`/`catch`, `return` and `wait`, each optionally with `does`, `when`,
   `async`, `sources` and `origin`. Conditions are plain words. Full guide:
   [handlers.md](../groundwork-explore/handlers.md). Connections (who calls whom, when, from which entrypoint) and
   call trees are derived from handlers.
   REST scans also follow [endpoint-flow.md](../groundwork-explore/endpoint-flow.md): control flow and step-level
   data bindings are required. The current schema cannot express all of that analysis; retain the extra facts
   in the companion scan artefact outside the workspace. Do not add unrecognised keys to handlers or claim the
   companion is validated or rendered by the app.
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
    sentence case, no code names), shown under the name. `system.yaml` may override the scan's `does`. Use runtime entrypoints and declarations for technical component boundaries. Do not split a shared host
    merely because different teams own its modules; preserve curated legacy grouping and propose corrections
    explicitly. Libraries are never components.
13. **Every topic says what goes on it; investigate disconnected components.** A `kind: topic|queue` store
    needs a `messages[]` entry with `topic:` pointing at it. Check missing calls, callers, topic participation
    and store access against evidence. Do not invent a line to satisfy connectivity: retain justified
    independent work or an explicit evidence gap, and review system membership. Omit a message's `producer`
    or a store's `owner` when the source does not identify it. A consumer is not the publisher, and the only
    captured accessor is not necessarily the owner. Retain concrete handler publishers, consumers and access
    independently. Do not fabricate a message shape solely to complete a topic record. Use the
    [orphan audit](../groundwork-diagram/references/orphans.md) for ambiguous cases.
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

| Derived                                                          | From                                                                                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| status per entity, before and after, the to-be system            | ops applied in ledger order over the plan's today                                                                    |
| a plan's today                                                   | the model's entities the plan names (ops, prose, `context`), and everything they name in turn, landed plans excepted |
| drift                                                            | ops whose targets changed or vanished since `base.lock.json`, or a base plan or the programme that changed           |
| a stacked plan's base                                            | today with the open plans of its `builds_on` closure applied first, in dependency order                              |
| overlaps                                                         | open plans, neither building on the other, whose ops touch the same thing                                            |
| a programme's plans                                              | each plan's `meta.programme`                                                                                         |
| commitment, progress, last heard, blockers                       | the latest events in `progress.yaml`; a declined commitment blocks what depends on it                                |
| realisation (missing, partial, matches, differs)                 | each op compared with today's model, rolled up per change                                                            |
| connections, call trees, who calls whom and when                 | handler steps (`call`, `publish`, `read`, `write`, their guards and loops)                                           |
| edges, the components × stores grid, layout, lanes, team colours | flow steps, handlers, store `owner` and `access`                                                                     |
| migration ladder (expand, migrate, deprecate, retire)            | `supersedes`, `deprecate`, `remove`, implementing work items                                                         |
| coverage and gaps                                                | `tests[].proves`, `level`, `walks`, step `via`                                                                       |
| critical path, build waves, milestone-order violations           | `depends_on`, `size`, `milestone`                                                                                    |
| blockers, overdue questions, the decision register               | `questions[].blocks`, `decide_by`, decisions and their citations                                                     |
| done ticks and milestone progress                                | `plans/<plan>/progress.yaml`, never the plan                                                                         |
| the date gap on a work item                                      | its `needed_by` (or its milestone's `due`) against the latest promised date                                          |
| query plans, fan-out, cache paths, blast radius                  | operation documents, graph-type fields, subgraphs, caches                                                            |
| journey strips, before and after pictures, screens that change   | screens, step `screen`, ops on `scr:` ids                                                                            |
| staleness ("as of 3f9c2e1, 37 commits behind")                   | `scans/<org>/<name>.yaml` against the repo's branch                                                                  |

Never write `status: new`, `seq`, colours, positions, "changed" flags, counts, a "before" copy of a step, or a copy
of something the model already holds.

## What the validator checks

The app validates on load (`src/infrastructure/plan-validator.ts` and `src/application/plan/check-*.ts`; the
model through `src/domain/workspace-check.ts`), and `npm run workspace -- check <workspace>` reads a workspace the same way. In short:

1. Schema shape; id pattern per kind; ids unique; step ids start with their flow id.
2. No dangling references, including `[[id]]`, op targets, and every id in a handler (`on`, `component`, `call`,
   `publish`, `read`, `write`, `from`, `to`).
3. `add` ids are new; `modify`, `deprecate` and `remove` targets exist at that point in the ledger.
4. `kind: record` needs `store`; `field`, `endpoint`, `step` and `region` adds need `into`.
5. Reads and writes need store ownership or access for the acting component (draft: warning).
6. Every change has a test (proving it or one of its `requires`) and a work item (draft: warning); a work item that
   implements changes has tests that prove them; `depends_on` is acyclic and never into a later milestone. A change
   without ops needs `requires` and an open question in `blocked_by`.
7. Decisions, questions and risks have deciders, dates and options as rule 11 says.
8. Screens: regions inside the picture; a step's `screen` belongs to its `from` or `to`; pictures exist on disk.
9. Revisions (`meta.revisions`): versions ascend, only the last may be `proposed`; revise through
   [groundwork-revise](../groundwork-revise/SKILL.md).
10. Graphs, subgraphs, operations and caches compose (see [groundwork-graph](../groundwork-graph/SKILL.md)).
11. Attribution: an extracted fact without sources, or a documented one without a document, is an error
    (`node tools/sources.ts`).
12. Plans together: `builds_on` names plans that exist, never itself, never in a circle; a plan that builds on two
    plans that overlap, neither building on the other, is an error; other overlaps are warnings. Qualified ids
    resolve; a milestone serves only its own programme's milestones; `meta.programme` names a programme folder.
13. `progress.yaml` events name a work item or milestone of the plan; a work event says its state, and the state
    fits the kind; only a commitment carries `promised_for` and `confidence`.
