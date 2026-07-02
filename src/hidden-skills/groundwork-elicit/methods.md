# Elicitation Methods

The curated technique table `groundwork-elicit` selects from. Each technique is a structured way to make a draft section's reasoning do work it has not yet done. "Best for" names the document and section shapes where the technique earns its cost — match the diagnosis to the shape, not the name.

---

## Sharpen the Reasoning

Techniques that test whether a section's logic actually holds.

| Technique | What it does | Best for |
|---|---|---|
| First Principles Analysis | Strips the section to its fundamental truths and rebuilds it, discarding inherited assumptions along the way. | Capability descriptions and architecture decisions that read like defaults nobody chose. |
| 5 Whys | Asks why repeatedly until the stated problem bottoms out at its root cause. | Problem statements in briefs and bet pitches that describe a symptom. |
| Socratic Questioning | Probes the section with targeted questions until its hidden assumptions surface and answer for themselves. | Target users, NFRs, and constraints written from instinct rather than evidence. |
| Critique and Refine | Names the section's strengths and weaknesses explicitly, then rewrites to keep the former and fix the latter. | The general-purpose pass — any section that is thin but not wrong in a nameable way. |
| Second-Order Thinking | Traces each decision past its immediate effect into the cascade it triggers downstream. | Key Decisions, technology choices, and any constraint other phases will inherit. |
| Inversion Analysis | Asks what would guarantee this section's failure, then checks the section against that list. | Success indicators, rollout plans, and appetite sections that only describe winning. |
| Steelmanning | Builds the strongest possible case for the rejected alternative before letting the chosen one stand. | ADRs and trade-off sections where the losing option got a strawman's hearing. |
| Analogy Mapping | Borrows the structure of a well-understood parallel domain and tests the section against it. | Experience sections and novel interaction models with no direct precedent to lean on. |
| Problem Decomposition | Splits a tangled section into independent parts, resolves each, and reassembles. | Oversized capabilities and monolithic data flows hiding several decisions in one paragraph. |
| Occam's Razor | Finds the simplest design that still satisfies the section's requirements and asks what the extra complexity buys. | Topology, tooling, and process sections that have quietly over-engineered themselves. |

## Reframe the Altitude

Techniques that test whether the section is answering the right question at the right level.

| Technique | What it does | Best for |
|---|---|---|
| Abstraction Laddering | Moves the section up ("why?") toward strategy or down ("how?") toward mechanics until it sits at the altitude its document demands. | Brief sections drifting into implementation; technical designs drifting into vision. |
| Reframe the Question | Challenges whether the stated problem is the real problem — a better framing often dissolves a hard section. | Problem statements and bet pitches that feel laboured despite heavy revision. |
| Stakeholder Lens Rotation | Re-reads the section through each stakeholder's eyes in turn, recording what each one finds missing. | Target users, interface designs, and error choreography written from a single default user. |

## Stress-Test

Techniques that attack the section to find where it breaks.

| Technique | What it does | Best for |
|---|---|---|
| Pre-mortem Analysis | Assumes the plan failed, narrates how, and works backwards into the section's blind spots. | Bet pitches, MVP scope, and rabbit-hole sections before appetite is committed. |
| Failure Mode Analysis | Walks each component of the section asking how it fails and what catches it. | Data flows, service boundaries, and interface state coverage (error, empty, degraded). |
| Assumption Audit | Lists every assumption under the section, rates each by confidence and impact, and stress-tests the weakest. | Downstream Context files, binding constraints, and technical design foundations. |
| Cascading Failure Simulation | Triggers one failure and traces its propagation through dependencies to expose hidden coupling. | Topology and communication-pattern sections claiming services are independent. |
| Boundary & Edge Case Sweep | Systematically pushes inputs to extremes — zeros, nulls, maximums, malformed shapes — and records what the section says happens. | API contracts, data schemas, and any interface section specified only for the happy path. |

## Compare Alternatives

Techniques that test a decision by making it compete.

| Technique | What it does | Best for |
|---|---|---|
| Tree of Thoughts | Develops several genuinely different approaches in parallel, then evaluates and selects with stated criteria. | Service boundaries, shell layouts, and decisions where one option was assumed rather than chosen. |
| Self-Consistency Validation | Derives the section's conclusion again from scratch by an independent route and compares the answers. | High-stakes numbers and budgets — performance targets, appetite sizing, capacity claims. |
| Comparative Analysis Matrix | Scores the candidate options against explicit weighted criteria so the choice's reasoning becomes inspectable. | Technology selections and vendor choices currently justified by a single adjective. |

## Change the Room

Techniques that bring voices into the section that its drafting conversation never heard.

| Technique | What it does | Best for |
|---|---|---|
| Stakeholder Round Table | Convenes the document's own personas to react to the section and argue their competing interests to a synthesis. | Capability priorities and scope boundaries balancing more than one user type. |
| Cross-Functional War Room | Puts product, engineering, and design at the same table to surface feasibility–desirability–viability trade-offs. | Interface designs and MVP scope where one discipline's concerns wrote the section alone. |
| Shark Tank Pitch | Pitches the section to skeptical investors who poke holes until the value claim is forced into clarity. | System purpose statements and bet pitches that have only ever heard agreement. |
| Red Team vs Blue Team | Attacks the section as an adversary while defending it as its owner, then hardens what the attack exposed. | Trust models, auth decisions, and any security-bearing boundary or contract. |
