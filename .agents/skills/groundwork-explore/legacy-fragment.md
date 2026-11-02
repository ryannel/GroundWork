# Legacy repository fragment

## Inputs

- the clone path (outside the Groundwork repo, normally `~/.cache/groundwork/clones/<org>/<name>`) and its HEAD;
- the repo id as `system.yaml` writes it (`org/name` on github.com, `host/org/name` elsewhere);
- the workspace, domain and system it belongs to, and the owning team;
- **the ids table**: every id the workspace already has for this system, with its natural key (below) and the
  files it cites, plus the ids of other systems this repo is likely to call or consume;
- for a re-scan, the work list from `tools/scan-diff.ts`: facts to re-explore, files to explore, facts that may
  have vanished, paths renamed. Also follow changed helper, policy, configuration, schema, generated-code and
  library inputs into the endpoint analyses that depend on them. Unchanged cited lines do not establish
  unchanged behaviour; when dependency tracking is incomplete, re-explore the containing package or repo.

## Output

One YAML file at the path you are given (normally `~/.cache/groundwork/fragments/<ws>/<org>/<name>.yaml`; never
inside a workspace), shaped like the system model so the merge can place each entry:

```yaml
repo: acme/pricing
commit: 3f9c2e1a… # the full HEAD you read
system: price-engine
components: [...] # services, apps, jobs: id, name, type, tech, does, summary
stores: [...] # databases, caches, topics, queues, buckets: id, name, kind, tech, owner, does
interfaces: [...] # id, component, protocol, endpoints: [{ id, sig, request, response, auth, idempotent, errors }]
schemas: [...] # records (with store), dtos, payloads; fields with key, ref, default, unique
messages: [...] # id, topic, producer, consumers, payload, key, semantics
screens: [...] # for a repo that serves a UI
handlers: [...] # see handlers.md
vanished: [...] # re-scan only: ids from the work list you confirmed are gone, with why
questions: [...] # { id: q:…, question, evidence? }
```

Fields and enums follow `schema/plan.schema.json` (`$defs`): read it for every key you write, because objects
are closed. Every source-backed fact carries `origin: extracted`; keep contextual interpretations in their separate inferred sidecar/report. Fragments do not validate on their own; the orchestrator
merges and validates. Check the YAML parses.

**Endpoint control and data flow are core scan outputs.** Read [endpoint-flow.md](endpoint-flow.md) for every
REST API scan. Return the normal fragment plus a companion `<fragment-stem>.endpoint-analysis.yaml` in the
fragment directory. It records each endpoint's control flow, step-level value bindings, storage shape,
outcomes, evidence and unresolved boundaries. The companion is a scan artefact: the current workspace schema
does not accept it. Do not add its keys to `contracts.yaml` or `handlers.yaml`. The scan report must distinguish
what the current model can hold from information retained only in the companion.

## Every fact cites the code that proves it

```yaml
sources:
  [
    {
      repo: acme/pricing,
      path: src/main/kotlin/pricing/PriceRoutes.kt,
      lines: [40, 88],
      commit: 3f9c2e1a…,
      symbol: PriceRoutes.getPrice,
    },
  ]
```

`repo`, `path`, `lines` (`[from, to]`, both inclusive, counted from 1) and `commit` (the full 40-character sha)
are required; `symbol` is the function or class when there is one. Never write a `url`: the app derives the
permalink. Cite the lines you read, not a guess, and never a branch.

From the clone, let the tool write them:

```bash
node tools/permalink.ts <clone> src/price/PriceRoutes.kt:40-88@PriceRoutes.getPrice   # paste-ready sources: [...]
node tools/permalink.ts <clone> --grep '@KafkaListener|consumer\.subscribe' src          # candidates, with lines
node tools/permalink.ts <clone> --url src/price/PriceRoutes.kt:40-88                      # the link, to check by eye
```

It warns when the path is not at HEAD, the lines run past the end, or the file has local changes. Which lines
to cite:

| Fact         | Cite                                                            |
| ------------ | --------------------------------------------------------------- |
| component    | its entrypoint (`main`, the app module, the Dockerfile `CMD`)   |
| store        | the migration, Terraform or config that declares it             |
| endpoint     | the route and its handler                                       |
| schema       | the migration or model class                                    |
| message      | the publish call, and the schema or Avro file                   |
| handler      | the handler function, start to end                              |
| handler step | the line or block that makes the call, the decision or the loop |
| question     | the code that raised it, as a link in the text                  |

## Stable ids

Ids are what plans, flows and journeys point at, so a re-scan must give the same thing the same id.

1. **Reuse first.** Work out the natural key of what you found and look it up in the ids table. If it is there,
   use that id, even if you would have named it differently.

   | Fact               | Natural key                                                               |
   | ------------------ | ------------------------------------------------------------------------- |
   | component (`svc:`) | repo + the deployable (its image, host or app name)                       |
   | store (`st:`)      | owner + the store's name in config (database, cache, topic, bucket)       |
   | interface (`if:`)  | component + protocol                                                      |
   | endpoint (`api:`)  | component + METHOD + path template (`GET /prices/{sku}`), or the RPC name |
   | schema (`sch:`)    | component + type or table name                                            |
   | message (`msg:`)   | topic + event name (+ version)                                            |
   | handler (`h:`)     | what starts it: its `on`                                                  |

2. **New things get a mechanical name**, `<prefix>:<kebab-slug>`, lower case, from the key: `api:pricing-get-price`
   for `GET /prices/{sku}` on `svc:pricing`, `sch:pricing-price-rule` for table `price_rule`, `msg:price-published`
   for `price.published`. Handlers follow what starts them:
   - an endpoint: `on: api:<id>` and `h:` + the endpoint's slug, so `api:pricing-get-price` → `h:pricing-get-price`;
   - a consumer: `on: msg:<id>` and `h:<component>-on-<message slug>`, so `h:search-on-price-published`;
   - a job: `on: "job:<cron or name>"` and `h:<component>-<job slug>`, so `h:pricing-nightly-rebuild`;
   - a UI action: `on: ui:<interaction slug>` and `h:<app>-<action slug>`.
3. **Never renumber or rename.** If the code renamed something but its key is otherwise the same (a path moved, a
   class renamed), keep the old id and say so in the summary. A different key is a different thing: a new id, and
   the old one goes in `vanished` if the code no longer has it.
4. **Things you call but do not own** are referenced by the ids you were given. If you cannot find the id, do not
   invent one for another system; see "Calls you cannot resolve" in [handlers.md](handlers.md).

`schema/plan.schema.json` wins where these notes and the schema differ.

## Where facts live

| Fact                  | Look at                                                                                | Becomes                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| what runs             | Dockerfile, compose, Helm, k8s, Procfile, `main`/`cmd/`, cron, serverless config       | `components[]` (`type`: service, website, app, job, external)                                 |
| who owns it           | CODEOWNERS, README, team labels, on-call config                                        | a `question` if it disagrees with the system's team                                           |
| data                  | migrations, ORM models, schema.sql, proto, Terraform for databases, caches and buckets | `stores[]` (with `tech`), `schemas[]` `kind: record` with `fields`                            |
| APIs                  | routers, controllers, OpenAPI or proto, GraphQL SDL                                    | `interfaces[]` + `endpoints[]` (`sig`, `request`, `response`, `auth`, `idempotent`, `errors`) |
| messages              | producers and consumers, topic constants, Avro or JSON schemas, outbox tables          | `stores[]` `kind: topic` + `messages[]` (`producer`, `consumers`, `payload`, `semantics`)     |
| who calls whom        | HTTP and gRPC clients, SDK imports, environment variables holding URLs                 | `call` steps in handlers                                                                      |
| what runs when called | the body of every business endpoint, consumer, job and UI action                       | `handlers[]`, see [handlers.md](handlers.md)                                                  |
| what people see       | routes and pages, email, push and print templates                                      | `screens[]` with `route`, `device`, `regions`                                                 |

## Judgement calls

- **Only what runs.** Commented-out code, stubs that return nothing and README promises are not facts. Say "stub:
  returns an empty list" in `summary`; dead code is a `question` at most.
- **Every component and store gets a `does`**: its role in plain words a newcomer understands, at most ten words,
  sentence case, no code names or tech ("Prices every item for each store"). Technical detail goes in `summary`.
  `system.yaml` may override `name` and `does`; your text is the fallback, so still write it well.
- **Keep technical boundaries separate from ownership.** Identify running services/apps from entrypoints and
  deployment declarations. A team module inside a shared host does not establish another running component.
  In legacy mode, preserve existing curated grouping and propose corrections rather than silently splitting
  components by CODEOWNERS. Raise ownership disagreements as questions.
- **Storage is a kind of component.** The legacy format writes buckets, object stores and warehouses in
  `stores[]` (`kind: bucket` or `warehouse`), rather than `components[]`. Reading or writing them projects to a
  `read`/`write` handler step. Canonical mode uses runtime components and explicit resource bindings. Do not
  classify a database as an external service merely because its client uses a network.
- **Libraries run in their caller.** Keep the package, declared/resolved version and implementation source in
  the endpoint analysis when a library supplies behaviour, inherited fields, middleware or client policy.
  Never draw it as a network call. A nearby repository revision is not proof of the imported artefact's code.
- **Incomplete messaging remains visible.** Today's schema requires each topic to have a message. If its
  producer, payload or consumer cannot be resolved, retain the discovery and the endpoint's publication or
  continuation in the companion/report; do not discard it or invent a message to satisfy the validator.
- **Keep operational endpoints identifiable.** `/health`, `/metrics` and `/ready` may be shown separately from
  business endpoints, but retain their registration and effects. Any excluded scope is explicit in coverage.
- A payload never stored is `kind: payload`; a DTO on an API is `dto`; only stored things are `record` (and need a
  `store`). A session store is a `cache`.
- A store only this repo uses belongs here with this component as `owner`; if another repo probably owns it,
  declare it anyway and raise a question.
- When the repo serves a UI, trace each action through its requests to the visible result
  ([granular journeys](../groundwork-mockup/journey-granularity.md)): a page request is not a click.
- A question with evidence puts the permalink (`node tools/permalink.ts <clone> --url …`) in its text.

## Return

The fragment path and five lines: components, stores, endpoints, messages and handlers found (new, re-explored,
vanished), calls you could not resolve, and open questions.
