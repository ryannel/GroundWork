# offline-queue

**Status**: Building

## Problem

Field crews lose counts in dead zones: the app drops writes when the warehouse
has no signal, and crews re-count entire aisles.

## Appetite

Two weeks. If durable capture plus replay takes longer, cut sync polish.

## Not doing

- No conflict-resolution UI — last-write-wins with an audit line.
- No multi-device merge.
