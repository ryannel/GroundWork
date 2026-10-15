---
name: groundwork-graph
description: Map a federated GraphQL graph into the Groundwork system model and plan changes to it. Use when a system or plan touches a supergraph, a gateway or router, subgraphs, persisted queries or CDN and edge caching, and someone asks to map the graph, add operations, explain why a page is slow or uncached, or plan graph changes. Reads the registry or composed schema, the subgraph repos and the front end's operation manifest, writes graphs, subgraphs and operations into the owning system's contracts.yaml, and plan changes as ops.
---

# Mapping a federated graph

Goal: `graphs`, `subgraphs`, `operations`, `graph-type` schemas and layered cache stores in the system model,
each with `sources`, so the app can derive the query plan, response policy and cache path. Rules:
[groundwork-schema](../groundwork-schema/SKILL.md) rule 15 and [cookbook](../groundwork-schema/cookbook.md)
§16–19. Ordinary components are still explored with [groundwork-explore](../groundwork-explore/SKILL.md).

Today's graph is extracted fact and lives in `domains/<d>/systems/<s>/contracts.yaml` of the system that owns
each part (the gateway's system owns the graph; each subgraph's system owns its subgraph and types). A plan that
changes the graph does so with ops on these ids; it never copies them.

## The loop

1. **Find the graph.** Ask for the registry (GraphOS, Hive, WunderGraph) or the composed supergraph SDL (the
   artefact the router loads). The `@join__graph` enum lists the subgraphs and their URLs; `@join__type` and
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
   - `@authenticated` or `@requiresScopes` → `auth: "…"`; it makes every operation selecting it private.
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
6. **Flows.** These are curated (`workspaces/<ws>/flows/`): propose them, do not overwrite. The step that sends
   the operation is `via: gql:…` with `to` the gateway and no `reads` or `writes`; the fan-out is derived. Purges
   are steps with `purges: [st:…]` after the event that triggers them.
7. **Validate and check.** `npm test`, then open the operation in the app under `npm run dev` and compare the
   derived query plan with the registry's. Record the registry's numbers as
   `plan_check: { fetches, round_trips, source }`; a mismatch usually means a missed `@requires`, `@provides` or
   key.

## Planning a graph change

Write it as a plan ([groundwork-plan](../groundwork-plan/SKILL.md)): `add: subgraph`, `add: field into:
sch:gql-…`, `modify: "sch:gql-x#f" set: { override: … }`, `add: operation`, `modify: op:… set: { cache: … }`.
The cookbook's §16–19 recipes are the patterns: expand, migrate, then remove.

## Judgement

- Only what runs: skip subgraphs that compose but receive no traffic unless a plan touches them.
- Never author fetches, round trips or lifetimes; if you are tempted, a directive is missing.
- Privacy comes from `auth` on a root field (`Query.me`), never from "per region". A key that includes the region
  is public and cached per region.
- Say who to call: every subgraph's component has a team; a graph without owners cannot be planned.

## Words for the room

operation, mutation, the graph, gateway, subgraph, owns a field, key, round trip, fetch, cache layer, edge, hit,
miss, fills, emptied by, serves stale, private field, persisted operation, batched, surrogate key. The
`storefront-graph` plan in alder-finch writes each out in `problem.glossary`.
