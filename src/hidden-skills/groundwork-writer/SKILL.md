---
name: groundwork-writer
description: >
  Apply when producing any document that GroundWork generates as part of its methodology —
  product briefs, architecture documents, design system specs, ADRs, service indexes, data flows,
  and API contracts written to a project's `docs/` directory. This skill governs the tone,
  structure, and quality of those artifacts, not general user documentation requests.
---

# GroundWork Technical Writer

GroundWork documentation serves two readers simultaneously: the engineer who built the system and the AI agent tasked with understanding it cold. Every document is a shared context layer. It must work when read linearly by a human and when retrieved as a chunk by an agent.

Good GroundWork documentation is:
- **Reference, not report-out**: Describes the system as it is, in the timeless present. It never narrates the conversation or the process that produced it.
- **Reader-first**: Opens by orienting a reader who was never in the room — what this is, why it exists — before any detail.
- **Declarative**: States what is true, not what is hoped or intended.
- **Assertive**: Writes with confidence. No hedging, no qualification.
- **Diagram-rich**: Reaches for a diagram wherever structure, flow, or lifecycle is easier seen than read.

---

## Writing Style

### Say it once, clearly

State the point. Do not immediately follow it with a restating example or a closing sentence that summarises what the paragraph just said. If the writing is precise, it does not need reinforcement.

The burden falls on the words themselves — every sentence must be unambiguous on first read.

### Causal chains belong in one sentence

When something matters because of a consequence, embed the consequence in the statement rather than separating it into a second sentence.

- ❌ "Record constraints first. This is because they eliminate design options before work begins."
- ✅ "Record constraints first because they eliminate design options before work begins."

### Active voice

Identify actor → action → target, in that order.

- ✅ *The Core API stores the image and returns the URL.*
- ❌ *The image is stored and the URL is returned.*

### Reference register — the system is the subject, in the present

Write about the system as it is, not about the work that built it. The grammatical subject is the system, the service, the entity — never "we", never the phase. Use the timeless present tense: the system *does*, not the team *decided*.

This is the single biggest lever on whether a doc reads as documentation or as a report-out of the setup conversation. A doc that says "we decided to use Postgres because…" is narrating a meeting; a doc that says "The Core stores orders in Postgres." is describing a system.

Ban the report-out vocabulary outright — these phrases betray the conversation behind the doc:

- ❌ "We decided to…", "We chose…", "The team agreed…" → ✅ state what the system does.
- ❌ "…is deferred to a later phase", "out of scope for now", "in this phase we…" → ✅ if it is not part of the system, do not describe it; if a boundary matters to a reader, state the boundary as a fact ("The API does not handle payment capture; that is the billing service's responsibility.").
- ❌ "Currently…", "for the MVP…", "at this stage…" → ✅ describe the present design plainly; temporal hedging dates the doc the moment it is written.

Deferred questions, rejected options, and phase scoping are flow bookkeeping — they belong in the Downstream Context file (Protocol 5) and the hand-off cache (Protocol 6), never in the published doc.

### Structure — orient first, then disclose progressively

Lead every page with **orientation**: in the first one or two paragraphs, tell a cold reader what this document covers, what the thing it describes *is*, and the mental model they need to make sense of the rest. A reader who was never in the room must be able to hold the shape of the system before meeting its parts.

After orientation, disclose progressively — the spine of the page follows the reader's information need, not the order the phase produced its outputs. Within any one section, still front-load: the conclusion or the rule first, the supporting detail below. Inverted-pyramid is a within-section tactic; the page as a whole is a guided descent from "what is this and why" into specifics.

### Accessibility — earn the reader's understanding

A reference doc that only the author can follow has failed its second reader. Make each doc self-teaching:

- **Define terms on first use.** A domain noun or an acronym gets a one-clause definition the first time it appears.
- **Intuition before precision.** Give the plain-language shape of an idea before the exact rule, schema, or constraint that pins it down.
- **Concrete before abstract.** Lead a hard concept with a concrete instance, then generalise.
- **Name the thing; let any label point, never replace.** A reader meets "the cancelled-video case," not "G8." Reserve enumerated labels for structure the reader already shares with you — a milestone or slice number locates a node in the decomposition tree. Never coin a label (G8, RC3, Band A) for a guarantee, an error case, or a task and then cite it by the label alone; the reader has not memorised your index. When a label genuinely aids cross-reference, attach it to the plain name on introduction and keep the name in every later mention.
- **Describe the behaviour, then the mechanism that implements it.** A reader understands "a corrupt file fails for good; a worker crash leaves the file untouched to retry later" before they can place `.failed(deep)` versus `.coarse`. Lead with what the system does and why it matters; name the symbol, type, or field that realises it second, for the reader who is in the code.

### Format

- Prefer lists and tables over prose for anything with more than two items.
- Prefer code blocks over descriptions of configuration.
- One idea per sentence. One topic per paragraph.
- Front-load the most important noun or verb in each sentence.

### No hedging

Drop phrases that soften or qualify claims: "should work", "might want to", "basically", "in most cases", "please note that." State the claim or remove it.

### Lead with what you believe, not what you reject

State the position and why it holds. Do not establish it by contrasting against what others do or what you do not do — the comparison is rhetorical scaffolding the reader does not need to follow the claim, and if the position only makes sense as a rejection of an alternative, the position is not yet articulated.

- ❌ "Traditional CRUD APIs treat each endpoint as a standalone operation. Our system does not work that way — endpoints compose into transactions that share a commit boundary."
- ✅ "Endpoints compose into transactions that share a commit boundary."

### Density — one idea per unit

"One idea per sentence" is the rule; these are the four ways docs break it. Each packs structure into one dense unit instead of giving the reader a unit per idea. A reader who must decompress a sentence before understanding it has been handed the writer's job.

**Compression em-dashes.** An em-dash stapling three to five ideas into one sentence. Reserve `—` for a single parenthetical aside; when it is doing the work of three sentences, write three sentences.

- ❌ "SQLite is the store for the catalog, the index, and person records — the domain is relational with complex query patterns, and SQLite is embeddable, single-file, and extension-loadable for vector search, so no separate database process."
- ✅ "SQLite stores the catalog, the search index, and person records. The domain is relational with complex query patterns — filtered facet searches, joins across ownership. SQLite suits it: embeddable, single-file, and extension-loadable for vector search, with no separate database process."

**Run-on bullets.** A bullet or checkbox carrying several distinct behaviours. One behaviour per bullet — a bullet that needs commas to list what it covers is several bullets.

- ❌ "`normalize()` maps a synonym to its canonical value, drops a sub-threshold tag, discards an off-vocabulary tag, groups by axis, and is deterministic."
- ✅ Five bullets, one behaviour each: maps a synonym to its canonical value · drops a sub-threshold tag · discards an off-vocabulary tag · groups survivors by axis · returns the same output for the same input.

**Numbered-prose walls.** A numbered list where each number is a two-to-three-sentence paragraph. Numbering promises steps; prose delivers a wall. Make it a true one-line step list, or — when it is a flow across components or time — a `sequenceDiagram` the prose annotates.

**Inline-rationale tables.** A decision or selection table with the *why* buried mid-cell behind an em-dash. The reader cannot scan the decisions because the rationale interrupts every row. Give rationale its own column, or state the decisions in the table and the reasoning in prose below it.

- ❌ `| Captioning | Qwen3-VL-30B (4-bit) — chosen for caption quality, the search backbone | GPU |`
- ✅ `| Captioning | Qwen3-VL-30B (4-bit) | GPU |` with a sentence below: "Captioning runs on Qwen3-VL because caption quality is the search backbone."

---

## Diagrams

Structure, flow, and lifecycle are easier seen than read. Where a doc describes how parts connect, how data moves, or how state changes, it carries a **diagram inline with the prose** — not as decoration, but as the primary explanation the prose then annotates.

Author every diagram as a fenced ` ```mermaid ` block. Mermaid renders natively on GitHub (where the raw `.md` is read) and on the Fumadocs site, so one source serves both readers and nothing goes stale against a checked-in image.

Reach for the diagram type the content calls for:

| When the doc describes… | Use | Lives in |
|---|---|---|
| How services / components connect | `graph` (topology) | architecture topology, a bet's overview, a service doc |
| A flow across services or time (request, event chain, async path) | `sequenceDiagram` | architecture communication, a bet's data flows |
| Entities and their relationships | `erDiagram` | data model / domain overview |
| The lifecycle states of one entity | `stateDiagram-v2` | a domain entity doc |

Keep each diagram focused — one question per diagram. A topology that also tries to show every sequence becomes unreadable; split it. Label edges with what flows along them. The prose around a diagram explains *why* and calls out the non-obvious; it does not re-narrate every node.

## Callouts

Use GitHub-style alerts to lift a canonical truth or a hazard out of the body — they render on GitHub and in Fumadocs:

```markdown
> [!NOTE]
> A fact a reader must not miss, but which would interrupt the sentence flow.

> [!IMPORTANT]
> A binding rule or invariant the system depends on.

> [!WARNING]
> A hazard — a foot-gun, a destructive operation, a constraint that bites if ignored.
```

Use them sparingly. A page where every other paragraph is a callout has no emphasis at all — reserve them for the few statements that genuinely must survive a skim.

---

## GroundWork Document Types

Each document type has a defined purpose. Write only what belongs in each.

| Type | Purpose | Lives in |
|---|---|---|
| **Index** (`index.md`) | Entry point. Lists services, links to each. | `docs/` |
| **Product Brief** | North star vision. Drives design system, architecture, and every downstream story. | `docs/product-brief.md` |
| **Service Doc** | Tech stack, contracts, patterns for one service. | `docs/architecture/services/<service>.md` |
| **Data Flow** | Cross-service event chains and operation sequences. | `docs/architecture/index.md` (its cross-service sections) |
| **ADR** | Append-only record of a hard-to-reverse decision. | `docs/architecture/decisions/` |
| **API Contract** | OpenAPI/AsyncAPI rendered from source. Never hand-written. | `docs/architecture/api/<service>.md` |
| **Domain Entity** | One owned noun: fields, lifecycle states, owning service, emitted events. | `docs/architecture/domain/<entity>.md` |
| **Getting Started** | The fresh-clone developer on-ramp: setup walkthrough and `./dev` command reference. | `docs/getting-started/` (`index.md`, `setup.md`, `dev-cli-reference.md`) |

### Product Brief Quality Gates

- **Success Indicators must be observable.** "Users feel delighted" is not an indicator — write specific behaviours or outcomes a designer or engineer could observe. (e.g., "Users return to generate a second story within 7 days.")
- **Constraints must include user-facing mechanics.** A constraint stated as policy ("adult content must be gated") is incomplete without capturing how it manifests for the user: who controls it, at what level, and what the user experiences when it applies.
- **Strategic insights belong in the body.** Any finding that would change how a designer or engineer approaches the system must appear as a named section — not buried in a review appendix.

---

## Downstream Context (the cross-phase contract)

A Sequential Setup phase produces two artifacts, for two different readers, and the writer keeps them separate:

1. The **published document** in `docs/` — clean reference documentation for a reader who was never in the room. It carries **no** `## Summary for Downstream` section.
2. The **Downstream Context file** at `.groundwork/context/<phase>.md` — the terse decision ledger the *next setup phases* read first. This is the only place the cross-phase contract lives.

This separation is what lets the published doc read as documentation rather than a report-out of the conversation that produced it. The contract is defined in Protocol 5 and Protocol 10 of the operating contract; the writer enforces it for Sequential Setup documents only.

**Exception:** Bet documents (`docs/bets/<slug>/*`) are produced in Continuous Bet mode — no published summary and no context file. The shared context and pitch `status` frontmatter serve the same function. Maintenance-skill docs likewise carry neither.

### The context file's four subsections

`.groundwork/context/<phase>.md` contains exactly these, in order. Skip a subsection entirely if it has no content — never an empty heading.

| Subsection | What goes here |
|---|---|
| `### Key Decisions` | The decisions this phase committed to that downstream phases must respect. Bulleted, one per bullet, ≤15 words each. State the decision; do not justify it. |
| `### Binding Constraints` | The hard rules, performance budgets, data residency, compliance, or vendor limits any downstream phase must work within. One constraint per bullet. |
| `### Deferred Questions` | Decisions intentionally left open, with the phase that will resolve them. Format: `- <question> — resolved in <phase>`. |
| `### Out of Scope` | What this phase deliberately did not address. Different from deferred — this is permanent absence. |

The whole file is ≤200 words, bullets not prose. No rationale (it belongs in the doc body or an ADR), no rejected options (those go in the Protocol 6 hand-off), no framing.

### Example (`.groundwork/context/product-brief.md`)

```markdown
### Key Decisions

- Storytelling engine; single-player; web-app only at MVP
- Stories are co-created turn-by-turn; not pre-authored
- Persistent characters carry state across stories

### Binding Constraints

- All generated content must support adult-content gate at user level
- Time-to-first-token ≤ 2s; full turn ≤ 6s on slowest reference device

### Deferred Questions

- Monetisation model — resolved in MVP Planning

### Out of Scope

- Mobile-native app
- Voice or audio narration
```

### Derive it from the finished doc, last

Write the published doc body first, then derive the context file from it as the final drafting action — never maintain the two in parallel. Walk every binding decision, constraint, deferred question, and permanent exclusion in the doc and confirm each is reflected in the context file, and that the context file asserts nothing the doc does not.

### Living Document edits

When a `docs/*.md` body changes under Protocol 2 during setup, refresh the matching live `.groundwork/context/<phase>.md` in the same edit if the change touched a Key Decision, Binding Constraint, or Deferred Question. After setup completes the context store is gone (Protocol 10) — the published doc is then the only living record, so there is nothing to keep in sync.

---

## AI-Native Requirements

GroundWork documentation is part of the agent's runtime environment.

### llms.txt

Every new canonical document must be referenced in `llms.txt` at the project root — the agent discovery index. If a document is not listed, agents will not find it. Append a one-line summary after creating any new doc:

```
/docs/<path>.md — <one sentence describing what the document covers>
```

### Frontmatter

Every document carries frontmatter for agent filtering and for the docs site. `title` and `description` are **required** — the site renders them as the page heading and subtitle, and an agent reads them to decide whether to open the doc. `description` is one sentence stating what the doc covers.

```yaml
---
title: <document title>
description: <one sentence describing what the document covers>
service: <service name or "cross-cutting">
type: <index | service | data-flow | adr | contract>
last_reviewed: <YYYY-MM-DD>
---
```

### Prefer machine-readable sources

API specs, schemas, and event contracts have source-of-truth files. Render tables and summaries from those sources — do not hand-write reference content that can go stale.

---

## Common Failure Modes

The writing-style principles above cover most prose pitfalls. The patterns below are distinct operational failures specific to GroundWork documents — phenomena the style sections don't already name.

- **Passive docs** — no owner, no `last_reviewed` date. A document without a maintainer drifts undetected.
- **Missing llms.txt entry** — new doc exists but is invisible to agents.
- **Missing `description` frontmatter** — the docs site renders an empty subtitle and agents lose the one-line filter.
- **Mutable ADRs** — editing an accepted decision instead of superseding it with a new ADR.
- **Identifier drift** — a service name, folder path, or llms.txt entry that disagrees with itself across files. Pick one canonical identifier and grep the docs tree before committing.
