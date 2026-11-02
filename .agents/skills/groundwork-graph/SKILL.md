---
name: groundwork-graph
description: Map federated GraphQL schemas, subgraphs and operations, and plan graph changes in Groundwork's production workspace model.
---

# Mapping a federated graph

This workflow writes the production YAML model. For question-led GraphQL client/source bindings, use
[groundwork-explore](../groundwork-explore/SKILL.md) in scan mode. Use existing authorised graph evidence;
a missing registry or resolver is an explicit gap, not permission to restart a stopped scan.

Goal: `graphs`, `subgraphs`, `operations`, `graph-type` schemas and layered cache stores in the system model,
each with `sources`, so the app can derive the query plan, response policy and cache path. Rules:
[legacy schema](../groundwork-schema/legacy-yaml.md#ground-rules) rule 15 and [cookbook](../groundwork-schema/cookbook.md)
§16–19. Ordinary components are still explored with [groundwork-explore](../groundwork-explore/SKILL.md).

Today's graph is extracted fact and lives in `domains/<d>/systems/<s>/contracts.yaml` of the system that owns
each part (the gateway's system owns the graph; each subgraph's system owns its subgraph and types). A plan that
changes the graph does so with ops on these ids; it never copies them.

## The loop

1. **Find the graph.** Locate the supplied registry evidence (GraphOS, Hive, WunderGraph) or composed
   supergraph SDL (the artefact the router loads). Ask only when a necessary input cannot be located in the
   authorised context. The `@join__graph` enum lists the subgraphs and their URLs; `@join__type` and
   `@join__field` say who owns what. One `graphs` entry, `gateway:` the gateway component. With no registry,
   compose from the subgraph SDLs.
2. **One explorer per subgraph repo**, as part of [groundwork-scan](../groundwork-scan/SKILL.md): the component,
   its stores, its REST calls, its resolvers as handlers, and the SDL file in `sources`. Per subgraph:
   `service` (the component that serves it; the schema key keeps its old name), `batching` (DataLoader present?), `cache_control_default`, `timeout_ms` (gateway traffic shaping).
3. **Types and fields.** Each type becomes a `graph-type` schema (`sch:gql-<name>`); the root `Query` has
   `root: query`. Per field, read the directives:
   - `@key(fields: "sku")` → `keys: [{ fields: [sku], in: [every subgraph that declares it] }]`, stubs too.
   - `@shareable` → `shareable: true`; two owners without it is a composition error.
   - `@provides(fields: "name")` → `provides: [sch:gql-product#name]`; `@requires` → `requires`.
   - `@override(from: "pricing", label: "percent(10)")` → `override: { from: sg:pricing, percent: 10 }`.
   - `@authenticated` or `@requiresScopes` → declared `auth: "…"`; establish effective enforcement and
     cache eligibility separately from the directives.
   - `@cacheControl(maxAge: 300)` → `cache_control: { max_age: 300 }`.
   - The resolver: records it reads → `reads`, a REST hop → `via: api:…`, a cache it asks first →
     `cache: [{ at, ttl }]`. Its full logic is a handler.
4. **Operations.** From the front end's persisted-query manifest or its `gql` tags: one `operations` entry each,
   `document` verbatim, `kind`, `method` (GET only for persisted queries sent as GET), `persisted`, `screens`,
   `trigger` (`load`, `click`, `scroll`, `submit` or `interval`). Mutations also take `writes`. Registry usage
   goes on fields as `usage: { clients, per_day, last_seen, source }`.
5. **Caches.** From the CDN and gateway config: the edge (`layer: edge`, `keyed_by`, `stale`, surrogate keys in
   `purge`), the gateway's entity cache (`layer: gateway`, `granularity: entity`), a cache in a subgraph
   (`layer: subgraph`). A cache with no `layer` is an ordinary store. An operation lifetime that differs from what
   its fields imply is `cache: [{ at, ttl, key, reason }]`, and the reason is required.
6. **Flows.** These are curated (`<workspace>/flows/`): propose them, do not overwrite. The step that sends
   the operation is `via: gql:…` with `to` the gateway and no `reads` or `writes`; the fan-out is derived. Purges
   are steps with `purges: [st:…]` after the event that triggers them.
7. **Validate and check.** `npm run workspace -- check <workspace>`, then open the operation in the app under `npm run dev` and compare the
   derived query plan with the registry's. Record the registry's numbers as
   `plan_check: { fetches, round_trips, source }`; a mismatch usually means a missed `@requires`, `@provides` or
   key.

## Planning a graph change

Write it as a plan ([groundwork-plan](../groundwork-plan/SKILL.md)): `add: subgraph`, `add: field into:
sch:gql-…`, `modify: "sch:gql-x#f" set: { override: … }`, `add: operation`, `modify: op:… set: { cache: … }`.
The cookbook's §16–19 recipes are the patterns: expand, migrate, then remove.

## Judgement

- Retain discovered subgraphs and distinguish source declarations from observed traffic. No usage evidence
  is not proof of absence; any scope exclusion needs a reason.
- Derive query-plan and cache results from their actual inputs. Missing configuration or implementation
  can explain a mismatch; do not invent a directive or runtime result.
- A regional cache key establishes partitioning, not public cache eligibility or identity enforcement.
  Keep declared field policy separate from verified router, cache and authorisation behaviour.
- Keep technical identities independent of team ownership. Missing ownership is a planning question, not
  a reason to discard a component or stop source mapping.
- Repeated resolver/binding gaps feed the shared [learning loop](../groundwork-scan/learning.md).

## Words for the room

operation, mutation, the graph, gateway, subgraph, owns a field, key, round trip, fetch, cache layer, edge, hit,
miss, fills, emptied by, serves stale, private field, persisted operation, batched, surrogate key. Write each
out in the plan's `problem.glossary`.
