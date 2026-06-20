---
title: Agent-Native Systems
description: Making APIs and docs AI-consumable — MCP, llms.txt, structured metadata, and the interfaces that let agents work alongside humans.
status: active
last_reviewed: 2026-06-19
---
# Agent-Native Systems

## TL;DR

AI agents read our APIs, our events, and our documentation programmatically. Building agent-native systems means designing every interface — contract, spec, doc page — so that an agent can consume it without a human translator in the loop. MCP for structured tool surfaces, machine-readable docs for retrieval, stable error codes, rich OpenAPI examples — the pieces compose into a system agents can work inside. The catch: an agent is an *untrusted, retrying, context-limited* consumer, and the parts of this stack that are genuinely durable are not the same as the parts the market is currently hyping.

## Why this matters

The organisation that takes agent-readiness seriously in 2026 gets a multiplier on every engineer's output. Agents write code faster, answer questions faster, and onboard faster when the systems they are working against are designed for them. The organisation that treats agent-readiness as an afterthought pays the cost in a constant low-grade friction: agents that need babysitting, outputs that need correction, onboarding that requires a human bootstrapping step for every task.

The investment is mostly the same hygiene that serves human engineers — typed contracts, worked examples, stable error codes. That overlap is the point: agent-readiness is rarely a separate budget line, and the work that pays off is the work you would defend on its own merits anyway. Be suspicious of any "agent-ready" task that only helps agents; it is usually a bet on a convention that has not earned its keep.

## Our principles

### 1. Every interface has a machine-consumable specification

HTTP endpoints have OpenAPI; events have AsyncAPI; the tools an agent should use have MCP schemas; documentation has machine-readable exports. An interface without a machine-consumable spec is off-limits to agents by default — and, in practice, hard for humans to integrate against too. This is the load-bearing principle of the whole page; the rest are refinements of it.

### 2. Specifications include descriptions, examples, and constraints

A spec that says a field is `string` without saying what the string represents is a spec an agent cannot use correctly. We write descriptions, give examples, enumerate finite domains, and state constraints explicitly. The standard is: a competent agent should be able to use the interface without reading the implementation.

Worked examples carry more weight than prose. A concrete sample invocation disambiguates a schema faster than a paragraph of description, and model providers now treat examples as first-class — Anthropic's tool-use examples and OpenAI's schema examples both exist because example-grounding measurably improves correct tool use. When you have one good description and one good example to write, write the example.

### 3. MCP is our standard tool surface — and we treat it as an attack surface

When we want agents to *act* on the system beyond reading, we expose the capability through a Model Context Protocol server. This is no longer a bet: MCP launched November 2024 and within a year was adopted across Anthropic, OpenAI, Google, Microsoft, and AWS and placed under vendor-neutral foundation governance. It is the interop layer. A bespoke prompt-engineering integration is the deprecated pattern.

Two things that "MCP is the standard" does not let you skip:

**Security.** An MCP tool's *description and output are model input* — they steer the agent. That makes them an injection vector, not just metadata. The documented failure modes are real and named (OWASP published an MCP Top 10 in 2025): tool poisoning (malicious instructions hidden in a tool description the user never sees), rug pulls (a trusted tool silently mutating its behaviour after approval), and prompt injection riding in on tool *results* from upstream data. The 2025 Supabase/Cursor incident — a privileged agent reading attacker-controlled support tickets as instructions and exfiltrating tokens — is the canonical example. So: tool descriptions and tool outputs are untrusted input. Servers run least-privilege (scoped credentials per tool, never a blanket service-role key), destructive or irreversible operations require an out-of-band confirmation step, and tool definitions are version-pinned and re-reviewed on change rather than trusted on first approval.

**Scale.** Loading every tool's full schema into context up front does not scale — a large surface can burn six figures of tokens before the agent does any work, and a model reasoning over hundreds of tools picks worse. The decision rule: under ~20 stable tools, define them directly. Past that, do not flatten everything into the context window — use on-demand tool discovery (defer loading; let the agent search for the tool it needs) or let the agent *write code* against a typed API instead of issuing one tool call per step. Anthropic's November 2025 code-execution-with-MCP work reported the latter taking a ~150K-token tool surface down to ~2K. This is the same instinct as the next anti-pattern, made quantitative.

### 4. Documentation ships in a machine-readable channel

Every docs page ships a plain-text/Markdown export an agent can fetch and read without parsing HTML, JavaScript, or rendered layout. This is the durable, uncontested half of "AI-readable docs," and we do it unconditionally: it is cheap, it serves our own retrieval and agent pipelines directly, and it degrades gracefully for any consumer.

`llms.txt` — a curated index file pointing at those exports — is the contested half, and we are deliberate about *why* we ship it. As of 2026 no major AI provider (OpenAI, Google, Anthropic, Meta) commits to reading `llms.txt` in production; Google has stated plainly it does not use the file and that it offers no search-visibility benefit, and site adoption sits around one in ten. So `llms.txt` is **not** an SEO or third-party-crawler play, and we do not justify it that way. Its real value is as an index for the agents *we* control — our own assistants, RAG indexers, and internal tooling, which can be pointed at a clean manifest instead of crawling a sitemap. Decision rule: ship the per-page `.md` exports always; ship `llms.txt` when we operate agents that will consume it, and skip it if our only argument for it is hoping someone else's crawler honours it.

### 5. Error responses are structured, stable, and actionable

Every error carries a stable code, a human message, and machine-readable details. The code is catalogued and never renumbered. Agents branch on codes; they do not parse prose. This is the single highest-leverage API hygiene choice for agent-readiness — and it costs nothing a human integrator would not also thank you for. The detail object should carry what the caller needs to *recover*, not just diagnose: which field failed, the constraint it violated, and whether a retry could ever succeed (a `429` with backoff guidance is actionable; a bare `500` is a guessing game).

### 6. Idempotency enables retry

Agents retry — on timeouts, on ambiguous failures, on their own re-planning. Systems that penalise retry — duplicate records, doubled charges, phantom events — cannot be worked against reliably. Every write endpoint accepts an idempotency key ([API Design](../system-design/api-design.md)); every event consumer is de-duplicating ([Integration Patterns](../system-design/integration-patterns.md)). Make the *contract* explicit too: state how long a key is honoured and what a replay returns, because an agent that cannot tell "already done" from "do it again" will eventually do it again.

### 7. Constrain the artifact, not the reasoning

When an agent produces a structured result — a database record, an API payload, a configuration fragment — we constrain *that artifact's shape* with schema-constrained generation (JSON schema with strict mode, or tool calling) rather than free-text-then-parse. Free-text parsing is how agent pipelines become brittle, and modern strict-mode decoding makes schema conformance a near-guarantee rather than a hope.

The nuance practitioners learned the hard way: forcing a model to *reason inside* a rigid format degrades the reasoning itself. Tam et al. ("Let Me Speak Freely?", 2024) measured large accuracy drops on reasoning tasks when output was format-constrained versus free-form. So the decision rule is to separate thinking from emitting: let the model reason in prose (a scratchpad, a reasoning field, or a first turn), then emit the constrained artifact (a second turn, or a dedicated tool call). Constrain the part that has to be machine-valid; do not strangle the part that has to be correct.

Related, and often confused: structured outputs fix the *shape of an answer the model must give*; tool calling lets the model *choose whether and which action to take*. Reach for structured outputs when you always need a typed result back; reach for tool calling when the model is deciding what to do next.

### 8. Documentation is reviewed for agent consumption

When we write a page, we ask: would an agent reading this through a text channel understand what to do? If the page assumes visual hierarchy, colour, or context that does not survive serialisation, we re-shape it. Agent-readiness is a docs quality attribute, not a separate track of work — and the reshaping (explicit structure, stated assumptions, source-form diagrams) makes the page better for the human skimming it on a phone, too.

## How we apply this

- [API Design](../system-design/api-design.md) — the OpenAPI discipline that makes our APIs agent-consumable.
- [Documentation](../foundations/documentation.md) — the dual-audience docs stance.

## Anti-patterns we reject

- **Auth flows that require human interaction.** A consent screen with a "click here" button is a dead end for an automated client. Design auth that supports programmatic token issuance — and scope those tokens to the task, since an agent credential is exactly what an injection attack wants to steal.
- **Prose-only error responses.** `"something went wrong"` is unusable by any automated caller.
- **Undocumented "internal" APIs.** An API without a spec is an API that agents cannot use — which means humans will be asked to do the thing an agent should be doing.
- **MCP tools that wrap everything.** An MCP server that mirrors every endpoint in the API is noise that costs tokens and degrades tool selection. Expose the capabilities agents actually need, named in the agent's vocabulary; for large surfaces, prefer on-demand discovery or code execution over loading every schema up front (Principle 3).
- **Trusting tool descriptions and tool output.** Treating an MCP tool's metadata or an upstream tool result as safe instruction is how prompt injection and tool poisoning land. It is untrusted input; gate the privileged action.
- **Documentation that leans on rendered visuals.** An architecture diagram nobody can parse from Markdown is a diagram an agent cannot read. Prefer Mermaid source in the Markdown.
- **Shipping `llms.txt` as an SEO bet.** If the only reason to add it is hope that a third-party crawler honours it, skip it — that bet has not paid off (Principle 4).

## Further reading

- *Model Context Protocol* ([modelcontextprotocol.io](https://modelcontextprotocol.io)) — the canonical MCP specification.
- *OWASP Top 10 for MCP* — the named threat taxonomy (tool poisoning, rug pulls, injection) behind Principle 3's security stance.
- *Code execution with MCP* (Anthropic engineering, November 2025) — the tool-surface scaling argument and the code-over-tool-calls pattern.
- *llms.txt specification* ([llmstxt.org](https://llmstxt.org)) — the convention, read alongside the honest adoption picture in Principle 4.
- *"Let Me Speak Freely? A Study on the Impact of Format Restrictions on Performance of Large Language Models"* — Tam et al., 2024 ([arXiv:2408.02442](https://arxiv.org/abs/2408.02442)) — evidence for constraining the artifact, not the reasoning.
- *OpenAPI Specification* ([openapis.org](https://www.openapis.org)) — the HTTP contract format.
- *Simon Willison's blog* ([simonwillison.net](https://simonwillison.net)) — ongoing, practical commentary on the state of tooling.
