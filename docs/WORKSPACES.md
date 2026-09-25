# Groundwork model

Groundwork is an internal tool for planning and delivering features against code. A repository can hold products, plans, and a catalog under `.groundwork/`. Workspaces are local Hub views that group products; they do not own documents. Repository identity comes from the Git `origin`, never the clone's folder name.

The existing planning, delivery, and catalog UI remains the presentation layer. The simplification changes what its data comes from and how it is written, rather than restarting the interface design.

## One current format

This app is still in internal testing. New checkouts use one document format; there are no format versions, historical readers, migrations, or compatibility IDs. Git tracks document history. Existing test homes can be recreated with `init` and catalog authoring when the new format is ready.

```text
.groundwork/
  products/<id>.json
  members/<id>.json
  plans/features/<id>/feature.json, brief.md, ... , delivery.json
  catalog/components/<id>.json
  local-catalogs/<repository>/components/<id>.json
  GUIDE.md, schemas/
```

A product has a stable ID, name and slug, and lists repositories it owns or uses. Owned paths may narrow a monorepo. A product may have no catalog. The Hub records clone paths and workspace groupings locally; they are views over repository documents. The source repository catalog is the default. A product may explicitly select a local catalog for a repository when it cannot write to that source repository. Source and local catalogs have the same document shape.

## Catalog contract

A component document describes its APIs, data, messages, jobs, flows and dependencies. Every recorded entry has a source path plus a symbol or line range and the full Git commit SHA at which it was observed. The observation timestamp is separate from that SHA. Each area records gaps, including an explicit empty list when coverage was checked and no gaps were found. The document names the paths it covers. Nothing in planning requires catalog coverage: a plan may name components, but a missing catalog remains a visible gap rather than invalidating the plan.

A freshness check compares the observed commit to the selected local checkout revision. It names entries to review when their cited files change, reports changed covered files without citations, and lists changed files outside every component as uncatalogued. It cannot claim runtime correctness. Agents read the checkout directly and write reviewed catalog documents through a guarded atomic write. A rescan replaces current facts; Git retains previous revisions.

The catalog API has four operations: `write_catalog`, `check_catalog_freshness`, `search_catalog`, and `get_catalog_entity`. Catalog reads use the product's explicit source or local choice. There is no scan staging, manifest, lifecycle record, baseline, cache, automatic catalog merging, or proposal workflow.

## Planning and delivery

Features retain their brief, journey, design, system flow, API, storage and test sections. Delivery retains user-visible deliverables, component tasks, validation, progress, evidence and branch links. The Hub and CLI/MCP read and write the same documents. Mutations require the latest document revision and checkout context; writes validate the candidate and replace files atomically. Git remains the sharing and review mechanism. The Hub only serves registered local clones and worktrees.
