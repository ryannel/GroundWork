# Phase 3: Synthesis

This workflow synthesizes system-level documents from the extracted per-service contracts.

```xml
<step n="9" goal="Assemble cross-service event chains from service contracts">
<action>For each service, read ONLY contracts/events.md (not full service docs)</action>
<action>Build event_chains array:
  For each published event:
    - Find which service(s) consume it (from other services' events.md consumed_by)
    - Record: initiator → event → consumer → what consumer triggers
    - Chain transitively: if consumer publishes a follow-on event, extend the chain
</action>
<action>Group chains by user-facing action:
  "Meeting Creation": User → core POST /meetings → MeetingCreated → ml consumes →
  TranscriptionJob → ml POST /meetings/{id}/transcript → TranscriptionReady →
  app WebSocket transcript_ready
</action>
<action>Store event_chains as structured data in state file findings</action>
<action>PURGE raw event doc contents, keep only: "{{chain_count}} event chains assembled"</action>
</step>

<step n="10" goal="Write architecture/data-flow.md from event chains">
<action>Load event_chains from state file findings</action>
<action>For each chain, write architecture/data-flow.md using templates/arch-data-flow.md</action>
<action>Write docs/architecture/overview.md using templates/arch-overview.md (service topology, boundaries, communication patterns)</action>
<action>PURGE chain details from context</action>
</step>

<step n="11" goal="Write data-flow.md for each service (their slice of the system chains)">
<action>Load event_chains from state file</action>
<action>For each service, filter chains where service appears:
  - As initiator (inbound request → what it does → what it emits)
  - As consumer (what event triggers it → what it does → what it emits next)
</action>
<action>Write docs/services/{{service_id}}/data-flow.md using templates/service-data-flow.md</action>
<action>Repeat for all services</action>
<action>Update state file with all data-flow.md outputs</action>
<action>PURGE chain details</action>
</step>

<step n="12" goal="Apply Global ADRs">
<action>Scan docs/architecture/decisions/ for global ADR files</action>
<action>For each ADR, read frontmatter applies_to: [] field</action>
<action>For each service in applies_to:
  - Update docs/services/{{service_id}}/architecture.md Governing Decisions section:
    Replace _(To be completed)_ with table of applicable ADRs + relevance note
</action>
<action>Update state file: list all architecture.md files updated</action>
<action>PURGE ADR details</action>
</step>

<step n="13" goal="Generate docs index and run validation checklist">
<action>Generate docs/index.md:
  - Service list with links to each service/index.md
  - Architecture section links
  - Work/bets section links
  - Reference links
  - Scan metadata: date, scan_level, services_documented
</action>

<action>Formal Scan for incomplete documentation markers:
Step 1: Search for exact pattern "_(To be completed)_" across all docs/ files.
Step 2: For each match found, extract the file path and section header.
Step 3: Update state file with incomplete_sections array.
</action>
<ask>Documentation generation complete!

Services documented: {{service_count}}
Files generated: {{file_count}}
Scan level: {{scan_level}}

Incomplete sections (_(To be completed)_ markers): {{incomplete_count}}
{{incomplete_list}}

Would you like to:
1. **Generate incomplete sections now** (requires exhaustive scan on affected services)
2. **Review a specific service**
3. **Finalize as-is**

Your choice [1/2/3]:</ask>

<action if="user selects 1">Go to Step 14 (Deep-Dive)</action>
<action if="user selects 2">Go to Step 14 (Deep-Dive)</action>
<action if="user selects 3">
  <action>Run checklist.md validation</action>
  <action>Finalize state file: current_phase = "complete", timestamps.completed</action>
  <action>Exit workflow</action>
</action>
</step>

<step n="14" goal="Review and Deep-Dive Guided Workflow">
<check if="user selected 1 (Generate incomplete)">
  <ask>Which services would you like to deep-dive to complete?
  {{incomplete_services_list}}
  Select service(s) by number or 'all':
  </ask>
  <action>Set target_services based on selection</action>
</check>

<check if="user selected 2 (Review)">
  <ask>Which service would you like to review?
  {{all_services_list}}
  Select service by number:
  </ask>
  <action>Set target_service based on selection</action>
  <action>Read docs/services/{{target_service}}/index.md and architecture.md</action>
  <ask>Here is the overview for {{target_service}}:
  
  {{service_summary_content}}
  
  Would you like to:
  A. Run an exhaustive Deep-Dive on this service to extract more patterns and details
  B. Go back to the main menu
  C. Finalize and exit
  </ask>
  <action if="user selects A">Set target_services = [target_service]</action>
  <action if="user selects B">Return to Step 13 prompt</action>
  <action if="user selects C">Run checklist and exit</action>
</check>

<action>For each service in target_services:
  - Set scan_level = "exhaustive" for this service in state file.
  - Re-run Phase 2 (service-scan.md) targeting ONLY this service.
  - This forces literal full-file reads for all handlers, models, and patterns.
</action>

<action>After deep-dives complete, return to Step 13 prompt to show updated incomplete counts.</action>
</step>
```
