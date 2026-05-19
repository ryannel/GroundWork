# GroundWork Core Methodology & Philosophy

GroundWork is an installable, AI-driven architectural framework. It enforces a strict **Upfront Technical Delivery** pipeline that ensures software is meticulously designed, contracted, and verified *before* code is written, effectively eliminating "just-in-time" engineering.

## The GroundWork Lifecycle

GroundWork operates in two modes: **Setup** and **Delivery**.

### Setup (one-time, per project)

Establishes the skeleton — the vision, the design system, the service boundaries — and delivers the first working bet. Two paths depending on what exists:

| Path | Flow | Source of truth |
|---|---|---|
| **Greenfield** | Product Brief → UX Design → Architecture → MVP Bet | Collaborative discovery with the user. The repo starts empty. |
| **Brownfield** | Repo Scan + User Interview → Brief, Design, Architecture docs → Next Bet | A mix of automated repo analysis and user interview. |

Greenfield builds the docs from scratch through conversation. Brownfield reconstructs them — the agent scans the repo to understand what's already built, then fills the gaps through targeted questions with the user. Both paths converge: once the docs exist and the first bet ships, the project enters the Delivery Loop.

### Delivery Loop (repeating, ongoing)

Discovery → Refinement → Delivery of Bets. Each cycle can refine any document as the project learns.

All `docs/` artifacts are living documents. They grow as the project learns. Any phase, any bet, any conversation: if new information surfaces that refines an existing document, update it immediately.

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

## The Operating Contract

All methodology skills share a single set of behavioral protocols defined in the Operating Contract (`operating-contract.md`). These protocols govern:

- **Discovery Notes**: How out-of-phase signals are captured and carried forward.
- **Living Documents**: How existing docs are updated when new information surfaces.
- **Phase Lifecycle**: How each phase initializes, executes, commits, and hands off.

Every methodology skill loads and follows the Operating Contract. The protocols are defined once and referenced everywhere — never duplicated.

## Inspiration & Departure from BMAD

GroundWork's execution engine is heavily inspired by the [BMAD Method](https://github.com/bmad-method).

**What we kept (The Engine & Personas):**
- Strict XML-routed workflows (`<step>`, `<action>`, `<check>`).
- The use of specialized **Agent Personas**. GroundWork utilizes dedicated personas (e.g., `groundwork-pm`, `groundwork-architect`, `groundwork-data-engineer`, `groundwork-tester`) to enforce different stages of the pipeline with extreme rigor.

**What we rejected (The Output & Agile Focus):**
- BMAD leans heavily into Agile Epics/Stories and often jumps from high-level architecture straight to coding.
- GroundWork enforces **Upfront Technical Contracts** (OpenAPI, SQL Schemas) and **Vertical Slicing** with System-Level Test Scaffolding. We write the exact API specification and database schema before any code is generated.

## The Toolchain Ecosystem

GroundWork operates via the `npx groundwork init` CLI, which provisions a suite of specialized methodology skills into a repository's `.agents/` folder. The ecosystem is divided into:

### 1. Agent Personas
Dedicated system prompts that assume specialized roles in the delivery pipeline.

### 2. Methodology Skills
The pipeline steps executed by the Personas, organized into:
- **Setup:** `groundwork-product-brief`, `groundwork-ux-design`, `groundwork-architecture`
- **Delivery:** `groundwork-bet`
- **Maintenance:** `groundwork-check` (Drift detection), `groundwork-update` (Surgical architecture patches)

## Document Generation & Placement
GroundWork adapts to existing documentation strategies. It locates the target content directory (e.g., for MkDocs, Docusaurus, Nextra) and structures its artifacts accordingly, or provisions a standalone `docs/` system of record. Every document generated adheres strictly to the "GroundWork Tone"—objective, declarative, and devoid of filler.
