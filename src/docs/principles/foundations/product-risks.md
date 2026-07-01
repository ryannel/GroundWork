---
title: Product Risks
description: The four risks every bet must clear before delivery — value, usability, feasibility, viability — and the discipline of killing the riskiest assumption first.
status: active
last_reviewed: 2026-06-19
---
# Product Risks

## TL;DR

Before we commit to building something, we ask whether it can fail in four distinct ways: will users **want** it (value), can they **figure it out** (usability), can we **build** it well (feasibility), and does it **work for the business** (viability). Discovery exists to kill these risks before delivery starts — cheaply, by testing the riskiest assumption first, rather than expensively, by shipping and finding out. Each risk has a clear owner, and that ownership is how the product, design, and engineering disciplines divide the work without gaps.

## Why this matters

Most failed features did not fail because they were built badly. They failed because nobody asked the right "could this not work?" question early enough. A team that only asks "can we build it?" ships things that work perfectly and that no one uses. A team that only asks "will users like it?" ships things that delight in a prototype and collapse under real load or real economics. The four-risk frame is a checklist against the specific blind spots each discipline has on its own — and running it during discovery means the miss surfaces at week two, on a sketch, instead of at launch, in production.

## Our principles

### 1. Four risks, named explicitly

Every significant bet faces four categories of uncertainty:

- **Value** — will customers choose to use or buy this? Does it solve a problem they actually feel? This is the risk most features die of, and the easiest to wave away with "of course they'll want it."
- **Usability** — can users figure out how to use it? Will they understand it well enough to get the value that is theoretically there?
- **Feasibility** — can we build it with the time, skills, and technology we have? Does the architecture support it, and can we operate it reliably?
- **Viability** — does it work for the *business*? Legal, security, cost, support load, brand, and the commercial model all sit here. A feature can be desirable, usable, and feasible and still be a mistake to ship.

Naming all four forces the question each discipline is prone to skip.

A fifth question lives *inside* viability and deserves its own name: **should we build it at all?** — the ethical risk. Cagan files ethics under viability deliberately, then warns that it is the one viability concern with no natural stakeholder: legal owns legal, finance owns cost, security owns security, but no one is paid to ask whether the feature is good for the user even when it is good for the metrics. That is exactly why it is the most reliably dropped. Name it on purpose, or it goes unowned.

### 2. Discovery exists to kill risk before delivery

The purpose of discovery is not to produce a specification — it is to retire risk. Delivery should begin only once the four risks are low enough that building is the cheapest remaining way to learn. Every assumption we can test with a conversation, a prototype, a proof of concept, or a back-of-envelope cost model is one we should *not* test by shipping. Discovery is the cheap place to be wrong.

This is not a phase that finishes before delivery opens. Discovery and delivery run continuously and in parallel, not as sequential gates — the [dual-track](continuous-discovery.md) shape. "Risks low enough" is a judgement made one load-bearing assumption at a time, not a sign-off on the whole bet; a healthy team is retiring risk on the next bet while it ships the last one. The discipline is that *the specific assumption a piece of delivery rests on* is cleared before that piece is built — not that all discovery everywhere completes before any code is written.

### 3. Test the riskiest assumption first

Not all risk is equal, and the order matters. We surface the assumptions a bet rests on, rank them by how likely they are to be wrong and how much damage a wrong answer does, and test the riskiest one first. If the bet is going to die, kill it on the assumption most likely to kill it — before sinking effort into the assumptions that were never in doubt. Spending discovery on the comfortable questions while the load-bearing one goes untested is how teams feel busy and learn nothing.

"Riskiest" is the product of two axes, not one: how *uncertain* the assumption is (how little evidence we have either way) and how *load-bearing* it is (how much of the bet collapses if it is wrong). An assumption that is uncertain but cheap to be wrong about can wait; an assumption everyone is confident in but that would sink the bet if it failed still deserves a fast check, because confidence is not evidence. Rank on uncertainty × consequence, and test top-down.

### 4. Each risk has an owner

Risk without an owner is risk nobody clears. The accountability splits cleanly across the disciplines:

| Risk | Owner | Discipline |
|---|---|---|
| **Value** | Product | accountable for the outcome |
| **Viability** | Product | accountable for the outcome |
| **Usability** | Design | accountable for the experience |
| **Feasibility** | Engineering / Architecture | accountable for delivery |

Product owns value and viability because both are judgements about whether the outcome is worth pursuing. Design owns usability because it owns the experience. Engineering and architecture own feasibility because they own what is buildable and operable. The owner of a risk is the person who must produce the evidence that it is cleared.

Ownership is accountability for the evidence, not a solo assignment. Discovery is done by the trio — product, design, engineering — working the same problem together; an engineer's feasibility proof of concept routinely surfaces a value insight, and a designer's prototype routinely exposes a feasibility wall. The owner is simply who answers for the risk when it is asked about. Viability makes the distinction sharp: product is accountable, but the evidence comes from legal, security, and finance, so the owner orchestrates the answer rather than producing it alone. The failure mode is not collaboration — it is when no single name answers for a given risk, so each is everyone's job and therefore no one's.

### 5. Match the discovery action to the risk

Each risk is tested differently, and using the wrong instrument wastes the discovery. Value is tested with user evidence — demand signals, interviews, a fake-door, a willingness-to-pay probe, or a live in-production experiment when the change is reversible, flagged, and measured against a control. Usability is tested with prototypes and observed sessions. Feasibility is tested with a proof of concept or an architecture review. Viability is tested by walking the decision past the constraints that bound it — cost model, security posture, legal boundary, support load. A "usability test" that was actually meant to probe value answers the wrong question convincingly.

The instrument must fit the *stakes* as well as the risk. A randomized production experiment with a control group and a metric chosen in advance is a legitimate — often the cheapest — value test for a reversible change. A full launch to everyone with no hypothesis and no control is not a test; it is a bet you have already placed. The difference between the two is not "production or not" — it is whether there is a way to read the result and a way back.

### 6. Low stakes earn a lighter pass

The frame scales to the **stakes** — blast radius × reversibility × the human review the work demands, the bet's size axis defined in [prioritization-and-appetite](prioritization-and-appetite.md) §2. A small-blast-radius, reversible change does not need a four-risk discovery — it needs a quick gut-check and a willingness to undo it. The full, evidence-backed pass is for bets that are hard to reverse, wide in blast radius, or load-bearing for the product. Note that stakes is not effort: a low-effort change to a one-way door is high-stakes and earns the full pass, even when it is fast to build. Running heavy discovery on genuinely low-stakes work is its own failure mode; the discipline is proportionality, not ceremony.

## How we apply this

- The riskiest-assumption-first ordering is the engine of [continuous discovery](continuous-discovery.md) — the opportunity-solution tree's leaves *are* the assumptions this frame ranks and tests.
- Feasibility risk is where product hands off to the [architecture discipline](../system-design/code-structure.md) and the engineer skills; the value/viability judgement stays with product.
- A bet's [appetite](prioritization-and-appetite.md) is set against the risk it carries — a high-value, high-uncertainty bet earns a discovery proof of concept before its delivery appetite is fixed.
- AI-heavy bets stress specific corners of the frame and need the matching evidence early. Feasibility now includes model non-determinism and an evaluation harness, not just "can we call the API." Viability includes per-call inference economics — a feature can be desirable, usable, and feasible and still lose money on every request — plus unsettled data, copyright, and privacy exposure. Value includes whether users trust the output enough to act on it. Probe these in discovery with a quick eval and a cost-per-action model before the appetite is fixed; a demo that ignores tail-case output and unit economics has cleared none of the real risk.

## Anti-patterns we reject

- **The feasibility-only filter.** "Can we build it?" as the only question asked. Produces things that work and that nobody wanted.
- **Validation theatre.** Discovery run to confirm a decision already made, testing the safe assumptions and skipping the one that could kill the bet.
- **Unowned risk.** Four risks and nobody accountable for clearing any specific one — so each is everybody's job and therefore no one's.
- **Shipping to learn, unrigorously.** Using a full production launch as the first test of a high-stakes value question — "we'll see if people use it" — with no hypothesis, no control, and no cheap way back. That is hoping, not learning, and production is the most expensive place to hear no. A reversible, instrumented experiment is the opposite and is welcome; the anti-pattern is the irreversible, unmeasured bet, not learning in production itself.
- **The forgotten viability risk.** A desirable, usable, feasible feature that quietly triples support load, breaks a compliance boundary, costs more to run than it earns, or is good for the metrics and bad for the user. Viability — ethics most of all — is the risk teams most often never name.

## Further reading

- *Inspired* and *Transformed*, Marty Cagan — the four big risks, the discovery techniques that retire them, and the case for treating ethical risk as the unowned corner of viability.
- *The Four Big Risks*, Silicon Valley Product Group — the concise canonical statement of the taxonomy and its ownership.
- *Continuous Discovery Habits*, Teresa Torres — assumption mapping and testing the riskiest assumption first.
- *Updating the Product Risk Taxonomy for the Generative AI Era*, Viget — how each risk shifts for LLM-powered products.
