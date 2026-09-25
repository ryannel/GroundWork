# Repository discovery output

The coordinator submits one record per detected component to
`apply_repository_scan`. Omit unknown optional fields and preserve uncertainty in `gaps`
or `unresolvedDependencies`.

```json
{
  "id": "order-configuration-facade",
  "productId": "order-configuration",
  "sourcePath": ".",
  "name": "Order configuration facade",
  "kind": "service",
  "ownership": "internal",
  "role": "business-service",
  "dependsOn": ["inventory-service"],
  "unresolvedDependencies": [{
    "name": "feature-flags",
    "kind": "sdk",
    "transport": "HTTPS",
    "evidence": [{
      "path": "src/config/flags.ts",
      "lines": "12-24",
      "claim": "Creates and calls the feature flag client.",
      "revision": "full-commit-sha"
    }]
  }],
  "api": {
    "name": "Order configuration API",
    "endpoints": [{
      "id": "get-configuration",
      "name": "Get configuration",
      "method": "GET",
      "path": "/configurations/{id}",
      "response": "Configuration",
      "evidence": [{
        "path": "src/routes/configuration.ts",
        "lines": "18-34",
        "claim": "Registers the configuration read endpoint.",
        "revision": "full-commit-sha"
      }]
    }]
  },
  "jobs": [{
    "id": "reindex-catalog",
    "name": "Reindex catalog",
    "description": "Nightly job that rebuilds the search index from persisted configuration.",
    "schedule": "0 3 * * *",
    "evidence": [{
      "path": "src/jobs/reindex.ts",
      "lines": "8-19",
      "claim": "Registers a scheduled job that rebuilds the search index.",
      "revision": "full-commit-sha"
    }]
  }],
  "executionFlows": [],
  "coverage": {
    "dependencies": "complete",
    "api": "complete",
    "data": "complete",
    "messaging": "partial"
  },
  "gaps": [{
    "area": "executionFlows.coverage",
    "reason": "Baseline contract discovery complete; 0/1 known endpoint paths traced. get-configuration implementation is available for targeted investigation when needed; it was not selected for deeper tracing in this baseline."
  }, {
    "area": "messaging.delivery",
    "reason": "Retry and dead-letter behavior are configured outside this repository."
  }]
}
```

## Rules

- `sourcePath` must equal a project path returned by `prepare_repository_scan`.
- `id`, `productId`, and every `dependsOn` value are Groundwork IDs. A `dependsOn` value is
  the bare local ID of a component in the same catalog; Groundwork resolves it to the
  repository that component belongs to, and reports it as unresolved when nothing does.
- A new component takes the ID `prepare_repository_scan` derives for its project
  (`derivedId`, which `suggestedId` repeats for a project no component covers yet): the
  manifest name for a project at the repository root, otherwise the manifest name, `--`,
  and the folder with `/` written as `-`, for example `api--services-price`. The encoding
  never folds two projects together, so anything that would be ambiguous takes a `_`
  escape: `services-price` as a folder is `services_hprice`, `price.v2` is `price_dv2`,
  `price_v2` is `price_uv2`, and case is kept as written. Send the `derivedId` verbatim
  rather than composing it yourself. The folder is always included below the root, so
  adding a same-named project later never changes an ID that was already derived. An
  existing component keeps the ID it already has.
- A build project that was renamed or moved is detected at its new path, so it looks like a
  new project. Apply it under the `derivedId` of that path, or leave it out and report the
  move; recording the move against the existing component is not available yet.
- Unmapped runtime references belong in `unresolvedDependencies`, never fabricated
  components.
- Evidence paths are relative to the snapshot root.
- Evidence lines use `N` or inclusive `N-M`.
- Evidence revision is the full commit returned by `prepare_repository_scan`.
- API, data, messaging, `jobs`, and execution-flow objects use the schemas returned by
  Groundwork. `jobs` records a component's owned scheduled or triggered work; a non-HTTP
  execution flow references one by `id` through `trigger: {kind: "job", jobId}`.
- Each requested coverage area must be `complete`, `partial`, or `not-scanned`.
- `complete` with no records means the area was searched and no interface was found.
- API coverage describes contract discovery independently of execution depth. The example
  has complete contract discovery and an explicitly untraced endpoint; its flow depth is
  not a claim of complete system understanding.

## Execution-flow contract

`executionFlows` is an array on the component discovery, alongside `api`, `data`, and
`messaging`. It is not a standalone catalog tab, a new `coverage` key, or a supported
`prepare_repository_scan.areas` value.

Each flow requires:

- `id`, `name`, `summary`, `sourceRevision`, `entryStepId`, and either `endpointId` or a non-HTTP `trigger`;
- `steps`: nonempty array of `{ id, title, kind, description, evidence }`;
- `transitions`: array of `{ id, from, to, label, mode, evidence }`;
- `gaps`: an array of specific limits on this trace (empty when none are known).

Use the exact ID from `api.endpoints` as `endpointId`. Keep separate endpoint-linked flows
when handlers share internal logic; do not attach one sample flow to unrelated endpoints.
`sourceRevision` and every citation use the full 40-character SHA from preparation.

Step `kind` is `request`, `validation`, `decision`, `logic`, `dependency`, `data`, `message`,
or `response`. Optional `dataRecordIds`, `messageIds`, and `dependencyIds` must resolve to
the component's data records, messages, and `dependsOn` values. For an unmapped provider,
use `unresolvedDependencyNames` matching an `unresolvedDependencies.name` exactly.

Every step and transition needs nonempty evidence with `path`, `lines`, `claim`, and
`revision`. Transition `from` and `to` must identify steps in that flow; all steps must be
reachable from `entryStepId`. Label branches with the actual conditions or outcomes.

`mode: sync` follows awaited control flow. An `async` function or an awaited HTTP call is
not by itself an asynchronous handoff. Use `mode: async` for an evidenced background or
concurrent branch or queued handoff; describe which it is and show any join/await before
response. Keep a broker publication distinct from downstream processing. Do not infer
successful storage or publication after a swallowed error, or transactionality across
storage and messaging, without source evidence.

## Scope and knowledge audit

Compare the requested work with findings before applying. Track contract discovery,
investigation depth and freshness independently. Counting flow objects is insufficient:
only correctly linked, useful traces count, and older traces must not be presented as
verified at the new revision. Do not synthesize placeholder flows to improve counts.

For a baseline with 17 catalogued contracts and one useful trace, report **1/17 known
endpoint paths traced**. `coverage.api` may be complete when contract discovery is complete.
Use an `executionFlows.coverage` gap to describe the scope that remains unexplored; this
need not become a backlog of mandatory traces. If the user explicitly requested every
path, the same 1/17 result is partial completion of that investigation. Contract extraction
limits still require partial API coverage. A missing implementation can block a particular
question even when its contract is known.

A feature-focused investigation should return relevant contracts, source locations,
existing flows, dependencies and critical unknowns. Inspect deeper business rules, tests,
configuration and failure behavior only as needed to answer it. Record reusable findings
in existing schema fields with citations; do not add proposed pointer/query/refresh fields
before the corresponding schemas and operations exist. Directory locations are navigation
hints, not evidence that code behaves a particular way.

The current scanner replaces requested area payloads. Merge targeted findings with the
existing catalog before applying, preserving unrelated entities and their coverage limits.
A supplied `executionFlows` array replaces the old array; omission retains it without
revalidating it. All supplied flow evidence must match the prepared revision. Revalidate
retained traces for a same-revision replacement where feasible. If current tooling cannot
safely merge different source revisions within the requested scope, report that limitation
and preserve valid existing knowledge rather than repinning citations or dropping sibling
flows. Use `check_catalog_freshness` to verify source freshness explicitly, and
`prepare_repository_scan`'s `incremental` option to narrow or widen preparation from a
diff; see [the focused investigation contract](#focused-investigation-contract) below.


## Focused investigation contract

`apply_catalog_investigation` accepts `scanId`, `componentId`, `expectedRevision`,
`expectedContext`, and `jobs`/`flows`/`findings`/`sourceScans` arrays (at least one of
`jobs`, `flows`, or `findings` nonempty). Flows use the execution-flow schema above and
upsert by ID; `jobs` upserts owned scheduled or triggered work by `id`. Omission preserves
siblings; it neither retires entities nor verifies their freshness. The operation validates
source identity, pinned revisions, citation bytes/ranges and links, then writes atomically.
Broad catalog coverage and outstanding component gaps stay unchanged.

A reusable finding has `id`, `name`, `question`, `answer`, `subjects` (kind/id pairs within
the component), `boundary`, `assumptions`, `repository`, `sourceRevision` and `evidence`.
Subject kinds are component, endpoint, schema, data, message or flow. Sources must match
the prepared repository/revision. A test pointer establishes where to inspect, not that
the test passed. Findings are searchable and shown under Investigated questions.

Use qualified IDs exactly as queries return them. An ID has four URI-encoded segments:
`repository/component/kind/entity` in a migrated home and `project/component/kind/entity`
in one that has not been migrated, where `repository` is an identity such as
`volvo-cars%2Fprice-engine`. Both forms resolve, and results list an entity's other form
under `aliases`; never construct or convert an ID yourself. Queries return bounded summaries and continuations. `get_catalog_entity` returns
JSON-pointer sections; retrieve all pages for complete detail and concatenate any sliced
strings at their indicated offsets. A changed snapshot or query invalidates its cursor.


### Non-HTTP triggers, supporting sources and lifecycle

Use exactly one entry point: legacy `endpointId`, `trigger: {kind: "message", messageId}`
referencing an inbound message, or `trigger: {kind: "job", jobId}` referencing an owned
job. `jobs` can be supplied by a baseline scan or focused upsert; each needs `id`, `name`,
`description`, evidence and optional `schedule`/`source`. Do not invent schedules from names.

A focused apply may include `sourceScans` for supporting repositories. External evidence
must specify `repository` and that snapshot's pinned revision. Matching paths in two
repositories are distinct citations. The owning flow/finding retains the primary revision;
only repository-qualified supporting evidence may use another revision. Full baseline
replacement remains single-source. Successful focused applies retain all source inventories.

`reconcile_catalog` accepts `retire` actions (`kind`, `id`, `reason`, `evidence`) and `rename`
actions (`kind`, `id`, `name`, optional endpoint `path`, `evidence`), plus the prepared scan,
component and current guards. Retirement archives original facts and dependent active
flows; rename retains IDs and records separate provenance. History is append-only.
Schema removals must be reconciled with callers. Never infer retirements from omissions.
