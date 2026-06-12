---
title: Documentation
description: Docs as an active product surface for humans and AI agents — canonical knowledge, machine-readable interfaces, automation-first governance, and drift control.
status: active
last_reviewed: 2026-05-26
---
# Documentation

## TL;DR

Documentation is an active product surface. The docs are the canonical source for durable engineering knowledge; agent skills are the execution layer that selects, loads, and applies that knowledge safely. We design documentation for humans and AI agents at the same time, organise it with Diátaxis, expose it through `llms.txt`, Markdown exports, and MCP, and enforce freshness with automation wherever a human would drift.

## Why this matters

In 2026, documentation is part of the runtime environment for engineering work. A human reads the site through navigation and search; an agent reads the same knowledge through MCP resources, `llms.txt`, and per-page Markdown exports. If those surfaces disagree, the system teaches different readers different truths. That is not a documentation problem; it is an engineering defect.

The operating model is simple: **docs hold the knowledge, skills control the agent behaviour**. Durable guidance belongs in the docs where humans and agents can inspect it. Skill files stay concise and directive: they define when to trigger, what context to load, which tools to use, and which safety checks must run. This keeps prompts lean, reduces duplicated policy, and gives us one canonical place to correct factual drift.

## Our principles

### 1. Documentation is canonical knowledge

Architecture principles, service handbooks, workflow guides, glossary terms, ADRs, API references, and generated schemas belong in the docs. A skill may point to these pages, but it does not become the source of truth for material that humans also need to understand.

### 2. Skills are the agent execution layer

Agent skills are a control surface, not a second documentation site. A skill owns triggering, task routing, tool use, safety constraints, verification steps, and context-loading instructions. It should reference the relevant doc pages, not duplicate them in full.

### 3. AI-native documentation is first class

Every important documentation surface must survive machine consumption. We publish `llms.txt` as the curated index, and `.md` exports for individual pages. Agent-readiness is not an afterthought or an SEO trick; it is a quality attribute of the docs system.

### 4. Diátaxis is the structural frame

We organise by reader intent, not by our internal org chart. Tutorials teach, how-to guides solve, reference pages support lookup, and explanation pages build understanding. A page that mixes these jobs forces both humans and agents to infer the purpose from context, which makes retrieval weaker and maintenance harder.

### 5. Active docs replace passive docs

A page is not "done" when it is written. Active docs declare ownership, review cadence, freshness status, and source-of-truth boundaries. Pages that age past their review window are visibly flagged and reviewed as part of normal engineering work, not as a cleanup project.

### 6. Automation is the first reviewer

Automated checks enforce the cheap, high-signal rules: required frontmatter, broken internal links, stale review dates, and known version mismatches. Humans review accuracy, judgment, and usefulness. Automation handles the facts it can verify without fatigue.

### 7. Prefer generated reference over prose

API specs, event contracts, database schemas, CLI command tables, and error catalogues have machine-readable sources. We render them from those sources instead of hand-writing reference pages. Hand-written reference material drifts; generated reference material can be rebuilt and checked.

### 8. Decisions are append-only

Hard-to-reverse decisions live in ADRs. Accepted ADRs are not edited to match current preference; they are superseded. Each ADR carries enough consequence and debt context for a future reader to understand why the decision existed, what it cost, and when to revisit it.

### 9. Metadata interoperability matters

Precise metadata, stable identifiers, and explicit relationships between documentation objects sharpen interoperability. For agent discovery specifically, use `llms.txt`, Markdown exports, MCP resources, and HTTP `Link` headers.

### 10. Drift is corrected at the source

When code, docs, skills, specs, and design records disagree, we identify the source of truth before editing. Code and generated contracts win for shipped runtime behaviour. ADRs win for historical decisions. Active design docs win for current delivery intent until the shipped system proves otherwise. Skills win for agent execution behaviour only.

## Freshness model

| Surface | Review window | Freshness rule |
|---|---:|---|
| Principles | 6 months | Review when operating model or engineering policy changes. |
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
- [llms.txt](https://llmstxt.org) — the emerging convention behind our AI-readable documentation index.
- [Model Context Protocol](https://modelcontextprotocol.io) — the protocol for structured agent access to docs resources and tools.
- *Docs for Developers*, Bhatti et al. — practical guidance for engineering documentation.
- *Living Documentation*, Cyrille Martraire — using code and automation to reduce documentation drift.
