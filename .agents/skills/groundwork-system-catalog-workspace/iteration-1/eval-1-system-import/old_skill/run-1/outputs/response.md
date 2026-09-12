# Action plan for importing Pricing into Groundwork

I would treat the Backstage System as the authoritative boundary for **pricing** and not infer the system from team workspaces or repository groupings.

## Plan
1. **Establish the boundary**
   - Resolve the canonical Backstage System record for Pricing.
   - Capture system id, display name, owner, domain, authoritative source, revision, and member components.

2. **Build coverage first**
   - Create a per-component coverage manifest with cells for:
     - membership
     - APIs
     - contracts
     - inbound callers
     - outbound dependencies
     - datastores
     - messaging
     - revision freshness
   - Mark each cell complete, partial, missing, or stale.

3. **Reuse structured evidence before source code**
   - Query Groundwork records first.
   - Then query System Atlas JSON, SQLite facts, extraction reports, and commit metadata.
   - Then inspect Backstage entity records.
   - Then inspect repository registries such as workspace catalogs.
   - Only after those are exhausted, inspect local source clones or remote GitHub sources.

4. **Fan out only the real gaps**
   - Do not scan every repository in the system.
   - Launch one worker per repository with unresolved coverage.
   - Instruct each worker to return normalized JSON with commit SHA, exact evidence, and unresolved gaps preserved.
   - Require validation with the catalog validator before merging any discovery.

5. **Merge and report**
   - Merge validated discoveries by canonical component id and revision.
   - Surface conflicts explicitly in the merge report.
   - Keep gaps visible instead of inventing API, contract, or datastore schemas.

## Constraints I would follow
- No repository cloning unless a coverage gap remains after structured evidence lookup.
- No catalog file edits outside the designated run directory for this evaluation.
- No fabricated schemas for Redis, messages, or stored records.

## Expected deliverables
- `coverage.json`
- `discoveries/<repository>.json`
- `catalog-summary.md`

