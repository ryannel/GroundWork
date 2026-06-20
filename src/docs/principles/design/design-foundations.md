---
title: Design Foundations
description: Design as the discipline that owns usability and craft — intent translated into precise specification, implemented not decorated, held to the bar set by the best products of the day.
status: active
last_reviewed: 2026-06-20
---
# Design Foundations

## TL;DR

Design is the discipline that decides how a product looks, feels, and behaves for the person using it — and then proves the result, in running software, against the bar set by the best products of the day. We own the **usability** risk: whether a real user can understand and operate what we ship. Taste is an input; a precise, implemented specification is the output. A design that lives only in a comp, or renders but reads as generic, has not done its job.

## Why this matters

The dominant failure mode of engineering-led products is not ugliness — it is *plausibility*. The build renders, the tests pass on the business logic, and the result looks like every other framework-default app: an indigo gradient, Inter at one weight, a flat grey border, a single 0.3s ease-in-out. It satisfies the spec and reaches none of the craft. Meanwhile the design system that was carefully authored evaporates between the design phase and the screen, because no one looked at the running product and held it to the intention.

Design closes that gap. It is the discipline that translates a felt intention ("calm, dense, fast") into values a machine can implement without guessing, and then judges the rendered result against both the stated intention and the market leaders the work drew inspiration from. The two halves are inseparable: precision without taste produces a tidy but lifeless interface; taste without precision produces a beautiful mock no one can build twice.

## Our principles

### 1. Design owns usability; it is the third risk

Every bet must clear four risks: value and viability (product owns), feasibility (architecture and engineering own), and **usability** — whether the target user can actually understand and operate the thing. Usability is the design risk. It is killed the same way the others are: named early, tested against evidence, and proven before delivery rather than discovered after launch. A flow that works for the person who built it is not validated; it is unexamined.

### 2. Taste is the input; specification is the output

The user speaks in taste, instinct, and analogy — "warm and editorial," "fast like Linear," "it should feel trustworthy." That is the correct level of input. The designer's core contribution is the *translation*: `oklch(96% 0.008 60)` paired with a 450-weight serif at a 1.25 modular scale is a specification; "warm and editorial" is a brief. An interface description that echoes the user's words back with formatting has done no design work — the value is created entirely in the act of turning feeling into precise, implementable, defensible values.

### 3. Design is implemented, not decorated

A design system wired through to production — semantic tokens compiled into the styles the app actually serves — is implemented. A Figma library that engineers reproduce by eye is decorative, and it drifts the moment it ships. The test is mechanical: change one semantic token's value and watch the running product change. If it does not, the system is decoration and the design was never really delivered. We design *in the material* — the rendered, stateful, responsive software — because that is the only place the design exists for the user.

### 4. Craft is everything above the spec

A door that opens meets the spec; whether it swings true, latches with a satisfying weight, and aligns to the frame is craft. Software is the same. The functional requirement is the floor. Craft is the layered shadow that reads as real light instead of a fuzzy grey box, the spring that settles instead of a linear slide, the empty state that teaches instead of a blank panel, the perceptual colour ramp whose steps look evenly spaced. Craft is not decoration added at the end — it is the difference between a product that is tolerated and one that is trusted, and it is decided in the same breath as the function.

### 5. Hold the work to the leaders, by name

The best product teams of the day — Linear, Vercel, Stripe, Raycast, Apple, Family — set a public, observable bar. We name the references the work draws from during design, and we judge the delivered result against them: not to copy a signature, but to match the *level* of restraint, density, motion discipline, and typographic rigour. "Is this as considered as the thing we said we admired?" is a question with a defensible answer, and asking it is how a team escapes its own gravity.

### 6. Distinguish durable craft from fashion

Durable craft is invisible correctness — it matches physics (light, motion), human perception (colour, type), or epistemic reality (uncertainty). Perceptual colour, motion with purpose, spatial depth, typographic rigour: all are codified in specifications and platform guidelines and will not date. Fashion is a visible signature — neumorphism, whole-UI glassmorphism, the purple-gradient-and-three-cards "AI slop" look that models regress to from vague prompts. We invest in the correctness and let the signature emerge from it; we do not chase the look.

### 7. The interface medium is decided, never assumed

A screen, a terminal, an API, a voice surface, and an agent protocol are different design problems with different materials. Before any visual or interaction decision, the medium is explicit, because the whole vocabulary — what a "component" is, what "feedback" means, what can be perceived — hangs off it. A design conversation that produces an experience description without naming its medium has left the most consequential decision implicit.

## The design discipline

This page is the spine of a wider design corpus — the discipline of designing usable, crafted software, expanded into its working parts:

- [Visual Design](visual-design.md) — perceptual colour, typographic rigour, spatial depth, and visual hierarchy: the craft of how a surface looks.
- [Layout & Space](layout-and-space.md) — spatial systems, modern intrinsic layout, container-driven responsiveness, and density as an axis.
- [Interaction & Motion](interaction-and-motion.md) — affordance and feedback, the full set of interface states, and motion that serves function.
- [Usability & UX](usability-and-ux.md) — heuristics and UX laws applied at decision time, cognitive load, forms, and error recovery.
- [Design Systems & Tokens](design-systems-and-tokens.md) — the token contract, components as contracts, and the system as the durable interface between design and engineering.
- [AI-Native Design](ai-native-design.md) — designing the outcome envelope of probabilistic and generative interfaces.

## How we apply this

- [Accessibility](../quality/accessibility.md) — usability that excludes assistive-technology users is not usability; WCAG 2.2 AA is the floor design works within.
- [Product Engineering](../foundations/product-engineering.md) — design owns the usability risk in the same four-risk frame product engineering sets up.
- [Surface Architecture](../system-design/surface-architecture.md) — the design system is a contract across surfaces; the seam between core and surface is where design and architecture meet.

## Anti-patterns we reject

- **The echo spec.** An interface description that restates the user's adjectives with headings and never reaches a concrete value. The translation is the work; skipping it produces nothing.
- **Decorative design system.** Tokens that live in a design tool and are reproduced by hand in code. They diverge on the first commit and the "system" becomes a museum piece.
- **Happy-path-only design.** Designing the populated ideal and leaving empty, loading, partial, error, and success states to fall out of the implementation. Users live in those states; that is where the product is won or lost.
- **Generic-by-default.** Shipping the framework defaults — one gradient, one font weight, one easing curve, one flat shadow — and calling it designed. Plausible is not the bar.
- **Mimicry over craft.** Copying a leader's signature look instead of matching its underlying rigour. The signature dates; the rigour does not.
- **Design as a final coat.** Treating design as a styling pass after the logic is built. By then the structure has foreclosed the good options.

## Further reading

- *The Design of Everyday Things*, Don Norman — affordances, signifiers, feedback, and mapping: the grammar of interaction.
- *Refactoring UI*, Adam Wathan & Steve Schoger — the practical craft bridge between design intent and implemented interface.
- Karri Saarinen, *Building Linear* and the craft essays — restraint, opinion, and quality as a top-down editorial act.
- Jim Nielsen, *The Case for Design Engineers* — why design delivered as code, not handoff, is how craft survives.
