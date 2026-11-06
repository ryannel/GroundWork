# Groundwork: consolidated model design (revision 3)

Sources:

- the five audits in this folder and the user's requirements (`requirements.md`);
- the critique of revision 1 (folded into revision 2, `design.v2.md`);
- three reviews of revision 2: a design critique, a plan-feasibility review against the code, and a measurement
  of every claim against the Volvo and personal workspaces. §12 lists what each changed.
- the flow-view mockup (`../flow-mockup/index.html`), built from real Volvo data.

## 1. What is wrong today

1. **No fact has one home.** Stores are written twice and disagree (34 names, 38 tech, 73 type/kind values).
   Code homes come from three sources. About 12 provenance shapes, about 14 permalink builders plus repo-home,
   issue-URL and parser variants, 5 repo-identity forms. Commit pins disagree for 42 of 117 repos.
2. **Two vocabularies and two id schemes.** `type` (7 values) in `system.yaml`, `kind` in `contracts.yaml`;
   bare ids in one, prefixed in the other; id munging by hand in about 30 places.
3. **Several models of "today".** YAML → `Workspace` → `systemModelOf` → `SystemModel` (a fake approved plan).
   The hop drops domains, `talks_to`, narratives and repos, and invents store owners. `derive` runs in at least
   six places, including the browser.
4. **Relationships written twice, unchecked.** `talks_to` has 1,025 edges, none cited: 855 are backed by
   handler steps, 170 are not, and 99 handler edges are missing from it. Handlers reproduce only 127 of 184
   stated producers, 129 of 164 consumers and 308 of 368 store-access entries.
5. **Five read sources per page**; two pages can show different repos for the same component.
6. **Evidence is not connected** to the model.
7. **Legacy and dead weight**: `knowledge` v1–v3, the legacy explorer, scan marks, 27 GB of unread syntax
   cache, a 3.4 GB orphan corpus generation, 174 GB of `reports/` in the code repo.
8. **Mis-modelled facts.**
   - About 55 "externals" are Volvo systems not yet mapped (`crm-vcep`, `identity-volvo-id`, `fleet-*`).
   - LaunchDarkly is modelled twice.
   - 9 externals have interfaces declared in another system's file.
   - `svc:assortment-dgs` and `svc:product-enrichment-dgs` details sit in `federated-graph/contracts.yaml`.
   - 53 services have more than one kind of entry, so one `type` per service is wrong.
   - 14 store owners have no evidence, and 7 owners sit in another system.

**What the detail layer lacks for the flow view** (15,892 steps in 1,937 handlers):

| Finding                                                                    | Count                                                                                              |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Steps with an id                                                           | 0                                                                                                  |
| `does` over 60 characters (needs a headline)                               | 4,223 of 9,636; 6,256 steps have no `does` at all                                                  |
| Retry blocks with a condition, standalone waits, `when`/`async` on effects | 65, 27, 748/483                                                                                    |
| Named parallel lanes                                                       | 0 of 177                                                                                           |
| Declared `job:` entries                                                    | 0 (111 handlers start on one)                                                                      |
| GraphQL operations linked to resolver fields                               | 0 of 155 (derivable from their documents: 180/180 root fields reach a subgraph, 95/180 a resolver) |
| Outbox writes linked to the publishing job                                 | 0 of 4                                                                                             |
| Endpoints with request / response schemas                                  | 12% / 24%                                                                                          |

## 2. Principles

1. **One fact, one home.** Everything else is derived on read and never stored.
2. **Summary over detail.** An LLM writes which systems talk to which and why; under it sit entries, steps,
   conditions and schemas, cited to code or evidence. Every summary sentence names what it rests on (`backs:`).
3. **Never invent.** Unknown owners, callers, schedules and schemas stay gaps, reported and visible.
4. **Three storage tiers.** Code (external repos, pinned); committed (evidence and model, normalised); cache
   (`.groundwork/`, rebuildable). Nothing a view shows lives only in a cache. Nothing is deleted until its
   replacement is proven by regeneration and diff.
5. **Identity is explicit and immutable**, for every addressable thing: entities, schema fields, screen
   regions, steps and failures. Ids are assigned once and never recomputed from wording, position or target.
   Renames keep the id; merges and splits leave an alias.
6. **One citation type**, `Cite = CodeRef | EvidenceRef`, always a list. URLs derived at render time only.
7. **One in-memory model.** Plain serialisable data; indexes are built from it; plans change the model.

## 3. Ids

| Entity                                                       | Prefix                                                  | Declared in                             |
| ------------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------- |
| domain, system                                               | `dom:` `sys:`                                           | `domain.yaml`, `system.yaml`            |
| component                                                    | `svc:` `app:` `st:` `top:`                              | `system.yaml`                           |
| library                                                      | `lib:`                                                  | `libraries.yaml`                        |
| external system (vendor, SaaS, partner)                      | `ext:`                                                  | `externals.yaml`                        |
| interface                                                    | `if:`                                                   | `contracts.yaml`                        |
| entry: endpoint, subscription, scheduled job, UI interaction | `api:` `sub:` `job:` `ui:`                              | `contracts.yaml`                        |
| message (payload contract)                                   | `msg:`                                                  | `contracts.yaml`                        |
| GraphQL graph, subgraph, client operation                    | `graph:` `sg:` `gql:`                                   | `graphs/<graph>.yaml`, `contracts.yaml` |
| screen                                                       | `scr:`                                                  | `screens.yaml`                          |
| schema                                                       | `sch:`                                                  | `contracts.yaml`                        |
| handler                                                      | `h:`                                                    | `handlers/<component>.yaml`             |
| relationship (evidenced, no handler detail)                  | `rel:`                                                  | `system.yaml`                           |
| evidence item                                                | `ev:`                                                   | `evidence/`                             |
| team, actor, area, flow, journey, plan, programme            | `team:` `actor:` `area:` `flow:` `jny:` `plan:` `prog:` | their files                             |

**Children** are addressed as `<parent>#<child-id>`, and the child id is declared on the child, never taken from
its name or position:

- schema field `sch:plan-response#plan-status`;
- screen region `scr:car-plan-editor#apply-actions`;
- step `h:apply-car-plan#tx/queue/outbox` (step ids are unique among siblings; the path joins them);
- failure `h:apply-car-plan#!db-down`.

Rules:

- `msg:` is what is published; `sub:` is one component receiving it (group, filter, concurrency, retry,
  dead-letter). `publish` targets `msg:`; message handlers start at `sub:`.
- `job:` is only an entry (schedule or trigger). The thing that runs it is a `svc:`.
- `ui:` is an interaction; `scr:` is what a person sees.
- **Aliases.** `aliases.yaml` maps retired ids to a successor, or to `null` with a reason. Reads resolve through
  it, a check warns on use, and the id-rewrite tool updates domains, landscape, programmes, plans, progress,
  revisions, base locks, flows, journeys and every `[[id]]` text link in one commit.
- All id parsing and building lives in `src/domain/ids.ts`.

## 4. Committed layout (per workspace)

```
workspace.yaml                         # name, teams, actors
aliases.yaml
language.yaml                          # agreed workspace-level key terms
landscape.yaml                         # areas and value flows
externals.yaml  libraries.yaml
graphs/<graph>.yaml                    # federated graph: subgraphs, composition, federation facts
domains/<dom>/domain.yaml
domains/<dom>/language.yaml            # bounded-context concepts (born_in, aka)
domains/<dom>/target.yaml              # cross-system target architecture for the domain
domains/<dom>/systems/<sys>/system.yaml        # identity, homes, components, summary, relationships
domains/<dom>/systems/<sys>/contracts.yaml     # interfaces, entries, messages, operations, schemas
domains/<dom>/systems/<sys>/screens.yaml       # screens and regions (no executable entries)
domains/<dom>/systems/<sys>/handlers/<component>.yaml
domains/<dom>/systems/<sys>/narratives.yaml    # optional
flows/*.yaml  journeys/*.yaml  programmes/*.yaml
plans/<plan>/plan.yaml  progress.yaml  revisions/  assets/  mockups/
evidence/<org>/<repo>/                 # scan output; repository.json is the only commit pin
```

Removed: component entries in `contracts.yaml`; `talks_to`; store `access` and message `producer`/`consumers`
(each becomes handler detail or a cited relationship, §4.6); `story.yaml`; `key_journeys` and `tier` unless a
view adopts them; the legacy explorer; `scans/` marks; `MAP.md` (generated); `knowledge` v1–v3; step `origin`.
Kept: `runs_on`, programmes, progress, revisions, assets, domain targets and both glossaries.

### 4.1 `system.yaml`

```yaml
id: sys:assortment
name: Assortment
purpose: Decide which cars, options and prices each market can sell.
team: team:assortment
runs_on: [sys:application-platform]
mapped: true # false: known to exist, not yet scanned (replaces fake externals)
homes: # the ONLY place a repo is named
  pds: { repo: volvo-cars/pds-products }
  cdls: { repo: volvo-cars/cdls-mono-volvocars, path: apps/assortment }
components:
  - id: svc:assortment-admin-api
    name: Assortment admin API
    kind: service # service | app | store | topic   (docs/architecture.md)
    infrastructure: false # optional; true when it supports platform operation, not a business capability
    homes: [cdls] # defaults to the system's only home
    uses: [lib:volvo-messaging]
    does: Lets merchandisers build and apply car plans.
    cites: [cdls:src/Admin/Program.cs#L1-40]
  - id: st:assortment-admin-db
    name: Assortment admin database
    kind: store
    form: database # store: database | cache | bucket | warehouse | vector | managed
    tech: PostgreSQL # topic: stream | queue · app: web | mobile | admin
    owner: { id: svc:assortment-admin-api, cites: [ev:2c81d0] } # only when evidenced
    notes: Purged nightly. # store facts kept: layer, keyed_by, granularity, purge, invalidated_by
connections: # the LLM summary
  - to: sys:pricing
    says: Fetches list prices for every priced option when a plan is applied.
    backs: [h:assortment-admin-apply-car-plan#price] # handler steps, rel: or gql: ids
relationships:
  - id: rel:assortment-reads-cms-labels
    from: svc:assortment-admin-api
    to: ext:contentful
    kind: call # call | publish | consume | read | write
    says: Reads option labels from the CMS.
    reason: only client registration and configuration are in the scanned source
    cites: [ev:7f3a91]
```

- **A service has no role field.** Whether it serves APIs, consumes messages or runs jobs is derived from the
  entries it has (53 Volvo services have more than one).
- **Placement, ownership and code home are separate facts.** Placement is the system file the component sits in
  (every component has one; a resource with no evidenced owner sits in the system that operates it, owner
  omitted). Team ownership comes from the system. A resource's operational `owner` is a component, cited.
  Code homes are `homes`, possibly several.
- **Relationships** hold a link only when no handler detail exists for the same from, target and kind; a check
  rejects duplicates. Each states why detail is missing. This is also where today's stated producers,
  consumers and store access go when handlers do not reproduce them, cited to their contract sources.
- **Unmapped systems** are `sys:` with `mapped: false`, not externals. `externals.yaml` holds each true third
  party's identity and summary once (one LaunchDarkly). Its endpoints and SDK operations are interfaces in the
  consuming system's `contracts.yaml`. An interface has exactly one of `component: <svc:|app:>` or
  `external: <ext:>`; a third party used by several systems has its interface declared once, in the system that
  first wraps it, and others call those ids.

### 4.2 `contracts.yaml`

```yaml
interfaces:
  - id: if:assortment-admin
    component: svc:assortment-admin-api
    kind: rest # rest | grpc | graphql | sdk
    version: v1
    entries:
      - id: api:assortment-admin-car-plan-apply
        method: POST # rest: method + path
        path: /car-plans/{id}/apply
        summary: Applies a car plan.
        auth: merchandiser token
        idempotent: false
        request: sch:apply-plan-request
        response: sch:plan-response
        errors: [{ status: 404, when: the plan does not exist }]
  - id: if:assortment-graph
    component: svc:assortment-dgs
    kind: graphql
    subgraph: sg:assortment
    entries:
      - id: api:assortment-product-variant
        field: Query.productVariant # graphql: field + signature
        signature: 'productVariant(market: String!, id: UUID!): ProductVariantV1'
        response: sch:product-variant
  - id: if:cce-grpc
    component: svc:cce-car-configurator
    kind: grpc
    entries:
      - id: api:cce-select-car
        rpc: volvocars.contracts.carconfiguration.v2.CarConfigurationService/SelectCar
        request: sch:select-car-request
        response: sch:select-car-response
messages:
  - id: msg:variant-collection-created
    topic: top:product-service-events
    payload: sch:variant-collection-created
    key: collectionId
    semantics: event # event | command | state
subscriptions:
  - id: sub:assortment-cache-worker-on-collection-created
    component: svc:assortment-cache-worker
    message: msg:variant-collection-created
    group: assortment-cache
    when: Kafka consumption is enabled
    concurrency: 3
    delivery: { retries: 5, dead_letter: top:assortment-dlq }
jobs:
  - id: job:assortment-outbox-relay
    component: svc:assortment-admin-api
    every: 30s # or cron: "0 2 * * *", or trigger: free words
    when: Kafka publishing is enabled
interactions:
  - id: ui:car-plan-apply-click
    component: app:assortment-admin-web
    on: scr:car-plan-editor#apply-actions
    action: click
operations: # GraphQL documents a component sends
  - id: gql:car-configurator-get-plan
    component: app:car-configurator
    graph: graph:volvo-commerce
    document: ev:4be2a7 # resolver fields reached are derived, never authored
    screens: [scr:car-configurator]
schemas:
  - id: sch:apply-plan-request
    kind: dto # dto | record | payload | graph-type
    fields:
      - { id: plan-id, name: planId, type: string, required: true }
      - { id: options, name: options, type: { array: sch:plan-option } }
      - { id: headers, name: headers, type: { map: { key: string, value: string } } }
      - { id: payload, name: payload, type: { one_of: [sch:offer-activated, sch:offer-archived] } }
  - id: sch:assortment-admin-plan
    kind: record
    store: st:assortment-admin-db
    table: plans
    fields: […] # field `note` and `cites` kept
```

- Entries have protocol-specific shapes (rest: method/path; graphql: field/signature; grpc: rpc; sdk: call).
  Where today's free-text `sig` cannot be split, it is kept as `sig` and reported.
- Field types are a small tagged grammar (scalar name, `sch:` id, `array`, `map`, `one_of`, `enum`), so views can
  traverse API, storage and message schemas.

A schema's `store` may name a `st:` component or a `top:` component whose form is `queue` when the cited
code stores records or job payloads there. This records observed queue access without asserting a message
contract. A stream cannot be a record store.

### 4.3 `screens.yaml`

```yaml
screens:
  - id: scr:car-plan-editor
    app: app:assortment-admin-web
    kind: page # page | modal | sheet | print | email
    device: desktop
    route: /car-plans/{id}
    regions:
      - { id: apply-actions, name: Apply bar }
    assets: [{ figma: 'https://www.figma.com/…', region: apply-actions }]
```

### 4.4 `handlers/<component>.yaml`

```yaml
- id: h:assortment-admin-apply-car-plan
  component: svc:assortment-admin-api
  on: api:assortment-admin-car-plan-apply # api: | sub: | job: | ui:
  summary: Marks the plan Active and queues one Created event per collection, in one transaction.
  cites: [cdls:src/Admin/ApplyPlanHandler.cs#L16-46 ApplyPlanHandler.Handle]
  steps:
    - id: load
      read: sch:assortment-admin-plan
      from: st:assortment-admin-db
      cites: ['#L18-25'] # shorthand only when the handler cites one file
    - id: missing
      if: the plan does not exist
      then: [{ id: not-found, return: 404, cites: ['#L20-21'] }]
    - id: tx
      transaction: true
      steps:
        - {
            id: activate,
            say: Mark it Active,
            write: sch:assortment-admin-plan#status,
            to: st:assortment-admin-db,
            cites: ['#L26-29'],
          }
        - id: queue
          each: variant collection in the plan
          steps:
            - id: outbox
              say: Queue a Created event
              write: sch:assortment-admin-outbox
              to: st:assortment-admin-db
              causes: h:assortment-outbox-relay#publish
              cites: ['#L30-35']
    - id: price
      say: Fetch list prices
      when: the plan has priced options
      retry:
        until: prices are returned
        times: 3
        exhausted: [{ id: give-up, return: 502, cites: ['#L40-42'] }]
      steps:
        - { id: pause, wait: 2s, cites: ['#L36-39'] }
        - { id: call, call: api:pricing-get-price, cites: ['#L36-46'] }
  failures:
    - id: db-down
      when: the database is unavailable
      return: 503
      cites: ['#L44-46']
```

**Step shape** (one schema, enforced):

| Part      | Rule                                                                                                                                                                                                                                                                                                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`      | Required; unique among siblings; a short slug assigned once and then frozen.                                                                                                                                                                                                                         |
| `say`     | Optional headline, at most 60 characters. When absent, the view uses `does` if short, else the condition (`if`, `each`, `retry.until`), else a phrase built from the effect and target.                                                                                                              |
| `does`    | Optional detail of any length; shown in the inspector.                                                                                                                                                                                                                                               |
| effect    | At most one of `read`+`from`, `write`+`to` (the store or queue is always named), `call` (`api:` or `gql:`), `publish` (`msg:`), `wait` (a duration or words), `return` (a status or words). None means computation.                                                                                  |
| structure | At most one of `if`/`then`/`else`, `each`/`steps`, `parallel: [{ lane, steps }]`, `try`/`catch`/`finally`, `transaction`/`steps`, or `retry: { until, times?, exhausted?: Step[] }`/`steps`. `then`, `else`, `steps`, `catch`, `finally` and `exhausted` all hold the same step shape. `do` is gone. |
| modifiers | `when` (condition on one step), `async`, `causes` (an asynchronous follow-on: a step or handler elsewhere).                                                                                                                                                                                          |
| `cites`   | Required on every current-fact step with an effect. Plan projections may retain an implementation-evidence gap.                                                                                                                                                                                      |

`from` and `to` may name a `st:` component or a `top:` component whose form is `queue`; a stream is not a
read/write target. Preserve cited record access to queues as read/write effects and derive access edges from
them. Do not infer publication, a subscription, a message contract or asynchronous causation from queue
access. Declared message publication and subscriptions retain their existing forms.

Plan ops describe intended changes. Their added or changed behaviour is proposed, with attribution derived
from the plan and change containing the op. Implementation citations may be absent in a plan projection
and remain visible evidence gaps. Existing citations provide source context; they do not establish that
proposed behaviour is implemented. Current workspace facts continue to require effect citations. Proposal
attribution belongs beside the plan's before and after models; it is not authored as flags on steps.

Handler `failures` are addressable (`#!<id>`), cited, and use the same `when`/`return` as steps.

Derived, not stored: guard shape (`if` → `return`, no `else`), block roll-ups, step numbering for display,
callers of an entry, producers and consumers of a message, store access.

### 4.5 Citations

```ts
type RepoId = string; // "org/name" (github.com) or "host/org/name"
interface CodeHome {
  repo: RepoId;
  path?: string;
}
interface CodeRef {
  kind: 'code';
  repo: RepoId;
  commit: string;
  path: string;
  lines?: [number, number];
  symbol?: string;
}
interface EvidenceRef {
  kind: 'evidence';
  id: string;
}
type Cite = CodeRef | EvidenceRef;
type AuthoredCite = string; // "<homeKey>:<path>#L<a>-<b> [symbol]", optionally "@<commit>", or "ev:<id>"
// authored YAML: cites: AuthoredCite[]   (always a list; validated by the schema)
// WorkspaceModel after readModel: cites: Cite[]
```

- **Authored form**: `<homeKey>:<path>#L<a>-<b> [symbol]` or `ev:<id>`. Commit comes from `repository.json`;
  `@<commit>` overrides for history.
- **Evidence ids** are proposed from the evidence's repository, kind and stable signature when the record is first
  created, then persisted and never recomputed. Path, span, commit and excerpt may change without changing the id.
  A materially different fact gets a new `ev:` id; the retired one goes into `aliases.yaml`.
- Contract-level sources (route bindings, client registrations, config) are evidence too, so today's
  contract-backed facts can be cited.
- URLs are built only in `src/domain/code-links.ts` and never stored.

### 4.6 Derived on read (never stored)

| Fact                                                                                                 | Derived from                                                                                    |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| component → component edges                                                                          | handler effects, `on: sub:`, `causes`, `gql:` operations through the graph, and `relationships` |
| callers, consumers, producers, store access                                                          | the reverse of the above                                                                        |
| GraphQL fields an operation reaches                                                                  | the operation document plus graph composition                                                   |
| system → system edges                                                                                | component edges projected through placement                                                     |
| a service's roles (api, worker, job)                                                                 | the kinds of entry it has                                                                       |
| `owningTeam(id)`                                                                                     | the containing system's `team`                                                                  |
| `resourceOwner(id)`                                                                                  | the store or topic's `owner`                                                                    |
| `codeHomes(id)`                                                                                      | `component.homes`, else the system's only home                                                  |
| gaps: no caller, no consumer, no schema, no schedule, no owner, unmapped target, unbacked connection | the model                                                                                       |
| `MAP.md`, counts, freshness                                                                          | the model plus `repository.json`                                                                |

## 5. In memory

- **`WorkspaceModel`** (`src/domain/workspace-model.ts`): plain serialisable data. The only shape of "how things
  are", today or after a plan.
- **`apply(ops, model) → model`** (`src/domain/plan-apply.ts`). A plan is `{ plan, before, after }`.
- **`indexOf(model) → ModelIndex`** (`src/application/model-index.ts`), pure: `get`, `label`, `href`, `place`,
  `owningTeam`, `resourceOwner`, `codeHomes`, `cites`, `edges(id, {level, direction, kinds})`, `callers`,
  `entries`, `flowOf(entryId)`, `gaps`. Before and after each get one.
- **`plansIndex`** is separate (`plansTouching`), so the model index never depends on plans.
- **`readModel(ws)`** (`src/infrastructure/`), memoised with `untilEdited`. The browser receives serialised data
  and builds its own index; no functions cross the server/client boundary.
- **Deleted at the end:** `systemModelOf`, `SystemModel`, `Today.today`, "today as an approved plan",
  `collectionsOf`/`onBase`, separate `Service`/`Store` types, both `teamOf`, about 18 place maps,
  `domain/workspace-links.ts`.

## 6. Schemas

- **One authority per contract.** `schema/workspace.schema.json` (every authored model file, shared `$defs`) and
  `schema/plan.schema.json` (the overlay; ops target any id, including `h:…#step`, `sch:…#field`, `scr:…#region`).
  TypeScript types are generated from them and files are validated with Ajv; hand-written zod duplicates are
  removed.
- **`schema/evidence.schema.json`**: one per evidence family.
- Deleted after the new scan path is proven: `knowledge*`, `scan-discovery`, `scan-interpretation`.

## 7. Views

- **Entry flow view** for `api:`, `sub:`, `job:` and `ui:`, built from the mockup's node canvas:
  - **Top:** what starts it (callers, producers, schedule, screen) → entry card (shape per protocol, schemas,
    errors) → what it reaches, grouped by target, each linked back to its steps.
  - **Canvas:** effect icon and colour per step; labelled forks that rejoin; guards exit to the side; loops,
    lanes, try, transaction and retry are captioned boxes; `causes` draws a dashed "later" link; wide decisions
    stack.
  - **Inspector:** `does`, schema fields, condition, retry, failures, code links.
  - **Drill:** a `call`, `publish` or `causes` opens the next flow in place.
  - **Gaps** shown, never hidden.
- **Summary over detail:** connection sentence → `backs:` → steps → code.
- The method-level explorer is retired once the parity report (rebuild plan) has no unexplained item.

## 8. Size

| Category                 | Item                              | Now                 | After          | Condition                                       |
| ------------------------ | --------------------------------- | ------------------- | -------------- | ----------------------------------------------- |
| Delete: nothing reads it | `.groundwork/syntax/`             | 27 GB               | 0              | none                                            |
|                          | old corpus generation and orphans | 3.8 GB              | 0              | none                                            |
|                          | legacy explorer (committed)       | 9.3 MB, 1,728 files | 0              | parity report                                   |
| Retire                   | live `explorer/corpus`            | 3.6 GB              | 0              | parity report                                   |
| Compress                 | `.groundwork/analysis/`           | 3.5 GB              | about 0.35 GB  | §10.2                                           |
| Re-index                 | `.groundwork/evidence.sqlite`     | 8.9 GB              | about 1–2 GB   | every query regenerated                         |
| Normalise                | `evidence/`                       | 113 MB              | about 65 MB    | `file:` refs                                    |
|                          | `domains/`                        | 16 MB               | about 10–12 MB | one-line cites; ids and headlines add some back |
| Outside the workspace    | groundWork `reports/`             | 174 GB              | small          | inspect first                                   |

## 9. Migration in brief

The rebuild plan (`rebuild.md`) holds the order and proofs. The design-level rules are:

- **Step ids** are assigned once by the migration as readable slugs, unique among siblings: effect + target
  (`read-plan`, `call-pricing`; reads and writes include the store when needed), else a slug of the condition,
  else of `does`. If none is available, `step-<n>` after sorting siblings by code location (repo, path, start,
  end, control-flow path); equal or missing locations are collisions written to `step-ids.yaml`, never numbered
  automatically. Measured on Volvo, this leaves 1.6% numbered. After that they are opaque: the
  scan reconciles new output to existing steps by cited span and control-flow path, keeps matched ids, gives new
  steps new ids, tombstones removed ones, and reports ambiguous matches instead of guessing.
- **Headlines**: no LLM inside the migration. It writes a review file of the 4,223 long `does` with proposed
  `say`; accepted rows are applied deterministically.
- **`talks_to`**: 855 backed edges become `connections` with `backs:`; 48 contract-backed and 10 GraphQL-backed
  edges become relationships or `gql:` backs; 26 with weak or summary-only evidence and the 99 missing handler
  edges go to a review list. Nothing is invented.
- **Flows** stay anchored on components and entries; links to handler steps are optional (only about 11% map
  uniquely).
- **References**: about 4,000 prefixed ids and about 920 `[[id]]` text links are rewritten in one run, including
  landscape and plan ops (313 handler steps inside plan ops get ids by the same rule).

## 10. Decisions

1. **Explorer: retired**, replaced by the entry flow view, after the parity report.
2. **Analysis cache: committed compressed** (about 0.35 GB) until the scan can rebuild it. The reviewers
   preferred keeping it a cache and promoting only cited records to evidence; either way, every record the model
   cites is promoted to `evidence/`. _Reconfirm with the user._
3. **Coverage**: the scan fills missing request/response schemas from route bindings and type contracts,
   cited with `ev:`; what evidence cannot support stays a gap.

## 11. Not in this rebuild (POC scope)

- Content-addressed evidence across repo moves beyond the rule in §4.5.
- Automatic flow-to-step linking.
- Store `layer` as a separate model of gateways; it stays a store field until the graph view needs more.

## 12. What changed from revision 2

| Change                                                                                                                                        | Why                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `sub:` subscriptions separate from `msg:`                                                                                                     | Design review: one message, many receivers with different groups, conditions, retry.      |
| Readable step ids assigned once, then reconciled by span, never regenerated                                                                   | Design review: effect+target ids churn. Data: 1.6% numbered with sibling scope.           |
| Explicit ids on schema fields, screen regions and failures                                                                                    | Design review: plans already target `sch:…#field`.                                        |
| `ui:` declared only in `contracts.yaml`; `screens.yaml` has no entries                                                                        | Design review: two homes.                                                                 |
| `retry` is a block with `until`/`times`/`exhausted`; `wait` is an effect; `when`/`async` on effects                                           | Data: 65 retry blocks, 27 waits, 748 `when`, 483 `async`.                                 |
| `failures` with ids and cites                                                                                                                 | Design review and data: 1,516 `fails` entries.                                            |
| `say` optional with defined fallback                                                                                                          | Data: 56% of `does` already fit; conditions make good headlines.                          |
| No `shared.yaml`; every resource placed in a system                                                                                           | Design review: edges need placement. Data: all 17 shared resources have a placing system. |
| GraphQL: entries by field and signature; operations owned by a component with a document; `selects` derived                                   | Design review; data shows derivation works.                                               |
| Protocol-specific entry shapes; `sig` kept when unsplittable                                                                                  | Data: about 70 signature shapes.                                                          |
| Tagged field types                                                                                                                            | Design review: `Map<…>`, `oneof(…)` not traversable.                                      |
| No service `as`; roles derived from entries; `form` only for stores, topics and apps                                                          | Data: 53 services have mixed entries.                                                     |
| Unmapped Volvo systems as `sys:` with `mapped: false`                                                                                         | Data: about 55 fake externals.                                                            |
| `owningTeam`, `resourceOwner`, `codeHomes` replace `owner`/`codeHome`; owner cited                                                            | Design review; data: 14 owners unevidenced.                                               |
| Relationship invariant: none where handler detail exists; holds uncovered producers/consumers/access                                          | Design review; data: handlers cover only about 75–85%.                                    |
| `cites` always a list (authored strings, resolved to `Cite`); evidence ids persisted once, never recomputed                                   | Design review and consistency check.                                                      |
| Keep `runs_on`, domain `language.yaml` and `target.yaml`                                                                                      | Design review: architecture defines them.                                                 |
| Keep endpoint `auth`, `idempotent`, `summary`; message `semantics`; store fields; field `note`; screen kind/device/route; infrastructure flag | Data: rev 2 would have lost them.                                                         |
| Externals keep identity only; their interfaces sit in the consuming system with `external:`                                                   | Consistency check: interfaces need one home.                                              |
| `infrastructure` flag defined; `retry.exhausted` defined; example fully cited; deterministic `step-<n>` fallback                              | Consistency check.                                                                        |

### PR6 implementation correction: queue record access

The read-only migration preflight found four schemas and nine explicit read/write effects (one read, eight
writes) against two queues, with no corresponding declared message contracts. Queue ids still become `top:`,
while schemas and read/write effects may reference queues. Semantic validation rejects stream targets. The
measured cases, exact source lines and original schema failures are recorded in
`artifacts/rebuild/pr6-design-amendment.md` and `artifacts/rebuild/verification/pr6/queue-compatibility.json`.
This preserves existing cited facts under the user's instruction to apply evidence-based corrections.

### Approved clarification: plan implementation evidence

The user approved the narrow plan-provenance amendment on 6 November 2026, after three independent
reviews. The current-fact and plan-projection validation profiles share one schema authority and structural
model. Only the schema's explicitly annotated implementation-evidence requirement differs. Projection
validation checks the current base strictly and computes the after model from the plan; it never accepts
an arbitrary after model as current facts. The evidence and review are recorded under
`artifacts/rebuild/pr6-plan-provenance/`.
