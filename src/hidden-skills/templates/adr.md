---
title: <NNNN. Title>
description: <One-line summary of the decision>
status: accepted
last_reviewed: <YYYY-MM-DD>
---

# NNNN. <Title>

**Status:** accepted     **Owner:** <team or role accountable for this today>
**Date:** <YYYY-MM-DD>   **Supersedes:** <— or NNNN>

> The record is immutable; the decision is not. If this is later superseded,
> change status to `superseded by [NNNN](NNNN-<slug>.md)`, add a one-line note
> at the top of the body explaining what changed, and leave the original
> reasoning intact — never overwrite it. The trail is what makes the set
> trustworthy enough to re-evaluate against.

## Context

What problem or constraint forced this decision, and what we were choosing
between. The forces at play. Capture enough that someone — human or agent —
re-reading this in a year understands the world it was made in.

## Decision

What we chose, stated as a single sentence followed by elaboration.

## Assumptions

What must stay true for this to remain the right decision — the load profile,
team size, vendor, cost, regulatory boundary, or scale it rests on. List them
plainly: each is a condition that, if it breaks, brings this decision back for
review. A decision with no stated assumptions cannot be told when it has gone
stale.

## Review trigger

The condition that should resurface this decision — "when we add a second
region", "if write throughput passes 50k/s", or a date when nothing more
specific applies. Decisions expire against reality, not the calendar.

## Trade-offs

- **What we gave up:** ...
- **What risk we accepted:** ...
- **What this makes harder in future:** ...

## Alternatives considered

Other options on the table and why they were rejected. State each rejection at
the right epistemic level: a measured or sourced fact may be stated as fact; an
unvalidated judgement must be framed as a judgement with its basis ("we judge X
weaker for our quality bar, pending validation"), not asserted as established
fact.

- ...
