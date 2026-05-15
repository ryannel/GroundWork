---
name: writer
description: >
  Enforce GroundWork's "zero-fluff," declarative documentation style and 
  agent-native documentation principles. Use this skill whenever generating, 
  editing, reviewing, or refactoring documentation within GroundWork. This includes 
  Product Briefs, Architecture logs, data flows, ADRs, and system specifications. 
  Make sure to use this skill whenever a user asks to draft technical documents, 
  mentions writing style, tone of voice, removing hedging, or asks about 
  documentation architecture, even if they don't explicitly mention "writer."
---

# GroundWork Technical Writer

GroundWork documentation is designed for confident, efficient consumption by both humans and AI agents. Every document is a shared context layer — the foundation that engineers, designers, and agents use to make good decisions independently.

Great GroundWork documentation has three qualities:
- **Clarity**: The reader understands exactly what is being said and can act on it immediately.
- **Confidence**: The writing asserts knowledge without qualification. The reader trusts it.
- **Durability**: The structure and language survive context-switching, re-reading, and machine parsing.

## 1. Writing Style & Tone

Apply these rules when writing or reviewing any documentation:

### Core Voice: Assertive and Assistive
- **Direct:** State facts without qualification. ("The API returns a 404 error" instead of "The API might return a 404 error").
- **Instructional:** Tell the reader what to do. ("Set the timeout" instead of "You may want to set the timeout").
- **Confident:** Assert knowledge without hedging. 

### Active Voice Mandate
Identify the actor, the action, and the target—in that order.
- ✅ *The API returns a JSON response.*
- ❌ *A JSON response is returned.*

### The Inverted Pyramid
Place the most critical information at the top and progressively layer supporting details below.
1. **Critical Info:** What do I need to know? (Answer the core question in the first paragraph).
2. **Supporting Detail:** How does it work?
3. **Background/Context:** Why is it this way?

### Cognitive Weight Reduction
- **Front-load keywords:** Start sentences with the most important noun or verb.
- **One idea per sentence / One topic per paragraph.**
- **Use Lists and Tables over prose:** Lists are faster to scan and easier for agents to parse.
- **Code over description:** Show the config file instead of describing it.

### Hedging Elimination
Hedging phrases reduce reader confidence and introduce ambiguity. State the claim directly or drop it.
- **Drop:** "It should work", "You might want to", "This could potentially cause", "Basically", "In most cases", "Please note that".

---

## 2. Agent-Native Documentation Principles

Documentation is part of the runtime environment for engineering work. A human reads the site through navigation; an agent reads the same knowledge through MCP, `llms.txt`, and per-page Markdown exports. 

### AI-Native Documentation Surfaces
Every important documentation surface must survive machine consumption. 
- **llms.txt**: A curated, high-signal index of documentation designed for LLM consumption. You MUST ensure this is updated when new documentation is created.
- **llms-full.txt**: The consolidated corpus of all documentation. 
- **MCP Resources**: Agent discovery interfaces.
Agent-readiness is not an afterthought; it is a fundamental quality attribute of the docs system.

### Separation of Knowledge and Execution
- **Docs hold knowledge:** Architecture principles, schemas, API references, and ADRs belong in the docs site.
- **Skills control execution:** Agent skills own triggering, task routing, tool use, and verification. Skills should *reference* documentation, not duplicate durable engineering knowledge.

### Active Docs
A page is not "done" when written. Active docs declare:
- **Ownership:** Who maintains it.
- **Freshness Status:** Review cadence and last reviewed dates.
- **Source-of-truth boundaries.**

### Automation is the First Reviewer
Automated checks enforce cheap, high-signal rules: required frontmatter, broken links, invalid skill-to-doc references, and known version mismatches. Humans and agents review accuracy, judgment, and usefulness.

### Prefer Generated Reference over Prose
API specs, event contracts, database schemas, and CLI command tables have machine-readable sources. Render them from those sources instead of hand-writing reference pages.

### Append-Only Decisions
Hard-to-reverse decisions live in ADRs. Accepted ADRs are not edited to match current preference; they are superseded with a new record that references the original.

---

## 3. How to Execute This Skill

### When drafting a new document:
1. **Apply the Inverted Pyramid:** Start with the answer.
2. **Apply Frontmatter:** Ensure ownership, audience, and freshness tags are included (if applicable).
3. **Draft the content:** Use active voice, simple language, and zero hedging. Use tables or lists for complex relationships.
4. **Update llms.txt:** If creating a new canonical document, append its reference and summary to the `llms.txt` file so agents can discover it.
5. **Review your own draft:** Check against the "Antipatterns" below. Rewrite any sentence that hedges or uses passive voice unnecessarily.

### When reviewing existing documentation:
1. Identify all hedging ("probably", "might", "essentially", "basically"). Replace them with direct assertions or define the specific conditions.
2. Identify passive voice and rewrite it into active voice.
3. Identify verbose paragraphs that can be condensed into bullet points or tables.
4. Ensure the document starts with the most critical information.

---

## 4. Common Failure Modes

These patterns degrade documentation quality. Use them as a review checklist.

- **Shadow docs in skills:** Durable policy duplicated into a `SKILL.md` instead of pointing to the canonical doc. Skills reference; docs hold knowledge.
- **Prompt-shaped docs:** Human-facing documentation written like agent system prompts. Tone and structure must match the intended audience.
- **Passive docs:** Pages without an owner, freshness metadata, or a review path. A doc without a maintainer is a liability.
- **Unverifiable claims:** Version, standard, or API claims not checked against source. Assert only what can be confirmed.
- **Manual generated reference:** Hand-written tables for data that can be rendered from contracts or code. Generate; don't transcribe.
- **Mutable ADRs:** Editing accepted decisions instead of superseding them. History must be preserved.
- **Hedging language:** Phrases like "It is generally recommended...", "This will probably...", "In order to...", or "It should..." signal uncertainty. State the claim directly or drop it.
