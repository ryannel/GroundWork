# Requirements and Specs

A requirement is a claim about what a user needs to accomplish, grounded in evidence and stated precisely enough to test. This is where product thinking becomes something an engineer, an agent, or a test can act on — and where it most often goes wrong. In an agent-led codebase, requirements are read as literally as code.

## Describe jobs, not features

State what the user is trying to accomplish — the **job to be done** — before naming any feature that serves it. A job is the progress a user wants in a situation ("when I finish a task, I want to know it actually completed, so I can move on without checking back"), with its functional, emotional, and social dimensions. Features are solutions to jobs; leading with the feature skips the check that the solution fits the job. The job is stable; the feature is negotiable.

## Walk the journey, don't list the screens

A user journey is a narrative with structure: a named persona in a context, the state they enter from, the concrete path of steps, the moment value lands and how they know, and the state they are left in. Walking it end to end surfaces the gaps a feature list hides — the empty state, the error halfway through, the second-time-through shortcut. Describe journeys with enough texture that a reader can picture the interaction, not just enumerate steps. Note the obvious failure mode inline rather than pretending the happy path is the whole story.

## Stable IDs make requirements referenceable

Give every functional requirement a stable, globally unique ID (`FR-1`, `FR-2`, …), assigned once and never reused. The ID is what lets a design doc, an architecture decision, a test, and an acceptance criterion all point at the *same* requirement, and what lets a coverage map prove nothing was dropped. Requirements identified only by prose drift apart the moment two documents describe the same thing in different words.

## Acceptance criteria are testable, in Given/When/Then

Write each requirement's acceptance criteria as **Given** (precondition) / **When** (action) / **Then** (observable outcome), with **And** for extra conditions. The form forces precision: a criterion that cannot be cast this way is usually not yet concrete enough to test. Each criterion is independently verifiable and covers the edge and error cases, not just the happy path. "Done" means every acceptance criterion passes — nothing softer.

## Non-goals are part of the spec

What a requirement explicitly does *not* cover is as load-bearing as what it does. State non-goals directly, with the reason and where the excluded thing belongs instead. The natural extension a reader would assume — the adjacent feature, the obvious generalisation — is exactly what must be named as excluded, or scope creeps one reasonable assumption at a time.

## The spec is a living record, not a template fill

A specification earns its sections; it does not fill them to look complete. Add the sections the product needs, drop the ones that do not apply, keep the document current as decisions change, and surface assumptions explicitly (`[ASSUMPTION]`) so they can be confirmed rather than buried. A spec produced by walking a template top to bottom and padding every heading reads thorough and conveys nothing that was not already obvious.

## Ground every requirement in evidence

Every requirement traces to a reason it exists — a need observed in discovery, a job confirmed in a conversation, a problem with evidence behind it. A requirement that traces only to a preference is a candidate to cut. The spec is where *validated* needs become buildable statements; it is not where new unvalidated ones get smuggled in.

## Antipatterns to catch

- **Template-fill PRD.** Every heading padded to look complete, conveying nothing the team did not already know.
- **Feature list as requirements.** Solutions enumerated with no job behind them, so nobody can tell whether they fit the need.
- **Untestable acceptance criteria.** "Works well," "handles errors gracefully," "is intuitive" — none can pass or fail a test.
- **Requirements without IDs.** Prose-only requirements that two documents describe differently and no coverage map can track.
- **Silent scope.** No non-goals stated, so every reasonable adjacent assumption is fair game and scope grows without a decision.
