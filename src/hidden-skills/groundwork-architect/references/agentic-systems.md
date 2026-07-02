# Agentic Systems

When an AI agent is an actor in the system — planning, calling tools, acting over many steps — it is a distributed system with a non-deterministic core. Architect it like one. Most agent failures are system failures, not model failures, and they are designed out here or paid for in production. The deciding question at design time: where is the agent's authority bounded, where does its state survive failure, and where does a human stand?

## Topology — decide the agent count first

- **Single agent owning the context is the default.** When work fans out, spawn **stateless, read-only sub-agents** for isolated retrieval/analysis and fold results back. Do **not** run multiple agents making interdependent decisions over shared mutable state — that is the canonical failure mode (conflicting actions, lost context, compounding error).
- **Supervisor/worker and handoff topologies** are for genuinely separable sub-problems, not a default. Under an equal token budget a single well-structured agent usually beats a swarm.
- Decide the split on the same converging-signals discipline as service boundaries: separate only when the sub-problem is genuinely independent and read-mostly.

## Interop — design to the protocol stack

Reach the world through standards, not glue: **MCP** for tools/data, **A2A** for agent-to-agent delegation, **AG-UI** for the agent↔interface event stream. Designing to the protocols keeps agents, tools, and surfaces independently replaceable. A design that names only MCP is incomplete.

## Context & memory — the scarce resource

- **Context is the biggest lever and it is finite.** Curate what enters the window; manage its lifecycle with **compaction** (summarise-and-reinitialise near the limit) and stale-tool-result clearing. "Throw in everything relevant" raises cost and lowers quality.
- **Memory is a tiered design**: working (live context), long-term (durable facts/preferences, retrieved on demand), vector (semantic recall). Each tier needs an explicit write policy, retention, and retrieval path — decide them, don't let memory be implicit.

## Durability — long-running agents resume, not restart

An agent that runs for minutes/hours will be interrupted. Build it on **durable execution** (Temporal / LangGraph checkpointer / event-sourced state) so it resumes from the last committed step without repeating side effects ([integration-and-workflows.md](integration-and-workflows.md)). Durability moves the reliability guarantee out of the prompt and into infrastructure, and is what makes human-pause and long tool calls safe.

## Guardrails — the input is adversarial

- An agent mixes instructions and data in one channel, so **prompt injection is structural**, and it arrives *indirectly* — through retrieved documents, tool outputs, and other agents (injection in shared context propagates).
- Validate at every trust boundary; constrain what each tool can do; mediate tool access and model traffic through a **gateway control point**; treat any model output crossing into code or an action as untrusted until checked. Output-only defence is insufficient — the threat comes in through the data ([security-and-trust.md](security-and-trust.md)).

## Authority & oversight — least agency, human gate sized to stakes

Give the agent the minimum authority its task needs; the riskier the action, the tighter the leash. High-stakes actions pause at a **human approval gate** implemented as a durable interrupt that resumes on decision (not a blocking call); lower-stakes route by confidence. Distinguish human-*in*-the-loop (approve before acting) from human-*on*-the-loop (monitor/intervene). A loop with no termination condition and no oversight is an autonomous incident waiting to happen. Agent identity and pre-action tool authorization belong to [security-and-trust.md](security-and-trust.md).

## Evals & traces — the reliability surface

Behaviour is probabilistic, so measure it: trace every run (plan, tool calls, tokens, outcome), score task-completion / tool-call correctness / reasoning, run evals offline in CI **and** online in production, and promote failed production traces into the eval set so it grows from real behaviour ([observability.md](observability.md)). An agent you cannot trace is one you cannot trust.

## Antipatterns to catch

- **Naive multi-agent** — parallel agents on shared mutable state. Default to one agent + stateless sub-agents.
- **Over-stuffed context** — pouring everything in; curate and compact.
- **Hand-rolled durability** — ad-hoc state flags instead of a checkpointer.
- **Output-only injection defence** — trusting retrieved inputs and tool results.
- **Unbounded agency** — a tool-wielding loop with no authority limit, termination, or human gate on consequential actions.
- **Free-text parsing** — regex over prose; use schema-constrained output / tool calling.
