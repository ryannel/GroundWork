---
title: Customization — the additive policy layer
description: How a team adds rigor and context to GroundWork without editing the framework, via policy.toml and policy.user.toml.
status: active
last_reviewed: 2026-07-03
---

# Customization — the additive policy layer

GroundWork is opinionated: there is one way to work, and the framework's gates, review lenses, and proofs are the floor. Customization does not change the floor — it **adds** to it. Two files hold your additions:

| File | Scope | Committed? |
|---|---|---|
| `.groundwork/config/policy.toml` | Team-wide | Yes |
| `.groundwork/config/policy.user.toml` | Personal, machine-local | No (gitignored) |

They merge in that order — for a scalar the personal file wins; for an array the two concatenate, team first. `npx groundwork-method policy` prints the resolved merge as JSON, and `npx groundwork-method check` validates both (parse errors, broken `file:` references, missing lens briefs, unknown keys).

**The one rule: additive only.** The policy layer can add facts, lenses, checklist items, and phase hooks. It can never remove, replace, or weaken a built-in gate, lens, or review. A user lens *adds* findings; it can never satisfy, replace, or stand in for a built-in lens or `groundwork-review`.

## The four sections

- **`[facts]`** — persistent org facts, carried into orchestrator state, every dispatched worker capsule and context pack, and the setup facilitators. A plain string is a literal fact; `file:<path>` points at a doc whose contents are the fact.
- **`[lenses]`** — additive review lenses. Each `[[lenses.slice]]` (a `name` and a `brief` path outside `.groundwork/skills/`) dispatches in the same parallel wave as the built-in slice lenses, at the frontier tier, with findings through the same buckets.
- **`[checklists]`** — extra items appended to a `groundwork-review` document type's checklist (🟡 by default).
- **`[phases]`** — instruction-file hooks (not shell) prepended at a skill's phase init or appended at its commit step.

## Example

```toml
[facts]
items = [
  "All services log in structured JSON per our org standard.",
  "file:docs/org/security-baseline.md",
]

[[lenses.slice]]
name  = "security-review"
brief = ".agents/custom/lenses/security-review.md"

[checklists]
architecture = ["Every service names its data-residency region."]

[phases.groundwork-product-brief]
prepend = [".agents/custom/hooks/brand-guardrails.md"]
```

## What the layer deliberately does not do

There are **no artifact-path overrides** — the cross-phase contracts key writer/reader chains on exact paths, and an override there would silently break them. Redirecting where a canonical doc lives is not a customization; it is a structural change the framework owns.
