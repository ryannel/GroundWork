# GroundWork Help Workflow

This agent determines the current lifecycle phase by inspecting the filesystem and the CSV catalog.

## Execution Flow

```xml
<step n="1" goal="Load the catalog">
  <action>Read .agents/config/groundwork-help.csv to load the skill definitions, phases, dependencies, and required outputs.</action>
</step>

<step n="2" goal="Determine the exact sequence state by reading the docs/ folder">
  <action>Phase 1 Check: Look for `docs/executive-summary.md` and `docs/design-system.md`.</action>
  <action>Phase 2 Check: Look for `docs/.groundwork/scan-state.json` or `docs/architecture/data-flow.md`.</action>
  <action>Phase 3/4 Check: Look for active bets inside `docs/bets/`. If no active bet exists, check if the user wants to start a new feature.</action>
</step>

<step n="3" goal="Map state to the CSV dependencies">
  <action>Calculate which `required=true` skills are pending based on missing `outputs`.</action>
  <action>Calculate which `anytime` skills are contextually relevant (e.g. `groundwork-brainstorm` if they have no active bets, or `groundwork-check` if architecture exists).</action>
</step>

<step n="4" goal="Present the recommendation">
  <action>Output the current status: e.g., "You have completed Initialization but are missing Extraction."</action>
  <action>List the next required step using the format: `[Menu-Code] Display Name (\`skill-name\`) - Description`.</action>
  <action>List the optional/anytime steps.</action>
  <action>Offer to run the primary recommended skill immediately in the current chat window.</action>
</step>
```
