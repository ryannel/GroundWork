# AI-Native Design

When you advise on a probabilistic or generative feature, design for the distribution of outputs, not a single answer. The core failure is a probabilistic engine wrapped in a deterministic interface that presents a guess as truth; the discipline is making the uncertainty legible and controllable so the user collaborates with the system instead of being surprised by it.

## Design the outcome envelope, not one happy path

Design for the range of what the feature might produce, because the exact rendered output is no longer under your control. Vary the treatment by likelihood of intent — more framing where confidence is low, less friction where high — prefer ranges and windows over false-precise points, and plan explicit fallback states for degrading confidence. Because ideation is cheap with these systems, presenting multiple candidates is often the right default.

## Latency is a design material

Optimise time-to-first-token and stream immediately, because streaming removes the wait-for-completion delay even though it does not speed the model, and perceived speed is the metric. Show structured progress past ~1s, let the user act on partial output, and parse streaming content incrementally rather than re-rendering the whole response per chunk. An unindicated wait past ~10s collapses satisfaction.

## Communicate confidence without false precision

Prefer calibrated categorical confidence (high / medium / low) and first-person hedging at the point of the claim, reserving numeric scores for high-stakes domains with comparable predictions, because a single definitive score drives over-reliance then trust collapse and a spurious percentage implies precision the model lacks. Do not amplify the model's default overconfidence.

## Ground claims; design the wrong answer first

Where the feature makes factual claims, assemble citations during generation from the retrieval context, at the passage level, and surface missing or broken sources explicitly, because a citation creates a halo that lowers vigilance so a gap must be shown. Treat incorrect output as the norm and design that flow before the happy path: sandbox unpredictable output to a region so it cannot break the deterministic UI, mark doubt in context rather than in a global disclaimer that habituates into noise, and make correction cheap with feedback routed back. Never feed unverified output straight into an irreversible action.

## Keep the human on the dial

Autonomy is a slider the user controls. Gate on reversibility crossed with severity — irreversible high-severity actions (send, charge, delete, deploy) need pre-approval; reversible high-severity gets oversight with a rollback window; reversible low-severity runs autonomously — and show the agent's reasoning at the gate, because an action the user cannot preview feels like a surprise they did not consent to. Gating everything is its own failure: alert fatigue turns approval into rubber-stamping. Make regeneration and steering first-class and non-destructive, never silently discarding prior outputs.

## Chat is one tool, not the universal interface

Chat became the default because it was easiest to ship, not because it suits most tasks: a bare text box has no affordances, hides the system's capabilities, and forces constant switching between instructing and evaluating. Most AI features are better as embedded, affordance-rich tools — highlight-to-rephrase, context-menu actions, ambient agents — with conversation reserved for open-ended dialogue and paired with a directly manipulable canvas. Design for control and legibility — copilots, not captains — over "magic" autonomy.

## Antipatterns to catch

- **A guess as truth.** A single confident answer with no confidence signal, sources, or cheap correction.
- **The blocking wait.** Holding the full response instead of streaming with progress.
- **False precision.** Spurious percentage confidence, amplifying the model's overconfidence.
- **Retrofitted citations.** Document-level references grafted on, useless for verifying a claim.
- **The global disclaimer.** One "AI can make mistakes" line replacing in-context doubt.
- **Approve-everything or approve-nothing.** Rubber-stamp fatigue, or auto-running irreversible actions.
- **Chat as the answer to everything.** A chat widget where an embedded tool would serve better.
