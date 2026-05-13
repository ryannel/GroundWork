# 02. Architecture Extraction & Synthesis

The Extraction & Synthesis phase maps the *actual* reality of the codebase. Instead of relying on aspirational or stale human-written documentation, GroundWork reads the code to establish the objective contracts.

## 1. Two-Tiered Scanning
To map boundaries efficiently without blowing out context windows:
- **Shallow Scan:** A rapid pass to identify top-level services, modules, and directories.
- **Deep Scan:** A focused extraction of exact boundaries within a specific service.
- **Brownfield Discovery:** For existing projects, we infer domain boundaries directly from the existing contracts discovered in this phase.

## 2. Static Contract Pinning
GroundWork heavily prioritizes deterministic, static contracts.
- **Explicit Hunting:** During scanning, the agent explicitly hunts for static schema definitions (OpenAPI, AsyncAPI, Protobufs, DB migration files, Atlas schema files).
- **Pinning the Design:** We pin much of our downstream design around these static files. 
- **Guidance:** If the system only generates these schemas at runtime, the agent must guide the user to generate static files so their exact locations can be locked into the architecture documentation.

## 3. Write-and-Purge
To preserve LLM context limits and maintain high reasoning quality:
- The agent scans a batch of files and writes the extracted architecture to markdown.
- **Crucially, the agent then *purges* its memory.** 
- This memory purge is achieved by either spawning sub-agents for specific extraction tasks or explicitly prompting the user to start a new chat session before continuing.

## 4. Interactive Elicitation
Extraction is a collaborative process.
- When the agent hits spaghetti code, deeply coupled logic, or an ambiguous boundary, it pauses.
- It presents a BMAD-style menu (`[A] Accept, [E] Elicit Clarification, [S] Skip`), forcing the human to help untangle the mess rather than guessing.

## 5. Global ADR Propagation
High-level architectural decisions must be visible where the work happens.
- Global Architectural Decision Records (ADRs) are mapped directly into the local `architecture.md` files of the specific services they affect.
