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

## Proposed text for docs/rebuild/design.md §5 and §6

> Code citations establish current behaviour. Plan overlays describe intended behaviour: new or changed
> effects may lack implementation citations, but must remain visibly proposed and unverified, with their
> plan and change recorded. Existing citations remain source context and do not establish that a proposed
> change is implemented. Applying a plan preserves structural and reference validation and reports missing
> implementation evidence as explicit gaps. Uncited proposals cannot become current workspace facts;
> landing a plan requires reconciliation with actual evidence.

This changes the trust treatment of plan projections, so it needs a product/design decision. It does not
change a coverage, mutation, architecture, page-size or current-fact evidence threshold. The exact schema
and validation representation will follow the approved rule and receive focused tests before PR6 closes.

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
