# Phase 1: Discover

This workflow discovers services in the repository and handles state file resumption.

```xml
<step n="0" goal="Check for existing scan state">
<action>Check for docs/.groundwork/scan-state.json</action>

<check if="state file exists AND age < 24h">
  <action>Read state file: current_phase, current_service, services_discovered</action>
  <ask>Found in-progress scan from {{last_updated}}.
  Phase: {{current_phase}} | Services complete: {{complete_count}}/{{total_count}}
  
  1. Resume from {{current_service}}
  2. Start fresh (archive old state)
  3. Cancel
  
  [1/2/3]:</ask>
  <check if="user selects 1"><action>Set resume_mode = true, jump to current_phase</action></check>
  <check if="user selects 2"><action>Archive state to docs/.groundwork/.archive/, continue to Step 1</action></check>
  <check if="user selects 3"><action>Exit</action></check>
</check>

<check if="state file age >= 24h">
  <action>Archive old state file, set resume_mode = false</action>
</check>
<action>PURGE state file details from context</action>
</step>

<step n="1" goal="Select scan depth">
<ask>Choose scan level:

1. Quick (5-10 min) — structure + manifests only, no source file reading
2. Deep (20-60 min) — reads key files per service type
3. Exhaustive (1-3 hrs) — reads all source files, one subfolder at a time

[1/2/3] (default: 2):</ask>
<action>Set scan_level = {quick | deep | exhaustive}</action>
<action>Initialize scan-state.json with: version, timestamps, scan_level, phase=discover</action>
</step>

<step n="2" goal="Find all services in the repository">
<action>Scan project root for service directories using patterns from service-types.csv:
  - Look for: services/, apps/, packages/, cmd/ subdirectories
  - Within each: look for language markers (go.mod, package.json, requirements.txt, Cargo.toml, pom.xml)
  - Record: service_id, path, language, detected_type
</action>

<check if="multiple services detected">
  <action>List detected services with paths and detected types</action>
  <ask>I found these services:
  {{services_list}}
  
  Is this correct? Any to add, remove, or rename? [y/edit]:</ask>
  <action if="user edits">Update services_discovered list per user input</action>
</check>

<action>Update state file:
  - services_discovered: [{id, path, language, type, status: "pending"}]
  - completed_steps: add {step: "discover", summary: "Found N services: ..."}
  - current_phase: "service-scan"
</action>
<action>PURGE discovery details, keep only: "Found N services: {list}"</action>
</step>
```
