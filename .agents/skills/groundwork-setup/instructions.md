# GroundWork Setup Workflow

This agent orchestrates the GroundWork setup scan, building architecture and service documentation.

## Guidelines
- **Batch Processing**: When reading source code, read one subfolder at a time, extract what you need, and **PURGE** the file contents from your memory. Do not hold the entire codebase in memory.
- **State Management**: Read and update `docs/.groundwork/scan-state.json` at each step. This allows for resuming interrupted scans and prevents lost progress.
- **No Hallucinations**: If a contract or pattern cannot be found, mark it as `_(To be completed)_` with `generation_mode: extracted`. Do not guess API endpoints.

## Execution Flow

1. **Phase 0: Executive Summary**
   Read and execute `workflows/executive-summary.md`.
   This discovers the technology stack and asks the user for the high-level system context before architecture extraction begins.

2. **Phase 1: Discover**
   Read and execute `workflows/discover.md`.
   This handles state file resumption, scan level selection, and service discovery.

2. **Phase 2: Service Scan**
   Read and execute `workflows/service-scan.md`.
   Loop through each pending service found in Phase 1.
   Extract API, Database Schema, Events, and Working Knowledge (Architecture, Conventions, Patterns).

3. **Phase 3: Synthesis**
   Read and execute `workflows/synthesis.md`.
   Assemble cross-service event chains, write `architecture/data-flow.md`, write per-service `data-flow.md` slices, apply global ADRs, and build the root index.

4. **Completion**
   Run the checklist in `checklist.md` to validate the final output and ask the user if they'd like to manually review any incomplete sections.
