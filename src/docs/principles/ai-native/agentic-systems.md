---
title: Agentic Systems
description: Architecting systems where AI agents are first-class actors — topology, interop protocols, context and memory, durable execution, guardrails, and human oversight.
status: active
last_reviewed: 2026-06-14
---
# Agentic Systems

## TL;DR

When an AI agent is an actor in the system — planning, calling tools, and acting over many steps — it is a distributed system with a non-deterministic core, and it must be architected like one. We default to a single agent that owns its context and delegates only stateless, read-only fan-out; we treat the context window as the scarce resource; we make long-running agents durable so they resume rather than restart; and we put every agent behind guardrails, an identity, and a human review point sized to the stakes. Agentic capability is designed in, not prompted in.

## Why this matters

The gap between an agent demo and an agent in production is the same gap as between a script and a distributed system: retries, partial failure, shared-state contention, unbounded loops, and an adversary in the input. The teams that ship reliable agents are not the ones with the best prompts — they are the ones who recognised that an autonomous loop calling real tools is infrastructure, and gave it the structure infrastructure needs. Most agent failures are system failures, not model failures, and they are designed out at the architecture stage or paid for in production.

## Our principles

### 1. Single agent first; multi-agent only when isolation pays

The default is one agent that owns the full context of a task. When work fans out, it spawns **stateless, read-only sub-agents** for isolated retrieval or analysis and folds their results back into its own context. We do not run multiple agents making interdependent decisions over shared mutable state — that is the canonical failure mode (conflicting actions, lost context, compounding error). Supervisor/worker and handoff topologies are tools for genuinely separable sub-problems, not a default; under an equal token budget a single well-structured agent usually beats a swarm.

### 2. Interop is a two-layer protocol stack

Agents reach the world through standard protocols, not bespoke glue: **MCP** for tools and data (the model's hands), **A2A** for agent-to-agent delegation and coordination (the model's colleagues), and **AG-UI** for the agent↔interface event stream (the model's face). Designing to the protocols keeps agents, tools, and surfaces independently replaceable — the same reason every other interface in the system is a contract.

### 3. Context is the scarce resource; engineer it

The contents of the context window are the single biggest lever on agent behaviour, and the window is finite. We curate it deliberately — the right system prompt, the right retrieved facts, the right tool results — and we manage its lifecycle: **compaction** (summarise and re-initialise as the window fills), clearing stale tool output, and never dumping "everything relevant" in (which both raises cost and lowers quality). Context engineering replaced prompt engineering as the core discipline for a reason.

### 4. Memory is a designed, tiered system

An agent's memory is architecture, not an afterthought: **working memory** (the live context), **long-term memory** (durable facts and preferences, retrieved on demand), and **vector memory** (semantic recall over past interactions and knowledge). Each tier has an explicit write policy, retention, and retrieval path. Memory left implicit becomes either amnesia or unbounded context growth.

### 5. Long-running agents are durable

An agent loop that runs for minutes or hours will be interrupted — a crash, a timeout, a deploy. We build it on **durable execution** (a Temporal/LangGraph-style checkpointer or event-sourced state) so it resumes from the last committed step instead of restarting and repeating side effects. Durability moves the reliability guarantee out of the prompt and into the infrastructure, and it is what makes human-in-the-loop pauses and long tool calls safe.

### 6. The input is adversarial; guardrails are architecture

An agent mixes instructions and data in one channel, so **prompt injection** is a structural risk, not an edge case — and it arrives indirectly, through retrieved documents, tool outputs, and other agents (an injection in shared context propagates). We validate at every trust boundary, constrain what each tool can do, mediate tool access and model traffic through a gateway control point, and treat a model output crossing into code or an action as untrusted until checked. Prompt injection has led OWASP's LLM risks every year it has existed.

### 7. Least agency, with a human review point sized to the stakes

An agent gets the minimum authority its task requires, and the riskier the action the tighter the leash. High-stakes actions pause at a **human approval gate** — implemented as a durable interrupt that resumes on decision, not a blocking call — and lower-stakes ones route by confidence. "Human in the loop" (approve before acting) and "human on the loop" (monitor and intervene) are distinct designs; we pick deliberately. An agent loop with no termination condition and no oversight is how an autonomous system becomes an autonomous incident.

### 8. Evals and traces are the reliability surface

Agent behaviour is probabilistic, so we measure it like a system under test: trace every run (plan, tool calls, tokens, outcome), score it on the dimensions that matter (task completion, tool-call correctness, reasoning quality), run evals both offline in CI and online in production, and **promote failed production traces into the eval set** so the suite grows from real behaviour. An agent you cannot trace is an agent you cannot trust.

## How we apply this

The capability core stays headless and deterministic where it can; the agent is an adapter at the edge, like any other surface, reached through contracts and held to the same boundaries. Durable execution, identity, and the gateway control plane are shared infrastructure the agent rides, not bespoke per-agent code.

- [Agent-Native Systems](agent-native-systems.md) — designing the interfaces agents consume.
- [AI Engineering](ai-engineering.md) — the prompt/eval/context discipline underneath.
- [Integration Patterns](../system-design/integration-patterns.md) — the distributed-systems patterns an agent loop inherits.

## Anti-patterns we reject

- **Naive multi-agent.** Parallel agents acting on shared mutable state with no shared framing. Conflicting outputs, lost context, compounding error. Default to one agent with stateless sub-agents.
- **The over-stuffed context.** Pouring every possibly-relevant document into the window. It raises cost and *lowers* quality — curate and compact instead.
- **Hand-rolled durability.** Re-implementing checkpointing and resume with ad-hoc state flags. Use a durable execution engine.
- **Output-only injection defence.** Guarding the model's output while trusting its retrieved inputs and tool results. Injection comes in through the data.
- **Unbounded agency.** A tool-wielding loop with no authority limit, no termination condition, and no human gate on consequential actions.
- **Free-text parsing.** Regex-extracting structured results from prose. Use schema-constrained output / tool calling.
- **Untraced agents.** Shipping an agent whose runs cannot be replayed, scored, or turned into eval cases.

## Further reading

- *Effective context engineering for AI agents*, Anthropic (2025) — context as the core discipline, with compaction.
- *How and when to build multi-agent systems*, LangChain — the single-agent-first position and the topology trade-offs.
- *Building effective agents*, Anthropic — the canonical agent-pattern catalogue.
- *OWASP Top 10 for LLM Applications* — prompt injection and excessive agency as the leading risks.
- *Durable execution for agents* — checkpointing and resumability as the production reliability pattern.
