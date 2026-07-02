# Slice [N.M] — [service]: [Slice Name]

*One vertical slice of a milestone. Renders to `docs/bets/<bet-slug>/decomposition/NN-<milestone-slug>/NN-<slice-slug>.md`. It states the slice's scope, ties it to the design, and carries the prose proof of work the user approves. The slice is a vertical cut through one service — it can be deployed and verified without any future slice existing — and it builds on the proven state of the slice before it.*

**Owner service:** [service name from `docs/architecture/infrastructure.md`]

**Surface:** [`core` or the registry slug this slice builds for — registry projects only; omit this field when the project carries no `docs/surfaces.md`]

**Complexity:** S / M / L

**Model tier:** (omit for the `execution` default; set "frontier — <reason>" only when this slice is particularly challenging or vague, lifting its slice-worker's model for this slice)

**Prerequisite:** (none, or "Slice [N.K] merged")

## Scope

[One paragraph linking this slice to its milestone — what vertical capability it contributes and how that capability moves the milestone toward its front-door proof.]

**Required Capabilities:**
- [Falsifiable capability statement tracing to an interface in `technical-design/03-api-design.md` or a store in `technical-design/04-data-design.md`. "The endpoint exists" is not falsifiable; "POST `/api/sessions` returns 201 with a `session_id` field when given a valid request body matching the API design" is.]
- [Falsifiable capability statement]

## Design

[Where this slice lands in the design. Name the interface it implements in `technical-design/03-api-design.md` or the store it touches in `technical-design/04-data-design.md`, the data flow it realizes in `technical-design/02-data-flows.md`, and — when it builds a screen — the view in `technical-design/01-ui-design.md` it wires and the best-in-class pattern it implements in full. The shapes the slice builds against live in that prose design at design fidelity; this slice does not restate them.]

## Proof of work

*The prose proof the user reviews and approves — this slice's definition of done in plain language. No assertion code; the runnable stub is generated from this prose at Delivery start.*

**Proves:** [the vertical capability this slice contributes, in one plain-language sentence — what it makes true that the milestone depends on.]

**How we prove it:** [the proof case in prose — the request or interaction exercised and the observable condition it passes on. A slice proves the behaviour at its service edge; when it builds a screen, it proves the screen renders and behaves through the pattern it implements in full.]

**Test file:** `tests/bets/<bet-slug>/test_slice_<N>_<service>_<slice-slug>.<ext>` — generated red at Delivery start; traces to [the interface, channel, or schema table in `technical-design/` it rests on].
