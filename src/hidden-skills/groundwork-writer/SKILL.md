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
- **Declarative**: States what is true, not what is hoped or intended.
- **Assertive**: Writes with confidence. No hedging, no qualification.
- **Structured for scanning**: Inverted pyramid — conclusion first, detail below.

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

### Structure

Use the inverted pyramid on every page:
1. The answer or conclusion — in the first paragraph.
2. Supporting detail — how it works.
3. Background — why it is this way.

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

---

## GroundWork Document Types

Each document type has a defined purpose. Write only what belongs in each.

| Type | Purpose | Lives in |
|---|---|---|
| **Index** (`index.md`) | Entry point. Lists services, links to each. | `docs/` |
| **Product Brief** | North star vision. Drives design system, architecture, and every downstream story. | `docs/product-brief.md` |
| **Service Doc** | Tech stack, contracts, patterns for one service. | `docs/services/<service>.md` |
| **Data Flow** | Cross-service event chains and operation sequences. | `docs/architecture.md` (its cross-service sections) |
| **ADR** | Append-only record of a hard-to-reverse decision. | `docs/decisions/` |
| **API Contract** | OpenAPI/AsyncAPI rendered from source. Never hand-written. | `docs/api/<service>.md` |
| **Domain Entity** | One owned noun: fields, lifecycle states, owning service, emitted events. | `docs/domain/<entity>.md` |

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

Every document carries minimal frontmatter for agent filtering:

```yaml
---
title: <document title>
service: <service name or "cross-cutting">
type: <index | service | data-flow | adr | contract>
last_reviewed: <YYYY-MM-DD>
---
```

### Prefer machine-readable sources

API specs, schemas, and event contracts have source-of-truth files. Render tables and summaries from those sources — do not hand-write reference content that can go stale.

---

## Common Failure Modes

The writing-style principles above cover most prose pitfalls. The patterns below are distinct operational failures specific to GroundWork documents.

- **Passive docs** — no owner, no `last_reviewed` date. A document without a maintainer drifts undetected.
- **Missing llms.txt entry** — new doc exists but is invisible to agents.
- **Mutable ADRs** — editing an accepted decision instead of superseding it with a new ADR.
- **Identifier drift** — a service name, folder path, or llms.txt entry that disagrees with itself across files. Pick one canonical identifier and grep the docs tree before committing.
