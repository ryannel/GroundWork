---
title: Agent-Native Systems
description: Making APIs and docs AI-consumable — MCP, llms.txt, structured metadata, and the interfaces that let agents work alongside humans.
status: active
last_reviewed: 2026-05-26
---
# Agent-Native Systems

## TL;DR

AI agents read our APIs, our events, and our documentation programmatically. Building agent-native systems means designing every interface — contract, spec, doc page — so that an agent can consume it without a human translator in the loop. MCP for structured tool surfaces, `llms.txt` for discoverable documentation, stable error codes, rich OpenAPI examples — the pieces compose into a system agents can work inside.

## Why this matters

The organisation that takes agent-readiness seriously in 2026 gets a multiplier on every engineer's output. Agents write code faster, answer questions faster, and onboard faster when the systems they are working against are designed for them. The organisation that treats agent-readiness as an afterthought pays the cost in a constant low-grade friction: agents that need babysitting, outputs that need correction, onboarding that requires a human bootstrapping step for every task. The investment is modest; the return compounds.

## Our principles

### 1. Every interface has a machine-consumable specification

HTTP endpoints have OpenAPI; events have AsyncAPI; documentation has `llms.txt` and `.md` exports; the tools an agent should use have MCP schemas. An interface without a machine-consumable spec is off-limits to agents by default.

### 2. Specifications include descriptions, examples, and constraints

A spec that says a field is `string` without saying what the string represents is a spec an agent cannot use correctly. We write descriptions, give examples, enumerate finite domains, and state constraints explicitly. The standard is: a competent agent should be able to use the interface without reading the implementation.

### 3. MCP is our standard tool surface

When we want agents to interact with the system beyond reading, we expose the capability through a Model Context Protocol server. Tools are typed, documented, and error-reporting; resources are typed and fetchable. A bespoke prompt-engineering integration is a deprecated pattern — MCP is the interop.

### 4. `llms.txt` and `.md` exports are shipped alongside docs

Every docs site ships `llms.txt` (the index) plus a `.md` export for every page. Agents navigate the docs the same way a human would, but through a plain-text channel that does not require HTML parsing.

### 5. Error responses are structured, stable, and actionable

Every error carries a stable code, a human message, and machine-readable details. The code is catalogued and never renumbered. Agents branch on codes; they do not parse prose. This is the single highest-leverage API hygiene choice for agent-readiness.

### 6. Idempotency enables retry

Agents retry. Systems that penalise retry — duplicate records, doubled charges, phantom events — cannot be worked against reliably. Every write endpoint accepts an idempotency key ([API Design](../system-design/api-design.md)); every event consumer is de-duplicating ([Integration Patterns](../system-design/integration-patterns.md)).

### 7. Outputs are structured where it matters

When an agent is producing a structured result — a database record, an API payload, a configuration fragment — we use schema-constrained generation (JSON schema, tool calling) rather than free-text-then-parse. Free-text parsing is how agent pipelines become brittle.

### 8. Documentation is reviewed for agent consumption

When we write a page, we ask: would an agent reading this through MCP understand what to do? If the page assumes visual hierarchy, colour, or context that does not survive serialisation, we re-shape it. Agent-readiness is a docs quality attribute, not a separate track of work.

## How we apply this

- [API Design](../system-design/api-design.md) — the OpenAPI discipline that makes our APIs agent-consumable.
- [Documentation](../foundations/documentation.md) — the dual-audience docs stance.

## Anti-patterns we reject

- **Auth flows that require human interaction.** A consent screen with a "click here" button is a dead end for an automated client. Design auth that supports programmatic token issuance.
- **Prose-only error responses.** `"something went wrong"` is unusable by any automated caller.
- **Undocumented "internal" APIs.** An API without a spec is an API that agents cannot use — which means humans will be asked to do the thing an agent should be doing.
- **MCP tools that wrap everything.** An MCP server that mirrors every endpoint in the API is noise. Expose the capabilities agents actually need, named in the agent's vocabulary.
- **Documentation that leans on rendered visuals.** An architecture diagram nobody can parse from Markdown is a diagram an agent cannot read. Prefer Mermaid source in the Markdown.

## Further reading

- *Model Context Protocol* ([modelcontextprotocol.io](https://modelcontextprotocol.io)) — the canonical MCP specification.
- *llms.txt specification* ([llmstxt.org](https://llmstxt.org)) — the dual-audience docs convention.
- *OpenAPI Specification* ([openapis.org](https://www.openapis.org)) — the HTTP contract format.
- *Anthropic's agent engineering posts* — practical patterns for building agents against real APIs.
- *Simon Willison's blog* ([simonwillison.net](https://simonwillison.net)) — ongoing, practical commentary on the state of tooling.
