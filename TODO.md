# GroundWork Implementation Tasks & Ideas

## Immediate Tasks
- [x] Remove automated pattern extraction and replace with Skill Assessment logic.
- [x] ~~Integrate `skill-creator` into the GroundWork CLI installation~~ *(Deliberately excluded to keep meta-skills separate from production GroundWork methodology).*
- [x] **Test CLI**: Execute `npx groundwork init` in a test repository (e.g., `video-generation`) to verify that all `.agents/skills` copy over correctly.
- [x] **Build Update Engine**: `groundwork-update` rebuilt as a full maintenance skill — change-set resolution, three-pass code→doc mapping, surgical Living-Documents edits, fail-closed review gate. (2026-06-09)

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
- [x] **Triage Routing**: The orchestrator detects Greenfield vs Brownfield from the filesystem and routes to the correct lifecycle phase.
- [ ] **Refactor Routing**: Clean up the Orchestrator triage logic once we have more examples of routing (i.e. more skills added to the manifest and pipeline).

- [x] **Technical Writing Skill**: Bring in/develop a dedicated technical writing skill (e.g., `groundwork-writer`) that helps maintain the docs, provides AI metadata (frontmatter/tags), and ensures the GroundWork Tone is enforced consistently.
- [ ] **Build Missing Phase 1-4 Skills**: 
  - [x] `groundwork-product-brief` (Interactive BMAD-style Greenfield PM facilitation)
  - [ ] `groundwork-brainstorm` (for Problem Statements)
- [ ] **Publishing**: Configure `package.json` testing scripts and prepare the package for NPM publication.

## Brownfield Initialisation

Brownfield — initialising GroundWork against an existing codebase — is now implemented. The track scans the repo, reverse-engineers the canonical doc set, additively bolts on the operational layer, and converges to the same end-state as greenfield before entering the bet loop. Phase sequence: `groundwork-scan` (Phase 0) → `groundwork-product-brief-extract` → `groundwork-design-system-extract` → `groundwork-architecture-extract` → `groundwork-infra-adopt` → bet loop.

- [x] **Orchestrator routing**: Brownfield Setup Phases table, Skill Paths, Mode Detection, the `fan_out` hint, the durable `scan` marker, contract-aware completion, and Adopt/Upgrade mode added to `src/skills/groundwork-orchestrator/SKILL.md`.
- [x] **`groundwork-scan`**: New Phase 0 engine. Classify → deterministic structural map (depwire, with LLM-inference fallback) → scope-confirm → dual-execution digest (sub-agent fan-out / sequential batch) → concern-split findings cache. Reads every code file via the parser; the LLM reads selectively.
- [x] **`groundwork-product-brief-extract`**: Recovers `docs/product-brief.md` from scan findings + README + package metadata; interviews only the why/who/success gaps.
- [x] **`groundwork-architecture-extract`**: Two-tier reconstruction from `scan/architecture-findings.md` + `repo-map.json`. Mints domain stubs from schemas/migrations; mints ADRs only where the interview supplies rationale.
- [x] **`groundwork-design-system-extract`** (was `groundwork-ux-extract`, renamed for parity): Recovers tokens from Tailwind/CSS/theme/component config into `docs/design-system.md`; emits `brand-tokens.json`.
- [x] **`groundwork-infra-adopt`**: nx.json bootstrap + infra generators only (compose adopt/merge guard); adopts existing services into `docs/services` + `docs/api` (`status: live`) without regeneration.
- [x] **Drift baseline**: Folded into each phase's commit (`generation_mode: extracted` + `source_of_truth` + `last_reviewed`); `groundwork-infra-adopt` sets `baseline.source_commit`. `groundwork-check` glob extended to `docs/architecture.md`, `docs/api/`, `docs/domain/`.
- [x] **Gap ledger**: records distance from GroundWork standard (blocks-delivery / standard-divergence / cosmetic); feeds bet planning. (Superseded 2026-06-09: consolidates into the living `docs/maturity.md` roadmap instead of the one-shot `docs/onboarding-report.md`.)
- [x] **depwire as a first-class code map**: registered as an MCP server by `npx groundwork init`; consumed by scan, architecture-extract, and `groundwork-check`; degrades to LLM inference when absent.

Follow-ups deferred from the brownfield build:

- [ ] **Run the brownfield simulation** (`./dev sandbox --brownfield --simulate`) end-to-end in real Claude Code and assess via `./dev sandbox review` + `/judge`. The SDK eval harness was removed in favour of simulation, so this now exercises the real skill-loading, subagent dispatch, and depwire fan-out paths — no API key / turn budgets to tune.
- [x] **Restore brownfield to framework docs**: brownfield restored to `docs/product-brief.md` (capability bullet, stale exclusion removed) and to the lifecycle docs (`docs/lifecycle/index.md`, `01-setup.md` brownfield path section). `docs/methodology/core-concepts.md` no longer exists — the lifecycle docs are its successor. (2026-06-09)

## Deferred from Plans

- [x] **Skill ↔ doc sync checks**: covered mechanically by `./dev lint skills` (doc-pairs check: routed phases must appear in the lifecycle docs; every cited protocol number must exist in the operating contract; routing ↔ filesystem agreement both directions). Wired into CI. (2026-06-09)
- [ ] **Success-signal measurement plan (F14)**: The MVP pitch captures a success signal (a concrete observable outcome that confirms the MVP delivered value), but nothing wires that signal to a measurement plan. Needs its own design conversation — where metrics live, who instruments them, what triggers the readout. Deferred from `docs/plans/greenfield-flow-improvements.md` 2026-05-26.

## Ideas Backlog
- [ ] **Desktop and mobile app generators**: Electron (desktop, cross-platform) and React Native (mobile, cross-platform) are the natural fit given the existing JS/TS toolchain. Native per-platform (Swift, Kotlin) is a longer-term consideration. Parked until the web app generator is solid.
