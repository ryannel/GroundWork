# 04. The Bet Pipeline (Execution)

This is the engine that drives actual feature development. It flows from product strategy down to code execution, enforcing that technical execution is strictly bound to clear intent and verified by automated tests.

## Step A: Problem Statement & Pitch
- **Problem Statement:** Captures observed pain with real evidence and an "appetite" (an opportunity cost judgment of how much time the problem is worth solving).
- **Pitch:** Shapes the problem into a rough solution sketch (with specific "rabbit holes" and "no-gos"). A funded pitch becomes a **Bet**.

## Step B: Technical Design (TDD Foundations)
Before writing code, we establish the technical foundations. Design happens *here*, not later.
- **Per-Bet UI/UX Design:** We do detailed UI/UX design here (wireframes, layouts, states, user journeys) applying the global design tokens defined during Initialization.
- **Data Flows:** We map interactions across service boundaries. This includes user interactions, but also background workers, message queues, cron jobs, and event pipelines.
- **Contracts & Schemas (Target State Only):** We plan the API contracts and database schemas purely declaratively. We do *not* do diffs, gap analysis, or talk about "new vs existing" here. We look at the existing schemas and describe the exact *desired target state*. Diffs muddy the interface; we want a clean view of all moving parts.

## Step C: Slicing (Milestones & Domain Slices)
- **Integration Milestones:** Decomposing the bet into points of user-visible value.
- **Domain Slices:** The smallest independently buildable and testable unit of work within a single domain. We recognize we cannot always deliver user-facing value in a single piece of work. *This is where we perform gap analysis and diffing* against the target state (defined in Step B) to determine the exact required work for the slice.

## Step D: The Bet Test Suite & Validation (Proof of Work)
This is how we enforce accountability and prove progress.
- **Throwaway Bet Tests:** During slice and milestone planning, we create integration tests (starting as stubs) in a dedicated "bet test runner". These test descriptions must be highly detailed so the AI cannot cheat later.
- **Tracking Progress:** As the developer agent works, it must make these throwaway tests pass green to prove the slice is complete.
- **Permanent Service Tests:** As each slice is completed, we *duplicate* the test intent into the actual system stack (honeycomb service tests, system tests, unit tests). This duplication is intentional.
- **Cleanup:** Once the entire bet is complete, the throwaway bet tests are deleted. The permanent coverage lives on embedded in the system, and the new functionality is fully absorbed.
