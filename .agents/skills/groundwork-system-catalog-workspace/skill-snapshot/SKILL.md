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
---

# Groundwork System Catalog

A system catalog explains a runtime component in context:

- who calls it;
- what it calls;
- which platform capabilities and infrastructure it uses;
- what data crosses its boundaries;
- what data it stores;
- which evidence supports each claim.

Repository ownership, runtime direction, architectural role, transport, and data shape
are independent dimensions. Collapsing them into labels such as “third-party dependency”
produces misleading catalogs. Preserve each dimension separately so the UI can present
the relationship users need without destroying the underlying meaning.

## Scope

Use this skill for:

- importing a Backstage System into Groundwork;
- enriching a component from System Atlas;
- mapping a microservice estate across repositories;
- adding inbound callers, outbound dependencies, datastores, caches, queues, topics,
  APIs, events, or message schemas;
- investigating missing or stale system-catalog evidence;
- updating the Groundwork component inspector or its repository-owned data.

Do not use this skill for feature-scoped API or storage design. Component catalogs record
the observed current service boundary. Feature plans describe a proposed change.

## Mental model

### Runtime context

Use these primary categories:

| Category | Question |
|---|---|
| Callers | Which components call or require this component? |
| Dependencies | Which business services or providers does it call? |
| Platform capabilities | Which operational platforms does it use, such as feature flags, identity, observability, or secrets? |
| Datastores | Where does it hold data at rest? |
| Messaging | Which queues, topics, or streams carry data in motion? |
| API contracts | Which synchronous request and response schemas cross its boundary? |

Use ownership and provenance as secondary metadata:

- `internal` or `external`;
- `business-service`, `platform-service`, or `external-provider`;
- HTTP, RPC, event, queue, stream, SQL, Redis, or object storage;
- source repository, revision, path, and confidence.

LaunchDarkly is an external **platform capability**, not an undifferentiated third-party
business dependency. Redis is a **datastore/cache**. Kafka is **messaging infrastructure**.
A partner quote API is an **external provider**. An internal downstream microservice is a
**dependency**. The same ownership label can apply across several roles, so ownership
cannot replace role.

### Data contracts

Treat data in motion and data at rest as separate surfaces:

- **Synchronous motion**: endpoint method/path, version, request model, response model,
  nested types, required fields, and source evidence.
- **Asynchronous motion**: broker, topic/queue, producer, consumer, message name, message
  fields, delivery semantics, and source evidence.
- **At rest**: technology, keyspace/table/document/record name, access mode, key pattern,
  TTL, fields, nested types, and source evidence.

An observed record with unknown fields remains useful. Record its name, purpose, key
pattern, access mode, and the explicit schema gap. Never invent fields to make a datastore
look complete.

## Evidence order

Search from cheapest and most structured evidence to most expensive:

1. Existing Groundwork component records.
2. System Atlas catalogs, SQLite facts, extraction reports, and commit metadata.
3. Backstage System, Component, Resource, API, and Location entities.
4. Repository registries such as `ooe-workspaces`.
5. Local source clones, manifests, OpenAPI/AsyncAPI files, migrations, serializers,
   generated clients, and provider code.
6. Remote GitHub reads only when no local clone or extracted artifact exists.

Stop when the required claim is supported. More source reads do not improve a claim that
already has authoritative evidence.

## Cost-controlled workflow

### 1. Define the catalog boundary

Identify the Backstage System or equivalent runtime boundary before importing components.
Do not substitute a team workspace, repository manager, monorepo, or similarly named
system without evidence.

Record:

- canonical system ID and display name;
- owner and domain;
- authoritative source and revision;
- known member components;
- target Groundwork project/workspace.

### 2. Build a coverage manifest

Query structured local evidence with `jq`, SQL, and `rg`. Produce one row per component
and evidence type:

| Component | Membership | API | Contracts | Outbound | Inbound | Datastores | Messaging | Revision |
|---|---|---|---|---|---|---|---|---|

Mark each cell `complete`, `partial`, `missing`, or `stale`. This manifest determines
which repositories need further research. Do not open source repositories before this
step.

### 3. Reuse local data

Prefer:

```sh
jq '{service, endpoints}' catalog/component-api.json
jq '.contracts | keys' catalog/component-contracts.json
jq '.flows[] | {target, name, description}' catalog/component-flows.json
```

Select only required fields. Avoid printing whole contract catalogs into the main
conversation.

### 4. Clone only unresolved sources

When structured evidence has a real gap, shallow-clone the specific repository:

```sh
gh repo clone OWNER/REPO TARGET -- --depth 1 --filter=blob:none
```

Reuse an existing clone or configured project before creating another. Do not use GitHub
MCP file-by-file when a local clone is available. Search locally with `rg`, inspect narrow
line ranges, and record the checked-out commit SHA.

### 5. Fan out cross-repo research

Cross-repository discovery belongs in separate low-cost contexts so raw source does not
consume the coordinator’s window.

- Use one research session per repository when app-native project sessions are available.
- Use a fast lower-tier model for deterministic extraction.
- Give each worker one repository, one commit, the unresolved manifest cells, and the
  normalized output contract.
- Ask for strict JSON plus concise evidence, not a prose architecture report.
- Keep implementation and final synthesis in the coordinating Groundwork session.

If a repository is not configured as a project, confirm before cloning unless the user
already authorized cloning.

### 6. Normalize evidence

Each worker writes the contract in
[`references/normalized-output.md`](references/normalized-output.md). Preserve:

- canonical identities;
- direction and role;
- exact source evidence;
- confidence and known gaps;
- request/response, message, or stored-record fields;
- repository revision.

Do not emit raw file contents unless the normalized contract cannot represent required
evidence.

### 7. Merge and validate

Merge normalized records by canonical identity. Prefer newer evidence only when it is at
least as authoritative as the existing evidence. Surface conflicts instead of silently
choosing one source.

After writing Groundwork data:

1. regenerate schemas when the model changed;
2. rebuild the runtime validator;
3. validate the repository plan;
4. run targeted content and relationship tests;
5. rebuild the viewer;
6. restart the Hub when runtime schemas changed;
7. verify the selected component in the live browser.

## UI projection rules

The catalog stores dimensions; the UI chooses a useful projection.

- Show **Callers**, **Dependencies**, **Platform capabilities**, **Datastores**, and
  **Messaging** as primary groups.
- Hide empty groups instead of displaying large zero-state panels.
- Show internal/external, transport, and role as compact secondary badges.
- Keep source-code repository links outside runtime dependency groups.
- Let users open datastore/message schemas in place.
- Let users navigate referenced API types in the same schema pane with breadcrumbs;
  avoid accordion-within-accordion layouts.
- Show explicit evidence gaps such as “record observed; fields not extracted.”

## Failure modes

### Scanning everything in the coordinator

Raw source and large JSON catalogs consume the main context before synthesis begins.
Build a coverage manifest, fan unresolved repositories out, and return normalized JSON.

### Treating a registry as the system

Team workspaces and repository managers organize code; Backstage Systems describe runtime
boundaries. Confirm the boundary before creating Groundwork projects or products.

### Mixing role with ownership

“Third-party” does not explain whether something is a platform, business provider,
datastore, or broker. Store ownership as metadata and classify the architectural role.

### Calling Git repositories runtime dependencies

A source repository is provenance. A database repository means a datastore abstraction,
not a Git repository. Keep code provenance separate from runtime context.

### Cataloging names without shapes

An API name, Redis name, or topic name does not explain the data. Extract request,
response, record, and message structures when evidence exists; preserve explicit gaps when
it does not.

### Inventing completeness

Do not infer stored fields from an API response, assume a Redis value matches a similarly
named DTO, or claim a runtime relationship from a registered but unused client. Preserve
the evidence boundary.

## Completion standard

A catalog pass is complete when:

- every included component has canonical identity and ownership;
- callers and dependencies have explicit direction;
- platform services and external providers are distinguishable;
- known datastores and messaging infrastructure are represented;
- API, message, and stored-data schemas are imported where evidence exists;
- unknown structures are visible as gaps;
- every nontrivial claim has repository, revision, and source evidence;
- the plan validates and the live viewer presents the selected component coherently;
- the coverage manifest records what remains unresolved.

