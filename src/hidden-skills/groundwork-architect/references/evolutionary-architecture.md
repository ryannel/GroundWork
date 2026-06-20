# Evolutionary Architecture

An architecture is a system that must change safely under constant pressure, not a blueprint delivered once. Two jobs at design time: make the structure cheap to change, and protect the characteristics you care about with **fitness functions** — automated checks that *assure* a property the way a test assures behaviour. A decision record documents what was chosen; a fitness function proves it still holds. A rule that lives only in prose or code review is already drifting.

## Design for change

Optimise for evolvability over speculative completeness. You cannot predict which requirements shift, so build to absorb change cheaply — clear boundaries, reversible decisions, replaceable parts — rather than guessing the future and building for it. **Reversibility is the property worth paying for**: the cost of a decision is dominated by how hard it is to undo. Prefer one-way doors made deliberately and visibly (and recorded — see [decision-records.md](decision-records.md)); an architecture full of irreversible choices cannot evolve.

## Fitness functions assure what decisions document

Every architectural characteristic you actually care about should get an automated check that fails when it is violated:

- **dependency direction / layering** — the inward-flow rule (the core imports nothing concrete; edges depend inward) is the archetype, automatable with `depguard` / `import-linter` / ArchUnit; this is what turns it from a style into a guarantee.
- **API conformance** — spec linting (Spectral) + contract tests with a `can-i-deploy` gate ([api-and-contracts.md](api-and-contracts.md)).
- **budgets** — latency, bundle size, allowed couplings — checked in CI against committed thresholds.

The architect's job is to **advise which characteristics deserve a fitness function and where the seam goes**; the engineer skills build them. A new service ships with its dependency-direction check from day one. When you record a load-bearing decision, ask: what check would catch its violation? — that check is the decision's other half.

## Evolve incrementally, guarded by checks

Change lands in small reversible steps, each guarded by the fitness functions, so a regression is caught the moment it lands and the system can be reshaped continually instead of in big-bang migrations. Atomic checks guard one characteristic; holistic checks guard interactions; both run continually, not as a periodic audit.

## Modernise with the strangler fig, not the rewrite

Evolve legacy systems; do not replace them wholesale. New capability grows around the old behind a **façade** that routes traffic to the new implementation as each slice is proven, until the old system is starved and removed. The big-bang rewrite has the highest failure rate of any modernization approach; incremental replacement keeps the system shippable the whole way across. (This is the same discipline a brownfield adoption applies — strangle, don't stop the world.)

## Governance is advisory, not a gate

Decentralise the decision, centralise the visibility. An **advice process** (the decider must seek advice from those affected and those with expertise, but keeps the decision), a lightweight RFC, or an architecture guild replaces the central review board teams route around. Let fitness functions do the gatekeeping that can be automated; spend human judgement where automation cannot reach. "Governed decisions" never means a person standing at a gate.

## Antipatterns to catch

- **ADR graveyard** — decisions documented, never enforced. Pair the load-bearing ones with a check.
- **Big-bang rewrite** — replacing a working system all at once. Strangle it.
- **Review board as veto** — a central gate that becomes a bottleneck. Advise and automate.
- **Convention-only rules** — an agreed boundary with nothing failing the build when it is crossed.
- **Speculative future-proofing** — building for imagined requirements instead of for change.
