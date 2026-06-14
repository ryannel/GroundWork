---
title: Product Risks
description: The four risks every bet must clear before delivery — value, usability, feasibility, viability — and the discipline of killing the riskiest assumption first.
status: active
last_reviewed: 2026-06-14
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

### 2. Discovery exists to kill risk before delivery

The purpose of discovery is not to produce a specification — it is to retire risk. Delivery should begin only once the four risks are low enough that building is the cheapest remaining way to learn. Every assumption we can test with a conversation, a prototype, a spike, or a back-of-envelope cost model is one we should *not* test by shipping. Discovery is the cheap place to be wrong.

### 3. Test the riskiest assumption first

Not all risk is equal, and the order matters. We surface the assumptions a bet rests on, rank them by how likely they are to be wrong and how much damage a wrong answer does, and test the riskiest one first. If the bet is going to die, kill it on the assumption most likely to kill it — before sinking effort into the assumptions that were never in doubt. Spending discovery on the comfortable questions while the load-bearing one goes untested is how teams feel busy and learn nothing.

### 4. Each risk has an owner

Risk without an owner is risk nobody clears. The accountability splits cleanly across the disciplines:

| Risk | Owner | Discipline |
|---|---|---|
| **Value** | Product | accountable for the outcome |
| **Viability** | Product | accountable for the outcome |
| **Usability** | Design | accountable for the experience |
| **Feasibility** | Engineering / Architecture | accountable for delivery |

Product owns value and viability because both are judgements about whether the outcome is worth pursuing. Design owns usability because it owns the experience. Engineering and architecture own feasibility because they own what is buildable and operable. The owner of a risk is the person who must produce the evidence that it is cleared.

### 5. Match the discovery action to the risk

Each risk is tested differently, and using the wrong instrument wastes the discovery. Value is tested with user evidence — demand signals, interviews, a fake-door, a willingness-to-pay probe. Usability is tested with prototypes and observed sessions. Feasibility is tested with a spike, a proof of concept, or an architecture review. Viability is tested by walking the decision past the constraints that bound it — cost model, security posture, legal boundary, support load. A "usability test" that was actually meant to probe value answers the wrong question convincingly.

### 6. Low stakes earn a lighter pass

The frame scales to the stakes. A small, reversible, low-cost change does not need a four-risk discovery — it needs a quick gut-check and a willingness to undo it. The full, evidence-backed pass is for bets that are expensive to build, hard to reverse, or load-bearing for the product. Running heavy discovery on trivial work is its own failure mode; the discipline is proportionality, not ceremony.

## How we apply this

- The riskiest-assumption-first ordering is the engine of [continuous discovery](continuous-discovery.md) — the opportunity-solution tree's leaves *are* the assumptions this frame ranks and tests.
- Feasibility risk is where product hands off to the [architecture discipline](../system-design/hexagonal-architecture.md) and the engineer skills; the value/viability judgement stays with product.
- A bet's [appetite](prioritization-and-appetite.md) is set against the risk it carries — a high-value, high-uncertainty bet earns a discovery spike before its delivery appetite is fixed.

## Anti-patterns we reject

- **The feasibility-only filter.** "Can we build it?" as the only question asked. Produces things that work and that nobody wanted.
- **Validation theatre.** Discovery run to confirm a decision already made, testing the safe assumptions and skipping the one that could kill the bet.
- **Unowned risk.** Four risks and nobody accountable for clearing any specific one — so each is everybody's job and therefore no one's.
- **Shipping to learn.** Using production as the first test of value because "we'll see if people use it." The most expensive possible place to discover the answer is no.
- **The forgotten viability risk.** A desirable, usable, feasible feature that quietly triples support load, breaks a compliance boundary, or costs more to run than it earns. Viability is the risk teams most often never name.

## Further reading

- *Inspired*, Marty Cagan — the four big risks and the discovery techniques that retire them.
- *The Four Big Risks*, Silicon Valley Product Group — the concise canonical statement of the taxonomy and its ownership.
- *Continuous Discovery Habits*, Teresa Torres — assumption mapping and testing the riskiest assumption first.
