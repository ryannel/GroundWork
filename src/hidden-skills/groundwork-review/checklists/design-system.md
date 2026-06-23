---
name: design-system-checklist
description: >
  Type-specific failure modes for reviewing a draft design system — the
  implementation-ready specification that eliminates downstream design decisions.
---

# Design System Checklist

This checklist checks a draft `docs/design-system.md`. It answers one question: **could a
developer or generative UI tool implement this specification without making a single design
decision of their own?**

Each item names a violation. Match it against the document text; answer yes/no. The items apply
across all interface tracks (graphical UI, CLI, agentic protocol) — read "value" as the track's
unit of commitment: a CSS token, a terminal colour role, a protocol field.

A design system legitimately carries one titled section per interface type in use (`# Graphical
UI`, `# CLI`, `# Agentic Protocol`), plus a shared foundation when several types are active.
Multiple type sections — and the multi-block brand-tokens file they project to — are the
contract for multi-type products, never duplication or contradiction findings in themselves.

## Document Hygiene

- [ ] 🟡 **Leftover downstream summary**: the published doc still carries a `## Summary for
  Downstream` section. The cross-phase contract now lives in `.groundwork/context/design-system.md`,
  not in the published doc; an old-template summary section is residue and should be removed.

## Translation Depth

- [ ] 🔴 **Direction instead of value**: a section states intent ("warm colours", "generous
  whitespace", "snappy feedback") without committing to implementable values. The user's words
  echoed back are not a specification.
- [ ] 🔴 **Decision left to the implementer**: any instruction of the form "choose an appropriate
  X", "use a suitable Y", or a value range with no committed default — the implementer is being
  asked to make a design call this document exists to eliminate.
- [ ] 🟡 **Single-property definition**: a design concept defined by one property (just a
  background colour, just a radius) where the standard requires the full set — surface, border,
  depth, state, and variant coverage.
- [ ] 🟡 **Hedged specification**: "should", "could", "consider", "typically" attached to a value
  — a spec either commits or stays silent.

## Coverage and Coherence

- [ ] 🔴 **Promised variant missing**: the document commits to a mode in one section (a second
  theme, a no-colour fallback, a responsive breakpoint, a degraded state) and another section
  defines values for only one mode.
- [ ] 🔴 **Undefined token referenced**: a token, class, or named value is used in one section
  but defined nowhere in the document.
- [ ] 🔴 **Incomplete interaction states**: an interactive element defines some states but not
  the full set its own constraints require — e.g. hover specified but focus-visible or disabled
  absent.
- [ ] 🟡 **Target-structure gap**: a section the track's target structure requires (constraints,
  shell, error choreography, empty states, or the track equivalent) is absent with no stated
  reason.
- [ ] 🟡 **Token contradicts token**: two sections within the same interface-type section (or
  the shared foundation) commit to different values for the same concept — a spacing step, a
  duration, a colour role — leaving the implementer to pick a winner. Different types
  legitimately express the same brand decision differently.

## Constraints

- [ ] 🔴 **Constraints section without numbers**: performance budgets, accessibility baselines,
  or platform targets are named but carry no measurable value ("the app must be fast",
  "accessible to all users").
- [ ] 🔴 **Accessibility floor unverifiable**: an accessibility commitment with no testable
  criterion — no contrast ratio, no keyboard path, no equivalent for the track's medium.
- [ ] 🟡 **Rationale-free opinionated default**: a non-obvious technical default (colour space,
  grid base, easing model) asserted with no one-line reasoning — the next person to touch it
  will relitigate or silently abandon it.

## Upstream Contract

- [ ] 🔴 **Brief commitment contradicted**: a value or pattern in this document conflicts with a
  decision or hard rule in `docs/product-brief.md` — e.g. a brief that
  commits to a terminal medium answered with screen-design sections.
- [ ] 🔴 **Type section unbacked or missing**: when `docs/product-brief.md` carries a surface set,
  the document's titled type sections disagree with it — a type section with no MVP-horizon
  surface of that type behind it, or an MVP-horizon interface type with no section (and no
  stated deferral).
- [ ] 🔴 **User type unserved**: a user type the product brief commits to has no design answer —
  no journey, shell state, or interaction pattern accounts for them.
- [ ] 🟡 **Silently introduced product decision**: the document commits to a product-level
  behaviour (a capability, a flow, an exclusion) that the brief neither states nor implies —
  design has quietly extended the product.
