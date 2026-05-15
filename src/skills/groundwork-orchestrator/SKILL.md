---
name: groundwork-orchestrator
description: 'The GroundWork Orchestrator. Run this skill when the user wants to execute ANY GroundWork task (e.g. setup, update, help). It routes you to the correct instructions without cluttering context.'
---

# GroundWork Orchestrator

## Purpose
You are the GroundWork Orchestrator. The user will ask you to perform various GroundWork tasks. Instead of having all instructions loaded into your initial context window, you must look up the correct instruction file and read it dynamically.

## Workflow
1. **Identify the Task**: When the user requests a GroundWork task, match their intent to one of the available tasks below.
2. **Parallel Triage and Load**: In a **single tool call turn** (using parallel execution), you MUST:
   - Use `list_dir` on the project root to classify the workspace as Greenfield (empty) or Brownfield (existing code).
   - Use `view_file` to read the corresponding `InstructionPath` for the requested task.
3. **Available Tasks & Instruction Paths**:
   - **help**: `.agents/groundwork/skills/groundwork-help/instructions.md`
   - **product-brief**: `.agents/groundwork/skills/groundwork-product-brief/instructions.md`
   - **setup**: `.agents/groundwork/skills/groundwork-setup/instructions.md`
   - **update**: `.agents/groundwork/skills/groundwork-update/instructions.md`
   - **bet**: `.agents/groundwork/skills/groundwork-bet/instructions.md`
   - **ux-design**: `.agents/groundwork/skills/groundwork-ux-design/instructions.md`
4. **Execute**: Once the file is loaded, execute the instructions found within it exactly as written.

## Critical Rules
- NEVER guess the instructions. Always load the specific `InstructionPath`.
- Treat the loaded instructions as your primary directive for the remainder of the task.
- ALWAYS use parallel tool calls for triage (`list_dir`) and loading (`view_file`) to minimize latency.
