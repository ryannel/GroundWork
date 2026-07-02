---
title: Agentic Systems
description: Architecting systems where AI agents are first-class actors — topology, interop protocols, context and memory, durable execution, guardrails, and human oversight.
status: active
last_reviewed: 2026-06-19
---
# Agentic Systems

## TL;DR

When an AI agent is an actor in the system — planning, calling tools, and acting over many steps — it is a distributed system with a non-deterministic core, and it must be architected like one. We default to a single agent that owns its context and delegates only stateless, read-only fan-out; we treat the context window as the scarce resource; we make long-running agents durable so they resume rather than restart; and we put every agent behind guardrails, an identity, and a human review point sized to the stakes. Agentic capability is designed in, not prompted in.

## Why this matters

The gap between an agent demo and an agent in production is the same gap as between a script and a distributed system: retries, partial failure, shared-state contention, unbounded loops, and an adversary in the input. The teams that ship reliable agents are not the ones with the best prompts — they are the ones who recognised that an autonomous loop calling real tools is infrastructure, and gave it the structure infrastructure needs. Most agent failures are system failures, not model failures, and they are designed out at the architecture stage or paid for in production.

## Our principles

### 1. Single agent first; multi-agent only when isolation pays

The default is one agent that owns the full context of a task. When work fans out, it spawns **stateless, read-only sub-agents** for isolated retrieval or analysis and folds their results back into its own context. The 2025 standoff between Cognition's *Don't Build Multi-Agents* and Anthropic's *multi-agent research system* read like a contradiction and was not: the dividing line is **read versus write**. Sub-agents that only read — breadth-first research, retrieval across disjoint sources, independent analysis that exceeds one context window — compound capability; agents that write interdependent decisions onto shared mutable state compound error (conflicting actions, lost context, dispersed framing). Cognition's own *Devin manages Devins* later shipped a coordinator over isolated workers once the work was cleanly separable — the same line drawn from the other side. So the decision rule: **fan out only when sub-tasks are independent and read-mostly, and keep exactly one agent holding the pen.** Fan-out also has a price — Anthropic measured its research swarm at roughly 15× the tokens of a single chat (single agents at ~4×) — so the separable sub-problem has to be worth that bill. Supervisor/worker and handoff topologies are tools for genuinely separable work, not a default; under an equal token budget a single well-structured agent usually beats a swarm.

### 2. Interop is a protocol stack — adopt by maturity, hide behind ports

Agents reach the world through standard protocols, not bespoke glue: **MCP** for tools and data (the model's hands), **A2A** for agent-to-agent delegation across a trust, vendor, or framework boundary (the model's colleagues), and **AG-UI** for the agent↔interface event stream (the model's face). These sit at different maturities and the field has not converged — MCP is effectively universal (adopted by every major provider, governed under the Linux Foundation's Agentic AI Foundation), while A2A reached a v1.0 only recently and a wider set of contenders is still shaking out. So **adopt by maturity**: take MCP now; reach for A2A only when you genuinely cross an org, vendor, or framework boundary — inside a single system a function call or the agents-as-tools pattern beats a network protocol and its failure modes. Whatever you adopt, keep it behind your own ports so an unsettled protocol stays replaceable — the same reason every other interface in the system is a contract.

### 3. Context is the scarce resource; engineer it

The contents of the context window are the single biggest lever on agent behaviour, and the window is finite. We curate it deliberately — the right system prompt, the right retrieved facts, the right tool results — and we manage its lifecycle with the right tool for the pressure: **compaction** (summarise and re-initialise as the window fills) when the history must round-trip, **offloading** to memory or the file system when state must persist but need not stay resident, and **sub-agent isolation** when a sub-task's tokens should never touch the main thread at all. We clear stale tool output and never dump "everything relevant" in — that both raises cost and *lowers* quality, because irrelevant tokens degrade retrieval inside the window. Context engineering is the core discipline now; prompt wording still matters (the compaction prompt itself must be tuned for recall), but it is one input to context engineering, not the whole game.

### 4. Memory is a designed, tiered system

An agent's memory is architecture, not an afterthought: **working memory** (the live context), **long-term memory** (durable facts and preferences, retrieved on demand), and **vector memory** (semantic recall over past interactions and knowledge). Each tier has an explicit write policy, retention, and retrieval path — and that write policy is a **trust boundary**, not just a cache rule: anything an agent persists can be poisoned once and replayed forever, which is why OWASP's Agentic list names memory and context poisoning as a distinct risk. Persist only validated, client-safe facts; keep secrets and PII out of recallable tiers. Memory left implicit becomes either amnesia or unbounded context growth.

### 5. Long-running agents are durable

An agent loop that runs for minutes or hours will be interrupted — a crash, a timeout, a deploy. We build it on **durable execution** so it resumes from the last committed step instead of restarting and repeating side effects. Match the weight to the horizon: an in-process loop that finishes in minutes and tolerates a clean restart needs only a **checkpointer** (a LangGraph-style PostgresSaver, event-sourced state); a job that runs for hours, spans services, fires non-idempotent side effects, or pauses on a human for days needs a real **durable execution engine** (Temporal-style) with exactly-once guarantees. Do not reach for the heaviest orchestrator by reflex — but do not hand-roll resume flags either. Durability moves the reliability guarantee out of the prompt and into the infrastructure, and it is what makes human-in-the-loop pauses and long tool calls safe.

### 6. The input is adversarial; guardrails are architecture

An agent mixes instructions and data in one channel, so **prompt injection** is a structural risk, not an edge case — and it arrives indirectly, through retrieved documents, tool outputs, and other agents (an injection in shared context propagates). There is no known complete fix: injection today is mitigated in layers, not solved, so design for containment, not prevention. We validate at every trust boundary, constrain what each tool can do, mediate tool access and model traffic through a gateway control point, and treat a model output crossing into code or an action as untrusted until checked. Prompt injection has topped OWASP's LLM risks (LLM01) every year the list has existed, and OWASP's Agentic list extends the same logic to tool misuse and memory poisoning.

The authority budget that decides where the human-or-deterministic gate sits — the lethal trifecta / Agents Rule of Two — is [Security](../quality/security.md) §9's call: an LLM cannot be the thing that decides whether to trust an LLM.

### 7. Least agency, with a human review point sized to the stakes

An agent gets the minimum authority its task requires, and the riskier the action the tighter the leash. High-stakes actions pause at a **human approval gate** — implemented as a durable interrupt that resumes on decision, not a blocking call — and lower-stakes ones route by confidence. "Human in the loop" (approve before acting) and "human on the loop" (monitor and intervene) are distinct designs; we pick deliberately. An agent loop with no termination condition and no oversight is how an autonomous system becomes an autonomous incident.

### 8. Evals and traces are the reliability surface

Agent behaviour is probabilistic, so we measure it like a system under test: trace every run (plan, tool calls, tokens, outcome), score it on the dimensions that matter (task completion, tool-call correctness, reasoning quality), run evals both offline in CI and online in production, and **promote failed production traces into the eval set** so the suite grows from real behaviour. An agent you cannot trace is an agent you cannot trust.

## How we apply this

The capability core stays headless and deterministic where it can; the agent is an adapter at the edge, like any other surface, reached through contracts and held to the same boundaries. Durable execution, identity, and the gateway control plane are shared infrastructure the agent rides, not bespoke per-agent code.

- [Agent-Native Systems](agent-native-systems.md) — designing the interfaces agents consume.
- [AI Engineering](ai-engineering.md) — the prompt/eval/context discipline underneath.
- [Security](../quality/security.md) — the lethal-trifecta / Rule-of-Two authority budget guardrails answer to.
- [Integration Patterns](../system-design/integration-patterns.md) — the distributed-systems patterns an agent loop inherits.

## Anti-patterns we reject

- **Naive multi-agent.** Parallel agents writing interdependent decisions onto shared mutable state with no shared framing. Conflicting outputs, lost context, compounding error. Default to one agent with stateless, read-only sub-agents.
- **The over-stuffed context.** Pouring every possibly-relevant document into the window. It raises cost and *lowers* quality — curate and compact instead.
- **Hand-rolled durability.** Re-implementing checkpointing and resume with ad-hoc state flags. Use a checkpointer or a durable execution engine, sized to the horizon.
- **Output-only injection defence.** Guarding the model's output while trusting its retrieved inputs, tool results, and persisted memory. Injection comes in through the data and can be replayed from memory.
- **LLM guarding the LLM.** Letting a model's own judgement be the only check before an irreversible action. Put a deterministic gate or a human in front.
- **Unbounded agency.** A tool-wielding loop with no authority limit, no termination condition, and no human gate on consequential actions.
- **Free-text parsing.** Regex-extracting structured results from prose. Use schema-constrained output / tool calling.
- **Untraced agents.** Shipping an agent whose runs cannot be replayed, scored, or turned into eval cases.

## Further reading

- *Effective context engineering for AI agents*, Anthropic (2025) — context as the core discipline, with compaction and offloading.
- *How we built our multi-agent research system*, Anthropic (2025) — when read-heavy fan-out pays, and the ~15× token cost.
- *Don't Build Multi-Agents*, Cognition (2025) — the single-thread, single-context-owner counter-position.
- *How and when to build multi-agent systems*, LangChain — the topology trade-offs.
- *Building effective agents*, Anthropic — the canonical agent-pattern catalogue.
- *OWASP Top 10 for LLM Applications* (2025) and *OWASP Top 10 for Agentic Applications* (2026) — prompt injection, excessive agency, and memory poisoning as the leading risks.
- Durable execution engines (Temporal, LangGraph) — checkpointing and resumability as the production reliability pattern.
