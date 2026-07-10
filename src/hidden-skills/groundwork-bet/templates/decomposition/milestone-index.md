# Milestone [N]: [the product outcome in the user's words — "Browse and search the library", never a coined codename]

*This is the landing page for one milestone in the decomposition tree. It renders to `docs/bets/<bet-slug>/decomposition/NN-<milestone-slug>/index.md`. It carries the milestone's demonstrable goal, its sequencing rationale, its acceptance criteria (proven at the app's real entry point), and the prose proof of work — then links to its slices. The slice files sit beside it in the same folder. The milestone name is the identifier the user tracks across the whole delivery — name the outcome, not the mechanism, or the name becomes something to decode instead of something to follow.*

**Consumer:** [who observes this milestone's outcome at their real surface — a person at a screen, a developer calling an SDK, an operator reading a dashboard, another system calling the API. Name them and what they see. A pure-API product's consumer is the caller and its surface is the API.]

**Demonstrable goal:** [the thin, user-visible state the product reaches when this milestone is complete — what the consumer observes when they drive the real product, in their surface's medium, on real data. For the first user-visible milestone, this includes the design system landing in the running app.]

**Sequencing rationale:** [why this milestone sits where it does — what it proves through the bet's riskiest real path, why the milestones after it build on the state it reaches.]

**Acceptance criteria — proven at the app's real entry point:**
- [specific, falsifiable case the consumer can carry out on the real product — the integrity anchor the user signs at planning]
- [specific, falsifiable case]

## Proof of work

*The prose proof the user reviews and approves. This is the milestone's definition of done in plain language — what the consumer observes when they drive the real product, and how the suite proves it through the app's real entry point. No assertion code; the runnable stub is generated from this prose at Delivery start.*

**Proves:** [the consumer-visible outcome this milestone reaches, in one or two sentences. State what the consumer observes on the real product, not how a test is written.]

**How we prove it:** [the shape of the proof in prose — the consumer's action driving the shipping build end to end, on the real pipeline and real data, and the observable condition it passes on. A reader should understand the proof without seeing any code. Follows the real-entry-point and honest-green tells in `workflows/03-decomposition.md` Step 3.]

**Test file:** `tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.<ext>` — generated red at Delivery start; drives the consumer's surface in `01-ui-design.md` over the interfaces in `technical-design/03-api-design.md` (and stores in `04-data-design.md`) the outcome rests on.

## Slices

*The first milestone is sliced now, at decomposition; every later milestone is sliced when Delivery opens it (`workflows/04-delivery.md`), from what the milestones before it taught. Until a milestone is opened, leave the placeholder line below; once it is sliced, replace it with ordered links — each slice a vertical cut through one service that builds toward this milestone's proof at the app's real entry point.*

> *Slices authored on arrival.*

- [Slice [N.1]: [Slice Name]](./NN-<slice-slug>.md)
