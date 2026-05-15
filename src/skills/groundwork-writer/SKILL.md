---
name: groundwork-writer
description: >
  Enforce GroundWork's declarative, zero-fluff documentation style when writing or editing
  any documentation inside a project that uses the GroundWork methodology. Use this skill
  whenever the user asks to write, edit, or review architecture docs, ADRs, data flows,
  API contracts, service indexes, or any file inside a project's `docs/` directory.
  Also trigger when the user mentions documentation tone, style, hedging language, or
  AI-readability — even if they don't say "writer" or "GroundWork."
---

# GroundWork Technical Writer

GroundWork documentation serves two readers simultaneously: the engineer who wrote the
system and the AI agent tasked with understanding it cold. Every document is a shared
context layer. It must work when read linearly by a human and when retrieved as a chunk
by an agent.

Good GroundWork documentation is:
- **Declarative**: States what is true, not what is hoped or intended.
- **Assertive**: Writes with confidence. No hedging, no qualification.
- **Structured for scanning**: Inverted pyramid — conclusion first, detail below.

---

## Writing Style

### Voice
- State facts. ("The API returns 404 when the resource does not exist.")
- Give instructions. ("Set the timeout to 30 seconds.")
- Never hedge. Drop phrases like "should work", "might want to", "basically", "in most cases", "please note that."

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

### Active Voice
Identify actor → action → target.
- ✅ *The Core API stores the image and returns the URL.*
- ❌ *The image is stored and the URL is returned.*

---

## GroundWork Document Types

Each document type has a defined purpose. Write only what belongs in each.

| Type | Purpose | Lives in |
|---|---|---|
| **Index** (`index.md`) | Entry point. Lists services, links to each. | `docs/` |
| **Service Doc** | Tech stack, contracts, patterns for one service. | `docs/<service>/` |
| **Data Flow** | Cross-service event chains and operation sequences. | `docs/architecture/` |
| **ADR** | Append-only record of a hard-to-reverse decision. | `docs/architecture/decisions/` |
| **API Contract** | OpenAPI/AsyncAPI rendered from source. Never hand-written. | `docs/<service>/api.md` |

---

## AI-Native Requirements

GroundWork documentation is part of the agent's runtime environment. Apply these rules
whenever creating or updating a document.

### llms.txt
Every new canonical document must be referenced in `docs/llms.txt`. This file is the
agent discovery index — if a document isn't in it, agents won't find it. Append a one-line
summary after creating any new doc:

```
/docs/<path>.md — <one sentence describing what the document covers>
```

### Frontmatter
Every document should carry minimal frontmatter so agents can filter by metadata:

```yaml
---
title: <document title>
service: <service name or "cross-cutting">
type: <index | service | data-flow | adr | contract>
last_reviewed: <YYYY-MM-DD>
---
```

### Prefer machine-readable sources
API specs, schemas, and event contracts have source-of-truth files (OpenAPI YAML, SQL
schema, AsyncAPI). Render tables and summaries from those sources. Do not hand-write
reference content that can go stale.

---

## Common Failure Modes

Use this as a review checklist before finalising any document.

- **Hedging language** — "It is generally recommended", "This will probably", "In order to." State the claim or drop it.
- **Passive docs** — No owner, no `last_reviewed` date. A document without a maintainer is a liability.
- **Missing llms.txt entry** — New doc exists but is invisible to agents.
- **Shadow knowledge in skills** — Durable policy duplicated into a skill file instead of a doc. Skills reference; docs hold knowledge.
- **Mutable ADRs** — Editing an accepted decision instead of superseding it with a new ADR.
- **Manual reference content** — Hand-written tables for data that can be generated from contracts or schemas.
