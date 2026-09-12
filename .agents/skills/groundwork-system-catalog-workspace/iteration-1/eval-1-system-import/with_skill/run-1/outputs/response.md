# Pricing system import plan

1. Establish the authoritative Backstage System boundary for **pricing** before treating any repository or workspace as the system.
2. Build `coverage.json` first, with one row per component and explicit cells for `membership`, `api`, `contracts`, `inbound`, `outbound`, `datastores`, `messaging`, and `revision` freshness.
3. Reuse structured evidence in this order:
   - existing Groundwork component records
   - System Atlas JSON / SQLite facts / extraction reports / commit metadata
   - Backstage System, Component, Resource, API, and Location entities
   - repository registries such as workspace indexes
4. Only then inspect source, and only for the unresolved or stale cells.
5. Fan out one worker per unresolved repository, each instructed to return normalized JSON with full commit SHA, exact paths/lines, and explicit gaps.
6. Validate each discovery with the skill validator before merging, then consolidate conflicts and remaining gaps into `catalog-summary.md`.

I will not clone repositories or modify catalog files in this evaluation run; I would return the structured plan, coverage manifest, and worker prompts instead.