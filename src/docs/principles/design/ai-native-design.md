---
title: AI-Native Design
description: Designing the outcome envelope of probabilistic and generative interfaces — latency, uncertainty, graceful failure, calibrated autonomy, and the human on the dial.
status: active
last_reviewed: 2026-06-20
---
# AI-Native Design

## TL;DR

A probabilistic feature is a distribution of outputs, not a single answer, and the interface has to be designed for that whole distribution — the wrong answer first, the uncertain answer honestly, the slow answer as a designed wait. Latency is a first-class design material. Confidence is communicated without false precision. Failure is the expected path, designed before the happy one. The human stays on the dial: action is previewed, scoped to reversibility and severity, and reversible. Chat is one tool among many, not the universal interface.

## Why this matters

The core failure of AI features is a probabilistic engine wrapped in a deterministic interface that presents a guess as truth. Models are systematically overconfident, hallucinate at non-trivial rates, and return different output for the same input — so an interface that renders a single confident answer, hides its uncertainty, and offers no cheap correction sets the user up to over-trust and then lose trust entirely on the first error. Designing for AI is the discipline of making the probabilistic nature legible and controllable: showing the range, the confidence, the sources, and the off switch, so the user can collaborate with an uncertain system instead of being surprised by it.

## Our principles

### 1. Design the outcome envelope, not one happy path

A probabilistic feature is designed for the distribution of what it might produce, not a single mocked result, because the designer no longer controls the exact rendered output. We vary the treatment by likelihood of intent — more persuasion and framing where confidence is low, less friction where it is high — prefer ranges and windows over false-precise points, and plan explicit fallback states for degrading confidence. Because ideation is cheap with these systems, requesting and presenting multiple candidates is often the right default.

### 2. Latency is a first-class design material

We optimise time-to-first-token and stream output immediately, because streaming removes the wait-for-completion delay even though it does not speed the model, and perceived speed is the metric that matters. Anything beyond ~1s shows structured progress, users can act on partial output rather than waiting for the whole, and streaming content is parsed incrementally to avoid re-rendering the entire response on every chunk. An unindicated wait past roughly ten seconds collapses satisfaction.

### 3. Communicate confidence without false precision

We prefer calibrated categorical confidence (high / medium / low) and first-person hedging at the point of the claim, reserving numeric scores for high-stakes domains with genuinely comparable predictions, because a single definitive score drives over-reliance and then trust collapse while a spurious percentage implies precision the model does not have. We do not amplify the model's default overconfidence; where the system is uncertain, the interface says so plainly.

### 4. Ground claims in sources, and surface the gaps

Where a feature makes factual claims, citations are assembled during generation from the retrieval context, not grafted on afterwards, and they cite at the passage level rather than the document, because in-context citation is more reliable and document-level pointers do not let the user verify the claim. Sources are layered — preview, click-through, full list — and a missing or broken source is surfaced explicitly, because a citation creates a halo that lowers user vigilance, so a gap must be shown rather than hidden.

### 5. Design the wrong answer first

We treat incorrect output as the norm and design that flow before the happy path: unpredictable output is sandboxed to a designated region so it cannot break the deterministic parts of the UI, doubt is marked in context at the claim rather than buried in a global "AI can make mistakes" disclaimer that habituates into ignored noise, and correction is made cheap with the feedback routed back to improve the system. Unverified output is never fed straight into an irreversible downstream action.

### 6. Keep the human on the dial: gate by reversibility and severity

Autonomy is a slider the user controls, not a default of maximal automation. We gate on reversibility crossed with severity — irreversible, high-severity actions (send, charge, delete, deploy) require pre-approval; reversible, high-severity actions get human oversight with a rollback window; reversible, low-severity actions run autonomously — and the agent's reasoning is visible at the gate, because an action the user cannot preview feels like a surprise they did not consent to. Gating everything is its own failure: alert fatigue turns approval into rubber-stamping.

### 7. Make regeneration and steering first-class, non-destructive

We offer both a one-click retry and guided regeneration that nudges style or parameters before re-running, and we choose deliberately between overwriting (convergent chat) and branching (explicit comparison), because plain regeneration trades precision for variation while guided and branching flows recover control. Prior outputs are never silently destroyed, and where reproducibility matters the determinism lever (the seed) is exposed.

### 8. Chat is one tool, not the universal interface

Chat became the default because it was the easiest thing to ship, not because it is the right interface for most tasks: a bare text box has no affordances, hides the system's capabilities, and forces constant mode-switching between instructing and evaluating. Most AI features are better as embedded, affordance-rich tools — highlight-to-rephrase, context-menu actions, ambient background agents — with conversation reserved for genuinely open-ended dialogue and paired with a persistent, directly manipulable surface (a canvas) where the user edits in place rather than through the chat turn. We design for control and legibility — copilots, not captains — over "magic" full autonomy.

## How we apply this

- [AI-Native Product](../ai-native/ai-native-product.md) — the product framing: evals, the outcome envelope, and the cost layers this design sits within.
- [Interaction & Motion](interaction-and-motion.md) — streaming, partial-result, and perceived-performance patterns for probabilistic output.
- [Design Systems & Tokens](design-systems-and-tokens.md) — grounding generative UI in the system so the model builds on-system components.
- [Usability & UX](usability-and-ux.md) — recognition over recall and progressive disclosure applied to AI affordances.

## Anti-patterns we reject

- **A guess presented as truth.** A single confident answer with no confidence signal, no sources, and no cheap correction.
- **The blocking wait.** Holding the whole response until generation completes instead of streaming and showing progress.
- **False precision.** Spurious percentage confidence implying accuracy the model does not have, amplifying its default overconfidence.
- **Retrofitted citations.** Document-level references grafted on after generation, which the user cannot use to verify a claim.
- **The global disclaimer.** One "AI can make mistakes" line standing in for in-context doubt and cheap correction.
- **Approve-everything autonomy.** Either gating every action into rubber-stamping, or auto-running irreversible actions with no preview.
- **Chat as the answer to everything.** Defaulting to a chat widget where an embedded, affordance-rich tool would serve the task better.

## Further reading

- Nielsen Norman Group, *AI Hallucinations* and the AI-UX article corpus.
- Google PAIR, *People + AI Guidebook* — errors, failing gracefully, and explainability.
- *Shape of AI* (shapeof.ai) — the emerging pattern language: citations, confidence, regeneration.
- Maggie Appleton and Amelia Wattenberger — beyond the chatbox: ambient, embedded, and malleable AI interfaces.
