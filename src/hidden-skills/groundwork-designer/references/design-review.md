# Design Review — Judging the Implemented UI

When you judge a delivered interface, judge it in the running software, against the intent it was meant to express and the references it drew from — not against the comp, and not by a recited checklist. This is where the discipline earns its keep: the design system is only delivered if the rendered product reaches it, and someone has to look and say whether it did.

## Judge in the material, against a named bar

Look at the actual rendered states, not the design file, because the screen is the only place the design exists for the user. A review needs two things to be more than opinion: the stated intent (what this was meant to feel like and do) and the named references the work admired. Craft is judged against a bar, so an unnamed bar cannot be met or checked — pull the references at review time (the market leaders the work cited have abundant public design imagery) and ask the defensible question: is this as considered as the thing we said we admired?

## Reason over dimensions, do not recite a checklist

Hold the implemented screen against the dimensions that carry quality, and reason about each rather than ticking it: did the intent survive translation (do the rendered colour, type, space, and motion match the specified tokens, or did the build drift to framework defaults); rendering integrity (does each state render free of overflow, clipping, misalignment, broken assets); layout and alignment against the spatial system; perceptual craft (perceptual colour, modelled depth, typographic rigour, purposeful motion — or the generic signatures: a flat shadow, one font weight, a default gradient, a single linear ease); and state coverage (are empty, loading, partial, error, and success actually designed, or only the populated path). A fixed checklist both narrows what you look for and reads identically every session; describe the dimensions and let the review surface what is wrong.

## Hold a real quality bar

A finding is only useful if it is specific enough to act on and calibrated to the bar. The difference is concrete: a thin "the spacing feels off" is noise beside a deep "the card grid uses a 12px gutter where the 8-point rhythm calls for 16px, so the density reads cramped against the Linear-class restraint the references set." Name the dimension, the observed value, the specified or admired target, and why the gap matters. Separate what violates the design system (a defect — wrong token, missing state) from what merely falls short of the craft bar (a lift — technically conformant but generic).

## Distinguish durable craft from fashion

Judge against durable craft — perceptual colour, motion with purpose, modelled depth, typographic rigour — not a passing visual fashion. Matching a leader means matching its underlying rigour and restraint, never copying its signature look, because the signature dates and the rigour does not. A review that asks the product to mimic a trend has mistaken the surface for the craft.

## Antipatterns to catch

- **Reviewing the comp.** Judging the design file instead of the rendered, stateful product.
- **The recited checklist.** A fixed list that narrows attention and repeats verbatim every session.
- **The unnamed bar.** "Make it nicer" with no intent and no reference to judge against.
- **Thin findings.** "Spacing feels off" with no value, target, or reason — unactionable.
- **Defect and lift conflated.** Treating a system violation and a craft shortfall as the same severity.
- **Mimicry as the goal.** Asking for a leader's signature look instead of its rigour.
- **Stopping at the happy path.** Reviewing the populated state and never opening empty, loading, or error.
