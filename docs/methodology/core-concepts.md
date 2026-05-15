# GroundWork Core Methodology & Philosophy

GroundWork is an installable, AI-driven architectural framework. It enforces a strict **Upfront Technical Delivery** pipeline that ensures software is meticulously designed, contracted, and verified *before* code is written, effectively eliminating "just-in-time" engineering.

## The Philosophy: Upfront Technical Delivery

GroundWork explicitly rejects the common AI-assisted workflow of "just start coding and figure it out." Instead, it operationalizes a highly disciplined progression:

1. **Problem Statement & Pitch**: Grounding every effort in real, evidenced user pain bounded by a strict appetite (opportunity cost).
2. **TDD Foundations**:
   - **UI Design**: Wireframes and user journeys dictate exactly what the user needs.
   - **Data Flows**: The UI strictly dictates the service boundaries, operations, and failure modes.
   - **Contracts & Schemas**: The data flows strictly dictate the API contracts (e.g., OpenAPI, AsyncAPI) and persistent schemas (e.g., PostgreSQL).
3. **TDD Execution (Slicing)**:
   - **Milestones**: Integration checkpoints that deliver user value.
   - **Vertical Slices**: Smallest independently deployable units of work backed by falsifiable, system-level test assertions.

If a developer cannot build the API contracts purely from the Data Flow document, the Data Flow document is incomplete. **GroundWork builds the map before it drives the car.**

## Inspiration & Departure from BMAD

GroundWork's execution engine is heavily inspired by the [BMAD Method](https://github.com/bmad-method).

**What we kept (The Engine & Personas):**
- Strict XML-routed workflows (`<step>`, `<action>`, `<check>`).
- The use of specialized **Agent Personas**. GroundWork utilizes dedicated personas (e.g., `groundwork-pm`, `groundwork-architect`, `groundwork-data-engineer`, `groundwork-tester`) to enforce different stages of the pipeline with extreme rigor.

**What we rejected (The Output & Agile Focus):**
- BMAD leans heavily into Agile Epics/Stories and often jumps from high-level architecture straight to coding.
- GroundWork enforces **Upfront Technical Contracts** (OpenAPI, SQL Schemas) and **Vertical Slicing** with System-Level Test Scaffolding. We write the exact API specification and database schema before any code is generated.

## The Toolchain Ecosystem

GroundWork operates via the `npx groundwork init` CLI, which provisions a suite of specialized methodology skills into a repository's `.agents/skills/` folder. The ecosystem is divided into:

### 1. Agent Personas
Dedicated system prompts that assume specialized roles in the delivery pipeline:
- `groundwork-pm` (Appetite, Problem Statements, Pitches)
- `groundwork-ux-designer` (Wireframes, States, Data Objects)
- `groundwork-architect` (Data Flows, Boundary Inventories)
- `groundwork-data-engineer` (REST/WS Contracts, Postgres Schemas)
- `groundwork-tester` (Milestones, Vertical Slices, Test Assertions)

### 2. Methodology Skills
The pipeline steps executed by the Personas:
- **Discovery:** `groundwork-problem-statement`, `groundwork-pitch`
- **Foundations:** `groundwork-ui-design`, `groundwork-data-flow`, `groundwork-contracts`, `groundwork-schema`
- **Execution:** `groundwork-milestones`, `groundwork-slice`, `groundwork-test-stub`
- **Maintenance:** `groundwork-check` (Drift detection), `groundwork-update` (Surgical architecture patches)

## Document Generation & Placement
GroundWork adapts to existing documentation strategies. It locates the target content directory (e.g., for MkDocs, Docusaurus, Nextra) and structures its artifacts accordingly, or provisions a standalone `docs/` system of record. Every document generated adheres strictly to the "GroundWork Tone"—objective, declarative, and devoid of filler.
