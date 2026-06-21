# gw-bet-shape-uplift — bring in-flight bets to the current bet shape

The bet loop was restructured: pitches carry `status` frontmatter that routes the
workflow phases, decomposition writes a machine twin at
`.groundwork/bets/<slug>/decomposition.json`, and delivery seals a test manifest. A
bet opened before the restructure has none of this — the orchestrator cannot route
it, and `./dev bet status` cannot see it.

## Detect

- **Applies** when a bet under `docs/bets/<slug>/` is **in flight** — not yet
  delivered/validated — and is missing current tracking: no `status` frontmatter on
  its pitch, or it has reached decomposition (a plan/slices section exists) without
  `.groundwork/bets/<slug>/decomposition.json`.
- **Already done** when every in-flight bet routes cleanly through the current
  `groundwork-bet` workflows.
- **N/A** when there are no bets, or all bets are shipped/archived.

## Transform

Uplift tracking files only — the bet's substance (problem, appetite, design) is the
user's work and is not rewritten:

- Stamp pitch frontmatter to the current contract defined by the `groundwork-bet`
  skill's templates (`.groundwork/skills/groundwork-bet/` — read the current
  pitch template for the required fields; do not work from memory). Infer `status`
  from the artifacts present and confirm the inference with the user.
- For bets at or past decomposition, reconstruct `decomposition.json` from the
  written plan, marking already-delivered slices as such.
- **Shipped and archived bets are history — leave them byte-identical.**

**Invariant:** after uplift, the orchestrator and `groundwork-bet` route the bet to
the same phase the user believes it is in. When inference and the user disagree, the
user wins.

## Accept

- Every in-flight bet has a pitch `status` the workflow tables recognize, and
  `decomposition.json` where its phase requires one.
- Archived/shipped bet directories show no diff.
- One commit per bet, referencing `gw-bet-shape-uplift`.
