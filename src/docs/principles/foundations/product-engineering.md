---
title: Product Engineering
description: Engineering in service of user outcomes — shaped work, appetite-based planning, and the refusal to ship the wrong thing faster.
status: active
last_reviewed: 2026-06-19
---
# Product Engineering

## TL;DR

We are product engineers before we are coders. Our job is to move outcomes — not to ship tickets. Work is shaped before it is scheduled, scheduled against a fixed appetite rather than an estimate, and judged by the behaviour it changes rather than the volume of code it produces.

## Why this matters

The dominant failure mode of engineering teams is not technical debt — it is building the wrong thing well. John Cutler's "feature factory" and Melissa Perri's "build trap" name the same trap: a team optimises cycle time and output velocity until the product surface grows faster than the value it delivers, and "shipped" quietly replaces "worked" as the definition of done.

AI sharpens this, it does not soften it. When generating code is nearly free, the binding constraint moves from *can we build it* to *should we, and did it work*. The 2024 and 2025 DORA reports found that AI adoption raised individual throughput but correlated with **lower delivery stability** — larger batch sizes, more code in flight, more ways to be wrong — because friction "doesn't vanish so much as move: from manual grind to deciding and verifying." Product engineering is the discipline that holds the line where the friction now lives: the unit of work is an outcome, the unit of planning is an appetite, and the test of a change is whether someone — a user, an operator, the next engineer — can feel the difference.

## Our principles

### 1. Outcomes over outputs

An "output" is a feature shipped, a ticket closed, a migration completed. An "outcome" is, in Josh Seiden's phrase, a change in behaviour that drives results — what a user can now do, how fast they can do it, how reliably the system holds them up. We plan around outcomes and let outputs be whatever shape delivers them.

The honest qualifier: outcomes are not always user-visible, and treating "no user-facing change this sprint" as failed work is wrong. Security patching, a load-bearing refactor that unblocks the next three features, paving a platform path that removes friction for internal developers — these move real outcomes (a class of incident disappears, an operator sleeps, a team ships faster) without a single end user noticing. Platform teams are measured this way on purpose: by adoption and friction removed, not deliverables counted.

So the failure mode is not "invisible to users." It is **output that traces to nothing**: work whose only justification is the ticket it closes. Decision rule: before work is scheduled, name the behaviour change and who experiences it — end user, internal developer, or operator. If no one can name it, the work is unjustified, not merely unshippable.

### 2. Shape work before scheduling it

No work enters a cycle without being *shaped*: the problem stated in user terms, the rough solution sketched, the boundaries drawn to exclude rabbit holes. Shaped work is expensive upfront and cheap downstream. Unshaped work is the single biggest source of mid-cycle drift, scope creep, and late discovery that the whole approach was wrong.

Shaping is bounded on both sides. Too vague and the team inherits the unsolved problem; too concrete and it is waterfall wearing a friendlier name — a finished design handed down, with no room for the people building it to make the hundred small calls only visible from inside the code. Shape Up's altitude is deliberate: concrete enough to bound the work, abstract enough to leave the build to the builders.

You can only shape what you understand. Decision rule: shape when you know the problem well enough to bound the solution; when you do not — novel domain, unproven technical approach — the move is a time-boxed proof of concept to *buy* that understanding, not a confident shape built on guesses. AI has made a throwaway prototype cheap enough that "shape by building a proof of concept and discarding it" is now often faster than shaping on paper.

### 3. Appetite, not estimate

We set an *appetite* — a statement of how much a problem is worth solving, judged by opportunity cost and denominated in worth rather than effort — and design a solution that fits inside it. If it cannot fit, we reduce scope or reject the work. This inverts the usual flow: an estimate starts with a fixed solution and ends with a number; an appetite starts with the number and ends with a solution.

Appetite does not abolish estimation everywhere: a partner-integration deadline, a compliance date, a contractual SLA demand a real estimate and a real date, and the appetite must respect them as a constraint. Decision rule: appetite governs discretionary product bets, which is most of the portfolio; estimate where a hard external date or dependency exists, and feed that estimate in as a boundary. The full appetite doctrine — worth as the denomination, why AI destabilized effort as a sizing proxy, and how *stakes* sizes a bet separately from worth — lives in [Prioritization & Appetite](prioritization-and-appetite.md).

### 4. Kill your darlings

If a feature is not moving an outcome, we remove it. Deletion is the most under-used tool in a product engineer's kit. Every line of code, every doc page, every dashboard tile, every CLI flag that does not pay its maintenance cost is a candidate for the cut. A smaller, sharper product is cheaper to operate and easier for the next engineer to understand.

Removal has its own cost, and the test is the *net* one. For anything with external surface, Hyrum's Law holds: with enough users, every observable behaviour is depended on by someone, so a hard cut breaks callers and burns trust faster than the cruft ever cost you. Decision rule: internal-only cruft, just delete it; anything users observe or script against goes through deprecate → measure usage → remove, and stays if the migration cost outweighs the carrying cost. The discipline is to default to deletion and make *keeping* earn its place — not to delete blind.

### 5. Instrument what you ship

We decide the signal *before* we ship — event, threshold, success criterion — and we check it after release. A feature whose effect no one watches is a feature no one owns.

Instrumentation is not the same as quantification, and conflating them produces dashboards that decorate rather than inform. Some outcomes resist a clean number — trust, perceived quality, a rare catastrophic failure avoided. For those the signal is qualitative (interview themes, support-ticket clusters) or a tripwire (a counter-metric that fires when you have made something worse), not another tile. So the real bar is not "measurable" — it is *owned and falsifiable*. Decision rule: before shipping, name the signal **and** the evidence that would make you reverse course. If you cannot say what would change your mind, you are not measuring, you are decorating. And measure the outcome, not the act of shipping — the 2025 DORA finding is that individual throughput gains evaporate at the org level unless they are tied back to a business result. More dashboards is not more insight; one honest counter-metric beats ten vanity lines.

## The product discipline

This page is the spine of a wider product corpus — the discipline of moving outcomes, expanded into its working parts:

- [Continuous Discovery](continuous-discovery.md) — mapping the problem space as a weekly habit, before choosing a solution.
- [Product Risks](product-risks.md) — the four risks (value, usability, feasibility, viability) a bet must clear, and who owns each.
- [Success Metrics](success-metrics.md) — designing the measure of an outcome: North Star, leading indicators, counter-metrics.
- [Requirements & Specs](requirements-and-specs.md) — turning validated needs into testable, evidence-grounded statements.
- [Prioritization & Appetite](prioritization-and-appetite.md) — the portfolio view: choosing and sequencing bets by opportunity cost.
- [AI-Native Product](../ai-native/ai-native-product.md) — product practice for probabilistic systems: evals, the outcome envelope, the three cost layers.

## How we apply this

- [Progressive Delivery](../delivery/progressive-delivery.md) — canaries and flags are the mechanism by which we measure outcomes safely.
- [Observability](../quality/observability.md) — the signal layer that makes outcome-based engineering possible.
- [Decisions](../system-design/architecture-decisions.md) — the record of shaping decisions that cost us real time.

## Anti-patterns we reject

- **Velocity-as-KPI.** Story points per sprint measure nothing about user outcomes. Optimising for it corrupts the team — and with AI inflating raw output, it corrupts faster.
- **Estimate-driven planning.** Estimates anchor on how long the team thinks work will take, not on how much it is worth. We use appetites for discretionary work, and reserve estimates for hard external dates.
- **"Build it and they will come."** Launching without a signal — and without naming what would make you walk it back — means no one owns the outcome.
- **Technical-debt-for-its-own-sake projects.** Refactors with no payoff anyone can name are a smell. Tie them to the outcome they enable — faster delivery, fewer incidents, lower carrying cost — and that outcome is the justification.
- **Big-design-up-front in a shaping costume.** A fully specified solution handed down with no room for the builders is waterfall, whatever the cycle is called.

## Further reading

- *Shape Up*, Ryan Singer — the canonical treatment of shaped work and fixed appetites.
- *Inspired*, Marty Cagan — the product-engineering triad and its implications for how teams are built.
- *Escaping the Build Trap*, Melissa Perri — why feature-factory metrics corrupt outcomes.
- *Outcomes Over Output*, Josh Seiden — the working definition of an outcome as a change in behaviour.
- "12 Signs You're Working in a Feature Factory," John Cutler — the field guide to the failure mode this discipline resists.
- *State of DevOps* (DORA), 2024 and 2025 reports — the evidence that AI raises throughput while pressuring stability, and that gains must be tied to outcomes to count.
- "Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity," METR (2025) — why execution time under AI is unpredictable, not uniformly faster.
