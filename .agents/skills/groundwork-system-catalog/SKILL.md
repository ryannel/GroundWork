---
name: groundwork-system-catalog
description: >
  Builds and updates evidence-backed Groundwork system catalogs from Backstage,
  System Atlas, service repositories, API specifications, database schemas, and
  messaging contracts. Use this skill whenever work involves importing a software
  system, mapping microservices, cataloging callers or dependencies, documenting
  databases, caches, queues, topics, request/response schemas, or researching data
  at rest and in motion across repositories. It enforces a low-token discovery
  workflow: reuse extracted evidence first, shallow-clone only unresolved sources,
  fan cross-repo research out to lower-cost agents, and return normalized JSON
  instead of raw source dumps.
compatibility: Requires jq, git, and Python 3. Uses GitHub CLI and app-native child sessions when available.
---

# Groundwork System Catalog

Build a runtime catalog that answers six questions for every component:

1. Who calls it?
2. What does it call?
3. Which platform capabilities does it use?
4. Where does it store data?
5. Which messages does it publish or consume?
6. What do the request, response, message, and stored records look like?

Evidence matters more than apparent completeness. A named Redis key with unknown fields is
better catalog data than a fabricated document schema.

## Use the dimensions independently

Do not flatten runtime context into one label such as “third-party dependency.”

| Dimension | Examples |
|---|---|
| Direction | inbound caller, outbound dependency |
| Architectural role | business service, platform capability, external provider |
| Ownership | internal, external |
| Transport | HTTP, RPC, SDK, event, queue, stream |
| Resource kind | database, cache, object storage, queue |
| Data surface | request, response, message, stored record |
| Provenance | Backstage, Atlas, source path, commit SHA |

This distinction keeps classifications useful:

- LaunchDarkly is an external **platform capability**.
- Redis is a **datastore/cache**.
- Kafka is **messaging infrastructure**.
- A partner quote API is an **external provider**.
- An internal downstream microservice is an outbound **dependency**.
- A Git repository is provenance, not a runtime dependency.

Read [`references/taxonomy.md`](references/taxonomy.md) when classification is ambiguous.

## Produce these artifacts

Keep discovery state outside the source repository unless the user requests otherwise.

1. **`coverage.json`** — one component row per evidence area, marked `complete`,
   `partial`, `missing`, or `stale`.
2. **`discoveries/<repository>.json`** — normalized evidence from one repository at one
   revision.
3. **`catalog-summary.md`** — concise merge report listing imported records, conflicts,
   explicit gaps, and remaining source work.

Workers return JSON. They do not return raw source dumps or long architecture prose.

Use the contract in
[`references/normalized-output.md`](references/normalized-output.md). Validate every
discovery before merging:

```sh
python .agents/skills/groundwork-system-catalog/scripts/validate_output.py \
  path/to/discovery.json
```

## Workflow

### 1. Establish the runtime boundary

Resolve the canonical Backstage System or equivalent before creating a Groundwork
workspace or product. Team workspaces, repository managers, monorepos, and similarly
named systems are not interchangeable.

Record the canonical ID, display name, owner, domain, authoritative source, revision, and
member components.

### 2. Build coverage before reading source

Query existing Groundwork records, System Atlas artifacts, Backstage entities, and
repository registries with `jq`, SQL, and narrow `rg` searches.

`coverage.json` contains:

```json
{
  "system": "price-engine",
  "observedAt": "2026-09-11T00:00:00Z",
  "components": [{
    "id": "gpe-price",
    "revision": "full-sha",
    "coverage": {
      "membership": "complete",
      "api": "complete",
      "contracts": "partial",
      "inbound": "missing",
      "outbound": "complete",
      "datastores": "partial",
      "messaging": "missing"
    },
    "gaps": ["Stored document fields have not been resolved"]
  }]
}
```

The manifest decides which repositories need research. Do not inspect every member
repository automatically.

### 3. Reuse structured evidence

Search in this order:

1. Existing Groundwork component records.
2. System Atlas JSON, SQLite facts, extraction reports, and commit metadata.
3. Backstage System, Component, Resource, API, and Location entities.
4. Repository registries such as `ooe-workspaces`.
5. Shallow local clones for every repository selected for source-level investigation.
6. Remote GitHub calls only for discovery metadata, one small descriptor, or when a
   clone is impossible.

Select only the required fields:

```sh
jq '{service, endpoints}' catalog/component-api.json
jq '.contracts | keys' catalog/component-contracts.json
jq '.flows[] | {target, name, description}' catalog/component-flows.json
```

Stop when authoritative evidence answers the open manifest cell.

### 4. Clone every selected source repository

The coverage manifest prevents indiscriminate cloning. Once it selects a repository
because source-level evidence is still missing or stale, inspect that repository from a
local clone rather than browsing code file-by-file through GitHub APIs or MCP. A clone
pays the network cost once, then enables fast `rg`, parsers, language tools, and parallel
workers without repeated remote round trips or token-heavy source payloads.

Reuse an existing local clone or configured project first. Otherwise shallow-clone the
selected repository:

```sh
gh repo clone OWNER/REPO TARGET -- --depth 1 --filter=blob:none
```

Do not clone every member of a large system preemptively. Clone the subset selected by the
coverage manifest. Use local `rg`, narrow file reads, and ecosystem parsers, and record
the checked-out commit SHA before extraction.

Remote GitHub access remains useful for resolving repository identity, checking archive
state, or reading one Backstage descriptor before source scope is known. It is a discovery
mechanism, not the normal source-analysis environment.

### 5. Fan cross-repo research out

Cross-repository source discovery belongs in separate low-cost contexts because raw code
destroys the coordinator’s context budget.

Use one worker per unresolved repository. Give it:

- repository path and commit SHA;
- only the missing or stale coverage cells;
- the normalized-output reference;
- the output path;
- a requirement to validate the JSON before returning.

Use a fast lower-tier model for deterministic extraction. App-native child sessions are
preferred when the repository is configured as a project; otherwise use a shallow scratch
clone with a local explore agent. Confirm before cloning unless the user already
authorized source discovery.

Use this worker prompt structure:

```text
Inspect REPOSITORY at REVISION.
Resolve only these gaps: GAPS.
Reuse existing manifests/specs before reading implementation code.
Write strict JSON matching NORMALIZED_OUTPUT to OUTPUT.
Include exact path, lines, revision, and claim for every nontrivial fact.
Leave unresolved fields in gaps; do not infer them.
Return only normalized JSON and a one-paragraph completion summary; never return raw
source dumps.
Run validate_output.py before reporting completion.
```

### 6. Extract data contracts

#### Data in motion

For synchronous APIs capture version, method, path, request type, response type, nested
fields, and evidence.

For messaging capture broker, queue/topic, producer/consumer direction, message name,
fields, ordering, retries, dead-letter behavior, and evidence.

#### Data at rest

Capture technology, table/keyspace/document name, key pattern, access mode, TTL, root
serialized type, nested fields, and evidence.

Do not assume a datastore value matches a similarly named API DTO. Resolve the serializer
or record definition. When it cannot be resolved, preserve the known key, purpose,
access, TTL, and an explicit field-structure gap.

### 7. Validate and merge

Validate each worker output before it enters the catalog. Merge by canonical identity and
revision. Newer evidence replaces older evidence only when it is at least as authoritative.
Surface conflicting claims in `catalog-summary.md`.

After writing Groundwork data:

1. regenerate JSON schemas when the model changed;
2. rebuild the runtime validator;
3. validate the repository plan;
4. run targeted content and relationship tests;
5. rebuild the viewer;
6. restart the Hub when runtime schemas changed;
7. verify representative components in the live browser.

## Evidence standard

Each claim includes:

- repository identity;
- full commit SHA;
- repository-relative path;
- line range when available;
- a precise statement of what the evidence proves.

Distinguish:

- **explicit fact** — declared by a catalog, specification, schema, serializer, or
  executed call site;
- **curated resolution** — identity mapping with confidence and provenance;
- **gap** — evidence is missing, stale, contradictory, or insufficient.

Registered-but-unused clients do not prove runtime dependencies. API responses do not
prove datastore schemas. Names do not prove ownership.

## Cost failure modes

### Scanning everything in the coordinator

Raw source and large JSON catalogs consume the main context before synthesis begins.
Build a coverage manifest, fan unresolved repositories out, and return normalized JSON.

### Browsing selected source through remote APIs

Repeated remote search and file reads add latency, truncate context, restrict local
tooling, and duplicate source payloads in tokens. Once the manifest selects a repository,
shallow-clone it and perform discovery locally.

## UI projection

Store the independent dimensions; let the viewer project them.

- Primary groups: **Callers**, **Dependencies**, **Platform capabilities**,
  **Datastores**, and **Messaging**.
- Secondary badges: ownership, role, transport, technology, and confidence.
- Hide empty groups rather than rendering large zero-state panels.
- Keep source repositories outside runtime relationship groups.
- Show datastore and message schemas in place.
- Navigate referenced API models in one schema pane with breadcrumbs.
- Render gaps explicitly: “record observed; fields not extracted.”

## Quality standard

### Unacceptable

```json
{
  "name": "Pricing Redis",
  "kind": "cache"
}
```

This proves only that a cache name exists.

### Required depth

```json
{
  "id": "pricing-redis",
  "kind": "cache",
  "technology": "Redis",
  "access": ["read"],
  "records": [{
    "id": "market-settings",
    "name": "MarketSettings-{MARKET}",
    "kind": "keyspace",
    "keyPattern": "MarketSettings-{upper-case market}",
    "fields": [],
    "evidence": [{
      "path": "Providers/Redis/MarketSettingsProvider.cs",
      "lines": "10-28",
      "revision": "full-sha",
      "claim": "Normalizes the market key and reads the Redis string document"
    }]
  }],
  "gaps": [{
    "area": "records.market-settings.fields",
    "reason": "The serialized document type was not resolved"
  }]
}
```

The required form is useful despite incomplete fields because it preserves the observed
data boundary and states exactly what remains unknown.

## Completion standard

Complete the pass when:

- the runtime boundary is authoritative;
- `coverage.json` records every included component and evidence area;
- source research occurred only for unresolved cells;
- each repository discovery validates against the normalized contract;
- callers and dependencies have explicit direction;
- platform capabilities and external providers remain distinguishable;
- datastores, queues, topics, APIs, messages, and stored records include shapes where
  evidence exists;
- gaps remain visible instead of being filled by inference;
- the Groundwork plan validates and representative live views are coherent;
- `catalog-summary.md` lists remaining gaps and conflicts.
