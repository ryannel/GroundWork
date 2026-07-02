# Agentic Protocol Track

This track applies to products whose primary interface is an agent-to-human or agent-to-agent protocol: skill frameworks, MCP servers, developer methodology tools, agent orchestrators, and any product where the "user interface" is a structured conversation between humans and AI agents.

The shared foundation flow (`tracks/_foundation.md`) owns the session spine: it runs the brand-level Phases 1, 2, and 4 once for the whole product, drawing this track's contributions from the Foundation Contributions section below, and it runs this track's Phase 3 and Phase 5 at the right points. Its Cross-Phase Signal Capture rule stays in force throughout every phase of this track.

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

## Foundation Contributions

The shared foundation flow pulls these sections into its brand-level phases.

### Envelope (foundation Phase 1)

Cover all relevant dimensions of the protocol envelope: agentic efficiency (context budgets, token consciousness, cold-start file-read ceiling), context persistence and resumability, authority model (human-led vs agent-led boundaries), verification and governance, error resilience, interoperability across agent runtimes, auditability and traceability, and security and trust boundaries. Ground each decision in the product brief and apply the track defaults where applicable: zero-boilerplate context loading (under 3 file reads from cold), declarative state in flat machine-readable files, agent-agnostic interfaces, filesystem-as-memory, deterministic phase transitions, version-controlled artifacts.

### Research notes (foundation Phase 2)

Sources for this type span methodologies, specification systems, developer tools, formal methods, and protocol designs — describe the specific **mechanism** worth borrowing, not the system's reputation.

### Type language (foundation Phase 4)

Fold these dimensions into the foundation's language clusters. The user should never need to think about specific formatting rules or state schemas:

- **Cluster 1: Identity** — Tone and posture, microcopy and phrasing, naming and taxonomy. Propose the agent's voice as a unified stance: where it sits on the terse-to-pedagogical spectrum, how its smallest text units feel, and what vocabulary conventions govern commands, phases, and artifacts.
- **Cluster 2: Feel** — Information density and the propose-vs-prompt ratio. Propose how much an agent communicates per turn, whether it leads conclusions-first or builds narrative, and where it defaults to proposals vs open questions.
- **Cluster 3: Craft** — Status semantics, documentation hierarchy, and error communication. Propose how state is signalled, how protocol documents are structured for both humans and agents, and where errors land on the spectrum from silent recovery to loud halts.

This type's Synthesis Gate expression fields:

- **Propose-vs-prompt ratio**: The default interaction mode.
- **Status language**: How the protocol signals state.
- **Naming instinct**: The vocabulary style.
- **Microcopy tone**: How the smallest units of text feel.

---

## Phase 3: Workspace Topology

*Runs inside the foundation flow's Phase 3 step — once for this type, per the shared skeleton it defines.*

The workspace topology is the structural container everything else lives inside — the filesystem architecture, state management, and discovery surfaces that agents and humans interact with.

Decision dimensions: filesystem architecture (where config, state, cache, and deliverables live), state management (format, schema, valid transitions), skill and tool discovery (manifests, directory conventions, routing tables), context injection strategy (global vs phase vs task layers), empty and boot states (first run, interrupted, stale), and progressive disclosure (how complexity scales as the project matures).

Capture examples for the Architecture discovery-notes bullet: state-store service, registry or routing backend, agent runtime, distribution channel, identity provider.

---

## Phase 5: Expert Translation & Review

*The foundation flow runs this phase once per active type, after the brand language direction (foundation Phase 4) is confirmed. The agent translates that direction into concrete protocol specifications — the user never sees a raw schema until the walkthrough.*

### 5a: Translation (Agent-Driven, Autonomous)

The agent translates the approved direction into a rigorous protocol design specification. This track's file table (below) feeds the foundation flow's 5a mechanics — output location, one `write_file` per section, the self-check before presenting.

**This track's section files:**

| File | Content |
|---|---|
| `00-header.md` | The document title and the "implementation-ready specification" intro paragraph. No summary section — the Downstream Context (Protocol 5) is written separately to `.groundwork/context/design-system.md` at commit, not concatenated into the spec |
| `01-constraints.md` | Part 1 — context-loading budgets, verification requirements, authority boundaries, error resilience policies, interoperability guarantees |
| `02-workspace-topology.md` | Part 2 — filesystem architecture, state management, discovery surfaces, context injection strategy, communication posture |
| `03-foundation.md` | Part 3 Cluster 1 — state architecture, context hierarchy, document architecture |
| `04-interaction.md` | Part 3 Cluster 2 — interaction semantics, tone & posture specification |
| `05-surface.md` | Part 3 Cluster 3 — skill & tool anatomy, error & recovery choreography, naming & taxonomy, versioning & evolution |

Each file is a self-contained markdown section — start its top-level heading at H1 (`# Part 1 — Constraints`) or H2 as appropriate so the files compose cleanly when concatenated. The foundation flow's Draft Layout rule governs how this table adapts when several types are active.

#### The Translation Mandate

The user said "collaborative peer" — the agent specifies the exact persona brief, prohibited hedging phrases, and propose-vs-prompt triggers. The user said "conclusions first" — the agent defines the inverted pyramid rule with concrete structural templates. The user said "verb-noun commands" — the agent produces a complete naming convention with casing rules, artifact patterns, and vocabulary definitions. Every high-level preference from Phase 4 must be resolved into concrete, enforceable specifications. If the cached direction is ambiguous, the agent makes the design call — that is the job.

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

#### Design System Target Structure

The spec must cover all of the following, each at the depth standard above. Missing sections are not acceptable.

**Part 1 — Constraints**: Context-loading budgets, verification requirements, authority boundaries, error resilience policies, interoperability guarantees.

**Part 2 — Workspace Topology & Interaction Principles**: Filesystem architecture, state management, discovery surfaces, context injection strategy, communication posture.

**Part 3 — Protocol Design System**:
- **State architecture** — not just "use JSON": exact schema with required fields, valid values, type constraints, transition rules, cold-start resolution algorithm, and reconciliation rules when filesystem and state disagree.
- **Context hierarchy** — not just "load context in layers": exact files per layer, load order, context budget rules (max file reads, max tokens), and cache invalidation triggers.
- **Document architecture** — not just "use frontmatter": required sections, heading hierarchy, metadata schema, cross-reference format, inverted pyramid rule, and machine-parsability constraints.
- **Interaction semantics** — not just "use status markers": full status vocabulary table with symbols, exact meanings, and usage rules; log level definitions; colour semantics if terminal output is involved; progress communication rules.
- **Tone & posture specification** — not just "be collaborative": concrete persona brief, prohibited phrase list with required replacements, propose-vs-prompt ratio with triggers, and microcopy templates for confirmations, transitions, errors, and status.
- **Skill & tool anatomy** — not just "skills have phases": standard skill interface, pre-flight checklist, action contract (idempotency, atomicity, rollback), handoff protocol, and post-action validation rules.
- **Error & recovery choreography** — the worked example above sets the depth bar.
- **Naming & taxonomy** — not just "use kebab-case": command naming convention, artifact naming convention, vocabulary boundary definitions with precise term meanings, and the naming self-test.
- **Versioning & evolution** — breaking change protocol, backward compatibility guarantees, and changelog format.

### Independent Review (Pre-Walkthrough)

The user is about to see this draft in Phase 5b. Before they do, the draft passes through an independent review — `groundwork-review` checks it for silent invention, dropped Phase 4 commitments, and contradictions against the upstream Product Brief that the user is unlikely to catch during a walkthrough of state schemas and naming taxonomy tables. The protocol design system constrains every downstream skill and tool; catching these failures here is cheaper than catching them after `docs/design-system.md` becomes the source of truth.

Assemble the draft — a shell operation, not a model emission, so it costs no output tokens regardless of spec size: `run_command("cat .groundwork/cache/design-system-draft/*.md > .groundwork/cache/design-system-draft.md")`. Then dispatch `groundwork-review` per Protocol 9 with `document_path: .groundwork/cache/design-system-draft.md` and `document_type: design-system`. The gate is fail-closed and the revise cap is Protocol 8's, not restated here: on REVISE, apply every 🔴 Critical finding directly to the affected section file(s) under `.groundwork/cache/design-system-draft/` only, re-assemble with the same `cat` command, and re-dispatch until PRESENT. Once PRESENT, remove the assembled file (`rm .groundwork/cache/design-system-draft.md`; the section files remain the source of truth for Phase 5b and Phase 6) and carry any 🟡 Advisory findings forward into Phase 5b.

Proceed to Phase 5b only once the verdict is PRESENT.

### 5b: Guided Review (Collaborative)

#### Cluster Walkthrough

**Cluster 1: Foundation** — State architecture, context hierarchy, and document architecture.

These are the base primitives every later decision composes from. Present the state schema with required fields and transition rules, the context-injection layers with file ordering and budgets, and the document anatomy with frontmatter and heading hierarchy side by side. Teach the reasoning: why flat machine-readable state, why this load order, how the inverted-pyramid rule keeps documents agent-parseable. Offer alternatives that honour the same direction. Wait for the user's reaction before advancing.

**Cluster 2: Interaction** — Interaction semantics and the tone & posture specification.

These define how the agent behaves turn to turn. Present the status vocabulary table, the persona brief with prohibited phrases and required replacements, and the propose-vs-prompt trigger rules as a connected system. Teach the trade-offs: terse status markers feel efficient but reduce orientation; pedagogical microcopy builds trust but adds tokens. Justify the specific choices against the Phase 4 direction. Offer alternatives. Wait for the user's reaction.

**Cluster 3: Surface** — Everything else: skill and tool anatomy, error and recovery choreography, naming and taxonomy specifications, versioning and evolution.

These are engineering craft — decisions the agent should own. Present the full set as a summary table: what was decided, in one line per topic. Call out any judgment calls the user might have an opinion on. Ask if anything feels wrong. Do not walk through each one individually unless the user flags a concern.

The Re-flow Protocol, Walkthrough Progress tracking, and Completion Gate that govern this walkthrough are the foundation flow's Phase 5 machinery — this track's cluster content is what they operate on.

---

## Commit Contributions

Phase 6 runs once for the whole design system, in the foundation flow. This track contributes:

- **Document section:** the `# Agentic Protocol` section files assembled into `docs/design-system.md`.
- **Brand tokens:** no Tier 2 block — a protocol has no terminal or visual treatment to project. When this is the only active type, the file is Tier 1: `identity` essentials only (`appName`, a short `wordmark` glyph, `primary` and `accent` colours, and a `voice` descriptor), projected mechanically from the product brief and any palette decisions, so scaffolding can brand the project's `./dev` CLI even though this product is a protocol, not a CLI.
- **Summary key decisions:** state schema shape, context-injection order, document architecture. Binding constraints include token budgets, naming conventions, agent-parseable structure.
- **Hand-off content:** rejected protocol-anatomy choices, deferred decisions (versioning policy, multi-skill orchestration), user instincts about agent posture or naming not yet committed.

## Verification Gate

The visual verification loop is medium-general: observe the running artifact in its medium, against intent and reference. For an `agentic-protocol` surface the artifact is the **response payload**, and the same three tiers apply — graphical screenshots are one instance of a wider pattern.

- **Capture:** the protocol response to a representative request, captured by the surface's interface tests.
- **Tier 1 — does it run:** the request succeeds and the response is well-formed against the contract — deterministic, asserted on structure and status.
- **Tier 2 — does it read coherently:** the delivery agent reads the captured payload and judges it against this track's response anatomy and naming conventions.
- **Tier 3 — is it excellent:** response shape and ergonomics graded against the protocol spec and the reference protocols this track names — token economy, parseability, error vocabulary.

This is the lightest-touch instance and its build is deferred; the framing here keeps the gate concept covering all three interface types so no track is silently graphical-only.
