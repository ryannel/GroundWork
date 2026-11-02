# Run across a dataset

Use a bounded, resumable pass over the requested workspace. This workflow runs on existing scan evidence;
it is not permission to restart paused scans, fetch an entire organisation or certify deployed behaviour.
Continue local investigation and supported repairs within the user's scope. Isolate unresolved scopes and
complete the rest rather than stopping the whole run at the first gap.

## Establish the denominator

Inventory every domain, system, component and area in scope, including systems with no area or saved value
flow. Record source revisions, scan coverage/partial states, model input digest, tool version and actual
model/run identity where known. A count of diagrams or a valid schema is not evidence coverage.

The bundled helper inventories registered production workspaces without modifying them:

```sh
node --import ./tools/register.ts --conditions=react-server .agents/skills/groundwork-diagram/scripts/audit.mjs <ws> > /tmp/diagram-audit.json
```

It reports global structured relationships, components without them, systems missing area membership,
missing/invalid value flows, and disconnected groups in collapsed, individually expanded and all-expanded
projections. It uses the app's projection/selection logic without routing pixels. It does not inspect code,
judge purpose, prove absence, certify arrows or visually approve plots. Treat its findings as a review queue.

## Work in reviewable batches

Start with representative evidence: asynchronous preparation plus pull requests, a shared-resource case,
a sparse/partially scanned system and a cross-domain handoff. Apply the skill and inspect their actual
plots before spreading a modelling mistake across the dataset. These are pilot cases, not a cap on coverage.

Then account for every inventoried system. Reuse shared component evidence across areas; do not independently
invent conflicting descriptions of the same exchange. Review cross-boundary links after both sides are
modelled. Use the orphan audit for every isolated component or group, including those exposed only by
expansion. Resolve facts first, then reading order, summaries and default prominence.

When the user asks for parallel area work, give each area an independent agent with a bounded output folder.
Have it propose the area's system membership, saved value flow, meaningful boundary exchanges and orphan
dispositions. Keep shared model edits and landscape integration with one coordinator so overlapping systems
do not acquire conflicting facts. Each proposal needs exact production IDs, evidence references and a short
account of coverage and uncertainties; local agent completion is not final visual approval.

Persist a run ledger with a row per area/system: input revisions/digest, status (pending, reviewed,
needs-evidence, needs-renderer-fix), output paths, orphan dispositions, validation, screenshots and reviewer
findings. Preserve the original roster and explain exclusions. On resume, skip only unchanged reviewed
inputs; revisit affected neighbours, shared resources and interpretations when evidence changes. Do not
replace old receipts or mark unresolved scopes complete to improve a percentage.

## Quality gates

Evaluate separately, rather than collapsing everything into one reassuring score:

| Dimension      | Acceptance evidence                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Coverage       | Every in-scope system/component has a disposition; missing area/value-flow coverage is explicit.                        |
| Truth          | Every core exchange and summary is supported with correct endpoints, direction, conditions and evidence strength.       |
| Orphans        | No uninvestigated isolated cards or disconnected groups; remaining gaps have a bounded search and precise question.     |
| Ownership      | Single-service resources fold correctly; shared usage is checked across the workspace; event delivery survives folding. |
| Explanation    | A newcomer can identify inputs, preparation, stored data, consumers and outcome without already knowing names.          |
| Exploration    | Collapse, expansion, filtering and all connections preserve identities and access to evidence.                          |
| Visual quality | Actual screenshots show readable labels/boundaries, usable controls, clear routing and contextual expansion.            |
| Freshness      | Reviewed inputs and limitations are recorded; changed evidence invalidates affected interpretations.                    |

Validate every changed model. Review each delivered area's overview and each newly authored system expanded;
sample service cutaways by resource/relationship pattern and inspect every flagged or unusual case. For very
large runs, report sampled versus unreviewed states explicitly; sampled success cannot certify unseen plots.
An independent reviewer should challenge misleading meaning as well as spacing when delegation is available.

Finish with the coverage ledger, applied changes, evidence gaps, renderer issues and screenshot links.
“Ready” means the declared acceptance scope passed; the helper alone only establishes audit readiness.
