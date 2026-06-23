# gw-context-split — graduate in-doc summaries out of docs/

The cross-phase `## Summary for Downstream` contract moved out of published `docs/`
artifacts. The flow now keeps that contract in a temporary store at
`.groundwork/context/<phase>.md` during setup and tears it down at setup completion
(operating-contract Protocols 5 and 10), leaving `docs/` as clean reference
documentation. Projects set up before this change carry a `## Summary for Downstream`
section at the top of each setup doc — stale scaffolding the new model has no place for.

An installed project is, in the overwhelming common case, already past setup. There is
no live flow to consume a context store, so this migration does not recreate one: it
**graduates the summaries in place** — the same end state Setup Graduation produces —
and removes them from the docs.

## Detect

- **Applies** when any `docs/*.md` contains a `## Summary for Downstream` section.
- **Already done** when no `docs/` file carries that section.
- **N/A** for `docs/bets/<slug>/*` — bet documents never had a summary; leave them alone.

## Transform

For each `docs/*.md` (excluding `docs/bets/`) that opens with `## Summary for Downstream`:

1. **Graduate binding decisions.** Walk the section's `### Key Decisions` and
   `### Binding Constraints`. Any decision that still constrains the system and is not
   already recorded in `docs/decisions/` (an ADR) or stated plainly in a canonical doc
   body becomes a proper ADR under `docs/decisions/`, following the project's existing
   ADR convention. A decision already captured in an ADR or the doc body needs no new
   record — graduate, do not duplicate.
2. **Fold the rest into the body.** Any `### Deferred Question` now answerable, or
   `### Out of Scope` boundary worth stating, that is not already reflected in the doc
   body is woven into the body as ordinary documentation. Do not invent content the
   summary did not assert.
3. **Strip the section.** Remove the `## Summary for Downstream` heading and its four
   subsections from the doc. The published doc is left as clean reference documentation.

Do **not** write any `.groundwork/context/` files — a graduated project holds its
durable record in `docs/` alone. If `state.json` tracks setup completion and setup is
complete, set `setup_graduated: true`. If the project is still mid-setup (rare on
upgrade), the strip is still correct: remaining setup phases run the new model and the
orchestrator graduates at completion.

Delegate the writing of any new ADR and any body edit to `groundwork-writer` so the
graduated content matches house tone. Leave historical records — closed bets,
changelogs — untouched.

**Invariant:** no binding decision is lost. Every Key Decision and Binding Constraint
that was in a stripped summary survives either as an ADR in `docs/decisions/` or as a
statement in the doc body before the summary is removed.

## Accept

- No `docs/*.md` (outside `docs/bets/`) contains a `## Summary for Downstream` section.
- Every binding decision the summaries carried is present in `docs/decisions/` or a doc body.
- No `.groundwork/context/` directory was created by this migration.
- One commit, referencing `gw-context-split`.
