# GroundWork Setup Workflow

This agent orchestrates the GroundWork setup scan, building architecture and service documentation.

## Guidelines
- **Batch Processing**: When reading source code, read one subfolder at a time, extract what you need, and **PURGE** the file contents from your memory. Do not hold the entire codebase in memory.
- **State Management**: Read and update `docs/.groundwork/scan-state.json` at each step. This allows for resuming interrupted scans and prevents lost progress.
- **No Hallucinations**: If a contract or pattern cannot be found, mark it as `_(To be completed)_` with `generation_mode: extracted`. Do not guess API endpoints.

## Execution Flow

1. **Phase 0: Workspace Classification**
   Perform a fast listing of the repository root to detect if it is Greenfield or Brownfield.
   - **Greenfield**: The repository is empty or only contains internal config directories (e.g., `.git`, `.agents`, `docs`).
   - **Brownfield**: The repository contains application files (e.g., `package.json`, `src/`, `main.py`).
   Write this classification to `.groundwork/config.toml` (e.g., `[core] \n project_type = "greenfield"` or `"brownfield"`).
   - If **Greenfield**, proceed to **Greenfield Flow**.
   - If **Brownfield**, proceed to **Brownfield Flow**.

## Greenfield Flow

1. **Phase 1: Product Briefing**
   For Greenfield projects, there is no existing codebase to scan. We must gather an understanding of the product upfront.
   Handoff to the Product Briefing skill by reading and executing `.agents/groundwork/skills/groundwork-product-brief/instructions.md`.
   Delegate the conversation to that skill. The setup orchestrator completes its execution here.

## Brownfield Flow

1. **Phase 1: Executive Summary**
   Read and execute `.agents/groundwork/skills/groundwork-setup/workflows/executive-summary.md`.
   This discovers the technology stack and asks the user for the high-level system context before architecture extraction begins.

2. **Phase 2: Discover**
   Read and execute `.agents/groundwork/skills/groundwork-setup/workflows/discover.md`.
   This handles state file resumption, scan level selection, and service discovery.

3. **Phase 3: Service Scan**
   Read and execute `.agents/groundwork/skills/groundwork-setup/workflows/service-scan.md`.
   Loop through each pending service found in Phase 2.
   Extract API, Database Schema, Events, and Working Knowledge (Architecture, Conventions, Patterns).

4. **Phase 4: Synthesis**
   Read and execute `.agents/groundwork/skills/groundwork-setup/workflows/synthesis.md`.
   Assemble cross-service event chains, write `architecture/data-flow.md`, write per-service `data-flow.md` slices, apply global ADRs, and build the root index.

5. **Completion**
   Run the checklist in `.agents/groundwork/skills/groundwork-setup/checklist.md` to validate the final output and ask the user if they'd like to manually review any incomplete sections.
