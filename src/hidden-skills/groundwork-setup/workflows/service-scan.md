# Phase 2: Service Scan

This workflow runs in a loop for each service discovered in Phase 1 that has `status == "pending"`.

```xml
<step n="3" goal="Classify service type and load scan requirements">
<critical>YOU MUST ALWAYS SPEAK OUTPUT In your Agent communication style with the configured GroundWork Tone from persistent facts.</critical>
<action>For current service {{service_id}} at {{service_path}}:
  - Read language manifest (go.mod / package.json / requirements.txt)
  - Match against service-types.csv patterns
  - Detect: framework, database, async_mechanism, test_framework
  - Load scan_requirements row for detected type
</action>
<action>Update state file: services_discovered[service_id].detected_type, status: "scanning"</action>
<action>PURGE manifest contents, keep: "{{service_id}}: {{language}}/{{framework}}, {{database}}"</action>
</step>

<step n="4" goal="Extract API contracts for {{service_id}}">
<check if="spec file exists (openapi.json | openapi.yaml | *.proto)">
  <action>Set generation_mode = "generated"</action>
  <action>Parse spec file: extract endpoints, methods, request/response schemas, auth requirements</action>
</check>

<check if="no spec file AND scan_level == quick">
  <action>Set generation_mode = "extracted"</action>
  <action>Glob for route/handler files using scan_requirements.api_patterns</action>
  <action>Extract: file names, route prefixes, HTTP methods from file names and folder structure only</action>
</check>

<check if="no spec file AND (scan_level == deep OR scan_level == exhaustive)">
  <action>Set generation_mode = "extracted"</action>
  <action>Read handler/route files in batches (one subfolder at a time):
    1. Read files in subfolder
    2. Extract: path, method, request shape, response shape, auth pattern
    3. Append findings to api_contracts array
    4. PURGE file contents, keep: "{{n}} endpoints in {{subfolder}}"
    5. Next subfolder
  </action>
</check>

<action>IMMEDIATELY write docs/services/{{service_id}}/contracts/api.md using templates/contracts-api.md</action>
<action>Section-Level Validation: Read the file just written. Ensure all expected headers from the template exist and contain extracted data, not empty space.</action>
<action>Update state file: outputs_generated, findings_summary.{{service_id}}.api</action>
<action>PURGE the written markdown contents and API details from context completely. Keep ONLY a 1-sentence summary: "{{endpoint_count}} endpoints documented, mode: {{generation_mode}}"</action>
</step>

<step n="5" goal="Extract database schema for {{service_id}}">
<check if="schema.sql OR migration files OR ORM model files exist">
  <action>Determine schema source priority: schema.sql > migrations > ORM models</action>
</check>

<check if="schema.sql exists">
  <action>Set generation_mode = "generated"</action>
  <action>Parse schema.sql: tables, columns, types, constraints, indexes, foreign keys</action>
</check>

<check if="migration files exist (no schema.sql)">
  <action>Set generation_mode = "extracted"</action>
  <action>Process migration files in order: reconstruct target schema state</action>
</check>

<check if="ORM models only (scan_level == deep OR exhaustive)">
  <action>Set generation_mode = "extracted"</action>
  <action>Read model files in batches, extract: table names, fields, relationships</action>
</check>

<check if="scan_level == quick AND no schema.sql">
  <action>Set generation_mode = "extracted"</action>
  <action>Glob for model/schema files, extract table names from file names only</action>
  <action>Add _(To be completed)_ markers for field-level details</action>
</check>

<action>IMMEDIATELY write docs/services/{{service_id}}/contracts/schema.md using templates/contracts-schema.md</action>
<action>Section-Level Validation: Read the file just written. Ensure all expected headers from the template exist and contain extracted data, not empty space.</action>
<action>Update state file</action>
<action>PURGE the written markdown contents and schema details from context completely. Keep ONLY a 1-sentence summary: "{{table_count}} tables documented"</action>
</step>

<step n="6" goal="Extract event contracts for {{service_id}}">
<check if="asyncapi.yaml exists">
  <action>Set generation_mode = "generated"</action>
  <action>Parse asyncapi.yaml: channels, message schemas, publishers, subscribers</action>
</check>

<check if="no asyncapi AND (scan_level == deep OR exhaustive)">
  <action>Set generation_mode = "extracted"</action>
  <action>Scan for event publishing patterns using scan_requirements.event_patterns:
    - Pub/Sub publish calls
    - Event bus emit calls
    - Kafka producer calls
    - For each: extract topic/event name, payload shape, calling context (WHEN is it published)
  </action>
  <action>Scan for event consumption patterns:
    - Subscribers, listeners, consumers
    - For each: extract topic, handler name, what it triggers
  </action>
</check>

<critical>For each event, capture trigger context:
  published_when: "User calls POST /meetings and audio chunks are confirmed in storage"
  consumed_by: "wordloop-ml — triggers TranscriptionJob.queue()"
  This context is what enables system-level data flow synthesis.
</critical>

<action>IMMEDIATELY write docs/services/{{service_id}}/contracts/events.md using templates/contracts-events.md</action>
<action>Section-Level Validation: Validate every event has trigger context, ensure all expected headers exist.</action>
<action>Update state file</action>
<action>PURGE the written markdown contents and event details from context completely. Keep ONLY a 1-sentence summary: "{{published_count}} events published, {{consumed_count}} consumed"</action>
</step>

<step n="7" goal="Document service structure and architecture rules">
<action>Generate annotated directory tree for {{service_path}}:
  - Mark entry points (main.go, index.ts, app.py)
  - Mark domain/business logic layer
  - Mark infrastructure/adapter layer
  - Mark test locations
  - Note: what belongs where
</action>

<check if="scan_level == deep OR exhaustive">
  <action>Read architecture-signal files in batches (one subfolder):
    - DI wiring files (main.go, app.py, server.ts)
    - Base classes, interfaces, abstract types
    - Middleware registrations
    Extract: layer boundaries, dependency directions, key abstractions
  </action>
</check>

<action>IMMEDIATELY write docs/services/{{service_id}}/index.md using templates/service-index.md</action>
<action>IMMEDIATELY write docs/services/{{service_id}}/architecture.md using templates/service-architecture.md</action>
<action>Section-Level Validation: Ensure index and architecture docs contain actual text and not empty placeholders.</action>

<critical>Leave Governing Decisions section as _(To be completed)_ — populated in Synthesis phase
when global ADRs are matched against this service.</critical>

<action>Update state file, PURGE structure details</action>
</step>

<step n="8" goal="Assess Code-Writing Skills for {{service_id}}">
<action>List the contents of `.agents/skills/` directory to identify any skills targeting the {{language}} or {{framework}} of {{service_id}}.</action>
<check if="relevant skill found">
  <action>Read the SKILL.md file for the matched skill.</action>
  <action>Assess quality against GroundWork requirements:
    - Does the skill explicitly instruct the agent to update `docs/services/{{service_id}}/contracts` when APIs/Events/Schemas change?
    - Does it enforce keeping tests in sync with the architecture?
  </action>
  <action>If skill is missing GroundWork directives, set assessment_status = "needs_upgrade".</action>
  <action>If skill is well-configured, set assessment_status = "ready".</action>
</check>
<check if="no relevant skill found">
  <action>Set assessment_status = "missing".</action>
</check>

<action>Append an `Agent Skill Status` section to `docs/services/{{service_id}}/architecture.md`.
  - If missing: Add a GitHub warning alert `> [!WARNING]` advising the user to use `skill-creator` to build a dedicated code-writing skill.
  - If needs_upgrade: Add a warning alert advising the user to use `skill-creator` to add GroundWork contract-sync instructions.
</action>

<action>Update state file: mark service status = "complete"</action>
<action>PURGE the skill contents and assessment details from context. Keep ONLY a 1-sentence summary: "Skill assessment: {{assessment_status}}"</action>
</step>

<step n="loop_control" goal="Determine next action">
<action>Check services_discovered for next service with status == "pending"</action>
<check if="pending services remain">
  <action>Set current_service to next pending service</action>
  <action>Return to Step 3</action>
</check>
<check if="all services complete">
  <action>Update state file: current_phase = "synthesis"</action>
  <action>Proceed to Phase 3 (Synthesis)</action>
</check>
</step>
```
