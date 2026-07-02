---
name: skill-writer
description: >
  Governs how to write GroundWork skill instruction files, SKILL.md frontmatter,
  contributor guides, and methodology docs inside this source repository. Load
  before writing or editing any SKILL.md, instructions.md, brief, or reference
  file here. This is a dev-time skill — it does NOT ship with GroundWork.
---

# GroundWork Skill Writer

This skill governs writing inside the GroundWork source repository — skill files, methodology documentation, contributor guides, and architecture records. The audience is agents and contributors working on GroundWork itself, not users of GroundWork-powered projects.

Every file in this repo is either executed by an agent or read by a contributor. Both readers need the same thing: precise, unambiguous text that carries its full meaning on the first read.

---

## Three kinds of instruction file

Every instruction file in this repo speaks to one of three readers, and the register that makes one effective ruins another:

- **Facilitation skills** run a conversation with a human (product-brief, design-system, bet discovery). They need the mental model, the pacing, the expert peer stance — an agent mid-conversation makes judgment calls no checklist anticipates.
- **Dispatched briefs and execution routers** run in an isolated context with no user present (`briefs/*.md`, engineer skills). They need a tight contract: inputs, gates, the report shape. Imperative constraints are correct here — there is no conversation to earn a conclusion through, and a worker that "adapts" a gate has broken it. Explain a gate's reason in one clause only when the reason changes behaviour; otherwise state the gate.
- **Reference files** (`references/`, `templates/`, contract tables) are read mid-task for one fact — front-load the identifier, keep entries parallel, never narrate. They hold decision-time distillations — pinned conventions, calibrated defaults, corrected staleness — never a framework manual; a family sharing a reference file's shape should copy the newest sibling, not re-derive one.

The conversational principles below (pacing, earned conclusions, the peer stance, artifacts-as-proposals) bind facilitation skills. The precision principles (say it once, causal chains, identifier discipline) bind everything.

---

## Writing Principles

### Say it once, clearly

State the point. Do not restate it with an example immediately after. Do not add a closing sentence that summarises what the paragraph just said. If the writing is precise, it does not need reinforcement.

The burden shifts to the words themselves. Every sentence must be unambiguous on first read — not because a follow-up sentence will clarify it, but because there is no follow-up sentence.

### One idea per unit

A sentence, bullet, or table row carries one idea. The most common break is the compression em-dash — stapling three or four ideas together because the dash makes it feel like one thought. A reader who must decompress a sentence before understanding it has been handed the writer's job.

- ❌ "SQLite stores the catalog and the index — the domain is relational with complex queries, and SQLite is embeddable and extension-loadable, so no separate process."
- ✅ "SQLite stores the catalog and the search index. The domain is relational with complex queries. SQLite suits it: embeddable, extension-loadable, no separate process."

Shared with `groundwork-writer` (*Density — one idea per unit*), which covers the bullet- and table-shaped variants too; a change to either copy applies to both.

### Causal chains must be explicit

When something matters because of a consequence, embed the consequence in the statement. Do not write two sentences where the first states a rule and the second explains why.

- ❌ "Constraints come first. This is because they eliminate options before design begins."
- ✅ "Constraints come first because they eliminate options before design begins."

### Active voice, actor first

Identify who does what to what — in that order. Passive constructions bury the actor and weaken the instruction.

- ✅ *The agent reads the Product Brief before starting the conversation.*
- ❌ *The Product Brief is read before the conversation starts.*

### Inverted pyramid

Answer first. Detail below. Background last. A reader who stops after the first sentence should have the essential information.

### No hedging

Drop phrases that introduce uncertainty or soften a claim: "should work", "might want to", "typically", "in most cases", "please note", "it is worth considering." State the claim or remove it.

### Lead with what you believe, not what you reject

State the position and why it holds. Do not establish it by contrasting against what others do or what you do not do — the comparison is rhetorical scaffolding the reader does not need to follow the claim, and if the position only makes sense as a rejection of an alternative, the position is not yet articulated.

- ❌ "Traditional CRUD APIs treat each endpoint as a standalone operation. Our system does not work that way — endpoints compose into transactions that share a commit boundary."
- ✅ "Endpoints compose into transactions that share a commit boundary."

An example that quotes live canon inherits canon's churn — when the methodology moves, the standard starts teaching the old world. Prefer examples from domains this repo does not govern, as above; an example that must quote canon is a reader of that canon and must update in the same change that moves it.

---

## The budget

### Every file has a budget set by when it loads

Words cost context, and the cost multiplies by load frequency: a registered skill's description is paid in **every** session; an always-loaded guide is paid in every session in its repo; a hidden skill's body is paid once per invocation; a brief once per dispatch; a reference file once per lookup. Spend accordingly — the always-on layer holds only what changes behaviour in most sessions, and everything else moves down a tier and gets a pointer. When a file grows, the first question is not "is this content good?" but "is this content at the right tier?"

Every file at every tier still needs an owner who notices when its content goes stale — load frequency does not keep a file honest by itself. A skill nobody rereads accretes exactly as fast as one loaded every session; it just takes longer to notice.

### Integrate, don't append

An uplift that appends a section, a bullet, or a parenthetical to an existing file has not been written yet — it has been queued. Find the section that already owns the concern and rewrite it so the new understanding replaces the old, in the old one's words where they still hold. A new heading is a claim that a new concern exists; most uplifts refine an existing one. After editing, reread the whole file once: if two passages now say adjacent things, merge them — the second reader cannot tell which one is current. Growth by appended overlays is how a corpus reaches ten times its useful size while every individual addition looked reasonable.

### A skill is done when cutting changes behaviour

The finish line is not coverage; it is that removing any sentence would change what an agent does. Test additions against that bar before landing them, and test the file against it whenever you touch it: a sentence that restates the model's default, narrates what an adjacent sentence already causes, or documents a rule a gate enforces mechanically (`./dev lint skills`, the sync-anchor check, the contracts suite) earns its cut. Some changes need no words at all — if the failure can be caught by a lint rule, a test, or a derived signal from git or state, build that instead and write one line pointing at it.

---

## Writing Skill Instruction Files

Skill files (`instructions.md`, `SKILL.md`) are executed by agents. The writing conventions for these files are different from general documentation.

### Write intent, not scripts

Never put quoted or italicised phrases in skill files that the agent is expected to say verbatim. Agents latch onto scripted phrases and repeat them in every session, killing natural conversation.

- ❌ `Ask the user: *"Would you like to resume from where we left off, or start fresh?"*`
- ✅ `Summarise progress and ask the user whether to resume or start fresh.`

The agent knows how to ask a question. Your job is to specify the intent, not the words.

### Explain why each phase or step exists

An agent that understands the purpose of a phase makes better judgment calls within it than one following a checklist. Explain what each phase is trying to establish and why that matters for what follows — not just what to do.

### Distinguish guidance from instruction

Guidance tells the agent what to think about. Instruction tells the agent what to do. Both are valid, but they serve different purposes. A phase description is guidance. "Copy the template to `docs/architecture.md`" is an instruction. Keep them separate and be explicit about which is which.

### Avoid enumerated checklists for open-ended thinking

A bulleted list of things to "consider" or "explore" constrains the agent's thinking to what you listed. For open-ended phases, describe the goal and the reasoning dimensions — do not enumerate every possible topic. The agent will surface what is relevant.

### Front-load the mental model

When a skill has a multi-phase workflow, open with the philosophical framing — what the workflow is trying to achieve, why it is structured this way, and what the agent's role is at each stage. An agent that internalises the shape of the process before reading the steps will make better judgment calls when the steps are ambiguous or when the user pushes the conversation in an unexpected direction.

This is the difference between a contractor who understands the building code and one who has memorised a checklist. The checklist-follower stops when the list ends; the code-understander adapts.

### Artifacts are proposals, not deliverables

**Facilitation skills.** When a skill produces something for user review — a spec, a plan, a document — the instructions must frame it as a proposal the agent walks through collaboratively, not a finished product the user approves or rejects wholesale. Dumping a complete artifact and asking "does this look right?" is the equivalent of handing someone a contract to sign. Walking through each section — teaching the domain, justifying choices, presenting alternatives — builds trust and produces better outcomes because the user becomes an informed collaborator.

If a skill produces an artifact, the instructions must define:
- How the agent presents it (as a draft, not a deliverable)
- The structure of the walkthrough (section by section, with defined steps per section)
- What happens when the user requests a change (re-flow for cohesion, not isolated edits)

### Explain reasoning over rigid constraints

**Facilitation skills.** Agents with strong theory of mind respond better to understanding *why* something matters than to rigid ALWAYS/NEVER directives. When you find yourself writing heavy-handed constraints, reframe them as reasoning the agent can internalise. A constraint explained is adopted; a constraint imposed is worked around.

- ❌ `ALWAYS regenerate the full spec when any section changes. NEVER make isolated edits.`
- ✅ `A design system is a web of interconnected decisions. Changing one value without propagating its effects creates internal contradictions that surface during implementation. Regenerate the full spec when sections change to maintain cohesion.`

The second version produces the same behaviour but also equips the agent to handle edge cases the instruction writer did not anticipate.

### Pace for depth, not coverage

**Facilitation skills.** Skills that touch design decisions — architecture, UX, product strategy — need pacing guidance that protects the user's cognitive load. An agent's default behaviour is to cover many topics shallowly in a single turn, producing superficial answers that collapse under implementation pressure.

Skill instructions should frame pacing around cognitive load and the complexity of the decision, not around rigid turn counts. Complex decisions with real trade-offs deserve focused, single-topic exploration. Simple or closely related questions can be grouped to maintain momentum. The agent is better positioned than the skill author to judge which questions are complex in context — trust it to adapt.

Depth must not sacrifice discovery breadth. A skill that paces well but exits discovery having surfaced only three capabilities has discovered poorly. Depth and coverage are both required.

### Earn conclusions through conversation

**Facilitation skills.** An agent that presents a conclusion without earning it through exploration kills the collaborative process. "Industry best practice is X" is not a design conversation — it's a lecture. The agent should surface the relevant factors, present the trade-space, explain why different approaches serve different goals, and let the user drive the decision.

Skill instructions should never frame the agent as a source of pre-determined answers. Frame it as a consultant who brings relevant knowledge and structured thinking to the user's problem. The user is the domain expert; the agent brings synthesis and rigour.

- ❌ `Present the modern best practice for service naming.`
- ✅ `Explore the naming trade-space with the user — what the service owns, how it relates to other services, what conventions the team already uses. Surface relevant approaches and their trade-offs. Let the user decide.`

### The expert peer stance

**Facilitation skills.** Every methodology skill positions the agent as a collaborative peer — not a submissive assistant, not a lecturing expert. The agent has opinions, brings domain knowledge, and pushes back when something doesn't hold up. But it earns agreement through explanation and exploration, never through assertion.

Skill instructions should establish this stance early (in the mental model framing) and reinforce it through the interaction pattern — the agent proposes, explains why, invites challenge, and adapts. It never says "you should" without explaining the reasoning that leads to that conclusion.

### Quality bars with concrete examples

Skills that produce substantial artifacts — design systems, architecture documents, product briefs — must show the agent what "deep enough" looks like. Agents consistently under-specify unless the skill demonstrates the expected depth with a side-by-side comparison of shallow vs. deep output.

Include a **Quality Standard** section near the output phase that shows:
1. A **shallow example** labelled as unacceptable, with exactly the kind of thin output agents tend to produce.
2. A **deep example** labelled as the required standard, showing the full richness expected — concrete values, design rationale, usage rules, and variant coverage.

This technique is more effective than prose instructions like "be thorough" or "go deep." The agent calibrates against the example, not the adjective. A three-line CSS shadow definition next to a twenty-line multi-layer shadow stack with theme variants and design rationale communicates the quality bar instantly.

Apply this to every section of the output, not just one showcase section. List the depth standard for each major area: "Colour architecture — not just token names; full values, semantic roles, and perceptual reasoning."

### Opinionated defaults need reasoning

When a skill has opinionated technical defaults — OKLCH over HEX, 8-point grids, specific easing curves, exit code conventions — each default must include brief reasoning. An agent that understands *why* OKLCH matters can explain the trade-off to a user who pushes back; an agent that only knows "use OKLCH" either asserts without justification or abandons the default at the first challenge.

Frame defaults as the agent's informed starting position, not rigid requirements. The reasoning should be one sentence — long enough to convey the principle, short enough that the defaults section remains scannable.

- ❌ `Use OKLCH for all colour definitions.`
- ✅ `Perceptually uniform colour spaces (OKLCH). HEX and RGB produce unpredictable perceived brightness shifts across hue ranges — a blue and a yellow at the same HEX lightness look wildly different. OKLCH solves this by design.`

### Structural consistency across sibling skills

When multiple skills share a lifecycle — commit sequences, init/resume protocols, cache management — they must follow the same structure and wording. A commit section that uses numbered steps in one skill and prose paragraphs in another creates drift that compounds silently. The next contributor copies whichever version they find first, and the inconsistency spreads.

Consistency is achieved by extraction, not synchronized copies. When the siblings already load a shared spine or contract file, move the shared lifecycle there once and have each sibling reference it — a single source cannot drift from itself. Synchronized copies are the fallback only when no shared file is co-loaded by every sibling.

When reviewing a skill, check its siblings. If the pattern has diverged, align them before the divergence becomes the norm.

---

## The description is the router

The `description` in a registered skill's frontmatter is the only part of that skill paid for in every session, and the only part the router — the orchestrator, another agent's matcher — ever sees before deciding whether to load the body. Write it as the trigger phrases a user would actually say, plus the boundary: what this skill is for, and what adjacent thing it is not. Never write it as a summary of the body; a summary tells a reader who already opened the file what they just read, and the router never opens the file.

---

## Cross-file integrity

The principles above cover most writing pitfalls. The patterns below are distinct phenomena that don't reduce to a writing principle — they describe structural or cross-file failures that only surface when a skill is read in the company of the files it depends on.

- **Shadow knowledge** — durable policy duplicated into a skill file instead of a methodology doc. Skills reference; docs hold knowledge. Exception: a dispatched brief may restate a rule's *operational* form — the steps, not the reasoning — to stay cold-loadable. The rationale stays at the source; only the enactment repeats.
- **Prompt-shaped docs** — methodology documentation written like agent system prompts. Match tone and structure to the intended reader — see *Three kinds of instruction file* above.
- **Root-document drift** — a pattern in a shared contract (like an operating contract) is inherited by every skill that references it. Fixing a scripted phrase downstream without fixing the root means the next skill written from that contract repeats the problem — fix at the source. This is *structural consistency across sibling skills* (above) at a smaller radius: one root, several siblings, one fix point. This file is itself a root with a known runtime mirror, `src/hidden-skills/groundwork-stack-forge/references/authoring-engineer-skills.md`; a change here should trigger a review there.
- **Driver/worker instruction pairs** — a skill that dispatches work (a driver briefing a worker, an orchestrator briefing a subagent) splits rationale from recipe. The driver's file carries the *why* — it is the decision-maker. The worker's file carries the steps and gates — it is the executor. State each once, in the file that owns it; a worker that re-explains why duplicates the driver, and a driver that spells out execution steps duplicates the worker.
- **Generated or transcluded text** — a table cell or section authored in one file and rendered into another must stand alone: no "see § above," no pronoun resolving only against its origin file's headings. The rendering context carries none of that.
- **Shared-contract non-conformance** — a skill that loads a shared contract must enact each protocol where it applies. Naming the contract is not conformance; executing its steps is. A skill silent on a protocol does not run it, invisibly until the cross-skill flow is exercised. List every contract step a new skill must perform and confirm it does, at the right point in its lifecycle.
- **Identifier drift across producers and consumers** — shared identifiers (file paths, headers, status values, frontmatter keys, slugs) must match exactly between the files that write them and the files that read them. Drift is silent: a consumer reading the wrong header simply finds nothing. Distinct from structural consistency — the shape can match while the strings disagree. When introducing a shared identifier, list every writer and reader in the same change and verify the match.
