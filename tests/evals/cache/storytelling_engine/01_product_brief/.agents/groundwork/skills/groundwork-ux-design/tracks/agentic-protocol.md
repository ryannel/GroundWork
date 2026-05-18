# Agentic Protocol Track

This track applies to products whose primary interface is an agent-to-human or agent-to-agent protocol: skill frameworks, MCP servers, developer methodology tools, agent orchestrators, and any product where the "user interface" is a structured conversation between humans and AI agents.

---

## Default Stance

Be fluid. Adapt seamlessly to the user's product positioning and the specific agent ecosystem they target. The agent's role is to match the user's vision — not to impose a rigid protocol style.

The default starting position is modern, high-precision protocol design and developer experience standards. Draw inspiration from trend-setting methodologies and systems (e.g., Shape Up, Linear Method, OpenAPI, gRPC/Protocol Buffers, Terraform, Nix). When the user has no strong preference, advocate for the following defaults:

**Technical defaults:**
- Zero-boilerplate context loading — the agent must reach operational awareness from cold start in under 3 file reads.
- Declarative state management via flat, machine-readable files (JSON, TOML) that any agent can parse instantly.
- Agent-agnostic design — the protocol must function identically across Claude Code, Gemini, Cursor, Windsurf, and any future agent runtime.
- Filesystem as the shared memory layer — no database, no API, no external service required for protocol state.
- Deterministic phase transitions — every state change must be traceable and reversible.
- Version-controlled everything — every design decision, state transition, and artifact must live in the repo.

**Precision bar** (examples of the premium standard we target — adapt to the user's chosen direction):
- Surgical context injection — the agent receives exactly the information it needs for the current task, nothing more.
- Contract-first design — interfaces, schemas, and data flows are defined before implementation begins.
- Proof-of-work verification — system-wide tests, not human code review, are the primary quality signal.
- Layered fidelity — information flows from abstract (vision) to concrete (implementation) through strict layers that never contradict each other.
- Explicit error postures — every failure mode has a defined recovery path, not a generic "something went wrong."
- Human-as-architect — humans own design decisions; agents own execution within those decisions.

---

## Stage 1: Non-Functional Requirements (NFR)

Begin by understanding the user's values and high-level expectations for how their protocol should feel and behave. Read `docs/product-brief.md` for product context. Do not walk through a granular checklist or present a wall of questions — instead, conduct a higher-level, **strictly one-question-at-a-time** conversation that captures their priorities, values, and instincts.

Pick **one** of the following topics to start with, ask a single question, and wait for the user's response before moving to the next:
- What does "fast" mean in their protocol context? Is it agent startup time, context-loading speed, or turn latency?
- How important is agent-agnosticism? Must the protocol work across multiple agent runtimes, or is it tied to one?
- What is the authority model? Where does the human lead and where does the agent have autonomy?
- How do they think about verification? What constitutes "proof" that the agent's work is correct?
- What are their instincts around error handling? Should the agent self-repair, halt and escalate, or degrade gracefully?

After you have explored these areas through a multi-turn dialogue, **propose** a comprehensive set of granular NFRs that align with the user's stated values, modern best practices, and the product context. Cover:

1. **Agentic Efficiency**: Context-loading budgets (max file reads to reach awareness), token budget consciousness, incremental vs. full state loading, zero-boilerplate startup requirements.
2. **Context Persistence**: Filesystem as shared memory, declarative state format, agent-agnostic resumability, cross-session continuity guarantees.
3. **Authority Model**: Human-led design vs. agent-led execution boundaries, escalation triggers, approval gates, autonomous action scope.
4. **Verification & Governance**: Contract enforcement mechanisms, proof-of-work requirements (tests, checks, validations), guardrail definitions, what constitutes "done."
5. **Error Resilience**: Graceful degradation strategy, halt-and-ask vs. self-repair policy, inconsistent state detection, recovery choreography.
6. **Interoperability**: Agent-agnostic design requirements, runtime compatibility targets, lowest-common-denominator constraints.
7. **Auditability & Traceability**: Rationale logging requirements, version-controlled design decisions, change traceability, decision archaeology.
8. **Security & Trust**: Secret handling in agent context, credential isolation, sensitive output masking, trust boundaries between human and agent.

Present the proposed NFRs and refine collaboratively. Once the user approves, write the agreed NFRs to the Stage 1 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 2.

---

## Stage 2: Research

Drawing on the product context and agreed NFRs from Stage 1, build a targeted pool of inspiration.

1. Gather a list of leading methodologies, protocols, developer tools, and specification systems that exemplify modern, high-precision design. Prioritise systems that solve similar protocol and DX problems to the ones this product faces and are trend-leading in how they do it. Sources of inspiration include:
   - **Methodologies**: Shape Up (pitches, bets, appetite), Linear Method (opinionated cycles), BMAD (spec-driven personas), Getting Things Done (context-based action lists).
   - **Specification Systems**: OpenAPI/Swagger (contract-first API design), Protocol Buffers/gRPC (schema-driven communication), JSON Schema (declarative validation), AsyncAPI (event-driven contracts).
   - **Developer Tools**: Terraform (declarative infrastructure, plan-apply-verify), Nix (reproducible environments), Makefiles (dependency-driven execution), just (command runners with discoverability).
   - **Formal Methods**: TLA+ (system modelling before coding), Alloy (lightweight formal methods), design-by-contract (preconditions, postconditions, invariants).
   - **Protocol Designs**: Language Server Protocol (structured agent-editor communication), MCP (tool discovery and invocation), UNIX philosophy (small tools, composable pipelines, text as universal interface).
2. Present this Inspiration Library to the user, describing exactly what each example does well and how it applies to our product's protocol design.
3. **STOP and ask the user:** Ask for their thoughts. Do they agree with the references? Are there specific paradigms or patterns from this list they want to adopt? Do not proceed until they have confirmed the direction.

Once the user approves, write the agreed inspiration library to the Stage 2 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 3.

---

## Stage 3: Workspace Topology

Define the structural container of the protocol — the filesystem architecture, state management, and discovery surfaces that agents and humans interact with. This is the equivalent of an "App Shell" for agentic systems.

Guide the user with leading-edge protocol design patterns. Discuss and define:

- **Filesystem Architecture**: Where do config, state, cache, and deliverables live? Propose a clear separation of concerns (e.g., persistent config vs. transient working files vs. final outputs). Reference patterns from Terraform (`.terraform/` vs. `*.tf`), Git (`.git/` vs. working tree), and Nix (`/nix/store` vs. flake outputs).
- **State Management**: How is protocol state represented? Propose flat, machine-readable formats (JSON, TOML) with explicit schemas. Define what fields are required, what transitions are valid, and how the agent determines "what's next" from a cold start.
- **Skill/Tool Discovery**: How does the agent find what it can do? Propose a discovery surface — a manifest, a directory convention, or a routing table. Define the difference between always-visible capabilities and on-demand capabilities loaded contextually.
- **Context Injection**: How does the agent get the right information at the right time? Propose a layered context strategy — what's loaded on every invocation (global context), what's loaded per-phase (phase context), and what's loaded on-demand (task context). Minimising token consumption is a design constraint, not an afterthought.
- **Empty & Boot States**: What does the agent see on first run with no prior state? On interrupted runs? On stale state? Propose detection heuristics and recovery paths for each.
- **Progressive Disclosure**: How is complexity introduced as the project matures? Propose a strategy where early-phase interactions are simple and later phases unlock more capabilities.

Propose the workspace topology based on the inspiration library and these patterns. Ask the user to react and refine.

Once the user approves, write the agreed workspace topology to the Stage 3 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 4.

---

## Stage 4: Interaction Language

Lead a high-level conversation about how the protocol communicates. The user should never need to think about specific formatting rules — your job is to understand their instincts about tone, density, and precision deeply enough to extrapolate the concrete system yourself.

Discuss the following with the user:

- **Tone & Posture**: How should the agent communicate with the human? Options span a wide range: terse and declarative ("The system will..."), collaborative and peer-like ("Let's explore..."), or pedagogical and explanatory ("This works because..."). Reference specific systems from the inspiration library. Discuss hedging rules — should the agent ever say "I think" or "maybe"?
- **Information Density**: How much information per turn? Dense, surgical diffs that lead with conclusions (inverted pyramid)? Or narrative explanations that build understanding? How should the agent balance speed (give the answer) vs. teaching (explain the reasoning)?
- **Propose vs. Prompt**: When the agent needs user input, should it present a concrete proposal for the user to react to, or ask open-ended questions? Discuss the tradeoffs — proposals are faster but risk anchoring; questions are slower but surface genuine preferences.
- **Status Semantics**: How does the protocol communicate system state? Discuss standardised markers (emojis, icons, text labels), colour coding (if terminal output is involved), and log levels. What states need to be communicated? (Done, in-progress, stale, error, blocked, next action.)
- **Documentation Hierarchy**: How are protocol documents structured for both human readability and agent parsability? Discuss frontmatter metadata, heading conventions, cross-referencing patterns, and the relationship between summary views and detail views.
- **Error Communication**: How does the agent communicate failures? Discuss the spectrum from silent recovery to loud halts. When should the agent attempt self-repair vs. escalate to the human? How should error messages be structured — just the problem, or problem + context + recovery suggestion?
- **Naming & Taxonomy**: What naming conventions govern the protocol? Discuss command naming (verb-noun vs. noun-verb), phase naming, artifact naming, and whether the protocol uses domain-specific vocabulary or generic terms.
- **Microcopy & Phrasing**: How does the protocol speak in its smallest units — confirmation messages, status updates, transition announcements? Terse ("Done."), informative ("Product Brief saved to docs/product-brief.md."), or contextual ("Product Brief complete. Next step: UX Design.")?

### Synthesis Gate

Before caching, distill the entire Stage 4 conversation into a structured direction and present it to the user for confirmation. This is mandatory — scattered conversation notes are not sufficient input for Stage 5.

The synthesis stays in the user's language. No state schemas, no format rules, no log level definitions. It captures the *decisions* the user made in terms they recognise:

- **Communication posture**: A short characterisation of the agent's personality (e.g., "Collaborative peer — leads with proposals, explains reasoning, never hedges").
- **Information density**: How much per turn (e.g., "Dense and surgical — conclusions first, supporting context below, no preamble").
- **Propose-vs-prompt ratio**: The default interaction mode (e.g., "Always propose first, ask open questions only when the direction is genuinely ambiguous").
- **Error philosophy**: How failures are communicated (e.g., "Diagnose and suggest recovery — never just report a problem without a next step").
- **Status language**: How the protocol signals state (e.g., "Terse markers with emoji status badges — scannable at a glance").
- **Naming instinct**: The vocabulary style (e.g., "Verb-noun commands, kebab-case artifacts, domain terms defined explicitly").
- **Microcopy tone**: How the smallest units of text feel (e.g., "Informative but not chatty — 'Product Brief saved to docs/product-brief.md. Next: UX Design.'").

Present this as a clear summary the user can scan and approve in one read. Ask them to confirm or correct before proceeding.

Once the user confirms the direction, write this synthesis to the Stage 4 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 5.

---

## Stage 5: Expert Translation & Review

Stage 5 has two distinct phases. The first is autonomous work by the agent. The second is a collaborative conversation about the specifics.

### 5a: Translation (Agent-Driven)

The user provided taste, instinct, and direction across Stages 1–4. The agent now translates that into a rigorous protocol design specification — autonomously.

Compile the full UX Design Guide using the approved outputs stored in `.groundwork/cache/ux-design-cache.md`. The document combines NFRs from Stage 1 with a comprehensive protocol design system that the agent derives from the interaction language direction captured in Stage 4.

Apply the `groundwork-writer` skill to ensure the tone is declarative, assertive, and free of hedging. Structure it to read like a rigorous protocol specification that simultaneously serves as instruction material for any agent runtime.

**The Translation Mandate**: The user said "collaborative peer" — the agent specifies the exact persona brief, prohibited hedging phrases, and propose-vs-prompt triggers. The user said "conclusions first" — the agent defines the inverted pyramid rule with concrete structural templates. The user said "verb-noun commands" — the agent produces a complete naming convention with casing rules, artifact patterns, and vocabulary boundary definitions. Every high-level preference from Stage 4 must be resolved into concrete, enforceable specifications. If the cached direction is ambiguous, the agent makes the design call — that is the job.

**Critical**: Agent runtimes consistently fail to maintain protocol coherence without deeply specified interaction rules. The protocol design system must go beyond naming conventions and tone guidelines — it must prescribe exact state schemas, phase transition rules, error choreography, and a clear taxonomy that tells the implementing agent exactly how to behave in every situation.

### UX Design Guide Target Structure

#### Part 1: The Constraints (Non-Functional Requirements)
Concrete behavioural rules derived from Stage 1. Context-loading budgets, verification requirements, authority boundaries, error resilience policies, and interoperability guarantees.

#### Part 2: Workspace Topology & Interaction Principles
Protocol interaction pillars derived from the workspace topology (Stage 3) and interaction language (Stage 4). Filesystem architecture, state management, discovery surfaces, context injection strategy, and communication posture.

#### Part 3: Protocol Design System

Translate the user's high-level interaction preferences into concrete, enforceable specifications. Each section must be deeply specified:

##### State Architecture
- Define the canonical state format (JSON, TOML, or other). Specify the exact schema with required fields, valid values, and type constraints.
- Define state transition rules: which transitions are valid, what triggers them, and what side effects each transition produces.
- Define cold-start resolution: how does the agent determine the current state and next action from a file that may be stale, incomplete, or corrupted?
- Define reconciliation rules: when filesystem artifacts and recorded state disagree, which wins? Specify the reconciliation algorithm.

##### Context Hierarchy
- Define the context layers: global (loaded on every invocation), phase-specific (loaded for the current lifecycle stage), and task-specific (loaded on demand for a specific action).
- For each layer: specify exactly which files are read, in what order, and what information they provide.
- Define context budget rules: maximum file reads before the agent must begin work, maximum token investment in context loading, and strategies for incremental loading.
- Specify cache invalidation: how does the agent know when cached context is stale?

##### Document Architecture
- Define the standard document structure: required sections, heading hierarchy, frontmatter metadata schema.
- Specify the relationship between document types: which documents reference which, and how cross-references are formatted.
- Define the inverted pyramid rule: conclusions and decisions lead; supporting context, rationale, and alternatives follow.
- Specify machine-parsability requirements: what formatting constraints ensure an agent can reliably extract structured information from documents?

##### Interaction Semantics
- Define the status marker vocabulary. For each marker: the symbol or label, its exact meaning, and when to use it.
- Define log level semantics: what constitutes INFO, WARN, ERROR, and DEBUG in this protocol? When does each level apply?
- If terminal output is involved, define colour semantics: which ANSI colours map to which meanings. Specify `NO_COLOR` compliance.
- Define progress communication: how does the agent report on long-running operations? Streaming updates, periodic summaries, or silent-until-complete?

##### Tone & Posture Specification
- Define the agent persona: its communication style, authority level, and relationship to the human. Write this as a concrete character brief, not abstract principles.
- Define hedging rules: list specific phrases that are prohibited (e.g., "I think," "maybe," "it seems like") and their required replacements (e.g., "The system requires," "This approach," "The evidence indicates").
- Define the propose-vs-prompt ratio: in what percentage of interactions should the agent lead with a proposal vs. ask an open-ended question? Specify the triggers for each mode.
- Define microcopy templates: exact phrasing patterns for confirmations, transitions, errors, and status updates.

##### Skill & Tool Anatomy
- Define the standard skill interface: what steps must every skill execute, in what order?
- Specify the pre-flight checklist: what must the agent verify before beginning any action? (State consistency, required file existence, prerequisite phase completion.)
- Define the action contract: what guarantees does a skill make about its execution? (Idempotency, atomicity, rollback capability.)
- Specify the handoff protocol: how does one skill transfer control to another? What state must be written, what confirmation must be given, and how is the next skill identified?
- Define validation rules: what checks must pass after every action? (State consistency, artifact existence, contract compliance.)

##### Error & Recovery Choreography
- Define error severity levels and the required response for each:
  - **Recoverable**: The agent can fix this without human input. Define the retry/self-repair strategy.
  - **Blocking**: The agent cannot proceed. Define the halt message format: what happened, why it matters, what the human should do.
  - **Inconsistent State**: Recorded state and filesystem disagree. Define the reconciliation protocol and escalation path.
  - **Contract Violation**: An agent action would violate an established contract. Define the hard-stop behaviour — no workaround, no override without human-led design revision.
- Define the escalation ladder: at what point does the agent stop trying to fix things and ask for help? Specify the trigger conditions and the escalation message format.

##### Naming & Taxonomy
- Define command/phase naming conventions: verb-noun, noun-verb, or domain-specific? Specify casing rules (kebab-case, camelCase, etc.).
- Define artifact naming conventions: how are output files named? What naming pattern ensures discoverability and prevents collisions?
- Define the vocabulary boundary: list domain-specific terms the protocol uses and their precise definitions. Distinguish between terms the protocol owns and terms borrowed from external systems.
- Specify the naming self-test: before committing any new name, ask — "Would a developer unfamiliar with this protocol understand this name without explanation?"

##### Versioning & Evolution
- Define how the protocol handles breaking changes: version bumps, migration scripts, deprecation warnings?
- Specify backward compatibility guarantees: which aspects of the protocol are stable and which are experimental?
- Define the changelog format: how are protocol changes communicated to users and agents?

---

Before presenting the draft, run this self-check: **every section must contain committed, implementable values — not echoes of the user's words**.

The user's vocabulary must be fully translated:
- "Collaborative peer" → a concrete persona brief with prohibited phrases and their replacements.
- "Conclusions first" → structural templates with heading hierarchy and section ordering rules.
- "Verb-noun commands" → a complete naming convention with casing, artifact patterns, and vocabulary definitions.
- "Diagnose and suggest" → exact error message structures with severity levels, escalation ladders, and recovery formats.
- "Scannable markers" → a full status vocabulary table with symbols, meanings, and usage rules.

If any section still reads like a design brief rather than a build specification, the translation is incomplete. Derive the missing values from the approved direction — do not go back to the user. Making these calls is the agent's core contribution.

### 5b: Review (Collaborative)

Present the complete draft to the user. This is the first time the user sees technical specifics — actual state schemas, error format definitions, naming convention tables, phase transition rules.

The user's role shifts from providing direction to reacting to choices. They will say things like "that error format is too rigid," "I want more warmth in the status markers," or "the naming convention feels right." Walk through the spec together and adjust.

Do not rush this. The user has earned a say in the details by providing clear direction earlier. If they push back on a choice, propose alternatives that still honour the original intent. If they approve, move on.

Refine iteratively until the user is satisfied with the full specification.

Once approved, return to `instructions.md` and execute Stage 6: Commit.
