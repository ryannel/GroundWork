# Agentic Protocol Track

This track applies to products whose primary interface is an agent-to-human or agent-to-agent protocol: skill frameworks, MCP servers, developer methodology tools, agent orchestrators, and any product where the "user interface" is a structured conversation between humans and AI agents.

---

## Default Stance

Be fluid. Adapt seamlessly to the user's product positioning and the specific agent ecosystem they target. The agent's role is to match the user's vision — not to impose a rigid protocol style.

The default starting position is modern, high-precision protocol design. When the user has no strong preference, advocate for the following defaults — and be ready to explain *why* each one matters:

**Technical defaults:**
- Zero-boilerplate context loading — the agent must reach operational awareness from cold start in under 3 file reads. Every extra file read burns tokens and delays the agent's first useful action.
- Declarative state management via flat, machine-readable files (JSON, TOML). Agents parse structured data reliably; they hallucinate when reconstructing state from prose.
- Agent-agnostic design — the protocol must function identically across Claude Code, Gemini, Cursor, Windsurf, and any future agent runtime. Platform-specific features create lock-in that limits adoption.
- Filesystem as the shared memory layer. No database, no API, no external service required for protocol state — because every external dependency is a failure mode the agent cannot diagnose or recover from.
- Deterministic phase transitions — every state change must be traceable and reversible. Ambiguous state is the primary cause of agent confusion in multi-phase workflows.
- Version-controlled everything — every design decision, state transition, and artifact must live in the repo. The repo is the single source of truth; anything outside it is invisible to the agent.

**Precision bar** (examples of the premium standard the agent targets):
- Surgical context injection — the agent receives exactly the information it needs for the current task, nothing more.
- Contract-first design — interfaces, schemas, and data flows are defined before implementation begins.
- Proof-of-work verification — system-wide tests, not human code review, are the primary quality signal.
- Layered fidelity — information flows from abstract (vision) to concrete (implementation) through strict layers.
- Explicit error postures — every failure mode has a defined recovery path.
- Human-as-architect — humans own design decisions; agents own execution within those decisions.

Draw inspiration from trend-setting systems: Shape Up, Linear Method, OpenAPI, Protocol Buffers, Terraform, LSP, MCP, Unix philosophy.

---

## Stage 1: Non-Functional Requirements (NFR)

NFRs define the engineering envelope the protocol design system must operate within. Context-loading budgets, verification requirements, authority boundaries, and error resilience policies all constrain protocol design downstream — a protocol that specifies rich diagnostic output but must work within a 4K token context budget is internally contradictory.

Read `docs/product-brief.md` for product context. Then explore the user's values and priorities through a multi-turn conversation. Understand what they care about, what tradeoffs they'd accept, and what "broken" looks like in their protocol context.

The goal is to emerge with a clear picture of the protocol's non-functional constraints across these dimensions: agentic efficiency (context budgets, token consciousness), context persistence and resumability, authority model (human-led vs agent-led boundaries), verification and governance, error resilience, interoperability across agent runtimes, auditability and traceability, and security and trust boundaries. Not every dimension applies to every protocol — explore what's relevant, skip what isn't.

After exploring through dialogue, **propose** a comprehensive set of granular NFRs that synthesise the user's stated values with modern best practices. Present them and refine collaboratively. Once approved, write to the Stage 1 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 2.

---

## Stage 2: Research

The inspiration library grounds the design conversation in concrete, existing systems. Abstract discussions ("make it precise") produce vague specs. Discussions anchored in specific examples ("Terraform's plan-apply-verify loop forces explicit human approval before any state mutation") produce actionable protocol decisions.

Drawing on the product context and agreed NFRs from Stage 1, identify the core protocol challenges this product faces and find leading systems that solve similar problems exceptionally well. Describe the **specific pattern or mechanism** worth borrowing — not just the system's reputation. Sources span methodologies, specification systems, developer tools, formal methods, and protocol designs.

Present the Inspiration Library and ask for the user's reaction. Do not proceed until they have confirmed the direction.

Once approved, write to the Stage 2 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 3.

---

## Stage 3: Workspace Topology

The workspace topology is the structural container everything else lives inside — the filesystem architecture, state management, and discovery surfaces that agents and humans interact with. Getting this wrong means reworking every skill. Getting it right means every subsequent protocol decision has a home.

Define the structural skeleton using patterns from the Stage 2 inspiration library. The agent should explore and propose decisions across: filesystem architecture (where config, state, cache, and deliverables live), state management (format, schema, valid transitions), skill and tool discovery (manifests, directory conventions, routing tables), context injection strategy (global vs phase vs task layers), empty and boot states (first run, interrupted, stale), and progressive disclosure (how complexity scales as the project matures).

Guide the conversation with leading-edge protocol patterns. Propose the topology based on the inspiration library, then ask the user to react and refine.

Once approved, write to the Stage 3 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 4.

---

## Stage 4: Interaction Language

This stage captures the user's instincts about how the protocol communicates — the raw material the agent will translate into concrete protocol specifications in Stage 5. The user should never need to think about specific formatting rules or state schemas.

Explore interaction language dimensions through conversation — one topic at a time, going deep before advancing:

- **Tone and posture** — how the agent communicates with the human and where it sits on the spectrum from terse to pedagogical
- **Information density** — how much per turn, conclusions-first vs narrative
- **Propose vs prompt** — whether the agent leads with proposals or asks open-ended questions
- **Status semantics** — how the protocol signals system state
- **Documentation hierarchy** — how protocol documents are structured for both humans and agents
- **Error communication** — the spectrum from silent recovery to loud halts
- **Naming and taxonomy** — conventions for commands, phases, artifacts, and vocabulary
- **Microcopy and phrasing** — how the protocol speaks in its smallest units

### Synthesis Gate

Before caching, distill the entire Stage 4 conversation into a structured direction and present it to the user for confirmation. Scattered conversation notes are not sufficient input for Stage 5.

The synthesis stays in the user's language. No state schemas, no format rules, no log level definitions. It captures the *decisions* the user made in terms they recognise:

- **Communication posture**: A short characterisation of the agent's personality.
- **Information density**: How much per turn.
- **Propose-vs-prompt ratio**: The default interaction mode.
- **Error philosophy**: How failures are communicated.
- **Status language**: How the protocol signals state.
- **Naming instinct**: The vocabulary style.
- **Microcopy tone**: How the smallest units of text feel.

Present as a clear summary the user can scan and approve in one read. Confirm before proceeding.

Once confirmed, write the synthesis to the Stage 4 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 5.

---

## Stage 5: Expert Translation & Review

### 5a: Translation (Agent-Driven, Autonomous)

The user provided taste, instinct, and direction across Stages 1–4. The agent now translates that into a rigorous protocol design specification — autonomously.

Compile the full UX Design Guide using the approved outputs stored in `.groundwork/cache/ux-design-cache.md`. The document combines NFRs from Stage 1 with a comprehensive protocol design system that the agent derives from the interaction language direction captured in Stage 4.

Apply the `groundwork-writer` skill to ensure the tone is declarative, assertive, and free of hedging. Structure it to read like a rigorous protocol specification that simultaneously serves as instruction material for any agent runtime.

#### The Translation Mandate

The user said "collaborative peer" — the agent specifies the exact persona brief, prohibited hedging phrases, and propose-vs-prompt triggers. The user said "conclusions first" — the agent defines the inverted pyramid rule with concrete structural templates. The user said "verb-noun commands" — the agent produces a complete naming convention with casing rules, artifact patterns, and vocabulary definitions. Every high-level preference from Stage 4 must be resolved into concrete, enforceable specifications. If the cached direction is ambiguous, the agent makes the design call — that is the job.

Agent runtimes consistently fail to maintain protocol coherence without deeply specified interaction rules. The protocol design system must go beyond naming conventions and tone guidelines — it must prescribe exact state schemas, phase transition rules, error choreography, and a clear taxonomy.

#### Quality Standard: Deep vs. Shallow

Every section must contain enough detail that a developer implementing this protocol would not need to make any design decisions of their own.

**Shallow output (unacceptable):**
```
Error Handling:
- Recoverable errors: retry automatically
- Blocking errors: ask the user
- Use clear error messages
```

**Deep output (required standard):**
```
Error & Recovery Choreography
═════════════════════════════

Severity Levels
───────────────

  Level          │ Agent Response              │ Human Visibility
  ───────────────┼─────────────────────────────┼──────────────────────────
  recoverable    │ Self-repair: retry with      │ Silent unless retry fails
                 │ backoff (1s, 2s, 4s, max 3). │ 3x. Then escalate to
                 │ Log attempt to cache.        │ blocking.
  blocking       │ Halt immediately. Do not     │ Full diagnostic:
                 │ attempt workaround.          │ what → why → next step.
  inconsistent   │ Run reconciliation:          │ Report divergence and
                 │ filesystem wins over state   │ resolution taken. Ask
                 │ file. Update state to match. │ to confirm if destructive.
  violation      │ Hard stop. No override.      │ "Contract violation:
                 │ No workaround. Log and halt. │ [contract] requires [X],
                 │                              │ found [Y]. Human-led
                 │                              │ design revision required."

  Escalation Ladder
  ─────────────────
  1. Self-repair (recoverable only, max 3 attempts)
  2. Diagnostic halt — format: "Blocked: {what}. Cause: {why}. 
     Action: {what the human should do}."
  3. If blocked 2x in same phase → suggest the user open a new chat
     with fresh context, referencing the cache state.

  Halt Message Template
  ─────────────────────
  ⚠ Blocked: {description of what failed}
    Cause: {why it matters / what triggered it}
    State: {current phase, last successful step}
    Action: {specific next step for the human}
```

The shallow version gives a developer three bullets. The deep version gives them a complete error system with severity classifications, escalation rules, reconciliation algorithms, and message templates. **Every section of the protocol design system must hit this depth.**

The same standard applies across the entire specification:
- **State architecture**: Not just "use JSON" — exact schema with required fields, valid values, type constraints, transition rules, cold-start resolution algorithm, and reconciliation rules when filesystem and state disagree.
- **Context hierarchy**: Not just "load context in layers" — exact files per layer, load order, context budget rules (max file reads, max tokens), and cache invalidation triggers.
- **Document architecture**: Not just "use frontmatter" — required sections, heading hierarchy, metadata schema, cross-reference format, inverted pyramid rule, and machine-parsability constraints.
- **Interaction semantics**: Not just "use status markers" — full status vocabulary table with symbols, exact meanings, and usage rules. Log level definitions. Colour semantics if terminal output is involved. Progress communication rules.
- **Tone and posture specification**: Not just "be collaborative" — concrete persona brief, prohibited phrase list with required replacements, propose-vs-prompt ratio with triggers, and microcopy templates for confirmations, transitions, errors, and status.
- **Skill and tool anatomy**: Not just "skills have phases" — standard skill interface, pre-flight checklist, action contract (idempotency, atomicity, rollback), handoff protocol, and post-action validation rules.
- **Naming and taxonomy**: Not just "use kebab-case" — command naming convention, artifact naming convention, vocabulary boundary definitions with precise term meanings, and the naming self-test.
- **Versioning and evolution**: Breaking change protocol, backward compatibility guarantees, and changelog format.

#### UX Design Guide Target Structure

**Part 1 — Constraints**: Context-loading budgets, verification requirements, authority boundaries, error resilience policies, interoperability guarantees.

**Part 2 — Workspace Topology & Interaction Principles**: Filesystem architecture, state management, discovery surfaces, context injection strategy, communication posture.

**Part 3 — Protocol Design System** (each at the depth standard above):
State architecture · Context hierarchy · Document architecture · Interaction semantics · Tone & posture specification · Skill & tool anatomy · Error & recovery choreography · Naming & taxonomy · Versioning & evolution

---

Before presenting the draft, run this self-check:
1. **Does every section contain committed, implementable specifications?** If a section reads like a brief ("use a collaborative tone with clear errors"), the translation is incomplete.
2. **Does every specification include concrete schemas, templates, or tables?** Prose descriptions without structured examples are insufficient.
3. **Would a developer implementing this protocol need to make any design decisions?** If yes, the spec is underspecified.

### 5b: Review (Collaborative)

Present the complete draft to the user. This is the first time the user sees technical specifics — actual state schemas, error format definitions, naming convention tables, phase transition rules.

The user's role shifts from providing direction to reacting to choices. Walk through the spec together. Do not rush this — the user has earned a say in the details by providing clear direction earlier. If they push back on a choice, propose alternatives that still honour the original intent. If they approve, move on.

Refine iteratively until the user is satisfied with the full specification.

Once approved, return to `instructions.md` and execute Stage 6: Commit.
