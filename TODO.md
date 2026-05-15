# GroundWork Implementation Tasks & Ideas

## Immediate Tasks
- [x] Remove automated pattern extraction and replace with Skill Assessment logic.
- [x] ~~Integrate `skill-creator` into the GroundWork CLI installation~~ *(Deliberately excluded to keep meta-skills separate from production GroundWork methodology).*
- [x] **Test CLI**: Execute `npx groundwork init` in a test repository (e.g., `video-generation`) to verify that all `.agents/skills` copy over correctly.
- [ ] **Implement Parsers**: Build the Python/Bash helper scripts that back the XML actions in `groundwork-setup` (e.g., parsing `openapi.yaml`, `schema.sql`, and `asyncapi.yaml`).
- [ ] **Build Update Engine**: Flesh out the `groundwork-update` skill to handle surgical, in-place diffing of architecture documents when specific source files change.

## Backlog / GroundWork Roadmap

Based on the core "Ways of Working" (Problem Statement -> Pitch -> TDD Foundations -> TDD Execution) combined with the power of BMAD-style Agent Personas, here is the ecosystem of GroundWork skills we need to build:

### 1. Agent Personas (The "Who")
BMAD's persona system is powerful. We need to define explicit GroundWork agent personas that enforce the methodology's tone and strictness:
- [ ] `groundwork-pm`: Evaluates appetites, shapes Pitches, defines Milestones.
- [ ] `groundwork-ux-designer`: Translates pitches into concrete UI Designs (states, interactions, user journeys).
- [ ] `groundwork-architect`: Derives Data Flows and Boundary Inventories strictly from the UI Design.
- [ ] `groundwork-data-engineer`: Translates boundaries into explicit Contracts (OpenAPI/RFC 9457) and Schemas (PostgreSQL/JSONB).
- [ ] `groundwork-tester`: Generates system-level test cases (Bet Test Suites) from the slices before code is written.

### 2. Methodology Skills (The "What")
These skills enforce the progressive exposure pipeline from idea to vertical slices:
- [ ] **Discovery Phase:**
  - `groundwork-problem-statement`: Elicits real, evidenced pain and appetite.
  - `groundwork-pitch`: Upgrades a problem statement into a solution sketch, forcing explicit definition of rabbit holes and no-gos.
- [ ] **TDD Foundations (Upfront Technical Delivery):**
  - `groundwork-ui-design`: Generates the UI Design doc (wireframes, states, data objects).
  - `groundwork-data-flow`: Generates system context graphs, operation sequences, and failure modes.
  - `groundwork-contracts`: Defines OpenAPI/AsyncAPI contracts from the boundary inventory.
  - `groundwork-schema`: Defines the database schemas and state machines.
- [ ] **TDD Execution (Slicing):**
  - `groundwork-milestones`: Groups contracts into integration checkpoints.
  - `groundwork-slice`: Breaks milestones into strictly vertical, independently deployable slices with explicit falsifiable test cases.

### 3. Architecture: Context-Optimized Orchestration
To prevent blowing up the LLM context window with dozens of skill descriptions, we must implement an Orchestrator pattern:
- [x] **`groundwork-orchestrator` (The Router)**: Instead of installing all methodology skills into the `.agents/skills/` directory, we install *only* the Orchestrator. 
- [x] **The Manifest**: The Orchestrator holds a `manifest.csv` mapping user intents to specific Markdown instruction files stored in a non-registered folder. 
- [x] **On-Demand Loading**: When the user requests a task, the agent uses the Orchestrator to find the right instruction file, `view_file`s it, and executes the instructions just-in-time.
- [/] **Triage Routing**: Evaluate the workspace (Greenfield vs Brownfield) and suggest the right entry point (`groundwork-product-brief` vs `groundwork-setup`).
- [ ] **Refactor Routing**: Clean up the Orchestrator triage logic once we have more examples of routing (i.e. more skills added to the manifest and pipeline).

- [x] **Technical Writing Skill**: Bring in/develop a dedicated technical writing skill (e.g., `groundwork-writer`) that helps maintain the docs, provides AI metadata (frontmatter/tags), and ensures the GroundWork Tone is enforced consistently.
- [ ] **Build Missing Phase 1-4 Skills**: 
  - [x] `groundwork-product-brief` (Interactive BMAD-style Greenfield PM facilitation)
  - [ ] `groundwork-setup` (Automated Brownfield codebase extraction)
  - [ ] `groundwork-setup:design-system`
  - [ ] `groundwork-brainstorm` (for Problem Statements)
  - [x] `groundwork-help` (Orchestration/What's next)
- [ ] **Publishing**: Configure `package.json` testing scripts and prepare the package for NPM publication.

## Ideas Backlog
- *Add your ideas here...*
