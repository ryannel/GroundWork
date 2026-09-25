# Repository planning files

Groundwork stores one current format under `.groundwork/`:

```text
products/<id>.json
members/<id>.json
plans/features/<id>/feature.json
plans/features/<id>/brief.md
plans/features/<id>/{journey,design,flow,api,storage,tests,delivery}.json
catalog/components/<id>.json
local-catalogs/<repository>/components/<id>.json
```

A product has a stable ID, name, slug, and explicit `repositories` with `owned` or `used` roles. `paths` can narrow ownership within a monorepo. Source catalogs are the default; a product may select a local catalog for a repository it cannot write to. Catalog document shape is identical in both places. Workspaces and registered clone paths are local Hub organization, stored outside the repository. Git `origin` defines repository identity. The Hub serves registered checkouts and worktrees.

Feature plans keep a brief, journey, design, system flow, API, storage, tests, and delivery. Delivery records user outcomes, component tasks, validation plans, progress, evidence, and branch links. Agents and the UI use the same documents. Read with `read_plan`; write with `write_plan` or a focused planning operation using the returned `expectedRevision` and `expectedContext`. A candidate is validated and files are replaced atomically. Git tracks changes for review and sharing.

Catalog authoring uses `write_catalog` and a pinned source commit. Read with `search_catalog` and `get_catalog_entity`; compare observations with `check_catalog_freshness`. The [catalog guide](CATALOG_DISCOVERY.md) describes the current document. There is no additional preparation, manifest, proposal, baseline, lifecycle, cache, or migration workflow.

Run `groundwork-v2 init <repository>` to create a new repository plan. `groundwork-v2 hub` opens the shared Hub; `groundwork-v2 register <repository>` adds a checkout. `groundwork-v2 validate <repository>` checks one plan and `groundwork-v2 validate --all` checks registered homes together. `plans:start` opens the registered checkout in the Hub, and `plans:hub` opens the Hub root.
