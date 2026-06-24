# Slice [N.M] — [service]: [Slice Name]

*One vertical slice of a milestone. Renders to `docs/bets/<bet-slug>/decomposition/NN-<milestone-slug>/NN-<slice-slug>.md`. It states the slice's scope, ties it to the design, and carries the prose proof of work the user approves. The slice is vertical — it can be deployed and verified without any future slice existing.*

*`Surface:` applies only when the project carries a surface registry (`docs/surfaces.md`); omit it with no registry.*

**Owner service:** [service name from `docs/architecture/infrastructure.md`]

**Surface:** core | [surface-slug from `docs/surfaces.md`]

**Complexity:** S / M / L

**Prerequisite:** (none, or "Slice [N.K] merged")

## Scope

[One paragraph linking this slice to its milestone — what vertical capability it contributes and how that capability demonstrably moves the milestone forward.]

**Required Capabilities:**
- [Falsifiable capability statement tracing to an interface in `technical-design/03-api-design.md` or a store in `technical-design/04-data-design.md`. "The endpoint exists" is not falsifiable; "POST `/api/sessions` returns 201 with a `session_id` field when given a valid request body matching the API design" is.]
- [Falsifiable capability statement]

## Design

[Where this slice lands in the design. Name the interface it implements in `technical-design/03-api-design.md` or the store it touches in `technical-design/04-data-design.md`, the data flow it realizes in `technical-design/02-data-flows.md`, and — for a surface slice — the view or interaction in `technical-design/01-ui-design.md` it wires. The shapes the slice builds against live in that prose design at design fidelity; this slice does not restate them.]

## Proof of work

*The prose proof the user reviews and approves — this slice's definition of done in plain language. No assertion code; the runnable stub is generated from this prose at Delivery start.*

**Proves:** [the vertical capability this slice contributes, in one plain-language sentence — what it makes true that the milestone depends on.]

**How we prove it:** [the proof case in prose — the request or interaction exercised and the observable condition it passes on. A `core` slice proves contract behaviour; a surface slice proves wiring, rendering, and interaction only, never re-proving a rule the capability milestone settled.]

**Test file:** `tests/bets/<bet-slug>/test_slice_<N>_<service>_<slice-slug>.<ext>` — generated red at Delivery start; traces to [the interface, channel, or schema table in `technical-design/` it rests on].
