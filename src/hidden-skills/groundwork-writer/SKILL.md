---
name: groundwork-writer
description: >
  Apply when producing any document that GroundWork generates as part of its methodology —
  product briefs, architecture documents, UX design specs, ADRs, service indexes, data flows,
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

---

## GroundWork Document Types

Each document type has a defined purpose. Write only what belongs in each.

| Type | Purpose | Lives in |
|---|---|---|
| **Index** (`index.md`) | Entry point. Lists services, links to each. | `docs/` |
| **Product Brief** | North star vision. Drives UX, architecture, and every downstream story. | `docs/product-brief.md` |
| **Service Doc** | Tech stack, contracts, patterns for one service. | `docs/<service>/` |
| **Data Flow** | Cross-service event chains and operation sequences. | `docs/architecture/` |
| **ADR** | Append-only record of a hard-to-reverse decision. | `docs/architecture/decisions/` |
| **API Contract** | OpenAPI/AsyncAPI rendered from source. Never hand-written. | `docs/<service>/api.md` |

### Product Brief Quality Gates

- **Success Indicators must be observable.** "Users feel delighted" is not an indicator — write specific behaviours or outcomes a designer or engineer could observe. (e.g., "Users return to generate a second story within 7 days.")
- **Constraints must include user-facing mechanics.** A constraint stated as policy ("adult content must be gated") is incomplete without capturing how it manifests for the user: who controls it, at what level, and what the user experiences when it applies.
- **Strategic insights belong in the body.** Any finding that would change how a designer or engineer approaches the system must appear as a named section — not buried in a review appendix.

---

## AI-Native Requirements

GroundWork documentation is part of the agent's runtime environment.

### llms.txt

Every new canonical document must be referenced in `docs/llms.txt` — the agent discovery index. If a document is not listed, agents will not find it. Append a one-line summary after creating any new doc:

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

- **Restatement** — stating a point clearly, then immediately backing it up with an example or closing sentence that says the same thing. Trust the writing.
- **Hedging language** — "It is generally recommended", "This will probably", "In order to." State the claim or drop it.
- **Passive docs** — no owner, no `last_reviewed` date. A document without a maintainer drifts undetected.
- **Missing llms.txt entry** — new doc exists but is invisible to agents.
- **Mutable ADRs** — editing an accepted decision instead of superseding it with a new ADR.
- **Manual reference content** — hand-written tables for data that can be generated from contracts or schemas.
