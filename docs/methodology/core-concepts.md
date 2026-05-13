# GroundWork Core Methodology & Philosophy

GroundWork is an installable, AI-driven architectural framework. It is designed to act as the governing architectural layer for a codebase, ensuring that documentation and code remain perpetually in sync through structural contracts.

## The Philosophy: Docs for Humans and Agents
GroundWork operates on the overarching philosophy that architecture documentation must be a first-class citizen designed equally for **humans and agents**. 
It explicitly breaks away from traditional AI documentation generation that produces massive, narrative "File Inventories" (often referred to as the Doxygen trap). 

If you want to know what a function takes as arguments or how it handles a specific error, you should read the code or use your IDE. **GroundWork does not document code.**

Instead, GroundWork focuses purely on **Architectural Abstraction and Synthesis**. It extracts the critical structural boundaries that code cannot easily explain on its own:
1. **API Contracts**: The strict shapes of inputs and outputs.
2. **Database Schemas**: The canonical data models.
3. **Async Events**: The `published_when` and `consumed_by` triggers that drive async logic.
4. **Data Flows**: Synthesizing those events into cross-service system maps.
5. **Directory Boundaries**: What belongs in the domain layer vs. the adapter layer.

## Document Generation & Placement
GroundWork is designed to adapt to a repository's existing documentation strategy:
- **Phase 0 (Start Up):** The system first determines if a dedicated documentation site (e.g., MkDocs, Docusaurus, Nextra) is already in use. 
- **If a doc-site exists:** GroundWork locates the content directory. Because GroundWork assumes standard Markdown files organized in folders, it seamlessly injects its structural contracts into the existing site structure without breaking the build.
- **If no doc-site exists:** GroundWork automatically rolls out a standardized `docs/` folder at the root of the repository to act as the standalone system of record.

## Inspiration & Departure from BMAD
GroundWork's execution engine is heavily inspired by the [BMAD Method](https://github.com/bmad-method). 

**What we kept (The Engine):**
- Strict XML-routed workflows (`<step>`, `<action>`, `<check>`).
- Aggressive token-window management (the "Write-and-Purge" mandate) to prevent LLM hallucination in large codebases.
- Interactive, menu-driven "Deep Dives" that allow users to surgically expand documentation scope without forcing a massive, expensive full-repository scan upfront.

**What we rejected (The Output):**
- BMAD focuses on comprehensive file-by-file narrative generation. We reject this. We use the "GroundWork Tone" (persistent facts enforcing tables, lists, and definitive language) to compress thousands of lines of code into high-density, human-readable reference material.

## The Toolchain
GroundWork operates via an `npx groundwork init` CLI that provisions four core AI Agent Skills into a repository's `.agents/skills/` folder:

1. **`groundwork-setup` (The Heavy Lifter):** The core engine that discovers services, extracts the big three contracts (API, DB, Events), synthesizes global data flows, and generates the `docs/` site.
2. **`groundwork-check` (The CI Guard):** A script that diffs frontmatter `source_of_truth` paths against git history to detect documentation drift and fail CI builds.
3. **`groundwork-update` (The Surgeon):** A surgical update loop that patches specific architecture slices when code changes, avoiding full re-scans.
4. **`skill-creator` (The Toolsmith):** A utility to help developers build dedicated code-writing skills.

## The Skill Assessment Paradigm
Codebases suffer from style drift. Having an AI guess your coding patterns by reading 5 random files is a recipe for disaster. GroundWork explicitly drops all "pattern extraction". 

Instead, during a scan, GroundWork performs a **Skill Assessment**. It checks the `.agents/skills/` directory for dedicated, explicitly authored code-writing skills targeting the detected tech stack (e.g., `write-python-ml`). 
- If found, it assesses if the skill knows how to sync GroundWork contracts.
- If missing, it flags the architecture document with a warning, advising the user to run the `skill-creator`.

**GroundWork builds the map. Dedicated coding skills drive the car.**
