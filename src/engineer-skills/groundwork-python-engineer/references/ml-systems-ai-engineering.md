# ML Systems

Python ML services are services first. They meet the same bars for reliability, observability, and maintainability as any other backend. What makes ML different is _what_ we test (model behaviour), not _whether_ we test.

## Principles

### 1. FastAPI for HTTP, Uvicorn for Serving, `uv` for Everything Else
One combination, applied everywhere. The Python ecosystem has a hundred alternatives — pick one and stick.

### 2. A Pure Core, Swappable Edges from the Outset
The full layout is `references/architecture.md`; for ML services the one addition is that model clients are adapters like any other — the core has no model-library imports, and swapping providers is an adapter change, not a core change.

### 3. Model Calls Are External Integrations
Every model call is wrapped behind a port the core owns, implemented by an adapter with timeouts, retries with jitter, circuit breaking, and rate-limit respect. The core never knows which provider is behind the port. Swapping providers is an adapter change.

### 4. Evals Are Part of the Test Suite
Eval sets for every significant model-driven behaviour. Run in CI. Numeric scores with committed thresholds. Regressions block merge. "The model got a little worse" is not an acceptable landing state.

### 5. Prompts Are Code, Not Configuration
Prompts live in version control, are reviewed, are tested, and are versioned. Not in a runtime config that someone can edit by accident.

### 6. Observability Spans Both Sides of the Model Call
Every model call emits a trace span with input hash, prompt version, model ID, latency, token counts, and cost.

### 7. Caching and Determinism Are Explicit
Cache when input + prompt version + model are identical. Temperature and seed set explicitly per use case.

### 8. Stateful Containers for Model Serving
Unlike stateless API services, ML services load models into memory at startup and keep them warm. Cold-starting a large model per request is not viable.

## Anti-Patterns

- **Model library imports in the domain.** If the domain imports `openai` or `torch`, it is broken.
- **Prompts in runtime config.** Untracked, unreviewed, untested.
- **"It is ML, testing is different."** The tests just include evals.
- **Uncached expensive calls.** Every stable call paid for twice is a bug.
- **Model outputs trusted blindly.** Validate shape, length, content at the boundary.
- **Synchronous long model calls on the request path.** Queue to worker, return job handle.

---

# AI Engineering & Agent-Native Surfaces

The doctrine — prompts as code, evals as tests, context as the interface, retrieval before model, boundary validation, agents as distributed systems, cost in the evaluation, designed-in oversight, moderation gates on user-facing input — is canon: `docs/principles/ai-native/ai-engineering.md`. The rules for making this service's own interfaces consumable by agents (specs, MCP, structured errors, idempotent writes) are `docs/principles/ai-native/agent-native-systems.md`. This file adds only the Python service shape above; when it and the canon disagree, the canon wins and this file is the one to fix.
