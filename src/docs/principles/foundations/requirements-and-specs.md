---
title: Requirements & Specs
description: Evidence-grounded, testable specification — jobs-to-be-done, user journeys, stable-ID requirements, acceptance criteria matched to their form, and explicit non-goals.
status: active
last_reviewed: 2026-06-19
---
# Requirements & Specs

## TL;DR

A requirement is a claim about what a user needs to accomplish, grounded in evidence and stated precisely enough to be tested. We frame needs as **jobs to be done**, walk them as concrete **user journeys**, pin each requirement to a **stable ID** so downstream artifacts can reference it, and write acceptance criteria in whatever form makes "done" unambiguous and verifiable. The specification is a living, evidence-backed record of decisions — and the source of truth a builder, human or agent, works from — not a template filled in to look thorough.

## Why this matters

Requirements are where product thinking becomes something an engineer, an agent, or a test can act on — and where it most often goes wrong. A spec that lists features instead of jobs builds the wrong thing precisely. A spec with vague acceptance criteria ("the system should handle errors gracefully") cannot drive a test or settle an argument about whether the work is finished. A spec produced by filling a template rather than by understanding the user reads as complete and is hollow. Precise, testable, evidence-grounded requirements are the contract between knowing what to build and building it.

This matters more, not less, as agents do the building. A model does pattern completion, not mind reading: a vague spec is not refused, it is answered — with a thousand silent assumptions the model invents to fill the gaps. The precision the spec withholds is the precision the build makes up. In an agent-led codebase the spec is read as literally as code, which is the discipline behind spec-driven development (the loop popularised by tools like GitHub's Spec Kit, AWS Kiro, and BMAD): need → spec → plan → tasks → code, with the spec as the artifact every later stage resolves against.

## Our principles

### 1. Requirements describe jobs, not features

We state what the user is trying to accomplish — the **job to be done** — before naming any feature that serves it. A job is the progress a user is trying to make in a situation ("when I finish a task, I want to know it actually completed, so I can move on without checking back"), with its functional, emotional, and social dimensions. Features are solutions to jobs; leading with the feature skips the step where we check the solution actually fits the job. The job is stable; the feature that serves it is negotiable.

### 2. Walk the journey, do not list the screens

A user journey is a narrative with structure: a named persona in a context, the state they enter from, the concrete path of steps they take, the moment value is delivered and how they know, and the state they are left in. Walking the journey end to end surfaces the gaps a feature list hides — the empty state, the error halfway through, the second-time-through shortcut. We describe journeys with enough texture that a reader can picture the shape of the interaction, not just enumerate its steps.

### 3. Stable IDs make requirements referenceable

Every functional requirement carries a stable, globally unique ID (`FR-1`, `FR-2`, …) assigned once and never reused. The ID is what lets a design doc, an architecture decision, a test, and an acceptance criterion all point at the *same* requirement without ambiguity, and what lets a coverage map prove every requirement is accounted for downstream. Requirements identified only by prose drift apart the moment two documents describe the same thing in different words.

What does not earn its place is the heavyweight traceability matrix — a hand-maintained, bidirectional grid linking every requirement to every artifact — which rots faster than it informs and is the ceremony agile rightly walked away from. The ID is cheap; the discipline is to reference it, and to let tooling, not a clerk, maintain the links. The payoff scales with how literally the spec is consumed: in a regulated domain that must evidence coverage, or an agent-led codebase where a model resolves `FR-7` against the spec the way it resolves a symbol against its definition, a stable ID is load-bearing; on a two-person throwaway prototype it is overhead. Carry the IDs; skip the matrix.

### 4. Acceptance criteria are testable — match the form to the criterion

Acceptance criteria exist to make "done" unambiguous and verifiable. The form serves that goal; it is not the goal. We match the form to the criterion:

- **Stateful behaviour and flows → Given/When/Then.** Given (precondition) / When (action) / Then (observable outcome), with And for extra conditions. The form forces you to name the starting state, the trigger, and the observable result — and a scenario you cannot fill in is usually one you do not yet understand.
- **Invariants, validation, and business rules → a rules-based checklist.** "An order total is never negative"; "an email contains exactly one @". Forcing a flat rule into Given/When/Then adds ceremony and buries the rule; a bullet leaves less room to misread and is sharper against scope creep.
- **Quality attributes → measurable thresholds.** Latency, throughput, accessibility, error budgets are not prose ("fast", "reliable") but numbers: "p95 search latency under 200ms at 1k RPS." A threshold is the only non-functional criterion a test can fail.

The over-certain version of this principle — "anything that isn't Given/When/Then isn't concrete enough" — is wrong, and it pushes teams into the BDD trap: a parallel Gherkin-plus-step-definition layer maintained for its own sake, brittle and expensive, where the prose outlives the value. The criterion is the contract; the automation is downstream of it. Whatever the form, every criterion is independently verifiable, covers the edge and error cases — not just the happy path — and "done" means every one passes, nothing softer.

### 5. Non-goals are part of the specification

What a requirement explicitly does *not* cover is as load-bearing as what it does. We state non-goals and out-of-scope boundaries directly, with the reason and where the excluded thing belongs instead. The natural extensions a reader would assume — the adjacent feature, the obvious generalisation — are exactly what must be named as excluded, or scope creeps one reasonable assumption at a time. An explicit boundary is what makes the scope honest.

### 6. The spec is a living record, not a template fill

A specification earns its sections; it does not fill them to look complete. We add the sections the product needs, drop the ones that do not apply, and keep the document current as decisions change — surfacing assumptions explicitly (`[ASSUMPTION]`) so they can be confirmed rather than buried. A PRD generated by walking a template top to bottom, padding every heading, is the artifact this principle exists to prevent: it reads thorough and conveys nothing that was not already obvious.

Living also means reconciled. When the code and the spec disagree, one of them is a defect — and a spec left to drift is worse than no spec in an agent-led codebase, because the agent trusts it literally and builds to the lie. Keeping the spec true to the system is part of the build, not paperwork after it.

### 7. Requirements are grounded in evidence

Every requirement traces to a reason it exists — a user need observed in discovery, a job confirmed in a conversation, a problem with evidence behind it. A requirement that traces only to someone's preference is a candidate to cut. Grounding requirements in evidence is what connects the spec back to [continuous discovery](continuous-discovery.md): the spec is where validated needs become buildable statements, not where new unvalidated ones get smuggled in.

## How we apply this

- Requirements emerge from validated needs — the jobs and opportunities surfaced in [continuous discovery](continuous-discovery.md), not from a brainstorm of features.
- Each requirement names its [success metric](success-metrics.md) where one applies, so the spec carries its own definition of whether it worked.
- The spec is the source of truth the build runs on, not a document read once and abandoned: need → spec → plan → tasks → code, with each later stage derived from the spec rather than re-inventing it. When an agent or engineer needs a decision the spec does not make, that gap is a spec defect to fix, not an assumption to bury in code.
- Stable-ID requirements and form-matched acceptance criteria are what let the [architecture discipline](../system-design/api-design.md) derive contracts and tests from the spec rather than re-interpreting prose — requirements and contracts share the same source-of-truth discipline.

## Anti-patterns we reject

- **Template-fill PRDs.** Every heading padded to look complete, conveying nothing the team did not already know. The template is a checklist, not the thinking.
- **Feature lists masquerading as requirements.** Solutions enumerated with no job behind them, so nobody can tell whether they fit the need.
- **Untestable acceptance criteria.** "Works well," "handles errors gracefully," "is intuitive" — none can pass or fail a test, so none can settle whether the work is done.
- **Form over substance.** Cramming every criterion into Given/When/Then — or maintaining a Gherkin-and-step-definition layer for its own sake — when a rule-list or a numeric threshold would be sharper. The ritual is not the rigour.
- **Requirements without IDs.** Prose-only requirements that two documents describe differently and that no coverage map can track.
- **Silent scope.** No non-goals stated, so every reasonable adjacent assumption is fair game and scope grows without a decision.
- **Spec rot.** A spec that no longer matches the system, trusted literally by the next agent that reads it.

## Further reading

- *Competing Against Luck*, Clayton Christensen — the jobs-to-be-done framework in depth.
- *User Story Mapping*, Jeff Patton — journeys and stories as the structure of a specification.
- *Specification by Example*, Gojko Adzic — acceptance criteria as the bridge from requirement to test, and when scenarios earn their keep.
