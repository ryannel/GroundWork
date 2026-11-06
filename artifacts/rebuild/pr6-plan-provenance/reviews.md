# Independent review of plan provenance

Requested by the user after the first amendment proposal. Three read-only reviews were conducted:
`plan_provenance_design`, `plan_provenance_code` and `plan_provenance_data`.
All three found a genuine conflict and recommended deriving proposal status from the existing overlay.
No design approval is implied by this review.

## Design

Keep one shared structural model. `IndexedPlan` already contains plan, before and after
(`src/application/plans-index.ts:7–13`). Attribute additions and changes to their containing plan/change/op;
do not add authored planned/proposed booleans. Existing planning conventions already derive status and say
anything a plan adds is planned (`.agents/skills/groundwork-plan/SKILL.md:133,160`).

The current unconditional effect-citation rule (`docs/rebuild/design.md:351`) prevents the index's existing
`no_cites` gaps (`src/application/model-index.ts:480–486`) from representing an ordinary future proposal.
Clarify that rule at the plan-projection boundary while preserving strict current-fact validation.

## Implementation

Plan handler additions reference the current Handler schema (`schema/plan.schema.json:407`). Generic
modify payloads (`schema/plan.schema.json:703`) postpone the failure until the after model is validated;
they do not solve it.

Use named validation profiles derived from the same schema authority, extending the existing
 authored/resolved distinction (`src/infrastructure/model-schema.ts:73`). Annotate the implementation-evidence
policy explicitly. Avoid blanket citation-rule removal, filtering validation failures or parallel recursive
PlanStep/PlanHandler models.

A projection validator should take the current base and plan, validate the base strictly, compute the result
itself and validate its shape and references. The ordinary current-fact validator must still reject that
uncited result. Derived attribution must identify changed behaviour even if old citations remain attached;
those citations establish baseline context, not implementation of the new behaviour.

## Volvo data

The two handler IDs are absent from the current authored domain files. They are explicit additions under
`chg:renew-and-release`, with future tests and work items:
`plans/care-se-stock-reservation/plan.yaml:220,238,257,297,358`.
This review did not rescan the underlying repositories to claim complete implementation absence.

The current reserve API can confirm a reservation for the same client and identifier
(`domains/commercial-backbone/systems/stock-reservation/contracts.yaml:103–109`). The plan proposes extending
expiry and asks whether that is supported (`plans/care-se-stock-reservation/plan.yaml:36–50,411–418`).
The programme retains an undecided duration (`programmes/care-se/programme.yaml:120–128`). Preserve these
questions and human assumptions; API citations cannot establish the proposed renewal semantics.

The eight plan files contain 17 operations with 313 step nodes: **7 handler operations / 275 nodes**
(5 replacements and 2 additions), plus **10 added flows / 38 nodes**. All 275 handler-tree nodes lack authored
step sources. Thus the specification's 313/17 total is correct, but describing all of them as handler steps
is imprecise. The six isolated schema errors are only the first two typed additions, not the entire exposure.

## Alternatives assessed

- Borrowing endpoint citations establishes dependency existence, not the proposed handler's implementation.
- Inventing evidence IDs for intentions would misrepresent evidence.
- Relaxing citation rules globally would weaken current-fact standards.
- Per-step planned flags duplicate information already present in ops.
- Removing the detailed ops or waiting for implementation loses the purpose and detail of the authored plan.

## Required proof after approval

The two additions should validate as proposed with six implementation-evidence gaps, and still fail as
current facts. Apply the same distinction to handler replacements. Invalid shapes and references must
retain their failures. A changed effect retaining old citations must stay visibly proposed; unchanged facts
must retain their evidence. Unrelated uncited current facts must fail strict base validation.
