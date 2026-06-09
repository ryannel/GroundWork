---
name: bet-pitch-checklist
description: >
  Type-specific failure modes for reviewing a bet pitch — the problem, appetite,
  solution, and risk surface a bet is shaped around.
---

# Bet Pitch Checklist

This checklist checks a draft `docs/bets/<slug>/pitch.md`. It answers one question: **does this
pitch state a real problem, cap it with an appetite, and honestly surface where that appetite is
at risk?**

Each item names a violation. Match it against the document text plus the upstream summaries;
answer yes/no. Bet documents carry no `## Summary for Downstream` — do not flag its absence.

## Structure

- [ ] 🔴 **Milestones contamination**: the pitch contains a `## Milestones` section or any
  milestone list. Milestones are produced by the Decomposition phase after the design is locked;
  a pitch that lists them has contaminated the discovery artifact.
- [ ] 🟡 **Off-template section**: the pitch carries sections beyond `## The Pitch` and
  `## Rabbit Holes & No-Gos` — schemas, task lists, or designs that belong to later phases.

## Problem, Appetite, Solution

- [ ] 🔴 **Problem without a sufferer**: the problem statement names no user or situation in
  which the pain occurs — "users need better project management" is a category, not a problem.
- [ ] 🔴 **Appetite missing or unbounded**: no appetite is stated, or it is framed as an estimate
  of how long the work will take rather than a constraint that caps the scope.
- [ ] 🟡 **Appetite without a boundary**: an appetite number is given but nothing states what is
  bounded out to make it hold — the cap exists but the scope it caps is open.
- [ ] 🟡 **Solution as feature list**: the solution enumerates features without stating the
  end-to-end outcome a user reaches — a task list wearing a pitch's clothes.

## Success Signal

- [ ] 🔴 **Unmeasurable signal**: the success signal is sentiment ("users find it useful") rather
  than a concrete observable — a specific user action, completion rate, or retention signal.
- [ ] 🔴 **Signal that cannot fail the hypothesis**: the signal could pass while the bet's core
  hypothesis fails — it measures activity adjacent to the bet, not the riskiest assumption the
  bet makes.

## Rabbit Holes & No-Gos

These are two distinct lists and both must be present in substance. **No-Gos** are scope
exclusions — features deliberately cut. **Rabbit Holes** are technical traps or unknowns that
could silently consume the appetite.

- [ ] 🔴 **No-Gos only, no rabbit hole**: the `## Rabbit Holes & No-Gos` section lists only scope
  cuts and names no technical rabbit hole, yet the bet plainly carries technical risk — the
  pitch has not surfaced where the appetite is actually at risk. A genuinely low-risk bet may
  state so explicitly instead; silence is the violation.
- [ ] 🟡 **Rabbit hole without a guard**: a rabbit hole names a risk but pairs it with no guard
  or spike — the trap is mapped but nothing prevents falling into it.
- [ ] 🟡 **No-Go without the deferred expectation**: a no-go names a cut without the user
  expectation it defers ("Analytics") — the standard is naming what users will expect and why
  the cut is safe for this bet.
- [ ] 🟡 **Scope cut listed as a rabbit hole**: an entry under Rabbit Holes is actually a feature
  cut, not a technical trap — the two lists have been blended, which hides whether real risk was
  considered.

## Upstream Contract

- [ ] 🔴 **Out-of-scope resurrection**: the pitch builds something the product brief's
  `### Out of Scope` permanently excludes, with no recorded decision reversing that boundary.
- [ ] 🔴 **Constraint breach**: the pitched solution violates a Binding Constraint from the
  architecture or design system summary — a budget, a data rule, a platform commitment.
- [ ] 🟡 **Unacknowledged dependency**: the pitch assumes a capability (a service, an
  integration, a data source) that no upstream doc records as existing or planned.
