# GroundWork Check Workflow

This agent runs the documentation staleness detection algorithm. It is designed to run non-interactively (e.g., in CI) to flag when documentation has drifted from the code it describes.

## Execution Flow

```xml
<step n="1" goal="Read frontmatter from all generated and extracted docs">
<action>Find all code-coupled docs carrying drift frontmatter: the files under docs/services/, docs/api/, and docs/domain/, plus the top-level docs/architecture.md. These are the docs that name a source_of_truth — greenfield scaffold and the brownfield extract phases both stamp it.</action>
<action>For each file, extract the YAML frontmatter:
  - last_reviewed
  - source_of_truth
  - generation_mode
  - status
</action>
</step>

<step n="2" goal="Check git logs for drift">
<action>For each document with a valid source_of_truth:</action>
<action>Run git log: `git log --since="{last_reviewed}" --oneline -- {source_of_truth}`</action>
<check if="git log returns commits">
  <action>Mark document as STALE</action>
  <action>Update in-memory list of stale documents</action>
</check>
<action optional="true">When a deterministic code-graph tool is available (GroundWork registers depwire as an MCP server), sharpen the signal beyond file-path git history: call its impact analysis on the changed symbols to find documents whose source_of_truth depends — through the dependency graph — on code that changed elsewhere. A contract doc can be stale because a type it references moved in another file the git-log path filter would miss. This is an enhancement; the git-log check is the baseline and runs with or without depwire.</action>
</step>

<step n="3" goal="Generate report and exit">
<action>Group stale documents by service.</action>
<action>Generate a formatted report highlighting critical drifts vs warnings.</action>
<action>Provide recovery instructions based on generation_mode:
  - generated: Re-run code generator (e.g., OpenAPI generator)
  - extracted: Run `groundwork-update` skill for the affected service
  - authored: Manual review required
</action>
<action>If any critical documents (API, Schema, Events) are stale, output a failing status.</action>
</step>
```
