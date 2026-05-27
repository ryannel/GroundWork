---
title: AI Engineering
description: Prompt engineering, evaluations, agent design, RAG, and context engineering.
status: active
last_reviewed: 2026-05-26
---
# AI Engineering

## TL;DR

AI engineering is software engineering with a non-deterministic component in the loop. We treat prompts as code, evaluations as tests, context as a first-class design surface, and agents as distributed systems. The discipline is about making probabilistic systems behave predictably enough to ship.

## Why this matters

Every team that has tried to ship an AI feature has learned the same lesson the hard way: the part that feels like magic in a demo is the part that fails in unpredictable ways in production. The gap between "it works in the playground" and "it works for every user, every day" is where AI engineering happens. The discipline treats the non-determinism as an engineering problem — measurable, testable, and addressable — rather than as an inherent limitation to shrug at.

## Our principles

### 1. Prompts are code

Prompts live in version control, are reviewed, are tested, and are versioned. A prompt change is a code change; it ships through the same PR review as any other change. "We tweaked the prompt in the dashboard" is how a team loses the ability to reason about its own AI behaviour.

### 2. Evals are tests

Every meaningful AI behaviour has an eval: a scored comparison of model output against a reference. Evals run in CI; thresholds are committed; regressions block merge the same way unit-test failures do. Without evals, "did we make the model worse?" is unanswerable, which means every improvement is also a potential regression you will discover from users.

### 3. Context is the interface

The content of the context window — what system prompt, what few-shot examples, what retrieved documents, what tool outputs — is the single biggest lever on model behaviour. We design it deliberately, measure its token budget, and treat it as a first-class interface. "Throw in everything relevant" is the anti-pattern that blows up the bill and dilutes the signal.

### 4. Retrieval matters more than the model

For most RAG systems, the retrieval layer determines the ceiling. A clever model with bad retrieval gives confident nonsense; a boring model with good retrieval gives boring, correct answers. We invest in the retrieval quality — indexing, ranking, reranking, chunk boundaries — before we invest in the model choice.

### 5. Model outputs are validated at the boundary

Every model output that crosses into code is validated: shape, length, content, and expected enumerations. Parse failures are handled explicitly, not allowed to propagate. A model output flowing into business logic without validation is an injection vector waiting to happen.

### 6. Agents are distributed systems

An agent loop — model plans, model takes action, agent observes, model re-plans — has all the problems of a distributed system: retries, idempotency, timeouts, failure isolation. We apply the same patterns ([Integration Patterns](../system-design/integration-patterns.md)): bounded retries, circuit breakers, auditable history. The hardest agent failures are system failures, not model failures.

### 7. Cost is part of the evaluation

A prompt that is 10% better but 5× more expensive is not obviously better. Evals track quality, latency, *and* cost, and decisions about which configuration to ship consider all three. Cost-unaware evaluation is how an AI feature becomes a cost incident after launch ([Cost Engineering](../delivery/cost-engineering.md)).

### 8. Human oversight is designed in

For high-stakes AI outputs — content a user will act on, automated actions taken on behalf of a user — we design the review point deliberately. The human reviewer gets a summary, not a wall of text; the review UX is built alongside the AI feature, not retrofitted. "Let the model do it" without a review loop is a promise the model will eventually fail.

## How we apply this

- [Agent-Native Systems](agent-native-systems.md) — the flip side, making our interfaces consumable by agents.
- [Observability](../quality/observability.md) — the trace surface for model calls.
- [Testing](../foundations/testing.md) — the broader testing discipline evals sit inside.

## Anti-patterns we reject

- **"The model will figure it out."** Hope is not a design.
- **Prompts as configuration.** Untracked prompts drift silently, and evals cannot catch drift they are not told about.
- **Over-stuffed context windows.** Throwing the kitchen sink at the model is usually how quality *decreases*.
- **Skipping evals "this once."** This once becomes always. Evals compound when you have them and compound against you when you do not.
- **Agent loops without termination.** A loop without a clear exit condition is how a runaway agent becomes a runaway bill.
- **Deterministic reasoning on top of probabilistic output.** If you need a number, ask for a number in a structured schema. Do not regex-extract it from prose.

## Further reading

- *Prompt Engineering Guide* ([promptingguide.ai](https://www.promptingguide.ai)) — the practitioner's summary of current patterns.
- *Evaluating and Reinforcing LLM Behaviors*, Shreya Shankar et al. — the academic grounding for eval design.
- *Anthropic's Building Effective Agents* — the reference for agent architecture patterns.
- *Context Engineering* (Shopify, 2024; see public writeups) — the emerging discipline that elevates context design to first-class engineering.
- *A Survey on Retrieval-Augmented Generation*, multiple authors — RAG ground truth.
