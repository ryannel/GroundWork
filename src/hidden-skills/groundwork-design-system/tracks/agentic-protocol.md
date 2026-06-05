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

## Cross-Phase Signal Capture

Protocol design conversations routinely surface signals that belong to a different phase — a context-budget constraint with infrastructure implications, a state-management decision that shapes architecture, a sequencing instinct about which capabilities ship first. As these signals arise during any phase, append them as bullets under the matching section header in `.groundwork/cache/discovery-notes.md` — `## Architecture` for infrastructure or technology opinions, `## Design Details` for schema or contract implications, `## Bets` for feature sequencing, `## Product Brief` for vision-level refinements — then return to the current topic. Capturing them now means the downstream phase finds them instead of asking the user to repeat themselves.

---

## Phase 1: Non-Functional Requirements (NFR)

NFRs define the engineering envelope the protocol design system must operate within. Context-loading budgets, verification requirements, authority boundaries, and error resilience policies all constrain protocol design downstream — a protocol that specifies rich diagnostic output but must work within a 4K token context budget is internally contradictory.

Read `docs/product-brief.md`. Using the product brief and the track defaults above as your starting position, draft a complete NFR proposal immediately — do not open with questions.

Cover all relevant dimensions: agentic efficiency (context budgets, token consciousness, cold-start file-read ceiling), context persistence and resumability, authority model (human-led vs agent-led boundaries), verification and governance, error resilience, interoperability across agent runtimes, auditability and traceability, and security and trust boundaries. Ground each decision in the product brief and apply the track defaults where applicable: zero-boilerplate context loading (under 3 file reads from cold), declarative state in flat machine-readable files, agent-agnostic interfaces, filesystem-as-memory, deterministic phase transitions, version-controlled artifacts. Skip dimensions that are clearly irrelevant to the protocol.

Present the proposed NFRs in full and invite the user to confirm, challenge, or adjust specific items. The proposal is the starting position — accept what the user confirms, revise what they challenge. Once approved, write the confirmed NFRs to the Phase 1 section of `.groundwork/cache/design-system-cache.md` and set its status to `done`. Proceed to Phase 2.

---

## Phase 2: Research

The inspiration library grounds the design conversation in concrete, existing systems. Abstract discussions ("make it precise") produce vague specs. Discussions anchored in specific examples ("Terraform's plan-apply-verify loop forces explicit human approval before any state mutation") produce actionable protocol decisions.

Drawing on the product context and agreed NFRs from Phase 1, identify the core protocol challenges this product faces and find leading systems that solve similar problems exceptionally well. Describe the **specific pattern or mechanism** worth borrowing — not just the system's reputation. Sources span methodologies, specification systems, developer tools, formal methods, and protocol designs.

Present the Inspiration Library and ask for the user's reaction. Do not proceed until they have confirmed the direction.

Once approved, write to the Phase 2 section of `.groundwork/cache/design-system-cache.md` and set its status to `done`. Proceed to Phase 3.

---

## Phase 3: Workspace Topology

The workspace topology is the structural container everything else lives inside — the filesystem architecture, state management, and discovery surfaces that agents and humans interact with. Getting this wrong means reworking every skill. Getting it right means every subsequent protocol decision has a home.

Define the structural skeleton using patterns from the Phase 2 inspiration library. The agent should explore and propose decisions across: filesystem architecture (where config, state, cache, and deliverables live), state management (format, schema, valid transitions), skill and tool discovery (manifests, directory conventions, routing tables), context injection strategy (global vs phase vs task layers), empty and boot states (first run, interrupted, stale), and progressive disclosure (how complexity scales as the project matures).

Guide the conversation with leading-edge protocol patterns. Propose the topology based on the inspiration library, then ask the user to react and refine.

When a topology decision implies a backend or infrastructure capability — state-store service, registry or routing backend, agent runtime, distribution channel, identity provider — append the implication as a bullet under `## Architecture` in `.groundwork/cache/discovery-notes.md` before continuing the conversation. The architecture phase finds these notes and skips re-deriving what was already decided here.

Once approved, write to the Phase 3 section of `.groundwork/cache/design-system-cache.md` and set its status to `done`. Proceed to Phase 4.

---

## Phase 4: Interaction Language

This phase captures the user's instincts about how the protocol communicates — the raw material the agent will translate into concrete protocol specifications in Phase 5. The user should never need to think about specific formatting rules or state schemas.

Cover interaction language in three focused clusters — grouping related decisions so the user can react to a coherent stance rather than isolated individual choices. For each cluster, open with a cohesive proposal that reflects what the product brief and inspiration library suggest, then invite the user to react and redirect.

**Cluster 1: Identity** — Tone and posture, microcopy and phrasing, naming and taxonomy. Propose the agent's voice as a unified stance: where it sits on the terse-to-pedagogical spectrum, how its smallest text units feel, and what vocabulary conventions govern commands, phases, and artifacts.

**Cluster 2: Feel** — Information density and the propose-vs-prompt ratio. Propose how much an agent communicates per turn, whether it leads conclusions-first or builds narrative, and where it defaults to proposals vs open questions.

**Cluster 3: Craft** — Status semantics, documentation hierarchy, and error communication. Propose how state is signalled, how protocol documents are structured for both humans and agents, and where errors land on the spectrum from silent recovery to loud halts.

After each cluster proposal, invite the user to react and refine before advancing. Mark each cluster as covered in `.groundwork/cache/design-system-cache.md` as you go. Skip a dimension only when it is clearly irrelevant to the product.

### Synthesis Gate

Before caching, distill the entire Phase 4 conversation into a structured direction and present it to the user for confirmation. Scattered conversation notes are not sufficient input for Phase 5.

The synthesis stays in the user's language. No state schemas, no format rules, no log level definitions. It captures the *decisions* the user made in terms they recognise:

- **Communication posture**: A short characterisation of the agent's personality.
- **Information density**: How much per turn.
- **Propose-vs-prompt ratio**: The default interaction mode.
- **Error philosophy**: How failures are communicated.
- **Status language**: How the protocol signals state.
- **Naming instinct**: The vocabulary style.
- **Microcopy tone**: How the smallest units of text feel.

Present as a clear summary the user can scan and approve in one read. Confirm before proceeding.

Once confirmed, write the synthesis to the Phase 4 section of `.groundwork/cache/design-system-cache.md` and set its status to `done`. Proceed to Phase 5.

---

## Phase 5: Expert Translation & Review

### 5a: Translation (Agent-Driven, Autonomous)

The user provided taste, instinct, and direction across Phases 1–4. The agent now translates that into a rigorous protocol design specification — autonomously.

**Output location**: `.groundwork/cache/design-system-draft/` — a directory of per-section files. Each file stays bounded in size, so any later change (review revise, 5b re-flow) touches only the affected files instead of regenerating the whole spec in a single turn. Regenerating the whole spec at once exhausts the per-response output token budget on rich specs; the per-section layout makes that failure structurally impossible. Writing to `docs/design-system.md` is prohibited until Phase 6 (Commit) — on initial generation that file does not exist; do not attempt to read it.

**Write each section as a separate file.** Use one `write_file` call per section (the tool creates parent directories automatically):

| File | Content |
|---|---|
| `00-header.md` | The `## Summary for Downstream` section first (Key Decisions, Binding Constraints, Deferred Questions, Out of Scope per Protocol 5), then the document title and the "implementation-ready specification" intro paragraph |
| `01-constraints.md` | Part 1 — context-loading budgets, verification requirements, authority boundaries, error resilience policies, interoperability guarantees |
| `02-workspace-topology.md` | Part 2 — filesystem architecture, state management, discovery surfaces, context injection strategy, communication posture |
| `03-foundation.md` | Part 3 Cluster 1 — state architecture, context hierarchy, document architecture |
| `04-interaction.md` | Part 3 Cluster 2 — interaction semantics, tone & posture specification |
| `05-surface.md` | Part 3 Cluster 3 — skill & tool anatomy, error & recovery choreography, naming & taxonomy, versioning & evolution |

The numeric prefixes determine concatenation order at commit. Each file is a self-contained markdown section — start its top-level heading at H1 (`# Part 1 — Constraints`) or H2 as appropriate so the files compose cleanly when concatenated.

Compile each section using the approved outputs stored in `.groundwork/cache/design-system-cache.md`. The document combines NFRs from Phase 1 with a comprehensive protocol design system that the agent derives from the interaction language direction captured in Phase 4.

Apply the `groundwork-writer` skill to ensure the tone is declarative, assertive, and free of hedging. Structure it to read like a rigorous protocol specification that simultaneously serves as instruction material for any agent runtime.

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

The same standard applies across the entire specification:
- **State architecture**: Not just "use JSON" — exact schema with required fields, valid values, type constraints, transition rules, cold-start resolution algorithm, and reconciliation rules when filesystem and state disagree.
- **Context hierarchy**: Not just "load context in layers" — exact files per layer, load order, context budget rules (max file reads, max tokens), and cache invalidation triggers.
- **Document architecture**: Not just "use frontmatter" — required sections, heading hierarchy, metadata schema, cross-reference format, inverted pyramid rule, and machine-parsability constraints.
- **Interaction semantics**: Not just "use status markers" — full status vocabulary table with symbols, exact meanings, and usage rules. Log level definitions. Colour semantics if terminal output is involved. Progress communication rules.
- **Tone and posture specification**: Not just "be collaborative" — concrete persona brief, prohibited phrase list with required replacements, propose-vs-prompt ratio with triggers, and microcopy templates for confirmations, transitions, errors, and status.
- **Skill and tool anatomy**: Not just "skills have phases" — standard skill interface, pre-flight checklist, action contract (idempotency, atomicity, rollback), handoff protocol, and post-action validation rules.
- **Naming and taxonomy**: Not just "use kebab-case" — command naming convention, artifact naming convention, vocabulary boundary definitions with precise term meanings, and the naming self-test.
- **Versioning and evolution**: Breaking change protocol, backward compatibility guarantees, and changelog format.

#### Design System Target Structure

**Part 1 — Constraints**: Context-loading budgets, verification requirements, authority boundaries, error resilience policies, interoperability guarantees.

**Part 2 — Workspace Topology & Interaction Principles**: Filesystem architecture, state management, discovery surfaces, context injection strategy, communication posture.

**Part 3 — Protocol Design System** (each at the depth standard above):
State architecture · Context hierarchy · Document architecture · Interaction semantics · Tone & posture specification · Skill & tool anatomy · Error & recovery choreography · Naming & taxonomy · Versioning & evolution

---

Before presenting the draft, run this self-check:
1. **Does every section contain committed, implementable specifications?** If a section reads like a brief ("use a collaborative tone with clear errors"), the translation is incomplete.
2. **Does every specification include concrete schemas, templates, or tables?** Prose descriptions without structured examples are insufficient.
3. **Would a developer implementing this protocol need to make any design decisions?** If yes, the spec is underspecified.

### Independent Review (Pre-Walkthrough)

The user is about to see this draft in Phase 5b. Before they do, the draft passes through an independent review — `groundwork-review` checks the draft for silent invention, dropped commitments from Phase 4, and contradictions against the upstream Product Brief that the user is unlikely to catch during a walkthrough of state schemas and naming taxonomy tables. The protocol design system constrains every downstream skill and tool; catching these failures here is cheaper than catching them after `docs/design-system.md` becomes the source of truth.

1. **Announce** the shift — the agent is moving from translation into an independent review before presenting to the user.
2. **Assemble the draft for review.** Run `run_command("cat .groundwork/cache/design-system-draft/*.md > .groundwork/cache/design-system-draft.md")` to concatenate the section files into a single document. This is a shell operation, not a model emission — it does not consume output tokens regardless of spec size.
3. **Invoke the review subagent** with `document_path: .groundwork/cache/design-system-draft.md` and `document_type: design-system`. The subagent runs in an isolated context — via the `Task` tool in Claude Code or the `invoke_review` tool in the eval harness — and returns only `VERDICT: PRESENT | REVISE` and a findings list. The gate is fail-closed (Protocol 8): proceed only on a parseable `VERDICT: PRESENT`; if the reviewer errors, returns `REVIEW_UNAVAILABLE`, or returns no parseable verdict, the review has not run — do not present the draft as reviewed, report the failure, and pause.
4. **Revise loop.** If the verdict is **REVISE**, apply every 🔴 Critical finding directly to the affected section file(s) under `.groundwork/cache/design-system-draft/` — rewrite only the files the finding implicates. After revisions, re-assemble with `cat` and run the review again. Repeat until the verdict is **PRESENT**. After 3 REVISE verdicts, apply the revise cap defined in Protocol 8.
5. **Clean up the assembled file.** Once the verdict is PRESENT, run `run_command("rm .groundwork/cache/design-system-draft.md")`. The section files in the draft directory remain the source of truth for Phase 5b and Phase 6.
6. **Carry advisory findings forward.** When the verdict is PRESENT, hold any 🟡 Advisory findings — they surface to the user during or after Phase 5b so the user can decide whether to act on them.

Once the review verdict is PRESENT, proceed to Phase 5b.

### 5b: Guided Review (Collaborative)

The draft is a proposal. Present it to the user as one — explicitly frame it as what the agent built from their direction.

**Do not ask the user to approve the full spec.** Do not present a summary and ask "does this look right?" Instead, walk through the spec in three focused clusters, each earning approval before advancing.

#### Cluster Walkthrough

The cluster names here are deliberately distinct from the Phase 4 language clusters (Identity / Feel / Craft) — Phase 4 grouped *aesthetic decisions* the user owns; Phase 5b walks through *implementation specifics* the agent owns. Distinct names keep both schemes legible when both phases are referenced in the same conversation.

**Cluster 1: Foundation** — State architecture, context hierarchy, and document architecture.

These are the base primitives every later decision composes from. Present the state schema with required fields and transition rules, the context-injection layers with file ordering and budgets, and the document anatomy with frontmatter and heading hierarchy side by side. Teach the reasoning: why flat machine-readable state, why this load order, how the inverted-pyramid rule keeps documents agent-parseable. Offer alternatives that honour the same direction. Wait for the user's reaction before advancing.

**Cluster 2: Interaction** — Interaction semantics and the tone & posture specification.

These define how the agent behaves turn to turn. Present the status vocabulary table, the persona brief with prohibited phrases and required replacements, and the propose-vs-prompt trigger rules as a connected system. Teach the trade-offs: terse status markers feel efficient but reduce orientation; pedagogical microcopy builds trust but adds tokens. Justify the specific choices against the Phase 4 direction. Offer alternatives. Wait for the user's reaction.

**Cluster 3: Surface** — Everything else: skill and tool anatomy, error and recovery choreography, naming and taxonomy specifications, versioning and evolution.

These are engineering craft — decisions the agent should own. Present the full set as a summary table: what was decided, in one line per topic. Call out any judgment calls the user might have an opinion on. Ask if anything feels wrong. Do not walk through each one individually unless the user flags a concern.

#### Re-flow Protocol

When the user requests a change in any cluster:

1. Acknowledge the change and confirm understanding.
2. Assess downstream impact — state explicitly which section files are affected, including any downstream files whose rules reference the change.
3. **Rewrite the affected section files.** Each section lives in its own file under `.groundwork/cache/design-system-draft/`. Use `write_file` to replace the implicated files in turn — for example, a change to the state schema rewrites `03-foundation.md`, and may ripple into `05-surface.md` if skill anatomy or error choreography references the state shape. Each `write_file` is bounded by the size of one section, never the whole spec.
4. Summarise the re-flow: list every section file that changed and what specifically shifted.
5. If a previously-approved cluster was affected substantively, re-present it before continuing.

A protocol design system is a web of interconnected decisions. Changing the state schema affects skill anatomy, which affects error choreography. Propagate the change into every section file it implicates — file-by-file, never as a single full-spec rewrite. Isolated edits that ignore downstream effects create internal contradictions that surface during implementation; the propagation is mandatory, the file-at-a-time mechanic is what makes it safe.

#### Walkthrough Progress

Track which clusters have been reviewed in `.groundwork/cache/design-system-cache.md` under the Phase 5 checklist. Mark each cluster as complete when the user approves it.

#### Completion Gate

The walkthrough is complete when all three clusters have been presented and approved. Only then does Phase 6 (Commit) execute.

Once approved, proceed to Phase 6: Commit.

---

## Phase 6: Commit

Execute **only** after Phase 5b review is complete and the user has explicitly approved the specification.

Follow the Phase Lifecycle commit protocol from the Operating Contract:

1. **Verify the summary header.** Confirm the draft directory's `00-header.md` (or first section file) contains a `## Summary for Downstream` section populated per Protocol 5 of the operating contract — Key Decisions (state schema shape, context-injection order, document architecture), Binding Constraints (token budgets, naming conventions, agent-parseable structure), Deferred Questions, Out of Scope. If missing, apply `groundwork-writer` to add it before assembling.

2. **Assemble the final spec.** Concatenate the section files into the canonical location: `run_command("cat .groundwork/cache/design-system-draft/*.md > docs/design-system.md")`. The numeric prefixes guarantee the correct section order. This is a shell operation, not a model emission — it does not consume output tokens regardless of spec size.

3. **Write the hand-off file.** Copy `.agents/groundwork/skills/templates/handoff.md` to `.groundwork/cache/handoff/design-system.md` and fill in only the sections that have content: rejected protocol-anatomy choices, deferred decisions (versioning policy, multi-skill orchestration), user instincts about agent posture or naming not yet committed, and any other context the architecture phase needs. Omit empty sections.

4. **Clean up caches.** Remove the draft directory, the design-system cache, and the consumed previous hand-off: `run_command("rm -rf .groundwork/cache/design-system-draft .groundwork/cache/design-system-cache.md .groundwork/cache/handoff/product-brief.md")`. Cache Isolation (Protocol 7) requires the previous hand-off to be deleted once consumed.

5. Apply the Living Documents protocol — scan the conversation for insights that refine any existing `docs/` artifact (e.g. `docs/product-brief.md`). Apply surgical updates and refresh affected summary headers. Report what changed.

6. Update discovery notes — scan for out-of-phase signals not captured in real time. Remove `## Design System` entries incorporated into `docs/design-system.md` or the hand-off file.

7. Confirm that the phase is complete.

8. Recommend a fresh context for the next phase — a clean context gives the next skill full working memory.

9. Immediately load and execute the `groundwork-orchestrator` skill to show the user what's next. Do not ask the user to invoke it — hand off automatically.
