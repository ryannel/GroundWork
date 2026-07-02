# The Four Product Risks

Before committing to build, run the bet through four distinct ways it can fail. Most failed features were not built badly — nobody asked the right "could this not work?" question early enough. Naming all four forces the question each discipline is prone to skip.

## The four risks

- **Value** — will users choose to use or buy this? Does it solve a problem they actually feel? This is the risk most features die of, and the easiest to wave away with "of course they'll want it."
- **Usability** — can users figure out how to use it well enough to get the value that is theoretically there?
- **Feasibility** — can it be built with the time, skills, and technology available, and operated reliably?
- **Viability** — does it work for the *business*? Cost, support load, legal, security, brand, and the commercial model all live here. A feature can be desirable, usable, and feasible and still be a mistake to ship. Ethics lives inside viability and is the one concern with no natural stakeholder — legal owns legal, finance owns cost; name "should we build it at all?" on purpose or it goes unowned.

## Ownership — who clears which risk

Risk without an owner is risk nobody clears.

| Risk | Owner | Accountable for |
|---|---|---|
| **Value** | Product | the outcome |
| **Viability** | Product | the outcome |
| **Usability** | Design | the experience |
| **Feasibility** | Architecture / Engineering | delivery |

You own value and viability — both are judgements about whether the outcome is worth pursuing. When a question is really about usability, hand it to the designer; when it is about whether the approach is buildable, hand it to the architect. Do not decide another discipline's risk for them; name the split and pull in the owner.

## Discovery kills risk before delivery

The purpose of discovery is not to produce a spec — it is to retire risk. Delivery begins only once the four risks are low enough that building is the cheapest remaining way to learn. Every assumption you can test with a conversation, a prototype, a proof of concept, or a cost model is one you should *not* test by shipping. Discovery is the cheap place to be wrong; production is the expensive one.

## Test the riskiest assumption first

Not all risk is equal. Surface the assumptions the bet rests on, rank them by how likely each is to be wrong and how much damage a wrong answer does, and test the riskiest first. If the bet is going to die, kill it on the assumption most likely to kill it — before sinking effort into the assumptions that were never in doubt. Spending discovery on the comfortable questions while the load-bearing one goes untested is how a team feels busy and learns nothing.

## Match the instrument to the risk

Each risk is tested differently; the wrong instrument answers the wrong question convincingly.

- **Value** → user evidence: demand signals, interviews, a fake-door, a willingness-to-pay probe.
- **Usability** → prototypes and observed sessions.
- **Feasibility** → a proof of concept or an architecture review.
- **Viability** → walk the decision past its constraints: cost model, security posture, legal boundary, support load.

## Scale the rigour to the stakes

A small, reversible, low-cost change needs a gut-check and a willingness to undo it — not a four-risk discovery. The full evidence-backed pass is for bets that are expensive to build, hard to reverse, or load-bearing. Running heavy discovery on trivial work is its own failure mode; the discipline is proportion.

## Antipatterns to catch

- **Feasibility-only filter.** "Can we build it?" as the only question. Produces things that work and that nobody wanted.
- **Validation theatre.** Discovery run to confirm a decision already made, testing the safe assumptions and skipping the one that could kill the bet.
- **Unowned risk.** Four risks and nobody accountable for clearing any specific one.
- **Shipping to learn value.** Using production as the first test of whether anyone wants it — the most expensive place to hear no.
- **The forgotten viability risk.** A desirable, usable, feasible feature that triples support load, breaks a compliance boundary, or costs more to run than it earns.
