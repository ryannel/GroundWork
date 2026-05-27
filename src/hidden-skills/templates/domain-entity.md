---
title: <Entity Name>
description: <One-line definition>
status: active
last_reviewed: <YYYY-MM-DD>
---

# <Entity Name>

**Owner:** <service-name>

## What it is

One paragraph describing the entity and its role in the system. State the
invariant the entity exists to enforce.

## Fields

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary identifier. |
| ... | ... | ... |

## Lifecycle

States and what triggers each transition. If the entity has no meaningful
state machine (e.g. immutable record), say so explicitly and remove the
table.

| State | Triggered by | Description |
|---|---|---|
| draft | creation | Initial state on insert. |
| ... | ... | ... |

## Events emitted

Events published when state changes. Names use `<entity>.<verb>` convention.

| Event | Trigger | Payload summary |
|---|---|---|
| <entity>.created | initial insert | id, owner, created_at |
| ... | ... | ... |

## Invariants

Constraints that must hold for the entity to be valid. Listed explicitly so
that violations are detectable in tests and at boundaries.

- ...

## Notes

Anything non-obvious — historical decisions, edge cases, known gotchas.
