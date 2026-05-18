---
name: writer
description: >
  Enforce GroundWork's declarative, zero-fluff writing style when generating,
  editing, or reviewing any file inside the GroundWork source repository — skill
  instruction files, SKILL.md frontmatter, contributor guides, methodology docs,
  and architecture records. Use this skill whenever a task involves writing prose
  inside this repo, even if the user doesn't say "writer."
---

# GroundWork Writer (Dev)

This skill governs writing inside the GroundWork source repository — skill files, methodology documentation, contributor guides, and architecture records. The audience is agents and contributors working on GroundWork itself, not users of GroundWork-powered projects.

Every file in this repo is either executed by an agent or read by a contributor. Both readers need the same thing: precise, unambiguous text that carries its full meaning on the first read.

---

## Writing Principles

### Say it once, clearly

State the point. Do not restate it with an example immediately after. Do not add a closing sentence that summarises what the paragraph just said. If the writing is precise, it does not need reinforcement.

The burden shifts to the words themselves. Every sentence must be unambiguous on first read — not because a follow-up sentence will clarify it, but because there is no follow-up sentence.

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

When a skill produces something for user review — a spec, a plan, a document — the instructions must frame it as a proposal the agent walks through collaboratively, not a finished product the user approves or rejects wholesale. Dumping a complete artifact and asking "does this look right?" is the equivalent of handing someone a contract to sign. Walking through each section — teaching the domain, justifying choices, presenting alternatives — builds trust and produces better outcomes because the user becomes an informed collaborator.

If a skill produces an artifact, the instructions must define:
- How the agent presents it (as a draft, not a deliverable)
- The structure of the walkthrough (section by section, with defined steps per section)
- What happens when the user requests a change (re-flow for cohesion, not isolated edits)

### Explain reasoning over rigid constraints

Agents with strong theory of mind respond better to understanding *why* something matters than to rigid ALWAYS/NEVER directives. When you find yourself writing heavy-handed constraints, reframe them as reasoning the agent can internalise. A constraint explained is adopted; a constraint imposed is worked around.

- ❌ `ALWAYS regenerate the full spec when any section changes. NEVER make isolated edits.`
- ✅ `A design system is a web of interconnected decisions. Changing one value without propagating its effects creates internal contradictions that surface during implementation. Regenerate the full spec when sections change to maintain cohesion.`

The second version produces the same behaviour but also equips the agent to handle edge cases the instruction writer did not anticipate.

---

## Common Failure Modes

- **Restatement** — making a point clearly, then immediately backing it up with an example or closing sentence that says the same thing. Trust the writing.
- **Scripted phrases** — quoted or italicised sample phrases the agent is expected to say verbatim. Write the intent instead.
- **Split causal chains** — stating a rule in one sentence and its reason in the next. Combine them.
- **Passive docs** — no owner, no `last_reviewed` date. A file without a maintainer drifts undetected.
- **Shadow knowledge** — durable policy duplicated into a skill file instead of a methodology doc. Skills reference; docs hold knowledge.
- **Hedging** — "It is generally recommended", "This will probably", "In order to." State the claim or drop it.
- **Prompt-shaped docs** — methodology documentation written like agent system prompts. Match tone and structure to the intended reader.
- **Dump-and-approve** — producing a complete artifact and asking the user to approve it wholesale instead of walking through each section collaboratively. The agent skips the teaching and justification steps that build trust.
- **Isolated edits to interconnected artifacts** — changing one section of a cohesive document without propagating the effects to dependent sections. Typography changes affect spacing, spacing affects component anatomy, component anatomy affects motion. Surgical edits to interconnected systems create contradictions that surface during implementation.
