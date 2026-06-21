# ML Systems

Python ML services are services first. They meet the same bars for reliability, observability, and maintainability as any other backend. What makes ML different is _what_ we test (model behaviour), not _whether_ we test.

## Principles

### 1. FastAPI for HTTP, Uvicorn for Serving, `uv` for Everything Else
One combination, applied everywhere. The Python ecosystem has a hundred alternatives — pick one and stick.

### 2. A Pure Core, Swappable Edges from the Outset
Explicit `core/domain`, `core/ports.py`, `core/service`, `adapters/`, and `entrypoints/` packages under `src/<package>/` (src-layout), with the inward-dependency rule enforced by `import-linter` in CI. Model clients, storage, and the FastAPI router are all adapters. The core has no model-library imports.

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

# AI Engineering

## Principles

1. **Prompts are code.** Version-controlled, reviewed, tested, versioned. Shipped through PR review.
2. **Evals are tests.** Scored comparisons in CI. Thresholds committed. Regressions block merge.
3. **Context is the interface.** The context window is the biggest lever on model behaviour. Design it deliberately. Measure its token budget.
4. **Retrieval matters more than the model.** Good retrieval + boring model > clever model + bad retrieval.
5. **Model outputs are validated at the boundary.** Shape, length, content, expected enumerations. Parse failures handled explicitly.
6. **Agents are distributed systems.** Bounded retries, circuit breakers, auditable history.
7. **Cost is part of evaluation.** Quality, latency, _and_ cost.
8. **Human oversight is designed in.** Review points for high-stakes outputs.

## Anti-Patterns

- "The model will figure it out." Over-stuffed context windows.
- Skipping evals "this once." Agent loops without termination.
- Deterministic reasoning on probabilistic output — use structured schemas.

---

# Agent-Native Systems

## Principles

1. **Every interface has a machine-consumable spec.** OpenAPI, AsyncAPI, `llms.txt`, MCP schemas.
2. **Specs include descriptions, examples, constraints.** An agent should use the interface without reading implementation.
3. **MCP is the standard tool surface.** Typed, documented, error-reporting tools.
4. **`llms.txt` ships alongside docs.** Plain-text channel for agent navigation.
5. **Errors are structured, stable, actionable.** Agents branch on codes, not prose.
6. **Idempotency enables retry.** Every write endpoint accepts an idempotency key.
7. **Outputs are structured.** Schema-constrained generation over free-text-then-parse.
8. **Documentation reviewed for agent consumption.** Would an agent reading through MCP understand what to do?
