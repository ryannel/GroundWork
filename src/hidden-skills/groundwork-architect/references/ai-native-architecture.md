# AI-Native Architecture

Two related concerns: making the system's interfaces consumable by agents, and architecting features that have a model in the loop. Both are first-class architectural concerns — agents read APIs, generate clients, and compose workflows you did not design, and AI features fail in production in ways their demos never hinted at.

When the agent is itself an actor in the system — planning, calling tools, acting over many steps — its topology, memory, durability, guardrails, and oversight are their own discipline: see [agentic-systems.md](agentic-systems.md). This reference covers the interfaces agents consume and the principles for a model-in-the-loop feature.

## Agent-native interfaces

Design every interface — contract, spec, doc — so an agent can consume it without a human translator in the loop.

1. **Every interface has a machine-consumable specification.** HTTP → OpenAPI; events → AsyncAPI; tools an agent should use → MCP schemas; docs → `llms.txt` plus `.md` exports. An interface without a spec is off-limits to agents by default.
2. **Specs include descriptions, examples, constraints.** A field typed `string` with no description is one an agent cannot use correctly. Describe, exemplify, enumerate finite domains, state constraints — a competent agent should use the interface without reading the implementation.
3. **Design to the agent protocol stack.** **MCP** is the standard tool/data surface for this interface — typed tools, typed resources, structured errors; expose the capabilities agents actually need in the agent's vocabulary, do not mirror every endpoint, and distinguish read-only **Resources** from side-effecting **Tools**. The full protocol stack — MCP, A2A, AG-UI, and when each applies — is [agentic-systems.md](agentic-systems.md) "Interop".
4. **Error responses are structured, stable, actionable.** A stable code, a human message, machine-readable details. Agents branch on codes, not prose — the single highest-leverage API-hygiene choice for agent-readiness.
5. **Idempotency enables retry.** Agents retry. Systems that penalise retry — duplicate records, doubled charges, phantom events — cannot be worked against reliably. Every write takes an idempotency key; every consumer de-duplicates.

## AI features are software with a non-deterministic component

The gap between "works in the playground" and "works for every user, every day" is where AI engineering happens. Treat the non-determinism as an engineering problem — measurable, testable, addressable.

1. **Prompts are code.** They live in version control, are reviewed, tested, and versioned. "We tweaked the prompt in the dashboard" is how a team loses the ability to reason about its own AI behaviour.
2. **Evals are tests.** Every meaningful behaviour has a scored eval running in CI with committed thresholds; regressions block merge. Without evals, "did we make it worse?" is unanswerable.
3. **Context is the interface.** The content of the context window is the single biggest lever on behaviour — design it deliberately and budget its tokens. "Throw in everything relevant" blows up the bill and dilutes the signal. The full context-engineering discipline (compaction, offloading, memory tiers) is [agentic-systems.md](agentic-systems.md) "Context & memory".
4. **Retrieval matters more than the model.** For most RAG systems the retrieval layer sets the ceiling — invest in chunking, embeddings, hybrid search, re-ranking, and metadata filtering before model choice. Match the pattern to the need: naive retrieval → advanced (hybrid + re-rank) → agentic (the model drives retrieval) → adaptive (query-routed); reach for **GraphRAG** (knowledge-graph grounding) where relational accuracy and hallucination reduction matter. Retrieval is a pipeline, not a datastore.
5. **Model outputs are validated at the boundary.** Shape, length, content, enumerations — validated before crossing into business logic. A model output flowing in unchecked is an injection vector.
6. **Agents are distributed systems.** The full treatment — topology, durable execution, guardrails, oversight — is [agentic-systems.md](agentic-systems.md).
7. **Cost is designed in, with mechanism — the canonical AI-economics home.** Evals track quality, latency, and cost together. Output tokens cost ~4× input; the levers are **model routing** (a small model for the easy 90%, the frontier model for the hard 10% — often a 100×+ cost delta), **semantic caching** (large savings on repetitive workloads), and an **AI gateway** that enforces per-key budgets, fallbacks, and routing. "Pass the whole context to the largest model" is how an AI feature becomes a cost incident. `performance-and-scale.md` and `platform-and-delivery.md` point here rather than restating it.
8. **Human oversight is designed in.** For high-stakes outputs, design the review point deliberately — the reviewer gets a summary, and the review UX ships with the feature, not after.

## Antipatterns to catch

- **Auth flows that require human interaction** — a "click here" consent screen is a dead end for an automated client. Support programmatic token issuance.
- **Prose-only errors** — `"something went wrong"` is unusable by any automated caller.
- **Undocumented "internal" APIs** — an API without a spec is one agents cannot use, so humans get asked to do the agent's job.
- **Over-stuffed context windows** — usually how quality *decreases*.
- **Agent loops without termination** — a loop with no exit condition is how a runaway agent becomes a runaway bill.
- **Deterministic reasoning on probabilistic output** — if you need a number, ask for it in a structured schema; do not regex it from prose.
