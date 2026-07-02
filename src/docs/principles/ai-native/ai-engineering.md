---
title: AI Engineering
description: Prompt engineering, evaluations, agent design, RAG, and context engineering.
status: active
last_reviewed: 2026-06-19
---
# AI Engineering

## TL;DR

AI engineering is software engineering with a non-deterministic component in the loop. We treat prompts as code, evaluations as tests, context as a first-class design surface, and agents as distributed systems. The discipline is about making probabilistic systems behave predictably enough to ship.

## Why this matters

Every team that has tried to ship an AI feature has learned the same lesson the hard way: the part that feels like magic in a demo is the part that fails in unpredictable ways in production. The gap between "it works in the playground" and "it works for every user, every day" is where AI engineering happens. The discipline treats the non-determinism as an engineering problem — measurable, testable, and addressable — rather than as an inherent limitation to shrug at.

## Our principles

### 1. Prompts are code

Prompts live in version control, are reviewed in the same PR as any other change, and are versioned against the model they were tuned for. A prompt is an artifact with a target: it is brittle across model versions, and the requirements it leaves *unstated* are exactly the ones that regress when you upgrade. Pin the model, and treat a model upgrade as a change that must clear the evals before it ships. "We tweaked the prompt in the dashboard" is how a team loses the ability to reason about its own AI behaviour.

The contested part is *who* writes the prompt. For a high-volume, measurable task, the best prompt is rarely the one a human hand-tunes. Declarative frameworks (DSPy and its successors) compile a prompt against your eval set — selecting few-shot examples, rewriting instructions to maximize a metric — and beat hand-authoring once you have data to optimize against. The principle is not "humans write clever prompts." It is "the prompt is a versioned, tested artifact," whether a human or an optimizer produced it.

Decision rule: hand-author while the task is exploratory or low-volume; move to a compiled/optimized prompt once you have an eval set worth optimizing against and the task runs often enough to pay for it. Either way, the prompt ships through review and is re-validated on every model change.

### 2. Evals are tests

Every meaningful AI behaviour has an eval: a scored comparison of model output against a reference. Evals run in CI; thresholds are committed; regressions block merge the same way unit-test failures do. Without evals, "did we make the model worse?" is unanswerable, which means every improvement is also a potential regression you will discover from users.

But an eval is only as trustworthy as its grader, and the popular grader — an LLM judging another LLM's output — is itself non-deterministic and biased. LLM judges are systematically overconfident, favour longer and more authoritatively formatted answers, and agree with human raters far less than their fluency suggests (inter-rater agreement on hard tasks sits around Fleiss' κ ≈ 0.3). A judge you have not calibrated against human labels is a vibe with a number attached.

Decision rule: grade with code wherever the output is checkable — schema, exact match, contains, numeric range — because those checks are deterministic and free. Reserve the LLM judge for genuinely subjective qualities, and before trusting it as a merge gate, measure its agreement with human labels on a held-out set and recalibrate when you change judge models. Set thresholds with a noise band: a one-point move inside the judge's own variance is not a regression, and blocking on it just trains the team to rerun CI until it passes.

### 3. Context is the interface

The content of the context window — system prompt, few-shot examples, retrieved documents, tool outputs — is the single biggest lever on model behaviour. The goal is not the *most* relevant context; it is the smallest set of high-signal tokens that produces the behaviour you want. More tokens is not more help: as the window fills, recall degrades — *context rot*, a gradient rather than a cliff, rooted in the n² attention budget — so every token you add dilutes the ones that mattered.

"Throw in everything relevant" is the anti-pattern that blows up the bill and *lowers* quality — measure the token budget the way you would measure any other eval dimension. Managing that budget over a session's lifecycle — just-in-time retrieval, compaction, offloading — is architecture, covered in [Agentic Systems](agentic-systems.md) §3.

### 4. Retrieval matters more than the model

For a knowledge-grounded system, the retrieval layer sets the ceiling. A clever model with bad retrieval gives confident nonsense; a boring model with good retrieval gives boring, correct answers. Invest in retrieval quality — chunk boundaries, indexing, ranking, reranking — before you reach for a bigger model.

The honest tension: long-context models and "just put it all in the prompt" make naive RAG look obsolete, and for a small or stable corpus, loading the documents directly is simpler and often better. But long context is neither free nor reliable at scale — it pays the context-rot tax, and for repeated queries over a large corpus, retrieval is cheaper and lower-latency by a wide margin. The field has not abandoned retrieval; it has moved past the naive 2023 top-k pipeline toward *agentic retrieval*, where the model issues, critiques, and refines its own searches as a loop.

Decision rule: small or stable corpus that fits comfortably in context → load it directly and skip the retrieval stack. Large, changing, or cost-sensitive corpus → retrieve, and treat retrieval as a first-class system with its own evals (recall@k, not just end-to-end answer quality). Reach for agentic retrieval when a single query cannot express the information need — multi-hop questions, ambiguous asks, corpora that require exploration. Either way, what kills the system is bad retrieval, not a slightly weaker model.

### 5. Model outputs are validated at the boundary

Every model output that crosses into code is validated: shape, length, content, and expected enumerations. Parse failures are handled explicitly, never allowed to propagate. If you need a number, demand it in a structured schema; do not regex it out of prose.

Validation is also a security boundary, not only a correctness one — every model output, and every tool result the model reads, is untrusted input, because anything in the context window can carry an instruction. Budget the trifecta: see [Security](../quality/security.md) §9.

### 6. Agents are distributed systems

An agent loop — model plans, model takes action, agent observes, model re-plans — has all the problems of a distributed system: retries, idempotency, timeouts, failure isolation. We apply the same patterns ([Integration Patterns](../system-design/integration-patterns.md)): bounded retries, circuit breakers, auditable history. The hardest agent failures are system failures, not model failures. The single-agent-versus-multi-agent topology decision, and how to price fan-out, is [Agentic Systems](agentic-systems.md) §1.

### 7. Cost is part of the evaluation

A configuration that is 10% better but 5× more expensive is not obviously better. Evals track quality, latency, *and* cost, and the ship decision weighs all three. This matters more, not less, as token prices fall: reasoning models and agent loops spend tokens by the multiple, so the cost of a feature is now dominated by how many times it calls the model, not the sticker price per token. Budget cost per *task*, not per call, and let the eval surface the configuration that is good enough at a price you can defend ([Cost Engineering](../delivery/cost-engineering.md)).

### 8. Human oversight is designed in

For high-stakes AI outputs — content a user will act on, actions taken on their behalf — design the review point deliberately. The reviewer gets a summary calibrated to the decision, not a wall of raw output; the review UX is built alongside the AI feature, not retrofitted.

Decision rule: place the human gate by stakes × reversibility. Cheap, reversible actions can run unattended with logging; expensive or irreversible ones — sending money, deleting data, messaging the outside world — get a gate, and per the trifecta budget above that gate is mandatory once an agent touches private data and the outside world at once. "Let the model do it" without a review loop is a promise the model will eventually break.

## How we apply this

- [Agent-Native Systems](agent-native-systems.md) — the flip side, making our interfaces consumable by agents.
- [Agentic Systems](agentic-systems.md) — the agent-loop topology and context-lifecycle discipline this page assumes.
- [Observability](../quality/observability.md) — the trace surface for model calls.
- [Security](../quality/security.md) — the lethal-trifecta / Rule-of-Two budget that governs untrusted model output.
- [Testing](../foundations/testing.md) — the broader testing discipline evals sit inside.

## Anti-patterns we reject

- **"The model will figure it out."** Hope is not a design.
- **Prompts as configuration.** Untracked prompts drift silently, and evals cannot catch drift they are not told about.
- **Over-stuffed context windows.** Throwing the kitchen sink at the model is usually how quality *decreases*, not increases.
- **An LLM judge you never checked against humans.** A confident grader that disagrees with people is worse than no grader — it automates the wrong call at scale.
- **Trusting tool output as if it were your own code.** Everything in the context window is potentially adversarial input.
- **Skipping evals "this once."** This once becomes always. Evals compound when you have them and compound against you when you do not.
- **Agent loops without termination.** A loop without a clear exit condition is how a runaway agent becomes a runaway bill.
- **Deterministic reasoning on top of probabilistic output.** If you need a number, ask for a number in a structured schema. Do not regex-extract it from prose.

## Further reading

- *Prompt Engineering Guide* ([promptingguide.ai](https://www.promptingguide.ai)) — the practitioner's summary of current patterns.
- Anthropic, *Building Effective Agents* — the reference for agent architecture patterns, single- and multi-agent.
- Anthropic, *Effective Context Engineering for AI Agents* — context rot, just-in-time retrieval, compaction, and sub-agent context isolation.
- Shreya Shankar et al., *Who Validates the Validators?* (2024) — aligning LLM-as-judge evaluation with human preferences.
- Simon Willison, *The Lethal Trifecta for AI Agents* (2025) — the security model for agents with data and tool access.
- Gao et al., *Retrieval-Augmented Generation for Large Language Models: A Survey* — RAG ground truth.
- *DSPy* (Stanford NLP) — declarative, compiled prompts as an alternative to hand-tuning.
