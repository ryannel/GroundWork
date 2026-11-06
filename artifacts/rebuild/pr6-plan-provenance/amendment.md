# Proposed plan provenance amendment

Status: awaiting the user's decision. No citation requirement has been relaxed for this proposal.

## Observed conflict

At Volvo commit `723085497ded5b51d3c23fdcb5f6b1c778aa3efa`,
`plans/care-se-stock-reservation/plan.yaml:238–276` proposes two new handlers:
`h:conditional-order-on-finance-application-update` (line 240) and
`h:conditional-order-on-finance-application-reject` (line 259).
Their six read, call and write effects describe future behaviour and have no code citations.

The canonical plan's handler addition uses the workspace Handler definition
(`schema/plan.schema.json:407`), whose Step rule requires `cites` for effects
(`schema/workspace.schema.json:3083`). Direct validation of those two converted handlers reports
exactly six missing-citation errors; this count excludes errors from unrelated union branches.
The complete converted values, exact error paths, source commit and schema hash are in `evidence.json`.

These are proposed changes, not six missing facts about the running system. Attaching existing handler
citations would falsely assert that the new behaviour is implemented. Inventing evidence records or
removing the current-fact citation requirement would also violate the rebuild guardrails.

## Proposed text for docs/rebuild/design.md §4.4, §5 and §6

> Plan ops describe intended changes. Their added or changed behaviour is proposed, with attribution derived
> from the plan and change containing the op. Implementation citations may be absent in a plan projection
> and remain visible evidence gaps. Existing citations provide source context; they do not establish that
> proposed behaviour is implemented. Current workspace facts continue to require effect citations.

Use the existing plan/before/after boundary. Keep one structural model and one schema authority; derive
proposal attribution beside the projection rather than authoring flags on steps. Named current-fact and
plan-projection validation profiles may differ only on the explicitly declared implementation-evidence
policy. Validate the base strictly and compute the projection from its actual ops before validating its
shape and references. The ordinary current-fact validator must still reject the same uncited values.

This is a narrow correction to the unconditional citation rule, not a new landing workflow. It does not
change a coverage, mutation, architecture, page-size or current-fact evidence threshold. Implementation
requires the user's approval and focused proof covering additions, replacements, retained old citations,
unchanged facts, invalid structure and invalid references.

## Independent review

The user requested three independent, read-only subagent reviews: design, implementation and Volvo data.
All three recommend the context-derived distinction above. None changed source files or ran expensive checks.
See `reviews.md` for their findings and alternatives.

## Reproduce

From the PR6 worktree:

```sh
node --import ./tools/register.ts --conditions=react-server \
  artifacts/rebuild/pr6-plan-provenance/prove.ts \
  /Users/RNEL/Workspace/volvo-groundwork \
  /tmp/groundwork-plan-provenance.json
```

The proof fails if the observed two-handler/six-effect conflict changes. It reads the original workspace
and writes only the selected report. Volvo remains unchanged.

## PR6 state at this pause

The focused migration suite passes: 8 files, 27 tests, including complete two-run byte equality with an
accepted headline, isolated output validation, unchanged source files, nested plan conversion, exact flow
anchors, metadata preservation and cited edge reconciliation. Full merge checks, build, budget and CI
have not run because PR6 is not ready. PR6 remains unmerged. Frozen baselines remain unchanged.
