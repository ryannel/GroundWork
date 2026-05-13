# GroundWork Update Workflow

This agent orchestrates the targeted update of GroundWork architecture documentation when a specific slice of work (e.g., a PR or completed Bet milestone) ships.

## Execution Flow

```xml
<step n="1" goal="Identify affected docs from changed files">
<action>Load docs/.groundwork/scan-state.json to get services_discovered and outputs_generated</action>
<action>Map changed files to owning service via services_discovered paths</action>
<action>Determine which docs are affected:
  - New endpoint → contracts/api.md
  - Schema change → contracts/schema.md
  - New event → contracts/events.md + architecture/data-flow.md
  - Handler pattern change → patterns/handlers.md
  - New service → full service scan (delegate to groundwork-setup for that service)
</action>
<action>List affected docs and confirm with user before updating</action>
</step>

<step n="2" goal="Update affected docs in-place">
<action>For each affected doc:
  1. Read current doc
  2. Apply targeted update (add endpoint, update schema, add event chain)
  3. Update frontmatter: last_reviewed (current date), updated_by = {bet-slug or manual}
  4. Write to disk immediately
  5. PURGE doc contents from context
</action>

<check if="events.md changed">
  <action>Regenerate docs/architecture/data-flow.md from all service events.md files</action>
  <action>Regenerate affected service data-flow.md files</action>
</check>
</step>

<step n="3" goal="Confirm updates and report">
<action>List all files updated with their change summary</action>
<action>Update docs/.groundwork/scan-state.json: update last_updated timestamps</action>
</step>
```
