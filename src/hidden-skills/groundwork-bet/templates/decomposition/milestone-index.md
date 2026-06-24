# Milestone [N]: [Milestone Name]

*This is the landing page for one milestone in the decomposition tree. It renders to `docs/bets/<bet-slug>/decomposition/NN-<milestone-slug>/index.md`. It carries the milestone's demonstrable goal, its sequencing rationale, its acceptance criteria, and the prose proof of work — then links to its slices. The slice files sit beside it in the same folder.*

*`Type:` and `Consumer:` apply only when the project carries a surface registry (`docs/surfaces.md`). With no registry, omit both — milestones are user-visible states in the product's single interface medium, exactly as before.*

**Type:** capability | surface ([surface-slug])

**Consumer:** [who exercises this contract — the bet's in-scope surfaces that build on it in later milestones, or the latent agentic surface for a headless delivery. Capability milestones only.]

**Demonstrable goal:** [the state the product reaches when this milestone is complete. For a capability milestone: the contract behaviour provable end-to-end against the running services (or the embedded core's public API) — curl-able, scriptable, observable. For a surface milestone: what a user of this surface can observe or do, in that surface's medium, bounded to wiring, rendering, and interaction.]

**Sequencing rationale:** [why this milestone sits where it does. A bet introducing new capability opens with its capability milestone, because every surface milestone consumes the contract it proves. A surface milestone states what it wires and never re-proves the rules the capability milestone settled.]

**Acceptance criteria:**
- [ ] [specific, falsifiable criterion — at the contract for a capability milestone, in the surface's medium for a surface milestone]
- [ ] [specific, falsifiable criterion]

## Proof of work

*The prose proof the user reviews and approves. This is the milestone's definition of done in plain language — what becomes true about the product and how the suite proves it. No assertion code; the runnable stub is generated from this prose at Delivery start.*

**Proves:** [the consumer-visible outcome this milestone reaches, in one or two sentences. State what becomes true about the product, not how a test is written.]

**How we prove it:** [the shape of the proof in prose — what the suite exercises end to end and the observable condition it passes on. A reader should understand the proof without seeing any code. For a capability milestone this hits the contract directly; for a surface milestone it asserts what that surface's users observe.]

**Test file:** `tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.<ext>` — generated red at Delivery start; traces to [the interface in `technical-design/03-api-design.md` (or store in `04-data-design.md`) for a capability milestone, or the surface subsection in `01-ui-design.md` for a surface milestone].

## Slices

[Ordered links to this milestone's slice files — each slice is a vertical capability that moves this milestone forward.]

- [Slice [N.1]: [Slice Name]](./NN-<slice-slug>.md)
