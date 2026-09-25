# Current component catalog document

Each component is one JSON document at `.groundwork/catalog/components/<id>.json` in its source repository, or at `.groundwork/local-catalogs/<repository>/components/<id>.json` in the selected product home. `write_catalog` validates the complete document, its citations, and the source commit. This example uses a placeholder SHA; substitute a real full commit SHA and actual lines before writing.

```json
{
  "id": "order-api",
  "name": "Order API",
  "kind": "service",
  "repo": "acme/orders",
  "sourcePath": "src",
  "sourceRevision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "observedAt": "2026-09-25T12:00:00Z",
  "covers": ["src"],
  "areaGaps": {
    "dependencies": [],
    "api": [],
    "data": ["Database schema lives in another repository."],
    "messaging": [],
    "jobs": [],
    "flows": ["Only the create-order path was traced."]
  },
  "evidence": [{
    "path": "src/server.ts",
    "lines": "8-16",
    "claim": "Starts the order API.",
    "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }],
  "api": {
    "name": "Order API",
    "endpoints": [{
      "id": "create-order",
      "name": "Create order",
      "method": "POST",
      "path": "/orders",
      "evidence": [{
        "path": "src/routes/orders.ts",
        "lines": "20-36",
        "claim": "Registers the create-order route.",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }]
    }]
  }
}
```

## Rules

- `repo` matches the selected source repository. The product declares that repository with role `owned` or `used`; component documents do not need a product ID.
- `sourceRevision` is the full observed Git commit. `observedAt` records when the observation was made. Each citation uses that same commit unless it explicitly identifies a supporting repository.
- `covers` lists examined repository-relative paths. Each citation must fall within them. Evidence lines use a positive `N` or inclusive `N-M` range.
- Cite the component and every recorded endpoint, schema, data record, message, job, unresolved dependency, flow step, and transition. An absent area is meaningful only with an explicit empty or explanatory `areaGaps` entry.
- `dependsOn` uses a local component ID or `{ "repository": "acme/other", "component": "gateway" }`. Keep unknown runtime references in `unresolvedDependencies`; do not invent components.
- `check_catalog_freshness` reports changed citations, changed covered files, and uncatalogued source files. It does not verify runtime behavior.

## Execution flows

`executionFlows` is an optional array on the component. Each flow has `id`, `name`, `summary`, `sourceRevision`, `entryStepId`, `steps`, `transitions`, and exactly one entry point: an `endpointId` or a `trigger` for an inbound message or owned job. Use the exact endpoint, message, or job ID from this component. Each step and transition needs source evidence at the flow revision. Transitions connect declared steps, and every step must be reachable from the entry step.

Trace representative paths that explain input, decisions, state changes, boundaries, asynchronous handoffs, and important failure behavior. `mode: "async"` denotes an evidenced background or queued handoff; an awaited function is still synchronous for this purpose. Keep a broker publication distinct from downstream processing. Explain untraced paths in `areaGaps.flows` instead of inventing flows.

Catalog search returns repository-qualified IDs. Pass returned IDs directly to `get_catalog_entity`; follow `nextCursor` to retrieve all sections. Do not construct compatibility IDs or infer absence from a partial catalog.
