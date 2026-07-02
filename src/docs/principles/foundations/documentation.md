---
title: Documentation
description: Docs as an active product surface for humans and AI agents — canonical knowledge, machine-readable interfaces, automation-first governance, and drift control.
status: active
last_reviewed: 2026-07-02
---
# Documentation

## TL;DR

Documentation is an active product surface. The docs are the canonical source for durable engineering knowledge; agent skills are the execution layer that selects, loads, and applies that knowledge safely. We design documentation for humans and AI agents at the same time, organise it with Diátaxis as the default frame, expose it through clean Markdown exports, a curated `llms.txt` index, and MCP resources, and enforce freshness with automation wherever a human would drift.

## Why this matters

In 2026, documentation is part of the runtime environment for engineering work. A human reads the site through navigation and search; an agent reads the same knowledge through MCP resources, `llms.txt`, and per-page Markdown exports. If those surfaces disagree, the system teaches different readers different truths. That is not a documentation problem; it is an engineering defect.

The operating model is simple: **docs hold the knowledge, skills control the agent behaviour**. Durable guidance belongs in the docs where humans and agents can inspect it. Skill files stay concise and directive: they define when to trigger, what context to load, which tools to use, and which safety checks must run. This keeps prompts lean, reduces duplicated policy, and gives us one canonical place to correct factual drift.

## Our principles

### 1. Documentation is canonical knowledge

Architecture principles, service handbooks, workflow guides, glossary terms, ADRs, API references, and generated schemas belong in the docs. A skill may point to these pages, but it does not become the source of truth for material that humans also need to understand.

### 2. Skills are the agent execution layer

Agent skills are a control surface, not a second documentation site. A skill owns triggering, task routing, tool use, safety constraints, verification steps, and context-loading instructions. It should reference the relevant doc pages, not duplicate them in full.

### 3. AI-native documentation is first class

Every important documentation surface must survive machine consumption. Three surfaces carry the load, and they are not interchangeable:

- **Clean per-page Markdown exports and semantic HTML** are the floor. Any agent, crawler, or RAG pipeline can read them today with no special support. This is non-negotiable.
- **`llms.txt`** is a curated index that helps a client *route* to the right pages instead of scraping the whole site. Be honest about its reach: no major model provider treats it as a crawl signal — Google's public position is that it behaves like the long-dead `keywords` meta tag, and AI-bot logs show near-zero direct requests for it. Its real value is business-to-agent: an agent you control, or an opted-in client (an IDE assistant, an MCP doc server such as `mcpdoc`), reads the index and pulls only the pages it needs. Publish it for that audience; do not assume an external crawler will honour it.
- **MCP resources** are the path when retrieval must be scoped and auditable. MCP gives the agent explicit, token-efficient fetches and gives us a log of what was actually read, instead of hoping a crawler lands on the right page.

Decision rule: ship the Markdown/HTML floor for everyone; add `llms.txt` as a routing index for agents you or your users control; reach for MCP when retrieval must be governed and inspectable. Agent-readiness is a quality attribute of the docs system, not an SEO play.

### 4. Diátaxis is the structural frame

We organise by reader intent, not by our internal org chart. Tutorials teach, how-to guides solve, reference pages support lookup, and explanation pages build understanding. A page that mixes these jobs forces both humans and agents to infer the purpose from context, which makes retrieval weaker and maintenance harder.

Diátaxis is the default partition, not a cage. It was designed for *tools* with shallow conceptual models; dense domains — a framework, a language, a protocol — need forms it does not name. The two it most often misses: a **conceptual overview** for the reader still deciding whether to adopt at all (different from an explanation aimed at someone already learning), and **annotated examples and recipes** that teach a way of thinking rather than one procedure. Allow those page types explicitly. The failure mode is dogma: refusing to write the page a reader needs because no quadrant fits, or forcing a genuinely sequential lesson into random-access reference. Use the four types to keep each page honest about its job; add a fifth when the domain demands it.

### 5. Active docs replace passive docs

A page is not "done" when it is written. Active docs declare ownership, review cadence, freshness status, and source-of-truth boundaries. Pages that age past their review window are visibly flagged and reviewed as part of normal engineering work, not as a cleanup project.

### 6. Automation is the first reviewer

Automated checks enforce the cheap, high-signal rules: required frontmatter, broken internal links, stale review dates, and known version mismatches. Humans review accuracy, judgment, and usefulness. Automation handles the facts it can verify without fatigue.

### 7. Prefer generated reference over prose

API specs, event contracts, database schemas, CLI command tables, and error catalogues have machine-readable sources. We render them from those sources instead of hand-writing reference pages. Hand-written reference drifts; generated reference rebuilds and validates.

Generation covers the *facts*, not the *orientation*. A raw OpenAPI dump is accurate and nearly unusable — readers still need hand-written narrative explaining what the API is for, the common flows, and the constraints a schema cannot express. Decision rule: generate every fact that has a machine source; hand-write the connective tissue around it; never paraphrase a generated fact back into prose, where it will silently rot out of sync with the source.

### 8. Decisions are append-only

Hard-to-reverse decisions live in ADRs; a record is immutable once accepted, and when the decision changes we supersede it rather than rewrite it. The full doctrine — the amend-vs-supersede line, assumptions, review triggers, governance — lives at [Architecture Decisions](../system-design/architecture-decisions.md).

### 9. Metadata interoperability matters

Precise metadata, stable identifiers, and explicit relationships between documentation objects sharpen interoperability. For agent discovery specifically, use `llms.txt`, Markdown exports, MCP resources, and HTTP `Link` headers.

### 10. Drift is corrected at the source

When code, docs, skills, specs, and design records disagree, we identify the source of truth before editing. Code and generated contracts win for shipped runtime behaviour. ADRs win for historical decisions. Active design docs win for current delivery intent until the shipped system proves otherwise. Skills win for agent execution behaviour only.

## Freshness model

| Surface | Review window | Freshness rule |
|---|---:|---|
| Principles | 12 months | Matches the `groundwork-check` advisory window; review sooner if operating model or engineering policy changes. |
| Service handbooks | 3 months | Review when code structure, stack versions, commands, or service boundaries change. |
| API and event reference | Every contract change | Generated from OpenAPI and AsyncAPI sources. |
| Runbooks | 3 months | Review after incidents, operational changes, or ownership changes. |
| Active bet and TDD docs | Every material implementation change | Keep design intent aligned with delivery reality. |
| Delivered bet docs | Historical | Freeze except for explicit correction notes. |
| ADRs | Historical | Supersede instead of rewriting accepted records. |
| Agent skills | Every skill or mapped docs change | Validate trigger logic, context routing, and verification steps. |

## Anti-patterns we reject

- **Skill files as shadow docs.** A skill that duplicates durable engineering policy becomes stale faster than the canonical docs page.
- **Docs pages as prompts.** Documentation should explain systems and decisions; skills should instruct agents how to act.
- **Documentation as an afterthought.** Docs ship with the feature or the feature is incomplete.
- **Manual reference tables.** If a table can be generated from code, contracts, or schemas, generate it.
- **Unowned pages.** A page without owner and review cadence has no maintenance path.
- **Stale diagrams.** A diagram that does not match the system is worse than no diagram because it creates false confidence.
- **Screenshots as reference.** Screenshots are acceptable as evidence in incidents, not as canonical UI or architecture documentation.
- **Marketing-flavoured engineering docs.** Assertions need evidence, examples, or source-of-truth links.
- **Overstated standards claims.** Distinguish formal standards from emerging conventions. Name the standard, its scope, and why it applies.

## Further reading

- [Diátaxis](https://diataxis.fr) — the structural model for tutorials, how-to guides, reference, and explanation.
- [llms.txt](https://llmstxt.org) — the curated-index convention behind our AI-readable docs; adopted by developer-doc tooling and MCP clients, not honoured by major web crawlers.
- [Model Context Protocol](https://modelcontextprotocol.io) — the protocol for structured agent access to docs resources and tools.
- *Docs for Developers*, Bhatti et al. — practical guidance for engineering documentation.
- *Living Documentation*, Cyrille Martraire — using code and automation to reduce documentation drift.
